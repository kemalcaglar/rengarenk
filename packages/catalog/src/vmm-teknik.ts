import { createHash } from 'node:crypto';
import { type Aralik, kasaTipiOf, type TeknikOzet } from '@rengarenk/shared';
import { strFromU8, unzipSync } from 'fflate';
import { type TeknikTip, teknikAnahtar } from './ademe.js';
import { anaYerlestir } from './ana-liste/index.js';
import type { Fuel, Gearbox } from './tsb/parse.js';
import { bodyOf, driveOf, gearboxOf, vmmSeries } from './vmm.js';

/**
 * vehicle-makes-models motor kayıtlarından teknik ayrıntı (sahip isteği, 17 Kasım 2026: "diğer ilan siteleri gibi dolu,
 * çok daha detaylı"). Sürüm dosyası `vehicle-data-json.zip` (marka başına JSON): motor başına 0-100, azami hız, tork,
 * çekiş, ölçüler, ağırlık, tüketim ve ham teknik tablo (depo, bagaj, lastik, fren …). Kaynak dünya geneli olduğu için
 * yalnızca Türkiye'de satılan tiple (TSB) eşleşen motorun değerleri kullanılır: aynı marka ve seri, yakıt, yıl, güç
 * ±2 hp (yoksa hacim ±0,05 L) ve vites türü. Veri ODbL 1.0 (atıf Veri kaynakları sayfasında).
 */
export const VMM_TEKNIK_PARSER = '2026-11-17-2';
export const VMM_JSON_ASSET = 'vehicle-data-json.zip';

/** Bir motor kaydı (katalog adlarıyla) */
export interface VmmMotor {
  kimlik: string;
  marka: string;
  seri: string | null;
  nesil: string;
  /** Talep şemasındaki kasa tipi (sedan, station_wagon …); bilinmiyorsa null */
  govde: string | null;
  yilBas: number;
  yilSon: number | null;
  yakit: Fuel | null;
  hp: number | null;
  /** Motor hacmi, litre */
  hacim: number | null;
  vites: Gearbox | null;
  vitesSayisi: number | null;
  cekis: 'onden' | 'arkadan' | '4x4' | null;
  etiket: string;
  /** Ayrıntı: sayılar ve metinler (teknik özetin alanlarıyla aynı adlar) */
  d: VmmDetay;
}

export interface VmmDetay {
  silindir?: string;
  hacimCc?: number;
  tork?: number;
  hizlanma?: number;
  azamiHiz?: number;
  yakitSistemi?: string;
  depo?: number;
  tuketim?: number;
  tuketimSehir?: number;
  tuketimSehirDisi?: number;
  co2?: number;
  uzunluk?: number;
  genislik?: number;
  yukseklik?: number;
  dingil?: number;
  yerden?: number;
  bagaj?: number;
  agirlik?: number;
  azamiAgirlik?: number;
  donme?: number;
  cd?: number;
  lastik?: string;
  frenOn?: string;
  frenArka?: string;
  menzil?: number;
  batarya?: number;
}

/** "Hybrid Gasoline", "Plug-in Hybrid", "Diesel" → katalog yakıtı */
export function vmmYakit(s: string | null | undefined): Fuel | null {
  const t = (s ?? '').toLowerCase();
  if (/hybrid/.test(t)) return 'hibrit';
  if (/electric/.test(t)) return 'elektrik';
  if (/diesel/.test(t)) return 'dizel';
  if (/lpg|cng|gas\b/.test(t) && !/gasoline/.test(t)) return 'lpg';
  if (/gasoline|petrol/.test(t)) return 'benzin';
  return null;
}

const pos = (n: unknown): number | undefined =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined;

/**
 * Makul aralık: kaynaktaki açık hatalar ("bagaj 40 L", "0-100 0,9 sn") alınmaz. Sınırlar otomobil, SUV ve hafif
 * ticari için geniştir; dışında kalan değer bilinmiyor sayılır.
 */
const MAKUL: Partial<Record<keyof VmmDetay, [number, number]>> = {
  hacimCc: [500, 9000],
  tork: [40, 2500],
  hizlanma: [1.8, 40],
  azamiHiz: [80, 450],
  depo: [15, 200],
  tuketim: [1, 30],
  tuketimSehir: [1, 40],
  tuketimSehirDisi: [1, 25],
  co2: [10, 600],
  uzunluk: [2400, 7500],
  genislik: [1300, 2600],
  yukseklik: [1000, 3200],
  dingil: [1600, 4500],
  yerden: [70, 400],
  bagaj: [80, 4000],
  agirlik: [450, 4000],
  azamiAgirlik: [700, 5000],
  donme: [7, 16],
  cd: [0.18, 0.6],
  menzil: [50, 1200],
  batarya: [5, 250],
};

