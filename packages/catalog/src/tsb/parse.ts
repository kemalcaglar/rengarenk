import type { VehicleCategorySlug } from '@rengarenk/shared';
import {
  BRAND_NAMES,
  CARAVAN_BRANDS,
  HEAVY_COMMERCIAL_BRANDS,
  MOTO_BRAND_NAMES,
  MULTIWORD_MOTO_BRANDS,
  OUT_OF_SCOPE_BRANDS,
  SUV_SERIES,
} from './brands.js';
import type { TsbRow } from './read.js';
import { normalizeHead } from './series.js';

/**
 * Ayrıştırıcı sürümü: kurallar değişince artırılır. Aynı TSB dosyası yeni sürümle yeniden işlenebilir
 * (içe aktarma, aynı dosyayı yalnızca aynı ayrıştırıcı sürümüyle bir kez uygular).
 */
export const TSB_PARSER = '2026-11-08';

export type Fuel = 'benzin' | 'dizel' | 'hibrit' | 'elektrik' | 'lpg';
export type Gearbox = 'manuel' | 'otomatik' | 'yari_otomatik';
export type Drive = 'onden' | 'arkadan' | '4x4';
export type Confidence = 'yuksek' | 'orta' | 'dusuk';

/** TSB tip adından çıkarılan, katalog için normalize edilmiş araç tipi. */
export type CatalogSourceKey = 'tsb' | 'vmm' | 'yerli' | 'wikidata' | 'vehiclesdb';

/** Kasa kuşağı (nesil): ör. "3 Series Sedan (1998)", 1998–2002 */
export interface ParsedGeneration {
  name: string;
  startYear: number;
  endYear: number | null;
}

export interface ParsedVariant {
  source: CatalogSourceKey;
  /** TSB marka kodu + tip kodu: kaynaktaki değişmez kimlik */
  sourceKey: string;
  make: string;
  /** Seri (BMW "3 Serisi", VW "Golf"); motosiklet ve ATV'de yok */
  series: string | null;
  /** Motor sürümü (BMW "320i", VW "1.0 TSI", Mercedes "C 200 d") */
  model: string;
  categories: VehicleCategorySlug[];
  body: string | null;
  engineL: number | null;
  powerHp: number | null;
  powerKw: number | null;
  fuel: Fuel | null;
  gearbox: Gearbox | null;
  drive: Drive | null;
  /** Makyajlı kasa (TSB tip adında BMW "LCI", Mercedes "FL") */
  facelift: boolean;
  /** Donanım paketi (Karar 32): tip adından motor, güç, vites, kasa ifadeleri ayıklandıktan sonra kalan */
  trim: string | null;
  years: number[];
  /** Kaynaktaki yazımı, olduğu gibi */
  raw: string;
  /** Kasa kuşağı; TSB'de yoktur (açık kaynaklardan gelir) */
  generation?: ParsedGeneration;
  confidence: Confidence;
}

export type ParseResult = { ok: true; variant: ParsedVariant } | { ok: false; reason: 'kapsam_disi' };

// ── Sözlükler ─────────────────────────────────────────────────────

