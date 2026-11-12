import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AJAN_EPOSTA } from '../src/approvals/agent-actor.js';
import { AuditService } from '../src/audit/audit.service.js';
import type { Db } from '../src/database/prisma.js';
import { EntitlementService } from '../src/entitlements/entitlement.service.js';
import { OutboxService } from '../src/outbox/outbox.service.js';
import { SubscriptionBilling } from '../src/payments/subscription-billing.js';
import { RefundExecutorService } from '../src/refunds/executor/refund-executor.service.js';
import { FakeRefund } from '../src/refunds/executor/refund-gateway.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, uyeOl } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;
let hak: EntitlementService;
let sahip: string;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
  hak = app.get(EntitlementService);
  sahip = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
  const bmw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  const s = await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: bmw.id, name: '3 Serisi', categories: ['otomobil'] },
  });
  await db.catalogModel.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi/320i', makeId: bmw.id, seriesId: s.id, name: '320i' },
  });
});
afterAll(() => app.close());

async function login(phone: string, ad: [string, string]) {
  const v = { body: await uyeOl(app, phone) };
  const token = v.body.accessToken as string;
  await call(app, 'PATCH', '/me', { firstName: ad[0], lastName: ad[1] }, token);
  const userId = (await db.user.findUniqueOrThrow({ where: { phone }, select: { id: true } })).id;
  return { token, userId };
}

async function kod(phone: string, token: string) {
  await db.otpChallenge.updateMany({ where: { phone }, data: { createdAt: new Date(Date.now() - 120_000) } });
  // Hassas işlem onayı (Karar 58): kod kişinin kendi numarasına, oturumla istenir
  const r = await call(app, 'POST', '/auth/code', {}, token);
  return { challengeId: r.body?.challengeId as string, code: sms.lastCode(phone) as string };
}

const fatura = { ad: 'Ayşe Yılmaz', eposta: 'ayse@ornek.com', il: 'İstanbul', ilce: 'Kadıköy' };
async function satinAl(token: string, urun: string) {
  const s = await call(
    app,
    'POST',
    '/orders',
    { kalemler: [{ urun }], fatura, onay: { sozlesme: true } },
    token,
  );
  await app.inject({
    method: 'POST',
    url: `/odeme/sahte/${s.body.no}`,
    payload: 'durum=success',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  return db.order.findUniqueOrThrow({ where: { no: s.body.no } });
}

async function talep(token: string) {
  const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, token);
  const data = {
    alanlar: {
      model: { make: 'bmw', series: 'bmw/3-serisi', model: 'bmw/3-serisi/320i' },
      konum: { il: 'İstanbul', ilce: 'Kadıköy' },
      aciklama: 'Bakımlı, hasarsız arıyorum.',
    },
    alternatifler: [{ butce: { min: 2_000_000, max: 2_500_000 }, yil: { min: 2019, max: 2023 } }],
  };
  await call(app, 'PATCH', `/demands/${d.body.id}`, { data, step: 6 }, token);
  const p = await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, token);
  expect(p.body).toMatchObject({ no: expect.any(Number) });
  return { id: d.body.id as string, no: p.body.no as number };
}

