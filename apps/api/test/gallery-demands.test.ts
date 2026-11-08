import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { gallerySlug } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { EntitlementService } from '../src/entitlements/entitlement.service.js';
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
  return v.body.accessToken as string;
}

/** Profesyonel paketli galeri: bu ayın paket hakları (5 talep, 2 üst sıra) */
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
      data: {},
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
      plan: 'profesyonel',
      applicationId,
      approvedAt: new Date(),
    },
  });
  for (const [kind, delta] of [
    ['talep', 5],
    ['ust_sira', 2],
  ] as const) {
    await db.entitlementLedger.create({
      data: {
        accountId,
        kind,
        delta,
        reason: 'paket',
        sourceType: 'package_cycle',
        sourceId: `test:${accountId}`,
        createdBy: userId,
      },
    });
  }
  return { token, accountId, userId };
}

const data = {
  alanlar: {
    model: { make: 'bmw', series: 'bmw/3-serisi', model: 'bmw/3-serisi/320i' },
    konum: { il: 'İstanbul', ilce: 'Kadıköy' },
  },
  alternatifler: [{ butce: { min: 2_000_000, max: 2_500_000 }, yil: { min: 2019, max: 2023 } }],
};

describe('galeri adına talep (Karar 12.2, 20)', () => {
  it('paketin talep hakkıyla yayın, galeri adı, hakla öne çıkarma; satış temsilcisi açamaz', async () => {
    const g = await galeri('+905337770001', 'Kuzey Oto');
    const r = await call(app, 'GET', `/demands/rights?hesap=${g.accountId}`, undefined, g.token);
    expect(r.body).toMatchObject({ talep: 5, ucretsizTalep: false, galeri: 'Kuzey Oto' });

    const d = await call(app, 'POST', '/demands', { kategori: 'otomobil', hesap: g.accountId }, g.token);
    expect(d.status).toBe(201);
    await call(app, 'PATCH', `/demands/${d.body.id}`, { data, step: 6 }, g.token);
    const p = await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, g.token);
    expect(p.status).toBe(200);
    expect(await hak.balance(g.accountId, 'talep')).toBe(4);
    // Kişinin ücretsiz talep hakkı galeri talebinde kullanılmaz
    expect((await call(app, 'GET', '/demands/rights', undefined, g.token)).body).toMatchObject({
      ucretsizTalep: true,
    });
    const dem = await db.demand.findUniqueOrThrow({ where: { id: d.body.id } });
    expect(dem).toMatchObject({ accountId: g.accountId, entitlement: 'paket' });

    const pub = await call(app, 'GET', `/talepler/${p.body.no}`);
    expect(pub.body.owner).toMatchObject({ name: 'Kuzey Oto', galeri: { ad: 'Kuzey Oto' } });
    const mine = await call(app, 'GET', '/demands/mine', undefined, g.token);
    expect(mine.body.items[0]).toMatchObject({
      galeri: { ad: 'Kuzey Oto' },
      oneCikarmaHakki: { ust_sira: 2 },
    });

    // Paketin üst sıra hakkıyla 7 gün öne çıkarma; hak bitince 409
    const o = await call(app, 'POST', `/demands/${d.body.id}/promote`, { tur: 'ust_sira' }, g.token);
    expect(o.status).toBe(201);
    expect(await hak.balance(g.accountId, 'ust_sira')).toBe(1);
    await call(app, 'POST', `/demands/${d.body.id}/promote`, { tur: 'ust_sira' }, g.token);
    const promo = await db.demandPromotion.findMany({
      where: { demandId: d.body.id },
      orderBy: { startsAt: 'asc' },
    });
    expect(promo).toHaveLength(2);
    expect(promo[1]?.startsAt.getTime()).toBe(promo[0]?.endsAt.getTime()); // ardına eklenir
    expect(
      (await call(app, 'POST', `/demands/${d.body.id}/promote`, { tur: 'ust_sira' }, g.token)).status,
    ).toBe(409);
    expect((await call(app, 'POST', `/demands/${d.body.id}/promote`, { tur: 'acil' }, g.token)).status).toBe(
      409,
    );

    // Satış temsilcisi galeri adına talep açamaz; başka galerinin hesabı kullanılamaz
    const sTel = '+905337770002';
    const st = await login(sTel);
    const sId = (await db.user.findUniqueOrThrow({ where: { phone: sTel } })).id;
    await db.accountMember.create({ data: { accountId: g.accountId, userId: sId, role: 'SALES' } });
    expect(
      (await call(app, 'POST', '/demands', { kategori: 'otomobil', hesap: g.accountId }, st)).status,
    ).toBe(403);
    const baska = await login('+905337770003');
    expect(
      (await call(app, 'POST', '/demands', { kategori: 'otomobil', hesap: g.accountId }, baska)).status,
    ).toBe(404);

    // Galeri ek paketinde üst sıra hak olarak alınır (talep seçmeden)
    const ek = await call(
      app,
      'POST',
      '/orders',
      {
        hesap: g.accountId,
        kalemler: [{ urun: 'ust_sira_7' }, { urun: 'ek_talep' }],
        fatura: { ad: 'x x x', eposta: 'a@b.com', il: 'İstanbul', ilce: 'Kadıköy' },
        onay: { sozlesme: true },
      },
      g.token,
    );
    expect(ek.status).toBe(201);
    await app.inject({
      method: 'POST',
      url: `/odeme/sahte/${ek.body.no}`,
      payload: 'durum=success',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(await hak.balance(g.accountId, 'ust_sira')).toBe(1);
    expect(await hak.balance(g.accountId, 'talep')).toBe(5);

    // Galerinin kendi talebine kendi adına mesaj atılamaz
    const panel = await call(app, 'GET', `/gallery/${g.accountId}`, undefined, g.token);
    expect(panel.body.haklar).toMatchObject({ talep: 5, ustSira: 1, buDonemTalep: 1 });
  });

  it('paketi olmayan galeri adına talep açılamaz', async () => {
    const g = await galeri('+905337771001', 'Güney Oto');
    await db.gallery.update({ where: { accountId: g.accountId }, data: { plan: 'pasif' } });
    expect(
      (await call(app, 'POST', '/demands', { kategori: 'otomobil', hesap: g.accountId }, g.token)).status,
    ).toBe(403);
  });
});
