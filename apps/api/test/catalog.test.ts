import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { strToU8, zipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { CatalogImportService } from '../src/catalog/catalog-import.service.js';
import { CatalogPipelineService } from '../src/catalog/catalog-pipeline.service.js';
import { TSB_CLIENT, type TsbClient } from '../src/catalog/tsb-client.js';
import { registerXlsxBody, XLSX_MIME } from '../src/catalog/xlsx-body.js';
import { type Db, PRISMA } from '../src/database/prisma.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019];
type Row = [string, string, string, string, number[]];

/** TSB biçiminde xlsx (x: ön ekli satır içi metin, dönem satırı, başlık, model yılı sütunları) */
function tsbXlsx(rows: Row[], period = 'Ekim 2026', years = YEARS) {
  const col = (i: number) => String.fromCharCode(65 + i);
  const cell = (ref: string, v: string | number) =>
    typeof v === 'number'
      ? `<x:c r="${ref}"><x:v>${v}</x:v></x:c>`
      : `<x:c r="${ref}" t="inlineStr"><x:is><x:t>${v}</x:t></x:is></x:c>`;
  const header = ['Marka Kodu', 'Tip Kodu', 'Marka Adı', 'Tip Adı', ...years.map(String)];
  const xml = [
    `<x:row r="1">${cell('A1', period)}</x:row>`,
    `<x:row r="2">${header.map((h, i) => cell(`${col(i)}2`, h)).join('')}</x:row>`,
    ...rows.map(
      (r, n) =>
        `<x:row r="${n + 3}">${[r[0], r[1], r[2], r[3], ...r[4]].map((v, i) => cell(`${col(i)}${n + 3}`, v)).join('')}</x:row>`,
    ),
  ].join('');
  return Buffer.from(
    zipSync({
      'xl/worksheets/sheet1.xml': strToU8(
        `<?xml version="1.0"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData>${xml}</x:sheetData></x:worksheet>`,
      ),
    }),
  );
}

/** Yılları değerle doldurur: 2019–2021 makyajsız G20, 2022'den itibaren LCI */
const yrs = (from: number, to: number) => YEARS.map((y) => (y >= from && y <= to ? 1_000_000 + y : 0));

/** Kalite kontrolünün istediği hacim için 1.200 tiplik bir liste: gerçek örnekler + dolgu */
function catalogRows(extra: Row[] = [], drop = 0): Row[] {
  const real: Row[] = [
    ['21', '1832', 'BMW', '320i SEDAN 1.6 170 SPORT LINE', yrs(2020, 2026)],
    ['21', '1834', 'BMW', '320i SEDAN 1.6 170 M SPORT', yrs(2020, 2021)],
    ['21', '1833', 'BMW', '320i SEDAN 1.6 170 LUXURY LINE', yrs(2020, 2022)],
    ['21', '1938', 'BMW', '320i SEDAN LCI 1.6 170 M SPORT', yrs(2022, 2026)],
    ['21', '1007', 'BMW', '320d SEDAN (184)', yrs(2019, 2021)],
    ['21', '1950', 'BMW', '320i TOURING LCI 1.6 170 M SPORT', yrs(2023, 2026)],
    ['153', '1529', 'VOLKSWAGEN', 'GOLF 1.0 eTSI 110 DSG R-LINE', yrs(2021, 2024)],
    ['850', '1003', 'TOGG', 'T10X V2 RWD UZUN MENZIL 160KW', yrs(2023, 2026)],
    ['900', '1', 'ZIRAI TRAKTOR', 'NEW HOLLAND TD 75', yrs(2019, 2020)],
  ];
  const filler: Row[] = Array.from({ length: 1200 - drop }, (_, i) => [
    '500',
    `${9000 + i}`,
    'DOLGU',
    `SERI${i % 40} 1.6 TDI 110 PAKET${i}`,
    yrs(2020, 2024),
  ]);
  return [...real, ...filler, ...extra];
}

let app: NestFastifyApplication;
let db: Db;
let owner: string;
const tsb = {
  fileName: '202610R2.xlsx',
  file: tsbXlsx(catalogRows()),
  fail: false,
  downloads: 0,
};
const fakeTsb: TsbClient = {
  latest: async () => {
    if (tsb.fail) throw new Error('TSB yanıt vermedi');
    return { fileName: tsb.fileName, url: `https://tsb.test/content/${tsb.fileName}`, monthLabel: 'Ekim' };
  },
  archive: async (year: number) =>
    archives[year]
      ? { fileName: archives[year].name, url: `https://tsb.test/arsiv/${year}`, monthLabel: `${year}-01` }
      : null,
  download: async (url: string) => {
    tsb.downloads++;
    const y = /arsiv\/(\d{4})/.exec(url)?.[1];
    return new Uint8Array(y ? (archives[Number(y)]?.file as Buffer) : tsb.file);
  },
};

/** Arşiv dosyaları: 2006–2013 model yılları. Tip 21-1832 güncel listede de var; 21-0700 çoktan listeden düşmüş. */
const OLD_YEARS = [2013, 2012, 2011, 2010, 2009, 2008, 2007, 2006];
const oldYrs = (from: number, to: number) => OLD_YEARS.map((y) => (y >= from && y <= to ? 500_000 + y : 0));
const archiveRows = (): Row[] => [
  ['21', '1832', 'BMW', '320i SEDAN 1.6 170 SPORT LINE', oldYrs(2012, 2013)],
  ['21', '0700', 'BMW', '320i SEDAN 2.0 (150) ELEGANCE', oldYrs(2006, 2011)],
  ...Array.from(
    { length: 1100 },
    (_, i): Row => ['500', `${9000 + i}`, 'DOLGU', `SERI${i % 40} 1.6 TDI 110 PAKET${i}`, oldYrs(2008, 2013)],
  ),
];
const archives: Record<number, { name: string; file: Buffer }> = {
  2020: { name: '202004R1.xlsx', file: tsbXlsx(archiveRows(), 'Nisan 2020', OLD_YEARS) },
};

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TSB_CLIENT)
    .useValue(fakeTsb)
    .compile();
  app = mod.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: ['error'] });
  registerXlsxBody(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  db = app.get<Db>(PRISMA);
  owner = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
});
afterAll(() => app.close());