describe('hesap kapatma (Karar 31, 39, 59; sahip kararı 9 Kasım 2026)', () => {
  it('SMS koduyla kapanır, veri anonimleşir, iade yalnızca öneri olarak Sahip’e düşer', async () => {
    const tel = '+905334440001';
    const ayse = await login(tel, ['Ayşe', 'Yılmaz']);
    const o = await satinAl(ayse.token, 'mesaj_10');
    for (let i = 0; i < 6; i++) {
      await db.$transaction((tx) =>
        hak.consume(tx, o.accountId, 'ilk_mesaj', {
          sourceType: 'test',
          sourceId: uuidv7(),
          createdBy: ayse.userId,
        }),
      );
    }
    // Satın alınmamış hak (çalışanın tanımladığı 2 ek talep) iade edilmez; iade yalnızca kalan 4 ilk mesaj
    await db.entitlementLedger.create({
      data: {
        accountId: o.accountId,
        kind: 'talep',
        delta: 2,
        reason: 'tanimlama',
        sourceType: 'staff_grant',
        sourceId: uuidv7(),
        createdBy: ayse.userId,
      },
    });
    const p = await call(app, 'GET', '/me/close', undefined, ayse.token);
    expect(p.body).toMatchObject({
      engel: null,
      iade: { satirlar: [{ ad: '4 ek ilk mesaj', tutarKurus: 3_960 }], toplamKurus: 3_960 },
    });

    expect(
      (
        await call(
          app,
          'POST',
          '/me/close',
          { challengeId: '01a1bcbc-0000-7000-8000-000000000000', code: '123456' },
          ayse.token,
        )
      ).status,
    ).toBe(401);
    const r = await call(
      app,
      'POST',
      '/me/close',
      { ...(await kod(tel, ayse.token)), neden: 'buldum' },
      ayse.token,
    );
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ kapandi: true, iadeKurus: 3_960, iadeIstegi: 1 });

    // Anonimleşme: ad, e-posta, telefon gider; oturumlar kapanır; kimlik kaydı şifreli kalır
    const u = await db.user.findUniqueOrThrow({ where: { id: ayse.userId } });
    expect(u).toMatchObject({ status: 'CLOSED', firstName: null, lastName: null, email: null });
    expect(u.phone).toBe(`kapali:${ayse.userId}`);
    expect(await db.session.count({ where: { userId: ayse.userId, revokedAt: null } })).toBe(0);
    const k = await db.accountClosure.findUniqueOrThrow({ where: { userId: ayse.userId } });
    expect(k.reason).toBe('buldum');
    expect(k.phoneEnc).toBeTruthy();
    expect(k.phoneEnc).not.toContain('5334440001');
    expect(k.refundKurus).toBe(3_960n);
    expect(k.keepIdentityUntil.getTime() - k.closedAt.getTime()).toBeGreaterThan(4.9 * 365 * 86_400_000);
    await expect(db.accountClosure.delete({ where: { id: k.id } })).rejects.toThrow();
    expect(await db.auditLog.count({ where: { action: 'hesap_kapatildi', entityId: ayse.userId } })).toBe(1);
    expect(await db.outboxEvent.count({ where: { type: 'hesap.kapatildi' } })).toBe(1);

    // İade: ajan öneri açar, para iadesi yok; yalnızca Sahip onaylar, yürütücü yapar
    const a = await db.approval.findFirstOrThrow({
      where: { kind: 'REFUND', subjectType: 'payment' },
      include: { requester: true },
    });
    expect(a).toMatchObject({ status: 'PENDING', amountKurus: 3_960n });
    expect(a.requester).toMatchObject({ email: AJAN_EPOSTA, role: 'AGENT' });
    expect(a.title).toContain('Hesap kapatma iadesi');
    expect(await db.refund.count()).toBe(0);
    const yurutucu = new RefundExecutorService(
      db,
      new FakeRefund(),
      app.get(AuditService),
      app.get(OutboxService),
      app.get(SubscriptionBilling),
    );
    expect(await yurutucu.runOnce()).toBe(0);
    expect((await staffCall(app, 'POST', `/staff/approvals/${a.id}/approve`, {}, sahip)).status).toBe(200);
    expect(await yurutucu.runOnce()).toBe(1);
    expect(await db.refund.findFirstOrThrow({ where: { approvalId: a.id } })).toMatchObject({
      status: 'EXECUTED',
      amountKurus: 3_960n,
    });
    expect(await hak.balance(o.accountId, 'ilk_mesaj')).toBe(0);

    // İkinci kapatma olmaz (numara artık bu hesaba ait değil); aynı numara yeni üye olarak dönebilir
    expect((await call(app, 'POST', '/me/close', await kod(tel, ayse.token), ayse.token)).status).toBe(401);
    await db.otpChallenge.updateMany({
      where: { phone: tel },
      data: { createdAt: new Date(Date.now() - 120_000) },
    });
    const yeni = await login(tel, ['Ayşe', 'Yılmaz']);
    expect(yeni.userId).not.toBe(ayse.userId);
  });

  it('galeri sahibi buradan kapatamaz; kapanan alıcının talebi kapanır, satıcıya "Kapatılmış hesap" görünür', async () => {
    const tel = '+905334440002';
    const can = await login(tel, ['Can', 'Ak']);
    const galeri = uuidv7();
    await db.account.create({
      data: {
        id: galeri,
        kind: 'BUSINESS',
        name: 'Ak Otomotiv',
        businessKind: 'DEALER',
        members: { create: { userId: can.userId, role: 'OWNER' } },
      },
    });
    const p = await call(app, 'GET', '/me/close', undefined, can.token);
    expect(p.body.engel).toContain('Galeri hesabının sahibi');
    expect((await call(app, 'POST', '/me/close', await kod(tel, can.token), can.token)).status).toBe(409);
    expect((await db.user.findUniqueOrThrow({ where: { id: can.userId } })).status).toBe('ACTIVE');

    // Kapanan alıcının talebi kapanır; satıcı "Kapatılmış hesap" görür ve yazamaz
    const aliciTel = '+905334440003';
    const alici = await login(aliciTel, ['Deniz', 'Kaya']);
    const t = await talep(alici.token);
    const satici = await login('+905334440004', ['Mehmet', 'Demir']);
    const ilk = await call(
      app,
      'POST',
      `/talepler/${t.no}/mesaj`,
      { metin: 'Merhaba, aracım var.' },
      satici.token,
    );
    expect(ilk.status).toBe(201);
    const c = ilk.body.id as string;
    expect(
      (await call(app, 'POST', `/conversations/${c}/messages`, { metin: 'Bakalım' }, alici.token)).status,
    ).toBe(201);
    expect((await call(app, 'POST', '/me/close', await kod(aliciTel, alici.token), alici.token)).status).toBe(
      200,
    );
    expect(await db.demand.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({
      status: 'CLOSED',
      headline: null,
    });
    expect(
      await db.outboxEvent.count({
        where: { type: 'talep.kapandi', payload: { path: ['demandId'], equals: t.id } },
      }),
    ).toBe(1);
    const d = await call(app, 'GET', `/conversations/${c}`, undefined, satici.token);
    expect(d.body).toMatchObject({ karsi: { ad: 'Kapatılmış hesap' }, kapali: true, yazabilir: false });
    const liste = await call(app, 'GET', '/conversations', undefined, satici.token);
    expect(liste.body.find((x: { id: string }) => x.id === c).ad).toBe('Kapatılmış hesap');
    expect(
      (await call(app, 'POST', `/conversations/${c}/messages`, { metin: 'Merhaba' }, satici.token)).status,
    ).toBe(409);
  });
});
