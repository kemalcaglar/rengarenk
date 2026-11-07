import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Doğrulama uygulaması kodu (TOTP, RFC 6238): 30 saniyelik adım, 6 hane, HMAC-SHA1.
 * Google Authenticator, Microsoft Authenticator, 1Password vb. ile uyumludur.
 */
export const TOTP_PERIOD_SECONDS = 30;
const DIGITS = 6;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/[\s=]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error('geçersiz base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160 bitlik rastgele sır (base32). */
export const newTotpSecret = () => base32Encode(randomBytes(20));

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);

/** Verilen zaman adımı için kod (HOTP, RFC 4226). */
export function totpAt(secretB32: string, step: number, digits = DIGITS): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', base32Decode(secretB32)).update(counter).digest();
  const offset = (mac[mac.length - 1] ?? 0) & 0xf;
  const bin = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(bin % 10 ** digits).padStart(digits, '0');
}

/**
 * Kodu doğrular; saat kaymasına karşı bir önceki ve bir sonraki adım da kabul edilir. Daha önce
 * kabul edilmiş adım (veya öncesi) reddedilir: aynı kod iki kez kullanılamaz. Eşleşen adımı döndürür.
 */
export function verifyTotp(
  secretB32: string,
  code: string,
  lastStep: bigint | null,
  now = Date.now(),
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const step = currentStep(now);
  for (const s of [step - 1, step, step + 1]) {
    if (lastStep !== null && BigInt(s) <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(totpAt(secretB32, s)), Buffer.from(code))) return s;
  }
  return null;
}

/** Doğrulama uygulamasının okuyacağı adres (karekodun içeriği). */
export function otpauthUri(secretB32: string, account: string, issuer = 'Rengarenk Yönetim'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const q = new URLSearchParams({
    secret: secretB32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${q}`;
}
