import type { TeknikOzet } from '@rengarenk/shared';
import { unzipSync } from 'fflate';
import { adAnahtari, anaYerlestir } from './ana-liste/index.js';
import { parseCsvRows } from './csv.js';
import type { Fuel, Gearbox } from './tsb/parse.js';
import { isXls, readXlsFirstSheet } from './xls.js';
import type { Cell } from './xlsx.js';

/**
 * ADEME araç onay verisi (Fransa; Karar 33, sahip isteği 16 Kasım 2026: paketlerin teknik özellikleri). Fransa'da satışa
 * sunulan her sürümün onay değerleri: güç, vites türü ve sayısı, karma tüketim, CO2, boş ağırlık, Euro normu. Lisans:
 * Licence Ouverte / Open Licence (Etalab), atıf zorunlu. Türkiye'de hangi sürümün satıldığını TSB belirler; ADEME
 * yalnızca o sürümün (aynı marka, seri, yakıt ve güç) teknik değerlerini verir.
 *
 * Yıllık dosyalar data.gouv.fr'de (2001–2015; 2002 7z, 2004 eksik olduğu için alınmaz), güncel liste data.ademe.fr'de.
 */
export const ADEME_PARSER = '2026-11-16-2';

export interface AdemeDosya {
  /** Dosyanın yayın yılı (o yıl satışta olan sürümler) */
  yil: number;
  adres: string;
  /** Başlık satırı olmayan dosyada sütun adları */
  basliksiz?: string[];
}

export const ADEME_DOSYALAR: readonly AdemeDosya[] = [
  {
    yil: 2001,
    adres: 'https://www.data.gouv.fr/storage/f/2014-07-07T10-00-47/carlab-mars-2001-complete.zip',
  },
  {
    yil: 2003,
    adres: 'https://www.data.gouv.fr/storage/f/2014-07-07T09-59-56/carlab-mars-2003-complete.zip',
  },
  {
    yil: 2005,
    adres: 'https://www.data.gouv.fr/storage/f/2014-07-07T09-58-58/carlab-mars-2005-complete.zip',
  },
  {
    yil: 2006,
    adres: 'https://www.data.gouv.fr/storage/f/2014-07-07T09-58-20/carlab-mars-2006-complete.zip',
    basliksiz: [
      'MARQUE',
      'MODELE VERSION',
      'CNIT',
      'MINE',
      'ENERGIE',
      'CV',
      'puissance reelle',
      'bv',
      'urb',
      'ex-urb',
      'mixte',
      'CO2',
    ],
  },
  {
    yil: 2007,
    adres: 'https://www.data.gouv.fr/storage/f/2014-07-07T09-57-17/carlab-mars-2007-complete.zip',
  },
  {
    yil: 2008,
    adres: 'https://www.data.gouv.fr/storage/f/2014-07-07T09-56-53/carlab-mars-2008-complete.zip',
  },
  {
    yil: 2009,
    adres: 'https://www.data.gouv.fr/storage/f/2014-07-07T09-55-32/carlab-mars-2009-complete.zip',
  },
  {
    yil: 2010,
    adres: 'https://www.data.gouv.fr/storage/f/2014-07-07T09-55-04/carlab-mars-2010-complete.zip',
  },
  {
    yil: 2011,
    adres: 'https://www.data.gouv.fr/storage/f/2014-07-07T09-54-06/carlab-mars-2011-complete.zip',
  },
  {
    yil: 2012,
    adres: 'https://www.data.gouv.fr/storage/f/2014-07-07T09-52-28/carlab-mars-2012-complete.zip',
  },
  {
    yil: 2013,
    adres: 'https://www.data.gouv.fr/storage/f/2014-07-07T09-51-51/carlab-mars-2013-complete.zip',
  },
  {
    yil: 2014,
    adres: 'https://www.data.gouv.fr/storage/f/2014-07-03T17-44-17/carlab-mars-2014-complete.zip',
  },
  {
    yil: 2015,
    adres:
      'https://static.data.gouv.fr/resources/emissions-de-co2-et-de-polluants-des-vehicules-commercialises-en-france/20151015-121340/fic_etiq_edition_40-mars-2015.zip',
  },
];

