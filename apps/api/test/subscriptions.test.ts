import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { gallerySlug, planNetKurus, withVat } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { EntitlementService } from '../src/entitlements/entitlement.service.js';
import { OrdersService } from '../src/payments/orders.service.js';
import { SubscriptionsService } from '../src/payments/subscriptions.service.js';
import { call, createTestApp, uyeOl } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;
let subs: SubscriptionsService;
let hak: EntitlementService;

const DAY = 86_400_000;
const onay = { sozlesme: true, yenileme: true };
const eposta = 'muhasebe@ornekoto.com';

beforeAll(async () => {
  ({ app, db } = await createTestApp());
  subs = app.get(SubscriptionsService);
  hak = app.get(EntitlementService);
});
afterAll(() => app.close());

async function login(phone: string) {
  const v = { body: await uyeOl(app, phone) };
  return v.body.accessToken as string;
}

async function galeri(phone: string, ad: string) {
  const token = await login(phone);
  const userId = (await db.user.findUniqueOrThrow({ where: { phone } })).id;
  const accountId = uuidv7();
  const applicationId = uuidv7();
  await db.account.create({ data: { id: accountId, kind: 'BUSINESS', name: ad, businessKind: 'DEALER' } });
  await db.accountMember.create({ data: { accountId, userId, role: 'OWNER' } });
  await db.galleryApplication.create({
    data: {
      id: applicationId,
      userId,
      status: 'APPROVED',
      submittedAt: new Date(),
      decidedAt: new Date(),
      accountId,
      data: { sahip: { eposta } },
    },
  });
  await db.gallery.create({
    data: {
      accountId,
      slug: gallerySlug(ad),
      businessKind: 'DEALER',
      displayName: ad,
      legalName: `${ad} Ltd. Şti.`,
      taxNo: '1234567890',
      taxOffice: 'Kadıköy',
      mersisNo: '0123456789000015',
      il: 'İstanbul',
      ilce: 'Kadıköy',
      address: 'Moda Cad. No: 1',
      plan: 'deneme',
      trialEndsAt: new Date(Date.now() + 10 * DAY),
      applicationId,
      approvedAt: new Date(),
    },
  });
  return { token, accountId, userId, base: `/gallery/${accountId}/subscription` };
}

const form = (url: string, body: Record<string, string>) =>
  app.inject({
    method: 'POST',
    url,
    payload: new URLSearchParams(body).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });

/** Kart sayfası (sahte sağlayıcıda sahte sayfaya yönlenir) ve "kartı kaydet ve öde" */
async function ode(odemeAdresi: string, durum = 'success') {
  const no = odemeAdresi.split('/').pop() as string;
  const kart = await app.inject({ method: 'GET', url: `/odeme/kart/${no}` });
  expect(kart.statusCode).toBe(302);
  expect(kart.headers.location).toBe(`/odeme/sahte/${no}`);
  const r = await form(`/odeme/sahte/${no}`, { durum });
  expect(r.statusCode).toBe(303);
  expect(r.headers.location).toContain('galeri=1');
  return no;
}

const sub = (accountId: string) => db.subscription.findUniqueOrThrow({ where: { accountId } });
/** Dönemi bitmiş gibi göster (işçi yenilemeyi dener) */
const donemBitti = (accountId: string) =>
  db.subscription.update({
    where: { accountId },
    data: { currentPeriodStart: new Date(Date.now() - 31 * DAY), currentPeriodEnd: new Date(Date.now() - 1) },
  });