const upload = (file: Buffer, token = owner, name = '202609.xlsx') =>
  app
    .inject({
      method: 'POST',
      url: '/staff/catalog/tsb/upload',
      payload: file,
      headers: { authorization: `Bearer ${token}`, 'content-type': XLSX_MIME, 'x-dosya-adi': name },
    })
    .then((r) => ({ status: r.statusCode, body: JSON.parse(r.body) }));

const get = (url: string) =>
  app.inject({ method: 'GET', url }).then((r) => ({ status: r.statusCode, body: JSON.parse(r.body) }));

describe('katalog hattı: TSB dosyası (Karar 33, Teknik tasarım §5)', () => {
  const september = tsbXlsx(catalogRows(), 'Eylül 2026');

  it('konsoldan yüklenen dosya kataloğa girer; kasko bedeli hiçbir yerde saklanmaz', async () => {
    const r = await upload(september);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('APPLIED');
    expect(r.body.version).toBe('2026-09');
    expect(r.body.stats).toMatchObject({ added: 1208, outOfScope: 1, missing: 0 });

    const v = await db.catalogVariant.findUniqueOrThrow({
      where: { source_sourceKey: { source: 'tsb', sourceKey: '21-1938' } },
    });
    expect(v).toMatchObject({
      facelift: true,
      body: 'Sedan',
      years: [2022, 2023, 2024, 2025, 2026],
      inLatest: true,
    });
    const dump = JSON.stringify(await db.catalogVariant.findMany({ take: 50 }));
    expect(dump).not.toContain('1002026');

    const imp = await db.catalogImport.findFirstOrThrow({ where: { id: r.body.id } });
    expect(imp).toMatchObject({ trigger: 'elle', fileName: '202609.xlsx' });
    expect(await db.auditLog.count({ where: { action: 'katalog_ice_aktarildi' } })).toBe(1);
    expect(await db.outboxEvent.count({ where: { type: 'katalog.guncellendi' } })).toBe(1);
  });

  it('aynı dosya ikinci kez uygulanmaz', async () => {
    const r = await upload(september);
    expect(r.body.status).toBe('SKIPPED');
  });

  it('sonraki ay düşen tipler silinmez, "son sürümde yok" olur; yıl geçmişi korunur', async () => {
    const next = catalogRows([], 70).filter((r) => r[1] !== '1007');
    const r = await upload(tsbXlsx(next, 'Ekim 2026'), owner, '202610.xlsx');
    expect(r.body.status).toBe('APPLIED');
    expect(r.body.stats.missing).toBe(71);
    expect(r.body.quality.warnings.map((w: { kod: string }) => w.kod)).toContain('kaybolan_tip');
    const dropped = await db.catalogVariant.findUniqueOrThrow({
      where: { source_sourceKey: { source: 'tsb', sourceKey: '21-1007' } },
    });
    expect(dropped.inLatest).toBe(false);
    expect(dropped.lastVersion).toBe('2026-09');
    await expect(db.catalogVariant.delete({ where: { id: dropped.id } })).rejects.toThrow();
  });

  it('kalite kontrolünü geçmeyen dosya yayımlanmaz; okunamayan dosya kayda geçer', async () => {
    const before = await db.catalogVariant.count();
    const tiny = await upload(tsbXlsx(catalogRows().slice(0, 20), 'Kasım 2026'), owner, '202611.xlsx');
    expect(tiny.body.status).toBe('REJECTED');
    expect(tiny.body.quality.blocking[0].kod).toBe('az_kayit');
    expect(await db.catalogVariant.count()).toBe(before);
    expect(await db.outboxEvent.count({ where: { type: 'katalog.reddedildi' } })).toBe(1);

    const broken = await upload(Buffer.from('bu bir excel değil'), owner, 'bozuk.xlsx');
    expect(broken.body.status).toBe('FAILED');
    expect(broken.body.error).toContain('Excel');
  });

  it('imzası tutmayan paket kataloğa yazılmaz', async () => {
    const importer = app.get(CatalogImportService);
    const r = await importer.apply(
      { format: 1, payload: '{"format":1,"items":[]}', signature: 'AAAA', sha256: 'x' },
      { trigger: 'elle' },
    );
    expect(r.status).toBe('REJECTED');
    expect(r.error).toContain('imza');
  });

  it('yükleme yetkisi yalnızca kategori ayarı yapanlarda; xlsx olmayan gövde reddedilir', async () => {
    const support = (await loginAs(app, await createStaff(db, 'SUPPORT'))).token;
    expect((await upload(tsbXlsx(catalogRows()), support)).status).toBe(403);
    const json = await staffCall(app, 'POST', '/staff/catalog/tsb/upload', { a: 1 }, owner);
    expect(json.status).toBe(400);
  });
});