/**
 * Bu kaynağa özgü seri adları (ana liste kuralları dışında; yalnızca motor kayıtlarında): Türkiye'deki adı farklı olan
 * aynı araç. Model adı (kaynaktaki), ilk nesil yılı ve hedef seri.
 */
const SERI_ESLERI: { marka: string; model: RegExp; ilkYil?: number; hedef: string }[] = [
  // Fiat Egea, Avrupa'da Tipo (2015) adıyla satılır
  { marka: 'Fiat', model: /^Tipo Cross\b/i, ilkYil: 2020, hedef: 'Egea Cross' },
  { marka: 'Fiat', model: /^Tipo\b/i, ilkYil: 2015, hedef: 'Egea' },
  // VW CC 2012'ye kadar Passat CC adıyla
  { marka: 'Volkswagen', model: /^(Passat CC|CC)\b/i, hedef: 'VW CC' },
  // Hyundai Accent (RB, 2011–) Türkiye'de Accent Blue
  { marka: 'Hyundai', model: /^Accent\b/i, ilkYil: 2011, hedef: 'Accent Blue' },
];
/** Ham metindeki birimli sayı: "21.1 gallons (79.9 L)" → 79.9 ("L"), "6 in (152 mm)" → 152 ("mm") */
export function birimli(s: string | undefined, birim: string): number | undefined {
  if (!s) return undefined;
  const re = new RegExp(`([\\d.,]+)\\s*${birim}\\b`, 'i');
  const m = re.exec(s);
  if (!m) return undefined;
  return pos(Number((m[1] as string).replace(/,/g, '')));
}

/** Ham teknik tablo ve tipli alanlardan ayrıntı */
export function vmmDetay(e: Record<string, unknown>): VmmDetay {
  const sp = (e.specs ?? {}) as Record<string, string>;
  const al = (...anahtarlar: string[]) => anahtarlar.map((k) => sp[k]).find(Boolean);
  const d: VmmDetay = {
    silindir: al('ENGINE SPECS / Cylinders')?.trim() || undefined,
    hacimCc: pos(e.displacementCc),
    tork: pos(e.torqueNm) ?? birimli(al('ENGINE SPECS / Total maximum torque'), 'Nm'),
    hizlanma: pos(e.zeroToHundredKmhS),
    azamiHiz: pos(e.topSpeedKmh),
    yakitSistemi: al('ENGINE SPECS / Fuel System')?.trim() || undefined,
    depo: birimli(al('ENGINE SPECS / Fuel capacity'), 'L'),
    tuketim:
      pos(e.fuelEconomyCombinedL100) ??
      birimli(al('FUEL ECONOMY (WLTP) / Combined', 'FUEL ECONOMY (NEDC) / Combined'), 'L/100Km'),
    tuketimSehir: birimli(al('FUEL ECONOMY (NEDC) / City'), 'L/100Km'),
    tuketimSehirDisi: birimli(al('FUEL ECONOMY (NEDC) / Highway'), 'L/100Km'),
    co2: birimli(
      al('FUEL ECONOMY (WLTP) / CO2 Emissions (Combined)', 'FUEL ECONOMY (NEDC) / CO2 Emissions'),
      'g/km',
    ),
    uzunluk: pos(e.lengthMm),
    genislik: pos(e.widthMm),
    yukseklik: pos(e.heightMm),
    dingil: pos(e.wheelbaseMm),
    yerden: birimli(al('DIMENSIONS / Ground Clearance'), 'mm'),
    bagaj: birimli(al('DIMENSIONS / Cargo Volume'), 'L'),
    agirlik: pos(e.curbWeightKg),
    azamiAgirlik: birimli(al('WEIGHT SPECS / Gross Weight Limit'), 'kg'),
    donme: birimli(al('DIMENSIONS / Turning circle', 'DIMENSIONS / Turning circle (curb to curb)'), 'm'),
    cd: pos(Number(al('DIMENSIONS / Aerodynamics (Cd)'))),
    lastik: al('TIRES SPECS / Tire Size')?.trim() || undefined,
    frenOn: al('BRAKES SPECS / Front')?.trim() || undefined,
    frenArka: al('BRAKES SPECS / Rear')?.trim() || undefined,
    menzil: birimli(al('POWER SYSTEM SPECS / Range'), 'km'),
    batarya: birimli(al('POWER SYSTEM SPECS / Nominal Capacity'), 'kWh'),
  };
  for (const k of Object.keys(d) as (keyof VmmDetay)[]) {
    const v = d[k];
    const sinir = MAKUL[k];
    if (v === undefined || (sinir && typeof v === 'number' && (v < sinir[0] || v > sinir[1]))) delete d[k];
  }
  return d;
}

