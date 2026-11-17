import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from './category-defaults.js';
import { effectiveFields } from './category-schema.js';
import {
  acikSoruSayisi,
  butceDegeri,
  kasaTipiOf,
  kesinSecenekler,
  kriterSirasi,
  secimiDaralt,
  uygunSecenekler,
} from './sihirbaz.js';

const otomobil = DEFAULT_CATEGORIES.find((c) => c.slug === 'otomobil')?.definition;
if (!otomobil) throw new Error('otomobil yok');
const kriterler = effectiveFields(otomobil).filter((f) => f.step === 'kriterler');
const alan = (k: string) => {
  const f = kriterler.find((x) => x.key === k);
  if (!f) throw new Error(`${k} yok`);
  return f;
};

describe('sihirbaz 3. adım (sahip isteği, 17 Kasım 2026)', () => {
  it('sıra: kasa, paket, yıl, diğerleri, bütçe en sonda; hasar kaydı, motor hacmi ve gücü sorulmaz', () => {
    const s = kriterSirasi(kriterler).map((f) => f.key);
    expect(s.slice(0, 3)).toEqual(['kasa', 'paket', 'yil']);
    expect(s.at(-1)).toBe('butce');
    expect(s).not.toContain('hasar');
    expect(s).not.toContain('motorHacmi');
    expect(s).not.toContain('motorGucu');
  });

  it('adım adım açılır: yanıtlanan sorunun bir sonrasına kadar; "Fark etmez" de yanıttır', () => {
    const s = kriterSirasi(kriterler);
    const v: Record<string, unknown> = {};
    const yanitli = (f: { key: string }) => v[f.key] !== undefined;
    expect(acikSoruSayisi(s, yanitli, new Set())).toBe(1);
    v.kasa = ['F30:0'];
    expect(acikSoruSayisi(s, yanitli, new Set())).toBe(2);
    expect(acikSoruSayisi(s, yanitli, new Set(['paket']))).toBe(3);
    // Yeniden açılan taslakta sonraki yanıtlı soru öncekileri de açık tutar
    expect(acikSoruSayisi(s, (f) => f.key === 'km', new Set())).toBe(s.findIndex((f) => f.key === 'km') + 2);
  });

  it('kasaya göre yakıt, vites ve kasa tipi daralır; katalog bilgi vermiyorsa daraltılmaz', () => {
    const tipler = [
      { years: [2009, 2010], fuel: 'benzin', gearbox: 'otomatik', body: null },
      { years: [2010, 2011], fuel: 'dizel', gearbox: 'manuel', body: null },
      { years: [2015], fuel: 'elektrik', gearbox: 'otomatik', body: null },
    ];
    const y = { min: 2009, max: 2011 };
    // Benzinliye LPG takılabilir
    expect(uygunSecenekler(alan('yakit'), tipler, y).map((o) => o.value)).toEqual([
      'benzin',
      'dizel',
      'lpg_benzin',
    ]);
    expect(uygunSecenekler(alan('vites'), tipler, y).map((o) => o.value)).toEqual(['manuel', 'otomatik']);
    expect(
      uygunSecenekler(alan('kasaTipi'), tipler, y, ['Sedan', 'Station wagon']).map((o) => o.value),
    ).toEqual(['sedan', 'station_wagon']);
    // Gövde bilinmiyor: bütün kasa tipleri
    expect(uygunSecenekler(alan('kasaTipi'), tipler, y)).toHaveLength(alan('kasaTipi').options?.length ?? 0);
    // Vitesi bilinmeyen tip çoksa vites daraltılmaz
    const bilinmez = tipler.map((t) => ({ ...t, gearbox: null }));
    expect(uygunSecenekler(alan('vites'), bilinmez, y)).toHaveLength(3);
    // Kasa seçilmediyse (yıl elle) daraltılmaz
    expect(uygunSecenekler(alan('yakit'), tipler, null)).toHaveLength(5);
  });

  it('kasa tipi ve çekiş: hepsi kesin ve en az iki farklı değer varsa sorulur, yalnızca var olanlarla', () => {
    const t = (body: string | null, drive: string | null, trimId = 'p1', years = [2020]) => ({
      years,
      fuel: 'benzin',
      gearbox: 'otomatik',
      body,
      drive,
      trimId,
    });
    const secim = { yillar: { min: 2019, max: 2022 } };
    // Hatchback ve coupe var: sedan seçeneği yok
    expect(
      kesinSecenekler(alan('kasaTipi'), [t('hatchback', 'onden'), t('coupe', 'onden')], secim)?.map(
        (o) => o.value,
      ),
    ).toEqual(['hatchback', 'coupe']);
    // Tek kasa tipi ya da tek çekiş: sorulmaz
    expect(
      kesinSecenekler(alan('kasaTipi'), [t('hatchback', 'onden'), t('hatchback', 'onden')], secim),
    ).toBeNull();
    expect(kesinSecenekler(alan('cekis'), [t('hatchback', 'onden'), t('coupe', 'onden')], secim)).toBeNull();
    // Bir tipte bilinmiyor: sorulmaz (tahmin yok)
    expect(kesinSecenekler(alan('cekis'), [t('sedan', 'onden'), t('sedan', null)], secim)).toBeNull();
    // Önden ve 4x4: otomobilde "4x4 / AWD" seçeneği
    expect(
      kesinSecenekler(alan('cekis'), [t('sedan', 'onden'), t('sedan', '4x4')], secim)?.map((o) => o.value),
    ).toEqual(['onden', 'dort']);
    // Paket seçildiyse yalnızca o paketin tipleri: p2 yalnızca 4x4 → sorulmaz
    expect(
      kesinSecenekler(alan('cekis'), [t('sedan', 'onden', 'p1'), t('sedan', '4x4', 'p2')], {
        ...secim,
        paketler: ['p2'],
      }),
    ).toBeNull();
    // Kasanın yıllarında tip yok ya da yıl seçilmedi: sorulmaz
    expect(kesinSecenekler(alan('cekis'), [t('sedan', 'onden', 'p1', [2010])], secim)).toBeNull();
    expect(kesinSecenekler(alan('cekis'), [t('sedan', 'onden')], { yillar: null })).toBeNull();
  });

  it('yardımcılar: kasa tipi adı, seçimden düşen, tek rakam bütçe', () => {
    expect(kasaTipiOf('Hatchback 5 kapı')).toBe('hatchback');
    expect(kasaTipiOf('Cabrio')).toBe('cabrio');
    expect(kasaTipiOf(null)).toBeNull();
    expect(secimiDaralt(['dizel', 'elektrik'], [{ value: 'dizel', label: 'Dizel' }])).toEqual(['dizel']);
    expect(secimiDaralt(['elektrik'], [{ value: 'dizel', label: 'Dizel' }])).toBeUndefined();
    expect(butceDegeri({ min: 500_000, max: 900_000 })).toBe(900_000);
    expect(butceDegeri({ min: 500_000 })).toBe(500_000);
    expect(butceDegeri(undefined)).toBeUndefined();
  });
});