describe('galeri abonelikleri (Karar 12.2, 12.3, 12.7, 39; Teknik tasarım §7)', () => {
  it('paket alma, kart saklama, üst pakete geçiş, sonraki dönem, otomatik yenileme ve aylık hak döngüsü', async () => {
    const g = await galeri('+905335550001', 'Örnek Oto');
    const o = await call(app, 'GET', g.base, undefined, g.token);
    expect(o.status).toBe(200);
    expect(o.body).toMatchObject({ paket: { key: 'deneme' }, abonelik: null, eposta, odeme: { acik: true } });
    expect(o.body.paketler.map((p: { degisim: string }) => p.degisim)).toEqual(['yeni', 'yeni', 'yeni']);

    // Onaylar zorunlu; yalnızca sahip
    const eksik = await call(
      app,
      'POST',
      `${g.base}/checkout`,
      { plan: 'profesyonel', donem: 'aylik', eposta, onay: { sozlesme: true } },
      g.token,
    );
    expect(eksik.status).toBe(400);
    const baska = await login('+905335550009');
    expect((await call(app, 'GET', g.base, undefined, baska)).status).toBe(404);

    const c = await call(
      app,
      'POST',
      `${g.base}/checkout`,
      { plan: 'profesyonel', donem: 'aylik', eposta, onay },
      g.token,
    );
    expect(c.status).toBe(201);
    expect(c.body.toplamKurus).toBe(418_800); // 3.490 TL + %20 KDV
    expect(c.body.odemeAdresi).toContain('/odeme/kart/');
    const no = await ode(c.body.odemeAdresi);

    const order = await db.order.findUniqueOrThrow({ where: { no } });
    expect(order).toMatchObject({
      status: 'PAID',
      kind: 'abonelik',
      totalKurus: 418_800n,
      vatKurus: 69_800n,
    });
    expect(order.billing).toMatchObject({ kurumsal: { vergiNo: '1234567890' }, eposta });
    let s = await sub(g.accountId);
    expect(s).toMatchObject({ plan: 'profesyonel', period: 'aylik', status: 'ACTIVE', priceKurus: 349_000n });
    expect(s.cardToken).toBeTruthy();
    expect(s.cardToken).not.toContain('sahte-u-'); // şifreli
    expect(order.subscriptionId).toBe(s.id);
    expect((await db.gallery.findUniqueOrThrow({ where: { accountId: g.accountId } })).plan).toBe(
      'profesyonel',
    );
    expect(await hak.balance(g.accountId, 'talep')).toBe(5);
    expect(await hak.balance(g.accountId, 'ust_sira')).toBe(2);
    expect(await subs.refreshCard(g.accountId)).toBe('VISA •••• 4242');
    const rizalar = await db.consent.findMany({ where: { kind: 'abonelik_otomatik_yenileme' } });
    expect(rizalar).toHaveLength(1);

    // Fatura galeri sahibine
    await app.get(OrdersService).issueInvoice(order.id);
    const pdf = await app.inject({
      method: 'GET',
      url: `/orders/${order.id}/invoice`,
      headers: { authorization: `Bearer ${g.token}` },
    });
    expect(pdf.headers['content-type']).toBe('application/pdf');

    // Aynı paketi yeniden almak olmaz; alt paket sonraki dönemde
    const o2 = await call(app, 'GET', g.base, undefined, g.token);
    expect(o2.body.paketler.map((p: { degisim: string }) => p.degisim)).toEqual([
      'sonraki_donem',
      'ayni',
      'yukseltme',
    ]);
    expect(o2.body.abonelik).toMatchObject({ planAd: 'Profesyonel', kart: 'VISA •••• 4242', iptal: false });
    expect(o2.body.faturalar[0]).toMatchObject({ no, tutarKurus: 418_800, fatura: true });
    expect(
      (
        await call(
          app,
          'POST',
          `${g.base}/checkout`,
          { plan: 'baslangic', donem: 'aylik', eposta, onay },
          g.token,
        )
      ).status,
    ).toBe(400);

    // Üst pakete geçiş: kalan süre için fark; bu ayın hak farkı hemen
    await db.subscription.update({
      where: { id: s.id },
      data: {
        currentPeriodStart: new Date(Date.now() - 15 * DAY),
        currentPeriodEnd: new Date(Date.now() + 15 * DAY),
      },
    });
    const y = await call(
      app,
      'POST',
      `${g.base}/checkout`,
      { plan: 'kurumsal', donem: 'aylik', eposta, onay },
      g.token,
    );
    expect(y.status).toBe(201);
    const beklenen = withVat(Math.round((planNetKurus('kurumsal', 'aylik') - 349_000) / 2));
    expect(Math.abs(y.body.toplamKurus - beklenen)).toBeLessThan(100);
    await ode(y.body.odemeAdresi);
    s = await sub(g.accountId);
    expect(s).toMatchObject({ plan: 'kurumsal', priceKurus: 749_000n, quotaCycleNo: 0 });
    expect(await hak.balance(g.accountId, 'talep')).toBe(15);
    expect(await hak.balance(g.accountId, 'ust_sira')).toBe(5);

    // Sonraki dönem yıllık; bir talep hakkı kullanıldı
    const n = await call(app, 'PATCH', `${g.base}/next`, { plan: 'kurumsal', donem: 'yillik' }, g.token);
    expect(n.body.abonelik.sonraki).toMatchObject({ plan: 'kurumsal', donem: 'yillik' });
    expect(n.body.abonelik.yenilemeKurus).toBe(withVat(7_490_000));
    await db.$transaction((tx) =>
      hak.consume(tx, g.accountId, 'talep', { sourceType: 'test', sourceId: uuidv7(), createdBy: g.userId }),
    );
    expect(await hak.balance(g.accountId, 'talep')).toBe(14);
    await new Promise((r) => setTimeout(r, 20)); // kullanım eski döngüde kalsın

    // Dönem sonu: saklı karttan yenileme; kullanılmayan haklar devretmez, yenileri verilir
    const eskiBitis = (await donemBitti(g.accountId)).currentPeriodEnd;
    const r = await subs.renewDue();
    expect(r).toMatchObject({ yenilenen: 1, basarisiz: 0 });
    s = await sub(g.accountId);
    expect(s).toMatchObject({
      plan: 'kurumsal',
      period: 'yillik',
      status: 'ACTIVE',
      nextPeriod: null,
      quotaCycleNo: 1,
    });
    expect(s.currentPeriodStart.getTime()).toBe(eskiBitis.getTime());
    expect(s.currentPeriodEnd.getUTCFullYear()).toBe(eskiBitis.getUTCFullYear() + 1);
    expect(await hak.balance(g.accountId, 'talep')).toBe(15);
    const yenileme = await db.order.findFirstOrThrow({ where: { subscriptionId: s.id, kind: 'yenileme' } });
    expect(yenileme).toMatchObject({
      status: 'PAID',
      channel: 'otomatik',
      totalKurus: BigInt(withVat(7_490_000)),
    });
    expect(await subs.renewDue()).toMatchObject({ yenilenen: 0 }); // ikinci kez çekilmez

    // Yıllıkta haklar her ay yenilenir
    const birAySonra = new Date(Date.now() + 32 * DAY);
    expect(await subs.cycleDue()).toBe(0);
    expect(await subs.cycleDue(birAySonra)).toBe(1);
    expect((await sub(g.accountId)).quotaCycleNo).toBe(2);
    expect(await hak.balance(g.accountId, 'talep')).toBe(15);
    expect(await subs.cycleDue(birAySonra)).toBe(0);

    // Galeri ek paketi: KDV hariç fiyat + KDV, galerinin ticari bilgileriyle fatura
    const fatura = { ad: 'x x x', eposta, il: 'İstanbul', ilce: 'Kadıköy' };
    expect(
      (
        await call(
          app,
          'POST',
          '/orders',
          { hesap: g.accountId, kalemler: [{ urun: 'acil_7' }], fatura, onay: { sozlesme: true } },
          g.token,
        )
      ).status,
    ).toBe(400);
    const ek = await call(
      app,
      'POST',
      '/orders',
      { hesap: g.accountId, kalemler: [{ urun: 'mesaj_30' }], fatura, onay: { sozlesme: true } },
      g.token,
    );
    expect(ek.status).toBe(201);
    expect(ek.body.toplamKurus).toBe(29_880);
    const ekNo = ek.body.no as string;
    await form(`/odeme/sahte/${ekNo}`, { durum: 'success' });
    expect(await hak.balance(g.accountId, 'ilk_mesaj')).toBe(30);
    expect((await db.order.findUniqueOrThrow({ where: { no: ekNo } })).billing).toMatchObject({
      ad: 'Örnek Oto Ltd. Şti.',
    });
    expect(await db.auditLog.count({ where: { action: 'abonelik_yenilendi' } })).toBe(1);
  });

  it('başarısız yenileme 3 gün denenir, sonra askı; elle ödeme, iptal ve yeniden abonelik', async () => {
    // Kartı yenilemede reddedilen galeri
    const g = await galeri('+905335551001', 'Kırmızı Oto');
    const c = await call(
      app,
      'POST',
      `${g.base}/checkout`,
      { plan: 'baslangic', donem: 'aylik', eposta, onay },
      g.token,
    );
    await ode(c.body.odemeAdresi, 'success-red');
    expect(await hak.balance(g.accountId, 'talep')).toBe(2);
    await donemBitti(g.accountId);
    expect(await subs.renewDue()).toMatchObject({ basarisiz: 1 });
    let s = await sub(g.accountId);
    expect(s).toMatchObject({ status: 'PAST_DUE', failCount: 1 });
    expect(s.nextRetryAt?.getTime()).toBeGreaterThan(Date.now());
    expect(await subs.renewDue()).toMatchObject({ basarisiz: 0 }); // ertesi güne kadar denenmez
    // Ödeme beklenirken özellikler açık
    expect((await call(app, 'GET', g.base, undefined, g.token)).body.paket).toMatchObject({
      saltOkunur: false,
    });
    for (const deneme of [2, 3, 4]) {
      await db.subscription.update({
        where: { id: s.id },
        data: { nextRetryAt: new Date(Date.now() - 1000) },
      });
      await subs.renewDue();
      s = await sub(g.accountId);
      expect(s.failCount).toBe(deneme);
    }
    expect(s).toMatchObject({ status: 'ENDED', endReason: 'odeme_alinamadi' });
    expect((await db.gallery.findUniqueOrThrow({ where: { accountId: g.accountId } })).plan).toBe('pasif');
    expect(await hak.balance(g.accountId, 'talep')).toBe(0); // paket hakları düştü
    const pasif = await call(app, 'GET', g.base, undefined, g.token);
    expect(pasif.body.paket).toMatchObject({ key: 'pasif', saltOkunur: true });
    expect(pasif.body.paketler.map((p: { degisim: string }) => p.degisim)).toEqual(['yeni', 'yeni', 'yeni']);
    expect(await db.outboxEvent.count({ where: { type: 'abonelik.odeme_basarisiz' } })).toBe(4);
    // Ek paket alınamaz; portföye araç eklenemez
    expect(
      (
        await call(
          app,
          'POST',
          '/orders',
          {
            hesap: g.accountId,
            kalemler: [{ urun: 'mesaj_10' }],
            fatura: { ad: 'x x x', eposta, il: 'İstanbul', ilce: 'Kadıköy' },
            onay: { sozlesme: true },
          },
          g.token,
        )
      ).status,
    ).toBe(403);

    // Yeniden abonelik: yeni kartla hemen başlar
    const yeni = await call(
      app,
      'POST',
      `${g.base}/checkout`,
      { plan: 'baslangic', donem: 'aylik', eposta, onay },
      g.token,
    );
    await ode(yeni.body.odemeAdresi, 'success-red');
    s = await sub(g.accountId);
    expect(s).toMatchObject({ status: 'ACTIVE', failCount: 0, quotaCycleNo: 1 });
    expect(await hak.balance(g.accountId, 'talep')).toBe(2);

    // Bir kez başarısız; sahip "şimdi öde" ile yeni kart kaydeder, dönem eskisinin bitişinden başlar
    const bitis = (await donemBitti(g.accountId)).currentPeriodEnd;
    await subs.renewDue();
    expect((await sub(g.accountId)).status).toBe('PAST_DUE');
    const p = await call(app, 'POST', `${g.base}/pay`, { eposta, onay }, g.token);
    expect(p.status).toBe(201);
    await ode(p.body.odemeAdresi, 'success');
    s = await sub(g.accountId);
    expect(s).toMatchObject({ status: 'ACTIVE', failCount: 0, nextRetryAt: null });
    expect(s.currentPeriodStart.getTime()).toBe(bitis.getTime());

    // İptal dönem sonunda; geri alınabilir
    const ip = await call(app, 'POST', `${g.base}/cancel`, { iptal: true }, g.token);
    expect(ip.body.abonelik.iptal).toBe(true);
    expect((await call(app, 'POST', `${g.base}/cancel`, { iptal: false }, g.token)).body.abonelik.iptal).toBe(
      false,
    );
    await call(app, 'POST', `${g.base}/cancel`, { iptal: true }, g.token);
    await donemBitti(g.accountId);
    expect(await subs.renewDue()).toMatchObject({ biten: 1, yenilenen: 0 });
    expect(await sub(g.accountId)).toMatchObject({ status: 'ENDED', endReason: 'iptal' });
    expect((await db.gallery.findUniqueOrThrow({ where: { accountId: g.accountId } })).plan).toBe('pasif');
    // Abonelik kaydı silinemez
    await expect(db.subscription.delete({ where: { id: s.id } })).rejects.toThrow();
  });

  it('konsol: ödemeler, abonelikler; kişisel veri yetkisi olmayan kısaltılmış ad görür', async () => {
    const sahip = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
    const destek = (await loginAs(app, await createStaff(db, 'SUPPORT'))).token;
    const u = await login('+905335552001');
    await call(app, 'PATCH', '/me', { firstName: 'Ayşe', lastName: 'Yılmaz' }, u);
    const s = await call(
      app,
      'POST',
      '/orders',
      {
        kalemler: [{ urun: 'mesaj_10' }],
        fatura: { ad: 'Ayşe Yılmaz', eposta: 'ayse@ornek.com', il: 'İstanbul', ilce: 'Kadıköy' },
        onay: { sozlesme: true },
      },
      u,
    );
    await form(`/odeme/sahte/${s.body.no}`, { durum: 'success' });

    const o = await staffCall(app, 'GET', '/staff/payments', undefined, sahip);
    expect(o.status).toBe(200);
    expect(o.body.ozet.etkinAbonelik).toBeGreaterThan(0);
    const satir = o.body.siparisler.find((x: { no: string }) => x.no === s.body.no);
    expect(satir).toMatchObject({ musteri: 'Ayşe Yılmaz', durum: 'PAID', fatura: 'Fatura kuyrukta' });
    expect(o.body.abonelikler.length).toBeGreaterThan(0);
    const d = await staffCall(app, 'GET', '/staff/payments?durum=odendi&tur=bireysel', undefined, destek);
    expect(d.body.siparisler.find((x: { no: string }) => x.no === s.body.no)).toMatchObject({
      musteri: 'Ayşe Y.',
    });
    expect(d.body.siparisler.every((x: { durum: string }) => x.durum === 'PAID')).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/staff/payments' })).statusCode).toBe(401);
  });
});
