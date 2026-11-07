import { SmsError, type SmsResult, type SmsSender } from './sms.js';

const URL = 'https://api.iletimerkezi.com/v1/send-sms/json';
/** Numara veya içerik hatası: başka sağlayıcıda denemek sonucu değiştirmez. */
const PERMANENT = new Set([452, 466]);

/**
 * İleti Merkezi REST/JSON API. Doğrulama kodu işlemsel ileti olduğu için İYS denetimi kapalı (iys=0).
 * Belge: https://www.iletimerkezi.com/en/docs/api/send-sms
 */
export class IletiMerkeziSender implements SmsSender {
  readonly name = 'iletimerkezi';
  constructor(
    private readonly key: string,
    private readonly hash: string,
    private readonly sender: string,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly timeoutMs = 5000,
  ) {}

  async send(to: string, text: string): Promise<SmsResult> {
    const body = {
      request: {
        authentication: { key: this.key, hash: this.hash },
        order: {
          sender: this.sender,
          iys: '0',
          // Alan adı sağlayıcının belgesindeki gibi "receipents" yazılır.
          message: { text, receipents: { number: [to.replace(/^\+/, '')] } },
        },
      },
    };
    let res: Response;
    try {
      res = await this.fetchFn(URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new SmsError(`bağlantı hatası: ${(err as Error).message}`, this.name);
    }
    const data = (await res.json().catch(() => ({}))) as {
      response?: { status?: { code?: number | string; message?: string }; order?: { id?: string } };
    };
    const code = Number(data.response?.status?.code ?? res.status);
    if (code !== 200) {
      throw new SmsError(
        `kod ${code}: ${data.response?.status?.message ?? res.statusText}`,
        this.name,
        PERMANENT.has(code),
      );
    }
    return { provider: this.name, messageId: data.response?.order?.id };
  }
}
