import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { type CategoryDefinition, gallerySlug } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { MatchingService } from '../src/matching/matching.service.js';
import { PortfolioService } from '../src/portfolio/portfolio.service.js';
import { call, createTestApp, uyeOl } from './helpers.js';

let app: NestFastifyApplication;
let db: Db;
let portfolio: PortfolioService;
let matching: MatchingService;

const DAY = 86_400_000;
const JPG = (i: number) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, i, 9, 8, 7]);

beforeAll(async () => {
  ({ app, db } = await createTestApp());
  portfolio = app.get(PortfolioService);
  matching = app.get(MatchingService);
  const bmw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  const s = await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: bmw.id, name: '3 Serisi', categories: ['otomobil'] },
  });
  await db.catalogModel.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi/320i', makeId: bmw.id, seriesId: s.id, name: '320i' },
  });
  const vw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'volkswagen', name: 'Volkswagen' } });
  const p = await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'volkswagen/passat', makeId: vw.id, name: 'Passat', categories: ['otomobil'] },
  });
  await db.catalogModel.create({
    data: { id: uuidv7(), key: 'volkswagen/passat/1-5-tsi', makeId: vw.id, seriesId: p.id, name: '1.5 TSI' },
  });
});
afterAll(() => app.close());

async function login(phone: string, ad?: [string, string]) {
  const v = { body: await uyeOl(app, phone) };
  const token = v.body.accessToken as string;
  if (ad) await call(app, 'PATCH', '/me', { firstName: ad[0], lastName: ad[1] }, token);
  return { token, userId: v.body.userId };
}

async function galeri(phone: string, ad: string, plan = 'deneme', il = 'İstanbul', ilce = 'Kadıköy') {
  const u = await login(phone);
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
      il,
      ilce,
      address: 'Moda Cad. No: 1',
      authorityNo: '34-2021-001',
      plan,
      trialEndsAt: plan === 'deneme' ? new Date(Date.now() + 30 * DAY) : null,
      applicationId,
      approvedAt: new Date(),
    },
  });
  return { token: u.token, accountId, userId };
}

/** Yayında araç: fotoğraflar, gönderim, EİDS (sahte sağlayıcı onaylar) ve işçinin eşleştirmesi */
async function yayindaArac(g: { token: string; accountId: string }, ek: Record<string, unknown>) {
  const base = `/gallery/${g.accountId}/portfolio`;
  const c = await call(
    app,
    'POST',
    base,
    {
      kategori: 'otomobil',
      marka: 'bmw',
      seri: 'bmw/3-serisi',
      model: 'bmw/3-serisi/320i',
      yil: 2020,
      km: 62_000,
      yakit: 'benzin',
      vites: 'otomatik',
      renk: 'beyaz',
      fiyat: 2_390_000,
      sasiSon6: 'A12345',
      ilkTescil: '2020-03-15',
      fiyatBeyani: true,
      hasar: { parcalar: {}, tramer: 0 },
      ...ek,
    },
    g.token,
  );
  expect(c.status).toBe(201);
  const id = c.body.id as string;
  for (let i = 0; i < 6; i++) {
    await app.inject({
      method: 'POST',
      url: `${base}/${id}/photos`,
      payload: JPG(i),
      headers: { authorization: `Bearer ${g.token}`, 'content-type': 'image/jpeg' },
    });
  }
  const s = await call(app, 'POST', `${base}/${id}/submit`, undefined, g.token);
  expect(s.body.durum).toBe('PENDING_EIDS');
  await portfolio.processEids(id);
  await matching.onVehicle(id);
  return { id, no: s.body.no as number };
}