interface JsonMarka {
  name: string;
  models?: {
    name: string;
    generations?: {
      name: string;
      yearStart: number | null;
      yearEnd: number | null;
      bodyType: string | null;
      engines?: Record<string, unknown>[];
    }[];
  }[];
}

/** Sürüm dosyasından (zip içinde json/<marka>.json) motor kayıtları */
export function readVmmTeknik(zip: Uint8Array): VmmMotor[] {
  const entries = unzipSync(zip, {
    filter: (f) => /\.json$/i.test(f.name) && !/(^|\/)all\.json$/i.test(f.name),
  });
  const out: VmmMotor[] = [];
  const gorulen = new Set<string>();
  for (const [ad, veri] of Object.entries(entries)) {
    let j: { makes?: JsonMarka[] };
    try {
      j = JSON.parse(strFromU8(veri));
    } catch {
      throw new Error(`vehicle-makes-models: ${ad} okunamadı`);
    }
    for (const mk of j.makes ?? []) {
      const amg = mk.name.trim() === 'Mercedes-AMG';
      const make = amg ? 'Mercedes-Benz' : mk.name.trim();
      for (const m of mk.models ?? []) {
        for (const g of m.generations ?? []) {
          if (!g.yearStart) continue;
          const es = SERI_ESLERI.find(
            (x) =>
              x.marka === make && x.model.test(m.name) && (!x.ilkYil || (g.yearStart as number) >= x.ilkYil),
          );
          const seriHam = es?.hedef ?? vmmSeries(make, m.name);
          const nesil = g.name.replace(/\s+/g, ' ').trim();
          const govdeAdi = bodyOf(nesil, m.name, g.bodyType ?? '');
          for (const e of g.engines ?? []) {
            const etiket = String(e.label ?? '').trim();
            if (!etiket) continue;
            const yer = anaYerlestir({
              make,
              series: seriHam,
              raw: `${nesil} · ${etiket}`,
              categories: ['otomobil'],
              years: [g.yearStart],
            });
            const cc = pos(e.displacementCc);
            const vitesMetni = String(e.transmission ?? '');
            const kimlik = createHash('sha1')
              .update([make, m.name, nesil, g.yearStart, etiket].join('|'))
              .digest('hex')
              .slice(0, 24);
            if (gorulen.has(kimlik)) continue;
            gorulen.add(kimlik);
            out.push({
              kimlik,
              marka: yer.make,
              seri: yer.series,
              nesil,
              govde: kasaTipiOf(govdeAdi),
              yilBas: g.yearStart,
              yilSon: g.yearEnd,
              yakit: vmmYakit(e.fuelType as string),
              hp: pos(e.powerHp) ? Math.round(e.powerHp as number) : null,
              hacim: cc ? Math.round(cc / 100) / 10 : null,
              vites: gearboxOf(vitesMetni, etiket),
              vitesSayisi: Number(/(\d{1,2})-speed/i.exec(vitesMetni)?.[1]) || null,
              cekis: driveOf(String(e.drivetrain ?? ''), etiket),
              etiket,
              d: vmmDetay(e),
            });
          }
        }
      }
    }
  }
  return out;
}

export const vmmAnahtar = (x: Pick<VmmMotor, 'marka' | 'seri'>) => teknikAnahtar(x.marka, x.seri);

/** Türkiye'de satılan tipin çekiş ve kasa bilgisi (TSB adından) ve serinin dört çeker tipi olup olmadığı */
export interface VmmTip extends TeknikTip {
  cekis: string | null;
  /** TSB adındaki kasa (ör. "Station wagon") */
  govde: string | null;
  /** Seride TSB'de "4x4" yazılmış tip var: adında yazmayan tip dört çeker değildir */
  seriDortCeker: boolean;
}

const aralik = (xs: (number | undefined)[]): Aralik => {
  const v = xs.filter((x): x is number => x !== undefined);
  return v.length ? [Math.min(...v), Math.max(...v)] : null;
};
const metinler = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();

/**
 * Tipe uyan motor kayıtları: aynı yakıt, tipin bir yılı neslin yıllarında, güç ±2 hp (güç yazılı değilse hacim
 * ±0,05 L), vites türü (biliniyorsa). Çekiş ve kasa tipi TSB adında yazıyorsa odur; yazmıyorsa eşleşen kayıtlardan
 * gelir (seride dört çeker tip TSB'de ayrıca yazılıyorsa bu tip dört çeker sayılmaz). Eşleşme yoksa null.
 */
