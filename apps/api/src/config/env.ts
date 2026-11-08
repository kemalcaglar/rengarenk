import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  /** Talep araması (Teknik tasarım §12) */
  OPENSEARCH_URL: z.string().default('http://localhost:9200'),
  /** İndeks adlarının öneki; testler kendi önekini kullanır */
  OPENSEARCH_PREFIX: z
    .string()
    .regex(/^[a-z0-9_]+$/)
    .default('rr'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalı'),
  /**
   * Galeri başvurusu kontrolleri (Karar 03, 17): yetki belgesi (Ticaret Bakanlığı), vergi (GİB), MERSİS. none: bağlantı
   * yok, kontroller "yapılamadı" sayılır ve başvuru insana düşer. fake: geliştirme ve test; canlıda kullanılamaz.
   */
  GALLERY_VERIFY_PROVIDER: z.enum(['none', 'fake']).default('none'),
  /**
   * EİDS (Karar 17, m.22/ç): portföy aracının ruhsat sahibi onayı. none: bağlantı yok, araç doğrulama bekler ve
   * alıcılara görünmez. fake: geliştirme ve test; canlıda kullanılamaz.
   */
  EIDS_PROVIDER: z.enum(['none', 'fake']).default('none'),
  /**
   * Web ödemesi (Karar 12.7): none ödeme kapalı (PayTR sözleşmesi gelene kadar canlı), paytr gerçek iFrame API,
   * fake geliştirme ve test için kendi sahte ödeme sayfası (canlıda kullanılamaz).
   */
  PAYMENT_PROVIDER: z.enum(['none', 'fake', 'paytr']).default('none'),
  PAYTR_MERCHANT_ID: z.string().optional(),
  PAYTR_MERCHANT_KEY: z.string().optional(),
  PAYTR_MERCHANT_SALT: z.string().optional(),
  /** PayTR canlı mağazada test işlemi (1) */
  PAYTR_TEST_MODE: z.enum(['0', '1']).default('0'),
  /** e-Arşiv fatura entegratörü: none (fatura kuyrukta bekler), fake (geliştirme ve test; canlıda kullanılamaz) */
  EARSIV_PROVIDER: z.enum(['none', 'fake']).default('none'),
  /**
   * Mağaza ödemeleri (Karar 38): none kapalı (Apple ve Google hesapları açılana kadar canlı), revenuecat gerçek
   * (RevenueCat bildirimi), fake geliştirme ve test için sahte mağaza (canlıda kullanılamaz).
   */
  STORE_PROVIDER: z.enum(['none', 'fake', 'revenuecat']).default('none'),
  /**
   * İade yürütücü (Teknik tasarım §7, kilit 2): yalnızca ayrı `refund-executor` sürecinde okunur. none iade kapalı,
   * paytr gerçek (PayTR iade API), fake geliştirme ve test (canlıda kullanılamaz). PayTR mağaza bilgileri bu süreç için
   * ayrı adla (`IADE_PAYTR_*`) ve ayrı ortam dosyasıyla verilir; API ve işçi bu değişkenleri okumaz.
   */
  REFUND_PROVIDER: z.enum(['none', 'fake', 'paytr']).default('none'),
  IADE_YURUTUCU: z.enum(['0', '1']).default('0'),
  IADE_PAYTR_MERCHANT_ID: z.string().optional(),
  IADE_PAYTR_MERCHANT_KEY: z.string().optional(),
  IADE_PAYTR_MERCHANT_SALT: z.string().optional(),
  /** RevenueCat panelinde bildirim (webhook) için tanımlanan Authorization değeri */
  REVENUECAT_WEBHOOK_AUTH: z.string().min(24).optional(),
  /**
   * Bildirim kanalları (Karar 48, 50). E-posta: smtp (kendi sunucumuz; yerelde Mailpit :1025), memory (test), none.
   * İşlemsel ve ticari e-posta ayrı gönderen adresinden (ve canlıda ayrı IP'den) çıkar.
   */
  EMAIL_PROVIDER: z.enum(['none', 'smtp', 'memory']).default('none'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_SECURE: z.enum(['0', '1']).default('0'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EPOSTA_GONDEREN: z.string().default('Rengarenk <bildirim@bildirim.rengarenk.com.tr>'),
  EPOSTA_GONDEREN_TICARI: z.string().default('Rengarenk <bulten@bulten.rengarenk.com.tr>'),
  /** Push (FCM HTTP v1): none, fake (geliştirme ve test), fcm (hizmet hesabı JSON'u base64) */
  PUSH_PROVIDER: z.enum(['none', 'fake', 'fcm']).default('none'),
  FCM_SERVICE_ACCOUNT: z.string().optional(),
  /** API'nin dışarıdan görünen adresi (sahte ödeme sayfası, bildirim adresi) */
  API_PUBLIC_URL: z.string().default('http://localhost:4000'),
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
  /**
   * Yönetim girişi (T10). google: Google Workspace (OpenID Connect). fake: geliştirme ve test için
   * Google'ı taklit eden sahte sağlayıcı; canlıda kullanılamaz.
   */
  STAFF_AUTH_PROVIDER: z.enum(['google', 'fake']).default('fake'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** Yönetime girebilecek şirket e-posta alanları, virgülle ayrılır. */
  STAFF_EMAIL_DOMAINS: z
    .string()
    .default('rengarenk.com.tr')
    .transform((v) =>
      v
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean),
    ),
  /** Doğrulama uygulaması sırlarını şifreleyen anahtar (en az 32 karakter). Canlıda zorunlu. */
  STAFF_SECRET_KEY: z.string().min(32, 'STAFF_SECRET_KEY en az 32 karakter olmalı').optional(),
  /** Mesaj gövdelerinin şifreleme anahtarı (Teknik tasarım §8); geliştirmede JWT_SECRET'ten türetilir */
  MESSAGE_SECRET_KEY: z.string().min(32, 'MESSAGE_SECRET_KEY en az 32 karakter olmalı').optional(),
  /**
   * Google Workspace hesabı şartı (Google'ın `hd` bilgisi). Yalnızca geliştirmede, kişisel Google
   * hesabıyla gerçek giriş denemek için `false` yapılabilir; canlıda kapatılamaz.
   */
  /**
   * Katalog paketlerinin imza anahtarları (Ed25519, Teknik tasarım §5). Hat paketi imzalar, API doğrular.
   * PEM ya da base64 DER. Geliştirmede verilmezse JWT_SECRET'ten sabit bir çift türetilir; canlıda zorunlu.
   * Üretmek için: pnpm --filter @rengarenk/api katalog:anahtar
   */
  CATALOG_SIGNING_KEY: z.string().optional(),
  CATALOG_VERIFY_KEY: z.string().optional(),
  /** Dosya deposu: SeaweedFS (S3 uyumlu). Yerelde kimlik doğrulama kapalı; canlıda anahtarlar zorunlu. */
  S3_ENDPOINT: z.string().default('http://localhost:8333'),
  S3_ACCESS_KEY: z.string().default('rengarenk'),
  S3_SECRET_KEY: z.string().default('rengarenk-dev-secret'),
  S3_BUCKET: z.string().default('rengarenk'),
  S3_REGION: z.string().default('us-east-1'),
  /** TSB sitesinin adresi (testte sahte sunucu) */
  TSB_BASE_URL: z.string().default('https://www.tsb.org.tr'),
  STAFF_REQUIRE_WORKSPACE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // `.env` içindeki boş satırlar (ör. `STAFF_SECRET_KEY=`) verilmemiş sayılır.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''));
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Ortam değişkenleri geçersiz:\n${lines}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === 'production') {
    if (e.SMS_PROVIDER === 'console' || e.SMS_PROVIDER === 'test')
      throw new Error('Canlıda gerçek bir SMS sağlayıcısı gerekli');
    if (!e.METRICS_TOKEN) throw new Error('Canlıda METRICS_TOKEN gerekli');
    if (e.GALLERY_VERIFY_PROVIDER === 'fake')
      throw new Error('Canlıda sahte galeri doğrulaması kullanılamaz');
    if (e.EIDS_PROVIDER === 'fake') throw new Error('Canlıda sahte EİDS kullanılamaz');
    if (e.PAYMENT_PROVIDER === 'fake') throw new Error('Canlıda sahte ödeme kullanılamaz');
    if (e.EARSIV_PROVIDER === 'fake') throw new Error('Canlıda sahte e-Arşiv kullanılamaz');
    if (e.STORE_PROVIDER === 'fake') throw new Error('Canlıda sahte mağaza kullanılamaz');
    if (e.REFUND_PROVIDER === 'fake') throw new Error('Canlıda sahte iade kullanılamaz');
    if (e.PUSH_PROVIDER === 'fake') throw new Error('Canlıda sahte push kullanılamaz');
    if (e.EMAIL_PROVIDER === 'memory') throw new Error('Canlıda bellek içi e-posta kullanılamaz');
    if (e.STAFF_AUTH_PROVIDER !== 'google') throw new Error('Canlıda yönetim girişi Google Workspace olmalı');
    if (!e.STAFF_SECRET_KEY) throw new Error('Canlıda STAFF_SECRET_KEY gerekli');
    if (!e.MESSAGE_SECRET_KEY) throw new Error('Canlıda MESSAGE_SECRET_KEY gerekli');
    if (!e.STAFF_REQUIRE_WORKSPACE) throw new Error('Canlıda Google Workspace şartı kapatılamaz');
    if (e.S3_SECRET_KEY === 'rengarenk-dev-secret' || e.S3_SECRET_KEY === 'CHANGE_ME') {
      throw new Error('Canlıda S3_SECRET_KEY geliştirme değeri olamaz');
    }
    if (!e.CATALOG_SIGNING_KEY || !e.CATALOG_VERIFY_KEY) {
      throw new Error('Canlıda CATALOG_SIGNING_KEY ve CATALOG_VERIFY_KEY gerekli');
    }
  }
  if (e.STAFF_AUTH_PROVIDER === 'google' && !(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET)) {
    throw new Error('Google Workspace girişi için GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET gerekli');
  }
  if (
    e.PAYMENT_PROVIDER === 'paytr' &&
    !(e.PAYTR_MERCHANT_ID && e.PAYTR_MERCHANT_KEY && e.PAYTR_MERCHANT_SALT)
  ) {
    throw new Error('PayTR için PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY ve PAYTR_MERCHANT_SALT gerekli');
  }
  if (e.PUSH_PROVIDER === 'fcm' && !e.FCM_SERVICE_ACCOUNT)
    throw new Error('FCM için FCM_SERVICE_ACCOUNT gerekli');
  if (e.STORE_PROVIDER === 'revenuecat' && !e.REVENUECAT_WEBHOOK_AUTH) {
    throw new Error('RevenueCat için REVENUECAT_WEBHOOK_AUTH gerekli');
  }
  if (e.STAFF_EMAIL_DOMAINS.length === 0) throw new Error('STAFF_EMAIL_DOMAINS boş olamaz');
  for (const p of [e.SMS_PROVIDER, e.SMS_FALLBACK_PROVIDER]) {
    if (p === 'iletimerkezi' && !(e.ILETIMERKEZI_KEY && e.ILETIMERKEZI_HASH)) {
      throw new Error('İleti Merkezi için ILETIMERKEZI_KEY ve ILETIMERKEZI_HASH gerekli');
    }
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
