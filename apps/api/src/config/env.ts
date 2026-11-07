import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalı'),
  SMS_PROVIDER: z.enum(['console', 'test', 'iletimerkezi']).default('console'),
  /** Ana sağlayıcı arızalanınca kullanılacak yedek (Teknik tasarım §9). */
  SMS_FALLBACK_PROVIDER: z.enum(['console', 'test', 'iletimerkezi']).optional(),
  /** BTK onaylı gönderici adı (başlık) */
  SMS_SENDER_ID: z.string().default('RENGARENK'),
  ILETIMERKEZI_KEY: z.string().optional(),
  ILETIMERKEZI_HASH: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Prometheus'un /metrics için kullanacağı jeton; boşsa yalnızca geliştirmede açık */
  METRICS_TOKEN: z.string().optional(),
  /** GlitchTip (Sentry uyumlu) adresi; boşsa hata izleme kapalı */
  SENTRY_DSN: z.string().optional(),
  API_PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  ADMIN_ORIGIN: z.string().default('http://localhost:3001'),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Ortam değişkenleri geçersiz:\n${lines}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === 'production') {
    if (e.SMS_PROVIDER === 'console' || e.SMS_PROVIDER === 'test')
      throw new Error('Canlıda gerçek bir SMS sağlayıcısı gerekli');
    if (!e.METRICS_TOKEN) throw new Error('Canlıda METRICS_TOKEN gerekli');
  }
  for (const p of [e.SMS_PROVIDER, e.SMS_FALLBACK_PROVIDER]) {
    if (p === 'iletimerkezi' && !(e.ILETIMERKEZI_KEY && e.ILETIMERKEZI_HASH)) {
      throw new Error('İleti Merkezi için ILETIMERKEZI_KEY ve ILETIMERKEZI_HASH gerekli');
    }
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
