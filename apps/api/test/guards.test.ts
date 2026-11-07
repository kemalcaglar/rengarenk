import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { EntitlementService } from '../src/entitlements/entitlement.service.js';
import { createTestApp } from './helpers.js';

let app: NestFastifyApplication;
let db: Db;
let ent: EntitlementService;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
  ent = app.get(EntitlementService);
});
afterAll(() => app.close());

/** Prisma hatasındaki veritabanı hata kodu (tetikleyicilerin RR0xx kodları). */
const pgCode = (e: unknown) => String((e as Error)?.message).match(/Code: `(RR0\d\d)`/)?.[1];

async function staff(role: 'OWNER' | 'ADMIN' | 'AGENT') {
  return db.staffMember.create({
    data: { id: uuidv7(), email: `${uuidv7()}@rengarenk.local`, name: role, role },
  });
}

async function approval(decider: { id: string }, requester: { id: string }, amount = 17999n, hoursAgo = 1) {
  const a = await db.approval.create({
    data: {
      id: uuidv7(),
      kind: 'REFUND',
      subjectType: 'payment',
      subjectId: 'pay_1',
      amountKurus: amount,
      requestedBy: requester.id,
    },
  });
  await db.approval.update({
    where: { id: a.id },
    data: {
      status: 'APPROVED',
      decidedBy: decider.id,
      decidedAt: new Date(Date.now() - hoursAgo * 3600_000),
    },
  });
  return a;
}

describe('iade kilidi (veritabanı)', () => {
  it('Sahip onayı olmadan iade kaydı oluşturulamaz', async () => {
    const admin = await staff('ADMIN');
    const a = await approval(admin, admin);
    const err = await db.refund
      .create({ data: { id: uuidv7(), paymentId: 'pay_1', amountKurus: 17999n, approvalId: a.id } })
      .catch((e) => e);
    expect(pgCode(err)).toBe('RR013');
  });

  it('72 saatten eski onayla iade yapılamaz', async () => {
    const owner = await staff('OWNER');
    const agent = await staff('AGENT');
    const a = await approval(owner, agent, 17999n, 73);
    const err = await db.refund
      .create({ data: { id: uuidv7(), paymentId: 'pay_1', amountKurus: 17999n, approvalId: a.id } })
      .catch((e) => e);
    expect(pgCode(err)).toBe('RR014');
  });

  it('tutar onaydakinden farklıysa iade yapılamaz', async () => {
    const owner = await staff('OWNER');
    const a = await approval(owner, owner);
    const err = await db.refund
      .create({ data: { id: uuidv7(), paymentId: 'pay_1', amountKurus: 99999n, approvalId: a.id } })
      .catch((e) => e);
    expect(pgCode(err)).toBe('RR015');
  });

  it('Sahip onayıyla iade oluşur ve yürütülür; sonradan tutarı değiştirilemez, silinemez', async () => {
    const owner = await staff('OWNER');
    const a = await approval(owner, owner);
    const r = await db.refund.create({
      data: { id: uuidv7(), paymentId: 'pay_1', amountKurus: 17999n, approvalId: a.id },
    });
    await db.refund.update({ where: { id: r.id }, data: { status: 'EXECUTED', executedAt: new Date() } });
    expect(
      pgCode(await db.refund.update({ where: { id: r.id }, data: { amountKurus: 1n } }).catch((e) => e)),
    ).toBe('RR010');
    expect(pgCode(await db.refund.delete({ where: { id: r.id } }).catch((e) => e))).toBe('RR001');
  });

  it('karara bağlanmış onay değiştirilemez', async () => {
    const owner = await staff('OWNER');
    const a = await approval(owner, owner);
    const err = await db.approval.update({ where: { id: a.id }, data: { amountKurus: 1n } }).catch((e) => e);
    expect(pgCode(err)).toBe('RR020');
  });
});

describe('hak defteri', () => {
  it('aynı ödeme iki kez işlenirse hak bir kez tanımlanır; bakiye bitince kullanım reddedilir', async () => {
    const account = await db.account.create({ data: { id: uuidv7(), kind: 'INDIVIDUAL', name: 'test' } });
    const src = { sourceType: 'order', sourceId: 'ord_1', createdBy: 'system' };
    expect(await ent.grant(account.id, 'ust_sira', 1, 'satin_alma', src)).toBe(true);
    expect(await ent.grant(account.id, 'ust_sira', 1, 'satin_alma', src)).toBe(false);
    expect(await ent.balance(account.id, 'ust_sira')).toBe(1);

    await db.$transaction((tx) =>
      ent.consume(tx, account.id, 'ust_sira', { sourceType: 'demand', sourceId: 'd1', createdBy: 'u' }),
    );
    expect(await ent.balance(account.id, 'ust_sira')).toBe(0);
    await expect(
      db.$transaction((tx) =>
        ent.consume(tx, account.id, 'ust_sira', { sourceType: 'demand', sourceId: 'd2', createdBy: 'u' }),
      ),
    ).rejects.toThrow();
  });

  it('eş zamanlı iki kullanım aynı hakkı iki kez harcayamaz', async () => {
    const account = await db.account.create({ data: { id: uuidv7(), kind: 'INDIVIDUAL', name: 'test' } });
    await ent.grant(account.id, 'ilk_mesaj', 1, 'tanimlama', {
      sourceType: 'staff_grant',
      sourceId: account.id,
      createdBy: 'x',
    });
    const tries = await Promise.allSettled(
      ['m1', 'm2'].map((id) =>
        db.$transaction((tx) =>
          ent.consume(tx, account.id, 'ilk_mesaj', { sourceType: 'message', sourceId: id, createdBy: 'u' }),
        ),
      ),
    );
    expect(tries.filter((t) => t.status === 'fulfilled')).toHaveLength(1);
    expect(await ent.balance(account.id, 'ilk_mesaj')).toBe(0);
  });

  it('defter ve işlem kaydı değiştirilemez', async () => {
    const row = await db.entitlementLedger.findFirstOrThrow();
    expect(
      pgCode(
        await db.entitlementLedger.update({ where: { id: row.id }, data: { delta: 99 } }).catch((e) => e),
      ),
    ).toBe('RR001');
    const log = await db.auditLog.create({
      data: { actorType: 'SYSTEM', action: 't', entityType: 'x', entityId: '1' },
    });
    expect(pgCode(await db.auditLog.delete({ where: { id: log.id } }).catch((e) => e))).toBe('RR001');
  });
});
