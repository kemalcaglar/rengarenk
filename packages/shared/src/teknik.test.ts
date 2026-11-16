import { describe, expect, it } from 'vitest';
import { teknikSatirlari, vitesYaz } from './teknik.js';

describe('teknik özet gösterimi', () => {
  it('vites, güç, tüketim, CO2, ağırlık ve Euro normu Türkçe yazılır; aralık ve seçenek korunur', () => {
    expect(vitesYaz('manuel:6')).toBe('6 ileri manuel');
    expect(vitesYaz('otomatik:')).toBe('Otomatik');
    expect(
      teknikSatirlari({
        vitesler: ['manuel:6', 'otomatik:7'],
        kw: [81, 81],
        hp: [110, 110],
        tuketim: [4.2, 4.8],
        co2: [98, 110],
        agirlik: [1290, 1395],
        euro: ['5', '6'],
        surum: 4,
      }),
    ).toEqual([
      ['Vites', '6 ileri manuel ya da 7 ileri otomatik'],
      ['Güç', '110 hp (81 kW)'],
      ['Karma tüketim', '4,2–4,8 l/100 km'],
      ['CO₂', '98–110 g/km'],
      ['Boş ağırlık', '1.290–1.395 kg'],
      ['Emisyon', 'Euro 5, Euro 6'],
    ]);
  });

  it('bilinmeyen alanlar gösterilmez', () => {
    expect(
      teknikSatirlari({
        vitesler: [],
        kw: null,
        hp: null,
        tuketim: null,
        co2: null,
        agirlik: null,
        euro: [],
        surum: 1,
      }),
    ).toEqual([]);
  });
});
