import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeAppleVerifier } from '../src/auth/user-identity.js';
import { ENV, type Env } from '../src/config/env.js';
import type { Db } from '../src/database/prisma.js';
import { NotificationService } from '../src/notifications/notification.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { FakeIdentityProvider } from '../src/staff/identity.js';
import { SecretBox } from '../src/staff/secret-box.js';
import { call, createTestApp, SIGNUP_CONSENTS, TEST_SIFRE, testEposta, uyeOl } from './helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
});
afterAll(() => app.close());

const bilgi = (telefon: string, ek: Record<string, unknown> = {}) => ({
  ad: 'Ayşe',
  soyad: 'Yılmaz',
  eposta: testEposta(telefon),
  telefon,
  sifre: TEST_SIFRE,
  consents: SIGNUP_CONSENTS,
  ...ek,
});

/** Sahte Google: başlat → dönüş (yetki kodunun içinde kimlik) */
async function google(kimlik: { email: string; sub: string; given_name?: string; family_name?: string }) {
  const s = await call(app, 'POST', '/auth/google/start', { platform: 'WEB' });
  expect(s.status).toBe(200);
  return call(app, 'POST', '/auth/google/callback', {
    state: s.body.state,
    code: FakeIdentityProvider.code({ ...kimlik, hd: null }),
  });
}

