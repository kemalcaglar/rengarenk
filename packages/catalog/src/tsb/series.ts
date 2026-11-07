/**
 * TSB tip adının başındaki seri yazımlarını tek biçime getirir (Sprint 6, ad eşleme). TSB aynı seriyi farklı
 * yazar: "TRAN.ICA3", "TR.MCAI", "TRANSITVAN350LF" hepsi Ford Transit'tir; Jeep, Chrysler markası altında
 * "JEEP COMPASS" diye geçer; Range Rover markasında seri adı yazılmaz ("3.0 D300 HSE"). Bu kurallar ayrıştırıcıdan
 * önce çalışır ve yalnızca tip adının başına dokunur. Kaynaklar arası eşleme (vehicle-makes-models, Wikidata)
 * `catalog_aliases` tablosundadır.
 */

const key = (t: string) => t.toLocaleUpperCase('en-US');

export interface Head {
  make: string;
  tokens: string[];
  /** Seri kesinleşti (ayrıştırıcı ilk kelimeye bakmaz) */
  series?: string;
  /** Model adının önüne gelecek ek: Mercedes-AMG, Mercedes-Maybach */
  modelPrefix?: string;
  /** Model adı tip adından kesin çıktı (MINI One, Cooper S) */
  model?: string;
}

/** Tek kelimelik yazım düzeltmeleri (marka içinde) */
const ONE_WORD: Record<string, Record<string, string>> = {
  Volkswagen: { CC: 'CC', 'ID-4': 'ID.4', ID4: 'ID.4', 'T.PORTER': 'Transporter' },
  Ford: { 'T.CONNECT': 'Transit Connect' },
};

/** Jeep'in Chrysler altında bitişik yazımı: "JEEPGRANDCHEROKEE", "GRANDCHEROKEE", "JEEPRENEGADE" */
const JEEP_GLUED = /^(?:JEEP)?(GRAND\.?CHEROKEE|CHEROKEE|RENEGADE|COMPASS|WRANGLER|AVENGER|GLADIATOR)(.*)$/;
const JEEP_SERIES: Record<string, string> = {
  GRANDCHEROKEE: 'Grand Cherokee',
  'GRAND.CHEROKEE': 'Grand Cherokee',
  CHEROKEE: 'Cherokee',
  RENEGADE: 'Renegade',
  COMPASS: 'Compass',
  WRANGLER: 'Wrangler',
  AVENGER: 'Avenger',
  GLADIATOR: 'Gladiator',
};

/** MINI motor sürümleri tip adında geçer: ONE, COOPER, COOPER S, COOPER SD, JCW */
function miniModel(tokens: string[]): { model?: string; tokens: string[] } {
  const i = tokens.findIndex((x) => /^(ONE|COOPER|JCW)$/i.test(x));
  if (i < 0) return { tokens };
  const first = key(tokens[i] as string);
  const next = key(tokens[i + 1] ?? '');
  if (first === 'COOPER' && /^(S|SD|D|SE|C|E)$/.test(next)) {
    return { model: `Cooper ${next}`, tokens: tokens.filter((_, j) => j !== i && j !== i + 1) };
  }
  if (first === 'JCW') return { model: 'John Cooper Works', tokens: tokens.filter((_, j) => j !== i) };
  return { model: first === 'ONE' ? 'One' : 'Cooper', tokens: tokens.filter((_, j) => j !== i) };
}

/** Ayrı yazılmış iki kelimelik seriler. Sağdaki ad katalogda kullanılan yazımdır. */
export const TWO_WORD_SERIES: Record<string, string> = {
  'GRANDE PUNTO': 'Grande Punto',
  'G. PUNTO': 'Grande Punto',
  'G. CHEROKEE': 'Grand Cherokee',
  'GRANDE PANDA': 'Grande Panda',
  'GRAND SCENIC': 'Grand Scenic',
  'GRAND MODUS': 'Grand Modus',
  'GRAND ESPACE': 'Grand Espace',
  'GRAND VITARA': 'Grand Vitara',
  'GRAND VOYAGER': 'Grand Voyager',
  'GRAND CALIFORNIA': 'Grand California',
  'GRAND C-MAX': 'Grand C-Max',
  'GRAND CHEROKEE': 'Grand Cherokee',
  'PT CRUISER': 'PT Cruiser',
  'URBAN CRUISER': 'Urban Cruiser',
  'LAND CRUISER': 'Land Cruiser',
  'FLYING SPUR': 'Flying Spur',
  'F TYPE': 'F-Type',
  'GRAN TURISMO': 'GranTurismo',
  'GRAN CABRIO': 'GranCabrio',
  'VEL SATIS': 'Vel Satis',
  'PRO CEED': 'ProCeed',
  'XSARA PICASSO': 'Xsara Picasso',
  'ACCENT ERA': 'Accent Era',
  'ACCENT BLUE': 'Accent Blue',
  'ACTYON SPORTS': 'Actyon Sports',
  'KORANDO SPORTS': 'Korando Sports',
  'MUSSO GRAND': 'Musso Grand',
  'V8 VANTAGE': 'Vantage',
  'V90 CROSS': 'V90 Cross Country',
  'V90 CROSSCOUNTRY': 'V90 Cross Country',
  'V60 CROSS': 'V60 Cross Country',
  'V60 CROSSCOUNTRY': 'V60 Cross Country',
  'V40 CROSS': 'V40 Cross Country',
  'NEW BEETLE': 'Beetle',
  'THE BEETLE': 'Beetle',
  'ID. BUZZ': 'ID. Buzz',
  'E-C3 AIRCROSS': 'ë-C3 Aircross',
  'E-C5 AIRCROSS': 'ë-C5 Aircross',
  'TOURNEO CUSTOM': 'Tourneo Custom',
  'TOURNEO CONNECT': 'Tourneo Connect',
  'TOURNEO COURIER': 'Tourneo Courier',
  'TRANSIT CUSTOM': 'Transit Custom',
  'TRANSIT CONNECT': 'Transit Connect',
  'TRANSIT COURIER': 'Transit Courier',
  'E-TRANSIT CUSTOM': 'E-Transit Custom',
  'E-TOURNEO CUSTOM': 'E-Tourneo Custom',
  'T. CONNECT': 'Transit Connect',
  'MC QASHQAI': 'Qashqai',
  'MY FIORINO': 'Fiorino',
};