/** Motor teknolojisi kelimeleri: model adında kalır, yakıtı da söyler */
export const ENGINE_TECH: Record<string, { label: string; fuel?: Fuel }> = {
  TDI: { label: 'TDI', fuel: 'dizel' },
  TSI: { label: 'TSI', fuel: 'benzin' },
  ETSI: { label: 'eTSI', fuel: 'hibrit' },
  TFSI: { label: 'TFSI', fuel: 'benzin' },
  TFSIE: { label: 'TFSI e', fuel: 'hibrit' },
  TBI: { label: 'TBi', fuel: 'benzin' },
  TB: { label: 'TB', fuel: 'benzin' },
  JTD: { label: 'JTD', fuel: 'dizel' },
  JTDM: { label: 'JTDm', fuel: 'dizel' },
  'M.JET': { label: 'Multijet', fuel: 'dizel' },
  MJET: { label: 'Multijet', fuel: 'dizel' },
  MULTIJET: { label: 'Multijet', fuel: 'dizel' },
  FIRE: { label: 'Fire', fuel: 'benzin' },
  FIREFLY: { label: 'FireFly', fuel: 'benzin' },
  MULTIAIR: { label: 'MultiAir', fuel: 'benzin' },
  DCI: { label: 'dCi', fuel: 'dizel' },
  BLUEDCI: { label: 'Blue dCi', fuel: 'dizel' },
  TCE: { label: 'TCe', fuel: 'benzin' },
  SCE: { label: 'SCe', fuel: 'benzin' },
  HDI: { label: 'HDi', fuel: 'dizel' },
  BLUEHDI: { label: 'BlueHDi', fuel: 'dizel' },
  PURETECH: { label: 'PureTech', fuel: 'benzin' },
  ECOBOOST: { label: 'EcoBoost', fuel: 'benzin' },
  ECOBLUE: { label: 'EcoBlue', fuel: 'dizel' },
  TDCI: { label: 'TDCi', fuel: 'dizel' },
  CRDI: { label: 'CRDi', fuel: 'dizel' },
  CDI: { label: 'CDI', fuel: 'dizel' },
  CDTI: { label: 'CDTI', fuel: 'dizel' },
  GDI: { label: 'GDi', fuel: 'benzin' },
  'T-GDI': { label: 'T-GDi', fuel: 'benzin' },
  TGDI: { label: 'T-GDi', fuel: 'benzin' },
  'D-4D': { label: 'D-4D', fuel: 'dizel' },
  'VVT-I': { label: 'VVT-i', fuel: 'benzin' },
  'I-VTEC': { label: 'i-VTEC', fuel: 'benzin' },
  VTEC: { label: 'VTEC', fuel: 'benzin' },
  'I-DTEC': { label: 'i-DTEC', fuel: 'dizel' },
  SKYACTIV: { label: 'Skyactiv', fuel: 'benzin' },
  TURBO: { label: 'Turbo' },
  'TWIN ENGINE': { label: 'Twin Engine', fuel: 'hibrit' },
  RECHARGE: { label: 'Recharge', fuel: 'hibrit' },
  HYBRID: { label: 'Hybrid', fuel: 'hibrit' },
  HIBRIT: { label: 'Hibrit', fuel: 'hibrit' },
  HEV: { label: 'HEV', fuel: 'hibrit' },
  MHEV: { label: 'MHEV', fuel: 'hibrit' },
  PHEV: { label: 'PHEV', fuel: 'hibrit' },
  'E-TECH': { label: 'E-Tech', fuel: 'hibrit' },
  'E-HYBRID': { label: 'E-Hybrid', fuel: 'hibrit' },
  'E-TRON': { label: 'e-tron', fuel: 'elektrik' },
  ETRON: { label: 'e-tron', fuel: 'elektrik' },
  LPG: { label: 'LPG', fuel: 'lpg' },
  ELEKTRIK: { label: 'Elektrik', fuel: 'elektrik' },
  ELEKTRIKLI: { label: 'Elektrik', fuel: 'elektrik' },
  EV: { label: 'EV', fuel: 'elektrik' },
  BEV: { label: 'EV', fuel: 'elektrik' },
};

/** Tip adında motor teknolojisine eşlik eden, adda tutulmayan kelimeler */
const NOISE = new Set(['BMT', 'ACT', 'ECO', 'S&S', 'START&STOP', 'STOP&START', 'SS', 'BLUEMOTION', 'BLUE']);

export const GEARBOX: Record<string, Gearbox> = {
  AT: 'otomatik',
  OTOMATIK: 'otomatik',
  'OTOM.': 'otomatik',
  OTOM: 'otomatik',
  DSG: 'otomatik',
  DCT: 'otomatik',
  EDC: 'otomatik',
  CVT: 'otomatik',
  'X-TRONIC': 'otomatik',
  XTRONIC: 'otomatik',
  EAT6: 'otomatik',
  EAT8: 'otomatik',
  STEPTRONIC: 'otomatik',
  TIPTRONIC: 'otomatik',
  'S-TRONIC': 'otomatik',
  STRONIC: 'otomatik',
  STR: 'otomatik',
  TIPTRON: 'otomatik',
  'T.TRONIC': 'otomatik',
  '9G-TRONIC': 'otomatik',
  '9-TRONIC': 'otomatik',
  '7G-TRONIC': 'otomatik',
  '7G-DCT': 'otomatik',
  '8G-DCT': 'otomatik',
  PDK: 'otomatik',
  GEARTRONIC: 'otomatik',
  GEARTR: 'otomatik',
  POWERSHIFT: 'otomatik',
  'E-CVT': 'otomatik',
  MT: 'manuel',
  MANUEL: 'manuel',
  AMT: 'yari_otomatik',
  DUALOGIC: 'yari_otomatik',
  'EASY-R': 'yari_otomatik',
  ETG: 'yari_otomatik',
};

