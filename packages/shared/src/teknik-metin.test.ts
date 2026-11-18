import { describe, expect, it } from 'vitest';
import { teknikBolumleri, teknikEksikleri } from './teknik.js';
import { donanimOku, donanimYaz, teknikMetniOku } from './teknik-metin.js';

/** Sahibin örnek metni (18 Kasım 2026, Renault Clio 1.0 TCe X-Tronic), sekmeyle ayrılmış */
const CLIO = `--Genel Bakış--
Model Üretim Yılı (İlk / Son)\t2020 / Devam ediyor
Segmenti\tB Segment
Kasa Tipi / Kapı Sayısı\tHatchback / 5 Kapı
Yakıt / Motor Tipi\tBenzin / 3 silindir
Yakıt Tüketimi (Şehir içi / Şehir dışı)\t6.0 lt / 4.4 lt
Motor Gücü\t90 hp
Şanzıman / Çekiş\tX-Tronic / VT Vites / Önden Çekiş
Hızlanma 0-100 km/saat\t12.4 sn
Azami Sürat\t175 km/saat
Yakıt Depo Hacmi\t42 lt
--Motor ve Performans--
Motor Hacmi\t999 cc
Maksimum Güç\t90 hp (66 kw) / 4.500 rpm
Maksimum Tork\t142 Nm / 1.750 rpm
Hızlanma 0-100 km/saat\t12.4 sn
Azami Sürat\t175 km/saat
--Boyutlar--
Koltuk Sayısı\t5 Koltuk
Uzunluk\t4050 mm
Genişlik\t1798 mm
Yükseklik\t1440 mm
Net Ağırlık\t1190 kg
Bagaj Kapasitesi\t391 lt
Lastik Ölçüleri\t195/55 R16 87H
--Donanım--
-Güvenlik-
ABS\t
Fren Yardım Sistemi (Brake Assist System)\t
Isofix\t
Lastik Basınç Kontrolü\t
Merkezi Kilit\t
Otomatik Dörtlü Flaşör\t
Yolcu Hava Yastığı\t
Sürücü Hava Yastığı\t
Yokuşta Kalkış Desteği\t
-İç Donanım-
Klima\t
Start/Stop\t
-Dış Donanım-
Yan Aynalar - Isıtmalı\t
-Multimedya-
Mobil Entegrasyon - Android Auto\t
Mobil Entegrasyon - Apple CarPlay\t
-Konfor-
Hız Sabitleme Sistemi`;

describe('teknik metni okuma (sahip isteği, 18 Kasım 2026)', () => {
  it('sahibin örnek metnindeki bütün değerler ve donanım okunur', () => {
    const r = teknikMetniOku(CLIO);
    expect(r.okunamayan).toEqual([]);
    expect(r.yillar).toEqual([2020, null]);
    expect(r.degerler).toEqual({
      segmentler: ['B'],
      govdeler: ['hatchback'],
      kapilar: [5, 5],
      silindirler: ['3'],
      tuketimSehir: [6, 6],
      tuketimSehirDisi: [4.4, 4.4],
      hp: [90, 90],
      kw: [66, 66],
      gucDevir: [4500, 4500],
      vitesler: ['otomatik:'],
      sanzimanlar: ['X-Tronic / VT Vites'],
      cekisler: ['onden'],
      hizlanma: [12.4, 12.4],
      azamiHiz: [175, 175],
      depo: [42, 42],
      hacimCc: [999, 999],
      tork: [142, 142],
      torkDevir: [1750, 1750],
      koltuklar: [5, 5],
      uzunluk: [4050, 4050],
      genislik: [1798, 1798],
      yukseklik: [1440, 1440],
      agirlik: [1190, 1190],
      bagaj: [391, 391],
      lastikler: ['195/55 R16 87H'],
    });
    expect(r.donanim.map((g) => [g.ad, g.ogeler.length])).toEqual([
      ['Güvenlik', 9],
      ['İç Donanım', 2],
      ['Dış Donanım', 1],
      ['Multimedya', 2],
      ['Konfor', 1],
    ]);
    expect(r.donanim[2]?.ogeler).toEqual(['Yan Aynalar - Isıtmalı']);
    // Gösterim: güç ve tork devriyle, genel bölüm başta
    const o = {
      vitesler: [],
      kw: null,
      hp: null,
      tuketim: null,
      co2: null,
      agirlik: null,
      euro: [],
      surum: 0,
      ...r.degerler,
    };
    const b = teknikBolumleri(o as never);
    expect(b[0]).toEqual({
      baslik: 'Genel',
      satirlar: [
        ['Kasa tipi', 'Hatchback'],
        ['Segment', 'B'],
        ['Kapı sayısı', '5'],
        ['Koltuk sayısı', '5'],
      ],
    });
    expect(b[1]?.satirlar).toContainEqual(['Güç', '90 hp (66 kW), 4.500 d/d']);
    expect(b[1]?.satirlar).toContainEqual(['Tork', '142 Nm, 1.750 d/d']);
    expect(teknikEksikleri(o as never)).toEqual([]);
  });

  it('başka yazımlar: iki nokta, vites sayısı, aralık, litre hacim, yok/opsiyonel donanım; tanınmayan satır döner', () => {
    const r = teknikMetniOku(`Şanzıman: 7 İleri DSG
Çekiş: Dört çeker (4MOTION)
Maksimum Tork: 250 Nm / 1.500-3.500 rpm
Motor Hacmi: 1.5 L
Karma Yakıt Tüketimi: 5,8 lt/100 km
Emisyon Sınıfı: Euro 6d
Ön cam rengi: Mavi
Model Üretim Yılı: 2016 / 2019
## Donanım
- Sunroof
Isıtmalı koltuk\tYok
Deri koltuk\tOpsiyonel
Jant\t17 inç alaşım`);
    expect(r.degerler).toMatchObject({
      vitesler: ['otomatik:7'],
      sanzimanlar: ['7 İleri DSG'],
      cekisler: ['4x4'],
      tork: [250, 250],
      torkDevir: [1500, 3500],
      hacimCc: [1500, 1500],
      tuketim: [5.8, 5.8],
      euro: ['6d'],
    });
    expect(r.yillar).toEqual([2016, 2019]);
    expect(r.okunamayan).toEqual(['Ön cam rengi: Mavi']);
    expect(r.donanim).toEqual([
      { ad: 'Donanım', ogeler: ['Sunroof', 'Deri koltuk (isteğe bağlı)', 'Jant: 17 inç alaşım'] },
    ]);
    expect(teknikMetniOku('Şanzıman\t6 İleri Manuel').degerler.vitesler).toEqual(['manuel:6']);
    expect(teknikMetniOku('Şanzıman\tEDC Yarı otomatik').degerler.vitesler).toEqual(['yari_otomatik:']);
  });

  it('donanım kutusu metni gidip gelir', () => {
    const g = teknikMetniOku(CLIO).donanim;
    expect(donanimOku(donanimYaz(g))).toEqual(g);
  });
});
