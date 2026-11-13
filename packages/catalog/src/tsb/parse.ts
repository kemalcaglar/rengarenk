import type { VehicleCategorySlug } from '@rengarenk/shared';
import {
  BRAND_NAMES,
  CARAVAN_BRANDS,
  HEAVY_COMMERCIAL_BRANDS,
  MOTO_BRAND_NAMES,
  MULTIWORD_MOTO_BRANDS,
  OUT_OF_SCOPE_BRANDS,
  PICKUP_SERIES,
  SUV_SERIES,
  VAN_SERIES,
} from './brands.js';
import type { TsbRow } from './read.js';
import { normalizeHead } from './series.js';

/**
 * Ayrıştırıcı sürümü: kurallar değişince artırılır. Aynı TSB dosyası yeni sürümle yeniden işlenebilir
 * (içe aktarma, aynı dosyayı yalnızca aynı ayrıştırıcı sürümüyle bir kez uygular).
 */
export const TSB_PARSER = '2026-11-13';

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
  // TSB'nin yakıtı açıkça yazdığı kelimeler: modelde "Dizel" kalır ki aynı hacmin benzinlisinden ayrılsın
  DIZEL: { label: 'Dizel', fuel: 'dizel' },
  DIESEL: { label: 'Dizel', fuel: 'dizel' },
  DZL: { label: 'Dizel', fuel: 'dizel' },
  BLUHDI: { label: 'BlueHDi', fuel: 'dizel' },
  'E-HDI': { label: 'e-HDi', fuel: 'dizel' },
  BLUETEC: { label: 'BlueTEC', fuel: 'dizel' },
  XDI: { label: 'XDi', fuel: 'dizel' },
  VGT: { label: 'VGT', fuel: 'dizel' },
  DTI: { label: 'DTI', fuel: 'dizel' },
  TDS: { label: 'TDS', fuel: 'dizel' },
  SDI: { label: 'SDI', fuel: 'dizel' },
  'DI-D': { label: 'DI-D', fuel: 'dizel' },
  DID: { label: 'DI-D', fuel: 'dizel' },
  DDIS: { label: 'DDiS', fuel: 'dizel' },
  'I-CTDI': { label: 'i-CTDi', fuel: 'dizel' },
  CTDI: { label: 'CTDi', fuel: 'dizel' },
  D4D: { label: 'D-4D', fuel: 'dizel' },
  'D-CAT': { label: 'D-CAT', fuel: 'dizel' },
  TDV6: { label: 'TDV6', fuel: 'dizel' },
  TDV8: { label: 'TDV8', fuel: 'dizel' },
  SD4: { label: 'SD4', fuel: 'dizel' },
  TD4: { label: 'TD4', fuel: 'dizel' },
  ED4: { label: 'eD4', fuel: 'dizel' },
  'SKY-D': { label: 'Skyactiv-D', fuel: 'dizel' },
  'SKY-G': { label: 'Skyactiv-G', fuel: 'benzin' },
  CVVT: { label: 'CVVT', fuel: 'benzin' },
  MPI: { label: 'MPi', fuel: 'benzin' },
  VTI: { label: 'VTi', fuel: 'benzin' },
  FSI: { label: 'FSI', fuel: 'benzin' },
  THP: { label: 'THP', fuel: 'benzin' },
  'DIG-T': { label: 'DIG-T', fuel: 'benzin' },
  TWINPORT: { label: 'Twinport', fuel: 'benzin' },
  ECOTSI: { label: 'TSI', fuel: 'benzin' },
  'T-JET': { label: 'T-Jet', fuel: 'benzin' },
  VVT: { label: 'VVT', fuel: 'benzin' },
  DUALJET: { label: 'DualJet', fuel: 'benzin' },
  BOOSTERJET: { label: 'BoosterJet', fuel: 'benzin' },
  VALVEMATIC: { label: 'Valvematic', fuel: 'benzin' },
  V6: { label: 'V6' },
  V8: { label: 'V8' },
  V10: { label: 'V10' },
  V12: { label: 'V12' },
  W12: { label: 'W12' },
  BITURBO: { label: 'Biturbo' },
  'E-POWER': { label: 'e-Power', fuel: 'hibrit' },
  'PLUG-IN': { label: 'Plug-in', fuel: 'hibrit' },
  HYBRID4: { label: 'Hybrid4', fuel: 'hibrit' },
  'BI-FUEL': { label: 'LPG', fuel: 'lpg' },
  BIFUEL: { label: 'LPG', fuel: 'lpg' },
  'ECO-G': { label: 'ECO-G', fuel: 'lpg' },
  FOLGORE: { label: 'Folgore', fuel: 'elektrik' },
  PURETCH: { label: 'PureTech', fuel: 'benzin' },
  // DS E-Tense: DS 3'te elektrikli, DS 4 / 7 / 9'da şarj edilebilir hibrit (aşağıda düzeltilir)
  'E-TENSE': { label: 'E-Tense', fuel: 'hibrit' },
  // Renault Z.E. (zero emission)
  ZE: { label: 'Z.E.', fuel: 'elektrik' },
  'Z.E.': { label: 'Z.E.', fuel: 'elektrik' },
  'IG-T': { label: 'IG-T', fuel: 'benzin' },
  MJT: { label: 'Multijet', fuel: 'dizel' },
  JTS: { label: 'JTS', fuel: 'benzin' },
  QUADRAJET: { label: 'Quadrajet', fuel: 'dizel' },
  QUADROJET: { label: 'Quadrajet', fuel: 'dizel' },
  'D-CVVT': { label: 'D-CVVT', fuel: 'benzin' },
  SI4: { label: 'Si4', fuel: 'benzin' },
  CGI: { label: 'CGI', fuel: 'benzin' },
};

