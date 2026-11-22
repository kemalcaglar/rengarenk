import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { gallerySlug } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENV, type Env } from '../src/config/env.js';
import type { Db } from '../src/database/prisma.js';
import { FakePush, MemoryEmail } from '../src/notifications/channels.js';
import { isinmaLimiti } from '../src/notifications/commercial.js';
import { DeliveryService } from '../src/notifications/delivery.service.js';
import { NotificationService, sessizSaatSonu } from '../src/notifications/notification.service.js';
import { NotificationEvents } from '../src/notifications/notification-events.js';
import { SwitchService } from '../src/notifications/switches.js';
import { TemplatesService } from '../src/notifications/templates.service.js';
import { DemandSearchService } from '../src/search/demand-search.service.js';
import { MemoryWhatsAppSender } from '../src/sms/whatsapp.js';
import { call, createTestApp, iysYuklendi, uyeOl } from './helpers.js';

let app: NestFastifyApplication;
let wa: MemoryWhatsAppSender;
let db: Db;
let eposta: MemoryEmail;
let push: FakePush;
let teslim: DeliveryService;
let olaylar: NotificationEvents;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
  eposta = new MemoryEmail();
  push = new FakePush();
  wa = new MemoryWhatsAppSender();
  teslim = new DeliveryService(
    db,
    app.get<Env>(ENV),
    eposta,
    push,
    wa,
    app.get(TemplatesService),
    app.get(SwitchService),
  );
  olaylar = new NotificationEvents(db, app.get(NotificationService), app.get(DemandSearchService));
  const bmw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  const s = await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: bmw.id, name: '3 Serisi', categories: ['otomobil'] },
  });
  await db.catalogModel.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi/320i', makeId: bmw.id, seriesId: s.id, name: '320i' },
  });
});
afterAll(() => app.close());

