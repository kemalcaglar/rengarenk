import { describe, expect, it } from 'vitest';
import { parseTsbRow, smartCase, splitGlued } from './parse.js';

const row = (brandName: string, typeName: string, years = [2020, 2021, 2022]) => ({
  brandCode: '1',
  typeCode: '1',
  brandName,
  typeName,
  years,
});

const parse = (brand: string, type: string) => {
  const r = parseTsbRow(row(brand, type));
  if (!r.ok) throw new Error('kapsam dışı');
  return r.variant;
};

describe('TSB tip adı ayrıştırma', () => {
  it('BMW: seri sayıdan, makyaj LCI işaretinden, paket kalan kelimelerden', () => {
    const v = parse('BMW', '320i SEDAN LCI 1.6 170 M SPORT');
    expect(v).toMatchObject({
      make: 'BMW',
      series: '3 Serisi',
      model: '320i',
      body: 'Sedan',
      engineL: 1.6,
      powerHp: 170,
      fuel: 'benzin',
      facelift: true,
      trim: 'M Sport',
      categories: ['otomobil'],
      confidence: 'yuksek',
    });
    expect(parse('BMW', '320d SEDAN XDRIVE COMFORT')).toMatchObject({
      model: '320d',
      fuel: 'dizel',
      drive: '4x4',
      trim: 'Comfort',
    });
    expect(parse('BMW', 'X3 xDRIVE20d M SPORT')).toMatchObject({
      series: 'X3',
      model: 'xDrive20d',
      drive: '4x4',
      categories: ['arazi-suv-pickup'],
    });
    expect(parse('BMW', 'Z4 sDRIVE 35i')).toMatchObject({
      series: 'Z4',
      model: 'sDrive35i',
      drive: 'arkadan',
    });
  });

  it('Mercedes: sınıf harfi seri, FL makyaj, 4MATIC çekiş, vites ayıklanır', () => {
    expect(parse('MERCEDES', 'C 200 d FL 1.6 (160) AMG 9G-TRONIC')).toMatchObject({
      make: 'Mercedes-Benz',
      series: 'C Serisi',
      model: 'C 200 d',
      fuel: 'dizel',
      facelift: true,
      powerHp: 160,
      gearbox: 'otomatik',
      trim: 'AMG',
    });
    // "Avantgarde" gerçek bir kelimedir; içindeki "AVANT" kasa sayılmaz.
    expect(parse('MERCEDES', 'C 200 4MATIC 1.5 (204) AVANTGARDE 9G-TRONIC')).toMatchObject({
      body: null,
      trim: 'Avantgarde',
    });
  });

  it('VW, Fiat, Renault: motor sürümü model, kalan paket; yerli üretim markası birleşir', () => {
    expect(parse('VOLKSWAGEN', 'GOLF 1.0 eTSI 110 DSG R-LINE')).toMatchObject({
      series: 'Golf',
      model: '1.0 eTSI',
      fuel: 'hibrit',
      gearbox: 'otomatik',
      powerHp: 110,
      trim: 'R-Line',
    });
    expect(parse('TOFAS-FIAT', 'EGEA SEDAN URBAN 1.3 M.JET 95 E6D')).toMatchObject({
      make: 'Fiat',
      series: 'Egea',
      model: '1.3 Multijet',
      body: 'Sedan',
      fuel: 'dizel',
      trim: 'Urban',
    });
    expect(parse('RENAULT (OYAK)', 'CLIO JOY 1.0 TCE X-TRONIC 90')).toMatchObject({
      make: 'Renault',
      series: 'Clio',
      model: '1.0 TCe',
      gearbox: 'otomatik',
      trim: 'Joy',
    });
  });

  it('Audi: bitişik yazım bölünür, güç sınıfı motor adına girer', () => {
    expect(splitGlued(['45TFSIQUATTRO265ADVANCED'])).toEqual(['45', 'TFSI', 'QUATTRO', '265', 'ADVANCED']);
    expect(splitGlued(['A5SPORTBACK', '40TDI', '320i', '4MATIC', 'T10X', 'SRK125'])).toEqual([
      'A5',
      'SPORTBACK',
      '40',
      'TDI',
      '320i',
      '4MATIC',
      'T10X',
      'SRK125',
    ]);
    expect(parse('AUDI', 'A7 SPORTBACK 3.0 50 TDI QUATTRO (286) TIPTRON')).toMatchObject({
      series: 'A7',
      model: '3.0 TDI',
      powerHp: 286,
      gearbox: 'otomatik',
      drive: '4x4',
      trim: null,
    });
    expect(parse('AUDI', 'Q5SPORTBACK 40TDI QUATTRO 204 ADVANCED')).toMatchObject({
      series: 'Q5',
      model: '40 TDI',
      powerHp: 204,
    });
  });

  it('elektrikli: kW gücü, elektrikli kategorisine de girer', () => {
    expect(parse('TOGG', 'T10X V2 RWD UZUN MENZIL 160KW')).toMatchObject({
      make: 'Togg',
      series: 'T10X',
      fuel: 'elektrik',
      powerKw: 160,
      drive: 'arkadan',
      trim: 'V2 Uzun Menzil',
      categories: ['arazi-suv-pickup', 'elektrikli'],
    });
    expect(parse('TESLA', 'MODEL Y LONG RANGE AWD')).toMatchObject({ series: 'Model Y' });
  });

  it('ticari: başta yazılan araç sınıfı kategoriyi ve kasayı belirler', () => {
    expect(parse('MERCEDES', 'KAMYON AROCS 3342 K E6')).toMatchObject({
      series: 'Arocs',
      body: 'Kamyon',
      categories: ['ticari'],
    });
    expect(parse('FORD', 'TRANSIT 350 M PANELVAN')).toMatchObject({ categories: ['minivan-panelvan'] });
    expect(parse('TEMSA', 'MARATON 12')).toMatchObject({ categories: ['ticari'] });
    expect(parse('HYMER', 'B-KLASSE MASTERLINE')).toMatchObject({ categories: ['karavan'] });
  });

  it('motosiklet grubu: gerçek marka tip adının başında; ATV ayrı kategori', () => {
    expect(parse('MOTORSIKLET', 'YAMAHA YZF R1')).toMatchObject({
      make: 'Yamaha',
      series: null,
      model: 'Yzf R1',
      categories: ['motosiklet'],
    });
    expect(parse('MOTORSIKLET', 'KYMCO ATV MXU 300')).toMatchObject({
      make: 'Kymco',
      model: 'Mxu 300',
      categories: ['atv'],
    });
    expect(parse('MOTORSIKLET', 'HONDA\\CG 125')).toMatchObject({ make: 'Honda', model: 'Cg 125' });
    expect(parse('MOTORSIKLET', 'QJ MOTOR SRV 550 ST')).toMatchObject({
      make: 'QJ Motor',
      model: 'Srv 550 ST',
    });
  });

  it('seri yazımları tek biçim: marka tekrarı, Jeep, Range Rover, MINI, DS, Transit, AMG (Sprint 6)', () => {
    const s = (brand: string, type: string) => {
      const v = parse(brand, type);
      return `${v.make} / ${v.series} / ${v.model}`;
    };
    expect(s('CHRYSLER', 'JEEP COMPASS 1.4 170 LIMITED AWD')).toBe('Jeep / Compass / 1.4');
    expect(s('CHRYSLER', 'JEEPGRANDCHEROKEE 3.0 CRD')).toBe('Jeep / Grand Cherokee / 3.0');
    expect(parse('CHRYSLER', 'JEEP COMPASS 1.4 170 LIMITED AWD').categories).toEqual(['arazi-suv-pickup']);
    expect(s('RANGE ROVER', '3.0 D300 HSE')).toBe('Land Rover / Range Rover / 3.0');
    expect(s('RANGE ROVER', 'SPORT 3.0 D300 HSE')).toBe('Land Rover / Range Rover Sport / 3.0');
    expect(s('MINI', 'MINI COOPER S 2.0 COUNTRYMAN')).toBe('MINI / Countryman / Cooper S');
    expect(s('MINI', 'MINI ONE 1.6')).toBe('MINI / Cooper / One');
    expect(s('DS', 'DS 7 CROSSBACK 1.5 BLUEHDI 130')).toBe('DS / DS 7 / 1.5 BlueHDi');
    expect(s('DS', 'DS7CROSSBACK 1.6 PURETECH 225')).toBe('DS / DS 7 / 1.6 PureTech');
    expect(s('LEXUS', 'LEXUS ES 250')).toBe('Lexus / ES / ES');
    expect(s('FORD', 'TRAN.ICA3 350MF VAN 10M3 2.0 130 ORTA TREND')).toBe('Ford / Transit / 2.0');
    expect(s('FORD', 'TR.MCAI 410L VAN 2.0 170')).toBe('Ford / Transit / 2.0');
    expect(s('FORD', 'T. CONNECT KOMBI K210S 1.8 TDCi')).toBe('Ford / Transit Connect / 1.8 TDCi');
    expect(s('FORD', 'TOURNEO CUSTOM 2.0 ECOBLUE 170 TITANIUM')).toBe('Ford / Tourneo Custom / 2.0 EcoBlue');
    expect(s('FIAT', 'GRANDE PUNTO 1.4 ACTIVE')).toBe('Fiat / Grande Punto / 1.4');
    expect(s('FIAT', 'G. PUNTO 1.3 M.JET')).toBe('Fiat / Grande Punto / 1.3 Multijet');
    expect(s('VOLKSWAGEN', 'THE BEETLE 1.2 TSI')).toBe('Volkswagen / Beetle / 1.2 TSI');
    expect(s('MERCEDES-BENZ', 'MERCEDES-AMG C 63 S')).toBe('Mercedes-Benz / C Serisi / AMG C 63');
    expect(s('MERCEDES-BENZ', 'C180K 1.8')).toBe('Mercedes-Benz / C Serisi / C 180');
    expect(s('MERCEDES-BENZ', 'MCLAREN 650S SPIDER')).toBe('McLaren / 650S / 650S');
  });

  it('kapsam dışı gruplar (traktör, iş makinesi) atlanır', () => {
    expect(parseTsbRow(row('ZIRAI TRAKTOR', 'NEW HOLLAND TD 75'))).toEqual({
      ok: false,
      reason: 'kapsam_disi',
    });
    expect(parseTsbRow(row('GROVE', 'GMK 5250L'))).toEqual({ ok: false, reason: 'kapsam_disi' });
  });

  it('büyük-küçük harf: ASCII TSB metni Türkçe kurallarla bozulmaz', () => {
    expect(smartCase('FIRST EDITION SPORT LINE')).toBe('First Edition Sport Line');
    expect(smartCase('50. YIL EDITION')).toBe('50. Yıl Edition');
    expect(smartCase('RS LINE')).toBe('RS Line');
    expect(smartCase('eTSI')).toBe('eTSI');
  });
});