export function vmmEslestir(
  t: VmmTip,
  adaylar: readonly VmmMotor[],
  buYil: number,
): Partial<TeknikOzet> | null {
  if (!t.yakit || (!t.hp && !t.hacim)) return null;
  const uyan = adaylar.filter((m) => {
    if (m.yakit !== t.yakit) return false;
    const son = m.yilSon ?? buYil;
    if (!t.yillar.some((y) => y >= m.yilBas && y <= son)) return false;
    if (t.hp) {
      if (!m.hp || Math.abs(m.hp - t.hp) > 2) return false;
    } else if (!m.hacim || Math.abs(m.hacim - (t.hacim as number)) > 0.05) return false;
    if (t.vites && m.vites) {
      const ayni = m.vites === t.vites || (t.vites === 'yari_otomatik' && m.vites === 'otomatik');
      if (!ayni) return false;
    }
    return true;
  });
  if (!uyan.length) return null;
  const d = (k: keyof VmmDetay) => uyan.map((m) => m.d[k] as number | undefined);
  let cekisler = t.cekis ? [t.cekis] : metinler(uyan.map((m) => m.cekis ?? undefined));
  if (!t.cekis && t.seriDortCeker) cekisler = cekisler.filter((c) => c !== '4x4');
  const tsbGovde = kasaTipiOf(t.govde);
  return {
    vitesler: [
      ...new Set(uyan.filter((m) => m.vites).map((m) => `${m.vites}:${m.vitesSayisi ?? ''}`)),
    ].sort(),
    hp: aralik(uyan.map((m) => m.hp ?? undefined)),
    cekisler,
    govdeler: tsbGovde ? [tsbGovde] : metinler(uyan.map((m) => m.govde ?? undefined)),
    silindirler: metinler(uyan.map((m) => m.d.silindir)),
    hacimCc: aralik(d('hacimCc')),
    tork: aralik(d('tork')),
    hizlanma: aralik(d('hizlanma')),
    azamiHiz: aralik(d('azamiHiz')),
    yakitSistemleri: metinler(uyan.map((m) => m.d.yakitSistemi)),
    depo: aralik(d('depo')),
    tuketim: aralik(d('tuketim')),
    tuketimSehir: aralik(d('tuketimSehir')),
    tuketimSehirDisi: aralik(d('tuketimSehirDisi')),
    co2: aralik(d('co2')),
    uzunluk: aralik(d('uzunluk')),
    genislik: aralik(d('genislik')),
    yukseklik: aralik(d('yukseklik')),
    dingil: aralik(d('dingil')),
    yerden: aralik(d('yerden')),
    bagaj: aralik(d('bagaj')),
    agirlik: aralik(d('agirlik')),
    azamiAgirlik: aralik(d('azamiAgirlik')),
    donme: aralik(d('donme')),
    cd: aralik(d('cd')),
    lastikler: metinler(uyan.map((m) => m.d.lastik)),
    frenOn: metinler(uyan.map((m) => m.d.frenOn)),
    frenArka: metinler(uyan.map((m) => m.d.frenArka)),
    menzil: aralik(d('menzil')),
    batarya: aralik(d('batarya')),
    surum: uyan.length,
  };
}

/** Tipin TSB adındaki çekiş ve kasa (eşleşme olmasa da sihirbaz kullanır); ikisi de yoksa null */
export function tsbOzeti(cekis: string | null, govde: string | null): Partial<TeknikOzet> | null {
  const g = kasaTipiOf(govde);
  if (!cekis && !g) return null;
  return { ...(cekis ? { cekisler: [cekis] } : {}), ...(g ? { govdeler: [g] } : {}) };
}

/**
 * Kaynak başına özetler tek özete (gösterim anında; kapatılan kaynağınki verilmez). Tüketim, CO2, ağırlık, vites ve
 * güçte ADEME (Avrupa onay ölçümü) önce gelir; ADEME'de olmayan alan motor kayıtlarından dolar. Çekiş ve kasa tipinde
 * TSB adı önce gelir, sonra motor kayıtları.
 */
