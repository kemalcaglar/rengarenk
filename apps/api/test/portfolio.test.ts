import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { readFirstSheet } from '@rengarenk/catalog';
import { uuidv7 } from '@rengarenk/db';
import { BULK_COLUMNS, gallerySlug } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { PortfolioService } from '../src/portfolio/portfolio.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;
let portfolio: PortfolioService;

const DAY = 86_400_000;
const JPG = (i: number) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, i, 1, 2, 3]);
const PDF = Buffer.from('%PDF-1.7\n%%EOF\n');

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
  portfolio = app.get(PortfolioService);
  const bmw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  const s = await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: bmw.id, name: '3 Serisi', categories: ['otomobil'] },
  });
  await db.catalogModel.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi/320i', makeId: bmw.id, seriesId: s.id, name: '320i' },
  });
  await db.catalogTrim.create({
    data: {
      id: uuidv7(),
      key: 'bmw/3-serisi/paket/m-sport',
      makeId: bmw.id,
      seriesId: s.id,
      name: 'M Sport',
    },
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
  return { token: v.body.accessToken as string, userId: v.body.user?.id as string };
}

/** Onaylı galeri (başvuru akışı galeri testlerinde; burada doğrudan) */
async function galeri(phone: string, ad: string, plan = 'deneme') {
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
      il: 'İstanbul',
      ilce: 'Kadıköy',
      address: 'Moda Cad. No: 1',
      authorityNo: '34-2021-001',
      plan,
      trialEndsAt: new Date(Date.now() + 30 * DAY),
      applicationId,
      approvedAt: new Date(),
    },
  });
  return { token: u.token, accountId, userId };
}

const arac = (ek: Record<string, unknown> = {}) => ({
  kategori: 'otomobil',
  marka: 'bmw',
  seri: 'bmw/3-serisi',
  model: 'bmw/3-serisi/320i',
  kasa: 'G20:0',
  paket: 'bmw/3-serisi/paket/m-sport',
  yil: 2020,
  km: 62000,
  yakit: 'benzin',
  vites: 'otomatik',
  renk: 'beyaz',
  fiyat: 2_390_000,
  plaka: '34 ABC 123',
  sasiSon6: 'A12345',
  ilkTescil: '2020-03-15',
  takas: true,
  fiyatBeyani: true,
  hasar: { parcalar: { solArkaCamurluk: 'lokal' }, tramer: 12000 },
  aciklama: 'İlk sahibinden.',
  ...ek,
});

const raw = (url: string, token: string, body: Buffer, type: string, method: 'POST' | 'PUT' = 'POST') =>
  app
    .inject({
      method,
      url,
      payload: body,
      headers: { authorization: `Bearer ${token}`, 'content-type': type },
    })
    .then((r) => ({ status: r.statusCode, body: r.body ? JSON.parse(r.body) : undefined }));

async function fotolar(token: string, acc: string, id: string, n = 6) {
  for (let i = 0; i < n; i++) {
    expect((await raw(`/gallery/${acc}/portfolio/${id}/photos`, token, JPG(i), 'image/jpeg')).status).toBe(
      201,
    );
  }
}

