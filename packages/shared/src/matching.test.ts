import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from './category-defaults.js';
import { diffDefinitions, effectiveFields } from './category-schema.js';
import { IL_KOMSU_CIFT, ilKomsulari } from './il-komsulari.js';
import {
  evaluateMatch,
  iyelik,
  listeYaz,
  type MatchCriterion,
  type MatchVehicle,
  matchCountText,
  matchSummary,
  paintFit,
} from './matching.js';

const otomobil = DEFAULT_CATEGORIES.find((c) => c.slug === 'otomobil')?.definition;
if (!otomobil) throw new Error('otomobil yok');

const talep = (alt: Record<string, unknown> = {}, alanlar: Record<string, unknown> = {}) => ({
  alanlar: {
    model: { make: 'bmw', series: 'bmw-3-serisi', model: 'bmw-3-serisi-320i' },
    konum: { il: 'İstanbul', ilce: 'Kadıköy' },
    ...alanlar,
  },
  alternatifler: [
    {
      butce: { min: 2_000_000, max: 2_400_000 },
      yil: { min: 2019, max: 2022 },
      km: 80_000,
      yakit: ['benzin'],
      vites: ['otomatik'],
      hasar: 'yok',
      ...alt,
    },
  ],
});

const arac = (v: Partial<MatchVehicle> = {}): MatchVehicle => ({
  make: 'bmw',
  series: 'bmw-3-serisi',
  model: 'bmw-3-serisi-320i',
  year: 2020,
  km: 62_000,
  fuel: 'benzin',
  gearbox: 'otomatik',
  color: 'beyaz',
  price: 2_390_000,
  damage: { tramer: 0, parcalar: {} },
  il: 'İstanbul',
  ilce: 'Kadıköy',
  ...v,
});

describe('eşleşme skoru (Teknik tasarım §6)', () => {
  it('bütün kriterlere uyan araç 100 alır', () => {
    const r = evaluateMatch(otomobil, talep(), arac());
    expect(r.ok && r.score).toBe(100);
    if (r.ok) expect(matchSummary(r.criteria)).toBe('Tüm kriterlere uyuyor');
  });

  it('sert koşullar: il, marka, bütçe %5 toleransı, kimden, kabul edilmeyen işlem', () => {
    expect(evaluateMatch(otomobil, talep(), arac({ il: 'Kocaeli' }))).toEqual({ ok: false, reason: 'konum' });
    expect(evaluateMatch(otomobil, talep(), arac({ make: 'audi' }))).toEqual({ ok: false, reason: 'marka' });
    expect(evaluateMatch(otomobil, talep(), arac({ price: 2_530_000 }))).toEqual({
      ok: false,
      reason: 'butce',
    });
    const tol = evaluateMatch(otomobil, talep(), arac({ price: 2_460_000 }));
    expect(tol.ok && tol.score).toBeLessThan(100);
    expect(evaluateMatch(otomobil, talep({}, { kimden: ['sahibinden'] }), arac()).ok).toBe(false);
    expect(evaluateMatch(otomobil, talep(), arac({ damage: { sasiIslem: true } }))).toEqual({
      ok: false,
      reason: 'islem',
    });
    expect(
      evaluateMatch(otomobil, talep({}, { islemKabul: ['sasi'] }), arac({ damage: { sasiIslem: true } })).ok,
    ).toBe(true);
  });

  it('kısmi uyum ağırlıklı yüzdedir; farklı ilçe ve km aşımı skoru düşürür, renk farkı özette görünür', () => {
    const r = evaluateMatch(otomobil, talep({ renk: ['siyah'], km: 50_000 }), arac({ ilce: 'Maltepe' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.score).toBeGreaterThan(60);
    expect(r.score).toBeLessThan(100);
    expect(matchSummary(r.criteria)).toBe(
      'Bütçe, model, yıl, yakıt, vites ve hasar kriterlerine uyuyor; renk farklı',
    );
  });

  it('alternatiflerden en iyisi alınır', () => {
    const d = talep();
    d.alternatifler.push({ butce: { max: 1_000_000 }, yil: { min: 2015, max: 2016 } } as never);
    const r = evaluateMatch(otomobil, d, arac());
    expect(r.ok && r.alternative).toBe(0);
    const ters = { ...d, alternatifler: [d.alternatifler[1], d.alternatifler[0]] } as typeof d;
    const r2 = evaluateMatch(otomobil, ters, arac());
    expect(r2.ok && r2.alternative).toBe(1);
  });

  it('boya şeması: parça sınırı ve işlem sayısı', () => {
    expect(paintFit({ limit: 1, parts: { tavan: 'lokal' } }, { tavan: 'lokal' })).toBe(1);
    expect(paintFit({ limit: 1, parts: { tavan: 'lokal' } }, { tavan: 'boya' })).toBe(0);
    expect(paintFit({ limit: 0, parts: { tavan: 'lokal' } }, { tavan: 'lokal' })).toBe(0);
    expect(paintFit({ limit: 2, parts: {} }, { onTampon: 'boya' })).toBe(0);
  });

  it('metinler: liste, iyelik, kriter sayısı', () => {
    expect(listeYaz(['yıl', 'kilometre', 'renk'])).toBe('yıl, kilometre ve renk');
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 40].map(iyelik)).toEqual([
      '1’i',
      '2’si',
      '3’ü',
      '4’ü',
      '5’i',
      '6’sı',
      '7’si',
      '8’i',
      '9’u',
      '10’u',
      '20’si',
      '40’ı',
    ]);
    const c = (key: string, fit: number): MatchCriterion => ({ key, ad: key, weight: 1, fit, secim: true });
    expect(matchCountText([c('yıl', 1), c('kilometre', 1), c('renk', 0)])).toBe(
      '3 kriterin 2’si tutuyor: yıl ve kilometre.',
    );
  });
});

describe('komşu il (Teknik tasarım §6: komşu il 0,5)', () => {
  it('81 il, 200 komşu çifti, iki yönlü; İstanbul–Kırklareli kısa sınırı dahil', () => {
    expect(IL_KOMSU_CIFT).toBe(200);
    expect([...ilKomsulari('İstanbul')].sort()).toEqual(['Kocaeli', 'Kırklareli', 'Tekirdağ'].sort());
    expect(ilKomsulari('Kilis')).toEqual(['Gaziantep']);
    for (const il of ['Ankara', 'Hakkari', 'Batman', 'Mardin'])
      for (const k of ilKomsulari(il)) expect(ilKomsulari(k)).toContain(il);
    expect(ilKomsulari('Yok')).toEqual([]);
  });

  it('konum kapsamı "komşu": komşu ildeki araç 0,5 konum uyumuyla eşleşir, uzak il yine dışarıda', () => {
    const komsu = { ...otomobil, konumKapsami: 'komsu' as const };
    expect(effectiveFields(komsu).find((f) => f.key === 'konum')?.hard).toBe('no');
    expect(evaluateMatch(otomobil, talep(), arac({ il: 'Kocaeli', ilce: 'İzmit' }))).toEqual({
      ok: false,
      reason: 'konum',
    });
    const r = evaluateMatch(komsu, talep(), arac({ il: 'Kocaeli', ilce: 'İzmit' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.criteria.find((c) => c.key === 'konum')?.fit).toBe(0.5);
    expect(evaluateMatch(komsu, talep(), arac({ il: 'Ankara' }))).toEqual({ ok: false, reason: 'konum' });
    expect(diffDefinitions(otomobil, komsu).changes).toContain(
      'Konum kapsamı: Yalnızca alıcının ili → Komşu iller de (konum uyumu 0,5)',
    );
  });
});
