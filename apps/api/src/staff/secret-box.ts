import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
} from 'node:crypto';
import type { Env } from '../config/env.js';

/**
 * Doğrulama uygulaması sırlarını veritabanında AES-256-GCM ile şifreler. Anahtar veriden ayrı,
 * ortam değişkeninde durur (Teknik tasarım §13). Geliştirmede anahtar verilmezse JWT_SECRET'ten türetilir;
 * canlıda STAFF_SECRET_KEY zorunludur (env.ts).
 */
export class SecretBox {
  private readonly key: Buffer;
  private readonly macKey: Buffer;

  constructor(secret: string) {
    this.key = createHash('sha256').update(`rengarenk:yonetim:sifre:${secret}`).digest();
    this.macKey = createHash('sha256').update(`rengarenk:yonetim:ozet:${secret}`).digest();
  }

  static fromEnv(env: Env) {
    return new SecretBox(env.STAFF_SECRET_KEY ?? `gelistirme:${env.JWT_SECRET}`);
  }

  seal(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key, iv);
    const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return ['v1', iv, c.getAuthTag(), body]
      .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
      .join('.');
  }

  open(sealed: string): string {
    const [v, iv, tag, body] = sealed.split('.');
    if (v !== 'v1' || !iv || !tag || !body) throw new Error('şifreli değer biçimi tanınmadı');
    const d = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
  }

  /** Kurtarma kodu gibi tek kullanımlık değerlerin anahtarlı özeti. */
  digest(value: string): string {
    return createHmac('sha256', this.macKey).update(value).digest('hex');
  }
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** Karıştırılması kolay harfler (0/o, 1/l/i) çıkarılmış alfabeyle 8 karakterlik kurtarma kodu. */
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const RECOVERY_CODE_COUNT = 10;

export function newRecoveryCode(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
  return s;
}

/** Ekranda gösterim biçimi: abcd-efgh */
export const formatRecoveryCode = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`;