/** Güncel liste (data-fair API, JSON satırlar) */
export const ADEME_GUNCEL = 'https://data.ademe.fr/data-fair/api/v1/datasets/ademe-car-labelling/lines';

/** Bir onay sürümü (aynı değerli CNIT satırları birleşmiş) */
export interface AdemeSurum {
  yil: number;
  /** Katalogdaki marka adı (ana liste adı) */
  marka: string;
  /** Katalogdaki seri adı (ana listeye yerleşmiş); bilinmiyorsa null */
  seri: string | null;
  aciklama: string;
  yakit: Fuel | null;
  kw: number | null;
  hp: number | null;
  /** Motor hacmi, litre (güncel listede cm³'ten, eskilerde açıklamadaki "1.6" yazımından) */
  hacim: number | null;
  vites: Gearbox | null;
  vitesSayisi: number | null;
  tuketimMin: number | null;
  tuketimMax: number | null;
  co2Min: number | null;
  co2Max: number | null;
  agirlikMin: number | null;
  agirlikMax: number | null;
  euro: string | null;
  /** Birleşen onay satırı (CNIT) sayısı */
  adet: number;
}

/** Aynı sürümün onay satırları (CNIT başına) tek kayda: tüketim, CO2 ve ağırlık aralık olur */
export function ademeBirlestir(xs: readonly AdemeSurum[]): AdemeSurum[] {
  const m = new Map<string, AdemeSurum>();
  const min = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.min(a, b));
  const max = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));
  for (const x of xs) {
    const k = [
      x.yil,
      x.marka,
      x.seri,
      x.aciklama,
      x.yakit,
      x.kw,
      x.hp,
      x.hacim,
      x.vites,
      x.vitesSayisi,
      x.euro,
    ].join('|');
    const e = m.get(k);
    if (!e) {
      m.set(k, { ...x });
      continue;
    }
    e.tuketimMin = min(e.tuketimMin, x.tuketimMin);
    e.tuketimMax = max(e.tuketimMax, x.tuketimMax);
    e.co2Min = min(e.co2Min, x.co2Min);
    e.co2Max = max(e.co2Max, x.co2Max);
    e.agirlikMin = min(e.agirlikMin, x.agirlikMin);
    e.agirlikMax = max(e.agirlikMax, x.agirlikMax);
    e.adet += x.adet;
  }
  return [...m.values()];
}

/** Kaydın kalıcı kimliği (aynı sürüm her içe aktarmada aynı kimliği alır) */
export function ademeKimlik(x: AdemeSurum): string {
  const t = [
    x.yil,
    x.marka,
    x.seri,
    x.aciklama,
    x.yakit,
    x.kw,
    x.hp,
    x.hacim,
    x.vites,
    x.vitesSayisi,
    x.euro,
  ].join('|');
  let h = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < t.length; i++) {
    h = Math.imul(h ^ t.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ t.charCodeAt(i), 0x5bd1e995) >>> 0;
  }
  return `${x.yil}-${h.toString(36)}${h2.toString(36)}`;
}

const key = (c: Cell | undefined) => adAnahtari(String(c ?? ''));

const SUTUN: Record<string, string[]> = {
  marka: ['marque', 'marques', 'libmrq', 'libmrqdoss'],
  model: ['libmod', 'modutac', 'modeleutac'],
  aciklama: ['dscom', 'designationcommerciale', 'modeleversion', 'modelesversions', 'modele'],
  yakit: ['codcbr', 'typcbr', 'energ', 'carburant', 'energie', 'carb'],
  kw: ['puissmax', 'puissancemaximalekw', 'puissancereelle', 'puissancemax', 'puiss'],
  vites: ['typboitenbrapp', 'boitedevitesse', 'bv'],
  tuketim: ['consomixte', 'consommationmixtel100km', 'mixte'],
  co2: ['co2', 'co2mixte', 'co2gkm'],
  agirlikMin: ['masseordmamin', 'massevideeurominkg'],
  agirlikMax: ['masseordmamax', 'massevideeuromaxkg'],
  euro: ['champv9'],
};

