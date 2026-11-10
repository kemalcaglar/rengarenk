import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';

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

    // Yeni üyelik onaysız açılmaz; kod harcanmaz
    const noConsent = await call(app, 'POST', '/auth/otp/verify', {
      challengeId: req.body.challengeId,
      code,
    });
    expect(noConsent.status).toBe(400);

    const ok = await call(app, 'POST', '/auth/otp/verify', {
      challengeId: req.body.challengeId,
      code,
      platform: 'IOS',
      consents: { ...SIGNUP_CONSENTS, ticariIleti: true },
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
      consents: SIGNUP_CONSENTS,
    });
    const first = login.body.refreshToken as string;

    const r1 = await call(app, 'POST', '/auth/refresh', { refreshToken: first });
    expect(r1.status).toBe(200);
    expect(r1.body.refreshToken).not.toBe(first);
    // Yeni jeton kullanıldı; eski jeton artık yalnızca çalınmış olabilir
    const r2 = await call(app, 'POST', '/auth/refresh', { refreshToken: r1.body.refreshToken });
    expect(r2.status).toBe(200);

    const reuse = await call(app, 'POST', '/auth/refresh', { refreshToken: first });
    expect(reuse.status).toBe(401);
    const afterTheft = await call(app, 'POST', '/auth/refresh', { refreshToken: r2.body.refreshToken });
    expect(afterTheft.status).toBe(401);
  });

  it('kaybolan yanıt: yeni jeton hiç kullanılmadan eski jeton kısa sürede tekrar gelirse oturum sürer; süre geçince çalınma sayılır', async () => {
    const phone = '+905324445567';
    const req = await call(app, 'POST', '/auth/otp/request', { phone });
    const login = await call(app, 'POST', '/auth/otp/verify', {
      challengeId: req.body.challengeId,
      code: sms.lastCode(phone),
      consents: SIGNUP_CONSENTS,
    });
    const first = login.body.refreshToken as string;
    // Yenileme yapıldı ama yanıt tarayıcıya ulaşmadı (sayfa değişti)
    const kayip = await call(app, 'POST', '/auth/refresh', { refreshToken: first });
    expect(kayip.status).toBe(200);
    // Tarayıcı eski çerezle yeniden dener: yeni oturum verilir, ulaşmayan jeton kapanır
    const tekrar = await call(app, 'POST', '/auth/refresh', { refreshToken: first });
    expect(tekrar.status).toBe(200);
    expect((await call(app, 'POST', '/auth/refresh', { refreshToken: kayip.body.refreshToken })).status).toBe(
      401,
    );
    // Hoşgörü ilk döndürmeden sayılır: süre geçince eski jeton çalınma sayılır, bütün oturumlar kapanır
    const user = await db.user.findUniqueOrThrow({ where: { phone } });
    await db.session.updateMany({
      where: { userId: user.id, rotated: true },
      data: { revokedAt: new Date(Date.now() - 3 * 60_000) },
    });
    expect((await call(app, 'POST', '/auth/refresh', { refreshToken: first })).status).toBe(401);
    expect(
      (await call(app, 'POST', '/auth/refresh', { refreshToken: tekrar.body.refreshToken })).status,
    ).toBe(401);
  });

  it('jetonsuz istekleri reddeder', async () => {
    expect((await call(app, 'GET', '/auth/me')).status).toBe(401);
  });

  it('sağlık kontrolü veritabanına ulaşır', async () => {
    const r = await call(app, 'GET', '/health');
    expect(r.body.status).toBe('ok');
  });
});

describe('rıza kayıtları ve yasal metinler (Karar 46, 59)', () => {
  it('üyelik onayları metin sürümü ve kanalıyla saklanır; kayıt değiştirilemez', async () => {
    await db.consentText.create({
      data: {
        id: uuidv7(),
        key: 'kullanim_kosullari',
        version: 3,
        title: 'Kullanım koşulları',
        body: 'Metin',
      },
    });
    const phone = '+905327770011';
    const req = await call(app, 'POST', '/auth/otp/request', { phone });
    const zorunluEksik = await call(app, 'POST', '/auth/otp/verify', {
      challengeId: req.body.challengeId,
      code: sms.lastCode(phone),
      consents: { ...SIGNUP_CONSENTS, kvkkAydinlatma: false },
    });
    expect(zorunluEksik.status).toBe(400);
    const ok = await call(app, 'POST', '/auth/otp/verify', {
      challengeId: req.body.challengeId,
      code: sms.lastCode(phone),
      platform: 'ANDROID',
      consents: { ...SIGNUP_CONSENTS, reklamOlcum: true },
    });
    expect(ok.status).toBe(200);
    const user = await db.user.findUniqueOrThrow({ where: { phone } });
    const rows = await db.consent.findMany({ where: { userId: user.id }, orderBy: { kind: 'asc' } });
    expect(rows.map((r) => [r.kind, r.granted, r.channel])).toEqual([
      ['kullanim_kosullari', true, 'android'],
      ['kvkk_aydinlatma', true, 'android'],
      ['reklam_olcum', true, 'android'],
      ['ticari_ileti', false, 'android'],
    ]);
    expect(rows.find((r) => r.kind === 'kullanim_kosullari')?.textVersion).toBe(3);
    await expect(
      db.consent.update({ where: { id: rows[0]?.id }, data: { granted: false } }),
    ).rejects.toThrow();
  });

  it('yasal metin herkese açık; yayınlanmış sürüm değiştirilemez', async () => {
    const r = await call(app, 'GET', '/legal/kullanim_kosullari');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ version: 3, status: 'taslak' });
    expect((await call(app, 'GET', '/legal/bilinmeyen')).status).toBe(400);
    const t = await db.consentText.findFirstOrThrow({ where: { key: 'kullanim_kosullari', version: 3 } });
    await db.consentText.update({
      where: { id: t.id },
      data: { status: 'yayinda', publishedAt: new Date() },
    });
    await expect(db.consentText.update({ where: { id: t.id }, data: { body: 'Değişti' } })).rejects.toThrow();
  });

  it('çerez tercihi ziyaretçi kimliğiyle kaydedilir; kimliksiz istek reddedilir', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/consents/cookie',
      payload: { analiz: true, reklam: false },
      headers: { 'x-rr-ziyaretci': 'ziyaretci-kimligi-1234567', 'x-rr-platform': 'WEB' },
    });
    expect(res.statusCode).toBe(204);
    const rows = await db.consent.findMany({ where: { visitorId: 'ziyaretci-kimligi-1234567' } });
    expect(rows.map((r) => [r.kind, r.granted]).sort()).toEqual([
      ['cerez_analiz', true],
      ['cerez_reklam', false],
    ]);
    const bad = await app.inject({
      method: 'POST',
      url: '/consents/cookie',
      payload: { analiz: true, reklam: true },
    });
    expect(bad.statusCode).toBe(400);
  });
});
