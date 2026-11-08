import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES } from './category-defaults.js';
import { demandSchema } from './category-schema.js';
import { ILLER } from './iller.js';

describe('il ve ilçeler', () => {
  it('resmî sayılarla aynı: 81 il, 973 ilçe; plakalar 01–81 tekil', () => {
    expect(ILLER).toHaveLength(81);
    expect(ILLER.reduce((n, i) => n + i.ilceler.length, 0)).toBe(973);
    expect(ILLER.map((i) => Number(i.plaka))).toEqual(Array.from({ length: 81 }, (_, i) => i + 1));
    const say = (ad: string) => ILLER.find((i) => i.ad === ad)?.ilceler.length;
    expect([say('İstanbul'), say('Ankara'), say('İzmir'), say('Bayburt')]).toEqual([39, 25, 30, 3]);
    expect(ILLER.find((i) => i.plaka === '42')?.ad).toBe('Konya');
    for (const il of ILLER) expect(new Set(il.ilceler).size).toBe(il.ilceler.length);
  });

  it('talepte bilinmeyen il ve başka ilin ilçesi reddedilir', () => {
    const def = DEFAULT_CATEGORIES.find((c) => c.slug === 'karavan')?.definition;
    if (!def) throw new Error('karavan');
    const s = demandSchema(def);
    const talep = (konum: object) => ({
      alanlar: { tip: 'cekme', konum },
      alternatifler: [{ butce: { max: 900_000 }, yil: { min: 2018 } }],
    });
    expect(s.safeParse(talep({ il: 'Muğla', ilce: 'Bodrum' })).success).toBe(true);
    expect(s.safeParse(talep({ il: 'Muğla', ilce: 'Kadıköy' })).success).toBe(false);
    expect(s.safeParse(talep({ il: 'Atlantis' })).success).toBe(false);
  });
});
