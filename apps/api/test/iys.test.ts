import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import {
  cp1254,
  IYS_PAKET_SINIRI,
  IYS_SUTUNLAR,
  IysKayitService,
  isGunuFarki,
  iysCsv,
  iysDosyaTarihi,
  iysTarih,
} from '../src/notifications/iys.js';
import { NotificationService } from '../src/notifications/notification.service.js';
import { TemplatesService } from '../src/notifications/templates.service.js';
import { StaffAlertService } from '../src/staff-alerts/staff-alert.service.js';
import { createTestApp, uyeOl } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;
let iys: IysKayitService;
let sahip: string;
let destek: string;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
  iys = app.get(IysKayitService);
  sahip = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
  destek = (await loginAs(app, await createStaff(db, 'SUPPORT'))).token;
});
afterAll(() => app.close());

/** Ayarlar › Bildirimler › Kampanya kanalı (mobil uygulamadan) */
async function kampanya(token: string, kanal: 'eposta' | 'uygulama', acik: boolean) {
  const r = await app.inject({
    method: 'PUT',
    url: '/me/notification-preferences',
    payload: { tercihler: [{ konu: 'kampanya', kanal, acik }] },
    headers: { authorization: `Bearer ${token}`, 'x-rr-platform': 'ANDROID' },
  });
  expect(r.statusCode).toBe(200);
}

const kayitlar = (userId: string) =>
  db.iysRecord.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });

describe("İYS'ye elle aktarım (sahip kararı 21 Kasım 2026, Karar 49)", () => {
  it('izin tarihi Türkiye saatiyle, iş günü hafta sonunu saymaz', () => {
    expect(iysTarih(new Date('2026-11-20T21:05:09Z'))).toBe('2026-11-21 00:05:09');
    // Cuma → Pazartesi 1 iş günü, Cuma → Çarşamba 3
    expect(isGunuFarki(new Date('2026-11-20T09:00:00Z'), new Date('2026-11-23T09:00:00Z'))).toBe(1);
    expect(isGunuFarki(new Date('2026-11-20T09:00:00Z'), new Date('2026-11-25T09:00:00Z'))).toBe(3);
  });

  it("CSV, İYS Web'in resmî örnek dosyasıyla aynı biçimde (Ornek_Bireysel.csv)", () => {
    const t = new Date('2020-12-31T20:59:59Z');
    // Örnek dosyanın ilk satırı ve satır biçimi, harfi harfine
    expect(
      iysCsv([
        { type: 'EPOSTA', recipient: 'isim1@ornek.com', status: 'ONAY', source: 'HS_WEB', consentAt: t },
        { type: 'MESAJ', recipient: '+905901234567', status: 'RET', source: 'HS_MOBIL', consentAt: t },
      ]),
    ).toBe(
      'IZIN TURU,ALICI,ONAY(1)-RET(0),IZIN KAYNAGI,IZIN TARIHI,IZNIN ALINDIGI BAYI IYS NO\n' +
        'EPOSTA,isim1@ornek.com,1,HS_WEB,31-12-2020 23:59:59,\n' +
        'MESAJ,5901234567,0,HS_MOBIL,31-12-2020 23:59:59,\n',
    );
    expect(iysDosyaTarihi(new Date('2026-01-05T06:07:08Z'))).toBe('05-01-2026 09:07:08');
    // İYS dosyayı Windows-1254 okur
    expect([...cp1254('aşİı')]).toEqual([0x61, 0xfe, 0xdd, 0xfd]);
  });

  it('kanal başına onay ve ret yazılır, adres değişince eski adrese ret; paket CSV olarak iner', async () => {
    const u = await uyeOl(app, '05321110001');
    const token = u.accessToken as string;
    // Ticari onay olmadan kayıt yok
    expect(await iys.esitle(u.userId)).toBe(0);

    await kampanya(token, 'eposta', true);
    expect(await iys.esitle(u.userId)).toBe(1);
    // Aynı olay ikinci kez işlenirse yeni satır çıkmaz
    expect(await iys.esitle(u.userId)).toBe(0);
    // Eski kampanya SMS onayı (22 Kasım 2026'dan önce): kampanya artık SMS ya da WhatsApp'tan gitmez, eşitleme ret yazar
    await db.iysRecord.create({
      data: {
        id: uuidv7(),
        userId: u.userId,
        type: 'MESAJ',
        recipient: '+905321110001',
        status: 'ONAY',
        source: 'HS_MOBIL',
        consentAt: new Date(),
      },
    });
    expect(await iys.esitle(u.userId)).toBe(1);
    expect(await iys.esitle(u.userId)).toBe(0);

    const eski = (await db.user.findUniqueOrThrow({ where: { id: u.userId } })).email as string;
    await db.user.update({ where: { id: u.userId }, data: { email: 'Yeni.Adres@Ornek.com' } });
    expect(await iys.esitle(u.userId)).toBe(2);

    expect((await kayitlar(u.userId)).map((r) => [r.type, r.status, r.recipient, r.source])).toEqual([
      ['EPOSTA', 'ONAY', eski, 'HS_MOBIL'],
      ['MESAJ', 'ONAY', '+905321110001', 'HS_MOBIL'],
      ['MESAJ', 'RET', '+905321110001', 'HS_MOBIL'],
      ['EPOSTA', 'RET', eski, 'HS_MOBIL'],
      ['EPOSTA', 'ONAY', 'yeni.adres@ornek.com', 'HS_MOBIL'],
    ]);

    // Destek rolü (KVKK öneri düzeyi) sayıları görür, kişisel veri içeren paketi açamaz
    expect((await staffCall(app, 'GET', '/staff/iys', undefined, destek)).status).toBe(200);
    expect((await staffCall(app, 'POST', '/staff/iys/paket', undefined, destek)).status).toBe(403);

    const o = await staffCall(app, 'GET', '/staff/iys', undefined, sahip);
    expect(o.body.bekleyen).toMatchObject({
      toplam: 5,
      eposta: { onay: 2, ret: 1 },
      mesaj: { onay: 1, ret: 1 },
      gecikti: false,
    });
    const p = await staffCall(app, 'POST', '/staff/iys/paket', undefined, sahip);
    expect(p.body.sayi).toBe(5);
    // Bekleyen kalmayınca yeni paket açılmaz
    expect((await staffCall(app, 'POST', '/staff/iys/paket', undefined, sahip)).body ?? null).toBeNull();

    const x = await app.inject({
      method: 'GET',
      url: `/staff/iys/paket/${p.body.id}/csv`,
      remoteAddress: '127.0.0.1',
      headers: { authorization: `Bearer ${sahip}` },
    });
    expect(x.statusCode).toBe(200);
    expect(x.headers['content-disposition']).toContain(`iys_izinleri_${p.body.no}.csv`);
    expect(x.headers['content-type']).toContain('text/csv');
    const sayfa = new TextDecoder('windows-1254')
      .decode(x.rawPayload)
      .trimEnd()
      .split('\n')
      .map((l) => l.split(','));
    expect(sayfa[0]).toEqual(IYS_SUTUNLAR);
    expect(sayfa.slice(1).map((r) => r.slice(0, 4))).toEqual(
      expect.arrayContaining([
        ['EPOSTA', eski, '1', 'HS_MOBIL'],
        ['MESAJ', '5321110001', '1', 'HS_MOBIL'],
        ['MESAJ', '5321110001', '0', 'HS_MOBIL'],
        ['EPOSTA', eski, '0', 'HS_MOBIL'],
        ['EPOSTA', 'yeni.adres@ornek.com', '1', 'HS_MOBIL'],
      ]),
    );
    expect(sayfa[1]?.[4]).toMatch(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/);
    expect(sayfa[1]?.[5]).toBe('');
    expect(
      await db.auditLog.count({ where: { entityId: p.body.id, action: { in: ['iys_paket', 'iys_indir'] } } }),
    ).toBe(2);

    // Yüklenmedi işaretli paket varken saatlik denetim 2 iş günü sonra uyarır
    const uyari = app.get(StaffAlertService);
    const sonra = new Date(Date.now() + 7 * 86_400_000);
    expect(await uyari.iysAktarim(sonra)).toBeGreaterThan(0);
    expect(await uyari.iysAktarim(new Date())).toBe(0);

    expect(
      (await staffCall(app, 'POST', `/staff/iys/paket/${p.body.id}/yuklendi`, undefined, sahip)).status,
    ).toBe(200);
    const o2 = await staffCall(app, 'GET', '/staff/iys', undefined, sahip);
    expect(o2.body.bekleyen.toplam).toBe(0);
    expect(o2.body.paketler[0]).toMatchObject({ id: p.body.id, sayi: 5 });
    expect(o2.body.paketler[0].yuklendi).toBeTruthy();
    expect(await uyari.iysAktarim(sonra)).toBe(0);

    // Kanal kapanınca onay geri alınır: e-postaya ret
    await kampanya(token, 'eposta', false);
    expect(await iys.esitle(u.userId)).toBe(1);
    const son = (await kayitlar(u.userId)).slice(-1);
    expect(son.map((r) => [r.type, r.status, r.recipient])).toEqual([
      ['EPOSTA', 'RET', 'yeni.adres@ornek.com'],
    ]);
    // Satırlar silinmez (onayın ispatı)
    await expect(db.iysRecord.deleteMany({ where: { userId: u.userId } })).rejects.toThrow();
  });

  it('hesap kapanınca (telefon kapali:, e-posta yok) son onaylı adreslere ret yazılır', async () => {
    const u = await uyeOl(app, '05321110002');
    await kampanya(u.accessToken as string, 'eposta', true);
    expect(await iys.esitle(u.userId)).toBe(1);
    await db.user.update({ where: { id: u.userId }, data: { email: null, phone: `kapali:${u.userId}` } });
    expect(await iys.esitle(u.userId)).toBe(1);
    const r = (await kayitlar(u.userId)).at(-1);
    expect(r).toMatchObject({ type: 'EPOSTA', status: 'RET' });
  });

  it('İYS bir dosyada en fazla 50 izin aktarır: paket 50 satırla sınırlı, en eskiler önce', async () => {
    const u = await uyeOl(app, '05321110003');
    const t0 = Date.now() - 3_600_000;
    await db.iysRecord.createMany({
      data: Array.from({ length: IYS_PAKET_SINIRI + 1 }, (_, i) => ({
        id: uuidv7(),
        userId: u.userId,
        type: 'EPOSTA',
        recipient: `kisi${i}@ornek.com`,
        status: 'ONAY',
        source: 'HS_WEB',
        consentAt: new Date(t0 + i * 1000),
      })),
    });
    const bekleyen = await db.iysRecord.count({ where: { batchId: null } });
    const sayilar: number[] = [];
    for (;;) {
      const p = (await staffCall(app, 'POST', '/staff/iys/paket', undefined, sahip)).body;
      if (!p) break;
      sayilar.push(p.sayi);
    }
    expect(Math.max(...sayilar)).toBe(IYS_PAKET_SINIRI);
    expect(sayilar.reduce((a, b) => a + b, 0)).toBe(bekleyen);
    // En yeni kayıt son pakette
    const son = await db.iysRecord.findFirstOrThrow({
      where: { recipient: `kisi${IYS_PAKET_SINIRI}@ornek.com` },
    });
    const enYeniPaket = await db.iysBatch.findFirstOrThrow({ orderBy: { no: 'desc' } });
    expect(son.batchId).toBe(enYeniPaket.id);
  });

  it('üyelikte işaretlenen ticari ileti kanalları kampanya tercihini açar; e-posta İYS yüklenmeden gitmez', async () => {
    const u = await uyeOl(app, '05321110004', {
      consents: { ticariKanallar: { eposta: true, bildirim: true } },
    });
    const onay = await db.consent.findFirstOrThrow({ where: { userId: u.userId, kind: 'ticari_ileti' } });
    expect(onay.granted).toBe(true);
    const tercih = await db.notificationPref.findMany({
      where: { userId: u.userId, konu: 'kampanya' },
      orderBy: { kanal: 'asc' },
    });
    expect(tercih.map((t) => [t.kanal, t.acik])).toEqual([
      ['eposta', true],
      ['uygulama', true],
    ]);
    expect(
      await db.outboxEvent.count({
        where: { type: 'iys.izin_degisti', payload: { path: ['userId'], equals: u.userId } },
      }),
    ).toBe(1);
    // İşçi olayı işleyince yalnızca e-posta için İYS onayı yazılır (bildirim İYS kapsamında değil)
    expect(await iys.esitle(u.userId)).toBe(1);
    expect((await kayitlar(u.userId)).map((r) => [r.type, r.status])).toEqual([['EPOSTA', 'ONAY']]);

    const ns = app.get(NotificationService);
    const { sablon } = await app.get(TemplatesService).get('kampanya.duyuru');
    expect(await ns.kanallar(u.userId, sablon)).toMatchObject({
      uygulama: true,
      eposta: false,
      whatsapp: false,
    });
    // Paket İYS'ye yüklendi işaretlenince e-posta açılır
    const p = await staffCall(app, 'POST', '/staff/iys/paket', undefined, sahip);
    expect(await ns.kanallar(u.userId, sablon)).toMatchObject({ eposta: false });
    await staffCall(app, 'POST', `/staff/iys/paket/${p.body.id}/yuklendi`, undefined, sahip);
    expect(await ns.kanallar(u.userId, sablon)).toMatchObject({ uygulama: true, eposta: true });
    // Adres değişince yeni adres İYS'ye yüklenene kadar e-posta yine kapalı
    await db.user.update({ where: { id: u.userId }, data: { email: 'baska@ornek.com' } });
    expect(await ns.kanallar(u.userId, sablon)).toMatchObject({ eposta: false });
  });

  it('kanal seçmeden üye olan kişide ticari onay ve kampanya tercihi yok', async () => {
    const u = await uyeOl(app, '05321110005', {
      consents: { ticariKanallar: { eposta: false, bildirim: false } },
    });
    const onay = await db.consent.findFirstOrThrow({ where: { userId: u.userId, kind: 'ticari_ileti' } });
    expect(onay.granted).toBe(false);
    expect(await db.notificationPref.count({ where: { userId: u.userId, konu: 'kampanya' } })).toBe(0);
  });
});
