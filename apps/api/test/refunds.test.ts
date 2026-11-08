import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { gallerySlug } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApprovalExecutor } from '../src/approvals/approval-executor.js';
import { AuditService } from '../src/audit/audit.service.js';
import type { Db } from '../src/database/prisma.js';
import { EntitlementService } from '../src/entitlements/entitlement.service.js';
import { OutboxService } from '../src/outbox/outbox.service.js';
import { OrdersService } from '../src/payments/orders.service.js';
import { SubscriptionBilling } from '../src/payments/subscription-billing.js';
import { RefundExecutorService } from '../src/refunds/executor/refund-executor.service.js';
import { FakeRefund } from '../src/refunds/executor/refund-gateway.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;
let hak: EntitlementService;
let fake: FakeRefund;
let yurutucu: RefundExecutorService;
let sahip: string;
let finans: string;
let yonetici: string;
let izleyici: string;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
  hak = app.get(EntitlementService);
  fake = new FakeRefund();
  yurutucu = new RefundExecutorService(
    db,
    fake,
    app.get(AuditService),
    app.get(OutboxService),
    app.get(SubscriptionBilling),
  );
  sahip = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
  finans = (await loginAs(app, await createStaff(db, 'FINANCE'))).token;
  yonetici = (await loginAs(app, await createStaff(db, 'ADMIN'))).token;
  izleyici = (await loginAs(app, await createStaff(db, 'VIEWER'))).token;
});
afterAll(() => app.close());

async function login(phone: string) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  return v.body.accessToken as string;
}

const form = (url: string, body: Record<string, string>) =>
  app.inject({
    method: 'POST',
    url,
    payload: new URLSearchParams(body).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });

const fatura = { ad: 'Ayşe Yılmaz', eposta: 'ayse@ornek.com', il: 'İstanbul', ilce: 'Kadıköy' };

/** Web siparişi, sahte ödemeyle ödenir */
async function satinAl(token: string, urun: string) {
  const s = await call(
    app,
    'POST',
    '/orders',
    { kalemler: [{ urun }], fatura, onay: { sozlesme: true } },
    token,
  );
  await form(`/odeme/sahte/${s.body.no}`, { durum: 'success' });
  return db.order.findUniqueOrThrow({ where: { no: s.body.no } });
}

async function onayla(tutarKurus?: number) {
  const q = await staffCall(app, 'GET', '/staff/approvals', undefined, sahip);
  const a = (q.body as { id: string; kind: string }[]).find((x) => x.kind === 'REFUND');
  if (!a) throw new Error('bekleyen iade yok');
  return staffCall(app, 'POST', `/staff/approvals/${a.id}/approve`, tutarKurus ? { tutarKurus } : {}, sahip);
}