export const DRIVE: Record<string, Drive> = {
  XDRIVE: '4x4',
  '4MATIC': '4x4',
  '4MATIC+': '4x4',
  '4MOTION': '4x4',
  '4M': '4x4',
  QUATTRO: '4x4',
  AWD: '4x4',
  '4X4': '4x4',
  '4WD': '4x4',
  ALL4: '4x4',
  '4MORE': '4x4',
  ALLGRIP: '4x4',
  RWD: 'arkadan',
  SDRIVE: 'arkadan',
  FWD: 'onden',
  '4X2': 'onden',
};

/** Kasa kelimeleri ve ekrandaki adları */
const BODY: Record<string, string> = {
  SEDAN: 'Sedan',
  HB: 'Hatchback',
  HATCHBACK: 'Hatchback',
  COUPE: 'Coupe',
  CABRIO: 'Cabrio',
  CABRIOLET: 'Cabrio',
  ROADSTER: 'Roadster',
  TOURING: 'Station wagon',
  'S.WAGON': 'Station wagon',
  SW: 'Station wagon',
  ESTATE: 'Station wagon',
  AVANT: 'Station wagon',
  VARIANT: 'Station wagon',
  KOMBI: 'Kombi',
  SPORTBACK: 'Sportback',
  FASTBACK: 'Fastback',
  LIFTBACK: 'Liftback',
  VAN: 'Van',
  PANELVAN: 'Panelvan',
  MINIVAN: 'Minivan',
  MINIBUS: 'Minibüs',
  MIDIBUS: 'Midibüs',
  OTOBUS: 'Otobüs',
  KAMYONET: 'Kamyonet',
  KAMYON: 'Kamyon',
  CEKICI: 'Çekici',
  'PICK-UP': 'Pickup',
  PICKUP: 'Pickup',
  CROSSOVER: 'Crossover',
};
/** İki kelimelik kasa ifadeleri */
const BODY2: Record<string, string> = {
  '3 KAPI': 'Hatchback 3 kapı',
  '5 KAPI': 'Hatchback 5 kapı',
  'GRAN COUPE': 'Gran Coupe',
  'DOUBLE CAB': 'Pickup',
  'CAMLI VAN': 'Camlı van',
};
/** İki kelimelik vites ifadeleri */
const GEARBOX2: Record<string, Gearbox> = { 'S TRO': 'otomatik', 'S TRONIC': 'otomatik' };
const BODY_SHORT: Record<string, string> = { '3K': 'Hatchback 3 kapı', '5K': 'Hatchback 5 kapı' };

const FACELIFT = new Set(['LCI', 'FL']);

/**
 * Ticari araçlarda TSB tip adının başına araç sınıfını yazar: "KAMYON AROCS 3342", "OTOBUS CONECTO SOLO".
 * Sınıf kelimesi kategoriyi ve kasayı belirler, seri ondan sonraki kelimedir.
 */
const VEHICLE_CLASS: Record<string, { body: string; category: VehicleCategorySlug }> = {
  OTOBUS: { body: 'Otobüs', category: 'ticari' },
  MIDIBUS: { body: 'Midibüs', category: 'ticari' },
  MINIBUS: { body: 'Minibüs', category: 'ticari' },
  KAMYON: { body: 'Kamyon', category: 'ticari' },
  KAMYONET: { body: 'Kamyonet', category: 'ticari' },
  CEKICI: { body: 'Çekici', category: 'ticari' },
  DORSE: { body: 'Dorse', category: 'ticari' },
  ROMORK: { body: 'Römork', category: 'ticari' },
  PANELVAN: { body: 'Panelvan', category: 'minivan-panelvan' },
};
const EMISSION = /^(E\d(\.\d)?[A-Z]*|EURO-?\d[A-Z]*)$/;

