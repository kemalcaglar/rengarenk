import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Db, PRISMA } from '../src/database/prisma.js';
import { call, createTestApp, uyeOl } from './helpers.js';

let app: NestFastifyApplication;

beforeAll(async () => {
  ({ app } = await createTestApp());
});
afterAll(() => app.close());

async function login(phone: string) {
  const v = { body: await uyeOl(app, phone) };
  return v.body as { accessToken: string; refreshToken: string };
}

describe('profil ve oturumlar', () => {
  it('profil güncellenir; e-posta profil güncellemesiyle değişmez, bilinmeyen alan reddedilir', async () => {
    const { accessToken } = await login('+905327770001');
    const ok = await call(app, 'PATCH', '/me', { displayName: 'Ayşe Y.' }, accessToken);
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

  it('diğer cihaz kapatılınca o cihazın jetonu reddedilir, bu cihaz açık kalır; yenilenmiş jeton çalınma sayılır', async () => {
    const phone = '+905327770005';
    const a = await login(phone);
    const db = app.get<Db>(PRISMA);
    await db.otpChallenge.updateMany({
      where: { phone },
      data: { createdAt: new Date(Date.now() - 120_000) },
    });
    const b = await login(phone);
    const list = await call(app, 'GET', '/me/sessions', undefined, a.accessToken);
    const diger = list.body.find((s: { current: boolean }) => !s.current);
    expect((await call(app, 'DELETE', `/me/sessions/${diger.id}`, undefined, a.accessToken)).status).toBe(
      204,
    );
    expect((await call(app, 'POST', '/auth/refresh', { refreshToken: b.refreshToken })).status).toBe(401);
    // Elle kapatılan oturumun jetonu yalnızca reddedilir
    const yeni = await call(app, 'POST', '/auth/refresh', { refreshToken: a.refreshToken });
    expect(yeni.status).toBe(200);
    // Yeni jeton kullanıldıktan sonra eski jeton tekrar gelirse çalınma sayılır, bütün oturumlar kapanır
    const sonraki = await call(app, 'POST', '/auth/refresh', { refreshToken: yeni.body.refreshToken });
    expect(sonraki.status).toBe(200);
    expect((await call(app, 'POST', '/auth/refresh', { refreshToken: a.refreshToken })).status).toBe(401);
    expect(
      (await call(app, 'POST', '/auth/refresh', { refreshToken: sonraki.body.refreshToken })).status,
    ).toBe(401);
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
  it('aynı IP saatte 10 şifre sıfırlama isteğinden fazlasını yapamaz', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/auth/password/forgot',
        payload: { eposta: `hiz${i}@ornek.com` },
        remoteAddress: '10.9.9.9',
      });
      codes.push(r.statusCode);
    }
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
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
