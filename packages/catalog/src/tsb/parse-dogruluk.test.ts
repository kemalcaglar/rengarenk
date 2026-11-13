import { describe, expect, it } from 'vitest';
import { acronymCase, inferManualGearbox, isAcronym, type ParsedVariant, parseTsbRow } from './parse.js';

let n = 0;
const parse = (brand: string, type: string): ParsedVariant => {
  const r = parseTsbRow({
    brandCode: brand,
    typeCode: String(++n),
    brandName: brand,
    typeName: type,
    years: [2015],
  });
  if (!r.ok) throw new Error('kapsam dışı');
  return r.variant;
};

/**
 * Gerçek TSB tip adlarıyla doğruluk (Karar 33): yakıt, vites, kasa, paket ve kategori. Her satır, Kasım 2026
 * denetiminde yanlış ayrıştırıldığı görülen bir kalıbı sabitler.
 */
describe('TSB ayrıştırma doğruluğu', () => {
  it('yakıtı açıkça yazan kelimeler: DIZEL, DZL, tek başına D, BLUHDI, BLUETEC, XDI', () => {
    expect(parse('OPEL', 'ASTRA HB EXCELLENCE 1.6 DIZEL 136 AT6')).toMatchObject({
      model: '1.6 Dizel',
      fuel: 'dizel',
      gearbox: 'otomatik',
      body: 'Hatchback',
      trim: 'Excellence',
      powerHp: 136,
    });
    expect(parse('CHEVROLET', 'AVEO HB 1.3 (95) DIZEL LTZ')).toMatchObject({ fuel: 'dizel', trim: 'LTZ' });
    expect(parse('OPEL', 'COMBO CARGO 21LMTD 1.5 102 DZL MT5 ENJOY P91')).toMatchObject({
      fuel: 'dizel',
      gearbox: 'manuel',
      body: 'Panelvan',
      trim: 'Enjoy',
      categories: ['minivan-panelvan'],
    });
    expect(parse('RENAULT', 'KANGOO EXPRESS GRAND CONFORT 1.9 D')).toMatchObject({
      model: '1.9 Dizel',
      fuel: 'dizel',
    });
    expect(parse('CITROEN', 'C3 AIRCROSS FEEL 1.6 BLUHDI 100')).toMatchObject({
      model: '1.6 BlueHDi',
      fuel: 'dizel',
      trim: 'Feel',
    });
    expect(parse('MERCEDES', 'C 250 BLUETEC FASCINATION')).toMatchObject({
      fuel: 'dizel',
      trim: 'Fascination',
    });
    expect(parse('SSANGYONG', 'ACTYON A200 XDI 2.0')).toMatchObject({ model: '2.0 XDi', fuel: 'dizel' });
  });

  it('vites: OV, AT6/AT8, MT6, MULTIDRIVE S, C.MATIC, MULTITRONIC, R TRONIC', () => {
    expect(parse('HONDA', 'ACCORD 2.0 EXECUTIVE OV')).toMatchObject({
      gearbox: 'otomatik',
      trim: 'Executive',
    });
    expect(parse('OPEL', 'INSIGNIA GRAND SPORT 1.5 165 MT6 ENJOY')).toMatchObject({ gearbox: 'manuel' });
    expect(parse('TOYOTA', 'YARIS 1.33 COOL MULTIDRIVE S')).toMatchObject({
      gearbox: 'otomatik',
      trim: 'Cool',
    });
    expect(parse('FIAT', 'DOBLO COMBI 1.6 90 M.JET E5 PREMIO C.MATIC')).toMatchObject({
      gearbox: 'yari_otomatik',
      body: 'Kombi',
      categories: ['minivan-panelvan'],
    });
    expect(parse('AUDI', 'A5 SPORTBACK 2.0 TDI (177) MULTITRONIC')).toMatchObject({ gearbox: 'otomatik' });
    expect(parse('AUDI', 'R8 4.2 FSI 430 QUATTRO R TRONIC')).toMatchObject({
      model: '4.2 FSI',
      gearbox: 'otomatik',
      trim: null,
    });
  });

  it('paket motor ve kasa kelimesi taşımaz: 16V, CR, kasa kuşağı numarası, (Y), kapı sayısı', () => {
    expect(parse('RENAULT', 'MEGANE II SEDAN LEGEND 1.5 DCI (105)')).toMatchObject({
      series: 'Megane',
      body: 'Sedan',
      trim: 'Legend',
    });
    expect(parse('VOLKSWAGEN', 'GOLF VII 1.6 TDI 105 COMFORTLINE')).toMatchObject({ trim: 'Comfortline' });
    expect(parse('SKODA', 'OCTAVIA 1.6 TDI CR 110 GREEN TEC STYLE')).toMatchObject({ trim: 'Style' });
    expect(parse('OPEL', 'ASTRA 1.6i 16V HB ENJOY (115)')).toMatchObject({ trim: 'Enjoy', powerHp: 115 });
    expect(parse('HONDA', 'CIVIC SEDAN 1.8 EXECUTIVE PREMIUM OV (Y)')).toMatchObject({
      trim: 'Executive Premium',
      gearbox: 'otomatik',
    });
    expect(parse('FORD', 'FOCUS 1.5 TDCI 120 4 KAPI TITANIUM E6')).toMatchObject({
      body: 'Sedan',
      trim: 'Titanium',
    });
    expect(parse('HONDA', 'CITY 4D 1.5 EXECUTIVE AT')).toMatchObject({ body: 'Sedan', trim: 'Executive' });
    expect(parse('KIA', 'CERATO NB 1.6 COOL')).toMatchObject({ body: 'Sedan', trim: 'Cool' });
    expect(parse('NISSAN', 'MICRA 1.2 5 KAPI SV7 PASSION PLUS(80) OV')).toMatchObject({
      powerHp: 80,
      gearbox: 'otomatik',
    });
  });

  it('makyaj: Ford MCA, Renault FAZ2; FAZ1 paket değildir', () => {
    expect(parse('FORD', 'FOCUS MCA TREND X 5 KAPI 123')).toMatchObject({ facelift: true, trim: 'Trend X' });
    expect(parse('RENAULT', 'CLIO TOUCH TURBO 90 S&S FAZ1')).toMatchObject({
      facelift: false,
      trim: 'Touch',
      fuel: 'benzin',
    });
  });

  it('elektrikli ve hibrit adından bilinir: BMW i, Mercedes EQ, Tesla, Lexus h, Audi e-tron GT', () => {
    expect(parse('BMW', 'i7 60 XDRIVE PURE EXCELLENCE')).toMatchObject({
      series: 'i7',
      model: 'xDrive60',
      fuel: 'elektrik',
      trim: 'Pure Excellence',
    });
    expect(parse('BMW', 'iX M60 M PERFORMANCE')).toMatchObject({ model: 'M60', fuel: 'elektrik' });
    expect(parse('TESLA', 'MODEL 3 LONG RANGE')).toMatchObject({ fuel: 'elektrik' });
    expect(parse('LEXUS', 'RX 450h L 4x4 EXECUTIVE')).toMatchObject({
      series: 'RX',
      model: 'RX 450h',
      fuel: 'hibrit',
    });
    expect(parse('AUDI', 'RS E-TRON GT QUATTRO FL')).toMatchObject({
      series: 'e-tron GT',
      model: 'RS e-tron GT',
      fuel: 'elektrik',
    });
  });

  it('hafif ticari seriler otomobil değildir; 10 kişi ve üstü minibüs ticaridir', () => {
    expect(parse('MERCEDES', 'VITO TOURER BASE 114 CDI 2.0 136').categories).toEqual(['minivan-panelvan']);
    expect(parse('FORD', 'TOURNEO COURIER BEV 100KW TREND').categories).toEqual([
      'minivan-panelvan',
      'elektrikli',
    ]);
    expect(parse('FORD', 'TRANSIT MCAI 410L 14+1 UPGRADE 170 LIMITED AT')).toMatchObject({
      body: 'Minibüs',
      categories: ['ticari'],
    });
    expect(parse('FERRARI', 'CALIFORNIA T 3.9').categories).toEqual(['otomobil']);
    expect(parse('SKODA', 'OCTAVIA COMBI 1.6 TDI STYLE')).toMatchObject({
      body: 'Station wagon',
      categories: ['otomobil'],
    });
  });

  it('çok kelimeli seriler: C4 Cactus, L200', () => {
    expect(parse('CITROEN', 'C4 CACTUS FEEL 1.5 BLUEHDI 100 AT')).toMatchObject({
      series: 'C4 Cactus',
      trim: 'Feel',
    });
    expect(parse('MITSUBISHI', 'L 200 CIFT KABIN 2.4 4x4 INTENSE').categories).toEqual(['arazi-suv-pickup']);
  });

  it('kısaltmalar büyük harf: XE, XLV, CTS, LTZ; gerçek adlar (Up, Ka, Rio) değişmez', () => {
    expect(['XE', 'XLV', 'CTS', 'TT', 'NX', 'ASX'].every(isAcronym)).toBe(true);
    expect(['Up', 'Ka', 'Rio', 'Uno', 'Polo', 'Sky'].some(isAcronym)).toBe(false);
    expect(acronymCase('Rx 450h')).toBe('RX 450h');
    expect(parse('JAGUAR', 'XE R-SPORT 2.0d').series).toBe('XE');
  });

  it("manuel vites ikizden çıkarılır: OV'li ikizi olan, vitesi yazılmamış tip manueldir", () => {
    const vs = [
      parse('TOYOTA', 'COROLLA HB 1.6 PLUS LINE'),
      parse('TOYOTA', 'COROLLA HB 1.6 PLUS LINE OV'),
      parse('TOYOTA', 'COROLLA HB 1.4 D-4D LINE'),
    ];
    expect(inferManualGearbox(vs)).toBe(1);
    expect(vs.map((v) => v.gearbox)).toEqual(['manuel', 'otomatik', null]);
  });
});
