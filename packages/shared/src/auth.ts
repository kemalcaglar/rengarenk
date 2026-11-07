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

export const otpRequestSchema = z.object({ phone: phoneSchema });
export type OtpRequest = z.input<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  challengeId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, '6 haneli kodu gir'),
  platform: z.enum(['IOS', 'ANDROID', 'WEB']).default('WEB'),
});
export type OtpVerify = z.input<typeof otpVerifySchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(32) });

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Erişim jetonunun saniye cinsinden ömrü */
  expiresIn: number;
}