/** Yalnızca hacimden sonra anlam taşıyan tek harf: "1.9 D" dizeldir */
const FUEL_LETTER: Record<string, { label: string; fuel: Fuel }> = { D: { label: 'Dizel', fuel: 'dizel' } };

/** Tip adında motor teknolojisine eşlik eden, adda tutulmayan kelimeler */
const NOISE = new Set([
  'BMT',
  'ACT',
  'ECO',
  'S&S',
  'START&STOP',
  'STOP&START',
  'SS',
  'BLUEMOTION',
  'BLUE',
  // Motor ayrıntısı, paket değildir: supap sayısı, dizelde common rail ve AdBlue
  '16V',
  '8V',
  '12V',
  '24V',
  'CR',
  'SCR',
  'GREENTEC',
  'GREENTECH',
  // Güç birimi ("(155) PS") ve TSB'nin yerli üretim işareti "(Y)" (Hyundai, Honda, Toyota)
  'PS',
  'HP',
  'BG',
  '(Y)',
  // Güvenlik donanımı kısaltması (acil fren), paket adı değildir
  'AEBS',
]);
const NOISE2 = new Set(['GREEN TEC']);

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
  // TSB'nin eski listelerinde otomatik vites: aynı tip "OV"li ve "OV"siz iki satır olarak yer alır
  OV: 'otomatik',
  AUTO: 'otomatik',
  AUTOMATIC: 'otomatik',
  'A/T': 'otomatik',
  AT4: 'otomatik',
  AT5: 'otomatik',
  AT6: 'otomatik',
  AT7: 'otomatik',
  AT8: 'otomatik',
  AT9: 'otomatik',
  '4AT': 'otomatik',
  '5AT': 'otomatik',
  '6AT': 'otomatik',
  '7AT': 'otomatik',
  '8AT': 'otomatik',
  '9AT': 'otomatik',
  EDC6: 'otomatik',
  EDC7: 'otomatik',
  DCT6: 'otomatik',
  DCT7: 'otomatik',
  '6DCT': 'otomatik',
  '7DCT': 'otomatik',
  '8DCT': 'otomatik',
  DDCT: 'otomatik',
  TCT: 'otomatik',
  IVT: 'otomatik',
  MULTIDRIVE: 'otomatik',
  MULTITRONIC: 'otomatik',
  LINEARTRONIC: 'otomatik',
  TIPTRONI: 'otomatik',
  TIPTR: 'otomatik',
  MT: 'manuel',
  MANUEL: 'manuel',
  MANUAL: 'manuel',
  'M/T': 'manuel',
  MT5: 'manuel',
  MT6: 'manuel',
  '5MT': 'manuel',
  '6MT': 'manuel',
  AMT: 'yari_otomatik',
  DUALOGIC: 'yari_otomatik',
  'EASY-R': 'yari_otomatik',
  ETG: 'yari_otomatik',
  'C.MATIC': 'yari_otomatik',
  COMFORTMATIC: 'yari_otomatik',
  EASYTRONIC: 'yari_otomatik',
  MMT: 'yari_otomatik',
  SELESPEED: 'yari_otomatik',
  SENSODRIVE: 'yari_otomatik',
  SPORTSHIFT: 'yari_otomatik',
  SMG: 'yari_otomatik',
  ASG: 'yari_otomatik',
  MTA: 'yari_otomatik',
  SELECTRONIC: 'otomatik',
  'H-MATIC': 'otomatik',
  '2-TRONIC': 'yari_otomatik',
  '2TRONIC': 'yari_otomatik',
  '4/AT': 'otomatik',
  '5/AT': 'otomatik',
  '6/AT': 'otomatik',
  ETG5: 'yari_otomatik',
  ETG6: 'yari_otomatik',
  EGS: 'yari_otomatik',
  'TIPTRO.DSG': 'otomatik',
  'TIPTRO.': 'otomatik',
  TIPTRO: 'otomatik',
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
  // Opel "NB" (notchback) ve Hyundai "CW" (station)
  NB: 'Sedan',
  CW: 'Station wagon',
  WAGON: 'Station wagon',
  SPORTWAGON: 'Station wagon',
  BREAK: 'Station wagon',
  CONVERTIBLE: 'Cabrio',
  SPIDER: 'Roadster',
  SPYDER: 'Roadster',
  '4D': 'Sedan',
  '5D': 'Hatchback 5 kapı',
  '3D': 'Hatchback 3 kapı',
  COMBI: 'Kombi',
  CARGO: 'Panelvan',
  CAMLIVAN: 'Camlı van',
  SPACEBACK: 'Hatchback',
};
/** İki kelimelik kasa ifadeleri */
const BODY2: Record<string, string> = {
  '3 KAPI': 'Hatchback 3 kapı',
  '5 KAPI': 'Hatchback 5 kapı',
  'GRAN COUPE': 'Gran Coupe',
  'DOUBLE CAB': 'Pickup',
  'CAMLI VAN': 'Camlı van',
  '4 KAPI': 'Sedan',
  '2 KAPI': 'Coupe',
  'SPORTS TOURER': 'Station wagon',
  'SPORT TOURER': 'Station wagon',
  'KAPALI KASA': 'Panelvan',
  'STATION WAGON': 'Station wagon',
  'GRAN TURISMO': 'Gran Turismo',
  'GRAN TOURISMO': 'Gran Turismo',
};
/** İki kelimelik vites ifadeleri */
const GEARBOX2: Record<string, Gearbox> = {
  'S TRO': 'otomatik',
  'S TRONIC': 'otomatik',
  'MULTIDRIVE S': 'otomatik',
  'R TRONIC': 'otomatik',
};
const BODY_SHORT: Record<string, string> = {
  '3K': 'Hatchback 3 kapı',
  '5K': 'Hatchback 5 kapı',
  '4K': 'Sedan',
};