/** İki kelimelik bilinen seriler (ör. Citroen C3 Aircross) */
const MULTIWORD_SERIES = [...SUV_SERIES].filter((s) => s.includes(' '));

/** Mercedes sınıf adları: "C 200" → "C Serisi" */
const MERCEDES_CLASSES = new Set([
  'A',
  'B',
  'C',
  'E',
  'S',
  'G',
  'V',
  'X',
  'CL',
  'CLA',
  'CLC',
  'CLE',
  'CLS',
  'CLK',
  'SL',
  'SLK',
  'SLC',
  'GLA',
  'GLB',
  'GLC',
  'GLE',
  'GLS',
  'GLK',
  'ML',
  'GL',
  'R',
  'EQA',
  'EQB',
  'EQC',
  'EQE',
  'EQS',
  'EQV',
  'AMG',
]);

/** Kısaltmalar büyük harf kalır: "M SPORT" → "M Sport", "RS LINE" → "RS Line" */
const KEEP_UPPER = new Set([
  'AMG',
  'GT',
  'GTI',
  'GTD',
  'GTE',
  'GTS',
  'RS',
  'ST',
  'SE',
  'LE',
  'XL',
  'XLT',
  'GLX',
  'GL',
  'SR',
  'R',
  'M',
  'S',
  'TCR',
  'JCW',
  'SRT',
  'TRD',
  'GR',
  'ZR',
  'N',
  'V1',
  'V2',
  'II',
  'III',
  'IV',
  'TSI',
  'TDI',
]);

/** TSB'de ASCII yazılan Türkçe kelimelerin doğru yazımı */
const TURKISH_WORDS: Record<string, string> = {
  YIL: 'Yıl',
  YILI: 'Yılı',
  OZEL: 'Özel',
  SERI: 'Seri',
  OKUL: 'Okul',
  CIFT: 'Çift',
  TEK: 'Tek',
};

/**
 * TSB metni ASCII büyük harftir (İ yerine I). Türkçe kurallarla küçültülürse "EDITION" → "Edıtıon" olur;
 * bu yüzden İngilizce kurallar kullanılır, bilinen Türkçe kelimeler sözlükten düzeltilir.
 */
