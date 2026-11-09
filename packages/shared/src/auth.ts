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
