import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type AdemeSurum,
  ademeAciklama,
  ademeVites,
  ademeYakit,
  ademeYerlestir,
  ozetBirlestir,
  readAdemeYil,
  teknikEslestir,
} from './ademe.js';

const csv = (satirlar: string[][]) => {
  const metin = satirlar.map((r) => r.join(';')).join('\r\n');
  // Dosyalar Windows-1252: Türkçe/Fransızca harf yok, ASCII yeter
  return zipSync({ 'carlab.csv': strToU8(metin) });
};

const BASLIK = [
  'lib_mrq',
  'lib_mod_doss',
  'lib_mod',
  'dscom',
  'cnit',
  'typ_cbr',
  'puiss_max',
  'typ_boite_nb_rapp',
  'conso_mixte',
  'co2',
  'masse_ordma_min',
  'masse_ordma_max',
  'champ_v9',
];

describe('ADEME onay verisi (Karar 33)', () => {
  it('yakıt ve vites kodları', () => {
    expect(['ES', 'GO', 'EH', 'EL', 'GP/ES'].map(ademeYakit)).toEqual([
      'benzin',
      'dizel',
      'hibrit',
      'elektrik',
      'lpg',
    ]);
    expect(ademeVites('M 6')).toEqual({ vites: 'manuel', vitesSayisi: 6 });
    expect(ademeVites('A 7')).toEqual({ vites: 'otomatik', vitesSayisi: 7 });
    expect(ademeVites('V 0')).toEqual({ vites: 'otomatik', vitesSayisi: null });
    expect(ademeVites('S 6')).toEqual({ vites: 'yari_otomatik', vitesSayisi: 6 });
    expect(ademeVites('MECANIQUE', 6)).toEqual({ vites: 'manuel', vitesSayisi: 6 });
  });

  it('açıklama ve seri: marka tekrarı, "NOUVELLE", bitişik yazım, BMW motor kodu, "CLASSE C"', () => {
    expect(ademeAciklama('AUDI TT COUPE 1.8TFSI (160ch)', 'AUDI', 'Audi')).toBe('TT COUPE 1.8TFSI (160ch)');
    expect(ademeAciklama('NOUVELLE COROLLA 3P 100 VVT-i', 'TOYOTA', 'Toyota')).toBe('COROLLA 3P 100 VVT-i');
    expect(ademeAciklama('MAZDA3 4P 2.0L', 'MAZDA', 'Mazda')).toBe('3 4P 2.0L');
    expect(ademeAciklama('Grande Grande PUNTO 1.4', 'FIAT', 'Fiat')).toBe('Grande PUNTO 1.4');
    expect(ademeYerlestir('BMW', '320', '320d Berline').seri).toBe('3 Serisi');
    expect(ademeYerlestir('MERCEDES', 'CLASSE C', 'C 200 CDI')).toMatchObject({
      marka: 'Mercedes-Benz',
      seri: 'C Serisi',
    });
    expect(ademeYerlestir('MAZDA', null, 'MAZDA3 4P 2.0L').seri).toBe('3');
    expect(ademeYerlestir('RENAULT', null, 'MEGANE Berline dCi (110ch)').seri).toBe('Megane');
  });

  it('yıllık dosya: aynı sürümün onay satırları birleşir, tüketim ve ağırlık aralık olur', () => {
    const xs = readAdemeYil(
      csv([
        BASLIK,
        [
          'RENAULT',
          'MEGANE',
          'MEGANE',
          'MEGANE Berline dCi (110ch)',
          'A1',
          'GO',
          '81',
          'M 6',
          '3,8',
          '98',
          '1290',
          '1290',
          'EURO5',
        ],
        [
          'RENAULT',
          'MEGANE',
          'MEGANE',
          'MEGANE Berline dCi (110ch)',
          'A2',
          'GO',
          '81',
          'M 6',
          '4,099999905',
          '107',
          '1320',
          '1320',
          'EURO5',
        ],
        [
          'RENAULT',
          'MEGANE',
          'MEGANE',
          'MEGANE Berline dCi (110ch) EDC',
          'A3',
          'GO',
          '81',
          'A 6',
          '4,2',
          '110',
          '1330',
          '1330',
          'EURO5',
        ],
      ]),
      { yil: 2014 },
    );
    expect(xs).toHaveLength(2);
    expect(xs[0]).toMatchObject({
      yil: 2014,
      marka: 'Renault',
      seri: 'Megane',
      yakit: 'dizel',
      kw: 81,
      hp: 110,
      vites: 'manuel',
      vitesSayisi: 6,
      tuketimMin: 3.8,
      tuketimMax: 4.1,
      co2Min: 98,
      co2Max: 107,
      agirlikMin: 1290,
      agirlikMax: 1320,
      euro: '5',
      adet: 2,
    });
  });

  const surum = (x: Partial<AdemeSurum>): AdemeSurum => ({
    yil: 2014,
    marka: 'Renault',
    seri: 'Megane',
    aciklama: 'MEGANE',
    yakit: 'dizel',
    kw: 81,
    hp: 110,
    hacim: 1.5,
    vites: 'manuel',
    vitesSayisi: 6,
    tuketimMin: 3.8,
    tuketimMax: 4.1,
    co2Min: 98,
    co2Max: 107,
    agirlikMin: 1290,
    agirlikMax: 1320,
    euro: '5',
    adet: 1,
    ...x,
  });
  const tip = {
    marka: 'Renault',
    seri: 'Megane',
    yakit: 'dizel',
    hp: 110,
    hacim: 1.5,
    vites: null,
    yillar: [2013, 2014],
  };

  it('eşleştirme: yakıt, yıl, güç ±2 hp, vites türü; bilinmeyen alan tahmin edilmez', () => {
    const adaylar = [
      surum({}),
      surum({ vites: 'otomatik', vitesSayisi: 6, co2Max: 115 }),
      surum({ hp: 130, kw: 96 }),
    ];
    expect(teknikEslestir(tip, adaylar)).toMatchObject({
      vitesler: ['manuel:6', 'otomatik:6'],
      hp: [110, 110],
      co2: [98, 115],
      surum: 2,
    });
    // TSB vitesi yazıyorsa yalnızca o tür
    expect(teknikEslestir({ ...tip, vites: 'otomatik' }, adaylar)?.vitesler).toEqual(['otomatik:6']);
    // Yıl tutmuyor (2014 dosyası 2013–2014 model yılı)
    expect(teknikEslestir({ ...tip, yillar: [2016] }, adaylar)).toBeNull();
    // Yakıt bilinmiyor: eşleşmez
    expect(teknikEslestir({ ...tip, yakit: null }, adaylar)).toBeNull();
    // Güç yoksa motor hacmi
    expect(teknikEslestir({ ...tip, hp: null }, adaylar)?.surum).toBe(3);
  });

  it('özetler birleşir: seçenekler ve aralıklar', () => {
    const a = teknikEslestir(tip, [surum({})]);
    const b = teknikEslestir({ ...tip, hp: 130 }, [
      surum({ hp: 130, kw: 96, vites: 'otomatik', vitesSayisi: 7 }),
    ]);
    expect(ozetBirlestir([a, b].filter((x) => x !== null))).toMatchObject({
      vitesler: ['manuel:6', 'otomatik:7'],
      hp: [110, 130],
      kw: [81, 96],
      surum: 2,
    });
    expect(ozetBirlestir([])).toBeNull();
  });
});
