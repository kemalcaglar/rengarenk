import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Şifre özeti (Karar 18; Teknik tasarım §11): scrypt, kullanıcıya özel 16 baytlık tuz. Biçim
 * `scrypt$N$r$p$tuz$özet` (base64url); parametre değişirse eski özetler okunmaya devam eder.
 */
const N = 1 << 15;
const R = 8;
const P = 1;
const KEYLEN = 32;
/** N=2^15, r=8 için yaklaşık 32 MB; Node'un 32 MB varsayılan sınırı yetmediği için açıkça verilir */
const MAXMEM = 64 * 1024 * 1024;

function derive(sifre: string, tuz: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(sifre.normalize('NFC'), tuz, KEYLEN, { N: n, r, p, maxmem: MAXMEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(sifre: string): Promise<string> {
  const tuz = randomBytes(16);
  const key = await derive(sifre, tuz, N, R, P);
  return `scrypt$${N}$${R}$${P}$${tuz.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(sifre: string, ozet: string): Promise<boolean> {
  const [ad, n, r, p, tuz, key] = ozet.split('$');
  if (ad !== 'scrypt' || !n || !r || !p || !tuz || !key) return false;
  const beklenen = Buffer.from(key, 'base64url');
  const gelen = await derive(sifre, Buffer.from(tuz, 'base64url'), Number(n), Number(r), Number(p));
  return gelen.length === beklenen.length && timingSafeEqual(gelen, beklenen);
}

/**
 * Hesap yokken de aynı sürede yanıt vermek için (e-posta kayıtlı mı tahmin edilmesin) kullanılan sabit özet.
 * Hiçbir şifreyle eşleşmez.
 */
let bosOzet: Promise<string> | null = null;
export function dummyHash(): Promise<string> {
  bosOzet ??= hashPassword(randomBytes(24).toString('base64url'));
  return bosOzet;
}
