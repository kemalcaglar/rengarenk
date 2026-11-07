import { Logger } from '@nestjs/common';
import type { SmsResult, SmsSender } from './sms.js';

/** Geliştirme: kodu API günlüğüne yazar. Canlıda kullanılamaz (env.ts engeller). */
export class ConsoleSmsSender implements SmsSender {
  readonly name = 'console';
  private readonly log = new Logger('SMS');
  async send(to: string, text: string): Promise<SmsResult> {
    this.log.log(`→ ${to.slice(0, 5)}*****${to.slice(-2)}: ${text}`);
    return { provider: this.name };
  }
}

/** Testler: gönderilen mesajları bellekte tutar; istenirse hata verir. */
export class MemorySmsSender implements SmsSender {
  readonly sent: { to: string; text: string }[] = [];
  failNext = 0;
  constructor(readonly name = 'test') {}
  async send(to: string, text: string): Promise<SmsResult> {
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error(`${this.name} geçici hata`);
    }
    this.sent.push({ to, text });
    return { provider: this.name, messageId: String(this.sent.length) };
  }
  lastCode(to: string): string | undefined {
    const m = [...this.sent].reverse().find((s) => s.to === to);
    return m?.text.match(/\d{6}/)?.[0];
  }
}
