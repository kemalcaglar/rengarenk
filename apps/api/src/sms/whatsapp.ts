import { Logger } from '@nestjs/common';
import { WhatsAppError } from './code-sender.js';

/**
 * WhatsApp bildirimi (sahip kararı 22 Kasım 2026: SMS'in yerine WhatsApp; Karar 48, 49). Kritik iletiler (talebin son
 * günü, ödeme alınamadı) Meta WhatsApp Cloud API'nin onaylı "utility" şablonlarıyla gider: metin Meta'dadır, burada
 * yalnızca şablon adı ve gövdedeki {{1}}, {{2}} … değerleri gönderilir. Kampanya WhatsApp'tan gitmez.
 */
export interface WhatsAppSender {
  readonly name: string;
  sendTemplate(to: string, sablon: string, parametreler: string[]): Promise<{ messageId?: string }>;
}

export const WHATSAPP_SENDER = Symbol('WHATSAPP_SENDER');

/** Meta'nın gövde değişkeni kuralı: satır sonu, sekme ve dörtten çok art arda boşluk olmaz */
export const waParametre = (s: string) =>
  s
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {4,}/g, '   ')
    .trim()
    .slice(0, 1000);

/** Meta WhatsApp Cloud API. Belge: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates */
export class MetaWhatsAppSender implements WhatsAppSender {
  readonly name = 'whatsapp';
  constructor(
    private readonly token: string,
    private readonly phoneNumberId: string,
    private readonly lang: string,
    private readonly version: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly timeoutMs = 8000,
  ) {}

  async sendTemplate(to: string, sablon: string, parametreler: string[]) {
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
            name: sablon,
            language: { code: this.lang },
            components: parametreler.length
              ? [
                  {
                    type: 'body',
                    parameters: parametreler.map((p) => ({ type: 'text', text: waParametre(p) })),
                  },
                ]
              : [],
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

/** Yerel geliştirme: gönderilmez, günlüğe şablon adı yazılır (numara ve değerler yazılmaz) */
export class ConsoleWhatsAppSender implements WhatsAppSender {
  readonly name = 'console';
  private readonly log = new Logger('WhatsApp');
  async sendTemplate(_to: string, sablon: string) {
    this.log.log(`WhatsApp şablonu gönderildi sayıldı: ${sablon}`);
    return {};
  }
}

/** Testler: gönderilenler bellekte */
export class MemoryWhatsAppSender implements WhatsAppSender {
  readonly name = 'test';
  readonly sent: { to: string; sablon: string; parametreler: string[] }[] = [];
  async sendTemplate(to: string, sablon: string, parametreler: string[]) {
    this.sent.push({ to, sablon, parametreler });
    return { messageId: `wa-${this.sent.length}` };
  }
}

/** WhatsApp kapalı (Meta hesabı açılana kadar): bildirim teslim kaydına "atlandı" yazılır */
export class NoWhatsAppSender implements WhatsAppSender {
  readonly name = 'none';
  async sendTemplate(): Promise<{ messageId?: string }> {
    throw new Error('WhatsApp kapalı');
  }
}