/** Yakıt kodları: ES benzin, GO dizel, EH/GH/EE/GL hibrit, EL elektrik, GP (LPG) */
export function ademeYakit(s: string): Fuel | null {
  const k = s.trim().toUpperCase();
  if (k === 'ES' || k === 'ESSENCE' || k === 'FE') return 'benzin';
  if (k === 'GO' || k === 'GAZOLE') return 'dizel';
  if (k === 'EL' || k === 'ELECTRIC' || k === 'ELECTRIQUE') return 'elektrik';
  if (/^(EH|GH|EE|GL|EH\/|ESS\+ELEC|GAZ\+ELEC)/.test(k) || k.includes('HYBRIDE')) return 'hibrit';
  if (k.includes('GP')) return 'lpg';
  return null;
}

/**
 * Vites: "M 6" manuel 6 ileri, "A 7" otomatik, "V" sürekli değişken (otomatik), "D" çift kavramalı (otomatik),
 * "S" sıralı robotlu (yarı otomatik). Güncel listede "MECANIQUE", "AUTOMATIQUE" ve ayrı vites sayısı.
 */
export function ademeVites(s: string, sayi?: unknown): { vites: Gearbox | null; vitesSayisi: number | null } {
  const t = s.trim().toUpperCase();
  const m = /^([MAVDS])\.?\s*(\d{1,2})?$/.exec(t);
  const harf =
    m?.[1] ?? (t.startsWith('MECA') ? 'M' : t.startsWith('AUTO') ? 'A' : t.startsWith('VARIA') ? 'V' : '');
  const vites: Gearbox | null =
    harf === 'M'
      ? 'manuel'
      : harf === 'A' || harf === 'V' || harf === 'D'
        ? 'otomatik'
        : harf === 'S'
          ? 'yari_otomatik'
          : null;
  const n = Number(m?.[2] ?? sayi);
  return { vites, vitesSayisi: vites && Number.isInteger(n) && n > 1 && n < 12 ? n : null };
}

