import { Logger } from '@nestjs/common';
import { SmsError, type SmsSender } from './sms.js';

export type CodeChannel = 'whatsapp' | 'sms';

export interface CodeSendResult {
  kanal: CodeChannel;
  provider: string;
}

/**
 * Telefon doğrulama kodu (Karar 18): kanallar sırayla denenir (önce WhatsApp, yedek SMS). Kodun kendisi günlüğe
 * yazılmaz.
 */
export interface CodeSender {
  readonly kanallar: readonly CodeChannel[];
  send(to: string, code: string): Promise<CodeSendResult>;
}

export const CODE_SENDER = Symbol('CODE_SENDER');

export class WhatsAppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly metaCode?: number,
  ) {
    super(message);
  }
}

/**
 * Meta WhatsApp Cloud API, kimlik doğrulama şablonu: kod gövdede ve "Kodu kopyala" düğmesinde aynı parametreyle
 * gider. Belge: https://developers.facebook.com/docs/whatsapp/business-management-api/authentication-templates
 */
export class WhatsAppCodeSender {
  readonly name = 'whatsapp';
  constructor(
    private readonly token: string,
    private readonly phoneNumberId: string,
    private readonly template: string,
    private readonly lang: string,
    private readonly version: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly timeoutMs = 8000,
  ) {}

  async send(to: string, code: string): Promise<{ messageId?: string }> {
    const res = await this.fetchFn(
      `https://graph.facebook.com/${this.version}/${encodeURIComponent(this.phoneNumberId)}/messages`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to.replace(/^\+/, ''),
          type: 'template',
          template: {
            name: this.template,
            language: { code: this.lang },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: code }] },
              { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
            ],
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      },
    );
    const body = (await res.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { message?: string; code?: number };
    };
    if (!res.ok || body.error) {
      throw new WhatsAppError(
        `WhatsApp gönderimi reddedildi (${res.status}${body.error?.code ? `, ${body.error.code}` : ''})`,
        res.status,
        body.error?.code,
      );
    }
    return { messageId: body.messages?.[0]?.id };
  }
}

/** Kanalları sırayla dener; biri başarılı olunca durur. Hepsi başarısızsa son hata fırlatılır. */
export class ChannelCodeSender implements CodeSender {
  private readonly log = new Logger('Doğrulama kodu');
  constructor(
    readonly kanallar: readonly CodeChannel[],
    private readonly sms: SmsSender,
    private readonly whatsapp: { readonly name: string; send(to: string, code: string): Promise<unknown> } | null,
  ) {}

  async send(to: string, code: string): Promise<CodeSendResult> {
    let son: unknown = new Error('Doğrulama kodu kanalı yok');
    for (const kanal of this.kanallar) {
      try {
        if (kanal === 'whatsapp') {
          if (!this.whatsapp) continue;
          await this.whatsapp.send(to, code);
          return { kanal, provider: this.whatsapp.name };
        }
        const r = await this.sms.send(to, `Rengarenk doğrulama kodun: ${code}. Kodu kimseyle paylaşma.`);
        return { kanal, provider: r.provider };
      } catch (err) {
        son = err;
        // Numara geçersizse diğer kanal da işe yaramaz
        if (err instanceof SmsError && err.permanent) break;
        this.log.warn(`${kanal} ile gönderilemedi: ${(err as Error).message}`);
      }
    }
    throw son;
  }
}
