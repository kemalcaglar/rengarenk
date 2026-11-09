import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENV, type Env } from '../src/config/env.js';
import type { Db } from '../src/database/prisma.js';
import { FakePush, MemoryEmail } from '../src/notifications/channels.js';
import { DeliveryService } from '../src/notifications/delivery.service.js';
import { SwitchService } from '../src/notifications/switches.js';
import { TemplatesService } from '../src/notifications/templates.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;
let sahip: string;
let destek: string;
let mod: string;
let pazarlama: string;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
  const bmw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  const s = await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: bmw.id, name: '3 Serisi', categories: ['otomobil'] },
  });
  await db.catalogModel.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi/320i', makeId: bmw.id, seriesId: s.id, name: '320i' },
  });
  sahip = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
  destek = (await loginAs(app, await createStaff(db, 'SUPPORT'))).token;
  mod = (await loginAs(app, await createStaff(db, 'MODERATOR'))).token;
  pazarlama = (await loginAs(app, await createStaff(db, 'MARKETING'))).token;
});
afterAll(() => app.close());

async function login(phone: string, ad?: [string, string]) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  const token = v.body.accessToken as string;
  if (ad) await call(app, 'PATCH', '/me', { firstName: ad[0], lastName: ad[1] }, token);
  const userId = (await db.user.findUniqueOrThrow({ where: { phone }, select: { id: true } })).id;
  return { token, userId, refresh: v.body.refreshToken as string };
}

async function talep(token: string) {
  const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, token);
  const data = {
    alanlar: {
      model: { make: 'bmw', series: 'bmw/3-serisi', model: 'bmw/3-serisi/320i' },
      konum: { il: 'İstanbul', ilce: 'Kadıköy' },
    },
    alternatifler: [{ butce: { min: 2_000_000, max: 2_500_000 }, yil: { min: 2019, max: 2023 } }],
  };
  await call(app, 'PATCH', `/demands/${d.body.id}`, { data, step: 6 }, token);
  const p = await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, token);
  return { id: d.body.id as string, no: p.body.no as number };
}