describe('portföy: ekle, fotoğraf, kurallar, EİDS, yayın (Karar 07, 17)', () => {
  it('taslaktan yayına; alıcıya plakanın yalnızca il kodu; satılınca kalkar', async () => {
    const g = await galeri('+905339990001', 'Yıldız Otomotiv');
    const base = `/gallery/${g.accountId}/portfolio`;
    const c = await call(app, 'POST', base, arac({ ilkTescil: undefined }), g.token);
    expect(c.status).toBe(201);
    expect(c.body.durum).toBe('DRAFT');
    const id = c.body.id as string;
    expect(c.body.kurallar.find((k: { key: string }) => k.key === 'alti_ay')).toMatchObject({
      ok: false,
      engel: true,
    });

    // Fotoğraf: tür baytlardan; en az 6 olmadan gönderilemez
    expect((await raw(`${base}/${id}/photos`, g.token, PDF, 'image/jpeg')).status).toBe(400);
    await fotolar(g.token, g.accountId, id, 3);
    expect((await call(app, 'POST', `${base}/${id}/submit`, undefined, g.token)).status).toBe(422);
    await fotolar(g.token, g.accountId, id, 3);
    // İlk tescil olmadan 6 ay / 6.000 km kontrolü engel
    const engel = await call(app, 'POST', `${base}/${id}/submit`, undefined, g.token);
    expect(engel.status).toBe(422);
    expect(engel.body.message).toContain('İlk tescil');
    await call(app, 'PUT', `${base}/${id}`, arac(), g.token);

    // Ekspertiz raporu (PDF, tarih)
    const rap = await raw(`${base}/${id}/report?tarih=2026-11-01`, g.token, PDF, 'application/pdf');
    expect(rap.body.ekspertiz).toMatchObject({ ad: 'ekspertiz.pdf' });

    const s = await call(app, 'POST', `${base}/${id}/submit`, undefined, g.token);
    expect(s.body.durum).toBe('PENDING_EIDS');
    expect((await call(app, 'GET', `/araclar/${s.body.no}`)).status).toBe(404); // doğrulanmadan görünmez

    expect(await portfolio.processEids(id)).toBe(1);
    const no = s.body.no as number;
    const p = await call(app, 'GET', `/araclar/${no}`);
    expect(p.status).toBe(200);
    expect(p.body).toMatchObject({
      ad: '2020 BMW 3 Serisi 320i M Sport',
      fiyat: 2_390_000,
      galeri: { yetkiNo: '34-2021-001' },
    });
    expect(JSON.stringify(p.body)).not.toContain('ABC');
    expect(p.body.bilgiler).toContainEqual(['Plaka', 'TR plakalı · 34']);
    expect(p.body.hasar.ozet).toBe('1 lokal boya, değişen yok');
    expect(p.body.fotolar).toHaveLength(6);
    const foto = await app.inject({ method: 'GET', url: p.body.fotolar[0] });
    expect(foto.headers['content-type']).toBe('image/jpeg');
    expect((await app.inject({ method: 'GET', url: `/araclar/${no}/ekspertiz` })).statusCode).toBe(200);
    // Telefon yalnızca girişli kullanıcıya
    expect((await call(app, 'GET', `/araclar/${no}/iletisim`)).status).toBe(401);
    const alici = await login('+905339990009');
    expect((await call(app, 'GET', `/araclar/${no}/iletisim`, undefined, alici.token)).body.phone).toBe(
      '+905339990001',
    );
    // Galeri profilinde
    expect((await call(app, 'GET', '/galeriler/yildiz-otomotiv')).body.portfoy.toplam).toBe(1);
    expect((await call(app, 'GET', '/galeriler/yildiz-otomotiv/araclar')).body).toHaveLength(1);

    // Aynı plakayla ikinci açık ilan olmaz
    const ikinci = await call(app, 'POST', base, arac(), g.token);
    await fotolar(g.token, g.accountId, ikinci.body.id);
    expect((await call(app, 'POST', `${base}/${ikinci.body.id}/submit`, undefined, g.token)).status).toBe(
      409,
    );

    // Satıldı: hemen kalkar, düzenlenemez
    expect((await call(app, 'POST', `${base}/${id}/sold`, undefined, g.token)).body.durum).toBe('SOLD');
    expect((await call(app, 'GET', `/araclar/${no}`)).status).toBe(404);
    expect((await call(app, 'PUT', `${base}/${id}`, arac(), g.token)).status).toBe(409);
    await expect(db.portfolioVehicle.delete({ where: { id } })).rejects.toThrow();
  });

  it('EİDS reddi; plaka değişince yeniden doğrulama; EİDS gerektirmeyen kategori doğrudan yayında', async () => {
    const g = await galeri('+905339990002', 'Kaya Motors');
    const base = `/gallery/${g.accountId}/portfolio`;
    const c = await call(app, 'POST', base, arac({ plaka: '06 AB 1230' }), g.token);
    await fotolar(g.token, g.accountId, c.body.id);
    await call(app, 'POST', `${base}/${c.body.id}/submit`, undefined, g.token);
    await portfolio.processEids(c.body.id);
    const red = await call(app, 'GET', `${base}/${c.body.id}`, undefined, g.token);
    expect(red.body).toMatchObject({ durum: 'REJECTED', not: 'Ruhsat sahibi ilanı onaylamadı' });
    await call(app, 'PUT', `${base}/${c.body.id}`, arac({ plaka: '06 AB 1231' }), g.token);
    await call(app, 'POST', `${base}/${c.body.id}/submit`, undefined, g.token);
    await portfolio.processEids(c.body.id);
    expect((await call(app, 'GET', `${base}/${c.body.id}`, undefined, g.token)).body.durum).toBe('PUBLISHED');

    // Yayındaki aracın plakası değişirse yeniden EİDS
    const u = await call(app, 'PUT', `${base}/${c.body.id}`, arac({ plaka: '06 AB 1232' }), g.token);
    expect(u.body.durum).toBe('PENDING_EIDS');

    const tekne = await call(
      app,
      'POST',
      base,
      {
        kategori: 'deniz',
        markaAd: 'Beneteau',
        modelAd: 'Oceanis 40',
        yil: 2018,
        km: 0,
        fiyat: 3_000_000,
        fiyatBeyani: true,
      },
      g.token,
    );
    expect(tekne.status).toBe(201);
    await fotolar(g.token, g.accountId, tekne.body.id);
    expect((await call(app, 'POST', `${base}/${tekne.body.id}/submit`, undefined, g.token)).body.durum).toBe(
      'PUBLISHED',
    );
  });

  it('satış temsilcisi yalnızca kendi aracını düzenler; deneme sınırı; deneme bitince yazma kapanır', async () => {
    const g = await galeri('+905339990003', 'Ege Oto');
    const base = `/gallery/${g.accountId}/portfolio`;
    const sahibin = await call(app, 'POST', base, arac({ plaka: '35 AB 101' }), g.token);
    const satis = await login('+905339990004');
    const satisId = (await db.user.findUniqueOrThrow({ where: { phone: '+905339990004' } })).id;
    await db.accountMember.create({ data: { accountId: g.accountId, userId: satisId, role: 'SALES' } });
    const kendi = await call(app, 'POST', base, arac({ plaka: '35 AB 102' }), satis.token);
    expect(kendi.body.atanan).toBe(satisId);
    expect(
      (await call(app, 'PUT', `${base}/${kendi.body.id}`, arac({ km: 70000 }), satis.token)).status,
    ).toBe(200);
    expect(
      (await call(app, 'PUT', `${base}/${sahibin.body.id}`, arac({ km: 70000 }), satis.token)).status,
    ).toBe(403);

    // Deneme: 15 araç
    for (let i = 3; i <= 15; i++) await call(app, 'POST', base, arac({ plaka: `35 AB ${100 + i}` }), g.token);
    const fazla = await call(app, 'POST', base, arac({ plaka: '35 AB 199' }), g.token);
    expect(fazla.status).toBe(409);
    expect(fazla.body.message).toContain('15');

    await db.gallery.update({
      where: { accountId: g.accountId },
      data: { trialEndsAt: new Date(Date.now() - DAY) },
    });
    expect((await call(app, 'PUT', `${base}/${kendi.body.id}`, arac(), g.token)).status).toBe(403);
    expect((await call(app, 'GET', base, undefined, g.token)).status).toBe(200); // görüntüleme açık
  });
});