describe('üyelik ve giriş (Karar 18)', () => {
  it('üye ol: bilgiler ve telefon; kod doğrulanınca hesap tek işlemde açılır', async () => {
    const tel = '+905321112233';
    expect((await call(app, 'POST', '/auth/register', bilgi('0212 123 45 67'))).status).toBe(400);
    // Şifre ya da Google/Apple jetonu gerekir; zayıf şifre reddedilir
    expect((await call(app, 'POST', '/auth/register', bilgi(tel, { sifre: undefined }))).status).toBe(400);
    expect((await call(app, 'POST', '/auth/register', bilgi(tel, { sifre: 'kisa1' }))).status).toBe(400);
    expect((await call(app, 'POST', '/auth/register', bilgi(tel, { sifre: 'sadeceharf' }))).status).toBe(400);
    expect(
      (
        await call(
          app,
          'POST',
          '/auth/register',
          bilgi(tel, { consents: { ...SIGNUP_CONSENTS, kvkkAydinlatma: false } }),
        )
      ).status,
    ).toBe(400);

    const req = await call(
      app,
      'POST',
      '/auth/register',
      bilgi('0532 111 22 33', { eposta: '  Ayse.Yilmaz@Ornek.com ', platform: 'IOS' }),
    );
    expect(req.status).toBe(200);
    expect(req.body.kanal).toBe('sms');
    // Kod yalnızca yerel geliştirmede (console sağlayıcı) yanıtta döner; testte ve canlıda asla.
    expect(req.body.devCode).toBeUndefined();
    // Hesap kod doğrulanmadan açılmaz; şifre yalnızca özetiyle durur
    expect(await db.user.count({ where: { phone: tel } })).toBe(0);
    const bekleyen = await db.pendingSignup.findUniqueOrThrow({ where: { id: req.body.challengeId } });
    expect(bekleyen.email).toBe('ayse.yilmaz@ornek.com');
    expect(bekleyen.passwordHash).toMatch(/^scrypt\$/);
    expect(JSON.stringify(bekleyen)).not.toContain(TEST_SIFRE);

    const code = sms.lastCode(tel) as string;
    const wrong = await call(app, 'POST', '/auth/register/verify', {
      challengeId: req.body.challengeId,
      code: code === '000000' ? '111111' : '000000',
    });
    expect(wrong.status).toBe(401);
    const ok = await call(app, 'POST', '/auth/register/verify', { challengeId: req.body.challengeId, code });
    expect(ok.status).toBe(200);
    expect(ok.body.isNewUser).toBe(true);
    expect(
      (await call(app, 'POST', '/auth/register/verify', { challengeId: req.body.challengeId, code })).status,
    ).toBe(401);

    const u = await db.user.findUniqueOrThrow({ where: { phone: tel } });
    expect(u).toMatchObject({
      email: 'ayse.yilmaz@ornek.com',
      firstName: 'Ayşe',
      lastName: 'Yılmaz',
      displayName: 'Ayşe Yılmaz',
      emailVerifiedAt: null,
      googleSub: null,
    });
    expect(u.phoneVerifiedAt).not.toBeNull();
    expect(await db.pendingSignup.count({ where: { email: 'ayse.yilmaz@ornek.com' } })).toBe(0);
    const me = await call(app, 'GET', '/auth/me', undefined, ok.body.accessToken);
    expect(me.body.memberships).toEqual([expect.objectContaining({ role: 'OWNER' })]);
    expect(await db.auditLog.count({ where: { action: { in: ['uye_oldu', 'giris'] }, actorId: u.id } })).toBe(
      2,
    );
    expect(
      await db.outboxEvent.count({ where: { type: { in: ['kullanici.kaydoldu', 'kullanici.giris'] } } }),
    ).toBe(2);
    // Rıza kanalı üyeliği başlatan platformdan
    expect(
      (await db.consent.findFirstOrThrow({ where: { userId: u.id, kind: 'kvkk_aydinlatma' } })).channel,
    ).toBe('ios');
  });

  it('e-posta, numara ya da Google hesabı başka bir üyelikteyse kod gönderilmez', async () => {
    await uyeOl(app, '+905321112240');
    const once = sms.sent.length;
    const ayniEposta = await call(
      app,
      'POST',
      '/auth/register',
      bilgi('+905321112241', { eposta: testEposta('+905321112240').toUpperCase() }),
    );
    expect(ayniEposta.status).toBe(409);
    expect(ayniEposta.body.message).toContain('Bu e-postayla bir hesap var');
    const ayniNumara = await call(
      app,
      'POST',
      '/auth/register',
      bilgi('+905321112240', { eposta: 'baska@ornek.com' }),
    );
    expect(ayniNumara.status).toBe(409);
    expect(ayniNumara.body.message).toContain('başka bir hesapta doğrulanmış');
    expect(sms.sent.length).toBe(once);
  });

  it('60 saniye dolmadan aynı numaraya ikinci kod gitmez; yeniden gönderince istek yeni koda taşınır', async () => {
    const tel = '+905329998877';
    const ilk = await call(app, 'POST', '/auth/register', bilgi(tel));
    expect(ilk.status).toBe(200);
    expect((await call(app, 'POST', '/auth/register', bilgi(tel))).status).toBe(429);
    await db.otpChallenge.updateMany({
      where: { phone: tel },
      data: { createdAt: new Date(Date.now() - 120_000) },
    });
    const yeni = await call(app, 'POST', '/auth/register/resend', { challengeId: ilk.body.challengeId });
    expect(yeni.status).toBe(200);
    expect(yeni.body.challengeId).not.toBe(ilk.body.challengeId);
    const v = await call(app, 'POST', '/auth/register/verify', {
      challengeId: yeni.body.challengeId,
      code: sms.lastCode(tel),
    });
    expect(v.status).toBe(200);
  });

  it('e-posta ve şifreyle giriş; hatalı şifre ve bilinmeyen e-posta aynı yanıtı alır', async () => {
    const tel = '+905321112250';
    await uyeOl(app, tel);
    const ok = await call(app, 'POST', '/auth/login', {
      eposta: testEposta(tel).toUpperCase(),
      sifre: TEST_SIFRE,
      platform: 'ANDROID',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();
    const yanlis = await call(app, 'POST', '/auth/login', { eposta: testEposta(tel), sifre: 'Yanlis1234' });
    const yok = await call(app, 'POST', '/auth/login', { eposta: 'kimse@ornek.com', sifre: TEST_SIFRE });
    expect([yanlis.status, yok.status]).toEqual([401, 401]);
    expect(yanlis.body.message).toBe(yok.body.message);
    // Girişte telefon kodu gitmez
    const u = await db.user.findUniqueOrThrow({ where: { phone: tel } });
    expect(await db.otpChallenge.count({ where: { phone: tel } })).toBe(1);
    expect(
      await db.auditLog.count({
        where: { action: 'giris', actorId: u.id, after: { path: ['yol'], equals: 'eposta' } },
      }),
    ).toBe(1);
  });

  it('Google ile: hesap yoksa üyelik formu dolar, telefon doğrulanınca hesap açılır; sonra doğrudan giriş', async () => {
    const kimlik = { email: 'Can.Demir@gmail.com', sub: 'g-1001', given_name: 'Can', family_name: 'Demir' };
    const ilk = await google(kimlik);
    expect(ilk.status).toBe(200);
    expect(ilk.body).toMatchObject({
      tip: 'kayit',
      saglayici: 'google',
      ad: 'Can',
      soyad: 'Demir',
      eposta: 'can.demir@gmail.com',
    });
    // Üyelik jetonu oturum yerine kullanılamaz
    expect((await call(app, 'GET', '/auth/me', undefined, ilk.body.kayitJetonu)).status).toBe(401);

    const tel = '+905321112260';
    const r = await call(app, 'POST', '/auth/register', {
      ad: 'Can',
      soyad: 'Demir',
      eposta: 'can.demir@gmail.com',
      telefon: tel,
      kayitJetonu: ilk.body.kayitJetonu,
      consents: SIGNUP_CONSENTS,
    });
    expect(r.status).toBe(200);
    expect(
      (
        await call(app, 'POST', '/auth/register/verify', {
          challengeId: r.body.challengeId,
          code: sms.lastCode(tel),
        })
      ).status,
    ).toBe(200);
    const u = await db.user.findUniqueOrThrow({ where: { phone: tel } });
    expect(u.googleSub).toBe('g-1001');
    expect(u.passwordHash).toBeNull();
    // Google'ın doğruladığı adres doğrulanmış sayılır
    expect(u.emailVerifiedAt).not.toBeNull();

    const ikinci = await google(kimlik);
    expect(ikinci.body.tip).toBe('giris');
    expect((await call(app, 'GET', '/auth/me', undefined, ikinci.body.accessToken)).body.id).toBe(u.id);

    // Aynı Google hesabıyla ikinci üyelik açılamaz; dönüş bir kez kullanılır
    expect(
      (
        await call(app, 'POST', '/auth/register', {
          ...bilgi('+905321112261', { eposta: 'yeni@ornek.com', sifre: undefined }),
          kayitJetonu: ilk.body.kayitJetonu,
        })
      ).status,
    ).toBe(409);
    const s = await call(app, 'POST', '/auth/google/start', { platform: 'IOS' });
    expect(s.body.state).toMatch(/^m\./);
    const d1 = await call(app, 'POST', '/auth/google/callback', {
      state: s.body.state,
      code: FakeIdentityProvider.code({ ...kimlik, hd: null }),
    });
    expect(d1.status).toBe(200);
    const d2 = await call(app, 'POST', '/auth/google/callback', {
      state: s.body.state,
      code: FakeIdentityProvider.code({ ...kimlik, hd: null }),
    });
    expect(d2.status).toBe(401);
  });

  it('Google adresi doğrulanmış bir hesapla aynıysa hesaba bağlanır; doğrulanmamışsa bağlanmaz', async () => {
    const tel = '+905321112270';
    const { userId } = await uyeOl(app, tel);
    const kimlik = { email: testEposta(tel), sub: 'g-2002' };
    const red = await google(kimlik);
    expect(red.status).toBe(409);
    await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    const ok = await google(kimlik);
    expect(ok.body.tip).toBe('giris');
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).googleSub).toBe('g-2002');
    expect(await db.auditLog.count({ where: { action: 'google_baglandi', actorId: userId } })).toBe(1);
  });

  it('Apple ile (iPhone): ilk seferde üyelik, sonra doğrudan giriş', async () => {
    const jeton = FakeAppleVerifier.token({ sub: 'a-3003', email: 'gizli@privaterelay.appleid.com' });
    const ilk = await call(app, 'POST', '/auth/apple', {
      kimlikJetonu: jeton,
      ad: 'Ece',
      soyad: 'Kara',
      platform: 'IOS',
    });
    expect(ilk.body).toMatchObject({
      tip: 'kayit',
      saglayici: 'apple',
      ad: 'Ece',
      eposta: 'gizli@privaterelay.appleid.com',
    });
    const tel = '+905321112280';
    const r = await call(app, 'POST', '/auth/register', {
      ad: 'Ece',
      soyad: 'Kara',
      eposta: 'gizli@privaterelay.appleid.com',
      telefon: tel,
      kayitJetonu: ilk.body.kayitJetonu,
      consents: SIGNUP_CONSENTS,
      platform: 'IOS',
    });
    await call(app, 'POST', '/auth/register/verify', {
      challengeId: r.body.challengeId,
      code: sms.lastCode(tel),
    });
    expect((await db.user.findUniqueOrThrow({ where: { phone: tel } })).appleSub).toBe('a-3003');
    const ikinci = await call(app, 'POST', '/auth/apple', { kimlikJetonu: jeton, platform: 'IOS' });
    expect(ikinci.body.tip).toBe('giris');
    expect(
      (
        await call(app, 'POST', '/auth/apple', {
          kimlikJetonu: 'gecersiz-jeton-12345678901',
          platform: 'IOS',
        })
      ).status,
    ).toBe(401);
  });

  it('şifremi unuttum: e-postaya tek kullanımlık bağlantı; yeni şifreyle bütün oturumlar kapanır', async () => {
    const tel = '+905321112290';
    const ilk = await uyeOl(app, tel);
    // Kayıtlı olmayan adres de aynı yanıtı alır; olay yazılmaz
    const yok = await call(app, 'POST', '/auth/password/forgot', { eposta: 'kimse@ornek.com' });
    expect(yok.body).toEqual({ gonderildi: true });
    const var_ = await call(app, 'POST', '/auth/password/forgot', { eposta: testEposta(tel) });
    expect(var_.body).toEqual({ gonderildi: true });
    expect(await db.outboxEvent.count({ where: { type: 'hesap.sifre_istendi' } })).toBe(1);

    // İşçinin yaptığı: bağlantı kodu teslim kaydında şifreli
    await app.get(NotificationService).sifreBaglantisi(ilk.userId);
    const t = await db.delivery.findFirstOrThrow({
      where: { userId: ilk.userId, sablon: 'hesap.sifre_sifirlama' },
    });
    const veri = t.veri as { kodKutu: string };
    expect(JSON.stringify(veri)).not.toMatch(/"kod"/);
    const kod = SecretBox.forDeliveries(app.get<Env>(ENV)).open(veri.kodKutu);

    expect((await call(app, 'POST', '/auth/password/reset', { kod, sifre: 'kisa' })).status).toBe(400);
    const ok = await call(app, 'POST', '/auth/password/reset', { kod, sifre: 'YeniSifre99' });
    expect(ok.status).toBe(200);
    expect((await call(app, 'POST', '/auth/password/reset', { kod, sifre: 'YeniSifre99' })).status).toBe(404);
    expect((await call(app, 'POST', '/auth/refresh', { refreshToken: ilk.refreshToken })).status).toBe(401);
    expect(
      (await call(app, 'POST', '/auth/login', { eposta: testEposta(tel), sifre: TEST_SIFRE })).status,
    ).toBe(401);
    expect(
      (await call(app, 'POST', '/auth/login', { eposta: testEposta(tel), sifre: 'YeniSifre99' })).status,
    ).toBe(200);
    // Bağlantı e-postaya geldiği için adres doğrulanmış sayılır
    expect((await db.user.findUniqueOrThrow({ where: { id: ilk.userId } })).emailVerifiedAt).not.toBeNull();
    expect(await db.outboxEvent.count({ where: { type: 'hesap.sifre_degisti' } })).toBe(1);
  });

  it('şifre değiştir: mevcut şifre gerekir; bu oturum dışındakiler kapanır', async () => {
    const tel = '+905321112295';
    const a = await uyeOl(app, tel);
    const b = await uyeOl(app, tel);
    expect(
      (await call(app, 'POST', '/auth/password', { mevcut: 'Yanlis1234', yeni: 'Baska12345' }, a.accessToken))
        .status,
    ).toBe(403);
    const ok = await call(
      app,
      'POST',
      '/auth/password',
      { mevcut: TEST_SIFRE, yeni: 'Baska12345' },
      a.accessToken,
    );
    expect(ok.body).toEqual({ degisti: true, kapananOturum: 1 });
    expect((await call(app, 'POST', '/auth/refresh', { refreshToken: b.refreshToken })).status).toBe(401);
    expect((await call(app, 'POST', '/auth/refresh', { refreshToken: a.refreshToken })).status).toBe(200);
  });

  it('hassas işlem kodu yalnızca oturumla ve kişinin kendi numarasına gider', async () => {
    expect((await call(app, 'POST', '/auth/code', {})).status).toBe(401);
    const tel = '+905321112299';
    const a = await uyeOl(app, tel);
    await db.otpChallenge.updateMany({
      where: { phone: tel },
      data: { createdAt: new Date(Date.now() - 120_000) },
    });
    const r = await call(app, 'POST', '/auth/code', {}, a.accessToken);
    expect(r.status).toBe(200);
    expect(sms.sent.at(-1)?.to).toBe(tel);
    // Telefonla giriş ucu yok
    expect((await call(app, 'POST', '/auth/otp/request', { phone: tel })).status).toBe(404);
  });

  it('yenileme jetonunu döndürür; eski jeton tekrar kullanılırsa tüm oturumlar kapanır', async () => {
    const phone = '+905324445566';
    const login = { body: await uyeOl(app, phone) };
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
    const login = { body: await uyeOl(app, phone) };
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
    const zorunluEksik = await call(
      app,
      'POST',
      '/auth/register',
      bilgi(phone, { consents: { ...SIGNUP_CONSENTS, kvkkAydinlatma: false } }),
    );
    expect(zorunluEksik.status).toBe(400);
    await uyeOl(app, phone, { platform: 'ANDROID', consents: { reklamOlcum: true } });
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
