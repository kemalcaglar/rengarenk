import { Global, Module } from '@nestjs/common';
import { AgentService } from '../agent/agent.service.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { ChannelCodeSender, CODE_SENDER, WhatsAppCodeSender } from './code-sender.js';
import { ConsoleSmsSender, MemorySmsSender, NoSmsSender } from './console.sender.js';
import { FailoverSmsSender } from './failover.sender.js';
import { IletiMerkeziSender } from './iletimerkezi.sender.js';
import { SMS_SENDER, type SmsSender } from './sms.js';
import {
  ConsoleWhatsAppSender,
  MemoryWhatsAppSender,
  MetaWhatsAppSender,
  NoWhatsAppSender,
  WHATSAPP_SENDER,
  type WhatsAppSender,
} from './whatsapp.js';

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
    case 'none':
      return new NoSmsSender();
    default:
      return new ConsoleSmsSender();
  }
}

export function createSmsSender(env: Env, agent?: AgentService, db?: Db): SmsSender {
  const primary = create(env.SMS_PROVIDER, env);
  if (!env.SMS_FALLBACK_PROVIDER || env.SMS_FALLBACK_PROVIDER === env.SMS_PROVIDER) return primary;
  return new FailoverSmsSender(primary, create(env.SMS_FALLBACK_PROVIDER, env), {
    // Yedeğe geçiş ajanın akışına yazılır (YonetimEkip › ajan: "SMS sağlayıcısı yedeğe geçirildi")
    onFailover: (i) => {
      if (!agent || !db) return;
      void db
        .$transaction((tx) =>
          agent.kaydet(tx, {
            kind: 'sms_yedek',
            title: 'SMS sağlayıcısı yedeğe geçirildi',
            reason: `${i.primary} art arda hata verdi; ${Math.round(i.cooldownMs / 60_000)} dakika doğrulama kodları ${i.fallback} üzerinden gidiyor`,
            confidence: 'Kural',
          }),
        )
        .catch(() => undefined);
    },
  });
}

/** Telefon doğrulama kodu (Karar 18): VERIFY_CHANNELS sırasıyla WhatsApp ve SMS */
export function createCodeSender(env: Env, sms: SmsSender) {
  const wa =
    env.VERIFY_CHANNELS.includes('whatsapp') && env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID
      ? new WhatsAppCodeSender(
          env.WHATSAPP_TOKEN,
          env.WHATSAPP_PHONE_NUMBER_ID,
          env.WHATSAPP_TEMPLATE,
          env.WHATSAPP_TEMPLATE_LANG,
          env.WHATSAPP_API_VERSION,
        )
      : null;
  return new ChannelCodeSender(env.VERIFY_CHANNELS, sms, wa);
}

/** WhatsApp bildirimleri (kritik iletiler; SMS'in yerine) */
export function createWhatsAppSender(env: Env): WhatsAppSender {
  switch (env.WHATSAPP_PROVIDER) {
    case 'meta':
      return new MetaWhatsAppSender(
        env.WHATSAPP_TOKEN ?? '',
        env.WHATSAPP_PHONE_NUMBER_ID ?? '',
        env.WHATSAPP_TEMPLATE_LANG,
        env.WHATSAPP_API_VERSION,
      );
    case 'test':
      return new MemoryWhatsAppSender();
    case 'none':
      return new NoWhatsAppSender();
    default:
      return new ConsoleWhatsAppSender();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: SMS_SENDER,
      inject: [ENV, { token: AgentService, optional: true }, { token: PRISMA, optional: true }],
      useFactory: createSmsSender,
    },
    {
      provide: CODE_SENDER,
      inject: [ENV, SMS_SENDER],
      useFactory: createCodeSender,
    },
    { provide: WHATSAPP_SENDER, inject: [ENV], useFactory: createWhatsAppSender },
  ],
  exports: [SMS_SENDER, CODE_SENDER, WHATSAPP_SENDER],
})
export class SmsModule {}
