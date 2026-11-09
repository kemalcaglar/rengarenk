import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENV, type Env } from '../src/config/env.js';
import type { Db } from '../src/database/prisma.js';
import { EntitlementService } from '../src/entitlements/entitlement.service.js';
import { FeatureFlagService } from '../src/flags/feature-flag.service.js';
import { MemoryEmail } from '../src/notifications/channels.js';
import { ContractMailService } from '../src/payments/contract-mail.service.js';
import { OrdersService } from '../src/payments/orders.service.js';
import { FakePayment, PaymentProviderFactory } from '../src/payments/providers.js';
import { DemandSearchService } from '../src/search/demand-search.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;
let fake: FakePayment;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
  fake = app.get(PaymentProviderFactory).get() as FakePayment;
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
  return v.body.accessToken as string;
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

const fatura = { ad: 'Ayşe Yılmaz', eposta: 'ayse@ornek.com', il: 'İstanbul', ilce: 'Kadıköy' };
const form = (url: string, body: Record<string, string>) =>
  app.inject({
    method: 'POST',
    url,
    payload: new URLSearchParams(body).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });

describe('web ödemeleri (Karar 12, 31, 39; Teknik tasarım §7)', () => {
  it('sipariş, onaylar, sahte ödeme sayfası, bildirim bir kez işlenir; haklar, öne çıkarma ve fatura', async () => {
    const t = await login('+905334440001');
    const d = await talep(t);
    const o = await call(app, 'GET', '/orders/overview', undefined, t);
    expect(o.body).toMatchObject({ odeme: { acik: true }, ekMesaj: 0, talepler: [{ no: d.no }] });
    expect(o.body.urunler).toHaveLength(9);

    // Onaylar: sözleşme zorunlu; hemen başlayan hizmette ikinci onay; öne çıkarma kendi yayındaki talebine
    expect(
      (
        await call(
          app,
          'POST',
          '/orders',
          { kalemler: [{ urun: 'mesaj_10' }], fatura, onay: { sozlesme: false } },
          t,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await call(
          app,
          'POST',
          '/orders',
          { kalemler: [{ urun: 'ust_sira_7', talepNo: d.no }], fatura, onay: { sozlesme: true } },
          t,
        )
      ).status,
    ).toBe(400);
    const baska = await login('+905334440002');
    expect(
      (
        await call(
          app,
          'POST',
          '/orders',
          {
            kalemler: [{ urun: 'ust_sira_7', talepNo: d.no }],
            fatura,
            onay: { sozlesme: true, cayma: true },
          },
          baska,
        )
      ).status,
    ).toBe(400);

    const s = await call(
      app,
      'POST',
      '/orders',
      {
        kalemler: [
          { urun: 'mesaj_10' },
          { urun: 'ust_sira_7', talepNo: d.no },
          { urun: 'acil_7', talepNo: d.no },
        ],
        fatura,
        onay: { sozlesme: true, cayma: true },
      },
      t,
    );
    expect(s.status).toBe(201);
    expect(s.body).toMatchObject({
      toplamKurus: 32_700,
      odemeAdresi: expect.stringContaining('/odeme/sahte/'),
    });
    const no = s.body.no as string;
    expect(no).toMatch(/^[A-Z0-9]+$/);
    const siparis = await db.order.findUniqueOrThrow({ where: { no } });
    expect(siparis).toMatchObject({ status: 'PENDING', totalKurus: 32_700n, vatKurus: 5450n });
    expect(siparis.preInfo).toContain('Üst sıra · 7 gün');
    const rizalar = await db.consent.findMany({
      where: { kind: { in: ['on_bilgilendirme', 'mesafeli_sozlesme', 'cayma_hemen_baslat'] } },
    });
    expect(rizalar.map((r) => r.kind).sort()).toEqual([
      'cayma_hemen_baslat',
      'mesafeli_sozlesme',
      'on_bilgilendirme',
    ]);

    // Sahte ödeme sayfası ve "başarılı"
    const sayfa = await app.inject({ method: 'GET', url: `/odeme/sahte/${no}` });
    expect(sayfa.body).toContain('SAHTE ÖDEME');
    const gonder = await form(`/odeme/sahte/${no}`, { durum: 'success' });
    expect(gonder.statusCode).toBe(303);
    expect(gonder.headers.location).toContain(`/haklarim/odeme-sonucu?siparis=${no}`);
    expect((await call(app, 'GET', `/orders/${no}`, undefined, t)).body).toMatchObject({ durum: 'PAID' });
    expect((await call(app, 'GET', `/orders/${no}`, undefined, baska)).status).toBe(404);

    const hesap = siparis.accountId;
    const hak = app.get(EntitlementService);
    expect(await hak.balance(hesap, 'ilk_mesaj')).toBe(10);
    expect(await hak.balance(hesap, 'ust_sira')).toBe(0); // satın alındı ve hemen kullanıldı
    const promo = await db.demandPromotion.findMany({ where: { demandId: d.id } });
    expect(promo.map((p) => p.kind).sort()).toEqual(['acil', 'ust_sira']);

    // Aynı bildirim yeniden: "OK", yeni hak yok; bozuk imza reddedilir
    const govde = fake.notification(no, 'success', 32_700);
    const tekrar = await form('/odeme/bildirim', govde);
    expect(tekrar.statusCode).toBe(200);
    expect(tekrar.body).toBe('OK');
    expect(await hak.balance(hesap, 'ilk_mesaj')).toBe(10);
    expect(await db.payment.count({ where: { orderId: siparis.id } })).toBe(2);
    expect((await form('/odeme/bildirim', { ...govde, hash: 'bozuk' })).statusCode).toBe(400);
    // Ödeme bildirimi değiştirilemez
    await expect(db.payment.deleteMany({ where: { orderId: siparis.id } })).rejects.toThrow();

    // Fatura (sahte e-Arşiv) ve ödeme geçmişi
    await app.get(OrdersService).issueInvoice(siparis.id);
    const pdf = await app.inject({
      method: 'GET',
      url: `/orders/${siparis.id}/invoice`,
      headers: { authorization: `Bearer ${t}` },
    });
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body.startsWith('%PDF')).toBe(true);
    // Ön bilgilendirme formu ve sözleşme PDF'i fatura e-postasına (Karar 39); bir kez
    await db.consentText.create({
      data: {
        id: uuidv7(),
        key: 'mesafeli_sozlesme',
        version: 1,
        title: 'Mesafeli hizmet sözleşmesi',
        body: [
          '1. **Taraflar:** hizmet sağlayıcı ve tüketici.',
          '    - alt madde',
          '2. **Bedel:** tüm vergiler dahil.',
        ].join(String.fromCharCode(10)),
      },
    });
    const eposta = new MemoryEmail();
    const sozlesme = new ContractMailService(db, app.get<Env>(ENV), eposta);
    expect(await sozlesme.gonder(siparis.id)).toBe('gonderildi');
    expect(await sozlesme.gonder(siparis.id)).toBe('zaten');
    expect(eposta.sent).toHaveLength(1);
    expect(eposta.sent[0]?.to).toBe('ayse@ornek.com');
    expect(eposta.sent[0]?.attachments?.map((a) => a.filename)).toEqual([
      `on-bilgilendirme-formu-${no}.pdf`,
      `mesafeli-hizmet-sozlesmesi-${no}.pdf`,
    ]);
    for (const a of eposta.sent[0]?.attachments ?? [])
      expect((a.content as Buffer).subarray(0, 4).toString()).toBe('%PDF');
    expect((await db.order.findUniqueOrThrow({ where: { id: siparis.id } })).contractSentAt).not.toBeNull();

    const g = await call(app, 'GET', '/orders/overview', undefined, t);
    expect(g.body.ekMesaj).toBe(10);
    expect(g.body.gecmis[0]).toMatchObject({ no, tutarKurus: 32_700, fatura: true });
    expect(g.body.aktifOneCikarma.map((a: { tur: string }) => a.tur).sort()).toEqual(['acil', 'ust_sira']);

    // Arama: üst sıra önce, acil etiketi
    const arama = app.get(DemandSearchService);
    const diger = await talep(baska);
    await arama.sync(d.id, true);
    await arama.sync(diger.id, true);
    const liste = await call(app, 'GET', '/talepler');
    expect(liste.body.sonuclar[0]).toMatchObject({ no: d.no, ustSira: true, acil: true });
    expect(liste.body.sonuclar.find((x: { no: number }) => x.no === diger.no)).toMatchObject({ acil: false });
    expect(await db.auditLog.count({ where: { action: 'odeme_alindi' } })).toBe(1);
  });

  it('başarısız ödeme, tutar uyuşmazlığı ve ödeme bakımı', async () => {
    const t = await login('+905334441001');
    const yeni = async () =>
      (
        await call(
          app,
          'POST',
          '/orders',
          { kalemler: [{ urun: 'ek_talep' }], fatura, onay: { sozlesme: true } },
          t,
        )
      ).body.no as string;
    const no1 = await yeni();
    await form(`/odeme/sahte/${no1}`, { durum: 'failed' });
    expect((await call(app, 'GET', `/orders/${no1}`, undefined, t)).body).toMatchObject({ durum: 'FAILED' });
    const hesap = (await db.order.findUniqueOrThrow({ where: { no: no1 } })).accountId;
    expect(await app.get(EntitlementService).balance(hesap, 'talep')).toBe(0);

    const no2 = await yeni();
    expect((await form('/odeme/bildirim', fake.notification(no2, 'success', 100))).body).toBe('OK');
    expect((await call(app, 'GET', `/orders/${no2}`, undefined, t)).body).toMatchObject({ durum: 'FAILED' });
    expect(await db.outboxEvent.count({ where: { type: 'odeme.uyusmazlik' } })).toBe(1);

    await db.featureFlag.create({ data: { key: 'bakim.odeme', enabled: true, note: 'Ödemeler bakımda' } });
    await app.get(FeatureFlagService).invalidate();
    const kapali = await call(
      app,
      'POST',
      '/orders',
      { kalemler: [{ urun: 'ek_talep' }], fatura, onay: { sozlesme: true } },
      t,
    );
    expect(kapali.status).toBe(503);
    expect((await call(app, 'GET', '/orders/overview', undefined, t)).body.odeme).toMatchObject({
      acik: false,
    });
    // Bakımda da ödeme bildirimi alınır
    expect((await form('/odeme/bildirim', fake.notification(no2, 'success', 1000))).statusCode).toBe(200);
  });
});