/** "V90 CROSS COUNTRY" gibi üç kelimede üçüncü kelime de seriye aittir. */
const THIRD_WORD: Record<string, string> = {
  'V90 CROSS': 'COUNTRY',
  'V60 CROSS': 'COUNTRY',
  'V40 CROSS': 'COUNTRY',
};

/** Bitişik ya da kısaltılmış yazılan hafif ticari seriler (uzun önek önce). */
const GLUED_PREFIX: { make: string; re: RegExp; series: string }[] = [
  { make: 'Ford', re: /^TOURNEO\.?COURIER/, series: 'Tourneo Courier' },
  { make: 'Ford', re: /^TOURNEO\.?CONNECT/, series: 'Tourneo Connect' },
  { make: 'Ford', re: /^TOURNEO\.?CUSTOM/, series: 'Tourneo Custom' },
  { make: 'Ford', re: /^TRANSIT\.?COURIER/, series: 'Transit Courier' },
  { make: 'Ford', re: /^(TRANSIT\.?|T\.)CONNECT/, series: 'Transit Connect' },
  { make: 'Ford', re: /^(TRANSIT\.?|T\.)CUSTOM/, series: 'Transit Custom' },
  // TRAN.ICA3, TRAN.MCAI, TRANS.MCAI, TRA.MCAI, TR.MCAI, TR.350L, TRANSITVAN350LF, TRANSITKAMYONET ...
  { make: 'Ford', re: /^(TRANSIT|TRANS\.|TRAN\.|TRA\.|TR\.)/, series: 'Transit' },
  { make: 'Mercedes-Benz', re: /^E-?SPRINTER/, series: 'eSprinter' },
  { make: 'Mercedes-Benz', re: /^SPRINTER(?=[A-Z])/, series: 'Sprinter' },
  { make: 'Mercedes-Benz', re: /^EACTROS/, series: 'eActros' },
];

/** Mercedes sınıf ve sayının bitişik yazımı: "C180K" → C 180 K, "V300D" → V 300 D */
const MERCEDES_GLUED =
  /^(A|B|C|E|S|G|V|CL|CLA|CLC|CLE|CLK|CLS|SL|SLK|SLC|GLA|GLB|GLC|GLE|GLS|GLK|ML|GL|R)(\d{2,3})([A-Z]{0,4})$/;

const RANGE_ROVER: Record<string, string> = {
  SPORT: 'Range Rover Sport',
  EVOQUE: 'Range Rover Evoque',
  VELAR: 'Range Rover Velar',
};

/** MINI'de seri, tip adının içindeki gövde adıdır; geri kalanı Cooper (3/5 kapı). */
const MINI_SERIES: Record<string, string> = {
  COUNTRYMAN: 'Countryman',
  CLUBMAN: 'Clubman',
  PACEMAN: 'Paceman',
  ACEMAN: 'Aceman',
  CABRIO: 'Cabrio',
  CABRIOLET: 'Cabrio',
  CONVERTIBLE: 'Cabrio',
  COUPE: 'Coupe',
  ROADSTER: 'Roadster',
};