export function smartCase(text: string): string {
  return text
    .split(' ')
    .filter(Boolean)
    .map((w) => {
      const up = w.toUpperCase();
      if (TURKISH_WORDS[up]) return TURKISH_WORDS[up];
      if (KEEP_UPPER.has(up.replace(/[.\-+]/g, ''))) return up;
      if (/\d/.test(w)) return up; // T10X, 3008, 50.
      if (w !== up) return w; // TSB'de zaten karışık yazılmış: eTSI, xDrive
      return w.toLowerCase().replace(/(^|[-/(])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase());
    })
    .join(' ');
}

/** TSB büyük harfi Türkçe karakter kullanmaz (I yerine İ yok); karşılaştırma için tek biçim */
const key = (t: string) => t.toLocaleUpperCase('en-US');

const brandTitle = (b: string) =>
  b.toLowerCase().replace(/(^|[\s\-/(])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase());

// ── Ayrıştırma ───────────────────────────────────────────────────

/** Bölünebilecek bilinen kelimeler (uzundan kısaya): yapışık yazımı ayırmak için */
const SPLIT_WORDS = [
  ...new Set([
    ...Object.keys(ENGINE_TECH),
    ...Object.keys(GEARBOX),
    ...Object.keys(DRIVE),
    ...Object.keys(BODY),
    'ADVANCED',
    'DESIGN',
    'SPORT',
    'LINE',
  ]),
]
  .filter((w) => /^[A-Z]{3,}$/.test(w))
  .sort((a, b) => b.length - a.length);

/**
 * TSB bazı tiplerde kelimeleri bitişik yazar: "45TFSIQUATTRO265ADVANCED" → "45 TFSI QUATTRO 265 ADVANCED",
 * "A5SPORTBACK" → "A5 SPORTBACK". Yalnızca uzun ve sözlükte olmayan kelimeler bölünür; "320i", "4MATIC",
 * "9G-TRONIC", "T10X" gibi gerçek adlara dokunulmaz.
 */
export function splitGlued(tokens: string[]): string[] {
  const out: string[] = [];
  for (const tok of tokens) {
    const k = key(tok);
    const known = ENGINE_TECH[k] || GEARBOX[k] || DRIVE[k] || BODY[k] || NOISE.has(k) || EMISSION.test(k);
    if (known || tok.length < 4 || tok.includes('-')) {
      out.push(tok);
      continue;
    }
    // "3.0TFSI" → "3.0 TFSI"
    const disp = /^(\d\.\d)([A-Z]{2,})$/.exec(k);
    if (disp && ENGINE_TECH[disp[2] as string]) {
      out.push(disp[1] as string, disp[2] as string);
      continue;
    }
    if (tok.includes('.')) {
      out.push(tok);
      continue;
    }
    // "A5SPORTBACK": harf+rakamla başlayan seri kodunu koru (A5, Q5, C3).
    const first = /^([A-Z]{1,2}\d{1,2})([A-Z]{4,}.*)$/.exec(k);
    if (first && splitWords(first[2] as string).every((p) => SPLIT_WORDS.includes(p))) {
      out.push(first[1] as string, ...splitGlued([first[2] as string]));
      continue;
    }
    // Rakam ve harf öbekleri: "40TDI", "45TFSIQUATTRO265ADVANCED". Harf öbeklerinin hepsi sözlükte olmalı;
    // olmazsa (model kodu "SRK125", gerçek kelime "AVANTGARDE") dokunulmaz.
    const runs = k.match(/\d+|[A-Z]+/g) ?? [k];
    if (runs.join('') !== k) {
      out.push(tok);
      continue;
    }
    const pieces = runs.flatMap((r) => (/^\d+$/.test(r) ? [r] : splitWords(r)));
    const letterPieces = pieces.filter((p) => !/^\d+$/.test(p));
    const allKnown = letterPieces.length > 0 && letterPieces.every((p) => SPLIT_WORDS.includes(p));
    out.push(...(allKnown && pieces.length > 1 ? pieces : [tok]));
  }
  return out;
}

function splitWords(s: string): string[] {
  const out: string[] = [];
  let rest = s;
  let buf = '';
  while (rest) {
    const w = SPLIT_WORDS.find((x) => rest.startsWith(x));
    if (w) {
      if (buf) out.push(buf);
      buf = '';
      out.push(w);
      rest = rest.slice(w.length);
    } else {
      buf += rest[0];
      rest = rest.slice(1);
    }
  }
  if (buf) out.push(buf);
  return out;
}

export function parseTsbRow(row: TsbRow): ParseResult {
  const brandKey = key(row.brandName);
  if (OUT_OF_SCOPE_BRANDS.has(brandKey)) return { ok: false, reason: 'kapsam_disi' };
  const base = {
    source: 'tsb' as const,
    sourceKey: `${row.brandCode}-${row.typeCode}`,
    years: row.years,
    raw: row.typeName,
  };
  if (brandKey === 'MOTORSIKLET') return { ok: true, variant: { ...base, ...parseMoto(row.typeName) } };

  let tokens = splitGlued(row.typeName.split(' ').filter(Boolean));
  let series: string | null = null;
  let model: string | null = null;
  let fuel: Fuel | null = null;

  let vehicleClass: (typeof VEHICLE_CLASS)[string] | null = null;
  if (VEHICLE_CLASS[key(tokens[0] ?? '')] && tokens.length > 1) {
    vehicleClass = VEHICLE_CLASS[key(tokens[0] as string)] as (typeof VEHICLE_CLASS)[string];
    tokens = tokens.slice(1);
  }

  // Seri yazımlarını tek biçime getir (series.ts): marka tekrarı, Jeep, Range Rover, MINI, DS, Transit ...
  const head = normalizeHead(BRAND_NAMES[brandKey] ?? brandTitle(row.brandName), brandKey, tokens);
  const make = head.make;
  tokens = splitGlued(head.tokens);
  series = head.series ?? null;
  if (head.model) model = head.model;

  // Seri ve model: markaya özgü kurallar, yoksa ilk kelime seridir.
  const t0 = tokens[0] ?? '';
  const t1 = tokens[1] ?? '';
  if (series) {
    // normalizeHead seriyi belirledi
  } else if (make === 'BMW') {
    const num = /^(\d)(\d{2})([a-zA-Z]{0,2})$/.exec(t0);
    const mNum = /^M(\d)(\d{2})([a-zA-Z]{0,2})$/i.exec(t0);
    if (num) {
      series = `${num[1]} Serisi`;
      model = `${num[1]}${num[2]}${(num[3] ?? '').toLowerCase()}`;
      fuel = bmwFuel(num[3] ?? '');
      tokens = tokens.slice(1);
    } else if (mNum) {
      series = `${mNum[1]} Serisi`;
      model = `M${mNum[1]}${mNum[2]}${(mNum[3] ?? '').toLowerCase()}`;
      fuel = bmwFuel(mNum[3] ?? '');
      tokens = tokens.slice(1);
    } else if (/^M\d$/i.test(t0)) {
      series = 'M Serisi';
      model = t0.toUpperCase();
      tokens = tokens.slice(1);
    } else if (/^(X|Z|I|IX)\d{0,2}$/i.test(t0)) {
      series = t0.toUpperCase().replace(/^I/, 'i');
      // "sDRIVE20i" ya da ayrı yazılmış "sDRIVE 35i"
      const t2 = tokens[2] ?? '';
      const glued = /^([sx])DRIVE(\d{2})([a-zA-Z]{0,2})$/i.exec(t1);
      const apart = /^([sx])DRIVE$/i.test(t1) ? /^(\d{2})([a-zA-Z]{0,2})$/.exec(t2) : null;
      const d = glued ?? (apart ? [t1, t1[0] as string, apart[1] as string, apart[2] as string] : null);
      if (apart) tokens.splice(2, 1);
      if (d) {
        model = `${d[1]?.toLowerCase()}Drive${d[2]}${(d[3] ?? '').toLowerCase()}`;
        fuel = bmwFuel(d[3] ?? '');
        tokens = tokens.slice(2);
        tokens.unshift(d[1]?.toLowerCase() === 'x' ? 'XDRIVE' : 'SDRIVE');
      } else {
        tokens = tokens.slice(1);
      }
    }
  } else if (make === 'Mercedes-Benz' && MERCEDES_CLASSES.has(key(t0)) && /^\d{2,3}$/.test(t1)) {
    series = `${key(t0)} Serisi`;
    const suffix = ['D', 'E', 'H'].includes(key(tokens[2] ?? '')) ? (tokens[2] ?? '').toLowerCase() : '';
    model = `${key(t0)} ${t1}${suffix ? ` ${suffix}` : ''}`;
    fuel = suffix === 'd' ? 'dizel' : suffix === 'e' ? 'hibrit' : 'benzin';
    tokens = tokens.slice(suffix ? 3 : 2);
  } else if (make === 'Mercedes-Benz' && MERCEDES_CLASSES.has(key(t0)) && key(t0) !== 'AMG') {
    // Sınıf adı tek başına: "C SEDAN 1.6", "CLA SHOOTING BRAKE"
    series = `${key(t0)} Serisi`;
    tokens = tokens.slice(1);
  }
  if (!series && key(t0) === 'MODEL' && /^[A-Z0-9]$/i.test(t1)) {
    series = `Model ${t1.toUpperCase()}`; // Tesla Model 3, Model Y
    tokens = tokens.slice(2);
  }
  if (!series) {
    const two = key(`${t0} ${t1}`);
    if (MULTIWORD_SERIES.includes(two)) {
      series = smartCase(`${t0} ${t1}`);
      tokens = tokens.slice(2);
    } else {
      series = make === 'Lexus' ? key(t0) : smartCase(t0); // Lexus seri adları kısaltmadır: ES, NX, RX
      tokens = tokens.slice(1);
    }
  }

  // Kalan kelimeler: kasa, motor, güç, yakıt, vites, çekiş, makyaj; geri kalanı donanım paketi.
  let body: string | null = null;
  let engineL: number | null = null;
  let powerHp: number | null = null;
  let powerKw: number | null = null;
  let gearbox: Gearbox | null = null;
  let drive: Drive | null = null;
  let facelift = false;
  const tech: string[] = [];
  let powerClass: string | null = null;
  const trimTokens: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] as string;
    const k = key(tok);
    const next = key(tokens[i + 1] ?? '');
    const paren = /^\((\d{2,4})\)$/.exec(tok);
    if (paren) {
      powerHp ??= Number(paren[1]);
      continue;
    }
    if (/^\d{1,2}[.,]\d{1,2}$/.test(tok) && Number(tok.replace(',', '.')) < 10) {
      engineL ??= Number(tok.replace(',', '.'));
      continue;
    }
    // Ekli hacim: "1.6i", "2.0T", "1.416V" (1.4 16V), "2.2D"
    const dispSuffix = /^(\d\.\d)(16V|8V|I|T|TD|D)$/.exec(k);
    if (dispSuffix) {
      engineL ??= Number(dispSuffix[1]);
      const sfx = dispSuffix[2] as string;
      if (sfx === 'T') tech.push('Turbo');
      if (sfx === 'D' || sfx === 'TD') fuel ??= 'dizel';
      continue;
    }
    const kw = /^(\d{2,4})KW$/.exec(k);
    if (kw) {
      powerKw ??= Number(kw[1]);
      continue;
    }
    if (/^\d{2,4}$/.test(k) && next === 'KW') {
      powerKw ??= Number(k);
      i++;
      continue;
    }
    // Güç sınıfı: Audi "45 TFSI", "40 TDI", "50 e-tron" (hacim yerine)
    if (/^\d{2}$/.test(k) && ENGINE_TECH[next] && powerClass === null) {
      powerClass = k;
      continue;
    }
    if (GEARBOX2[`${k} ${next}`]) {
      gearbox ??= GEARBOX2[`${k} ${next}`] as Gearbox;
      i++;
      continue;
    }
    if (BODY2[`${k} ${next}`]) {
      body ??= BODY2[`${k} ${next}`] as string;
      i++;
      continue;
    }
    if (BODY[k] || BODY_SHORT[k]) {
      body ??= (BODY[k] ?? BODY_SHORT[k]) as string;
      continue;
    }
    if (ENGINE_TECH[`${k} ${next}`]) {
      const t = ENGINE_TECH[`${k} ${next}`] as { label: string; fuel?: Fuel };
      tech.push(t.label);
      if (t.fuel) fuel = t.fuel;
      i++;
      continue;
    }
    // Volvo motor kodları: B4, B5, B6, T5, T8, D4
    if (make === 'Volvo' && /^[BTD]\d$/.test(k) && powerClass === null) {
      powerClass = k;
      if (k.startsWith('D')) fuel ??= 'dizel';
      if (k.startsWith('B')) fuel ??= 'hibrit';
      continue;
    }
    if (ENGINE_TECH[k]) {
      const t = ENGINE_TECH[k] as { label: string; fuel?: Fuel };
      tech.push(t.label);
      if (t.fuel && (fuel === null || fuel === 'benzin' || t.fuel === 'hibrit' || t.fuel === 'elektrik'))
        fuel = t.fuel;
      continue;
    }
    if (NOISE.has(k)) continue;
    if (GEARBOX[k]) {
      gearbox ??= GEARBOX[k] as Gearbox;
      continue;
    }
    if (DRIVE[k]) {
      drive ??= DRIVE[k] as Drive;
      continue;
    }
    if (FACELIFT.has(k)) {
      facelift = true;
      continue;
    }
    if (EMISSION.test(k)) continue;
    // Çıplak sayı: motor bilgisinden sonra geliyorsa beygir gücüdür (ör. "1.0 TSI 115").
    if (/^\d{2,4}$/.test(k) && powerHp === null && (engineL !== null || tech.length > 0)) {
      const n = Number(k);
      if (n >= 40 && n <= 1600) {
        powerHp = n;
        continue;
      }
    }
    trimTokens.push(tok);
  }

  if (fuel === null && powerKw !== null && engineL === null) fuel = 'elektrik';
  if (fuel === null && engineL !== null) fuel = 'benzin';

  if (!model) {
    const engine = [engineL !== null ? engineL.toFixed(1) : powerClass, ...tech].filter(Boolean).join(' ');
    model = engine || (powerKw !== null ? `${powerKw} kW` : series);
  }
  if (head.modelPrefix && model && !model.startsWith(head.modelPrefix))
    model = `${head.modelPrefix} ${model}`;

  if (vehicleClass) body ??= vehicleClass.body;
  const categories = vehicleClass ? [vehicleClass.category] : categorize(brandKey, make, series, body, fuel);
  const trim = trimTokens.length ? smartCase(trimTokens.join(' ')) : null;
  const confidence: Confidence =
    model !== series && (engineL !== null || powerKw !== null || powerHp !== null || powerClass !== null)
      ? 'yuksek'
      : model !== series
        ? 'orta'
        : 'dusuk';

  return {
    ok: true,
    variant: {
      ...base,
      make,
      series,
      model,
      categories,
      body,
      engineL,
      powerHp,
      powerKw,
      fuel,
      gearbox,
      drive,
      facelift,
      trim,
      confidence,
    },
  };
}

