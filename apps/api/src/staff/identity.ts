import type { Env } from '../config/env.js';

/** Google'dan dönen, doğrulanmış kimlik bilgileri. */
export interface StaffIdentity {
  /** Google hesabının değişmez kimliği */
  sub: string;
  email: string;
  emailVerified: boolean;
  /** Google Workspace alanı; kişisel Gmail hesaplarında yoktur */
  hd?: string;
  name?: string;
  /** Ad ve soyad (üye girişinde üyelik formunu doldurmak için; Karar 18) */
  givenName?: string;
  familyName?: string;
}

export interface IdentityProvider {
  readonly name: 'google' | 'fake';
  authorizationUrl(p: { state: string; nonce: string; codeChallenge: string; redirectUri: string }): string;
  /** Yetki kodunu kimlikle değiştirir; nonce ve imza denetimleri burada yapılır. */
  exchange(p: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    nonce: string;
  }): Promise<StaffIdentity>;
}

export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');

export class IdentityError extends Error {}

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/**
 * Google Workspace tek oturum (OpenID Connect, yetki kodu + PKCE). Kimlik jetonu doğrudan Google'ın
 * jeton uç noktasından TLS ile alındığı için imzası ayrıca denetlenmez (OpenID Connect Core 3.1.3.7/6);
 * yayıncı, hedef kitle, süre ve nonce denetlenir.
 */
export class GoogleIdentityProvider implements IdentityProvider {
  readonly name = 'google' as const;
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly domains: string[],
    private readonly requireWorkspace = true,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  authorizationUrl(p: { state: string; nonce: string; codeChallenge: string; redirectUri: string }) {
    const q = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: p.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: p.state,
      nonce: p.nonce,
      code_challenge: p.codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    // Tek alan varsa Google hesap seçicisini o alana daraltır; asıl denetim sunucuda yapılır.
    if (this.requireWorkspace) q.set('hd', this.domains.length === 1 ? (this.domains[0] as string) : '*');
    return `${GOOGLE_AUTH}?${q}`;
  }

  async exchange(p: { code: string; codeVerifier: string; redirectUri: string; nonce: string }) {
    const res = await this.fetchFn(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: p.code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: p.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: p.codeVerifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new IdentityError(`Google jeton isteği reddedildi (${res.status})`);
    const body = (await res.json()) as { id_token?: string };
    if (!body.id_token) throw new IdentityError('Google yanıtında kimlik jetonu yok');
    const claims = decodeJwtPayload(body.id_token);
    if (!GOOGLE_ISSUERS.includes(String(claims.iss)))
      throw new IdentityError('kimlik jetonu yayıncısı tanınmadı');
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(this.clientId)) throw new IdentityError('kimlik jetonu bu uygulama için değil');
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now() - 60_000)
      throw new IdentityError('kimlik jetonunun süresi dolmuş');
    if (claims.nonce !== p.nonce) throw new IdentityError('nonce eşleşmedi');
    return identityFromClaims(claims);
  }
}

/**
 * Geliştirme ve test için Google taklidi. Yönlendirme yönetim konsolundaki
 * `/gelistirme/google` sayfasına gider; orada seçilen e-posta, yetki kodunun içine yazılır.
 * Canlıda kullanılamaz (env.ts).
 */
export class FakeIdentityProvider implements IdentityProvider {
  readonly name = 'fake' as const;
  constructor(private readonly adminOrigin: string) {}

  authorizationUrl(p: { state: string; redirectUri: string }) {
    const q = new URLSearchParams({ state: p.state, redirect_uri: p.redirectUri });
    return `${this.adminOrigin}/gelistirme/google?${q}`;
  }

  async exchange(p: { code: string }) {
    if (!p.code.startsWith('fake.')) throw new IdentityError('sahte yetki kodu tanınmadı');
    let claims: Record<string, unknown>;
    try {
      claims = JSON.parse(Buffer.from(p.code.slice(5), 'base64url').toString('utf8'));
    } catch {
      throw new IdentityError('sahte yetki kodu okunamadı');
    }
    const email = String(claims.email ?? '').toLowerCase();
    return identityFromClaims({
      sub: claims.sub ?? `fake-${email}`,
      email,
      email_verified: claims.email_verified ?? true,
      hd: 'hd' in claims ? claims.hd : email.split('@')[1],
      name: claims.name,
      given_name: claims.given_name,
      family_name: claims.family_name,
    });
  }

  /** Testlerde ve sahte giriş sayfasında kullanılan yetki kodu. */
  static code(claims: {
    email: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    sub?: string;
    hd?: string | null;
    email_verified?: boolean;
  }) {
    return `fake.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`;
  }
}

export function createIdentityProvider(env: Env): IdentityProvider {
  if (env.STAFF_AUTH_PROVIDER === 'google') {
    return new GoogleIdentityProvider(
      env.GOOGLE_CLIENT_ID ?? '',
      env.GOOGLE_CLIENT_SECRET ?? '',
      env.STAFF_EMAIL_DOMAINS,
      env.STAFF_REQUIRE_WORKSPACE,
    );
  }
  return new FakeIdentityProvider(env.ADMIN_ORIGIN);
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const part = jwt.split('.')[1];
  if (!part) throw new IdentityError('kimlik jetonu biçimi geçersiz');
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    throw new IdentityError('kimlik jetonu okunamadı');
  }
}

function identityFromClaims(c: Record<string, unknown>): StaffIdentity {
  if (typeof c.sub !== 'string' || typeof c.email !== 'string') throw new IdentityError('kimlik eksik');
  return {
    sub: c.sub,
    email: c.email.toLowerCase(),
    emailVerified: c.email_verified === true || c.email_verified === 'true',
    hd: typeof c.hd === 'string' ? c.hd.toLowerCase() : undefined,
    name: typeof c.name === 'string' ? c.name : undefined,
    givenName: typeof c.given_name === 'string' ? c.given_name : undefined,
    familyName: typeof c.family_name === 'string' ? c.family_name : undefined,
  };
}
