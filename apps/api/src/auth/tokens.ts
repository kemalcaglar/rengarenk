import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_DAYS = 90; // T09
export const OTP_TTL_SECONDS = 180;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_COOLDOWN_SECONDS = 60;
export const OTP_MAX_PER_HOUR = 5;

export const newOtpCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const newRefreshToken = () => randomBytes(48).toString('base64url');
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export function hashOtp(secret: string, challengeId: string, code: string) {
  return createHmac('sha256', secret).update(`${challengeId}:${code}`).digest('hex');
}

export function safeEqualHex(a: string, b: string) {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