function bmwFuel(suffix: string): Fuel {
  const s = suffix.toLowerCase();
  if (s.startsWith('d')) return 'dizel';
  if (s.startsWith('e')) return 'hibrit';
  return 'benzin';
}

/** Bütün modelleri arazi/SUV olan markalar */
const SUV_MAKES = new Set(['Jeep', 'Land Rover']);

function categorize(
  brandKey: string,
  make: string,
  series: string | null,
  body: string | null,
  fuel: Fuel | null,
): VehicleCategorySlug[] {
  const out: VehicleCategorySlug[] = [];
  if (CARAVAN_BRANDS.has(brandKey)) out.push('karavan');
  else if (HEAVY_COMMERCIAL_BRANDS.has(brandKey)) out.push('ticari');
  else if (body && ['Van', 'Panelvan', 'Minivan', 'Kombi', 'Camlı van'].includes(body))
    out.push('minivan-panelvan');
  else if (body && ['Minibüs', 'Midibüs', 'Otobüs', 'Kamyonet', 'Kamyon', 'Çekici'].includes(body))
    out.push('ticari');
  else if (
    body === 'Pickup' ||
    SUV_MAKES.has(make) ||
    (series && SUV_SERIES.has(key(series).replace(/ SERISI$/, '')))
  )
    out.push('arazi-suv-pickup');
  else out.push('otomobil');
  if (fuel === 'elektrik' && !out.includes('ticari') && !out.includes('karavan')) out.push('elektrikli');
  return out;
}

