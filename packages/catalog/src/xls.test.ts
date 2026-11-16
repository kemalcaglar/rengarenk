import { describe, expect, it } from 'vitest';
import { buildTsbSnapshot } from './snapshot.js';
import { readTsbList } from './tsb/read.js';
import { isXls, readXlsFirstSheet } from './xls.js';
import { xlsYaz } from './xls-yaz.js';

describe('eski Excel (.xls) okuyucusu', () => {
  it('metin ve sayı hücrelerini okur; Türkçe harfler ve CONTINUE ile bölünmüş metin bozulmaz', () => {
    const rows = [
      ['Şubat 2007', null, 'Bedeller YTL üzerinden verilmiştir.'],
      ['MarkaKodu', 'TipKodu', 'Marka', 'Tip', '2007_Fiyatı', '2006_Fiyatı'],
      [3, 15, 'ALFA ROMEO', '33 1.7 IE', 0, 7400.5],
      [153, 1086, 'VOLKSWAGEN', 'GOLF VII 1.6 TDI BMT 105 COMFORTLINE TIP. DSG ÇİFT ŞANZIMAN', 61000, 0],
    ];
    for (const kayitBoyu of [8224, 40, 17]) {
      const f = xlsYaz(rows, { kayitBoyu });
      expect(isXls(f)).toBe(true);
      expect(readXlsFirstSheet(f)).toEqual(rows.map((r) => r.map((c) => c ?? null)));
    }
  });

  it('büyük dosya: birden çok FAT sektörü ve uzun akış', () => {
    const rows = Array.from({ length: 3000 }, (_, i) => [i, `TİP ${i} ŞÖÇĞÜİ`, i * 1.5, 0]);
    expect(readXlsFirstSheet(xlsYaz(rows))).toEqual(rows);
  });

  it('xlsx dosyası eski Excel sayılmaz', () => {
    expect(isXls(new Uint8Array([0x50, 0x4b, 3, 4, ...new Array(600).fill(0)]))).toBe(false);
  });
});

describe('2006–2019 TSB listeleri (Karar 33)', () => {
  it('eski başlıklar ve dönem yazımı: "2006 KASIM", "Marka Kodu", "Tip Adı"', () => {
    const f = xlsYaz([
      ['2006 KASIM', null, null, null, 'Bedeller YTL üzerinden verilmiştir.'],
      ['Marka Kodu', 'Tip Kodu', 'Marka Adı', 'Tip Adı', 2007, 2006, 1994, 1993],
      [3, 15, 'ALFA ROMEO', '33 1.7 IE', 0, 0, 7400, 6650],
    ]);
    const l = readTsbList(f);
    expect(l).toMatchObject({ year: 2006, month: 11 });
    expect(l.rows).toEqual([
      { brandCode: '3', typeCode: '15', brandName: 'ALFA ROMEO', typeName: '33 1.7 IE', years: [1993, 1994] },
    ]);
  });

  it('"2007_Fiyatı" sütunları ve "Marka", "Tip" başlıkları; sürüm dönemden', () => {
    const f = xlsYaz([
      ['Şubat 2007'],
      ['MarkaKodu', 'TipKodu', 'Marka', 'Tip', '2007_Fiyatı', '2006_Fiyatı', '2005_Fiyatı'],
      [3, 18, 'ALFA ROMEO', 'SPIDER 2000', 0, 12000, 11000],
      [21, 700, 'BMW', '316i 1.6 OV', 0, 0, 21000],
    ]);
    const snap = buildTsbSnapshot(f);
    expect(snap.version).toBe('2007-02');
    expect(snap.items.map((i) => [i.sourceKey, i.years])).toEqual([
      ['3-18', [2005, 2006]],
      ['21-700', [2005]],
    ]);
  });

  it('başında sıfır olan metin kodlar sayıya çevrilir ("003-090" = "3-90")', () => {
    const f = xlsYaz([
      ['Nisan 2010'],
      ['MarkaKodu', 'TipKodu', 'Marka', 'Tip', '2010_Fiyatı'],
      ['003', '090', 'ALFA ROMEO', '156 1.9 JTD', 30000],
    ]);
    expect(buildTsbSnapshot(f).items.map((i) => i.sourceKey)).toEqual(['3-90']);
  });

  it('dönem yazılı değilse verilen dönem kullanılır', () => {
    const f = xlsYaz([
      ['MarkaKodu', 'TipKodu', 'MarkaAdı', 'TipAdı', 2010],
      [3, 1004, 'ALFA ROMEO', 'MITO 1.3 JTD (95) CITY', 47500],
    ]);
    expect(() => readTsbList(f)).toThrow(/dönemi/);
    expect(buildTsbSnapshot(f, { period: { year: 2010, month: 3 } }).version).toBe('2010-03');
  });
});
