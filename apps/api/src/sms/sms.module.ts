import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { ConsoleSmsSender, MemorySmsSender } from './console.sender.js';
import { FailoverSmsSender } from './failover.sender.js';
import { IletiMerkeziSender } from './iletimerkezi.sender.js';
import { SMS_SENDER, type SmsSender } from './sms.js';

function create(kind: Env['SMS_PROVIDER'], env: Env): SmsSender {
  switch (kind) {
    case 'iletimerkezi':
      return new IletiMerkeziSender(
        env.ILETIMERKEZI_KEY ?? '',
        env.ILETIMERKEZI_HASH ?? '',
        env.SMS_SENDER_ID,
      );
    case 'test':
      return new MemorySmsSender();
    default:
      return new ConsoleSmsSender();
  }
}

export function createSmsSender(env: Env): SmsSender {
  const primary = create(env.SMS_PROVIDER, env);
  if (!env.SMS_FALLBACK_PROVIDER || env.SMS_FALLBACK_PROVIDER === env.SMS_PROVIDER) return primary;
  return new FailoverSmsSender(primary, create(env.SMS_FALLBACK_PROVIDER, env));
}

@Global()
@Module({
  providers: [{ provide: SMS_SENDER, inject: [ENV], useFactory: createSmsSender }],
  exports: [SMS_SENDER],
})
export class SmsModule {}
