import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AnalyticsService, trGun } from '../src/analytics/analytics.service.js';
import type { Db } from '../src/database/prisma.js';
import { createTestApp } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;
let analitik: AnalyticsService;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
  analitik = app.get(AnalyticsService);
  const make = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  const series = await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: make.id, name: '3 Serisi', categories: ['otomobil'] },
  });
  await db.catalogModel.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi/320i', makeId: make.id, seriesId: series.id, name: '320i' },
  });
});
afterAll(() => app.close());

const ziyaret = (ip: string, ua = 'Mozilla/5.0 (Windows NT 10.0)') =>
  app.inject({ method: 'POST', url: '/analitik/ziyaret', remoteAddress: ip, headers: { 'user-agent': ua } });
const ara = (q: Record<string, unknown>, ip: string) =>
  app.inject({
    method: 'POST',
    url: '/talepler/arama',
    payload: q,
    remoteAddress: ip,
    headers: { 'user-agent': 'Mozilla/5.0' },
  });

/** Arama sayımı yanıtı bekletmez; Redis'e düşene kadar bekle */
async function aramaBekle(alan: string, n: number) {
  for (let i = 0; i < 50; i++) {
    await analitik.aktar();
    const r = await db.searchLogDaily.findFirst({
      where: { makeKey: alan.split('|')[0], seriesKey: alan.split('|')[1] ?? '' },
    });
    if ((r?.count ?? 0) >= n) return r?.count;
    await new Promise((x) => setTimeout(x, 100));
  }
  return 0;
}

describe('web analitiği ve arama günlüğü (Raporlar › Huni, modeller)', () => {
  it('çerezsiz günlük tekil ziyaretçi ve sayfa görüntüleme; botlar sayılmaz; huninin başında', async () => {
    const sahip = await loginAs(app, await createStaff(db, 'OWNER'));
    // Ölçüm başlamadan huni eski notu gösterir
    const once = await staffCall(app, 'GET', '/staff/reports/huni?tarih=30', undefined, sahip.token);
    expect(once.body.ziyaretNotu).toContain('veri toplamaya başlayınca');

    expect((await ziyaret('10.2.0.1')).statusCode).toBe(204);
    await ziyaret('10.2.0.1');
    await ziyaret('10.2.0.2');
    await ziyaret('10.2.0.3', 'Mozilla/5.0 (Linux) HeadlessChrome/120');
    await ziyaret('10.2.0.4', 'Googlebot/2.1');
    await analitik.aktar();
    const gun = await db.webTrafficDaily.findUniqueOrThrow({
      where: { day: new Date(`${trGun()}T00:00:00.000Z`) },
    });
    expect(gun).toMatchObject({ visitors: 2, pageviews: 3 });
    // Redis sıfırlansa da veritabanındaki büyük değer korunur
    await analitik.aktar();
    expect((await db.webTrafficDaily.findFirstOrThrow()).visitors).toBe(2);

    // Kişisel veri yok: IP ya da tarayıcı veritabanına yazılmaz
    const satir = JSON.stringify(await db.webTrafficDaily.findMany());
    expect(satir).not.toContain('10.2.0');

    await db.user.create({ data: { id: uuidv7(), phone: '+905551230001' } });
    const h = await staffCall(app, 'GET', '/staff/reports/huni?tarih=30', undefined, sahip.token);
    expect(h.body.ust).toBe('2 tekil ziyaretçi. Çubuk uzunluğu üyeliğe göre oran.');
    expect(h.body.ziyaretNotu).toBe('');
    expect(h.body.huni[0]).toMatchObject({ ad: 'Üyelik', not: expect.stringMatching(/· ziyaretten$/) });
  });

  it('marka ve seri araması kişi başına günde bir; metinden model; liste çağrısı sayılmaz; En çok aranan modeller', async () => {
    const sahip = await loginAs(app, await createStaff(db, 'OWNER'));
    expect((await ara({ marka: 'bmw', seri: ['bmw/3-serisi'] }, '10.3.0.1')).statusCode).toBe(204);
    await ara({ marka: 'bmw', seri: 'bmw/3-serisi', yilMin: 2019 }, '10.3.0.1');
    await ara({ marka: 'bmw', seri: 'bmw/3-serisi' }, '10.3.0.3');
    await ara({ q: 'bmw 320i otomatik' }, '10.3.0.4');
    await ara({ q: 'kırmızı araba' }, '10.3.0.5');
    // Liste çağrısı (sunucu tarafı, benzer talepler) sayılmaz
    await app.inject({ method: 'GET', url: '/talepler?marka=bmw', remoteAddress: '10.3.0.6' });
    expect(await aramaBekle('bmw|bmw/3-serisi', 3)).toBe(3);
    expect(await db.searchLogDaily.count()).toBe(1);

    // Rapor: modelin talebi olunca arama sütunu dolar
    const kullanici = await db.user.create({ data: { id: uuidv7(), phone: '+905551230002' } });
    const kategori = await db.category.findFirstOrThrow({ where: { slug: 'otomobil' } });
    const accountId = (
      await db.account.create({ data: { id: uuidv7(), kind: 'INDIVIDUAL', name: 'Deneme' } })
    ).id;
    await db.demand.create({
      data: {
        id: uuidv7(),
        accountId,
        userId: kullanici.id,
        categoryId: kategori.id,
        status: 'PUBLISHED',
        title: 'BMW 3 Serisi',
        makeKey: 'bmw',
        seriesKey: 'bmw/3-serisi',
        data: { alanlar: { model: { make: 'bmw', series: 'bmw/3-serisi' } }, alternatifler: [] },
        schemaVersion: 1,
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    const m = await staffCall(app, 'GET', '/staff/reports/model', undefined, sahip.token);
    expect(m.body.modeller[0]).toMatchObject({ ad: 'BMW 3 Serisi', talep: 1, arama: 3 });
    expect(m.body.aramaNotu).toContain('arayan kişi sayısı');
  });
});
