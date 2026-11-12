import { createPublicKey, type JsonWebKey, verify } from 'node:crypto';
import type { Env } from '../config/env.js';
import {
  FakeIdentityProvider,
  GoogleIdentityProvider,
  IdentityError,
  type IdentityProvider,
} from '../staff/identity.js';

/**
 * Üye girişi için Google (Karar 18): yönetim girişiyle aynı bağdaştırıcı (yetki kodu + PKCE), ama ayrı istemci ve
 * Workspace şartı olmadan. Sahte sağlayıcı sitedeki `/gelistirme/google` sayfasına yönlendirir. Kapalıysa `null`.
 */
export const USER_IDP = Symbol('USER_IDP');

export function createUserIdentityProvider(env: Env): IdentityProvider | null {
  if (env.USER_AUTH_PROVIDER === 'google') {
    return new GoogleIdentityProvider(
      env.USER_GOOGLE_CLIENT_ID ?? '',
      env.USER_GOOGLE_CLIENT_SECRET ?? '',
      [],
      false,
    );
  }
  if (env.USER_AUTH_PROVIDER === 'fake') return new FakeIdentityProvider(env.WEB_ORIGIN);
  return null;
}

export interface AppleIdentity {
  sub: string;
  email: string | null;
  emailVerified: boolean;
}

export interface AppleVerifier {
  verify(identityToken: string): Promise<AppleIdentity>;
}

export const APPLE_VERIFIER = Symbol('APPLE_VERIFIER');

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_KEYS = 'https://appleid.apple.com/auth/keys';

function parcala(jwt: string) {
  const [h, p, s] = jwt.split('.');
  if (!h || !p || !s) throw new IdentityError('kimlik jetonu biçimi geçersiz');
  try {
    return {
      header: JSON.parse(Buffer.from(h, 'base64url').toString('utf8')) as { kid?: string; alg?: string },
      claims: JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as Record<string, unknown>,
      imzali: Buffer.from(`${h}.${p}`),
      imza: Buffer.from(s, 'base64url'),
    };
  } catch {
    throw new IdentityError('kimlik jetonu okunamadı');
  }
}

function kimlik(c: Record<string, unknown>): AppleIdentity {
  if (typeof c.sub !== 'string' || !c.sub) throw new IdentityError('Apple kimliği eksik');
  return {
    sub: c.sub,
    email: typeof c.email === 'string' ? c.email.toLowerCase() : null,
    emailVerified: c.email_verified === true || c.email_verified === 'true',
  };
}

/**
 * Apple ile giriş: uygulamanın aldığı kimlik jetonu Apple'ın açık anahtarlarıyla (RS256) doğrulanır; yayıncı,
 * hedef kitle (paket kimliği) ve süre denetlenir. Anahtarlar bir saat önbellekte tutulur.
 */
export class AppleJwksVerifier implements AppleVerifier {
  private keys: { at: number; list: (JsonWebKey & { kid?: string })[] } | null = null;
  constructor(
    private readonly clientIds: string[],
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private async anahtar(kid: string) {
    const bul = () => this.keys?.list.find((k) => k.kid === kid);
    if (!this.keys || Date.now() - this.keys.at > 3600_000 || !bul()) {
      const r = await this.fetchFn(APPLE_KEYS, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new IdentityError(`Apple anahtarları alınamadı (${r.status})`);
      const body = (await r.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
      this.keys = { at: Date.now(), list: body.keys ?? [] };
    }
    const k = bul();
    if (!k) throw new IdentityError('Apple anahtarı bulunamadı');
    return createPublicKey({ key: k, format: 'jwk' });
  }

  async verify(identityToken: string): Promise<AppleIdentity> {
    const { header, claims, imzali, imza } = parcala(identityToken);
    if (header.alg !== 'RS256' || !header.kid) throw new IdentityError('Apple jetonu algoritması tanınmadı');
    if (!verify('RSA-SHA256', imzali, await this.anahtar(header.kid), imza)) {
      throw new IdentityError('Apple jetonunun imzası geçersiz');
    }
    if (claims.iss !== APPLE_ISSUER) throw new IdentityError('Apple jetonunun yayıncısı tanınmadı');
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.some((a) => this.clientIds.includes(String(a)))) {
      throw new IdentityError('Apple jetonu bu uygulama için değil');
    }
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now() - 60_000) {
      throw new IdentityError('Apple jetonunun süresi dolmuş');
    }
    return kimlik(claims);
  }
}

/** Geliştirme ve test: `fake.<base64url JSON>` biçiminde jeton ({ sub, email }). Canlıda kullanılamaz (env.ts). */
export class FakeAppleVerifier implements AppleVerifier {
  async verify(identityToken: string): Promise<AppleIdentity> {
    if (!identityToken.startsWith('fake.')) throw new IdentityError('sahte Apple jetonu tanınmadı');
    try {
      return kimlik({
        email_verified: true,
        ...JSON.parse(Buffer.from(identityToken.slice(5), 'base64url').toString('utf8')),
      });
    } catch (e) {
      if (e instanceof IdentityError) throw e;
      throw new IdentityError('sahte Apple jetonu okunamadı');
    }
  }

  static token(c: { sub: string; email?: string }) {
    return `fake.${Buffer.from(JSON.stringify(c)).toString('base64url')}`;
  }
}

export function createAppleVerifier(env: Env): AppleVerifier | null {
  if (env.APPLE_AUTH_PROVIDER === 'apple') return new AppleJwksVerifier(env.APPLE_CLIENT_IDS);
  if (env.APPLE_AUTH_PROVIDER === 'fake') return new FakeAppleVerifier();
  return null;
}
