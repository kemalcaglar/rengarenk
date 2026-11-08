import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { storeProductId } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENV, type Env } from '../src/config/env.js';
import type { Db } from '../src/database/prisma.js';
import { EntitlementService } from '../src/entitlements/entitlement.service.js';
import { FeatureFlagService } from '../src/flags/feature-flag.service.js';
import { OutboxService } from '../src/outbox/outbox.service.js';
import { OrdersService } from '../src/payments/orders.service.js';
import { StoreService } from '../src/payments/store.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;
let hak: EntitlementService;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
  hak = app.get(EntitlementService);
  const bmw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  const s = await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: bmw.id, name: '3 Serisi', categories: ['otomobil'] },
  });
  await db.catalogModel.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi/320i', makeId: bmw.id, seriesId: s.id, name: '320i' },
  });
});
afterAll(() => app.close());

async function login(phone: string) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  const userId = (await db.user.findUniqueOrThrow({ where: { phone } })).id;
  return { token: v.body.accessToken as string, userId };
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

describe('mağaza ödemeleri (Karar 38)', () => {
  it('niyet, sahte mağaza satışı, öne çıkarma; haklar web ile aynı hesapta; fatura mağazanın', async () => {
    const u = await login('+905336660001');
    const o = await call(app, 'GET', '/orders/overview', undefined, u.token);
    expect(o.body.magaza).toMatchObject({ acik: true });
    expect(o.body.urunler.find((x: { key: string }) => x.key === 'ek_talep')).toMatchObject({
      kurus: 19_900,
      mobilKurus: 23_999,
    });

    const n = await call(app, 'POST', '/store/intents', { urun: 'mesaj_10', platform: 'ios' }, u.token);
    expect(n.status).toBe(201);
    expect(n.body).toMatchObject({ urunKimligi: 'rr_mesaj_10', saglayici: 'fake' });
    const s = await call(app, 'POST', '/store/fake-purchase', { no: n.body.no }, u.token);
    expect(s.body).toMatchObject({ durum: 'islendi', no: n.body.no });
    const siparis = await db.order.findUniqueOrThrow({
      where: { no: n.body.no },
      include: { invoice: true },
    });
    expect(siparis).toMatchObject({ status: 'PAID', channel: 'ios', totalKurus: 11_999n, invoice: null });
    expect(siparis.externalId).toMatch(/^sahte-/);
    expect(await hak.balance(siparis.accountId, 'ilk_mesaj')).toBe(10);
    // Web Haklarım'da da görünür
    expect((await call(app, 'GET', '/orders/overview', undefined, u.token)).body.ekMesaj).toBe(10);

    // Öne çıkarma: talep zorunlu, satışla hemen başlar
    const d = await talep(u.token);
    expect(
      (await call(app, 'POST', '/store/intents', { urun: 'ust_sira_7', platform: 'android' }, u.token))
        .status,
    ).toBe(400);
    const n2 = await call(
      app,
      'POST',
      '/store/intents',
      { urun: 'ust_sira_7', talepNo: d.no, platform: 'android' },
      u.token,
    );
    await call(app, 'POST', '/store/fake-purchase', { no: n2.body.no }, u.token);
    const promo = await db.demandPromotion.findMany({ where: { demandId: d.id } });
    expect(promo.map((p) => p.kind)).toEqual(['ust_sira']);
    expect((await db.order.findUniqueOrThrow({ where: { no: n2.body.no } })).channel).toBe('android');

    // Başkasının siparişi sahte satışla onaylanamaz
    const b = await login('+905336660002');
    const n3 = await call(app, 'POST', '/store/intents', { urun: 'ek_talep', platform: 'ios' }, u.token);
    expect((await call(app, 'POST', '/store/fake-purchase', { no: n3.body.no }, b.token)).status).toBe(404);
  });

  it('RevenueCat bildirimi: imza, aynı olay ve aynı satış bir kez; niyetsiz satış; iade yalnızca kayda geçer', async () => {
    const u = await login('+905336661001');
    const hesap = await app.get(OrdersService).personal(u.userId);
    const env = app.get<Env>(ENV);
    const rc = new StoreService(
      db,
      { ...env, STORE_PROVIDER: 'revenuecat', REVENUECAT_WEBHOOK_AUTH: 'g'.repeat(32) },
      app.get(OrdersService),
      app.get(FeatureFlagService),
      app.get(OutboxService),
    );
    const olay = (ek: Record<string, unknown> = {}) => ({
      id: uuidv7(),
      type: 'NON_RENEWING_PURCHASE',
      app_user_id: u.userId,
      product_id: storeProductId('talep_paketi'),
      transaction_id: `200000${Math.floor(Math.random() * 1e9)}`,
      store: 'APP_STORE',
      environment: 'PRODUCTION',
      price_in_purchased_currency: 599.99,
      currency: 'TRY',
      ...ek,
    });
    await expect(rc.webhook('yanlis', { event: olay() })).rejects.toThrow();
    // Niyet kaydı olmadan gelen satış da işlenir
    const e1 = olay();
    expect(await rc.webhook(`Bearer ${'g'.repeat(32)}`, { event: e1 })).toMatchObject({ result: 'islendi' });
    expect(await hak.balance(hesap, 'talep')).toBe(3);
    // Aynı olay ve aynı satış (farklı olay kimliği) yeniden: hak eklenmez
    expect(await rc.handle('revenuecat', e1)).toMatchObject({ result: 'islendi', no: null });
    expect(await rc.handle('revenuecat', { ...e1, id: uuidv7() })).toMatchObject({ result: 'yok_sayildi' });
    expect(await hak.balance(hesap, 'talep')).toBe(3);
    const satis = await db.order.findUniqueOrThrow({ where: { externalId: e1.transaction_id } });
    expect(satis).toMatchObject({ status: 'PAID', totalKurus: 59_999n });
    expect(await db.payment.findFirst({ where: { orderId: satis.id } })).toMatchObject({ provider: 'apple' });

    // Talep seçilmeden alınan öne çıkarma: hak tanımlanır, incelemeye düşer
    const e2 = olay({ product_id: storeProductId('acil_7') });
    expect(await rc.handle('revenuecat', e2)).toMatchObject({ result: 'inceleme' });
    expect(await hak.balance(hesap, 'acil')).toBe(1);

    // Tanınmayan ürün
    expect(await rc.handle('revenuecat', olay({ product_id: 'baska_urun' }))).toMatchObject({
      result: 'inceleme',
    });

    // Mağaza iadesi: yalnızca kaydedilir ve sahibe iletilir; hak düşülmez
    const iade = olay({
      type: 'CANCELLATION',
      cancel_reason: 'CUSTOMER_SUPPORT',
      transaction_id: e1.transaction_id,
    });
    expect(await rc.handle('revenuecat', iade)).toMatchObject({ result: 'inceleme' });
    expect(await hak.balance(hesap, 'talep')).toBe(3);
    const kayit = await db.storeEvent.findUniqueOrThrow({ where: { eventId: iade.id } });
    expect(kayit).toMatchObject({ result: 'inceleme', orderId: satis.id });
    expect(await db.outboxEvent.count({ where: { type: 'magaza.iade_bildirimi' } })).toBe(1);
    expect(await db.refund.count()).toBe(0);
    // Mağaza bildirimi değiştirilemez
    await expect(
      db.storeEvent.update({ where: { id: kayit.id }, data: { result: 'islendi' } }),
    ).rejects.toThrow();
  });
});