describe('toplu yükleme ve API (Karar 07.2, 07.3)', () => {
  it('şablon, önizleme, içe aktarma, stok no ile güncelleme', async () => {
    const g = await galeri('+905339990005', 'Bursa Premium');
    const base = `/gallery/${g.accountId}/portfolio`;
    const t = await app.inject({
      method: 'GET',
      url: `${base}/template`,
      headers: { authorization: `Bearer ${g.token}` },
    });
    const sheet = readFirstSheet(new Uint8Array(t.rawPayload));
    expect(sheet[0]).toEqual(BULK_COLUMNS.map(([b]) => b));

    const baslik = BULK_COLUMNS.map(([b]) => b).join(';');
    const csv = [
      baslik,
      'S-1;Otomobil;BMW;3 Serisi;320i;M Sport;2020;62.000;Benzin;Otomatik;Beyaz;2.390.000;16 ABC 123;A12345;15.03.2020;12000;E;E;Bakımlı, temiz',
      'S-2;Otomobil;Togg;T10X;;;2024;10000;Elektrik;Otomatik;Beyaz;1.900.000;16 ABC 124;B12345;01.02.2024;0;H;E;',
      'S-3;Otomobil;BMW;3 Serisi;320i;Luxury;2019;;Benzin;Otomatik;Gri;1.900.000;16 ABC 125;C12345;01.02.2019;0;H;E;',
    ].join('\n');
    const on = await raw(`${base}/bulk?onizle=1`, g.token, Buffer.from(csv), 'text/csv');
    expect(on.status).toBe(200);
    expect(on.body).toMatchObject({ toplam: 3, hazir: 1, yeni: 1 });
    expect(on.body.hatalar.map((h: { satir: number }) => h.satir)).toEqual([3, 4]);
    expect(on.body.hatalar[0].hata).toContain('Togg');
    expect(on.body.hatalar[1].hata).toContain('Luxury');
    expect(await db.portfolioVehicle.count({ where: { accountId: g.accountId } })).toBe(0); // önizleme yazmaz

    const ice = await raw(`${base}/bulk`, g.token, Buffer.from(csv), 'text/csv');
    expect(ice.body).toMatchObject({ eklendi: 1, guncellendi: 0, hatali: 2 });
    const v = await db.portfolioVehicle.findFirstOrThrow({
      where: { accountId: g.accountId, externalId: 'S-1' },
    });
    expect(v).toMatchObject({ km: 62000, plate: '16ABC123', status: 'DRAFT', description: 'Bakımlı, temiz' });
    // Aynı stok no tekrar gelince güncellenir
    const ikinci = await raw(
      `${base}/bulk`,
      g.token,
      Buffer.from(csv.replace('2.390.000', '2.350.000')),
      'text/csv',
    );
    expect(ikinci.body).toMatchObject({ eklendi: 0, guncellendi: 1 });
    expect(Number((await db.portfolioVehicle.findUniqueOrThrow({ where: { id: v.id } })).priceTl)).toBe(
      2_350_000,
    );
  });

  it('API anahtarı yalnızca Kurumsal pakette; stok no ile ekle, listele, satıldı', async () => {
    const g = await galeri('+905339990006', 'Anadolu Oto');
    const base = `/gallery/${g.accountId}/portfolio`;
    expect((await call(app, 'POST', `${base}/api-keys`, { ad: 'Stok sistemi' }, g.token)).status).toBe(403);
    await db.gallery.update({ where: { accountId: g.accountId }, data: { plan: 'kurumsal' } });
    const k = await call(app, 'POST', `${base}/api-keys`, { ad: 'Stok sistemi' }, g.token);
    expect(k.body.anahtar).toMatch(/^rgk_/);
    const liste = await call(app, 'GET', `${base}/api-keys`, undefined, g.token);
    expect(JSON.stringify(liste.body)).not.toContain(k.body.anahtar);

    const api = (method: 'GET' | 'PUT' | 'POST', url: string, body?: object) =>
      app
        .inject({ method, url, payload: body, headers: { authorization: `Bearer ${k.body.anahtar}` } })
        .then((r) => ({ status: r.statusCode, body: JSON.parse(r.body) }));
    expect((await app.inject({ method: 'GET', url: '/entegrasyon/v1/araclar' })).statusCode).toBe(401);
    const put = await api('PUT', '/entegrasyon/v1/araclar/STK-77', arac({ plaka: '41 AB 777' }));
    expect(put.status).toBe(200);
    expect(put.body.durum).toBe('DRAFT');
    await api('PUT', '/entegrasyon/v1/araclar/STK-77', arac({ plaka: '41 AB 777', fiyat: 2_200_000 }));
    const l = await api('GET', '/entegrasyon/v1/araclar');
    expect(l.body).toEqual([expect.objectContaining({ stokNo: 'STK-77', fiyat: 2_200_000 })]);
    expect((await api('POST', '/entegrasyon/v1/araclar/STK-77/satildi')).body.durum).toBe('SOLD');

    await call(app, 'DELETE', `${base}/api-keys/${k.body.id}`, undefined, g.token);
    expect((await api('GET', '/entegrasyon/v1/araclar')).status).toBe(403);
  });
});
