import { Logger } from '@nestjs/common';
import { SmsError, type SmsResult, type SmsSender } from './sms.js';

export interface FailoverOptions {
  /** Art arda bu kadar hata olursa ana sağlayıcı devre dışı bırakılır */
  failureThreshold?: number;
  /** Devre dışı kalma süresi; sonra ana sağlayıcı yeniden denenir */
  cooldownMs?: number;
  now?: () => number;
  /** Ana sağlayıcı devre dışı kalınca (ajanın akışına yazılır; Karar 41) */
  onFailover?: (info: { primary: string; fallback: string; cooldownMs: number; error: string }) => void;
}

/**
 * Ana ve yedek SMS sağlayıcısı (Teknik tasarım §9: "hata oranı eşiği aşılınca otomatik yedeğe geçiş").
 * Her gönderim önce ana sağlayıcıyla denenir; geçici hatada aynı mesaj yedekle gönderilir. Ana sağlayıcı art
 * arda hata verirse bir süre doğrudan yedek kullanılır.
 */
export class FailoverSmsSender implements SmsSender {
  readonly name: string;
  private readonly log = new Logger('SMS');
  private failures = 0;
  private openUntil = 0;
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;
  private readonly onFailover?: FailoverOptions['onFailover'];

  constructor(
    private readonly primary: SmsSender,
    private readonly fallback: SmsSender,
    opts: FailoverOptions = {},
  ) {
    this.name = `${primary.name}+${fallback.name}`;
    this.threshold = opts.failureThreshold ?? 3;
    this.cooldownMs = opts.cooldownMs ?? 5 * 60_000;
    this.now = opts.now ?? Date.now;
    this.onFailover = opts.onFailover;
  }

  get primaryDisabled(): boolean {
    return this.now() < this.openUntil;
  }

  async send(to: string, text: string): Promise<SmsResult> {
    if (!this.primaryDisabled) {
      try {
        const r = await this.primary.send(to, text);
        this.failures = 0;
        return r;
      } catch (err) {
        if (err instanceof SmsError && err.permanent) throw err;
        this.failures++;
        if (this.failures >= this.threshold) {
          this.openUntil = this.now() + this.cooldownMs;
          this.failures = 0;
          this.log.error(`${this.primary.name} devre dışı, ${this.cooldownMs / 1000} sn yedek kullanılacak`);
          try {
            this.onFailover?.({
              primary: this.primary.name,
              fallback: this.fallback.name,
              cooldownMs: this.cooldownMs,
              error: (err as Error).message.slice(0, 200),
            });
          } catch {
            // Kayıt hatası gönderimi durdurmaz
          }
        }
        this.log.warn(`${this.primary.name} hata verdi, yedeğe geçiliyor: ${(err as Error).message}`);
      }
    }
    return this.fallback.send(to, text);
  }
}
