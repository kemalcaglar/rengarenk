import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

/** GlitchTip (Sentry uyumlu). Yalnızca SENTRY_DSN tanımlıysa açılır; kişisel veri gönderilmez. */
export function initSentry(dsn: string | undefined, environment: string) {
  if (!dsn) return false;
  // Varsayılan olarak IP, çerez ve istek gövdesi gönderilmez.
  Sentry.init({ dsn, environment, tracesSampleRate: 0 });
  return true;
}

/** 5xx hatalarını hata izlemeye bildirir; yanıt Nest'in varsayılan biçimindedir. */
@Catch()
export class ReportingExceptionFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500) Sentry.captureException(exception);
    super.catch(exception, host);
  }
}
