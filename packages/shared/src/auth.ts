import { z } from 'zod';
import { normalizeTrMobile } from './phone.js';

export const phoneSchema = z.string().transform((v, ctx) => {
  const n = normalizeTrMobile(v);
  if (!n) {
    ctx.addIssue({ code: 'custom', message: 'Geçerli bir cep telefonu numarası gir' });
    return z.NEVER;
  }
  return n;
});

/**
 * Uygulama kurulum kimliği (cihaz kara listesi, Karar 43): mobil uygulama ilk açılışta üretir, güvenli depoda tutar ve
 * girişte gönderir. Sunucu yalnızca anahtarlı özetini saklar.
 */
export const installIdSchema = z.string().regex(/^[A-Za-z0-9-]{16,64}$/);

export const otpRequestSchema = z.object({ phone: phoneSchema, kurulum: installIdSchema.optional() });
export type OtpRequest = z.input<typeof otpRequestSchema>;

/**
 * Üyelik onayları (Karar 59 rıza kayıtları, Karar 49 ticari ileti, Karar 35 reklam ölçümü). Kullanım koşulları ve
 * KVKK aydınlatma metni zorunludur; diğer ikisi isteğe bağlı ve varsayılan kapalıdır.
 */
export const signupConsentsSchema = z.object({
  kullanimKosullari: z.literal(true, 'Kullanım koşullarını kabul etmelisin'),
  kvkkAydinlatma: z.literal(true, 'KVKK aydınlatma metnini okuduğunu işaretlemelisin'),
  ticariIleti: z.boolean().default(false),
  reklamOlcum: z.boolean().default(false),
});
export type SignupConsents = z.input<typeof signupConsentsSchema>;

export const otpVerifySchema = z.object({
  challengeId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, '6 haneli kodu gir'),
  platform: z.enum(['IOS', 'ANDROID', 'WEB']).default('WEB'),
  kurulum: installIdSchema.optional(),
  /** Yeni üyede zorunlu; kayıtlı kullanıcının girişinde verilirse yeniden kaydedilir */
  consents: signupConsentsSchema.optional(),
});
export type OtpVerify = z.input<typeof otpVerifySchema>;

/** Giriş bağlantısının kodu (32 bayt, base64url) */
export const loginLinkSchema = z.object({ kod: z.string().regex(/^[A-Za-z0-9_-]{40,64}$/) }).strict();

export const refreshSchema = z.object({ refreshToken: z.string().min(32) });

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Erişim jetonunun saniye cinsinden ömrü */
  expiresIn: number;
}

/** Çerez tercihi (çerez paneli; zorunlu çerezler her zaman açık) */
export const cookieConsentSchema = z.object({ analiz: z.boolean(), reklam: z.boolean() }).strict();

/** Ad ve soyad (Karar 29: talepte tam ad ya da "Ayşe Y.") */
export const personNameSchema = z.string().trim().min(2, 'En az 2 harf').max(40, 'En çok 40 harf');

// ── Üyelik ve giriş (Karar 18, 12 Kasım 2026) ──────────────────────────────────────────────

export const platformSchema = z.enum(['IOS', 'ANDROID', 'WEB']).default('WEB');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Geçerli bir e-posta adresi gir').max(254, 'E-posta adresi çok uzun'));

/** Şifre: en az 8 karakter, içinde harf ve rakam */
export const passwordSchema = z
  .string()
  .min(8, 'Şifre en az 8 karakter olmalı')
  .max(128, 'Şifre en çok 128 karakter olabilir')
  .refine((s) => /\p{L}/u.test(s) && /\d/.test(s), 'Şifrede en az bir harf ve bir rakam olsun');

/**
 * Üye ol, 1. adım: bilgiler ve telefon. Formla üye olan şifre verir; Google ya da Apple'dan gelen, girişte aldığı
 * `kayitJetonu`nu verir (ikisinden biri). Telefona kod gider; hesap kod doğrulanınca açılır.
 */