export function teknikBirlestir(
  ademe: TeknikOzet | null,
  vmm: Partial<TeknikOzet> | null,
  tsb: Partial<TeknikOzet> | null = null,
): TeknikOzet | null {
  if (!ademe && !vmm && !tsb) return null;
  const v = vmm ?? {};
  const kaynaklar = [...(ademe ? ['ademe'] : []), ...(vmm ? ['vmm'] : [])];
  const birlesik: TeknikOzet = {
    ...v,
    vitesler: ademe?.vitesler.length ? ademe.vitesler : (v.vitesler ?? []),
    kw: ademe?.kw ?? null,
    hp: ademe?.hp ?? v.hp ?? null,
    tuketim: ademe?.tuketim ?? v.tuketim ?? null,
    co2: ademe?.co2 ?? v.co2 ?? null,
    agirlik: ademe?.agirlik ?? v.agirlik ?? null,
    euro: ademe?.euro ?? [],
    surum: (ademe?.surum ?? 0) + (v.surum ?? 0),
    tuketimSehir: ademe?.tuketimSehir ?? v.tuketimSehir ?? null,
    tuketimSehirDisi: ademe?.tuketimSehirDisi ?? v.tuketimSehirDisi ?? null,
    cekisler: tsb?.cekisler?.length ? tsb.cekisler : v.cekisler,
    govdeler: tsb?.govdeler?.length ? tsb.govdeler : v.govdeler,
    kaynaklar,
  };
  // Boş listeler ve bilinmeyen aralıklar saklanmaz
  const ek = birlesik as unknown as Record<string, unknown>;
  for (const [k, x] of Object.entries(ek)) {
    if (['vitesler', 'kw', 'hp', 'tuketim', 'co2', 'agirlik', 'euro', 'surum'].includes(k)) continue;
    if (x === null || x === undefined || (Array.isArray(x) && x.length === 0)) delete ek[k];
  }
  return birlesik;
}

/** Tipin kaynak satırlarından (catalog_variant_specs) açık kaynaklarla özet */
export function teknikOku(
  satirlar: readonly { source: string; summary: unknown }[],
  acik: ReadonlySet<string>,
): TeknikOzet | null {
  const al = (k: string) =>
    acik.has(k) ? ((satirlar.find((x) => x.source === k)?.summary ?? null) as TeknikOzet | null) : null;
  return teknikBirlestir(
    al('ademe'),
    al('vmm'),
    (satirlar.find((x) => x.source === 'tsb')?.summary ?? null) as Partial<TeknikOzet> | null,
  );
}

/**
 * Türkiye'de satılan tipin teknik özeti, vites türü TSB adından (sahip bildirimi, 18 Kasım 2026: otomatik Clio'nun
 * teknik özelliklerinde "manuel" yazıyordu). Vites tipin adında yazılıysa kaynakların başka türdeki vitesi düşer;
 * yazılı değilse ve talepte vites seçildiyse (`izinliVites`) yalnızca o türler kalır, hiçbiri kalmazsa tip gösterilmez.
 * Kaynaklarda eşleşmesi olmayan tipte adından bilinen vites ve güç özet olur (kaynak "tsb").
 */
export function tipTeknik(
  satirlar: readonly { source: string; summary: unknown }[],
  acik: ReadonlySet<string>,
  tip: { gearbox: string | null; powerHp: number | null },
  izinliVites?: readonly string[] | null,
): TeknikOzet | null {
  const o = acik.size ? teknikOku(satirlar, acik) : null;
  const tur = (v: string) => v.split(':')[0] ?? '';
  if (o?.kaynaklar?.length) {
    const izin = tip.gearbox ? [tip.gearbox] : izinliVites?.length ? izinliVites : null;
    if (!izin) return o;
    const uyan = o.vitesler.filter((v) => izin.includes(tur(v)));
    if (uyan.length) return { ...o, vitesler: uyan };
    if (tip.gearbox) return { ...o, vitesler: [`${tip.gearbox}:`] };
    // Vites ne tipin adında ne kaynakta: bilinmiyor, tip kalır; kaynak başka türü söylüyorsa talebe uymaz
    return o.vitesler.length ? null : o;
  }
  if (!tip.gearbox) return null;
  const tsb = (satirlar.find((x) => x.source === 'tsb')?.summary ?? null) as Partial<TeknikOzet> | null;
  return {
    vitesler: [`${tip.gearbox}:`],
    kw: null,
    hp: tip.powerHp ? [tip.powerHp, tip.powerHp] : null,
    tuketim: null,
    co2: null,
    agirlik: null,
    euro: [],
    surum: 0,
    ...(tsb?.cekisler?.length ? { cekisler: tsb.cekisler } : {}),
    ...(tsb?.govdeler?.length ? { govdeler: tsb.govdeler } : {}),
    kaynaklar: ['tsb'],
  };
}
