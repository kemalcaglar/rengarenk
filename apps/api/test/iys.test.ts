import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { readFirstSheet } from '@rengarenk/catalog';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { IYS_SUTUNLAR, IysKayitService, isGunuFarki, iysTarih } from '../src/notifications/iys.js';
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
async function kampanya(token: string, kanal: 'eposta' | 'sms', acik: boolean) {
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

  it('kanal başına onay ve ret yazılır, adres değişince eski adrese ret; paket Excel olarak iner', async () => {
    const u = await uyeOl(app, '05321110001');
    const token = u.accessToken as string;
    // Ticari onay olmadan kayıt yok
    expect(await iys.esitle(u.userId)).toBe(0);

    await kampanya(token, 'eposta', true);
    expect(await iys.esitle(u.userId)).toBe(1);
    // Aynı olay ikinci kez işlenirse yeni satır çıkmaz
    expect(await iys.esitle(u.userId)).toBe(0);
    await kampanya(token, 'sms', true);
    expect(await iys.esitle(u.userId)).toBe(1);

    const eski = (await db.user.findUniqueOrThrow({ where: { id: u.userId } })).email as string;
    await db.user.update({ where: { id: u.userId }, data: { email: 'Yeni.Adres@Ornek.com' } });
    expect(await iys.esitle(u.userId)).toBe(2);

    expect((await kayitlar(u.userId)).map((r) => [r.type, r.status, r.recipient, r.source])).toEqual([
      ['EPOSTA', 'ONAY', eski, 'HS_MOBIL'],
      ['MESAJ', 'ONAY', '+905321110001', 'HS_MOBIL'],
      ['EPOSTA', 'RET', eski, 'HS_MOBIL'],
      ['EPOSTA', 'ONAY', 'yeni.adres@ornek.com', 'HS_MOBIL'],
    ]);

    // Destek rolü (KVKK öneri düzeyi) sayıları görür, kişisel veri içeren paketi açamaz
    expect((await staffCall(app, 'GET', '/staff/iys', undefined, destek)).status).toBe(200);
    expect((await staffCall(app, 'POST', '/staff/iys/paket', undefined, destek)).status).toBe(403);

    const o = await staffCall(app, 'GET', '/staff/iys', undefined, sahip);
    expect(o.body.bekleyen).toMatchObject({
      toplam: 4,
      eposta: { onay: 2, ret: 1 },
      sms: { onay: 1, ret: 0 },
      gecikti: false,
    });
    const p = await staffCall(app, 'POST', '/staff/iys/paket', undefined, sahip);
    expect(p.body.sayi).toBe(4);
    // Bekleyen kalmayınca yeni paket açılmaz
    expect((await staffCall(app, 'POST', '/staff/iys/paket', undefined, sahip)).body ?? null).toBeNull();

    const x = await app.inject({
      method: 'GET',
      url: `/staff/iys/paket/${p.body.id}/excel`,
      remoteAddress: '127.0.0.1',
      headers: { authorization: `Bearer ${sahip}` },
    });
    expect(x.statusCode).toBe(200);
    expect(x.headers['content-disposition']).toContain(`iys_izinleri_${p.body.no}.xlsx`);
    const sayfa = readFirstSheet(new Uint8Array(x.rawPayload));
    expect(sayfa[0]).toEqual(IYS_SUTUNLAR);
    expect(sayfa.slice(1).map((r) => r.slice(0, 5))).toEqual(
      expect.arrayContaining([
        [eski, 'EPOSTA', 'ONAY', 'BIREYSEL', 'HS_MOBIL'],
        ['+905321110001', 'MESAJ', 'ONAY', 'BIREYSEL', 'HS_MOBIL'],
        [eski, 'EPOSTA', 'RET', 'BIREYSEL', 'HS_MOBIL'],
        ['yeni.adres@ornek.com', 'EPOSTA', 'ONAY', 'BIREYSEL', 'HS_MOBIL'],
      ]),
    );
    expect(String(sayfa[1]?.[5])).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
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
    expect(o2.body.paketler[0]).toMatchObject({ id: p.body.id, sayi: 4 });
    expect(o2.body.paketler[0].yuklendi).toBeTruthy();
    expect(await uyari.iysAktarim(sonra)).toBe(0);

    // Kanallar kapanınca onay geri alınır: iki kanalda ret
    await kampanya(token, 'eposta', false);
    await kampanya(token, 'sms', false);
    expect(await iys.esitle(u.userId)).toBe(2);
    const son = (await kayitlar(u.userId)).slice(-2);
    expect(son.map((r) => [r.type, r.status, r.recipient])).toEqual([
      ['EPOSTA', 'RET', 'yeni.adres@ornek.com'],
      ['MESAJ', 'RET', '+905321110001'],
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
});