export const registerStartSchema = z
  .object({
    ad: personNameSchema,
    soyad: personNameSchema,
    eposta: emailSchema,
    telefon: phoneSchema,
    sifre: passwordSchema.optional(),
    kayitJetonu: z.string().min(20).max(4096).optional(),
    consents: signupConsentsSchema,
    platform: platformSchema,
    kurulum: installIdSchema.optional(),
  })
  .strict()
  .refine((b) => !!b.sifre !== !!b.kayitJetonu, {
    message: 'Şifre belirle ya da Google veya Apple ile devam et',
    path: ['sifre'],
  });
export type RegisterStart = z.input<typeof registerStartSchema>;

/** Telefon kodu (6 hane) */
export const phoneCodeSchema = z.string().regex(/^\d{6}$/, '6 haneli kodu gir');

/** Üye ol, 2. adım: telefona gelen kod */
export const registerVerifySchema = z
  .object({ challengeId: z.uuid(), code: phoneCodeSchema, kurulum: installIdSchema.optional() })
  .strict();
export type RegisterVerify = z.input<typeof registerVerifySchema>;

/** Kodu yeniden gönder (aynı üyelik isteği) */
export const registerResendSchema = z.object({ challengeId: z.uuid() }).strict();

/** E-posta ve şifreyle giriş */
export const loginSchema = z
  .object({
    eposta: emailSchema,
    sifre: z.string().min(1, 'Şifreni gir').max(128),
    platform: platformSchema,
    kurulum: installIdSchema.optional(),
  })
  .strict();
export type LoginInput = z.input<typeof loginSchema>;

/** Google ile giriş: yönlendirme adresi istenir */
export const googleStartSchema = z.object({ platform: platformSchema }).strict();

/** Google dönüşü (web ya da mobil, aynı yönlendirme sayfasından) */
export const googleCallbackSchema = z
  .object({
    state: z.string().min(20).max(200),
    code: z.string().min(1).max(4096),
    kurulum: installIdSchema.optional(),
  })
  .strict();

/** iPhone'da Apple ile giriş: Apple'ın kimlik jetonu; ad ve soyad Apple yalnızca ilk seferde verir */
export const appleLoginSchema = z
  .object({
    kimlikJetonu: z.string().min(20).max(8192),
    ad: z.string().trim().max(40).optional(),
    soyad: z.string().trim().max(40).optional(),
    platform: platformSchema,
    kurulum: installIdSchema.optional(),
  })
  .strict();

/**
 * Google ya da Apple ile girişin sonucu: hesap varsa oturum; yoksa üyelik formu Google'dan ya da Apple'dan gelen
 * bilgilerle doldurulur ve telefon istenir (`kayitJetonu` 30 dakika geçerli).
 */
export type SocialLoginResult =
  | ({ tip: 'giris' } & TokenPair)
  | {
      tip: 'kayit';
      kayitJetonu: string;
      saglayici: 'google' | 'apple';
      ad: string | null;
      soyad: string | null;
      eposta: string;
    };

/** Üyelik isteğinin yanıtı: kodun gittiği kanal (önce WhatsApp) */
export interface RegisterStarted {
  challengeId: string;
  expiresIn: number;
  /** ekran: kapalı testte kod gönderilmez, `devCode` ile döner */
  kanal: 'whatsapp' | 'sms' | 'ekran';
  /** Yalnızca yerel geliştirmede ve kapalı testte (kod gönderilmediği için) */
  devCode?: string;
}

export const forgotPasswordSchema = z.object({ eposta: emailSchema }).strict();
export const resetPasswordSchema = z
  .object({ kod: z.string().regex(/^[A-Za-z0-9_-]{40,64}$/), sifre: passwordSchema })
  .strict();
/** Ayarlar › Güvenlik: şifre değiştir ya da (Google veya Apple ile üye olan) şifre belirle */
export const changePasswordSchema = z
  .object({ mevcut: z.string().max(128).optional(), yeni: passwordSchema })
  .strict();