/** Pozitif sayı; Fransızca ondalık virgül okunur, kayan nokta artığı bir haneye yuvarlanır ("4,099999905" → 4.1) */
const sayi = (c: Cell | undefined): number | null => {
  if (c === null || c === undefined || c === '') return null;
  const n = typeof c === 'number' ? c : Number(String(c).trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
};

const MARKA: Record<string, string> = {
  mercedes: 'Mercedes-Benz',
  mercedesamg: 'Mercedes-Benz',
  mercedesbenz: 'Mercedes-Benz',
  vw: 'Volkswagen',
  alfa: 'Alfa Romeo',
  jaguarlandroverlimited: 'Land Rover',
  ladavaz: 'Lada',
};

/** Fransızca ad → katalog adı */
const MODEL_ADI: Record<string, string> = { coccinelle: 'Beetle', newbeetle: 'Beetle' };

/** Model sütununda seri olmayan yazımlar */
const BOS_MODEL = new Set(['tousmodeles', 'nouvelle', 'nouveau', 'new', 'kombi', 'combi']);
const ON_KELIME = new Set(['nouvelle', 'nouveau', 'new']);

/** ADEME model adı katalog yazımına: "SERIE 3" → "3 Serisi", "CLASSE C" → "C Serisi", "CLASSE GLA" → "GLA" */
function modelAdi(s: string, marka: string): string {
  const t = s.trim().replace(/\s+/g, ' ');
  // BMW seri yerine motor kodu yazar: "320d", "118", "640i" → 3, 1, 6 Serisi
  const bmw = marka === 'BMW' ? /^([1-8])\d{2}[a-z]*$/i.exec(t) : null;
  if (bmw) return `${bmw[1]} Serisi`;
  return (
    MODEL_ADI[adAnahtari(t)] ??
    t
      .replace(/^SERIE (\d)\b/i, '$1 Serisi')
      .replace(/^CLASSE ([A-Z])$/i, '$1 Serisi')
      .replace(/^CLASSE ([A-Z]{2,})\b/i, '$1')
  );
}

/**
 * Açıklamayı temizler: tırnaklar, baştaki "NOUVELLE"/"NEW" ve marka adı ("AUDI TT", "MAZDA3", "ROVER 25"), art arda
 * yinelenen kelime ("Grande Grande PUNTO").
 */
export function ademeAciklama(aciklama: string, markaHam: string, marka: string): string {
  const markalar = new Set([adAnahtari(markaHam), adAnahtari(marka), adAnahtari(marka.split(' ')[0] ?? '')]);
  let t = aciklama
    .replace(/^"+|"+$/g, '')
    .replace(/""/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ');
  while (t.length > 1 && (ON_KELIME.has(adAnahtari(t[0] ?? '')) || markalar.has(adAnahtari(t[0] ?? ''))))
    t = t.slice(1);
  // Bitişik yazım: "MAZDA3" → "3"
  const bas = t[0] ?? '';
  const bitisik = [...markalar].find(
    (m) => m && adAnahtari(bas).startsWith(m) && /^\d/.test(adAnahtari(bas).slice(m.length)),
  );
  if (bitisik) t[0] = adAnahtari(bas).slice(bitisik.length);
  return t.filter((w, i) => i === 0 || adAnahtari(w) !== adAnahtari(t[i - 1] ?? '')).join(' ');
}

/** Marka ve seriyi katalogdaki adlara yerleştirir; model adı yoksa açıklamanın baştaki kelimelerinden */
export function ademeYerlestir(markaHam: string, modelHam: string | null, aciklamaHam: string) {
  const mk = MARKA[adAnahtari(markaHam)] ?? markaHam.trim();
  const aciklama = ademeAciklama(aciklamaHam, markaHam, mk);
  const raw = aciklama.toUpperCase();
  const yer = (seri: string) => anaYerlestir({ make: mk, series: seri, raw, categories: ['otomobil'] });
  const model = modelHam?.trim() && !BOS_MODEL.has(adAnahtari(modelHam)) ? modelHam.trim() : null;
  if (model) {
    const r = yer(modelAdi(model, mk));
    if (r.ana) return { marka: r.make, seri: r.series, aciklama };
  }
  const t = aciklama.split(' ');
  for (let k = Math.min(3, t.length); k >= 1; k--) {
    const r = yer(modelAdi(t.slice(0, k).join(' '), mk));
    if (r.ana) return { marka: r.make, seri: r.series, aciklama };
  }
  const r = yer(modelAdi(model ?? t[0] ?? '', mk));
  return { marka: r.make, seri: model || t[0] ? r.series : null, aciklama };
}

/** Yıllık dosya (zip içinde .xls ya da noktalı virgüllü .csv) → onay sürümleri */
export function readAdemeYil(zip: Uint8Array, d: Pick<AdemeDosya, 'yil' | 'basliksiz'>): AdemeSurum[] {
  const entries = unzipSync(zip);
  const name = Object.keys(entries).find((n) => /\.(xls|csv)$/i.test(n));
  const file = name ? entries[name] : undefined;
  if (!name || !file) throw new Error('ADEME dosyasında tablo yok');
  const rows: Cell[][] = isXls(file)
    ? readXlsFirstSheet(file)
    : parseCsvRows(new TextDecoder(/\.csv$/i.test(name) ? 'windows-1252' : 'utf-8').decode(file), ';');
  let hi = rows
    .slice(0, 10)
    .findIndex(
      (r) => r.some((c) => SUTUN.marka?.includes(key(c))) && r.some((c) => SUTUN.aciklama?.includes(key(c))),
    );
  let header: Cell[];
  if (hi >= 0) header = rows[hi] as Cell[];
  else if (d.basliksiz) {
    header = d.basliksiz;
    hi = -1;
  } else throw new Error('ADEME başlık satırı bulunamadı');
  const col = (alan: string) => header.findIndex((c) => SUTUN[alan]?.includes(key(c)));
  const i = Object.fromEntries(Object.keys(SUTUN).map((a) => [a, col(a)])) as Record<string, number>;
  const al = (r: Cell[], a: string) => ((i[a] ?? -1) >= 0 ? r[i[a] as number] : undefined);

  const out: AdemeSurum[] = [];
  for (const r of rows.slice(hi + 1)) {
    const markaHam = String(al(r, 'marka') ?? '').trim();
    const aciklama = String(al(r, 'aciklama') ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!markaHam || !aciklama) continue;
    const yer = ademeYerlestir(markaHam, String(al(r, 'model') ?? '') || null, aciklama);
    const hp = Number(/\((\d{2,4})\s*ch\)/i.exec(aciklama)?.[1]) || null;
    const kw = sayi(al(r, 'kw'));
    out.push({
      yil: d.yil,
      marka: yer.marka,
      seri: yer.seri,
      aciklama: yer.aciklama,
      yakit: ademeYakit(String(al(r, 'yakit') ?? '')),
      kw: kw ? Math.round(kw) : null,
      hp: hp ?? (kw ? Math.round(kw * 1.35962) : null),
      hacim: Number(/(?:^|\s)(\d\.\d)(?:\s|L|$)/i.exec(aciklama)?.[1]) || null,
      ...ademeVites(String(al(r, 'vites') ?? '')),
      tuketimMin: sayi(al(r, 'tuketim')),
      tuketimMax: sayi(al(r, 'tuketim')),
      co2Min: sayi(al(r, 'co2')),
      co2Max: sayi(al(r, 'co2')),
      agirlikMin: sayi(al(r, 'agirlikMin')),
      agirlikMax: sayi(al(r, 'agirlikMax')) ?? sayi(al(r, 'agirlikMin')),
      euro: /EURO\s?(\d)/i.exec(String(al(r, 'euro') ?? ''))?.[1] ?? null,
      adet: 1,
    });
  }
  return ademeBirlestir(out);
}

/** Güncel listenin (data-fair) bir satırı → onay sürümü */
export function ademeGuncelSatir(r: Record<string, unknown>, yil: number): AdemeSurum | null {
  const s = (k: string) => (r[k] === undefined || r[k] === null ? '' : String(r[k]));
  const markaHam = s('Marque');
  const aciklama = s('Description_Commerciale').replace(/\s+/g, ' ').trim();
  if (!markaHam || !aciklama) return null;
  const yer = ademeYerlestir(markaHam, s('Libellé_modèle') || s('Modèle') || null, aciklama);
  const kw = sayi(s('Puissance_maximale'));
  const cc = sayi(s('Cylindrée'));
  const hp = Number(/\((\d{2,4})\s*ch\)/i.exec(aciklama)?.[1]) || null;
  return {
    yil,
    marka: yer.marka,
    seri: yer.seri,
    aciklama: yer.aciklama,
    yakit: ademeYakit(s('Energie')),
    kw: kw ? Math.round(kw) : null,
    hp: hp ?? (kw ? Math.round(kw * 1.35962) : null),
    hacim: cc ? Math.round(cc / 100) / 10 : null,
    ...ademeVites(s('Type_de_boite'), r.Nombre_rapports),
    tuketimMin: sayi(s('Conso_vitesse_mixte_Min')),
    tuketimMax: sayi(s('Conso_vitesse_mixte_Max')) ?? sayi(s('Conso_vitesse_mixte_Min')),
    co2Min: sayi(s('CO2_vitesse_mixte_Min')),
    co2Max: sayi(s('CO2_vitesse_mixte_Max')) ?? sayi(s('CO2_vitesse_mixte_Min')),
    agirlikMin: sayi(s('Masse_OM_Min')),
    agirlikMax: sayi(s('Masse_OM_Max')) ?? sayi(s('Masse_OM_Min')),
    euro: null,
    adet: 1,
  };
}

// ── Eşleştirme ─────────────────────────────────────────────────────

/** Katalogdaki bir tip (Türkiye'de satılan; TSB ya da yerli liste) */
export interface TeknikTip {
  marka: string;
  seri: string | null;
  yakit: string | null;
  hp: number | null;
  hacim: number | null;
  vites: string | null;
  yillar: number[];
}

/** Tipin teknik özeti: eşleşen onay sürümlerinin ortak ve aralık değerleri (tip ortak pakette) */
export type { TeknikOzet };

export const teknikAnahtar = (marka: string, seri: string | null) =>
  `${adAnahtari(marka)}|${adAnahtari(seri ?? '')}`;

const aralik = (xs: (number | null)[]): [number, number] | null => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? [Math.min(...v), Math.max(...v)] : null;
};

/**
 * Tipe uyan onay sürümleri: aynı marka ve seri (çağıran `teknikAnahtar` ile süzer), aynı yakıt, yayın yılı ya da bir
 * önceki model yılı tipin yıllarında, güç ±2 hp (güç yazılı değilse motor hacmi ±0,05 L) ve vites türü (biliniyorsa).
 * Yakıtı ya da hem gücü hem hacmi bilinmeyen tip eşleşmez (tahmin edilmez).
 */
export function teknikEslestir(t: TeknikTip, adaylar: readonly AdemeSurum[]): TeknikOzet | null {
  if (!t.yakit || (!t.hp && !t.hacim)) return null;
  const yillar = new Set(t.yillar);
  const uyan = adaylar.filter((s) => {
    if (s.yakit !== t.yakit) return false;
    if (!yillar.has(s.yil) && !yillar.has(s.yil - 1)) return false;
    if (t.hp) {
      if (!s.hp || Math.abs(s.hp - t.hp) > 2) return false;
    } else if (!s.hacim || Math.abs(s.hacim - (t.hacim as number)) > 0.05) return false;
    if (t.vites) {
      const ayni = s.vites === t.vites || (t.vites === 'yari_otomatik' && s.vites === 'otomatik');
      if (!ayni) return false;
    }
    return true;
  });
  if (!uyan.length) return null;
  return {
    vitesler: [
      ...new Set(uyan.filter((s) => s.vites).map((s) => `${s.vites}:${s.vitesSayisi ?? ''}`)),
    ].sort(),
    kw: aralik(uyan.map((s) => s.kw)),
    hp: aralik(uyan.map((s) => s.hp)),
    tuketim: aralik(uyan.flatMap((s) => [s.tuketimMin, s.tuketimMax])),
    co2: aralik(uyan.flatMap((s) => [s.co2Min, s.co2Max])),
    agirlik: aralik(uyan.flatMap((s) => [s.agirlikMin, s.agirlikMax])),
    euro: [...new Set(uyan.map((s) => s.euro).filter((e): e is string => !!e))].sort(),
    surum: uyan.length,
  };
}

/** Birden çok tipin özeti tek özete (bir motor sürümünün bütün paketleri): seçenekler birleşir, aralıklar genişler */
export function ozetBirlestir(xs: readonly TeknikOzet[]): TeknikOzet | null {
  if (!xs.length) return null;
  const ar = (sec: (o: TeknikOzet) => [number, number] | null) => aralik(xs.flatMap((o) => sec(o) ?? []));
  return {
    vitesler: [...new Set(xs.flatMap((o) => o.vitesler))].sort(),
    kw: ar((o) => o.kw),
    hp: ar((o) => o.hp),
    tuketim: ar((o) => o.tuketim),
    co2: ar((o) => o.co2),
    agirlik: ar((o) => o.agirlik),
    euro: [...new Set(xs.flatMap((o) => o.euro))].sort(),
    surum: xs.reduce((n, o) => n + o.surum, 0),
  };
}
