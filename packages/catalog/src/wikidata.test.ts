import { describe, expect, it } from 'vitest';
import { assignGenerationCodes } from './generations.js';
import { buildVmmSnapshot, stripMakePrefix, vmmSeries } from './vmm.js';
import {
  buildWikidataSnapshot,
  generationCode,
  infoboxField,
  parseProductionYears,
  splitSeriesLabel,
  wikidataRows,
} from './wikidata.js';

describe('Wikidata nesil kodları (Sprint 6)', () => {
  it('etiketten kod; nesil olmayan alt modeller reddedilir', () => {
    expect(generationCode('BMW 3 Series (E46)', 'BMW 3 Series', 'BMW')).toEqual({ ok: true, code: 'E46' });
    expect(generationCode('Volkswagen Golf Mk7', 'Volkswagen Golf', 'Volkswagen')).toEqual({
      ok: true,
      code: 'Mk7',
    });
    expect(generationCode('Ford Focus Mk III', 'Ford Focus', 'Ford').code).toBe('Mk3');
    expect(generationCode('Renault Clio IV', 'Renault Clio', 'Renault').code).toBe('IV');
    expect(generationCode('Opel Astra K', 'Opel Astra', 'Opel').code).toBe('K');
    expect(generationCode('Mercedes-Benz W205', 'Mercedes-Benz C-Class', 'Mercedes-Benz').code).toBe('W205');
    expect(generationCode('Mercedes-Benz type 204', 'Mercedes-Benz C-Class', 'Mercedes-Benz').code).toBe(
      'W204',
    );
    expect(generationCode('Volkswagen Golf Plus', 'Volkswagen Golf', 'Volkswagen').ok).toBe(false);
    expect(generationCode('Ford Focus CC', 'Ford Focus', 'Ford').ok).toBe(false);
    expect(generationCode('Ford Focus 4th generation', 'Ford Focus', 'Ford')).toEqual({
      ok: true,
      code: null,
    });
  });

  it('Vikipedi bilgi kutusundan üretim yılları', () => {
    expect(parseProductionYears('December 1997 – November 2006')).toEqual({ start: 1997, end: 2006 });
    expect(parseProductionYears('2019–present')).toEqual({ start: 2019, end: null });
    expect(parseProductionYears('June 1975 – December&nbsp;1983<ref name="BMW_Archiv_E21" />')).toEqual({
      start: 1975,
      end: 1983,
    });
    expect(parseProductionYears('{{ubl |May 1974 – September 1983|1976–1985 (Yugoslavia)}}')).toEqual({
      start: 1974,
      end: 1983,
    });
    expect(parseProductionYears('2012–2020 (Europe)<br />2013–2020 (China)')).toEqual({
      start: 2012,
      end: 2020,
    });
    expect(parseProductionYears('bilinmiyor')).toBeNull();
    const text =
      '{{Infobox automobile\n| name = X\n| production = {{ubl\n|1996–2005\n|1999–2005 (China)}}\n| assembly = Y\n}}';
    expect(parseProductionYears(infoboxField(text) ?? '')).toEqual({ start: 1996, end: 2005 });
  });

  it('seri etiketi katalog markası ve seri adına çevrilir', () => {
    const makes = ['Mercedes-Benz', 'BMW', 'Volkswagen', 'Land Rover', 'Škoda'];
    expect(splitSeriesLabel('Mercedes-Benz C-Class', makes)).toEqual({
      make: 'Mercedes-Benz',
      series: 'C Serisi',
    });
    expect(splitSeriesLabel('BMW 3 Series', makes)).toEqual({ make: 'BMW', series: '3 Serisi' });
    expect(splitSeriesLabel('Range Rover', makes)).toEqual({ make: 'Land Rover', series: 'Range Rover' });
    expect(splitSeriesLabel('Skoda Fabia', makes)).toEqual({ make: 'Škoda', series: 'Fabia' });
    expect(splitSeriesLabel('Dongfeng Mengshi', makes)).toBeNull();
  });

  it('anlık görüntü: yılı olmayan ve kodu tanınmayan nesil atlanır', () => {
    const rows = wikidataRows([
      {
        series: { type: 'uri', value: 'http://www.wikidata.org/entity/Q1' },
        seriesLabel: { type: 'literal', value: 'BMW 3 Series' },
        gen: { type: 'uri', value: 'http://www.wikidata.org/entity/Q2' },
        genLabel: { type: 'literal', value: 'BMW 3 Series (E46)' },
        cc: { type: 'literal', value: 'BMW E46' },
        en: { type: 'uri', value: 'https://en.wikipedia.org/wiki/BMW_3_Series_(E46)' },
      },
      {
        series: { type: 'uri', value: 'http://www.wikidata.org/entity/Q1' },
        seriesLabel: { type: 'literal', value: 'BMW 3 Series' },
        gen: { type: 'uri', value: 'http://www.wikidata.org/entity/Q3' },
        genLabel: { type: 'literal', value: 'BMW 3 Series (G20)' },
        inc: { type: 'literal', value: '2018-01-01T00:00:00Z' },
      },
      {
        series: { type: 'uri', value: 'http://www.wikidata.org/entity/Q1' },
        seriesLabel: { type: 'literal', value: 'BMW 3 Series' },
        gen: { type: 'uri', value: 'http://www.wikidata.org/entity/Q4' },
        genLabel: { type: 'literal', value: 'BMW 3 Series (E90)' },
      },
    ]);
    const snap = buildWikidataSnapshot(
      rows,
      { 'BMW 3 Series (E46)': { revision: 42, production: 'December 1997 – November 2006' } },
      { makes: ['BMW'], version: '2026-11-08' },
    );
    expect(snap.items).toEqual([]);
    expect(snap.generations).toEqual([
      expect.objectContaining({
        make: 'BMW',
        series: '3 Serisi',
        code: 'E46',
        startYear: 1997,
        endYear: 2006,
        commonsCategory: 'BMW E46',
        wikidataId: 'Q2',
        yearsSource: 'enwiki:BMW 3 Series (E46)@42',
      }),
      expect.objectContaining({ code: 'G20', startYear: 2018, endYear: null, yearsSource: 'wikidata:Q3' }),
    ]);
    expect(snap.stats.outOfScope).toBe(1);
  });
});