describe('otomatik çekme', () => {
  it('kapalıyken çalışmaz; "şimdi kontrol et" yeni dosyayı indirir, aynı dosyayı ikinci kez indirmez', async () => {
    const pipeline = app.get(CatalogPipelineService);
    expect((await pipeline.checkTsb()).durum).toBe('kapali');

    const now = await staffCall(app, 'POST', '/staff/catalog/tsb/check', {}, owner);
    expect(now.body.durum).toBe('uygulandi');
    expect(now.body.outcome.version).toBe('2026-10-R2');
    expect(tsb.downloads).toBe(1);

    const on = await staffCall(app, 'PATCH', '/staff/catalog/sources/tsb', { autoFetch: true }, owner);
    expect(on.body.autoFetch).toBe(true);
    expect((await pipeline.checkTsb()).durum).toBe('yeni_dosya_yok');
    expect(tsb.downloads).toBe(1);
  });

  it('TSB yanıt vermezse hata kaydedilir; 48 saat geçince gecikme olayı yazılır', async () => {
    const pipeline = app.get(CatalogPipelineService);
    tsb.fail = true;
    expect((await pipeline.checkTsb()).durum).toBe('hata');
    const src = await staffCall(app, 'GET', '/staff/catalog/sources', undefined, owner);
    const t = src.body.find((s: { key: string }) => s.key === 'tsb');
    expect(t.lastError).toContain('yanıt vermedi');
    expect(t.stale).toBe(false);

    expect(await pipeline.reportStaleSources(new Date(Date.now() + 49 * 3600_000))).toEqual(['tsb']);
    expect(await db.outboxEvent.count({ where: { type: 'katalog.kaynak_gecikti' } })).toBe(1);
    tsb.fail = false;
  });
});

