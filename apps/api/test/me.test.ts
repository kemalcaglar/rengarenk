import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;

beforeAll(async () => {
  ({ app, sms } = await createTestApp());
});
afterAll(() => app.close());

async function login(phone: string) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  return v.body as { accessToken: string; refreshToken: string };
}

describe('profil ve oturumlar', () => {
  it('profil güncellenir; geçersiz e-posta ve bilinmeyen alan reddedilir', async () => {
    const { accessToken } = await login('+905327770001');
    const ok = await call(
      app,
      'PATCH',
      '/me',
      { displayName: 'Ayşe Y.', email: 'ayse@ornek.com' },
      accessToken,
    );
    expect(ok.status).toBe(200);
    expect(ok.body.displayName).toBe('Ayşe Y.');
    // Üyeliğin son adımı: ad ve soyad ayrı; görünen ad ikisinden oluşur (Karar 29)
    const ad = await call(app, 'PATCH', '/me', { firstName: 'Ayşe', lastName: 'Yılmaz' }, accessToken);
    expect(ad.body).toMatchObject({ firstName: 'Ayşe', lastName: 'Yılmaz', displayName: 'Ayşe Yılmaz' });
    expect((await call(app, 'PATCH', '/me', { firstName: 'A' }, accessToken)).status).toBe(400);
    expect((await call(app, 'PATCH', '/me', { email: 'yok' }, accessToken)).status).toBe(400);
    expect((await call(app, 'PATCH', '/me', { phone: '+905320000000' }, accessToken)).status).toBe(400);
  });

  it('başka cihazdaki oturum kapatılınca o cihaz jeton yenileyemez', async () => {
    const phone = '+905327770002';
    const a = await login(phone);
    const list = await call(app, 'GET', '/me/sessions', undefined, a.accessToken);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].current).toBe(true);

    expect(
      (await call(app, 'DELETE', `/me/sessions/${list.body[0].id}`, undefined, a.accessToken)).status,
    ).toBe(204);
    expect((await call(app, 'POST', '/auth/refresh', { refreshToken: a.refreshToken })).status).toBe(401);
  });

  it('başkasının oturumunu kapatamaz', async () => {
    const a = await login('+905327770003');
    const b = await login('+905327770004');
    const bs = await call(app, 'GET', '/me/sessions', undefined, b.accessToken);
    expect(
      (await call(app, 'DELETE', `/me/sessions/${bs.body[0].id}`, undefined, a.accessToken)).status,
    ).toBe(404);
  });
});

describe('hız sınırı', () => {
  it('aynı IP saatte 20 koddan fazlasını isteyemez', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 22; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/auth/otp/request',
        payload: { phone: `+90532800${String(i).padStart(4, '0')}` },
        remoteAddress: '10.9.9.9',
      });
      codes.push(r.statusCode);
    }
    expect(codes.slice(0, 20).every((c) => c === 200)).toBe(true);
    expect(codes.at(-1)).toBe(429);
  });
});

describe('ölçümler', () => {
  it('/metrics SMS ve istek ölçümlerini verir', async () => {
    const r = await app.inject({ method: 'GET', url: '/metrics' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('sms_sent_total');
    expect(r.body).toContain('http_request_duration_seconds');
  });
});
