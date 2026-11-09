import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { DEFAULT_BADGE_THRESHOLDS, DEFAULT_PRICE_BOOK, type PriceBook } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApprovalExecutor } from '../src/approvals/approval-executor.js';
import type { Db } from '../src/database/prisma.js';
import { NotificationService } from '../src/notifications/notification.service.js';
import { NotificationEvents } from '../src/notifications/notification-events.js';
import { PricingService } from '../src/pricing/pricing.service.js';
import { DemandSearchService } from '../src/search/demand-search.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { TrustService } from '../src/trust/trust.service.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
});
afterAll(() => app.close());

const DAY = 86_400_000;
const gun = (n: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() + n * DAY));

describe('Kurallar ve fiyatlar (Karar 47, 56)', () => {
  it('fiyat değişikliği Sahip onayıyla zamanlanır; yürürlük tarihine kadar eski fiyat geçerli', async () => {
    const owner = await loginAs(app, await createStaff(db, 'OWNER'));
    const admin = await loginAs(app, await createStaff(db, 'ADMIN'));
    const destek = await loginAs(app, await createStaff(db, 'SUPPORT'));
    const pricing = app.get(PricingService);

    const o = await staffCall(app, 'GET', '/staff/pricing', undefined, admin.token);
    expect(o.body.yururlukte.baslangic).toBe(true);
    expect(o.body.yururlukte.kitap.paketler.profesyonel.aylik).toBe(3490);

    const yeni: PriceBook = structuredClone(DEFAULT_PRICE_BOOK);
    yeni.paketler.profesyonel.aylik = 3990;
    yeni.paketler.profesyonel.portfoy = 120;
    yeni.urunler.ek_talep = 219;
    // Rozet eşikleri aynı listeyle değişir (Karar 55, 56)
    yeni.rozetler = { ...DEFAULT_BADGE_THRESHOLDS, hizliDakika: 30, guvenOrtalama: 4.6 };
    // Destek fiyat değiştiremez; geçmiş tarih ve geçersiz liste reddedilir
    expect(
      (await staffCall(app, 'POST', '/staff/pricing', { kitap: yeni, yururluk: gun(10) }, destek.token))
        .status,
    ).toBe(403);
    expect(
      (await staffCall(app, 'POST', '/staff/pricing', { kitap: yeni, yururluk: gun(0) }, admin.token)).status,
    ).toBe(400);
    const ucuz = structuredClone(yeni);
    ucuz.paketler.kurumsal.aylik = 3000;
    expect(
      (await staffCall(app, 'POST', '/staff/pricing', { kitap: ucuz, yururluk: gun(10) }, admin.token))
        .status,
    ).toBe(400);

    const g = await staffCall(
      app,
      'POST',
      '/staff/pricing',
      { kitap: yeni, yururluk: gun(10), not: 'Yıllık zam' },
      admin.token,
    );
    expect(g.status).toBe(200);
    const d = g.body.degisiklikler[0];
    expect(d.durum).toBe('onay_bekliyor');
    expect(d.degisiklikler).toEqual([
      'Profesyonel · Aylık fiyat: 3.490 TL → 3.990 TL',
      'Profesyonel · Portföy araç sınırı: 100 → 120',
      'Ek talep hakkı · 1 adet: 199 TL → 219 TL',
      'Hızlı yanıt · ortanca ilk yanıt: 60 → 30',
      'Güvenilir satıcı · yıldız ortalaması: 4,5 → 4,6',
    ]);
    // Aynı anda ikinci öneri açılmaz
    expect(
      (await staffCall(app, 'POST', '/staff/pricing', { kitap: yeni, yururluk: gun(12) }, admin.token))
        .status,
    ).toBe(409);

    // Yönetici onaylayamaz; Sahip onaylar, işçi zamanlar
    const r = await db.priceBook.findUniqueOrThrow({ where: { id: d.id } });
    const approvalId = r.approvalId as string;
    expect(
      (await staffCall(app, 'POST', `/staff/approvals/${approvalId}/approve`, {}, admin.token)).status,
    ).toBe(403);
    expect(
      (await staffCall(app, 'POST', `/staff/approvals/${approvalId}/approve`, {}, owner.token)).status,
    ).toBe(200);
    expect(await app.get(ApprovalExecutor).execute(approvalId)).toBe('yurutuldu');
    expect(await db.outboxEvent.count({ where: { type: 'fiyat.zamanlandi' } })).toBe(1);
    // Profesyonel aylık abonesi olan galeriye duyuru gider (yenilemeye kadar eski fiyat)
    const sahip = await db.user.create({ data: { id: uuidv7(), phone: '+905329990009' } });
    const accountId = uuidv7();
    await db.account.create({
      data: { id: accountId, kind: 'BUSINESS', name: 'Fiyat Oto', businessKind: 'DEALER' },
    });
    await db.accountMember.create({ data: { accountId, userId: sahip.id, role: 'OWNER' } });
    await db.subscription.create({
      data: {
        id: uuidv7(),
        accountId,
        userId: sahip.id,
        plan: 'profesyonel',
        period: 'aylik',
        priceKurus: 349_000n,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * DAY),
        quotaCycleStart: new Date(),
        billingEmail: 'fatura@fiyat.com',
      },
    });
    const olay = await db.outboxEvent.findFirstOrThrow({ where: { type: 'fiyat.zamanlandi' } });
    const ol = new NotificationEvents(db, app.get(NotificationService), app.get(DemandSearchService));
    expect(await ol.handle('fiyat.zamanlandi', olay.payload as Record<string, unknown>)).toBeGreaterThan(0);
    const b = await db.notification.findFirstOrThrow({
      where: { userId: sahip.id, sablon: 'fiyat.degisiyor' },
    });
    expect(b.baslik).toContain('Profesyonel paket fiyatı');
    expect(b.metin).toContain('3.990');
    const z = await staffCall(app, 'GET', '/staff/pricing', undefined, admin.token);
    expect(z.body.degisiklikler[0].durum).toBe('zamanlandi');

    // Yürürlükten önce eski fiyat: alıcının ürün listesi
    const phone = '+905329990001';
    const rq = await call(app, 'POST', '/auth/otp/request', { phone });
    const t = (
      await call(app, 'POST', '/auth/otp/verify', {
        challengeId: rq.body.challengeId,
        code: sms.lastCode(phone),
        consents: SIGNUP_CONSENTS,
      })
    ).body.accessToken as string;
    pricing.forget();
    const once = await call(app, 'GET', '/orders/overview', undefined, t);
    expect(once.body.urunler.find((u: { key: string }) => u.key === 'ek_talep').kurus).toBe(19_900);

    // Yürürlük günü gelince yeni fiyat (paket tablosu ve ürün)
    await db.priceBook.update({ where: { id: d.id }, data: { effectiveAt: new Date(Date.now() - 1000) } });
    pricing.forget();
    const sonra = await call(app, 'GET', '/orders/overview', undefined, t);
    expect(sonra.body.urunler.find((u: { key: string }) => u.key === 'ek_talep').kurus).toBe(21_900);
    const rozet = await app.get(TrustService).kurallar();
    expect(rozet.hizli.ortancaDakika).toBe(30);
    expect(rozet.guven.enAzOrtalama).toBe(4.6);
    expect((await pricing.plans()).profesyonel).toMatchObject({
      aylik: 3990,
      portfoy: 120,
      ad: 'Profesyonel',
    });
    const s2 = await staffCall(app, 'GET', '/staff/pricing', undefined, admin.token);
    expect(s2.body.yururlukte.baslangic).toBe(false);
    expect(s2.body.degisiklikler[0].durum).toBe('yururlukte');
    // Yürürlüğe girmiş değişiklik iptal edilmez
    expect((await staffCall(app, 'POST', `/staff/pricing/${d.id}/cancel`, {}, owner.token)).status).toBe(409);
    expect(await db.auditLog.count({ where: { action: 'fiyat_zamanlandi', entityId: d.id } })).toBe(1);
  });
});
