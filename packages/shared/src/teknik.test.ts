import { describe, expect, it } from 'vitest';
import { teknikBolumleri, teknikSatirlari, vitesYaz } from './teknik.js';

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

describe('ayrıntılı teknik tablo (sahip isteği, 17 Kasım 2026)', () => {
  it('bölüm bölüm; boş bölüm gelmez; birimler ve Türkçe terimler', () => {
    const b = teknikBolumleri({
      vitesler: ['otomatik:8'],
      kw: null,
      hp: [170, 170],
      tuketim: [5.9, 6.1],
      co2: null,
      agirlik: null,
      euro: ['6'],
      surum: 1,
      hizlanma: [8.1, 8.3],
      azamiHiz: [225, 225],
      cekisler: ['arkadan'],
      silindirler: ['L4'],
      yakitSistemleri: ['Turbocharged Direct Injection'],
      frenOn: ['Ventilated Discs'],
    });
    expect(b.map((x) => x.baslik)).toEqual([
      'Motor',
      'Performans',
      'Şanzıman ve çekiş',
      'Yakıt tüketimi ve emisyon',
      'Lastik ve fren',
    ]);
    const hepsi = Object.fromEntries(b.flatMap((x) => x.satirlar));
    expect(hepsi).toMatchObject({
      '0-100 km/s': '8,1–8,3 sn',
      'Azami hız': '225 km/s',
      Çekiş: 'Arkadan itiş',
      Silindir: '4 silindir, sıralı',
      'Yakıt sistemi': 'Turbo Direkt enjeksiyon',
      'Ön fren': 'Havalandırmalı disk',
      Karma: '5,9–6,1 l/100 km',
    });
  });
});