describe('TSB arşivi: eski model yılları (Karar 33)', () => {
  it('arşiv yalnızca eksik yılları ve düşmüş tipleri ekler; güncel listenin alanlarını değiştirmez', async () => {
    const before = await db.catalogVariant.findUniqueOrThrow({
      where: { source_sourceKey: { source: 'tsb', sourceKey: '21-1832' } },
    });
    const srcBefore = await db.catalogSource.findUniqueOrThrow({ where: { key: 'tsb' } });

    const r = await staffCall(app, 'POST', '/staff/catalog/tsb/archive', {}, owner);
    expect(r.status).toBe(200);
    expect(r.body.dosyalar).toEqual([{ dosya: '202004R1.xlsx', durum: 'applied', yeniTip: 1 }]);

    const after = await db.catalogVariant.findUniqueOrThrow({
      where: { source_sourceKey: { source: 'tsb', sourceKey: '21-1832' } },
    });
    expect(after.years).toEqual([2012, 2013, ...before.years]);
    expect({ ...after, years: null, updatedAt: null, firstVersion: null }).toEqual({
      ...before,
      years: null,
      updatedAt: null,
      firstVersion: null,
    });
    expect(after.firstVersion).toBe('2020-04-R1');

    const old = await db.catalogVariant.findUniqueOrThrow({
      where: { source_sourceKey: { source: 'tsb', sourceKey: '21-0700' } },
    });
    expect(old).toMatchObject({ inLatest: false, years: [2006, 2007, 2008, 2009, 2010, 2011] });

    const srcAfter = await db.catalogSource.findUniqueOrThrow({ where: { key: 'tsb' } });
    expect(srcAfter.lastVersion).toBe(srcBefore.lastVersion);
    expect(await db.auditLog.count({ where: { action: 'katalog_arsiv_ice_aktarildi' } })).toBe(1);

    const downloads = tsb.downloads;
    const again = await staffCall(app, 'POST', '/staff/catalog/tsb/archive', {}, owner);
    expect(again.body.dosyalar).toEqual([{ dosya: '202004R1.xlsx', durum: 'daha_once_yuklendi' }]);
    expect(tsb.downloads).toBe(downloads);
  });

  it('eski yıllar seri seçeneklerinde görünür', async () => {
    const bmw = (await get('/catalog/makes')).body.find((m: { name: string }) => m.name === 'BMW');
    const s3 = (await get(`/catalog/makes/${bmw.id}/series`)).body.find(
      (s: { name: string }) => s.name === '3 Serisi',
    );
    const d = await get(`/catalog/series/${s3.id}?yil=2007`);
    expect(d.body.models.map((m: { name: string }) => m.name)).toEqual(['320i']);
    expect(d.body.trims.map((t: { name: string }) => t.name)).toEqual(['Elegance']);
  });
});

describe('katalog okuma uçları', () => {
  it('marka → seri → seçenekler: modeller, kasalar, makyaj yılları ve paketler', async () => {
    const makes = await get('/catalog/makes?kategori=otomobil');
    const bmw = makes.body.find((m: { name: string }) => m.name === 'BMW');
    expect(bmw).toBeTruthy();
    expect(makes.body.find((m: { name: string }) => m.name === 'Togg')).toBeUndefined(); // Togg SUV ve elektrikli

    const series = await get(`/catalog/makes/${bmw.id}/series?kategori=otomobil`);
    const s3 = series.body.find((s: { name: string }) => s.name === '3 Serisi');

    const detail = await get(`/catalog/series/${s3.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.make.name).toBe('BMW');
    expect(detail.body.models.map((m: { name: string }) => m.name)).toEqual(['320d', '320i']);
    expect(detail.body.bodies.map((b: { name: string }) => b.name)).toEqual(['Sedan', 'Station wagon']);
    // Arşivden gelen 2006–2013 yılları da makyajsız kasada görünür (önceki test).
    expect(detail.body.makyaj).toEqual({
      makyajsiz: [
        2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
      ],
      makyajli: [2022, 2023, 2024, 2025, 2026],
    });
    expect(detail.body.trims.map((t: { name: string }) => t.name)).toEqual([
      'Elegance',
      'Luxury Line',
      'M Sport',
      'Sport Line',
    ]);

    const y2021 = await get(`/catalog/series/${s3.id}?yil=2021`);
    expect(y2021.body.makyaj.makyajli).toEqual([]);
    expect(y2021.body.trims.find((t: { name: string }) => t.name === 'M Sport').years).toEqual([2021]);

    const ev = await get('/catalog/makes?kategori=elektrikli');
    expect(ev.body.map((m: { name: string }) => m.name)).toContain('Togg');
    expect((await get('/catalog/makes?kategori=yok')).status).toBe(400);
  });
});
