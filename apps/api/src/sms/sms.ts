/** SMS gönderimi. Her sağlayıcı bu arayüzün arkasındadır; yönlendirici ana ve yedek arasında geçiş yapar. */
export interface SmsSender {
  readonly name: string;
  send(to: string, text: string): Promise<SmsResult>;
}

export interface SmsResult {
  provider: string;
  messageId?: string;
}

export class SmsError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    /** Kalıcı hata (ör. geçersiz numara): yedeğe geçmek işe yaramaz */
    readonly permanent = false,
  ) {
    super(message);
  }
}

export const SMS_SENDER = Symbol('SMS_SENDER');