/** TSB "MOTORSIKLET" grubu: gerçek marka tip adının başındadır; seri katmanı yoktur (Kategori şemaları). */
function parseMoto(rawName: string): Omit<ParsedVariant, 'source' | 'sourceKey' | 'years' | 'raw'> {
  const typeName = rawName.replaceAll('\\', ' ').replace(/\s+/g, ' ').trim();
  const up = key(typeName);
  const multi = MULTIWORD_MOTO_BRANDS.find((b) => up === b || up.startsWith(`${b} `));
  const brandRaw = multi ?? (typeName.split(' ')[0] as string);
  let rest = typeName.slice(brandRaw.length).trim();
  const make = MOTO_BRAND_NAMES[key(brandRaw)] ?? brandTitle(brandRaw);
  const restKey = key(rest);
  const category: VehicleCategorySlug = /\bATV\b|\bQUAD\b/.test(restKey)
    ? 'atv'
    : /\bUTV\b|\bSIDE ?BY ?SIDE\b|\bSXS\b/.test(restKey)
      ? 'utv'
      : 'motosiklet';
  rest = rest.replace(/\b(ATV|UTV)\b\s*/gi, '').trim();
  const cc = /(?:^|\s)(\d{2,4})(?:\s|$|-)/.exec(rest);
  const drive: Drive | null = /\b4X4\b/i.test(rest) ? '4x4' : /\b4X2\b/i.test(rest) ? 'onden' : null;
  return {
    make,
    series: null,
    model: rest ? smartCase(rest) : make,
    categories: [category],
    body: null,
    engineL: cc && Number(cc[1]) >= 49 && Number(cc[1]) <= 2500 ? Number(cc[1]) / 1000 : null,
    powerHp: null,
    powerKw: null,
    fuel: /\bELEKTRIK|\bEV\b|\bE-/i.test(rest) ? 'elektrik' : 'benzin',
    gearbox: null,
    drive,
    facelift: false,
    trim: null,
    confidence: rest ? 'orta' : 'dusuk',
  };
}
