import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  birimli,
  readVmmTeknik,
  teknikBirlestir,
  teknikOku,
  tsbOzeti,
  type VmmMotor,
  vmmEslestir,
  vmmYakit,
} from './vmm-teknik.js';

const motor = (label: string, drivetrain: string, ek: Record<string, unknown> = {}) => ({
  label,
  fuelType: 'Gasoline',
  displacementCc: 1597,
  powerHp: 170,
  transmission: '8-speed automatic',
  drivetrain,
  ...ek,
});
const zip = zipSync({
  'json/bmw.json': strToU8(
    JSON.stringify({
      makes: [
        {
          name: 'BMW',
          models: [
            {
              name: '3 Series',
              generations: [
                {
                  name: '3 Series Sedan (2018)',
                  yearStart: 2018,
                  yearEnd: 2022,
                  bodyType: null,
                  engines: [
                    motor('320i 8AT RWD (170 HP)', 'Rear Wheel Drive', {
                      zeroToHundredKmhS: 8.3,
                      specs: {
                        'ENGINE SPECS / Fuel capacity': '15.6 gallons (59 L)',
                        'FUEL ECONOMY (NEDC) / City': '30 mpg US (7.6 L/100Km)',
                        'WEIGHT SPECS / Gross Weight Limit': '4784 lbs (2,170 kg)',
                      },
                    }),
                    motor('320i xDrive 8AT AWD (170 HP)', 'All Wheel Drive', { zeroToHundredKmhS: 8.1 }),
                  ],
                },
                {
                  name: '3 Series Touring (2019)',
                  yearStart: 2019,
                  yearEnd: null,
                  bodyType: null,
                  engines: [motor('320i 8AT RWD (170 HP)', 'Rear Wheel Drive')],
                },
              ],
            },
          ],
        },
      ],
    }),
  ),
  'json/all.json': strToU8('[]'),
});

describe('vehicle-makes-models motor kayıtları (sahip isteği, 17 Kasım 2026)', () => {
  it('okur: seri ana listeye yerleşir, kasa tipi nesil adından, ayrıntı ham tablodan', () => {
    const xs = readVmmTeknik(zip);
    expect(xs).toHaveLength(3);
    expect(xs[0]).toMatchObject({
      marka: 'BMW',
      seri: '3 Serisi',
      govde: 'sedan',
      yakit: 'benzin',
      hp: 170,
      hacim: 1.6,
      vites: 'otomatik',
      vitesSayisi: 8,
      cekis: 'arkadan',
      d: { hizlanma: 8.3, depo: 59, tuketimSehir: 7.6, azamiAgirlik: 2170 },
    });
    expect(xs[2]?.govde).toBe('station_wagon');
    expect(birimli('6 in (152 mm)', 'mm')).toBe(152);
    expect(vmmYakit('Hybrid Gasoline')).toBe('hibrit');
    expect(vmmYakit('Diesel')).toBe('dizel');
  });

  it('eşleştirme: güç, yakıt, yıl; çekiş TSB yazmıyorsa ve seride dört çeker TSB tipi varsa 4x4 düşer', () => {
    const xs: VmmMotor[] = readVmmTeknik(zip);
    const tip = {
      marka: 'BMW',
      seri: '3 Serisi',
      yakit: 'benzin',
      hp: 170,
      hacim: 1.6,
      vites: null,
      yillar: [2020],
      cekis: null,
      govde: 'Sedan',
      seriDortCeker: false,
    };
    const o = vmmEslestir(tip, xs, 2026);
    expect(o).toMatchObject({ hizlanma: [8.1, 8.3], govdeler: ['sedan'], cekisler: ['4x4', 'arkadan'] });
    expect(vmmEslestir({ ...tip, seriDortCeker: true }, xs, 2026)?.cekisler).toEqual(['arkadan']);
    expect(vmmEslestir({ ...tip, hp: 184 }, xs, 2026)).toBeNull();
    expect(vmmEslestir({ ...tip, yakit: 'dizel' }, xs, 2026)).toBeNull();
    expect(vmmEslestir({ ...tip, yillar: [2010] }, xs, 2026)).toBeNull();
  });

  it('birleştirme: ADEME önce; kapatılan kaynağın değerleri düşer; TSB adındaki çekiş ve kasa önce', () => {
    const ademe = {
      vitesler: ['otomatik:8'],
      kw: [125, 125] as [number, number],
      hp: [170, 170] as [number, number],
      tuketim: [5.9, 6.1] as [number, number],
      co2: [135, 139] as [number, number],
      agirlik: [1455, 1470] as [number, number],
      euro: ['6'],
      surum: 2,
    };
    const vmm = {
      tuketim: [7, 7] as [number, number],
      hizlanma: [8.3, 8.3] as [number, number],
      surum: 1,
      cekisler: ['arkadan'],
    };
    const b = teknikBirlestir(ademe, vmm, tsbOzeti('4x4', null));
    expect(b).toMatchObject({
      tuketim: [5.9, 6.1],
      hizlanma: [8.3, 8.3],
      cekisler: ['4x4'],
      kaynaklar: ['ademe', 'vmm'],
    });
    const satirlar = [
      { source: 'ademe', summary: ademe },
      { source: 'vmm', summary: vmm },
    ];
    expect(teknikOku(satirlar, new Set(['ademe']))?.hizlanma).toBeUndefined();
    expect(teknikOku(satirlar, new Set(['vmm']))?.tuketim).toEqual([7, 7]);
    expect(teknikOku(satirlar, new Set())).toBeNull();
  });
});

describe('motor kayıtlarında seri adı ve makul değer', () => {
  it('Tipo (2015) Egea, Passat CC VW CC olur; makul olmayan değer alınmaz', () => {
    const z = zipSync({
      'json/fiat.json': strToU8(
        JSON.stringify({
          makes: [
            {
              name: 'Fiat',
              models: [
                {
                  name: 'Tipo Sedan',
                  generations: [
                    {
                      name: 'Tipo Sedan (2015)',
                      yearStart: 2015,
                      yearEnd: 2020,
                      bodyType: null,
                      engines: [
                        motor('1.4 6MT FWD (95 HP)', 'Front Wheel Drive', {
                          specs: { 'DIMENSIONS / Cargo Volume': '1.4 cuFT (40 L)' },
                          zeroToHundredKmhS: 12.1,
                        }),
                      ],
                    },
                  ],
                },
                {
                  name: 'Tipo',
                  generations: [
                    {
                      name: 'Tipo (1988)',
                      yearStart: 1988,
                      yearEnd: 1995,
                      bodyType: null,
                      engines: [motor('1.4 (70 HP)', 'Front Wheel Drive')],
                    },
                  ],
                },
              ],
            },
            {
              name: 'Volkswagen',
              models: [
                {
                  name: 'Passat CC',
                  generations: [
                    {
                      name: 'Passat CC (2008)',
                      yearStart: 2008,
                      yearEnd: 2012,
                      bodyType: null,
                      engines: [motor('1.8 TSI (160 HP)', 'Front Wheel Drive')],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      ),
    });
    const xs = readVmmTeknik(z);
    expect(xs.map((x) => x.seri)).toEqual(['Egea', 'Tipo', 'VW CC']);
    expect(xs[0]?.d.bagaj).toBeUndefined();
    expect(xs[0]?.d.hizlanma).toBe(12.1);
  });
});
