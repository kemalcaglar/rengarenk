import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { FlowService } from '../src/notifications/flows.js';
import { NotificationService } from '../src/notifications/notification.service.js';
import { NotificationEvents } from '../src/notifications/notification-events.js';
import { SwitchService } from '../src/notifications/switches.js';
import { DemandSearchService } from '../src/search/demand-search.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;
let akis: FlowService;
let olaylar: NotificationEvents;

const HOUR = 3_600_000;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
  akis = new FlowService(db, app.get(NotificationService), app.get(SwitchService));
  olaylar = new NotificationEvents(
    db,
    app.get(NotificationService),
    app.get(DemandSearchService),
    undefined,
    undefined,
    akis,
  );
  const bmw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: bmw.id, name: '3 Serisi', categories: ['otomobil'] },
  });
});
afterAll(() => app.close());

async function uye(phone: string, ad: string) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  const token = v.body.accessToken as string;
  await call(app, 'PATCH', '/me', { firstName: ad, lastName: 'Deneme' }, token);
  const userId = (await db.user.findUniqueOrThrow({ where: { phone } })).id;
  // Hoş geldin olayı (işçide outbox'tan gelir)
  await olaylar.handle('kullanici.kaydoldu', { userId });
  return { token, userId };
}

const kosu = (userId: string) =>
  db.automationRun.findFirstOrThrow({ where: { userId, flowKey: 'hosgeldin' } });