async function login(phone: string, ad = 'Ayşe') {
  const v = { body: await uyeOl(app, phone) };
  const token = v.body.accessToken as string;
  await call(app, 'PATCH', '/me', { firstName: ad, lastName: 'Yılmaz' }, token);
  const userId = (await db.user.findUniqueOrThrow({ where: { phone } })).id;
  return { token, userId };
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

describe('bildirim katmanı (Karar 30, 48, 49, 50)', () => {
  it('talep süresi dolmadan üç kanaldan hatırlatma: uygulama ve push, e-posta, WhatsApp (son gün)', async () => {
    const phone = '+905339990001';
    const u = await login(phone);

    // E-posta adresi doğrulanana kadar bildirim gitmez; doğrulama bağlantısı hemen gönderilir
    const e = await call(app, 'POST', '/me/email', { eposta: 'Ayse@Ornek.com' }, u.token);
    expect(e.body).toMatchObject({ adres: 'ay***@ornek.com', dogrulandi: false });
    await teslim.dispatchDue();
    const dogrulama = eposta.sent.at(-1);
    expect(dogrulama?.subject).toBe('E-posta adresini doğrula');
    expect(dogrulama?.to).toBe('ayse@ornek.com');
    const kod = dogrulama?.text.match(/kod=([\w-]+)/)?.[1] as string;
    expect((await call(app, 'POST', '/eposta/dogrula', { kod })).body).toMatchObject({ dogrulandi: true });
    expect((await call(app, 'POST', '/eposta/dogrula', { kod })).status).toBe(404); // tek kullanımlık

    await call(
      app,
      'POST',
      '/me/push-tokens',
      { token: `cihaz-${'x'.repeat(30)}`, platform: 'ios' },
      u.token,
    );
    const d = await talep(u.token);
    const waOnce = wa.sent.length;

    // 3 gün kala: uygulama, push ve e-posta; WhatsApp yalnızca son gün
    await olaylar.handle('talep.suresi_doluyor', { demandId: d.id, userId: u.userId, gun: 3 });
    await teslim.dispatchDue();
    expect(push.sent.at(-1)).toMatchObject({ baslik: 'Talebin 3 gün sonra doluyor' });
    expect(eposta.sent.at(-1)).toMatchObject({
      subject: 'Talebin 3 gün sonra doluyor',
      to: 'ayse@ornek.com',
    });
    expect(eposta.sent.at(-1)?.html).toContain('Taleplerime git');
    expect(wa.sent.length).toBe(waOnce);

    await olaylar.handle('talep.suresi_doluyor', { demandId: d.id, userId: u.userId, gun: 1 });
    await teslim.dispatchDue();
    expect(push.sent.at(-1)?.baslik).toBe('Talebin 1 gün sonra doluyor');
    expect(eposta.sent.at(-1)?.subject).toBe('Talebin 1 gün sonra doluyor');
    // WhatsApp: Meta'daki onaylı şablon, gövde değerleri sırasıyla talep ve bağlantı
    const son = wa.sent.at(-1);
    expect(son?.to).toBe(phone);
    expect(son?.sablon).toBe('rengarenk_talep_doluyor');
    expect(son?.parametreler).toHaveLength(2);
    expect(son?.parametreler[1]).toMatch(/^https?:\/\/.+\/taleplerim$/);

    const teslimler = await db.delivery.findMany({
      where: { userId: u.userId, sablon: 'talep.suresi_doluyor' },
    });
    expect(
      teslimler
        .filter((t) => t.durum === 'gonderildi')
        .map((t) => t.kanal)
        .sort(),
    ).toEqual(['eposta', 'eposta', 'push', 'push', 'whatsapp']);

    // Zil: liste, okunmamış sayısı, tümünü okundu say
    const l = await call(app, 'GET', '/notifications', undefined, u.token);
    expect(l.body.okunmamis).toBe(2);
    expect(l.body.bildirimler[0]).toMatchObject({
      grup: 'talep',
      ikon: '⏳',
      baslik: 'Talebin 1 gün sonra doluyor',
    });
    expect(
      (await call(app, 'GET', '/notifications?grup=mesaj', undefined, u.token)).body.bildirimler,
    ).toEqual([]);
    expect((await call(app, 'POST', '/notifications/read', { hepsi: true }, u.token)).body).toEqual({
      okunmamis: 0,
    });
  });

  it('tercihler: kilitli kanal kapanmaz; kapatılan kanal gitmez; kampanya ticari ileti onayı yazar', async () => {
    const u = await login('+905339991001');
    await db.user.update({
      where: { id: u.userId },
      data: { email: 'can@ornek.com', emailVerifiedAt: new Date() },
    });
    const p = await call(app, 'GET', '/me/notification-preferences', undefined, u.token);
    expect(p.body.konular.map((k: { konu: string }) => k.konu)).toEqual([
      'mesaj',
      'arama',
      'sure',
      'odeme',
      'kampanya',
    ]);
    expect(p.body.konular.find((k: { konu: string }) => k.konu === 'sure').kanallar).toEqual([
      { kanal: 'uygulama', acik: true, kilitli: false, kapali: false },
      { kanal: 'eposta', acik: true, kilitli: false, kapali: false },
      { kanal: 'whatsapp', acik: true, kilitli: false, kapali: false },
    ]);
    // Kampanya WhatsApp'tan gitmez: kutu yok, açılamaz (sahip kararı 22 Kasım 2026)
    expect(
      p.body.konular
        .find((k: { konu: string }) => k.konu === 'kampanya')
        .kanallar.find((k: { kanal: string }) => k.kanal === 'whatsapp'),
    ).toMatchObject({ acik: false, kapali: true });
    expect(
      (
        await call(
          app,
          'PUT',
          '/me/notification-preferences',
          { tercihler: [{ konu: 'kampanya', kanal: 'whatsapp', acik: true }] },
          u.token,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await call(
          app,
          'PUT',
          '/me/notification-preferences',
          { tercihler: [{ konu: 'odeme', kanal: 'eposta', acik: false }] },
          u.token,
        )
      ).status,
    ).toBe(400);
    await call(
      app,
      'PUT',
      '/me/notification-preferences',
      {
        tercihler: [
          { konu: 'sure', kanal: 'eposta', acik: false },
          { konu: 'sure', kanal: 'whatsapp', acik: false },
        ],
      },
      u.token,
    );
    const d = await talep(u.token);
    const once = await db.delivery.count({ where: { userId: u.userId } });
    await olaylar.handle('talep.suresi_doluyor', { demandId: d.id, userId: u.userId, gun: 1 });
    expect(await db.delivery.count({ where: { userId: u.userId } })).toBe(once);
    expect((await call(app, 'GET', '/notifications/unread', undefined, u.token)).body.okunmamis).toBe(1);

    const k = await call(
      app,
      'PUT',
      '/me/notification-preferences',
      { tercihler: [{ konu: 'kampanya', kanal: 'eposta', acik: true }] },
      u.token,
    );
    expect(k.body.ticariOnay).toBe(true);
    const r = await db.consent.findFirst({
      where: { userId: u.userId, kind: 'ticari_ileti' },
      orderBy: { createdAt: 'desc' },
    });
    expect(r?.granted).toBe(true);
    await call(
      app,
      'PUT',
      '/me/notification-preferences',
      { tercihler: [{ konu: 'kampanya', kanal: 'eposta', acik: false }] },
      u.token,
    );
    expect((await call(app, 'GET', '/me/notification-preferences', undefined, u.token)).body.ticariOnay).toBe(
      false,
    );
    // E-posta değişirse doğrulama sıfırlanır (bildirim doğrulanmamış adrese gitmez); profil güncellemesi e-postayı değiştirmez
    expect((await call(app, 'PATCH', '/me', { email: 'baska@ornek.com' }, u.token)).status).toBe(400);
    await call(app, 'POST', '/me/email', { eposta: 'baska@ornek.com' }, u.token);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.userId } })).emailVerifiedAt).toBeNull();
  });

  it('kanal sırası: mesaj okunduysa gecikmeli e-posta gitmez; kalıcı hata ve geçersiz cihaz', async () => {
    const alici = await login('+905339992001');
    await db.user.update({
      where: { id: alici.userId },
      data: { email: 'deniz@kalici-hata.test', emailVerifiedAt: new Date() },
    });
    const ns = app.get(NotificationService);
    await call(
      app,
      'POST',
      '/me/push-tokens',
      { token: `gecersiz-${'y'.repeat(30)}`, platform: 'android' },
      alici.token,
    );
    const conv = uuidv7();
    await ns.notify({
      userIds: [alici.userId],
      sablon: 'mesaj.ilk',
      veri: { conversationId: conv, satici: 'Marmara Oto', talep: 'BMW 320i' },
    });
    // Aynı sohbetten ikinci mesaj aynı bildirimi günceller
    await ns.notify({
      userIds: [alici.userId],
      sablon: 'mesaj.geldi',
      veri: { conversationId: conv, gonderen: 'Marmara Oto', konu: 'BMW 320i' },
    });
    const l = await call(app, 'GET', '/notifications', undefined, alici.token);
    expect(l.body.bildirimler).toHaveLength(1);
    expect(l.body.bildirimler[0]).toMatchObject({ grup: 'mesaj', baslik: 'Marmara Oto yazdı' });

    // Push hemen, geçersiz anahtar kapanır; e-posta 15/30 dakika sonra ve bildirim okunduysa atlanır
    await teslim.dispatchDue();
    expect(
      (await db.pushToken.findFirstOrThrow({ where: { userId: alici.userId } })).disabledAt,
    ).not.toBeNull();
    const bekleyen = await db.delivery.findMany({ where: { userId: alici.userId, kanal: 'eposta' } });
    expect(bekleyen.every((b) => b.durum === 'bekliyor' && b.kosul === 'okunmadiysa')).toBe(true);
    await call(app, 'POST', '/notifications/read', { ids: [l.body.bildirimler[0].id] }, alici.token);
    await teslim.dispatchDue(new Date(Date.now() + 31 * 60_000));
    const sonra = await db.delivery.findMany({ where: { userId: alici.userId, kanal: 'eposta' } });
    expect(sonra.map((b) => b.durum)).toEqual(['atlandi', 'atlandi']);

    // Okunmamış bildirimin e-postası gider; kalıcı hata veren adres gönderim dışı listeye alınır
    await ns.notify({
      userIds: [alici.userId],
      sablon: 'mesaj.ilk',
      veri: { conversationId: uuidv7(), satici: 'Anadolu Oto', talep: 'BMW 320i' },
    });
    await teslim.dispatchDue(new Date(Date.now() + 16 * 60_000));
    expect(
      await db.emailSuppression.findUnique({ where: { email: 'deniz@kalici-hata.test' } }),
    ).toMatchObject({
      reason: 'kalici_hata',
    });
  });

  it('kayıtlı arama: yeni talep anlık aramaya uyarsa bildirim; ticari sessiz saat', async () => {
    const arayan = await login('+905339993001', 'Emre');
    await call(
      app,
      'POST',
      '/saved-searches',
      { ad: 'İstanbul BMW', sorgu: { il: 'İstanbul', marka: 'bmw' } },
      arayan.token,
    );
    const sahip = await login('+905339993002');
    const d = await talep(sahip.token);
    await app.get(DemandSearchService).sync(d.id, true);
    await olaylar.handle('talep.yayinlandi', { demandId: d.id });
    const l = await call(app, 'GET', '/notifications', undefined, arayan.token);
    expect(l.body.bildirimler[0]).toMatchObject({
      baslik: '“İstanbul BMW” aramana uyan yeni talep',
      url: `/talep/${d.no}`,
    });

    // İstanbul 22.30 → ertesi gün 09.00; 14.00 → aynı an
    expect(sessizSaatSonu(new Date('2026-11-09T19:30:00Z')).toISOString()).toBe('2026-11-10T06:00:00.000Z');
    expect(sessizSaatSonu(new Date('2026-11-09T11:00:00Z')).toISOString()).toBe('2026-11-09T11:00:00.000Z');
    expect(sessizSaatSonu(new Date('2026-11-09T03:00:00Z')).toISOString()).toBe('2026-11-09T06:00:00.000Z');
  });

  it('ticari ileti: onay, haftada 2, ısınma sınırı, tek tıkla ayrılma', async () => {
    const u = await login('+905339994001');
    await db.user.update({
      where: { id: u.userId },
      data: { email: 'kampanya@ornek.com', emailVerifiedAt: new Date() },
    });
    const ns = app.get(NotificationService);
    const kampanya = {
      baslik: 'Hafta sonu: talebini öne çıkar',
      metin: 'Üst sıra %20 indirimli.',
      url: '/haklarim',
      dugme: 'İncele',
    };
    // Onay yoksa hiçbir kanaldan gitmez
    expect(await ns.notify({ userIds: [u.userId], sablon: 'kampanya.duyuru', veri: kampanya })).toBe(0);
    await call(
      app,
      'PUT',
      '/me/notification-preferences',
      {
        tercihler: [
          { konu: 'kampanya', kanal: 'uygulama', acik: true },
          { konu: 'kampanya', kanal: 'eposta', acik: true },
        ],
      },
      u.token,
    );
    expect(await db.outboxEvent.count({ where: { type: 'iys.izin_degisti' } })).toBeGreaterThan(0);
    // Onay İYS'ye yüklenmeden ticari e-posta açılmaz (Karar 49); uygulama içi bildirim İYS kapsamında değil
    const tpl = app.get(TemplatesService);
    const { sablon: ks } = await tpl.get('kampanya.duyuru');
    expect(await ns.kanallar(u.userId, ks)).toMatchObject({ uygulama: true, eposta: false });
    await iysYuklendi(app, u.userId);
    expect(await ns.kanallar(u.userId, ks)).toMatchObject({ uygulama: true, eposta: true });
    expect(await ns.notify({ userIds: [u.userId], sablon: 'kampanya.duyuru', veri: kampanya })).toBe(1);
    expect(await ns.notify({ userIds: [u.userId], sablon: 'kampanya.duyuru', veri: kampanya })).toBe(1);
    expect(await ns.notify({ userIds: [u.userId], sablon: 'kampanya.duyuru', veri: kampanya })).toBe(0); // haftada 2
    const b = (await call(app, 'GET', '/notifications', undefined, u.token)).body.bildirimler[0];
    expect(b).toMatchObject({ grup: 'kampanya', ticari: true });

    // Isınma başlamadıysa ticari e-posta ertelenir; 10. haftada gider, ayrılma başlığıyla
    const ilk = await db.delivery.findFirstOrThrow({
      where: { userId: u.userId, kanal: 'eposta', ticari: true },
    });
    await db.delivery.updateMany({
      where: { userId: u.userId, ticari: true },
      data: { dueAt: new Date(Date.now() - 1000) },
    });
    await teslim.dispatchDue();
    expect((await db.delivery.findUniqueOrThrow({ where: { id: ilk.id } })).neden).toContain('Isınma');
    const env = app.get<Env>(ENV);
    const isinmis = new DeliveryService(
      db,
      { ...env, EPOSTA_ISINMA_BASLANGIC: new Date(Date.now() - 70 * 86_400_000).toISOString().slice(0, 10) },
      eposta,
      push,
      wa,
      app.get(TemplatesService),
      app.get(SwitchService),
    );
    await db.delivery.updateMany({
      where: { userId: u.userId, ticari: true },
      data: { dueAt: new Date(Date.now() - 1000) },
    });
    await isinmis.dispatchDue();
    const giden = eposta.sent.find((m) => m.to === 'kampanya@ornek.com');
    expect(giden?.from).toContain('bulten@');
    expect(giden?.akis).toBe('ticari');
    expect(giden?.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    const k = giden?.headers?.['List-Unsubscribe']?.match(/k=([^>]+)/)?.[1] as string;

    // Tek tıkla ayrılma: imzasız kod reddedilir; ayrılınca onay geri alınır, adres ticari gönderimden çıkar
    expect((await app.inject({ method: 'POST', url: `/iletisim/ayril?k=${ilk.id}.sahte` })).statusCode).toBe(
      404,
    );
    expect((await app.inject({ method: 'POST', url: `/iletisim/ayril?k=${k}` })).statusCode).toBe(200);
    expect((await call(app, 'GET', '/me/notification-preferences', undefined, u.token)).body.ticariOnay).toBe(
      false,
    );
    expect(await db.emailSuppression.findUnique({ where: { email: 'kampanya@ornek.com' } })).toMatchObject({
      reason: 'ayrildi',
      onlyCommercial: true,
    });

    expect(isinmaLimiti(null, new Date())).toBe(0);
    const bas = new Date('2026-11-01');
    expect(isinmaLimiti(bas, new Date('2026-11-05'))).toBe(0);
    expect(isinmaLimiti(bas, new Date('2026-11-09'))).toBe(200);
    expect(isinmaLimiti(bas, new Date('2026-11-23'))).toBe(800);
    expect(isinmaLimiti(bas, new Date('2026-12-20'))).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('galeri daveti bildirimi (Karar 20, 48)', () => {
  it('davet edilen numaranın hesabına uygulama içi bildirim ve e-posta; geçersiz davete gitmez', async () => {
    const sahip = await login('+905339995001', 'Mert');
    const calisan = await login('+905339995002', 'Elif');
    const accountId = uuidv7();
    const applicationId = uuidv7();
    await db.account.create({
      data: { id: accountId, kind: 'BUSINESS', name: 'Deniz Oto', businessKind: 'DEALER' },
    });
    await db.accountMember.create({ data: { accountId, userId: sahip.userId, role: 'OWNER' } });
    await db.galleryApplication.create({
      data: {
        id: applicationId,
        userId: sahip.userId,
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
        slug: gallerySlug('Deniz Oto'),
        businessKind: 'DEALER',
        displayName: 'Deniz Oto',
        legalName: 'Deniz Oto Ltd. Şti.',
        taxNo: '1234567890',
        taxOffice: 'Kadıköy',
        mersisNo: '0123456789000015',
        il: 'İstanbul',
        ilce: 'Kadıköy',
        address: 'Moda Cad. No: 1',
        authorityNo: '34-2026-001',
        plan: 'deneme',
        trialEndsAt: new Date(Date.now() + 30 * 86_400_000),
        applicationId,
        approvedAt: new Date(),
      },
    });
    const davet = async (phone: string, extra: Partial<{ revokedAt: Date }> = {}) => {
      const id = uuidv7();
      await db.accountInvite.create({
        data: {
          id,
          accountId,
          phone,
          role: 'SALES',
          invitedBy: sahip.userId,
          expiresAt: new Date(Date.now() + 7 * 86_400_000),
          ...extra,
        },
      });
      return id;
    };

    // E-posta yalnızca doğrulanmış adrese gider
    await db.user.update({ where: { id: calisan.userId }, data: { emailVerifiedAt: new Date() } });
    await olaylar.handle('galeri.davet_edildi', { inviteId: await davet('+905339995002'), accountId });
    const b = await db.notification.findFirstOrThrow({
      where: { userId: calisan.userId, sablon: 'galeri.davet_edildi' },
    });
    expect(b).toMatchObject({ baslik: 'Deniz Oto seni ekibine davet etti', url: '/galeri-paneli' });
    expect(b.metin).toContain('Satış temsilcisi');
    await teslim.dispatchDue();
    expect(eposta.sent.some((e) => e.subject === 'Deniz Oto seni ekibine davet etti')).toBe(true);

    // Hesabı olmayan numaraya ve iptal edilmiş davete bildirim yazılmaz
    expect(
      await olaylar.handle('galeri.davet_edildi', { inviteId: await davet('+905339995099'), accountId }),
    ).toBe(0);
    const iptal = await davet('+905339995002', { revokedAt: new Date() });
    expect(await olaylar.handle('galeri.davet_edildi', { inviteId: iptal, accountId })).toBe(0);
  });
});