export function normalizeHead(make: string, brandKey: string, input: string[]): Head {
  let tokens = [...input];
  let modelPrefix: string | undefined;
  const t = (i: number) => key(tokens[i] ?? '');

  // Marka tip adında tekrar ediyorsa atılır: "LEXUS ES 250", "MINI COOPER", "DS 7 CROSSBACK"
  const makeKeys = [key(make), key(make).replace(/-/g, ' '), key(make).replace(/[- ]/g, '')];
  if (key(t(0)) === 'MY' && tokens.length > 2) tokens = tokens.slice(1); // "MY FIESTA": model yılı işareti
  if (make === 'Mercedes-Benz' && /^MERCEDES-?(AMG|MAYBACH)$/.test(t(0))) {
    modelPrefix = t(0).endsWith('AMG') ? 'AMG' : 'Maybach';
    tokens = tokens.slice(1);
  } else if (make === 'Mercedes-Benz' && t(0) === 'MERCEDES' && /^(AMG|MAYBACH)$/.test(t(1))) {
    modelPrefix = t(1) === 'AMG' ? 'AMG' : 'Maybach';
    tokens = tokens.slice(2);
  } else if (make === 'Mercedes-Benz' && t(0) === 'MERCEDES' && tokens.length > 1) {
    tokens = tokens.slice(1);
  } else if (makeKeys.includes(t(0)) && tokens.length > 1) {
    tokens = tokens.slice(1);
  }

  // Jeep, TSB'de Chrysler markası altındadır.
  if (make === 'Chrysler' && t(0) === 'JEEP' && tokens.length > 1) {
    return normalizeHead('Jeep', 'JEEP', tokens.slice(1));
  }
  if (make === 'Chrysler' || make === 'Jeep') {
    const j = JEEP_GLUED.exec(t(0));
    if (j) {
      const rest = (j[2] ?? '').replace(/^\./, '');
      return {
        make: 'Jeep',
        tokens: [...(rest ? [rest] : []), ...tokens.slice(1)],
        series: JEEP_SERIES[j[1] as string],
      };
    }
  }
  // McLaren, TSB'de Mercedes-Benz altında da geçer ("MCLAREN 650S SPIDER").
  if (make === 'Mercedes-Benz' && t(0) === 'MCLAREN' && tokens.length > 1) {
    return normalizeHead('McLaren', 'MCLAREN', tokens.slice(1));
  }
  const fix = ONE_WORD[make]?.[t(0)];
  if (fix) return { make, tokens: tokens.slice(1), series: fix };

  // Range Rover markasında seri adı yoktur; "SPORT", "EVOQUE", "VELAR" ise ilk kelimedir.
  if (brandKey === 'RANGE ROVER') {
    const named = RANGE_ROVER[t(0)];
    if (named) return { make, tokens: tokens.slice(1), series: named };
    if (t(0) === 'RANGE' && t(1) === 'ROVER') tokens = tokens.slice(2);
    const after = RANGE_ROVER[t(0)];
    if (after) return { make, tokens: tokens.slice(1), series: after };
    return { make, tokens, series: 'Range Rover' };
  }

  if (make === 'MINI') {
    const idx = tokens.findIndex((x) => MINI_SERIES[key(x)]);
    if (idx >= 0) {
      const series = MINI_SERIES[key(tokens[idx] as string)] as string;
      return { make, ...miniModel(tokens.filter((_, i) => i !== idx)), series };
    }
    return { make, ...miniModel(tokens), series: 'Cooper' };
  }

  if (make === 'DS') {
    const n = /^N[O°](\d)$/.exec(t(0)); // N°4, N°8 (TSB: NO4)
    if (n) return { make, tokens: tokens.slice(1), series: `N°${n[1]}` };
    const glued = /^DS(\d)(?:CROSSBACK)?$/.exec(t(0));
    if (glued) return { make, tokens: tokens.slice(1), series: `DS ${glued[1]}` };
    if (/^\d$/.test(t(0))) return { make, tokens: tokens.slice(1), series: `DS ${t(0)}` };
  }

  if (make === 'Mercedes-Benz') {
    const g = MERCEDES_GLUED.exec(t(0));
    if (g) tokens.splice(0, 1, g[1] as string, g[2] as string, ...(g[3] ? [g[3]] : []));
    if (t(0) === 'V' && /^K?C?LASSE$/.test(t(1))) tokens.splice(1, 1);
    if (t(0) === 'AMG' && t(1) === 'GT')
      return { make, tokens: tokens.slice(2), series: 'AMG GT', modelPrefix: 'AMG GT' };
    if (modelPrefix === 'AMG' && (t(0) === 'GT' || /^\d{2}$/.test(t(0)))) {
      return { make, tokens: t(0) === 'GT' ? tokens.slice(1) : tokens, series: 'AMG GT', modelPrefix };
    }
  }

  const two = `${t(0)} ${t(1)}`;
  const named = TWO_WORD_SERIES[two];
  if (named) {
    const third = THIRD_WORD[two];
    return { make, tokens: tokens.slice(third && t(2) === third ? 3 : 2), series: named, modelPrefix };
  }

  for (const p of GLUED_PREFIX) {
    if (p.make !== make) continue;
    const m = p.re.exec(t(0));
    if (!m) continue;
    // "TRANSIT" tek başına ve arkasında CUSTOM/CONNECT/COURIER varsa yukarıdaki iki kelimelik kural yakalar.
    const rest = (tokens[0] as string).slice(m[0].length).replace(/^\./, '');
    return { make, tokens: [...(rest ? [rest] : []), ...tokens.slice(1)], series: p.series, modelPrefix };
  }

  return { make, tokens, modelPrefix };
}