describe('Akış düzenleyicisi (Karar 51)', () => {
  it('adım ekleme kuralları, bekleme, koşul, hedef, kapatma ve test gönderimi', async () => {
    const pazarlamaS = await createStaff(db, 'MARKETING');
    const pazarlama = await loginAs(app, pazarlamaS);
    const destek = await loginAs(app, await createStaff(db, 'SUPPORT'));

    const l = await staffCall(app, 'GET', '/staff/notifications/automations', undefined, pazarlama.token);
    const okumadin = l.body.find((a: { key: string }) => a.key === 'okumadin');
    expect(okumadin).toMatchObject({ ekAdimlar: [], surum: 0, epostaVar: true, akista: 0 });
    expect(okumadin.degiskenler).toEqual(expect.arrayContaining(['ad', 'satici', 'talep']));
    expect(okumadin.hedef.tip).toBe('Hedef');

    const ileti = (metin: string, kanallar = ['uygulama']) => ({
      tip: 'ileti',
      baslik: 'İlk talebin ücretsiz',
      metin,
      dugme: 'Talep oluştur',
      kanallar,
    });
    const put = (key: string, adimlar: unknown[], token = pazarlama.token) =>
      staffCall(app, 'PUT', `/staff/notifications/automations/${key}/steps`, { adimlar }, token);
    // Yetki, akışta olmayan değişken, e-postası olmayan akışta e-posta
    expect((await put('hosgeldin', [ileti('Merhaba')], destek.token)).status).toBe(403);
    const yabanci = await put('hosgeldin', [ileti('{{ad}}, {{tutar}} TL')]);
    expect(yabanci.status).toBe(400);
    expect(yabanci.body.message).toContain('{{tutar}}');
    expect((await put('hosgeldin', [ileti('Merhaba', ['uygulama', 'eposta'])])).status).toBe(400);

    const adimlar = [
      { tip: 'bekle', saat: 24 },
      { tip: 'kosul', kosul: 'okunmadi' },
      ileti('{{ad}}, aradığın aracı yaz; uygun aracı olan satıcılar sana yazsın.'),
    ];
    const k = await put('hosgeldin', adimlar);
    expect(k.status).toBe(200);
    const h = k.body.find((a: { key: string }) => a.key === 'hosgeldin');
    expect(h.surum).toBe(1);
    expect(h.ekSatirlar.map((x: { tip: string; baslik: string }) => `${x.tip}: ${x.baslik}`)).toEqual([
      'Bekle: 1 gün',
      'Koşul: Önceki ileti okunmadıysa',
      'İleti: Uygulama içi ve push: “İlk talebin ücretsiz”',
    ]);
    expect(await db.auditLog.count({ where: { action: 'akis_duzenlendi', entityId: 'hosgeldin' } })).toBe(1);

    // 1) Okumayan kişi: 24 saat bekler, koşul sağlanır, ileti gider
    const ayse = await uye('+905321240001', 'Ayşe');
    expect(await db.notification.count({ where: { userId: ayse.userId, sablon: 'akis.hosgeldin' } })).toBe(1);
    expect((await kosu(ayse.userId)).status).toBe('aktif');
    // Aynı tetikleyici ikinci kez akış başlatmaz
    await olaylar.handle('kullanici.kaydoldu', { userId: ayse.userId });
    expect(await db.automationRun.count({ where: { userId: ayse.userId } })).toBe(1);

    // 2) Hoş geldin bildirimini okuyan kişi: koşul sağlanmaz, akıştan çıkar
    const mehmet = await uye('+905321240002', 'Mehmet');
    await db.notification.updateMany({ where: { userId: mehmet.userId }, data: { readAt: new Date() } });
    // 3) Talep yayınlayan kişi: hedefe ulaşır
    const zeynep = await uye('+905321240003', 'Zeynep');
    const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, zeynep.token);
    await call(
      app,
      'PATCH',
      `/demands/${d.body.id}`,
      {
        data: {
          alanlar: { model: { make: 'bmw', series: 'bmw/3-serisi' }, konum: { il: 'İzmir', ilce: 'Konak' } },
          alternatifler: [{ butce: { min: 1_500_000, max: 2_000_000 }, yil: { min: 2019, max: 2023 } }],
        },
        step: 6,
      },
      zeynep.token,
    );
    expect((await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, zeynep.token)).status).toBe(200);

    const now = new Date();
    expect(await akis.tick(now)).toBe(3);
    expect(await kosu(ayse.userId)).toMatchObject({ status: 'aktif', step: 1, note: '24 saat bekliyor' });
    expect((await kosu(zeynep.userId)).status).toBe('hedef');
    // Süre dolmadan bir şey olmaz
    expect(await akis.tick(new Date(now.getTime() + HOUR))).toBe(0);

    const sonra = new Date(now.getTime() + 25 * HOUR);
    expect(await akis.tick(sonra)).toBe(2);
    expect(await kosu(ayse.userId)).toMatchObject({ status: 'bitti', step: 3, note: 'İleti gönderildi' });
    const b = await db.notification.findFirstOrThrow({
      where: { userId: ayse.userId, sablon: 'akis.adim.hosgeldin' },
    });
    expect(b.baslik).toBe('İlk talebin ücretsiz');
    expect(b.metin).toBe('Ayşe, aradığın aracı yaz; uygun aracı olan satıcılar sana yazsın.');
    expect(await kosu(mehmet.userId)).toMatchObject({
      status: 'cikti',
      note: 'Koşul sağlanmadı: Önceki ileti okunmadıysa',
    });
    expect(
      await db.notification.count({ where: { userId: mehmet.userId, sablon: 'akis.adim.hosgeldin' } }),
    ).toBe(0);

    // 4) Akış kapatılınca süren kişiler durur; düzenleme süren kaydı değiştirmez
    const elif = await uye('+905321240004', 'Elif');
    await put('hosgeldin', [ileti('Yeni metin')]);
    expect(((await kosu(elif.userId)).steps as unknown[]).length).toBe(3);
    await staffCall(
      app,
      'POST',
      '/staff/notifications/automations/hosgeldin',
      { acik: false },
      pazarlama.token,
    );
    await akis.tick(new Date(now.getTime() + 2 * HOUR));
    expect(await kosu(elif.userId)).toMatchObject({ status: 'kapali', note: 'Akış kapatıldı' });
    await staffCall(
      app,
      'POST',
      '/staff/notifications/automations/hosgeldin',
      { acik: true },
      pazarlama.token,
    );

    // Test kişisine gönder: e-postası olan akışta ilk ileti ve eklenen ileti çalışanın adresine; hoş geldinde e-posta yok
    await put('okumadin', [
      { tip: 'bekle', saat: 48 },
      ileti('{{satici}} hâlâ yanıtını bekliyor', ['eposta']),
    ]);
    const t = await staffCall(
      app,
      'POST',
      '/staff/notifications/automations/okumadin/test',
      {},
      pazarlama.token,
    );
    expect(t.body).toEqual({ gonderilen: 2 });
    const teslim = await db.delivery.findMany({
      where: { staffId: pazarlamaS.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(teslim.map((x) => x.sablon)).toEqual(['akis.okumadin', 'akis.adim.okumadin']);
    expect((teslim[1]?.veri as { metin: string } | undefined)?.metin).toBe(
      'Marmara Oto hâlâ yanıtını bekliyor',
    );
    expect(
      (await staffCall(app, 'POST', '/staff/notifications/automations/hosgeldin/test', {}, pazarlama.token))
        .status,
    ).toBe(400);
  });
});
