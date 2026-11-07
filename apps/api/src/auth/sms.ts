import { Injectable, Logger } from '@nestjs/common';

/** SMS gönderimi. Ana ve yedek sağlayıcı Sprint 2'de bu arayüzün arkasına eklenir. */
export interface SmsSender {
  send(to: string, text: string): Promise<void>;
}
export const SMS_SENDER = Symbol('SMS_SENDER');

/** Geliştirme: kodu API günlüğüne yazar. Canlıda kullanılamaz. */
@Injectable()
export class ConsoleSmsSender implements SmsSender {
  private readonly log = new Logger('SMS');
  async send(to: string, text: string) {
    this.log.log(`→ ${to.slice(0, 5)}*****${to.slice(-2)}: ${text}`);
  }
}

/** Testler: gönderilen mesajları bellekte tutar. */
export class MemorySmsSender implements SmsSender {
  readonly sent: { to: string; text: string }[] = [];
  async send(to: string, text: string) {
    this.sent.push({ to, text });
  }
  lastCode(to: string): string | undefined {
    const m = [...this.sent].reverse().find((s) => s.to === to);
    return m?.text.match(/\d{6}/)?.[0];
  }
}
