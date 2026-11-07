import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv.js';
import { buildVmmSnapshot, vmmModel, vmmSeries } from './vmm.js';

const HEADER =
  'make_group,make,model,generation,gen_year_start,gen_year_end,body_type,engine_label,fuel_type,cylinders,displacement_cc,power_hp,torque_nm,transmission,drivetrain';
const CSV = [
  HEADER,
  'bmw,BMW,3 Series,3 Series Sedan (1991),1991,1998,,318i 5MT RWD (115 HP),Gasoline,4,1796,115.4,168,5-speed manual,Rear Wheel Drive',
  'bmw,BMW,3 Series,3 Series Touring (2005),2005,2008,,320d 6AT RWD (163 HP),Diesel,4,1995,163,340,6-speed automatic,Rear Wheel Drive',
  'bmw,BMW,3 Series,3 Series Sedan (2012),2012,2015,,320i 8AT RWD (184 HP),Gasoline,4,1997,184,270,8-speed automatic,Rear Wheel Drive',
  'mercedes-benz,Mercedes-Benz,MERCEDES BENZ C-Klasse T-Modell,MERCEDES BENZ C-Klasse T-Modell (2001),2001,2007,,C 220 CDI 5AT (143 HP),Diesel,4,2148,143,315,5-speed automatic,Rear Wheel Drive',
  'volkswagen,Volkswagen,Golf,Golf 5 Doors (1997),1997,2003,,"1.9L TDI 5MT FWD (110 HP)",Diesel,4,1896,110,235,5-speed manual,Front Wheel Drive',
  'fiat,Fiat,Albea / Siena,"Albea / Siena (1996)",1996,2002,,1.6L 5MT FWD (100 HP),Gasoline,4,1581,100,145,5-speed manual,Front Wheel Drive',
  'toyota,Toyota,Corolla,Corolla Sedan (1983),1983,1987,,1.3L 4MT FWD (75 HP),Gasoline,4,1295,75,,4-speed manual,Front Wheel Drive',
].join('\n');

describe('CSV okuyucu', () => {
  it('tırnaklı alan, alan içinde virgül ve çift tırnak', () => {
    expect(parseCsv('a,b\n"x, y","say ""merhaba"""\r\n1,\n')).toEqual([
      { a: 'x, y', b: 'say "merhaba"' },
      { a: '1', b: '' },
    ]);
  });
});

describe('vehicle-makes-models (1990–2005)', () => {
  it('seri adları TSB biçimine çevrilir, motor sürümü model olur', () => {
    expect(vmmSeries('BMW', '3 Series')).toBe('3 Serisi');
    expect(vmmSeries('Mercedes-Benz', 'MERCEDES BENZ C-Klasse T-Modell')).toBe('C Serisi');
    expect(vmmSeries('Fiat', 'Albea / Siena')).toBe('Albea');
    expect(vmmSeries('Fiat', 'Marea Weekend')).toBe('Marea');
    expect(vmmModel('BMW', '318i 5MT RWD (115 HP)', 1.8, 'benzin')).toBe('318i');
    expect(vmmModel('Mercedes-Benz', 'C 220 CDI 5AT (143 HP)', 2.1, 'dizel')).toBe('C 220 CDI');
    expect(vmmModel('Volkswagen', '1.9L TDI 5MT FWD (110 HP)', 1.9, 'dizel')).toBe('1.9 TDI');
    expect(vmmModel('Fiat', '1.6L 5MT FWD (100 HP)', 1.6, 'benzin')).toBe('1.6');
  });

  it('yıllar 2005 ile kırpılır (sonrası TSB’den); nesil, kasa, yakıt, vites gelir', () => {
    const snap = buildVmmSnapshot(strToU8(CSV), { version: 'v1.0.2' });
    expect(snap.source).toBe('vmm');
    expect(snap.stats).toMatchObject({ rows: 7, items: 6, outOfScope: 1 });

    const e36 = snap.items.find((i) => i.model === '318i');
    expect(e36).toMatchObject({
      make: 'BMW',
      series: '3 Serisi',
      body: 'Sedan',
      engineL: 1.8,
      powerHp: 115,
      fuel: 'benzin',
      gearbox: 'manuel',
      drive: 'arkadan',
      trim: null,
      years: [1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998],
      generation: { name: '3 Series Sedan (1991)', startYear: 1991, endYear: 1998 },
    });
    expect(snap.items.find((i) => i.model === '320d')?.years).toEqual([2005]);
    expect(snap.items.find((i) => i.model === 'C 220 CDI')).toMatchObject({
      series: 'C Serisi',
      body: 'Station wagon',
      fuel: 'dizel',
    });
    expect(snap.items.find((i) => i.series === 'Golf')).toMatchObject({
      body: 'Hatchback 5 kapı',
      gearbox: 'manuel',
      drive: 'onden',
    });
    // 1983–1987 nesli 1985'ten başlar (alt sınır), 2012 nesli tamamen dışarıda kalır.
    expect(snap.items.find((i) => i.series === 'Corolla')?.years).toEqual([1985, 1986, 1987]);
    expect(snap.items.some((i) => i.model === '320i')).toBe(false);
  });

  it('sürüm zip dosyası da okunur; biçimi tanınmayan dosya açık hata verir', () => {
    const zip = zipSync({ 'csv/engines.csv': strToU8(CSV), 'csv/makes-models.csv': strToU8('x') });
    expect(buildVmmSnapshot(zip, { version: 'v1' }).items).toHaveLength(6);
    expect(() => buildVmmSnapshot(strToU8('a,b\n1,2'), { version: 'v1' })).toThrow('engines.csv');
    expect(() => buildVmmSnapshot(zipSync({ 'x.txt': strToU8('') }), { version: 'v1' })).toThrow(
      'engines.csv',
    );
  });

  it('aynı satırın kimliği sürümler arasında sabittir', () => {
    const a = buildVmmSnapshot(strToU8(CSV), { version: 'v1' }).items.map((i) => i.sourceKey);
    const b = buildVmmSnapshot(strToU8(CSV), { version: 'v2' }).items.map((i) => i.sourceKey);
    expect(a).toEqual(b);
  });
});
