import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StaffRole } from '@rengarenk/db';
import { ROLE_GRANTS } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Actor, ApprovalService } from '../src/approvals/approval.service.js';
import { ApprovalExecutor } from '../src/approvals/approval-executor.js';
import type { Db } from '../src/database/prisma.js';
import { createTestApp } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;
let approvals: ApprovalService;
let executor: ApprovalExecutor;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
  approvals = app.get(ApprovalService);
  executor = app.get(ApprovalExecutor);
});
afterAll(() => app.close());

const pgCode = (e: unknown) => String((e as Error)?.message).match(/Code: `(RR0\d\d)`/)?.[1];

/** Konsola girmiş bir çalışan: oturum jetonu ve onay motoruna verilecek kimlik. */
async function member(role: Exclude<StaffRole, 'CUSTOM' | 'CATALOG'>) {
  const staff = await createStaff(db, role);
  const actor: Actor = { staff, grants: ROLE_GRANTS[role] };
  return { staff, actor, token: (await loginAs(app, staff)).token };
}

const coupon = {
  kind: 'COUPON' as const,
  subjectType: 'coupon',
  subjectId: 'GALERI30',
  title: 'GALERI30 · %30',
};

describe('dört göz onay motoru (Teknik tasarım §11, Karar 40)', () => {
  it('istek yalnızca yetkili rolden açılır; isteyen kendi isteğini onaylayamaz, yönetici onaylar', async () => {
    const marketing = await member('MARKETING');
    const viewer = await member('VIEWER');
    const admin = await member('ADMIN');

    await expect(approvals.request(viewer.actor, coupon)).rejects.toThrow('istek açma yetkin yok');
    const a = await approvals.request(marketing.actor, { ...coupon, reason: 'İlk ay kampanyası' });
    expect(a.status).toBe('PENDING');
    expect(a.expiresAt?.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);

    // İsteyen onay kuyruğunda kendi isteğini görmez, karara bağlayamaz.
    const own = await staffCall(app, 'POST', `/staff/approvals/${a.id}/approve`, {}, marketing.token);
    expect(own.status).toBe(403);
    const mine = await staffCall(app, 'GET', '/staff/approvals?kapsam=benim', undefined, marketing.token);
    expect(mine.body.map((x: { id: string }) => x.id)).toContain(a.id);

    const queue = await staffCall(app, 'GET', '/staff/approvals', undefined, admin.token);
    const item = queue.body.find((x: { id: string }) => x.id === a.id);
    expect(item.canDecide).toBe(true);
    expect(item.rule).toBe('Kupon oluşturma onay ister.');

    const ok = await staffCall(
      app,
      'POST',
      `/staff/approvals/${a.id}/approve`,
      { note: 'uygun' },
      admin.token,
    );
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('APPROVED');
    expect(ok.body.decidedBy).toBe(admin.staff.id);

    const twice = await staffCall(app, 'POST', `/staff/approvals/${a.id}/reject`, {}, admin.token);
    expect(twice.status).toBe(409);
    expect(
      await db.outboxEvent.count({
        where: { type: 'onay.onaylandi', payload: { path: ['approvalId'], equals: a.id } },
      }),
    ).toBe(1);
    expect(
      await db.auditLog.count({
        where: { entityId: a.id, action: { in: ['onay_istendi', 'onay_onaylandi'] } },
      }),
    ).toBe(2);
  });

  it('fiyat değişikliğini yalnızca Sahip onaylar; Sahip kendi isteğini de onaylayabilir', async () => {
    const finance = await member('FINANCE');
    const admin = await member('ADMIN');
    const owner = await member('OWNER');
    const price = {
      kind: 'PRICE_CHANGE' as const,
      subjectType: 'package',
      subjectId: 'baslangic',
      title: 'Başlangıç 499 → 549 TL',
    };

    const a = await approvals.request(finance.actor, price);
    expect((await staffCall(app, 'POST', `/staff/approvals/${a.id}/approve`, {}, admin.token)).status).toBe(
      403,
    );
    expect((await staffCall(app, 'POST', `/staff/approvals/${a.id}/approve`, {}, owner.token)).status).toBe(
      200,
    );

    const b = await approvals.request(owner.actor, price);
    expect((await staffCall(app, 'POST', `/staff/approvals/${b.id}/approve`, {}, owner.token)).status).toBe(
      200,
    );
  });

  it('toplu gönderim: Pazarlama önerir, Yönetici onaylar ama kendisi istek açamaz', async () => {
    const marketing = await member('MARKETING');
    const admin = await member('ADMIN');
    const bulk = {
      kind: 'BULK_SEND' as const,
      subjectType: 'campaign',
      subjectId: 'c1',
      title: 'SMS · 4.820 kişi',
    };
    await expect(approvals.request(admin.actor, bulk)).rejects.toThrow();
    const a = await approvals.request(marketing.actor, bulk);
    expect((await staffCall(app, 'POST', `/staff/approvals/${a.id}/approve`, {}, admin.token)).status).toBe(
      200,
    );
  });

  it('iade: önerilir, yalnızca Sahip onaylar; motor iade kaydı oluşturmaz ve yürütmez', async () => {
    const support = await member('SUPPORT');
    const admin = await member('ADMIN');
    const owner = await member('OWNER');
    const refund = {
      kind: 'REFUND' as const,
      subjectType: 'payment',
      subjectId: 'pay_42',
      title: 'Can T. · 10 ek ilk mesaj · 99 TL',
      amountKurus: 9900n,
    };
    await expect(approvals.request(support.actor, { ...refund, amountKurus: undefined })).rejects.toThrow(
      'tutar',
    );
    await expect(approvals.request(support.actor, { ...refund, subjectType: 'order' })).rejects.toThrow();

    const a = await approvals.request(support.actor, refund);
    expect((await staffCall(app, 'POST', `/staff/approvals/${a.id}/approve`, {}, admin.token)).status).toBe(
      403,
    );
    const ok = await staffCall(app, 'POST', `/staff/approvals/${a.id}/approve`, {}, owner.token);
    expect(ok.status).toBe(200);
    expect(ok.body.amountKurus).toBe('9900');

    expect(await executor.execute(a.id)).toBe('atlandi');
    expect(() => executor.register('REFUND', async () => ({}))).toThrow();
    expect(await db.refund.count({ where: { approvalId: a.id } })).toBe(0);

    // Veritabanı kilidi aynen çalışır: Sahip onayı olan istek için iade kaydı yalnızca tutar eşleşirse açılır.
    const err = await db.refund
      .create({ data: { id: crypto.randomUUID(), paymentId: 'pay_42', amountKurus: 1n, approvalId: a.id } })
      .catch((e) => e);
    expect(pgCode(err)).toBe('RR015');
  });

  it('kalıcı engelleme: ajan önerir, moderatör onaylar; ajan hiçbir isteği onaylayamaz', async () => {
    const agentStaff = await createStaff(db, 'AGENT');
    const agent: Actor = { staff: agentStaff, grants: ROLE_GRANTS.AGENT };
    const moderator = await member('MODERATOR');
    const a = await approvals.request(agent, {
      kind: 'PERMANENT_BAN',
      subjectType: 'account',
      subjectId: 'acc_kaya',
      title: 'Kaya Motors · kalıcı kapatma',
    });
    expect(approvals.canDecide(agent, a)).toBe(false);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: a.id, action: 'onay_istendi' } });
    expect(audit.actorType).toBe('AGENT');
    expect(
      (await staffCall(app, 'POST', `/staff/approvals/${a.id}/approve`, {}, moderator.token)).status,
    ).toBe(200);
  });

  it('süresi dolan istek karara bağlanamaz; isteyen geri çekebilir', async () => {
    const marketing = await member('MARKETING');
    const owner = await member('OWNER');
    const a = await approvals.request(marketing.actor, coupon);
    await db.approval.update({ where: { id: a.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const late = await staffCall(app, 'POST', `/staff/approvals/${a.id}/approve`, {}, owner.token);
    expect(late.status).toBe(409);
    expect((await db.approval.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('EXPIRED');

    const b = await approvals.request(marketing.actor, coupon);
    await db.approval.update({ where: { id: b.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await approvals.expireDue()).toBeGreaterThanOrEqual(1);
    expect((await db.approval.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('EXPIRED');

    const c = await approvals.request(marketing.actor, coupon);
    expect(
      (await staffCall(app, 'POST', `/staff/approvals/${c.id}/cancel`, undefined, owner.token)).status,
    ).toBe(403);
    expect(
      (await staffCall(app, 'POST', `/staff/approvals/${c.id}/cancel`, undefined, marketing.token)).status,
    ).toBe(204);
    expect((await db.approval.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('CANCELLED');
  });

  it('onaylanan işlem bir kez yürütülür, hata kaydedilir; sonuçlar değiştirilemez', async () => {
    const marketing = await member('MARKETING');
    const owner = await member('OWNER');
    const calls: string[] = [];
    let fail = true;
    executor.register('COUPON', async (a) => {
      calls.push(a.id);
      if (fail) throw new Error('kupon servisi yanıt vermedi');
      return { kupon: a.subjectId };
    });

    const a = await approvals.request(marketing.actor, coupon);
    expect(await executor.execute(a.id)).toBe('atlandi'); // henüz onaylanmadı
    await approvals.decide(owner.actor, a.id, 'approve');

    await expect(executor.execute(a.id)).rejects.toThrow('yanıt vermedi');
    fail = false;
    expect(await executor.execute(a.id)).toBe('yurutuldu');
    expect(await executor.execute(a.id)).toBe('zaten_yurutuldu');
    expect(calls).toHaveLength(2);

    const results = await db.approvalResult.findMany({ where: { approvalId: a.id }, orderBy: { id: 'asc' } });
    expect(results.map((r) => r.outcome)).toEqual(['FAILED', 'SUCCEEDED']);
    const err = await db.approvalResult
      .update({ where: { id: results[0]?.id }, data: { outcome: 'SUCCEEDED' } })
      .catch((e) => e);
    expect(pgCode(err)).toBe('RR001');
  });

  it('özel rol hiçbir isteği onaylayamaz', async () => {
    const role = await db.staffCustomRole.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Kampanya lideri',
        permissions: { 'kampanya.hazirla': 'tam' },
        createdBy: (await createStaff(db, 'OWNER')).id,
      },
    });
    const custom = await createStaff(db, 'CUSTOM', { customRoleId: role.id });
    const marketing = await member('MARKETING');
    const a = await approvals.request(marketing.actor, coupon);
    const actor: Actor = { staff: custom, grants: { 'kampanya.hazirla': 'tam' } };
    expect(approvals.canDecide(actor, a)).toBe(false);
  });
});
