import { describe, expect, it } from 'vitest';
import {
  aralikMetni,
  aralikOku,
  bosOzet,
  duzeltmeUygula,
  teknikBolumleri,
  teknikEksikleri,
  teknikOneCikanlar,
  teknikSatirlari,
  vitesYaz,
} from './teknik.js';

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

describe('elle düzeltme (sahip isteği, 17 Kasım 2026)', () => {
  it('aralık metni okunur ve yazılır', () => {
    expect(aralikOku('150')).toEqual([150, 150]);
    expect(aralikOku('1,5–1,7')).toEqual([1.5, 1.7]);
    expect(aralikOku('150 - 170')).toEqual([150, 170]);
    expect(aralikOku('1.598')).toEqual([1598, 1598]);
    expect(aralikOku('170-150')).toBeNull();
    expect(aralikOku('yok')).toBeNull();
    expect(aralikMetni([1598, 1598])).toBe('1598');
    expect(aralikMetni([9.1, 9.8], 1)).toBe('9,1–9,8');
  });

  it('düzeltme kaynak değerinin yerine geçer, yazılmayan alan kalır; boş özete eklenebilir', () => {
    const o = {
      ...bosOzet(),
      hp: [150, 150] as [number, number],
      tork: [250, 250] as [number, number],
      kaynaklar: ['vmm'],
    };
    const d = duzeltmeUygula(o, [{ hp: [156, 156] }, { cekisler: ['onden'] }]);
    expect(d).toMatchObject({
      hp: [156, 156],
      tork: [250, 250],
      cekisler: ['onden'],
      kaynaklar: ['vmm', 'manuel'],
    });
    expect(duzeltmeUygula(null, [{ hizlanma: [8.9, 8.9] }])).toMatchObject({
      hizlanma: [8.9, 8.9],
      surum: 0,
    });
    expect(duzeltmeUygula(o, [])).toBe(o);
  });
});

describe('satır gizleme ve ek satırlar (sahip isteği, 18 Kasım 2026)', () => {
  const o = {
    ...bosOzet(),
    hp: [90, 90] as [number, number],
    tork: [142, 142] as [number, number],
    segmentler: ['B'],
    kapilar: [5, 5] as [number, number],
    uzunluk: [4053, 4053] as [number, number],
  };
  it('gizlenen satır görünmez, eksik sayılmaz; ek satır bölümüne ya da yeni bölüme eklenir', () => {
    const r = duzeltmeUygula(
      o,
      [],
      [
        {
          gizli: ['segmentler', 'hizlanma'],
          ekSatirlar: [{ bolum: 'Genel', etiket: 'Garanti', deger: '5 yıl' }],
        },
        { ekSatirlar: [{ bolum: 'Elektrik', etiket: 'Şarj soketi', deger: 'Tip 2' }] },
      ],
    ) as NonNullable<ReturnType<typeof duzeltmeUygula>>;
    const b = teknikBolumleri(r);
    expect(b[0]).toEqual({
      baslik: 'Genel',
      satirlar: [
        ['Kapı sayısı', '5'],
        ['Garanti', '5 yıl'],
      ],
    });
    expect(b.at(-1)).toEqual({ baslik: 'Elektrik', satirlar: [['Şarj soketi', 'Tip 2']] });
    expect(teknikEksikleri(r)).not.toContain('0-100 km/s');
    expect(teknikEksikleri(o)).toContain('0-100 km/s');
    expect(r.kaynaklar).toContain('manuel');
  });
  it('aynı etiketli ek satır kaynaktaki satırın yerine geçer; sonraki kayıt öncekini ezer', () => {
    const r = duzeltmeUygula(
      o,
      [],
      [
        { ekSatirlar: [{ bolum: 'Motor', etiket: 'Güç', deger: '91 hp' }] },
        { ekSatirlar: [{ bolum: 'Motor', etiket: 'güç', deger: '92 hp' }] },
      ],
    ) as NonNullable<ReturnType<typeof duzeltmeUygula>>;
    const motor = teknikBolumleri(r).find((x) => x.baslik === 'Motor');
    expect(motor?.satirlar).toEqual([
      ['güç', '92 hp'],
      ['Tork', '142 Nm'],
    ]);
  });
  it('öne çıkanlar gizlenen değeri atlar', () => {
    expect(teknikOneCikanlar(o).map((x) => x.etiket)).toEqual(['Güç', 'Tork']);
    expect(teknikOneCikanlar({ ...o, gizli: ['tork'] }).map((x) => x.etiket)).toEqual(['Güç']);
    expect(teknikSatirlari({ ...o, gizli: ['hp'] })).toEqual([]);
  });
});
