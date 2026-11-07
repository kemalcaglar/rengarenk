import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp } from './helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
});
afterAll(() => app.close());

describe('telefon ve SMS koduyla giriş', () => {
  it('geçersiz numarayı reddeder', async () => {
    const r = await call(app, 'POST', '/auth/otp/request', { phone: '0212 123 45 67' });
    expect(r.status).toBe(400);
  });

  it('kod ister, doğrular, kullanıcı ve bireysel hesap oluşturur', async () => {
    const req = await call(app, 'POST', '/auth/otp/request', { phone: '0532 111 22 33' });
    expect(req.status).toBe(200);
    // Kod yalnızca yerel geliştirmede (console sağlayıcı) yanıtta döner; testte ve canlıda asla.
    expect(req.body.devCode).toBeUndefined();
    const code = sms.lastCode('+905321112233');
    expect(code).toMatch(/^\d{6}$/);

    const wrong = await call(app, 'POST', '/auth/otp/verify', {
      challengeId: req.body.challengeId,
      code: code === '000000' ? '111111' : '000000',
    });
    expect(wrong.status).toBe(401);

    const ok = await call(app, 'POST', '/auth/otp/verify', {
      challengeId: req.body.challengeId,
      code,
      platform: 'IOS',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.isNewUser).toBe(true);

    const again = await call(app, 'POST', '/auth/otp/verify', { challengeId: req.body.challengeId, code });
    expect(again.status).toBe(401);

    const me = await call(app, 'GET', '/auth/me', undefined, ok.body.accessToken);
    expect(me.status).toBe(200);
    expect(me.body.memberships).toHaveLength(1);
    expect(me.body.memberships[0].role).toBe('OWNER');

    expect(await db.auditLog.count({ where: { action: 'giris' } })).toBe(1);
    expect(
      await db.outboxEvent.count({ where: { type: { in: ['kullanici.kaydoldu', 'kullanici.giris'] } } }),
    ).toBe(2);
  });

  it('60 saniye dolmadan ikinci kodu vermez', async () => {
    await call(app, 'POST', '/auth/otp/request', { phone: '0532 999 88 77' });
    const r = await call(app, 'POST', '/auth/otp/request', { phone: '0532 999 88 77' });
    expect(r.status).toBe(429);
  });

  it('yenileme jetonunu döndürür; eski jeton tekrar kullanılırsa tüm oturumlar kapanır', async () => {
    const phone = '+905324445566';
    const req = await call(app, 'POST', '/auth/otp/request', { phone });
    const login = await call(app, 'POST', '/auth/otp/verify', {
      challengeId: req.body.challengeId,
      code: sms.lastCode(phone),
    });
    const first = login.body.refreshToken as string;

    const r1 = await call(app, 'POST', '/auth/refresh', { refreshToken: first });
    expect(r1.status).toBe(200);
    expect(r1.body.refreshToken).not.toBe(first);

    const reuse = await call(app, 'POST', '/auth/refresh', { refreshToken: first });
    expect(reuse.status).toBe(401);
    const afterTheft = await call(app, 'POST', '/auth/refresh', { refreshToken: r1.body.refreshToken });
    expect(afterTheft.status).toBe(401);
  });

  it('jetonsuz istekleri reddeder', async () => {
    expect((await call(app, 'GET', '/auth/me')).status).toBe(401);
  });

  it('sağlık kontrolü veritabanına ulaşır', async () => {
    const r = await call(app, 'GET', '/health');
    expect(r.body.status).toBe('ok');
  });
});