describe('kullanıcı ve galeri kartı, kara liste (Karar 40, 43, 52)', () => {
  it('kart maskeli gelir; göstermek gerekçe ister ve kayda geçer; pazarlama göremez', async () => {
    const ayse = await login('+905339990001', ['Ayşe', 'Yılmaz']);
    await talep(ayse.token);
    const ara = await staffCall(app, 'GET', '/staff/people?q=Ayşe', undefined, destek);
    expect(ara.body.find((x: { id: string }) => x.id === ayse.userId)).toMatchObject({
      ad: 'Ayşe Yılmaz',
      durum: 'Aktif',
    });
    expect((await staffCall(app, 'GET', '/staff/people?q=Ayşe', undefined, pazarlama)).status).toBe(403);

    const k = await staffCall(app, 'GET', `/staff/people/kisi/${ayse.userId}`, undefined, destek);
    expect(k.body.telefon).toBe('05•• ••• •• 01');
    expect(k.body.sayilar[0]).toEqual({ ad: 'Talep', deger: '1 · 1 aktif' });
    expect(k.body.gecmis.map((g: { olay: string }) => g.olay)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Talep oluşturdu/), 'Üye oldu']),
    );
    expect(
      (await staffCall(app, 'POST', `/staff/people/kisi/${ayse.userId}/reveal`, { gerekce: 'x' }, destek))
        .status,
    ).toBe(400);
    const g = await staffCall(
      app,
      'POST',
      `/staff/people/kisi/${ayse.userId}/reveal`,
      { gerekce: 'Destek talebi, geri dönüş' },
      destek,
    );
    expect(g.body.telefon).toBe('+905339990001');
    const kayit = await db.auditLog.findFirstOrThrow({
      where: { action: 'kisisel_veri_acildi', entityId: ayse.userId },
    });
    expect(kayit.after).toMatchObject({ gerekce: 'Destek talebi, geri dönüş' });

    // Not ve oturumları kapatma
    await staffCall(
      app,
      'POST',
      `/staff/people/kisi/${ayse.userId}/notes`,
      { metin: 'Telefonla değil e-postayla dönülsün.' },
      destek,
    );
    const o = await staffCall(app, 'POST', `/staff/people/kisi/${ayse.userId}/sessions/revoke`, {}, destek);
    expect(o.body.gecmis.map((x: { olay: string }) => x.olay)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Not · /),
        expect.stringMatching(/^Oturumlar kapatıldı/),
      ]),
    );
    expect((await call(app, 'POST', '/auth/refresh', { refreshToken: ayse.refresh })).status).toBe(401);
  });

  it('karttan karar moderasyon kaydı olarak açılır; destek askıya alamaz; hak tanımlamada aylık sınır', async () => {
    const okan = await login('+905339990011', ['Okan', 'Bulut']);
    expect(
      (
        await staffCall(
          app,
          'POST',
          `/staff/people/kisi/${okan.userId}/action`,
          { karar: 'aski', gerekce: 'Spam mesajlar' },
          destek,
        )
      ).status,
    ).toBe(403);
    const a = await staffCall(
      app,
      'POST',
      `/staff/people/kisi/${okan.userId}/action`,
      { karar: 'aski', gerekce: 'Çok sayıda alıcıya aynı spam mesaj' },
      mod,
    );
    expect(a.status).toBe(200);
    expect(a.body.durum).toBe('ACTIVE');
    expect(a.body.rozetler.map((r: { t: string }) => r.t)).toContain('Askıda · 24 saat');
    const r = await db.report.findFirstOrThrow({ where: { targetUserId: okan.userId, source: 'calisan' } });
    expect(r).toMatchObject({ targetType: 'kullanici', status: 'kapali', decision: 'aski' });
    // Kararın ayrıntısı kişiye açık ve itiraz edilebilir
    const kd = await call(app, 'GET', `/moderation/decisions/${r.id}`, undefined, okan.token);
    expect(kd.body).toMatchObject({
      hedef: 'Hesap',
      itirazEdebilir: true,
      gerekce: 'Çok sayıda alıcıya aynı spam mesaj',
    });
    const ara = await staffCall(app, 'GET', '/staff/people?tur=askida', undefined, mod);
    expect(ara.body.find((x: { id: string }) => x.id === okan.userId)?.durum).toBe('Askıda');

    // Hak tanımlama: destek ayda 10, üstü yönetici
    const h1 = await staffCall(
      app,
      'POST',
      `/staff/people/kisi/${okan.userId}/grant`,
      { tur: 'ilk_mesaj', adet: 6, gerekce: 'Hata nedeniyle gönül alma' },
      destek,
    );
    expect(h1.status).toBe(200);
    expect(
      (
        await staffCall(
          app,
          'POST',
          `/staff/people/kisi/${okan.userId}/grant`,
          { tur: 'ilk_mesaj', adet: 5, gerekce: 'Yeniden gönül alma' },
          destek,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await staffCall(
          app,
          'POST',
          `/staff/people/kisi/${okan.userId}/grant`,
          { tur: 'ilk_mesaj', adet: 5, gerekce: 'Sahip onayıyla' },
          sahip,
        )
      ).status,
    ).toBe(200);
    const hesap = await db.accountMember.findFirstOrThrow({ where: { userId: okan.userId } });
    const toplam = await db.entitlementLedger.aggregate({
      where: { accountId: hesap.accountId, kind: 'ilk_mesaj', sourceType: 'staff_grant' },
      _sum: { delta: true },
    });
    expect(toplam._sum.delta).toBe(11);
    expect(await db.outboxEvent.count({ where: { type: 'hak.tanimlandi' } })).toBe(2);
  });

  it('kara liste: numara ve IP koda kapanır; IBAN içeren mesaj gizlenir ve kritik şikâyet açılır', async () => {
    expect(
      (await staffCall(app, 'POST', '/staff/blocklist', { tur: 'telefon', deger: '0533 999 00 21' }, mod))
        .body[0],
    ).toMatchObject({ tur: 'telefon', deger: '05•• ••• •• 21' });
    expect(
      (await staffCall(app, 'POST', '/staff/blocklist', { tur: 'telefon', deger: '+905339990021' }, mod))
        .status,
    ).toBe(409);
    expect(
      (await staffCall(app, 'POST', '/staff/blocklist', { tur: 'iban', deger: 'TR12' }, mod)).status,
    ).toBe(400);
    expect((await call(app, 'POST', '/auth/otp/request', { phone: '+905339990021' })).status).toBe(403);
    // Değerin kendisi saklanmaz
    expect(await db.blocklist.count({ where: { valueHash: { contains: '9990021' } } })).toBe(0);

    await staffCall(
      app,
      'POST',
      '/staff/blocklist',
      { tur: 'iban', deger: 'TR33 0006 1005 1978 6457 8413 26', not: 'Dolandırıcılık' },
      mod,
    );
    const alici = await login('+905339990022', ['Selin', 'Ak']);
    const t = await talep(alici.token);
    const satici = await login('+905339990023', ['Can', 'Er']);
    const ilk = await call(
      app,
      'POST',
      `/talepler/${t.no}/mesaj`,
      { metin: 'Aracım hazır, bilgi için TR330006100519786457841326' },
      satici.token,
    );
    const m = await db.message.findFirstOrThrow({ where: { conversationId: ilk.body.id, kind: 'metin' } });
    expect(m.hiddenAt).not.toBeNull();
    const r = await db.report.findFirstOrThrow({ where: { targetId: m.id } });
    expect(r).toMatchObject({ priority: 'kritik', signals: ['kara_liste_iban'] });

    // Kara listeden çıkarılınca numara yeniden kod alır
    const kayit = (await staffCall(app, 'GET', '/staff/blocklist', undefined, mod)).body.find(
      (x: { tur: string }) => x.tur === 'telefon',
    );
    await staffCall(app, 'DELETE', `/staff/blocklist/${kayit.id}`, undefined, mod);
    expect((await call(app, 'POST', '/auth/otp/request', { phone: '+905339990021' })).status).toBe(200);
  });

  it('cihaz kara listesi: kişi kartından cihaz eklenir; o kurulumdan kod istenemez ve giriş yapılamaz (Karar 43)', async () => {
    const phone = '+905339990031';
    const kurulum = '7f3c2a10-5b1e-4c8d-9a6f-0e2d4b7c9a11';
    const r = await call(app, 'POST', '/auth/otp/request', { phone, kurulum });
    const v = await call(app, 'POST', '/auth/otp/verify', {
      challengeId: r.body.challengeId,
      code: sms.lastCode(phone),
      platform: 'ANDROID',
      kurulum,
      consents: SIGNUP_CONSENTS,
    });
    expect(v.status).toBe(200);
    const u = await db.user.findUniqueOrThrow({ where: { phone }, select: { id: true } });
    // Kurulum kimliğinin kendisi saklanmaz
    const d = await db.device.findFirstOrThrow({ where: { userId: u.id } });
    expect(d.installHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(await db.device.findMany())).not.toContain(kurulum);

    const kart = await staffCall(app, 'GET', `/staff/people/kisi/${u.id}`, undefined, mod);
    expect(kart.body.cihazlar).toEqual([
      expect.objectContaining({
        id: d.id,
        ad: 'Android · uygulama',
        engellenebilir: true,
        karaListede: false,
      }),
    ]);
    // Destek cihaz ekleyemez; cihaz elle yazılarak eklenemez
    expect(
      (await staffCall(app, 'POST', `/staff/people/kisi/${u.id}/devices/${d.id}/block`, {}, destek)).status,
    ).toBe(403);
    expect(
      (await staffCall(app, 'POST', '/staff/blocklist', { tur: 'cihaz', deger: kurulum }, mod)).status,
    ).toBe(400);
    const engel = await staffCall(
      app,
      'POST',
      `/staff/people/kisi/${u.id}/devices/${d.id}/block`,
      { not: 'Sahte hesap çiftliği' },
      mod,
    );
    expect(engel.status).toBe(200);
    expect(engel.body[0].karaListede).toBe(true);
    expect(
      (await staffCall(app, 'POST', `/staff/people/kisi/${u.id}/devices/${d.id}/block`, {}, mod)).status,
    ).toBe(409);
    // Açık oturum kapandı; aynı kurulumdan başka numarayla da kod istenemez
    expect((await call(app, 'POST', '/auth/refresh', { refreshToken: v.body.refreshToken })).status).toBe(
      401,
    );
    const baska = await call(app, 'POST', '/auth/otp/request', { phone: '+905339990032', kurulum });
    expect(baska.status).toBe(403);
    // Kod başka cihazdan istenip bu cihazla doğrulanamaz
    const k2 = await call(app, 'POST', '/auth/otp/request', { phone: '+905339990032' });
    expect(
      (
        await call(app, 'POST', '/auth/otp/verify', {
          challengeId: k2.body.challengeId,
          code: sms.lastCode('+905339990032'),
          kurulum,
          consents: SIGNUP_CONSENTS,
        })
      ).status,
    ).toBe(403);
    const liste = (await staffCall(app, 'GET', '/staff/blocklist', undefined, mod)).body;
    const kayit = liste.find((x: { tur: string }) => x.tur === 'cihaz');
    expect(kayit).toMatchObject({ turAd: 'Cihaz', not: 'Sahte hesap çiftliği' });
    expect(kayit.deger).toMatch(/^Android · /);

    // Kara listeden çıkarılınca cihaz yeniden kod alır
    await staffCall(app, 'DELETE', `/staff/blocklist/${kayit.id}`, undefined, mod);
    await db.otpChallenge.updateMany({
      where: { phone: '+905339990032' },
      data: { createdAt: new Date(Date.now() - 120_000) },
    });
    expect((await call(app, 'POST', '/auth/otp/request', { phone: '+905339990032', kurulum })).status).toBe(
      200,
    );
  });

  it('giriş bağlantısı: doğrulanmış e-postaya tek kullanımlık; kod kayıtta açık durmaz; yenisi eskisini geçersiz kılar (Karar 52)', async () => {
    const eposta = new MemoryEmail();
    const teslim = new DeliveryService(
      db,
      app.get<Env>(ENV),
      eposta,
      new FakePush(),
      sms,
      app.get(TemplatesService),
      app.get(SwitchService),
    );
    const k = await login('+905339990041', ['Deniz', 'Ay']);
    const yol = `/staff/people/kisi/${k.userId}/login-link`;
    // Doğrulanmış e-posta yoksa gönderilmez; pazarlama gönderemez
    expect((await staffCall(app, 'POST', yol, {}, destek)).status).toBe(409);
    await db.user.update({
      where: { id: k.userId },
      data: { email: 'deniz@ornek.com', emailVerifiedAt: new Date() },
    });
    expect((await staffCall(app, 'POST', yol, {}, pazarlama)).status).toBe(403);

    expect((await staffCall(app, 'POST', yol, {}, destek)).status).toBe(200);
    const d = await db.delivery.findFirstOrThrow({
      where: { userId: k.userId, sablon: 'hesap.giris_baglantisi' },
    });
    expect(Object.keys(d.veri as object)).toEqual(['ad', 'kodKutu']);
    await teslim.dispatchDue();
    const posta = eposta.sent.at(-1);
    expect(posta).toMatchObject({ to: 'deniz@ornek.com', subject: 'Rengarenk giriş bağlantın' });
    const kod = posta?.text.match(/baglanti\?k=([\w-]+)/)?.[1] as string;
    expect(kod).toHaveLength(43);
    // Gönderildikten sonra kod teslim kaydından silinir; bağlantının kendisi hiçbir tabloda yok
    const sonra = await db.delivery.findUniqueOrThrow({ where: { id: d.id } });
    expect(sonra.durum).toBe('gonderildi');
    expect(sonra.veri).toEqual({ ad: 'Deniz' });
    expect(await db.loginLink.count({ where: { tokenHash: kod } })).toBe(0);

    const giris = await call(app, 'POST', '/auth/link/verify', { kod });
    expect(giris.status).toBe(200);
    expect(giris.body.refreshToken).toBeTruthy();
    expect((await call(app, 'POST', '/auth/link/verify', { kod })).status).toBe(401);
    expect(await db.auditLog.count({ where: { action: 'giris_baglanti', entityId: k.userId } })).toBe(1);
    expect(
      await db.auditLog.count({ where: { action: 'giris_baglantisi_gonderildi', entityId: k.userId } }),
    ).toBe(1);

    // Yeni bağlantı eskisini geçersiz kılar; süresi dolan açılmaz; günde en çok 3
    await staffCall(app, 'POST', yol, {}, destek);
    await teslim.dispatchDue();
    const eski = eposta.sent.at(-1)?.text.match(/baglanti\?k=([\w-]+)/)?.[1] as string;
    await staffCall(app, 'POST', yol, {}, destek);
    expect((await call(app, 'POST', '/auth/link/verify', { kod: eski })).status).toBe(401);
    expect((await staffCall(app, 'POST', yol, {}, destek)).status).toBe(409);
    await db.loginLink.updateMany({
      where: { userId: k.userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await teslim.dispatchDue();
    const sure = eposta.sent.at(-1)?.text.match(/baglanti\?k=([\w-]+)/)?.[1] as string;
    expect((await call(app, 'POST', '/auth/link/verify', { kod: sure })).status).toBe(401);
  });

  it('galeri kartı: sahibin maskeli iletişimi, portföy ve yıldız sayıları', async () => {
    const sahibi = await login('+905339990031', ['Mert', 'Yıldız']);
    const accountId = uuidv7();
    const applicationId = uuidv7();
    await db.account.create({
      data: { id: accountId, kind: 'BUSINESS', name: 'Yıldız Otomotiv', businessKind: 'DEALER' },
    });
    await db.accountMember.create({ data: { accountId, userId: sahibi.userId, role: 'OWNER' } });
    await db.galleryApplication.create({
      data: {
        id: applicationId,
        userId: sahibi.userId,
        status: 'APPROVED',
        submittedAt: new Date(),
        decidedAt: new Date(),
        accountId,
        data: {},
      },
    });
    await db.gallery.create({
      data: {
        accountId,
        slug: 'yildiz-otomotiv',
        businessKind: 'DEALER',
        displayName: 'Yıldız Otomotiv',
        legalName: 'Yıldız Otomotiv Ltd. Şti.',
        taxNo: '1234567890',
        taxOffice: 'Kadıköy',
        mersisNo: '0123456789000015',
        il: 'İstanbul',
        ilce: 'Kadıköy',
        address: 'Moda Cad. No: 1',
        plan: 'profesyonel',
        applicationId,
        approvedAt: new Date(),
      },
    });
    const ara = await staffCall(app, 'GET', '/staff/people?q=Yıldız&tur=galeri', undefined, destek);
    expect(ara.body[0]).toMatchObject({
      tip: 'galeri',
      ad: 'Yıldız Otomotiv',
      alt: 'Galeri · Profesyonel paket',
    });
    const k = await staffCall(app, 'GET', `/staff/people/galeri/${accountId}`, undefined, destek);
    expect(k.body).toMatchObject({ telefon: '05•• ••• •• 31', ad: 'Yıldız Otomotiv' });
    expect(k.body.rozetler.map((r: { t: string }) => r.t)).toContain('✓ Onaylı galeri');
    expect(k.body.sayilar.map((s: { ad: string }) => s.ad)).toEqual([
      'Portföy',
      'İlk mesaj (30 gün)',
      'Ödeme (30 gün)',
      'Şikâyet',
      'Yıldız',
    ]);
  });
});