async function talep(token: string, ek: Record<string, unknown> = {}, alanlar: Record<string, unknown> = {}) {
  const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, token);
  const data = {
    alanlar: {
      model: { make: 'bmw', series: 'bmw/3-serisi', model: 'bmw/3-serisi/320i' },
      konum: { il: 'İstanbul', ilce: 'Kadıköy' },
      ...alanlar,
    },
    alternatifler: [
      {
        butce: { min: 2_100_000, max: 2_450_000 },
        yil: { min: 2019, max: 2023 },
        km: 80_000,
        vites: ['otomatik'],
        ...ek,
      },
    ],
  };
  await call(app, 'PATCH', `/demands/${d.body.id}`, { data, step: 6 }, token);
  const p = await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, token);
  expect(p.status).toBe(200);
  await matching.onDemand(d.body.id);
  return { id: d.body.id as string, no: p.body.no as number };
}

describe('eşleştirme motoru (Karar 06.2, 22; Teknik tasarım §6)', () => {
  it('talep ↔ araç iki yönde eşleşir; paket, il, marka ve kendi galerisi ayrılır; bildirim olayı yazılır', async () => {
    const a = await galeri('+905338880001', 'Yıldız Otomotiv');
    const b = await galeri('+905338880002', 'Başlangıç Oto', 'baslangic');
    const ank = await galeri('+905338880003', 'Ankara Oto', 'deneme', 'Ankara', 'Çankaya');
    const v1 = await yayindaArac(a, { plaka: '34 ABC 101' });
    await yayindaArac(b, { plaka: '34 ABC 102' });
    await yayindaArac(ank, { plaka: '06 ABC 103' });
    await yayindaArac(a, {
      plaka: '34 ABC 104',
      marka: 'volkswagen',
      seri: 'volkswagen/passat',
      model: 'volkswagen/passat/1-5-tsi',
    });

    // Talepten araçlara: yalnızca İstanbul'daki BMW'ler; galerinin kendi çalışanının talebi eşleşmez
    const alici = await login('+905338880009', ['Ayşe', 'Yılmaz']);
    const t = await talep(alici.token);
    const rows = await db.match.findMany({ where: { demandId: t.id, active: true } });
    expect(rows.map((r) => r.accountId).sort()).toEqual([a.accountId, b.accountId].sort());
    const kendi = await talep(a.token);
    expect(await db.match.count({ where: { demandId: kendi.id, accountId: a.accountId } })).toBe(0);

    // Galeri paneli: deneme süresindeki galeri görür, Başlangıç paketinde otomatik eşleşme yok
    const l = await call(app, 'GET', `/gallery/${a.accountId}/matches`, undefined, a.token);
    expect(l.body).toMatchObject({ eslesme: true, yeni: 1, toplam: 1, gunlukMesaj: 10 });
    expect(l.body.eslesmeler[0]).toMatchObject({
      skor: 100,
      uyum: 'Tüm kriterlere uyuyor',
      yeni: true,
      arac: { id: v1.id, ad: '2020 BMW 3 Serisi 320i' },
      talep: { no: t.no, sahip: 'Ayşe Y.', il: 'İstanbul', ilce: 'Kadıköy', butceMax: 2_450_000 },
    });
    expect(l.body.araclar).toEqual([{ id: v1.id, ad: '2020 BMW 3 Serisi 320i', sayi: 1 }]);
    const bl = await call(app, 'GET', `/gallery/${b.accountId}/matches`, undefined, b.token);
    expect(bl.body).toMatchObject({ eslesme: false, eslesmeler: [] });
    expect((await call(app, 'GET', `/gallery/${a.accountId}/matches`, undefined, alici.token)).status).toBe(
      404,
    );

    // Bildirim olayı yalnızca eşleşmesi açık galeriye, anlık
    const ev = await db.outboxEvent.findMany({ where: { type: 'eslesme.bulundu' } });
    expect(ev.map((e) => (e.payload as { accountId: string }).accountId)).toEqual([a.accountId]);
    expect(ev[0]?.payload).toMatchObject({ anlik: true, score: 100 });

    // Görüldü; portföy listesinde sayı; ana sayfada kart
    expect(
      (await call(app, 'POST', `/gallery/${a.accountId}/matches/seen`, undefined, a.token)).body,
    ).toEqual({
      okundu: 1,
    });
    expect((await call(app, 'GET', `/gallery/${a.accountId}/matches`, undefined, a.token)).body.yeni).toBe(0);
    const pl = await call(app, 'GET', `/gallery/${a.accountId}/portfolio`, undefined, a.token);
    expect(pl.body.araclar.find((x: { id: string }) => x.id === v1.id).eslesme).toBe(1);
    const ev2 = await call(app, 'GET', '/me/matches', undefined, a.token);
    expect(ev2.body.eslesmeler).toEqual([
      expect.objectContaining({ no: t.no, arac: '2020 BMW 320i', il: 'İstanbul' }),
    ]);

    // Araç sayfası: alıcının talebine uyuyor bandı
    const uy = await call(app, 'GET', `/araclar/${v1.no}/uyum`, undefined, alici.token);
    expect(uy.body.uyan).toMatchObject({ talepNo: t.no });
    expect(uy.body.uyan.metin).toMatch(/^\d+ kriterin \d+’.+ tutuyor: /);
    expect((await call(app, 'GET', `/araclar/${v1.no}/uyum`)).status).toBe(401);

    // Araçtan taleplere (kayıtlı sorgu): sonradan yayına giren araç talebi bulur
    const v5 = await yayindaArac(a, { plaka: '34 ABC 105', renk: 'siyah', km: 95_000 });
    const m5 = await db.match.findFirstOrThrow({ where: { vehicleId: v5.id } });
    expect(m5.score).toBeLessThan(100);
    expect(m5.score).toBeGreaterThanOrEqual(60);

    // Talep pasife alınınca eşleşmeler kapanır
    await call(app, 'POST', `/demands/${t.id}/passivate`, {}, alici.token);
    await matching.onDemand(t.id);
    expect(await db.match.count({ where: { demandId: t.id, active: true } })).toBe(0);
    expect((await call(app, 'GET', `/gallery/${a.accountId}/matches`, undefined, a.token)).body.toplam).toBe(
      0,
    );
  });

  it('bütçe %5 toleransı ve "Kimden: sahibinden" sert koşuldur; deneme alanı motorla aynı skoru verir', async () => {
    const g = await galeri('+905338881001', 'Marmara Otomotiv');
    await yayindaArac(g, { plaka: '34 ABC 201', fiyat: 2_560_000 });
    const yakin = await yayindaArac(g, { plaka: '34 ABC 202', fiyat: 2_500_000 });
    const alici = await login('+905338881009', ['Can', 'Tekin']);
    const t = await talep(alici.token, { butce: { max: 2_400_000 } });
    const rows = await db.match.findMany({ where: { demandId: t.id, accountId: g.accountId } });
    expect(rows.map((r) => r.vehicleId)).toEqual([yakin.id]);
    expect(rows[0]?.score).toBeLessThan(100);

    const alici2 = await login('+905338881008', ['Deniz', 'Ak']);
    const s = await talep(alici2.token, {}, { kimden: ['sahibinden'] });
    expect(await db.match.count({ where: { demandId: s.id } })).toBe(0);

    // Deneme alanı: yayındaki ayarla aynı skor; ağırlık değişince sıra değişebilir, hiçbir şey yazılmaz
    const cat = await db.category.findFirstOrThrow({ where: { slug: 'otomobil' } });
    const v = await db.categorySchemaVersion.findFirstOrThrow({
      where: { categoryId: cat.id, version: cat.publishedVersion as number },
    });
    const def = v.definition as unknown as CategoryDefinition;
    const once = await db.match.count();
    const sim = await matching.simulate(cat.id, def, t.no);
    expect(sim.talep?.no).toBe(t.no);
    expect(sim.adaylar.find((x) => x.id === yakin.id)).toMatchObject({
      skor: rows[0]?.score,
      eski: rows[0]?.score,
    });
    const agir = { ...def, baseWeights: { ...def.baseWeights, butce: 40 } };
    const sim2 = await matching.simulate(cat.id, agir, t.no);
    expect(sim2.adaylar.find((x) => x.id === yakin.id)?.skor).toBeLessThan(rows[0]?.score as number);
    expect(await db.match.count()).toBe(once);
  });
});
