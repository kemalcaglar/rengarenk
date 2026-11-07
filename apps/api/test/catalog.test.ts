import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { strToU8, zipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { CatalogImportService } from '../src/catalog/catalog-import.service.js';
import { CatalogPipelineService } from '../src/catalog/catalog-pipeline.service.js';
import { TSB_CLIENT, type TsbClient } from '../src/catalog/tsb-client.js';
import { VEHICLESDB_CLIENT, type VehiclesDbClient } from '../src/catalog/vehiclesdb-client.js';
import { VMM_CLIENT, type VmmClient } from '../src/catalog/vmm-client.js';
import { WIKIDATA_CLIENT, type WikidataClient } from '../src/catalog/wikidata-client.js';
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

/** vehicle-makes-models sürümü: 1990'lar BMW 3 Serisi, yalnızca bu kaynakta olan Lada ve kalite için dolgu */
const VMM_CSV = [
  'make_group,make,model,generation,gen_year_start,gen_year_end,body_type,engine_label,fuel_type,cylinders,displacement_cc,power_hp,torque_nm,transmission,drivetrain',
  'bmw,BMW,3 Series,3 Series Sedan (1991),1991,1998,,318i 5MT RWD (115 HP),Gasoline,4,1796,115,168,5-speed manual,Rear Wheel Drive',
  'bmw,BMW,3 Series,3 Series Sedan (1991),1991,1998,,325i 5MT RWD (192 HP),Gasoline,6,2494,192,245,5-speed manual,Rear Wheel Drive',
  'lada,Lada,Samara,Samara (1990),1990,2004,,1.3L 4MT FWD (64 HP),Gasoline,4,1288,64,,4-speed manual,Front Wheel Drive',
  // 2006 ve sonrası: tip kaydı alınmaz, yalnızca kasa kuşağı (makyaj sorusu için)
  'bmw,BMW,3 Series,3 Series Sedan (2018),2018,2022,,320i 8AT RWD (184 HP),Gasoline,4,1998,184,300,8-speed automatic,Rear Wheel Drive',
  'bmw,BMW,3 Series,3 Series Sedan (2022),2022,,,320i 8AT RWD (184 HP),Gasoline,4,1998,184,300,8-speed automatic,Rear Wheel Drive',
  // TSB'de "SERI1" olan seri bu kaynakta ekli yazılır: ad eşleme önerisi
  'dolgu,Dolgu,SERI1 Sport,SERI1 Sport (1999),1999,2003,,1.6L 5MT FWD (100 HP),Gasoline,4,1600,100,,5-speed manual,Front Wheel Drive',
  ...Array.from(
    { length: 1100 },
    (_, i) =>
      `dolgu,Eskidolgu,M${i % 30},M${i % 30} (1995) ${i},1995,2000,,1.${i % 9}L 5MT FWD (${60 + (i % 50)} HP),Gasoline,4,1${i % 9}00,${60 + (i % 50)},,5-speed manual,Front Wheel Drive`,
  ),
].join(String.fromCharCode(10));
const vmm = { tag: 'v1.0.2', downloads: 0 };
const fakeVmm: VmmClient = {
  latest: async () => ({
    tag: vmm.tag,
    url: 'https://github.com/x/y.zip',
    fileName: `${vmm.tag}/vehicle-data-csv.zip`,
  }),
  download: async () => {
    vmm.downloads++;
    // Sonraki sürümde dosya değişir (bir satır eklenir); aynı dosya ikinci kez uygulanmaz.
    const extra =
      'dolgu,Eskidolgu,M1,M1 (2001) yeni,2001,2004,,1.4L 5MT FWD (75 HP),Gasoline,4,1400,75,,5-speed manual,Front Wheel Drive';
    return new TextEncoder().encode(vmm.tag === 'v1.0.2' ? VMM_CSV : `${VMM_CSV}\n${extra}`);
  },
};

/** Wikidata: BMW 3 Serisi E36 (yıl Wikidata'da) ve G20 (yıl Vikipedi bilgi kutusundan); tanınmayan bir alt model */
const wd = (gen: string, label: string, extra: Record<string, string> = {}) => ({
  seriesId: 'Q1',
  seriesLabel: 'BMW 3 Series',
  genId: gen,
  genLabel: label,
  ...extra,
});
const fakeWikidata: WikidataClient = {
  generations: async () => [
    wd('Q10', 'BMW 3 Series (E36)', {
      start: '1990-01-01T00:00:00Z',
      end: '2000-01-01T00:00:00Z',
      commons: 'BMW E36',
    }),
    wd('Q11', 'BMW 3 Series (G20)', { enTitle: 'BMW 3 Series (G20)', commons: 'BMW G20' }),
    wd('Q12', 'BMW 3 Series Gran Turismo'),
    { ...wd('Q13', 'Lancia Delta III'), seriesLabel: 'Lancia Delta' },
  ],
  productions: async () => ({ 'BMW 3 Series (G20)': { revision: 7, production: 'October 2018 – present' } }),
};

/** VehiclesDB sürümü: motosiklet, moped, kamyon (seri), otomobil (alınmaz) ve kalite için dolgu */
const VDB_CSV = [
  'kind,make_slug,make_name,model_slug,model_name,body_types,countries,regions,global_popularity_decile,aliases,former_ids,mass_popularity_decile',
  'motorcycle,honda,Honda,cbr650r,CBR650R,,nl|gb,eu,9,"","",7',
  'motorcycle,honda,Honda,cbr-650r,CBR 650R,,de,eu,3,"","",1',
  'moped,piaggio,Piaggio,liberty-50,Liberty 50,,it,eu,8,"","",6',
  'truck,mercedes-benz,Mercedes-Benz,actros,Actros,,nl,eu,9,"","",5',
  'car,bmw,BMW,3-series,3 Series,sedan,nl,eu,10,"","",10',
  ...Array.from({ length: 1100 }, (_, i) => `motorcycle,motodolgu,Motodolgu,m${i},M${i},,nl,eu,1,"","",1`),
].join(String.fromCharCode(10));
const vdb = { downloads: 0 };
const fakeVehiclesDb: VehiclesDbClient = {
  latest: async () => ({
    tag: 'v2026.10.4',
    csvUrl: 'https://github.com/vehiclesdb/vehicles.csv',
    attributionUrl: 'https://github.com/vehiclesdb/ATTRIBUTION.md',
  }),
  download: async (url: string) => {
    vdb.downloads++;
    return new TextEncoder().encode(
      url.endsWith('.md')
        ? '# Attribution\n\n> Vehicle data by [VehiclesDB](https://vehiclesdb.com)\n'
        : VDB_CSV,
    );
  },
};

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(VEHICLESDB_CLIENT)
    .useValue(fakeVehiclesDb)
    .overrideProvider(WIKIDATA_CLIENT)
    .useValue(fakeWikidata)
    .overrideProvider(TSB_CLIENT)
    .useValue(fakeTsb)
    .overrideProvider(VMM_CLIENT)
    .useValue(fakeVmm)
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

describe('eski yıllar: vehicle-makes-models (1990–2005)', () => {
  it('sürüm indirilir, eski nesiller aynı seriye girer; aynı sürüm ikinci kez indirilmez', async () => {
    const r = await staffCall(app, 'POST', '/staff/catalog/sources/vmm/check', {}, owner);
    expect(r.body.durum).toBe('uygulandi');
    expect(r.body.outcome.version).toBe('v1.0.2');
    expect((await staffCall(app, 'POST', '/staff/catalog/sources/vmm/check', {}, owner)).body.durum).toBe(
      'yeni_dosya_yok',
    );
    expect(vmm.downloads).toBe(1);

    const bmw = (await get('/catalog/makes')).body.find((m: { name: string }) => m.name === 'BMW');
    const s3 = (await get(`/catalog/makes/${bmw.id}/series`)).body.filter(
      (s: { name: string }) => s.name === '3 Serisi',
    );
    expect(s3).toHaveLength(1); // TSB ile aynı seri
    const d = await get(`/catalog/series/${s3[0].id}?yil=1995`);
    expect(d.body.models.map((m: { name: string }) => m.name)).toEqual(['318i', '325i']);
    expect(d.body.bodies.map((b: { name: string }) => b.name)).toEqual(['Sedan']);
    expect(d.body.generations).toMatchObject([
      { name: '3 Series Sedan (1991)', startYear: 1991, endYear: 1998, years: [1995], body: 'Sedan' },
    ]);
    expect(d.body.trims).toEqual([]);
  });

  it('kaynak kapatılınca kayıtları katalogdan görünmez (silinmez), açılınca geri gelir', async () => {
    const off = await staffCall(app, 'PATCH', '/staff/catalog/sources/vmm', { active: false }, owner);
    expect(off.body.active).toBe(false);
    const names = async () => (await get('/catalog/makes')).body.map((m: { name: string }) => m.name);
    expect(await names()).not.toContain('Lada');
    expect(await names()).toContain('BMW');
    const bmw = (await get('/catalog/makes')).body.find((m: { name: string }) => m.name === 'BMW');
    const s3 = (await get(`/catalog/makes/${bmw.id}/series`)).body.find(
      (s: { name: string }) => s.name === '3 Serisi',
    );
    expect((await get(`/catalog/series/${s3.id}?yil=1995`)).body.models).toEqual([]);
    expect(await db.catalogVariant.count({ where: { source: 'vmm' } })).toBe(1104);

    await staffCall(app, 'PATCH', '/staff/catalog/sources/vmm', { active: true }, owner);
    expect(await names()).toContain('Lada');
    expect(
      await db.auditLog.count({ where: { action: 'katalog_kaynak_ayari', entityId: 'katalog.vmm' } }),
    ).toBe(2);
  });
});

describe('yerli klasikler: kaynaklı liste', () => {
  it('Şahin, Doğan, Kartal, Toros, Anadol katalogda; yıllar ve paketler maddedeki gibi', async () => {
    const r = await staffCall(app, 'POST', '/staff/catalog/sources/yerli/check', {}, owner);
    expect(r.body.durum).toBe('uygulandi');
    expect((await staffCall(app, 'POST', '/staff/catalog/sources/yerli/check', {}, owner)).body.durum).toBe(
      'yeni_dosya_yok',
    );

    const makes = (await get('/catalog/makes?kategori=otomobil')).body;
    const tofas = makes.find((m: { name: string }) => m.name === 'Tofaş');
    expect(makes.map((m: { name: string }) => m.name)).toEqual(expect.arrayContaining(['Tofaş', 'Anadol']));
    const series = (await get(`/catalog/makes/${tofas.id}/series`)).body.map((s: { name: string }) => s.name);
    expect(series).toEqual(['Doğan', 'Kartal', 'Murat 124', 'Murat 131', 'Serçe', 'Şahin']);

    const sahin = (await get(`/catalog/makes/${tofas.id}/series`)).body.find(
      (s: { name: string }) => s.name === 'Şahin',
    );
    const d = await get(`/catalog/series/${sahin.id}?yil=1997`);
    expect(d.body.models.map((m: { name: string }) => m.name)).toEqual(['1.4', '1.6']);
    expect(d.body.trims.map((t: { name: string }) => t.name)).toEqual(['S']);
    expect(d.body.generations.map((g: { name: string }) => g.name)).toEqual(['İkinci nesil']);

    const renault = makes.find((m: { name: string }) => m.name === 'Renault');
    const toros = (await get(`/catalog/makes/${renault.id}/series`)).body.find(
      (s: { name: string }) => s.name === 'Toros',
    );
    expect(
      (await get(`/catalog/series/${toros.id}?yil=1995`)).body.bodies.map((b: { name: string }) => b.name),
    ).toEqual(['Sedan', 'Station wagon']);
  });
});

describe('kasa kuşağı ve nesil kodu: Wikidata (Sprint 6)', () => {
  it('kod kasa kuşaklarına yazılır; makyaj sırası yıllara göre; Commons kategorisi taşınır', async () => {
    const r = await staffCall(app, 'POST', '/staff/catalog/sources/wikidata/check', {}, owner);
    expect(r.body.durum).toBe('uygulandi');
    expect(r.body.outcome.stats).toMatchObject({
      generationsTotal: 2,
      generationsCoded: 3,
      unmatchedSeries: 0,
    });

    const bmw = (await get('/catalog/makes')).body.find((m: { name: string }) => m.name === 'BMW');
    const s3 = (await get(`/catalog/makes/${bmw.id}/series`)).body.find(
      (s: { name: string }) => s.name === '3 Serisi',
    );
    const d = await get(`/catalog/series/${s3.id}?yil=2022`);
    expect(
      d.body.generations.map((g: { name: string; code: string; facelift: number }) => [
        g.name,
        g.code,
        g.facelift,
      ]),
    ).toEqual([
      ['3 Series Sedan (2018)', 'G20', 0],
      ['3 Series Sedan (2022)', 'G20', 1],
    ]);
    expect(d.body.codes).toMatchObject([
      { code: 'G20', startYear: 2018, endYear: null, commonsCategory: 'BMW G20' },
    ]);
    expect(d.body.generations[0].commonsCategory).toBe('BMW G20');
    // 2023: TSB'de "LCI" yazmayan tip olsa da kuşak bilgisi makyajlı der.
    expect((await get(`/catalog/series/${s3.id}?yil=2023`)).body.makyaj).toEqual({
      makyajsiz: [],
      makyajli: [2023],
    });
    expect((await get(`/catalog/series/${s3.id}?yil=1995`)).body.generations[0]).toMatchObject({
      code: 'E36',
      facelift: 0,
    });
    const source = (await staffCall(app, 'GET', '/staff/catalog/sources', undefined, owner)).body.find(
      (x: { key: string }) => x.key === 'wikidata',
    );
    expect(source).toMatchObject({ generations: 2, generationsCoded: 2 });
  });
});

describe('ad eşleme (catalog_aliases)', () => {
  it('kural önerir; onaylanınca tipler hedef seriye taşınır ve sonraki içe aktarma eşlemeyi uygular', async () => {
    const list = await staffCall(app, 'GET', '/staff/catalog/aliases?durum=onerildi', undefined, owner);
    const s = list.body.find((a: { fromKey: string }) => a.fromKey === 'dolgu/seri1-sport');
    expect(s).toMatchObject({
      source: 'vmm',
      toKey: 'dolgu/seri1',
      reason: 'ek',
      method: 'kural',
      variants: 1,
    });
    expect(s.to.name).toBe('SERI1');

    const support = (await loginAs(app, await createStaff(db, 'SUPPORT'))).token;
    expect((await staffCall(app, 'POST', `/staff/catalog/aliases/${s.id}/approve`, {}, support)).status).toBe(
      403,
    );

    const ok = await staffCall(app, 'POST', `/staff/catalog/aliases/${s.id}/approve`, {}, owner);
    expect(ok.body).toMatchObject({ status: 'onaylandi', tasinan: 1 });
    const v = await db.catalogVariant.findFirstOrThrow({
      where: { source: 'vmm', rawName: { startsWith: 'SERI1 Sport' } },
      include: { series: true, model: true },
    });
    expect(v.series?.key).toBe('dolgu/seri1');
    expect(v.model.key.startsWith('dolgu/seri1/')).toBe(true);
    expect(await db.auditLog.count({ where: { action: 'katalog_ad_esleme_onaylandi' } })).toBe(1);

    // Yeni sürümde aynı kayıt yine hedef seriye girer.
    vmm.tag = 'v1.0.3';
    expect((await staffCall(app, 'POST', '/staff/catalog/sources/vmm/check', {}, owner)).body.durum).toBe(
      'uygulandi',
    );
    const again = await db.catalogVariant.findFirstOrThrow({
      where: { source: 'vmm', rawName: { startsWith: 'SERI1 Sport' } },
      include: { series: true },
    });
    expect(again.series?.key).toBe('dolgu/seri1');
    const dolgu = (await get('/catalog/makes')).body.find((m: { name: string }) => m.name === 'Dolgu');
    const names = (await get(`/catalog/makes/${dolgu.id}/series`)).body.map((x: { name: string }) => x.name);
    expect(names).not.toContain('SERI1 Sport');

    // Onaylanmış eşleme ikinci kez onaylanmaz; eşleme kaydı silinmez.
    expect((await staffCall(app, 'POST', `/staff/catalog/aliases/${s.id}/approve`, {}, owner)).status).toBe(
      409,
    );
    await expect(db.catalogAlias.delete({ where: { id: s.id } })).rejects.toThrow();
  });
});

describe('VehiclesDB: motosiklet, kamyon, otobüs, van (CC BY 4.0)', () => {
  it('türler kategoriye girer, otomobil alınmaz; aynı yazım tek model; atıf metni saklanır', async () => {
    const r = await staffCall(app, 'POST', '/staff/catalog/sources/vehiclesdb/check', {}, owner);
    expect(r.body.durum).toBe('uygulandi');
    expect(r.body.outcome.stats).toMatchObject({ items: 1104, outOfScope: 1 });
    expect(
      (await staffCall(app, 'POST', '/staff/catalog/sources/vehiclesdb/check', {}, owner)).body.durum,
    ).toBe('yeni_dosya_yok');

    const moto = (await get('/catalog/makes?kategori=motosiklet')).body;
    const honda = moto.find((m: { name: string }) => m.name === 'Honda');
    const models = (await get(`/catalog/makes/${honda.id}/models?kategori=motosiklet`)).body;
    expect(models.map((m: { name: string }) => m.name)).toEqual(['CBR650R']); // "CBR 650R" aynı model
    expect(moto.map((m: { name: string }) => m.name)).toContain('Piaggio');

    const ticari = (await get('/catalog/makes?kategori=ticari')).body;
    const mb = ticari.find((m: { name: string }) => m.name === 'Mercedes-Benz');
    const series = (await get(`/catalog/makes/${mb.id}/series?kategori=ticari`)).body;
    expect(series.map((s: { name: string }) => s.name)).toContain('Actros');
    expect(
      await db.catalogVariant.count({ where: { source: 'vehiclesdb', categories: { has: 'otomobil' } } }),
    ).toBe(0);

    const att = (await get('/catalog/attributions')).body;
    const v = att.find((a: { key: string }) => a.key === 'vehiclesdb');
    expect(v).toMatchObject({ license: 'CC BY 4.0', attribution: 'Vehicle data by VehiclesDB' });
    expect(v.notice).toContain('Vehicle data by [VehiclesDB](https://vehiclesdb.com)');
    // Kapalı kaynak atıf listesinde de görünmez
    await staffCall(app, 'PATCH', '/staff/catalog/sources/vehiclesdb', { active: false }, owner);
    expect((await get('/catalog/attributions')).body.map((a: { key: string }) => a.key)).not.toContain(
      'vehiclesdb',
    );
    await staffCall(app, 'PATCH', '/staff/catalog/sources/vehiclesdb', { active: true }, owner);
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
    // 318i ve 325i 1990'lardan (vehicle-makes-models, önceki test)
    expect(detail.body.models.map((m: { name: string }) => m.name)).toEqual(['318i', '320d', '320i', '325i']);
    expect(detail.body.bodies.map((b: { name: string }) => b.name)).toEqual(['Sedan', 'Station wagon']);
    // Kodlu kuşak yılları (E36 1991–1998, G20 2018–) kuşaktan; diğerleri (arşiv 2006–2013) TSB işaretinden.
    expect(detail.body.makyaj).toEqual({
      makyajsiz: [
        1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2018,
        2019, 2020, 2021, 2022,
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