/** Makyaj: BMW "LCI", Mercedes "FL", Ford "MCA"/"MCAI" (mid-cycle action) */
const FACELIFT = new Set(['LCI', 'FL', 'MCA', 'MCAI', 'FACELIFT', 'FAZ2']);

/** Seriden hemen sonra gelen Roma rakamı kasa kuşağıdır ("MEGANE II", "GOLF VII"), paket değildir */
const GENERATION_NUMERAL = /^(II|III|IV|V|VI|VII|VIII|IX)$/;

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
const EMISSION = /^(E\d(\.\d)?[A-Z]*|EURO-?(\d|[IV]+)[A-Z]*)$/;
/** Paket olmayan TSB kodları: Opel model yılı ve paket numarası ("21LMTD", "P12") */
const CODE_NOISE = /^(\d{2}LMTD|P\d{1,3}|FAZ1)$/;

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
  TURKIYE: 'Türkiye',
  PAKETI: 'Paketi',
};

/** TSB'deki yazım hataları: doğru yazımla aynı pakete bağlanır */
const TYPOS: Record<string, string> = { HIGLINE: 'HIGHLINE', HIGHLNE: 'HIGHLINE', COMFORLINE: 'COMFORTLINE' };

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
      if (isAcronym(up)) return up; // XLV, CTS, LTZ, TT
      if (/\d/.test(w)) return up; // T10X, 3008, 50.
      if (w !== up) return w; // TSB'de zaten karışık yazılmış: eTSI, xDrive
      return w.toLowerCase().replace(/(^|[-/(+])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase());
    })
    .join(' ');
}

