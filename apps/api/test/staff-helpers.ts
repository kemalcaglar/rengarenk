import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { type StaffRole, uuidv7 } from '@rengarenk/db';
import type { Db } from '../src/database/prisma.js';
import { FakeIdentityProvider } from '../src/staff/identity.js';
import { currentStep, totpAt } from '../src/staff/totp.js';

let ipSeq = 0;
/** Her girişe ayrı bir IP: hız sınırları testleri birbirine bağlamasın. */
export const nextIp = () => `10.0.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;

export async function staffCall(
  app: NestFastifyApplication,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  body?: object,
  token?: string,
  ip = '127.0.0.1',
) {
  const res = await app.inject({
    method,
    url,
    payload: body,
    remoteAddress: ip,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
}

export async function createStaff(
  db: Db,
  role: StaffRole,
  extra: { status?: 'ACTIVE' | 'INVITED' | 'DISABLED'; customRoleId?: string; email?: string } = {},
) {
  return db.staffMember.create({
    data: {
      id: uuidv7(),
      email: extra.email ?? `${role.toLowerCase()}.${uuidv7().slice(-8)}@rengarenk.com.tr`,
      name: `${role} Test`,
      role,
      status: extra.status ?? 'ACTIVE',
      customRoleId: extra.customRoleId ?? null,
      inviteExpiresAt: extra.status === 'INVITED' ? new Date(Date.now() + 3600_000) : null,
    },
  });
}

/** Google adımına kadar: başlat ve sahte Google dönüşü. */
export async function googleStep(
  app: NestFastifyApplication,
  claims: Parameters<typeof FakeIdentityProvider.code>[0],
  ip = nextIp(),
) {
  const start = await staffCall(app, 'POST', '/staff/auth/google/start', undefined, undefined, ip);
  const cb = await staffCall(
    app,
    'POST',
    '/staff/auth/google/callback',
    { state: start.body.state, code: FakeIdentityProvider.code(claims) },
    undefined,
    ip,
  );
  return { start, cb, ip };
}

/** Tam giriş: Google, doğrulama uygulaması kurulumu (gerekirse) ve kod. */
export async function loginAs(
  app: NestFastifyApplication,
  staff: { email: string },
  opts: { secret?: string; stepOffset?: number; deviceId?: string } = {},
) {
  const { cb, ip } = await googleStep(app, { email: staff.email });
  if (cb.status !== 200) throw new Error(`google adımı: ${cb.status} ${JSON.stringify(cb.body)}`);
  let secret = opts.secret;
  if (cb.body.needsSetup) {
    const s = await staffCall(
      app,
      'POST',
      '/staff/auth/2fa/setup',
      { ticket: cb.body.ticket },
      undefined,
      ip,
    );
    secret = s.body.secret;
  }
  if (!secret) throw new Error('doğrulama sırrı yok');
  const v = await staffCall(
    app,
    'POST',
    '/staff/auth/2fa/verify',
    {
      ticket: cb.body.ticket,
      code: totpAt(secret, currentStep() + (opts.stepOffset ?? 0)),
      deviceId: opts.deviceId ?? `cihaz-${uuidv7()}`,
    },
    undefined,
    ip,
  );
  if (v.status !== 200) throw new Error(`kod adımı: ${v.status} ${JSON.stringify(v.body)}`);
  return { token: v.body.sessionToken as string, secret, recoveryCodes: v.body.recoveryCodes as string[] };
}
