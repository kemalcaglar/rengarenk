import { describe, expect, it } from 'vitest';
import { meanTest } from './experiments.js';
import { priceExperimentCheck, priceExperimentSchema } from './price-experiments.js';

const kol = (degerler: number[]) => ({
  n: degerler.length,
  toplam: degerler.reduce((t, x) => t + x, 0),
  kare: degerler.reduce((t, x) => t + x * x, 0),
});

describe('fiyat deneyleri (Karar 56)', () => {
  it('B fiyatı liste fiyatından farklı ve en çok %50 uzak olmalı', () => {
    expect(priceExperimentCheck(99, 99)).toBe('B fiyatı liste fiyatıyla aynı');
    expect(priceExperimentCheck(99, 119)).toBeNull();
    expect(priceExperimentCheck(99, 49)).toContain('%50');
    expect(
      priceExperimentSchema.safeParse({ ad: 'Deneme fiyatı', urun: 'mesaj_10', fiyatB: 119.99, gun: 14 })
        .success,
    ).toBe(true);
    expect(
      priceExperimentSchema.safeParse({ ad: 'Deneme fiyatı', urun: 'mesaj_10', fiyatB: 119.999, gun: 14 })
        .success,
    ).toBe(false);
    expect(
      priceExperimentSchema.safeParse({ ad: 'Deneme fiyatı', urun: 'yok', fiyatB: 119, gun: 14 }).success,
    ).toBe(false);
    expect(
      priceExperimentSchema.safeParse({ ad: 'Deneme fiyatı', urun: 'mesaj_10', fiyatB: 119, gun: 3 }).success,
    ).toBe(false);
  });

  it('kullanıcı başına gelir: yeterli örnek ve güvenle kazanan', () => {
    // A: 150 kişiden 30'u 99 TL; B: 150 kişiden 75'i 119 TL
    const a = kol(Array.from({ length: 150 }, (_, i) => (i % 5 === 0 ? 9900 : 0)));
    const b = kol(Array.from({ length: 150 }, (_, i) => (i % 2 === 0 ? 11_900 : 0)));
    const r = meanTest(a, b);
    expect(r.a.ort).toBe(1980);
    expect(r.b.ort).toBe(5950);
    expect(r.kazanan).toBe('B');
    expect(r.guven).toBeGreaterThan(0.99);
    // Az örnekte kazanan yok
    expect(meanTest(kol([0, 9900, 0]), kol([11_900, 11_900, 0])).kazanan).toBeNull();
    // Fark yoksa güven düşük
    expect(meanTest(a, a).kazanan).toBeNull();
  });
});
