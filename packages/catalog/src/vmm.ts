import { createHash } from 'node:crypto';
import type { VehicleCategorySlug } from '@rengarenk/shared';
import { strFromU8, unzipSync } from 'fflate';
import { parseCsv } from './csv.js';
import type { CatalogSnapshot } from './snapshot.js';
import { SUV_SERIES } from './tsb/brands.js';
import { DRIVE, type Drive, ENGINE_TECH, type Fuel, type Gearbox, type ParsedVariant } from './tsb/parse.js';

/**
 * vehicle-makes-models (github.com/gor3a/vehicle-makes-models, veri ODbL 1.0, autoevolution.com kökenli).
 * TSB'nin kapsamadığı eski yılları (1990–2005) doldurur: marka, seri, kasa kuşağı (nesil), motor, güç, yakıt,
 * vites. Teknik tasarım §5: avukat teyidine kadar kataloğu başlatmak ve çapraz kontrol için kullanılır; kayıtlar
 * kaynağıyla ayrı tutulur ve kaynak konsoldan kapatılınca katalogdan kalkar. 2006 ve sonrası TSB'dendir; bu
 * yüzden yıllar `maxYear` ile kırpılır.
 */
export const VMM_MAX_YEAR = 2005;
export const VMM_MIN_YEAR = 1985;

const FUEL: Record<string, Fuel> = {
  gasoline: 'benzin',
  petrol: 'benzin',
  diesel: 'dizel',
  hybrid: 'hibrit',
  'mild hybrid': 'hibrit',
  'plug-in hybrid': 'hibrit',
  electric: 'elektrik',
  lpg: 'lpg',
};

/** Nesil adındaki kasa kelimeleri: "Golf 5 Doors (1997)" → Hatchback 5 kapı */
const BODY_WORDS: [RegExp, string][] = [
  [/\b5 doors?\b/i, 'Hatchback 5 kapı'],
  [/\b3 doors?\b/i, 'Hatchback 3 kapı'],
  [/\b(sedan|saloon|limousine)\b/i, 'Sedan'],
  [
    /\b(touring|wagon|estate|variant|avant|kombi|sports tourer|break|sw|weekend|caravan|shooting brake|t-modell)\b/i,
    'Station wagon',
  ],
  [/sportcoupe/i, 'Coupe'],
  [/\b(cabriolet|cabrio|convertible|spider|spyder)\b/i, 'Cabrio'],
  [/\broadster\b/i, 'Roadster'],
  [/\bcoupe\b/i, 'Coupe'],
  [/\bliftback\b/i, 'Liftback'],
  [/\bhatchback\b/i, 'Hatchback'],
  [/\b(pick-?up|double cab|crew cab|king cab)\b/i, 'Pickup'],
  [/\bvan\b/i, 'Van'],
  [/\b(suv|crossover)\b/i, 'SUV'],
];

const MERCEDES_CLASSES = new Set([
  'A',
  'B',
  'C',
  'E',
  'S',
  'G',
  'M',
  'R',
  'V',
  'CL',
  'CLC',
  'CLK',
  'CLS',
  'SL',
  'SLK',
  'SLR',
  'GL',
  'ML',
]);

/** Model adındaki kasa ekleri seri adından ayrılır: "Marea Weekend" → Marea */
const SERIES_SUFFIX =
  /\s+(weekend|wagon|sedan|hatchback|cabrio|cabriolet|coupe|estate|variant|avant|touring|sw|break)$/i;

export function vmmSeries(make: string, model: string): string {
  const base = (model.split(' / ')[0] ?? model).replace(/\s+/g, ' ').trim();
  if (make === 'BMW') {
    const n = /^(\d) Series$/i.exec(base);
    if (n) return `${n[1]} Serisi`;
    if (/^M\d$/i.test(base)) return 'M Serisi';
  }
  if (make === 'Mercedes-Benz') {
    // Kaynak Almanca ve marka önekiyle yazar: "MERCEDES BENZ C-Klasse T-Modell AMG" → C Serisi
    const m = base.replace(/^MERCEDES[ -]BENZ\s+/i, '');
    const c = /^([A-Z]{1,3})(?:-(?:Klasse|Class))?(?:\s|$)/i.exec(m);
    if (c && MERCEDES_CLASSES.has((c[1] as string).toUpperCase()))
      return `${(c[1] as string).toUpperCase()} Serisi`;
    return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
  }
  return base.replace(SERIES_SUFFIX, '');
}

function bodyOf(generation: string, model: string, bodyType: string): string | null {
  const text = `${bodyType} ${generation.replace(model, ' ')} ${model}`;
  for (const [re, name] of BODY_WORDS) if (re.test(text)) return name;
  return null;
}

function gearboxOf(transmission: string, label: string): Gearbox | null {
  const t = transmission.toLowerCase();
  if (/automated manual|amt|semi/.test(t)) return 'yari_otomatik';
  if (/automatic|cvt|dual.clutch|dct|dsg/.test(t)) return 'otomatik';
  if (/manual/.test(t)) return 'manuel';
  const m = /\b\d?(MT|AT|AMT|CVT|DCT)\b/.exec(label)?.[1];
  return m === 'MT' ? 'manuel' : m === 'AMT' ? 'yari_otomatik' : m ? 'otomatik' : null;
}

function driveOf(drivetrain: string, label: string): Drive | null {
  const d = drivetrain.toLowerCase();
  if (/all|4x4|four|awd|4wd/.test(d)) return '4x4';
  if (/rear/.test(d)) return 'arkadan';
  if (/front/.test(d)) return 'onden';
  const tok = /\b(FWD|RWD|AWD|4WD)\b/.exec(label)?.[1];
  return tok ? (DRIVE[tok] ?? null) : null;
}

