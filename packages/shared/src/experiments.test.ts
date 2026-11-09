import { describe, expect, it } from 'vitest';
import { abSummary, abTest, armOf } from './experiments.js';

describe('A/B testleri', () => {
  it('kol sabit ve yaklaşık yarı yarıya', () => {
    expect(armOf('kisi-1', 'kampanya-1')).toBe(armOf('kisi-1', 'kampanya-1'));
    let b = 0;
    for (let i = 0; i < 10_000; i++) if (armOf(`kisi-${i}`, 'deney') === 'B') b++;
    expect(b).toBeGreaterThan(4_800);
    expect(b).toBeLessThan(5_200);
  });

  it('iki oranlı z testi: anlamlı fark ve yetersiz örnek', () => {
    // %3,1 ve %4,4, kol başına 3.000: anlamlı (güven ≈ %99)
    const r = abTest(3000, 93, 3000, 132);
    expect(r.farkPuan).toBeCloseTo(1.3, 5);
    expect(r.guven).toBeGreaterThan(0.98);
    expect(r.kazanan).toBe('B');
    expect(abSummary(r, 'tıklama')).toBe('A/B · B önde: tıklama %4,4 / A %3,1 · güven %99');
    // Aynı oranlar, az örnek: kazanan yok
    const az = abTest(50, 2, 50, 3);
    expect(az.kazanan).toBeNull();
    expect(az.guven).toBeLessThan(0.5);
    expect(abSummary(abTest(0, 0, 0, 0), 'okunma')).toBe('A/B · henüz veri yok');
  });
});