describe('kasa kuşağı ↔ nesil kodu ve makyaj sırası', () => {
  it('BMW 3 Serisi Sedan: kuşaklar kodlara düşer, kod içinde sıra makyaj numarasıdır', () => {
    const codes = [
      { id: 'e36', code: 'E36', startYear: 1990, endYear: 2000, wikidataId: null, commonsCategory: null },
      {
        id: 'e46',
        code: 'E46',
        startYear: 1997,
        endYear: 2006,
        wikidataId: 'Q2',
        commonsCategory: 'BMW E46',
      },
      { id: 'e90', code: 'E90', startYear: 2004, endYear: 2013, wikidataId: null, commonsCategory: null },
      { id: 'f30', code: 'F30', startYear: 2011, endYear: 2018, wikidataId: null, commonsCategory: null },
      { id: 'g20', code: 'G20', startYear: 2018, endYear: null, wikidataId: null, commonsCategory: null },
    ];
    const phases = [1991, 1998, 2002, 2005, 2008, 2012, 2016, 2018, 2022, 2024].map((y, i, all) => ({
      id: `s${y}`,
      body: 'Sedan',
      startYear: y,
      endYear: all[i + 1] ?? null,
    }));
    phases.push({ id: 't1999', body: 'Station wagon', startYear: 1999, endYear: 2001 });
    const got = Object.fromEntries(
      assignGenerationCodes(phases, codes).map((x) => [x.phaseId, `${x.code}/${x.facelift}`]),
    );
    expect(got).toEqual({
      s1991: 'E36/0',
      s1998: 'E46/0',
      s2002: 'E46/1',
      s2005: 'E90/0',
      s2008: 'E90/1',
      s2012: 'F30/0',
      s2016: 'F30/1',
      s2018: 'G20/0',
      s2022: 'G20/1',
      s2024: 'G20/2',
      t1999: 'E46/0',
    });
  });

  it('kodu eksik nesil önceki kodun makyajı sayılmaz (Wikidata’da E36 yok)', () => {
    const codes = [
      { id: 'e30', code: 'E30', startYear: 1982, endYear: 1994, wikidataId: null, commonsCategory: null },
      { id: 'e46', code: 'E46', startYear: 1997, endYear: 2006, wikidataId: null, commonsCategory: null },
    ];
    const phases = [
      { id: 's1982', body: 'Sedan', startYear: 1982, endYear: 1992 },
      { id: 's1991', body: 'Sedan', startYear: 1991, endYear: 1998 },
      { id: 's1998', body: 'Sedan', startYear: 1998, endYear: 2002 },
    ];
    const got = assignGenerationCodes(phases, codes).map((x) => `${x.phaseId}:${x.code}/${x.facelift}`);
    expect(got.sort()).toEqual(['s1982:E30/0', 's1998:E46/0']);
  });
});