describe('iade akışı (Karar 39, 40; Teknik tasarım §7, dört kilit)', () => {
  it('öneri, oranlı tutar, yalnızca Sahip onayı (tutarı düşürebilir), yürütme ve kalan hakkın düşmesi', async () => {
    const t = await login('+905338880001');
    const o = await satinAl(t, 'mesaj_10');
    expect(o.status).toBe('PAID');

    expect((await staffCall(app, 'GET', `/staff/refunds/quote/${o.id}`, undefined, izleyici)).status).toBe(
      403,
    );
    let q = await staffCall(app, 'GET', `/staff/refunds/quote/${o.id}`, undefined, finans);
    expect(q.body).toMatchObject({ onerilenKurus: 9_900, enFazlaKurus: 9_900, iadeEdilemez: null });
    // 3 mesaj kullanıldı: kalan 7'nin oranlı karşılığı
    for (let i = 0; i < 3; i++) {
      await db.$transaction((tx) =>
        hak.consume(tx, o.accountId, 'ilk_mesaj', {
          sourceType: 'test',
          sourceId: uuidv7(),
          createdBy: o.userId,
        }),
      );
    }
    q = await staffCall(app, 'GET', `/staff/refunds/quote/${o.id}`, undefined, finans);
    expect(q.body.onerilenKurus).toBe(6_930);
    expect(q.body.kalemler[0].not).toContain('3 / 10 kullanıldı');

    // Fazla tutar istenemez; istek Onay kuyruğuna düşer, ikinci istek açılamaz
    const fazla = { siparis: o.id, tutarKurus: 10_000, neden: 'Kullanıcı cayma hakkını kullandı' };
    expect((await staffCall(app, 'POST', '/staff/refunds', fazla, finans)).status).toBe(400);
    const r = await staffCall(app, 'POST', '/staff/refunds', { ...fazla, tutarKurus: 6_930 }, finans);
    expect(r.status).toBe(201);
    expect(
      (await staffCall(app, 'POST', '/staff/refunds', { ...fazla, tutarKurus: 100 }, finans)).status,
    ).toBe(409);

    // Onaylanmadan yürütülmez; yönetici onaylayamaz; Sahip artıramaz, düşürebilir
    expect(await yurutucu.runOnce()).toBe(0);
    const a = await db.approval.findUniqueOrThrow({ where: { id: r.body.onayId } });
    expect((await staffCall(app, 'POST', `/staff/approvals/${a.id}/approve`, {}, yonetici)).status).toBe(403);
    // Kilit 1: onaylanmamış istekle iade kaydı veritabanında açılamaz
    await expect(
      db.refund.create({
        data: { id: uuidv7(), paymentId: a.subjectId, amountKurus: 6_930n, approvalId: a.id },
      }),
    ).rejects.toThrow();
    expect((await onayla(8_000)).status).toBe(400);
    expect((await onayla(5_000)).status).toBe(200);
    expect(await db.approval.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({
      status: 'APPROVED',
      amountKurus: 5_000n,
    });

    // Yürütücü: ödeme kuruluşuna onaylanan tutar gider; kalan hak düşer; iade faturası kuyrukta
    expect(await yurutucu.runOnce()).toBe(1);
    expect(fake.calls.at(-1)).toMatchObject({ oid: o.no, amountKurus: 5_000 });
    const iade = await db.refund.findUniqueOrThrow({
      where: { approvalId: a.id },
      include: { invoice: true },
    });
    expect(iade).toMatchObject({ status: 'EXECUTED', amountKurus: 5_000n, orderId: o.id });
    expect(iade.invoice).toMatchObject({ status: 'PENDING' });
    expect(await hak.balance(o.accountId, 'ilk_mesaj')).toBe(0);
    expect(await yurutucu.runOnce()).toBe(0); // bir kez
    await app.get(OrdersService).issueRefundInvoice(iade.id);
    expect((await db.refundInvoice.findUniqueOrThrow({ where: { refundId: iade.id } })).status).toBe(
      'ISSUED',
    );

    const g = await call(app, 'GET', '/orders/overview', undefined, t);
    expect(g.body.gecmis[0]).toMatchObject({ no: o.no, iadeKurus: 5_000 });
    const k = await staffCall(app, 'GET', '/staff/payments', undefined, sahip);
    expect(k.body.siparisler.find((x: { no: string }) => x.no === o.no)).toMatchObject({
      durumAd: 'Kısmi iade',
      iadeEdilebilir: true,
    });
    const liste = await staffCall(app, 'GET', '/staff/refunds', undefined, sahip);
    expect(liste.body[0]).toMatchObject({
      siparis: o.no,
      durum: 'EXECUTED',
      fatura: 'İade faturası kesildi',
    });
    // Kalan tutardan fazlası istenemez
    q = await staffCall(app, 'GET', `/staff/refunds/quote/${o.id}`, undefined, finans);
    expect(q.body).toMatchObject({ iadeEdilenKurus: 5_000, enFazlaKurus: 4_900 });
    expect(await db.auditLog.count({ where: { action: 'iade_yurutuldu' } })).toBe(1);
  });

  it('ödeme kuruluşu reddederse iade başarısız; sonucu belirsizse yeniden denenmez', async () => {
    const t = await login('+905338881001');
    const o1 = await satinAl(t, 'ek_talep');
    await staffCall(
      app,
      'POST',
      '/staff/refunds',
      { siparis: o1.id, tutarKurus: 19_900, neden: 'Yanlış ürün aldı' },
      finans,
    );
    await onayla();
    fake.failNext = 'failed';
    expect(await yurutucu.runOnce()).toBe(1);
    const r1 = await db.refund.findFirstOrThrow({ where: { orderId: o1.id } });
    expect(r1).toMatchObject({ status: 'FAILED' });
    expect(await hak.balance(o1.accountId, 'talep')).toBe(1); // hak düşmedi
    expect(await yurutucu.runOnce()).toBe(0);

    const o2 = await satinAl(t, 'mesaj_30');
    await staffCall(
      app,
      'POST',
      '/staff/refunds',
      { siparis: o2.id, tutarKurus: 24_900, neden: 'Yanlış ürün aldı' },
      finans,
    );
    await onayla();
    fake.failNext = 'unknown';
    await yurutucu.runOnce();
    const r2 = await db.refund.findFirstOrThrow({ where: { orderId: o2.id } });
    expect(r2.status).toBe('PENDING_EXECUTION');
    expect(r2.failReason).toContain('belirsiz');
    expect(await yurutucu.runOnce()).toBe(0);
    expect(await db.outboxEvent.count({ where: { type: 'iade.belirsiz' } })).toBe(1);
  });

  it('yıllık paket 14 gün içinde ve kullanılmadıysa tam iade; iade yürütülünce abonelik biter', async () => {
    const phone = '+905338882001';
    const token = await login(phone);
    const userId = (await db.user.findUniqueOrThrow({ where: { phone } })).id;
    const accountId = uuidv7();
    const applicationId = uuidv7();
    await db.account.create({
      data: { id: accountId, kind: 'BUSINESS', name: 'Batı Oto', businessKind: 'DEALER' },
    });
    await db.accountMember.create({ data: { accountId, userId, role: 'OWNER' } });
    await db.galleryApplication.create({
      data: {
        id: applicationId,
        userId,
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
        slug: gallerySlug('Batı Oto'),
        businessKind: 'DEALER',
        displayName: 'Batı Oto',
        legalName: 'Batı Oto Ltd. Şti.',
        taxNo: '1234567890',
        taxOffice: 'Kadıköy',
        mersisNo: '0123456789000015',
        il: 'İstanbul',
        ilce: 'Kadıköy',
        address: 'Moda Cad. No: 1',
        plan: 'deneme',
        trialEndsAt: new Date(Date.now() + 86_400_000),
        applicationId,
        approvedAt: new Date(),
      },
    });
    const c = await call(
      app,
      'POST',
      `/gallery/${accountId}/subscription/checkout`,
      { plan: 'baslangic', donem: 'yillik', eposta: 'a@b.com', onay: { sozlesme: true, yenileme: true } },
      token,
    );
    const no = (c.body.odemeAdresi as string).split('/').pop() as string;
    await form(`/odeme/sahte/${no}`, { durum: 'success' });
    const o = await db.order.findUniqueOrThrow({ where: { no } });
    const q = await staffCall(app, 'GET', `/staff/refunds/quote/${o.id}`, undefined, finans);
    expect(q.body.onerilenKurus).toBe(Number(o.totalKurus));
    await staffCall(
      app,
      'POST',
      '/staff/refunds',
      { siparis: o.id, tutarKurus: Number(o.totalKurus), neden: 'Yıllık paket, 14 gün içinde vazgeçti' },
      finans,
    );
    await onayla();
    expect(await yurutucu.runOnce()).toBe(1);
    expect(await db.subscription.findUniqueOrThrow({ where: { accountId } })).toMatchObject({
      status: 'ENDED',
      endReason: 'iade',
    });
    expect((await db.gallery.findUniqueOrThrow({ where: { accountId } })).plan).toBe('pasif');
    expect(await hak.balance(accountId, 'talep')).toBe(0);
  });

  it('kilit 2: iade ucu yalnızca iade yürütücü sürecinde; onay yürütücüsü iade yapamaz', () => {
    expect(() => app.get(ApprovalExecutor).register('REFUND', async () => ({}))).toThrow();
    const src = fileURLToPath(new URL('../src', import.meta.url));
    const dosyalar: string[] = [];
    const gez = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) gez(p);
        else if (p.endsWith('.ts')) dosyalar.push(p);
      }
    };
    gez(src);
    const izinli = (p: string) => {
      const r = relative(src, p).replaceAll('\\', '/');
      return r === 'refund-executor.ts' || r.startsWith('refunds/executor/');
    };
    const ihlal = dosyalar.filter(
      (p) => !izinli(p) && /from '[^']*(refunds\/executor|refund-gateway)/.test(readFileSync(p, 'utf8')),
    );
    expect(ihlal).toEqual([]);
    // Ödeme kuruluşunun iade adresi yalnızca yürütücüde geçer
    const adres = dosyalar.filter((p) => !izinli(p) && readFileSync(p, 'utf8').includes('odeme/iade'));
    expect(adres).toEqual([]);
  });
});