/** Ünlü harfi olan kısaltmalar (ünlüsüz kısa kelimeler zaten kısaltma sayılır) */
const VOWEL_ACRONYMS = new Set([
  'ASX',
  'EHS',
  'ES',
  'EX',
  'IS',
  'UX',
  'XE',
  'EQ',
  'HSE',
  'YRV',
  'RAV',
  'GLE',
  'GLA',
]);

/**
 * Kısaltma mı: 2–4 harfli ve ünlüsüz kelimeler (XLV, CTS, LTZ, TT, XF, NX) ya da sözlükteki ünlülü kısaltmalar.
 * "Up", "Ka", "Rio", "Uno" gibi gerçek adlar ünlü içerdiği için dokunulmaz.
 */
export function isAcronym(word: string): boolean {
  const up = word.toUpperCase();
  if (!/^[A-Z]{2,4}$/.test(up)) return false;
  return VOWEL_ACRONYMS.has(up) || !/[AEIOUY]/.test(up);
}

/** Bütün kaynakların adlarında kısaltmaları büyük harfe çevirir: "Rx 450h" → "RX 450h", "Ltz" → "LTZ" */
export function acronymCase(text: string): string {
  return text
    .split(' ')
    .map((w) => (isAcronym(w) ? w.toUpperCase() : w))
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
    // "1.4TFSI150" → "1.4 TFSI 150"
    const disp = /^(\d\.\d)([A-Z]{2,})(\d{2,3})?$/.exec(k);
    if (disp && ENGINE_TECH[disp[2] as string]) {
      out.push(disp[1] as string, disp[2] as string, ...(disp[3] ? [disp[3]] : []));
      continue;
    }
    // Kelimeye yapışık hacim ve motor: "SELECTIONBUSIN.1.5BLUEHDI" → "SELECTIONBUSIN.", "1.5", "BLUEHDI"
    const tail = /^(.*\D)(\d\.\d)([A-Z]{2,})$/.exec(k);
    if (tail && ENGINE_TECH[tail[3] as string]) {
      out.push(tail[1] as string, tail[2] as string, tail[3] as string);
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
  let make = head.make;
  tokens = splitGlued(head.tokens);
  // Eski listelerde Lexus Toyota'nın, Infiniti Nissan'ın altında yazılır: "LEXUS GS 450H", "INFINITI FX 35"
  if (make === 'Toyota' && key(tokens[0] ?? '') === 'LEXUS' && tokens.length > 1) {
    make = 'Lexus';
    tokens = tokens.slice(1);
  } else if (make === 'Nissan' && key(tokens[0] ?? '') === 'INFINITI' && tokens.length > 1) {
    make = 'Infiniti';
    tokens = tokens.slice(1);
  }
  // Lexus seri ve modeli bitişik yazılabilir: "CT200H", "RX450h", "GS300H"
  const lexusGlued = make === 'Lexus' ? /^([A-Z]{2,3})(\d{3}(?:H\+?|E|T)?)$/i.exec(tokens[0] ?? '') : null;
  if (lexusGlued) tokens.splice(0, 1, lexusGlued[1] as string, lexusGlued[2] as string);
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
    } else if (/^I3S$/i.test(t0)) {
      series = 'i3';
      model = 'i3s';
      tokens = tokens.slice(1);
    } else if (/^(X|Z|I|IX)\d{0,2}$/i.test(t0)) {
      series = t0.toUpperCase().replace(/^I/, 'i');
      // "sDRIVE20i" ya da ayrı yazılmış "sDRIVE 35i"
      const t2 = tokens[2] ?? '';
      const glued = /^([sxe])DRIVE(\d{2})([a-zA-Z]{0,2})$/i.exec(t1);
      const apart = /^([sxe])DRIVE$/i.test(t1) ? /^(\d{2})([a-zA-Z]{0,2})$/.exec(t2) : null;
      // Elektrikli i serisinde sayı önce yazılabilir: "i7 60 XDRIVE"
      const before = /^\d{2}$/.test(t1) && /^([sxe])DRIVE$/i.test(t2) ? [t2, t2[0] as string, t1, ''] : null;
      const d = glued ?? (apart ? [t1, t1[0] as string, apart[1] as string, apart[2] as string] : before);
      if (apart || before) tokens.splice(2, 1);
      if (/^I/i.test(t0) && /^M\d{2}$/i.test(t1)) {
        // "iX M60", "i4 M50"
        model = t1.toUpperCase();
        tokens = tokens.slice(2);
      } else if (d) {
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
      // Hyundai i serisi küçük i ile yazılır: i10, i20, i30, i40, i20 N
      if (make === 'Hyundai' && /^I\d{2}N?$/i.test(series)) series = `i${series.slice(1)}`;
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

  // Parantezin bitişik yazıldığı güç: "PLUS(80)" → "PLUS", "(80)"
  tokens = tokens.flatMap((t) => {
    const m = /^(.*[^\s(])(\(\d{2,4}\))$/.exec(t);
    return m ? [m[1] as string, m[2] as string] : [t];
  });
  // Kasa kuşağı numarası paket değildir: "MEGANE II SEDAN", "GOLF VII 1.6 TDI"
  if (GENERATION_NUMERAL.test(key(tokens[0] ?? ''))) tokens = tokens.slice(1);

  // Lexus model adı seriyle birlikte yazılır, "h" hibrittir: "RX 450h", "NX 300h", "ES 300h"
  if (make === 'Lexus' && !model) {
    const lx = /^(\d{3})(H\+?|E|T)?$/i.exec(tokens[0] ?? '');
    if (lx) {
      model = `${series} ${lx[1]}${(lx[2] ?? '').toLowerCase()}`;
      // "h" hibrit, "e" elektrikli (UX 300e, RZ 450e), "t" ve harfsiz benzinli (NX 200t, LC 500)
      fuel = /^E$/i.test(lx[2] ?? '') ? 'elektrik' : /^H/i.test(lx[2] ?? '') ? 'hibrit' : 'benzin';
      tokens = tokens.slice(1);
    }
  }

  // Infiniti model numarası: "FX 37", "EX 30d" (d dizel)
  if (make === 'Infiniti' && !model) {
    const inf = /^(\d{2})(D|S)?$/i.exec(tokens[0] ?? '');
    if (inf) {
      model = `${series} ${inf[1]}${(inf[2] ?? '').toLowerCase()}`;
      fuel = /^D$/i.test(inf[2] ?? '') ? 'dizel' : 'benzin';
      tokens = tokens.slice(1);
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] as string;
    const k = key(tok);
    const next = key(tokens[i + 1] ?? '');
    const paren = /^\((\d{2,4})\)$/.exec(tok);
    if (paren) {
      powerHp ??= Number(paren[1]);
      continue;
    }
    if (NOISE2.has(`${k} ${next}`)) {
      i++;
      continue;
    }
    if (CODE_NOISE.test(k)) continue;
    // Ticari kasa: 10 kişi ve üstü minibüstür ("16+1"; koltuk düzeni pakette kalır), kasalı ve şasi kamyonettir
    const seats = /^(\d{1,2})\+1$/.exec(k);
    if (seats && Number(seats[1]) >= 10) body ??= 'Minibüs';
    if (k === 'KASALI' || k === 'SASI' || k === 'ŞASİ' || (k === 'ACIK' && next === 'KASA'))
      body ??= 'Kamyonet';
    // Ford vites sayısı: "6S AT", "8S AT"
    if (make === 'Ford' && /^[5-9]S$/.test(k)) continue;
    // Seri adı tip adında ikinci kez yazılmış: "C70 C70 2.0 D"
    if (i === 0 && series && k === key(series)) continue;
    // MINI "SE" elektriklidir (Cooper SE, Countryman SE); adı pakette kalır
    if (k === 'SE' && make === 'MINI') fuel = 'elektrik';
    // Golf hiç sedan olmadı: TSB'nin "4 KAPI"sı arka kapısı sayılmayan 5 kapılı hatchback'tir
    if (k === '4' && next === 'KAPI' && make === 'Volkswagen' && series === 'Golf') {
      body ??= 'Hatchback 5 kapı';
      i++;
      continue;
    }
    // Toyota "TS" (Touring Sports) ve Opel "ST" (Sports Tourer) station wagondur
    if ((k === 'TS' && make === 'Toyota') || (k === 'ST' && make === 'Opel')) {
      body ??= 'Station wagon';
      continue;
    }
    // Skoda "COMBI" station wagondur; diğer markalarda (Doblo, Fiorino, Berlingo) kombi minivan
    if (k === 'COMBI' && make === 'Skoda') {
      body ??= 'Station wagon';
      continue;
    }
    // SsangYong benzinli turbo "G1.5T" ve bitişik dizel "A200XDI"
    const ssyG = /^G(\d\.\d)T?$/.exec(k);
    if (ssyG && make === 'SsangYong') {
      engineL ??= Number(ssyG[1]);
      fuel ??= 'benzin';
      continue;
    }
    if (make === 'SsangYong' && /^[A-Z]\d{3}XDI$/.test(k)) {
      tech.push('XDi');
      fuel = 'dizel';
      continue;
    }
    // SsangYong motor kodları: "D1.6", "D20DT", "D22DTR" (dizel)
    const ssy = /^D(\d\.\d)$/.exec(k) ?? /^[DE](\d)(\d)DTR?$/.exec(k);
    if (ssy) {
      engineL ??= Number(ssy[2] !== undefined && ssy[1]?.length === 1 ? `${ssy[1]}.${ssy[2]}` : ssy[1]);
      fuel = 'dizel';
      continue;
    }
    // Hacimden sonra tek başına "D": "KANGOO EXPRESS 1.9 D"
    const letter = FUEL_LETTER[k];
    if (letter && engineL !== null) {
      tech.push(letter.label);
      fuel = letter.fuel;
      continue;
    }
    if (/^\d{1,2}[.,]\d{1,2}$/.test(tok) && Number(tok.replace(',', '.')) < 10) {
      engineL ??= Number(tok.replace(',', '.'));
      continue;
    }
    // Ekli hacim: "1.6i", "2.0T", "1.416V" (1.4 16V), "2.2D"
    // Subaru "2.0R", "3.6R", "2.0X" (benzinli boxer)
    const dispSuffix = /^(\d\.\d{1,2})(16V|8V|I|T|TD|D|R|X)$/.exec(k);
    if (dispSuffix) {
      engineL ??= Number(dispSuffix[1]);
      const sfx = dispSuffix[2] as string;
      if (sfx === 'T') tech.push('Turbo');
      if (sfx === 'D' || sfx === 'TD') fuel ??= 'dizel';
      continue;
    }
    const kw = /^(\d{2,4}(?:\.\d)?)KW$/.exec(k);
    if (kw) {
      powerKw ??= Math.round(Number(kw[1]));
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
    // Kısaltılmış DSG yazımları: "TIPT.DSG", "TIPTRO.DSG", "S-TRONIC.DSG"
    if (/[.-]DSG$/.test(k)) {
      gearbox ??= 'otomatik';
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
    // Tip adının sonundaki sayı da güçtür ("FOCUS MCA TREND X 5 KAPI 123", "TRANSIT 350 MF VAN 125");
    // tek başına ("F 430") ya da "EDITION 10", "SRT 10" gibi bir adın parçasıysa değildir.
    if (
      i === tokens.length - 1 &&
      i > 0 &&
      /^\d{2,4}$/.test(k) &&
      powerHp === null &&
      Number(k) >= 70 &&
      Number(k) <= 1000 &&
      !['EDITION', 'SRT', 'SERIES', 'IV'].includes(key(tokens[i - 1] ?? ''))
    ) {
      powerHp = Number(k);
      continue;
    }
    trimTokens.push(tok);
  }

  if (fuel === null && powerKw !== null && engineL === null) fuel = 'elektrik';
  if (make === 'DS' && tech.includes('E-Tense') && /^DS 3/.test(series ?? '')) fuel = 'elektrik';
  // Elektrikli seriler adından bilinir (BMW i, Mercedes EQ, Tesla, Togg); motor adından gelen tahmini ezer
  const byName = electricByName(make, series);
  if (byName) fuel = byName;
  // Volvo "T3"–"T6" benzinli turbo, adı yalnızca "TURBO" olan motor benzinli (dizelde dCi, TDI yazar)
  if (fuel === null && make === 'Volvo' && powerClass && /^T\d$/.test(powerClass)) fuel = 'benzin';
  if (fuel === null && tech.includes('Turbo')) fuel = 'benzin';
  // BMW M modelleri benzinlidir
  if (fuel === null && make === 'BMW' && /^M\d/.test(model ?? '')) fuel = 'benzin';
  if (fuel === null && PETROL_MAKES.has(key(make))) fuel = 'benzin';
  // Audi S ve RS modelleri benzinlidir (dizel SQ modellerinde TDI yazar)
  if (fuel === null && make === 'Audi' && /^(R?S\d|RS ?Q\d|TT|R8)$/i.test(series ?? '')) fuel = 'benzin';
  // Fiat 500e: "500 E"
  if (make === 'Fiat' && series === '500' && /(^| )E( |$)/.test(key(row.typeName).replace(/^500 /, ' ')))
    fuel = 'elektrik';
  // Mercedes-AMG motorları benzinlidir (elektrikli AMG'ler EQ serisindedir)
  if (fuel === null && make === 'Mercedes-Benz' && /AMG/.test(`${series} ${model} ${row.typeName}`))
    fuel = 'benzin';
  // MINI: Cooper D / SD / One D dizel, SE elektrikli (yukarıda), diğerleri benzinli
  if (fuel === null && make === 'MINI')
    fuel = /\b(SD|D)$/.test(model ?? '') || / D\b/.test(model ?? '') ? 'dizel' : 'benzin';
  // smart: EQ / ED elektrikli, #1 ve #3 elektrikli; geri kalanı (fortwo, forfour) benzinli
  if (fuel === null && make === 'Smart')
    fuel = /\b(EQ|ED)\b/.test(key(row.typeName)) || /^#/.test(series ?? '') ? 'elektrik' : 'benzin';
  if (fuel === null && engineL !== null) fuel = 'benzin';

  if (!model) {
    const engine = [engineL !== null ? engineL.toFixed(1) : powerClass, ...tech].filter(Boolean).join(' ');
    model = engine || (powerKw !== null ? `${powerKw} kW` : series);
  }
  if (head.modelPrefix && model && !model.startsWith(head.modelPrefix))
    model = `${head.modelPrefix} ${model}`;

  if (vehicleClass) body ??= vehicleClass.body;
  const categories = vehicleClass ? [vehicleClass.category] : categorize(brandKey, make, series, body, fuel);
  const trim = trimTokens.length ? smartCase(trimTokens.map((t) => TYPOS[key(t)] ?? t).join(' ')) : null;
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

/** Yalnızca elektrikli üreten markalar ve elektrikli seriler (BMW i, Mercedes EQ); BMW i8 hibrittir */
const ELECTRIC_MAKES = new Set(['Tesla', 'Togg', 'Polestar', 'Lucid', 'Rivian']);
/** Yalnızca elektrikli üretilen seriler (adında yakıt yazmaz) */
const ELECTRIC_SERIES = new Set([
  'TAYCAN',
  'ID.3',
  'ID.4',
  'ID.5',
  'ID.7',
  'ID. BUZZ',
  'E-GOLF',
  'E-UP',
  'LEAF',
  'ARIYA',
  'ZOE',
  'SPRING',
  'IONIQ 5',
  'IONIQ 6',
  'EV3',
  'EV6',
  'EV9',
  'ENYAQ',
  'ELROQ',
  'BORN',
  'MUSTANG MACH-E',
  'I-PACE',
  'EX30',
  'EX40',
  'EC40',
  'EX90',
  'C40',
  'BZ4X',
  'SOLTERRA',
  'DOLPHIN',
  'SEAL',
  'ATTO 3',
  'MG4',
]);
/** Yalnızca hibrit üretilen seriler */
const HYBRID_SERIES = new Set(['296', 'SF90', 'REVUELTO', 'ARTURA', 'NSX']);
/**
 * Yalnızca benzinli motor üreten spor ve lüks markalar: tip adında yakıt yazmaz. Hibrit ve elektrikli
 * istisnaları ya adlarında yazar (E-HYBRID, FOLGORE) ya da yukarıdaki serilerde tanımlıdır.
 */
const PETROL_MAKES = new Set([
  'FERRARI',
  'LAMBORGHINI',
  'MASERATI',
  'ASTON MARTIN',
  'BENTLEY',
  'ROLLS-ROYCE',
  'MCLAREN',
  'PORSCHE',
  'LOTUS',
  'CATERHAM',
  'DODGE',
  'ALPINE',
  'MAYBACH',
]);
function electricByName(make: string, series: string | null): Fuel | null {
  if (ELECTRIC_MAKES.has(make)) return 'elektrik';
  const sk = series ? key(series) : '';
  if (ELECTRIC_SERIES.has(sk)) return 'elektrik';
  if (HYBRID_SERIES.has(sk)) return 'hibrit';
  // "Corsa-e", "Mokka-e", "e-208", "ë-C4" (Jaguar E-Pace benzinlidir)
  if (series && make !== 'Jaguar' && (/-E$/i.test(series) || /^[EË]-/i.test(series))) return 'elektrik';
  if (make === 'BMW' && series && /^i(X\d?|[3-7])$/i.test(series)) return 'elektrik';
  if (make === 'BMW' && series === 'i8') return 'hibrit';
  if (make === 'Mercedes-Benz' && series && /^EQ[A-Z]\b/.test(series)) return 'elektrik';
  if (make === 'Audi' && series && /e-tron/i.test(series)) return 'elektrik';
  return null;
}

function bmwFuel(suffix: string): Fuel {
  const s = suffix.toLowerCase();
  if (s.startsWith('d')) return 'dizel';
  if (s.startsWith('e')) return 'hibrit';
  return 'benzin';
}

/** Bütün modelleri arazi/SUV olan markalar */
const SUV_MAKES = new Set(['Jeep', 'Land Rover']);
/** Ticari seri adlarıyla çakışan spor ve lüks markalar (Ferrari California, VW California değildir) */
const SPORT_MAKES = new Set([
  'Ferrari',
  'Lamborghini',
  'Maserati',
  'Porsche',
  'Bentley',
  'Rolls-Royce',
  'Aston Martin',
  'McLaren',
]);

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
  else if (body === 'Pickup') out.push('arazi-suv-pickup');
  else if (series && VAN_SERIES.has(key(series)) && !SPORT_MAKES.has(make)) out.push('minivan-panelvan');
  else if (
    (series && PICKUP_SERIES.has(key(series))) ||
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

/** Vites kelimesi olan tokenlar; ikili ifadeler ("S TRONIC") tek token gibi ele alınır */
function gearboxFreeSignature(raw: string): string {
  const toks = raw.split(' ').filter(Boolean).map(key);
  const out: string[] = [];
  for (let i = 0; i < toks.length; i++) {
    const k = toks[i] as string;
    if (GEARBOX2[`${k} ${toks[i + 1] ?? ''}`]) {
      i++;
      continue;
    }
    if (GEARBOX[k]) continue;
    out.push(k);
  }
  return out.sort().join(' ');
}

/**
 * TSB yalnızca otomatik vitesi yazar: aynı tip "OV"li ve "OV"siz iki satır olarak listelenir. Vites kelimesi
 * dışında aynı olan bir otomatik ikizi bulunan, vitesi yazılmamış tip manueldir. İkizi olmayan tipin vitesi
 * bilinmez kalır (tahmin edilmez). Aynı markanın aynı dosyadaki satırlarıyla karşılaştırılır.
 */
export function inferManualGearbox(variants: ParsedVariant[]): number {
  const auto = new Set<string>();
  for (const v of variants) {
    if (v.gearbox === 'otomatik' || v.gearbox === 'yari_otomatik')
      auto.add(`${v.sourceKey.split('-')[0]}|${gearboxFreeSignature(v.raw)}`);
  }
  let n = 0;
  for (const v of variants) {
    if (v.gearbox !== null || v.source !== 'tsb') continue;
    if (auto.has(`${v.sourceKey.split('-')[0]}|${gearboxFreeSignature(v.raw)}`)) {
      v.gearbox = 'manuel';
      n++;
    }
  }
  return n;
}