describe('vehicle-makes-models ad düzeltmeleri', () => {
  it('marka öneki ve kasa ekleri seri adından ayrılır', () => {
    expect(stripMakePrefix('Škoda', 'SKODA Octavia')).toBe('Octavia');
    expect(stripMakePrefix('Citroën', 'CITROEN C4 Picasso')).toBe('C4 Picasso');
    expect(stripMakePrefix('DS', 'AUTOMOBILES DS 4')).toBe('DS 4');
    expect(stripMakePrefix('Honda', 'CR-V')).toBe('CR-V');
    expect(vmmSeries('Ford', 'Focus CC')).toBe('Focus');
    expect(vmmSeries('BMW', '3 Series Gran Turismo')).toBe('3 Serisi');
    expect(vmmSeries('Mercedes-AMG', 'C-CLASS')).toBe('C Serisi');
  });

  it('kasa kuşakları bütün yıllar için, tipler yalnızca eski yıllar için', () => {
    const csv = [
      'make_group,make,model,generation,gen_year_start,gen_year_end,body_type,engine_label,fuel_type,cylinders,displacement_cc,power_hp,torque_nm,transmission,drivetrain',
      'bmw,BMW,3 Series,3 Series Sedan (2002),2002,2005,,318i 5MT RWD (143 HP),Gasoline,4,1995,143,200,5-speed manual,Rear Wheel Drive',
      'bmw,BMW,3 Series,3 Series Sedan (2018),2018,2022,,320i 8AT RWD (184 HP),Gasoline,4,1998,184,300,8-speed automatic,Rear Wheel Drive',
      'mercedes-amg,Mercedes-AMG,C-CLASS,C-CLASS Sedan (2014),2014,2018,,C 63 7AT RWD (476 HP),Gasoline,8,3982,476,650,7-speed automatic,Rear Wheel Drive',
    ].join('\n');
    const snap = buildVmmSnapshot(new TextEncoder().encode(csv), { version: 'v1' });
    expect(snap.items.map((i) => i.generation?.name)).toEqual(['3 Series Sedan (2002)']);
    expect(snap.generations).toEqual([
      expect.objectContaining({ make: 'BMW', series: '3 Serisi', startYear: 2002, body: 'Sedan' }),
      expect.objectContaining({ make: 'BMW', series: '3 Serisi', startYear: 2018, endYear: 2022 }),
      expect.objectContaining({ make: 'Mercedes-Benz', series: 'C Serisi', startYear: 2014 }),
    ]);
  });
});