/** Motor sürümü adı: BMW "318i", Mercedes "C 200", diğerleri "1.9 TDI" / "1.4" */
export function vmmModel(make: string, label: string, engineL: number | null, fuel: Fuel | null): string {
  const tokens = label
    .replace(/\(.*?\)/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const t0 = tokens[0] ?? '';
  if (make === 'BMW' && (/^\d{3}[a-zA-Z]{0,3}$/.test(t0) || /^M\d/i.test(t0))) return t0;
  if (make === 'Mercedes-Benz' && /^[A-Z]{1,3}$/.test(t0) && /^\d{2,3}$/.test(tokens[1] ?? '')) {
    const extra = /^(CDI|D|KOMPRESSOR)$/i.test(tokens[2] ?? '') ? ` ${tokens[2]}` : '';
    return `${t0} ${tokens[1]}${extra}`;
  }
  const tech = tokens
    .map((t) => ENGINE_TECH[t.toUpperCase()]?.label)
    .filter((l): l is string => Boolean(l) && l !== 'Turbo');
  if (engineL !== null) {
    const suffix = tech[0] ?? (fuel === 'dizel' ? 'Dizel' : fuel === 'hibrit' ? 'Hibrit' : '');
    return `${engineL.toFixed(1)}${suffix ? ` ${suffix}` : ''}`;
  }
  return label.replace(/\(.*?\)/g, '').trim() || 'Standart';
}

const num = (v: string | undefined) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? n : null;
};

/** Sürüm dosyasından (zip içinde csv/engines.csv) ya da düz engines.csv metninden anlık görüntü. */
export function buildVmmSnapshot(
  file: Uint8Array,
  opts: { version: string; maxYear?: number; minYear?: number; now?: Date },
): CatalogSnapshot {
  const maxYear = opts.maxYear ?? VMM_MAX_YEAR;
  const minYear = opts.minYear ?? VMM_MIN_YEAR;
  let csv: string;
  if (file[0] === 0x50 && file[1] === 0x4b) {
    const entries = unzipSync(file);
    const key = Object.keys(entries).find((k) => /(^|\/)engines\.csv$/.test(k));
    if (!key) throw new Error('vehicle-makes-models dosyasında engines.csv yok');
    csv = strFromU8(entries[key] as Uint8Array);
  } else {
    csv = strFromU8(file);
  }
  const rows = parseCsv(csv);
  if (!rows[0] || !('engine_label' in rows[0]) || !('gen_year_start' in rows[0])) {
    throw new Error('engines.csv biçimi tanınmadı (engine_label, gen_year_start sütunları yok)');
  }

  const items: ParsedVariant[] = [];
  const seen = new Set<string>();
  let outOfScope = 0;
  for (const r of rows) {
    const start = num(r.gen_year_start);
    const end = num(r.gen_year_end);
    if (!start || !r.make || !r.model) {
      outOfScope++;
      continue;
    }
    const from = Math.max(start, minYear);
    const to = Math.min(end ?? maxYear, maxYear);
    if (from > to) {
      outOfScope++;
      continue;
    }
    const make = r.make.trim();
    const series = vmmSeries(make, r.model);
    const cc = num(r.displacement_cc);
    const engineL = cc ? Math.round(cc / 100) / 10 : null;
    const fuel = FUEL[(r.fuel_type ?? '').toLowerCase()] ?? null;
    const label = (r.engine_label ?? '').trim();
    const model = vmmModel(make, label, engineL, fuel);
    const body = bodyOf(r.generation ?? '', r.model, r.body_type ?? '');
    const sourceKey = createHash('sha1')
      .update([make, r.model, r.generation, r.gen_year_start, label].join('|'))
      .digest('hex')
      .slice(0, 20);
    if (seen.has(sourceKey)) continue;
    seen.add(sourceKey);

    const categories: VehicleCategorySlug[] = [];
    if (body === 'Pickup' || body === 'SUV' || SUV_SERIES.has(series.toUpperCase()))
      categories.push('arazi-suv-pickup');
    else if (body === 'Van') categories.push('minivan-panelvan');
    else categories.push('otomobil');
    if (fuel === 'elektrik') categories.push('elektrikli');

    items.push({
      source: 'vmm',
      sourceKey,
      make,
      series,
      model,
      categories,
      body,
      engineL,
      // Kaynakta güç bazen ondalıklı yazılır (390.3); beygir gücü tam sayıdır.
      powerHp: num(r.power_hp) === null ? null : Math.round(num(r.power_hp) as number),
      powerKw: null,
      fuel,
      gearbox: gearboxOf(r.transmission ?? '', label),
      drive: driveOf(r.drivetrain ?? '', label),
      facelift: false,
      trim: null,
      years: Array.from({ length: to - from + 1 }, (_, i) => from + i),
      raw: `${r.generation} · ${label}`,
      confidence: engineL !== null ? 'yuksek' : 'orta',
      generation: { name: (r.generation ?? '').replace(/\s+/g, ' ').trim(), startYear: start, endYear: end },
    });
  }
  const confidence = { yuksek: 0, orta: 0, dusuk: 0 };
  for (const i of items) confidence[i.confidence]++;
  return {
    format: 1,
    source: 'vmm',
    version: opts.version,
    periodLabel: `vehicle-makes-models ${opts.version}`,
    generatedAt: (opts.now ?? new Date()).toISOString(),
    items,
    stats: {
      rows: rows.length,
      items: items.length,
      outOfScope,
      confidence,
      makes: new Set(items.map((i) => i.make)).size,
    },
  };
}
