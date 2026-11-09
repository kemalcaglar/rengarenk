import {
  type CategoryDefinition,
  type CategoryField,
  effectiveFields,
  fieldVisible,
  PAINT_PARTS,
  PAINT_STATES,
} from './category-schema.js';
import { ilKomsulari } from './il-komsulari.js';

/**
 * Eşleşme skoru (Teknik tasarım §6): her ölçütün ağırlığı ile uyum değerinin (0–1) çarpımlarının toplamı,
 * ağırlıkların toplamına bölünür. Uyum kuralları başlangıç değerleridir; gerçek taleplerle ayarlanacak.
 * Eşleşme motoru ve konsoldaki deneme alanı aynı işlevi kullanır, böylece denemedeki sonuç canlıdakiyle aynıdır.
 */

const clamp = (n: number) => Math.max(0, Math.min(1, n));

export interface CatalogRef {
  make: string;
  series?: string;
  model?: string;
}

/** Aynı model 1 · aynı seri farklı model 0,7 · aynı marka 0,3 · diğer 0. Alıcı yalnızca seri ya da marka seçtiyse o düzeyde tam uyum. */
export function catalogFit(want: CatalogRef, have: CatalogRef): number {
  if (want.make !== have.make) return 0;
  if (!want.series) return 1;
  if (want.series !== have.series) return 0.3;
  if (!want.model) return 1;
  return want.model === have.model ? 1 : 0.7;
}

export interface Range {
  min?: number;
  max?: number;
}

/** Model yılı: aralıkta 1 · aralık dışında her yıl için −0,2 */
export function yearFit(want: Range, year: number): number {
  const below = want.min !== undefined ? Math.max(0, want.min - year) : 0;
  const above = want.max !== undefined ? Math.max(0, year - want.max) : 0;
  return clamp(1 - 0.2 * (below + above));
}

/** Bütçe: aralıkta 1 · üst sınırın %0–5 üstü 1'den 0,5'e iner · daha fazlası 0 (sert koşul eler) · alt sınırın altı 0,9 */
export function budgetFit(want: Range, price: number): number {
  if (want.max !== undefined && price > want.max) {
    const over = (price - want.max) / want.max;
    return over > 0.05 ? 0 : 1 - over * 10;
  }
  if (want.min !== undefined && price < want.min) return 0.9;
  return 1;
}

/** Kilometre: sınırın altında 1 · her %10 aşım için −0,2 */
export function kmFit(maxKm: number, km: number): number {
  if (km <= maxKm) return 1;
  return clamp(1 - 2 * ((km - maxKm) / maxKm));
}

/** Kasa, makyaj, yakıt, renk: seçimdeyse ya da seçim yapılmamışsa 1 · değilse 0 */
export function choiceFit(selected: readonly string[] | undefined, value: string): number {
  return !selected || selected.length === 0 || selected.includes(value) ? 1 : 0;
}

/**
 * Donanım paketi: aynı paket 1 · üst paket 0,6 · alt paket 0,2 (sıra: düşükten yükseğe paket kodları).
 * Katalogda paketlerin sırası yoksa farklı paket ikisinin ortası 0,4 sayılır.
 */
export function packageFit(
  selected: readonly string[] | undefined,
  value: string,
  order: readonly string[],
): number {
  if (!selected || selected.length === 0 || selected.includes(value)) return 1;
  if (order.length === 0) return 0.4;
  const at = order.indexOf(value);
  const best = Math.max(...selected.map((s) => order.indexOf(s)));
  if (at < 0 || best < 0) return 0;
  return at > best ? 0.6 : 0.2;
}

/** Hasar kaydı: alıcının isteğine uygunsa 1 · değilse 0,3 */
export const damageFit = (ok: boolean) => (ok ? 1 : 0.3);

/** Konum: aynı ilçe 1 · aynı il 0,8 · komşu il 0,5 · diğer 0 */
export function locationFit(
  want: { il: string; ilce?: string },
  have: { il: string; ilce?: string },
  neighbours: (il: string) => readonly string[] = () => [],
): number {
  if (want.il === have.il) return want.ilce && have.ilce && want.ilce === have.ilce ? 1 : want.ilce ? 0.8 : 1;
  return neighbours(want.il).includes(have.il) ? 0.5 : 0;
}

/** Konum alanı sert koşul değilse komşu iller (il komşuluk listesi), sert koşulsa hiçbiri */
export function konumKomsulari(fields: readonly CategoryField[]): (il: string) => readonly string[] {
  const alan = fields.find((f) => f.key === 'konum');
  return alan && alan.hard === 'no' ? ilKomsulari : () => [];
}

/** Kategori tanımındaki ağırlıklar: alan kodu → ağırlık (0 olanlar dahil değil) */
export function weightsOf(def: CategoryDefinition): { key: string; name: string; weight: number }[] {
  return effectiveFields(def)
    .filter((f) => f.weight > 0)
    .map((f) => ({ key: f.key, name: f.matchName ?? f.label, weight: f.weight }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Skor yüzdesi (0–100, tam sayı). Uyumu bilinmeyen ölçüt (alıcı belirtmemiş, alan eski sürümde yok) 1 sayılır:
 * yeni alan eski talepler için "belirtilmemiş"tir (Karar 45).
 */
export function matchScore(weights: Record<string, number>, fit: Record<string, number | undefined>): number {
  let total = 0;
  let sum = 0;
  for (const [key, w] of Object.entries(weights)) {
    if (w <= 0) continue;
    total += w;
    sum += w * clamp(fit[key] ?? 1);
  }
  return total ? Math.round((sum / total) * 100) : 0;
}

// ── Talep ile portföy aracının karşılaştırılması ──────────────

/** Eşleşme bu skorun altındaysa saklanmaz ve galeriye gösterilmez */
export const MATCH_MIN_SCORE = 60;
/** Galeri başına günde en çok anlık eşleşme bildirimi; fazlası günlük özete eklenir (Teknik tasarım §6) */
export const MATCH_DAILY_INSTANT = 20;

/** Portföy aracının eşleşmede kullanılan bilgileri (konum galerinin adresidir) */
export interface MatchVehicle {
  make?: string | null;
  series?: string | null;
  model?: string | null;
  generation?: string | null;
  trim?: string | null;
  year: number;
  km: number;
  fuel?: string | null;
  gearbox?: string | null;
  color?: string | null;
  price: number;
  tradeIn?: boolean;
  damage: {
    parcalar?: Partial<Record<string, string>>;
    tramer?: number;
    sasiIslem?: boolean;
    podyeIslem?: boolean;
    airbagAcildi?: boolean;
    agirHasar?: boolean;
  };
  il: string;
  ilce?: string | null;
}

export interface MatchDemand {
  alanlar: Record<string, unknown>;
  alternatifler: Record<string, unknown>[];
}

export interface MatchCriterion {
  key: string;
  /** Kısa ad: "yıl", "kilometre" */
  ad: string;
  weight: number;
  /** 0–1 */
  fit: number;
  /** Alıcı bu ölçütte bir seçim yaptı mı (yapmadıysa uyum 1 sayılır, özette yazılmaz) */
  secim: boolean;
}

export type MatchResult =
  | { ok: true; score: number; alternative: number; criteria: MatchCriterion[] }
  | { ok: false; reason: string };

const SHORT: Record<string, string> = {
  model: 'model',
  kasa: 'kasa',
  paket: 'paket',
  yil: 'yıl',
  km: 'kilometre',
  yakit: 'yakıt',
  vites: 'vites',
  renk: 'renk',
  hasar: 'hasar',
  tramer: 'tramer',
  boya: 'boya',
  butce: 'bütçe',
  konum: 'konum',
  takas: 'takas',
};

/** Alıcının "Kabul ettiğin işlemler" seçenekleri ↔ portföy aracının hasar bilgisi */
const ISLEMLER = [
  ['sasi', 'sasiIslem'],
  ['podye', 'podyeIslem'],
  ['airbag', 'airbagAcildi'],
  ['agir', 'agirHasar'],
] as const;

const RANK = Object.fromEntries(PAINT_STATES.map((s, i) => [s.key, i])) as Record<string, number>;

const asList = (v: unknown): string[] | undefined =>
  Array.isArray(v) && v.length ? v.map(String) : undefined;
const asRange = (v: unknown): Range | undefined => {
  if (!v || typeof v !== 'object') return undefined;
  const r = v as Range;
  return r.min === undefined && r.max === undefined ? undefined : r;
};

/** Boya ve değişen: her parça alıcının kabul ettiği en kötü durumu aşmamalı, işlemli parça sayısı sınırı geçmemeli */
export function paintFit(
  want: { limit: number; parts: Partial<Record<string, string>> },
  have: Partial<Record<string, string>>,
): number {
  let islemli = 0;
  for (const p of PAINT_PARTS) {
    const h = RANK[have[p.key] ?? 'orijinal'] ?? 0;
    if (h > 0) islemli++;
    if (h > (RANK[want.parts[p.key] ?? 'orijinal'] ?? 0)) return 0;
  }
  return islemli <= want.limit ? 1 : 0;
}

/** Bir alanın uyumu; araçta karşılığı yoksa `undefined` (ölçüt hesaba katılmaz) */
function fieldFit(
  f: CategoryField,
  value: unknown,
  v: MatchVehicle,
  trimOrder: readonly string[],
): { fit: number; secim: boolean } | undefined {
  const choice = (have: string | null | undefined) => {
    if (!have) return undefined;
    const sel = asList(value) ?? (typeof value === 'string' ? [value] : undefined);
    return { fit: choiceFit(sel, have), secim: Boolean(sel) };
  };
  if (f.type === 'catalog') {
    const want = value as CatalogRef | undefined;
    if (!want?.make) return { fit: 1, secim: false };
    if (!v.make) return undefined;
    const have = { make: v.make, series: v.series ?? undefined, model: v.model ?? undefined };
    return { fit: catalogFit(want, have), secim: true };
  }
  switch (f.key) {
    case 'kasa':
      return choice(v.generation);
    case 'paket': {
      if (!v.trim) return undefined;
      const sel = asList(value);
      return { fit: packageFit(sel, v.trim, trimOrder), secim: Boolean(sel) };
    }
    case 'yil': {
      const r = asRange(value);
      return { fit: r ? yearFit(r, v.year) : 1, secim: Boolean(r) };
    }
    case 'km':
      return typeof value === 'number' ? { fit: kmFit(value, v.km), secim: true } : { fit: 1, secim: false };
    case 'butce': {
      const r = asRange(value);
      return { fit: r ? budgetFit(r, v.price) : 1, secim: Boolean(r) };
    }
    case 'yakit':
      return choice(v.fuel);
    case 'vites':
      return choice(v.gearbox);
    case 'renk':
      return choice(v.color);
    case 'hasar': {
      if (typeof value !== 'string' || value === 'fark_etmez') return { fit: 1, secim: false };
      const agir = Boolean(v.damage.agirHasar);
      const ok = value === 'yok' ? (v.damage.tramer ?? 0) === 0 && !agir : !agir;
      return { fit: damageFit(ok), secim: true };
    }
    case 'tramer':
      return typeof value === 'number'
        ? { fit: (v.damage.tramer ?? 0) <= value ? 1 : 0, secim: true }
        : { fit: 1, secim: false };
    case 'boya': {
      const w = value as { limit: number; parts: Partial<Record<string, string>> } | undefined;
      return w ? { fit: paintFit(w, v.damage.parcalar ?? {}), secim: true } : { fit: 1, secim: false };
    }
    case 'takas':
      return value === true ? { fit: v.tradeIn ? 1 : 0, secim: true } : { fit: 1, secim: false };
    default:
      return undefined;
  }
}

/**
 * Talep ile portföy aracını karşılaştırır (Teknik tasarım §6). Önce sert koşullar eler: konum (alıcının ili), bütçe
 * üst sınırı (%5 tolerans), alıcının seçtiği marka, "Kimden" yalnızca sahibinden ise galeri, alıcının kabul etmediği
 * işlemler (şasi, podye, airbag, ağır hasar) ve kategoride sert koşul olan alanlar. Sonra her alternatif ayrı
 * skorlanır, en yüksek skor alınır. Araçta karşılığı olmayan alanlar hesaba katılmaz.
 */
export function evaluateMatch(
  def: CategoryDefinition,
  demand: MatchDemand,
  v: MatchVehicle,
  opts: { trimOrder?: readonly string[] } = {},
): MatchResult {
  const fields = effectiveFields(def);
  const alanlar = demand.alanlar ?? {};
  const konum = alanlar.konum as { il?: string; ilce?: string } | undefined;
  // Konum (Teknik tasarım §6): sert koşulsa yalnızca alıcının ili; kategoride sert koşul kapatılmışsa komşu iller de
  // (konum puanı 0,5), uzak iller yine dışarıda
  const komsular = konumKomsulari(fields);
  if (konum?.il && konum.il !== v.il && !komsular(konum.il).includes(v.il))
    return { ok: false, reason: 'konum' };
  const kimden = asList(alanlar.kimden);
  if (kimden && !kimden.includes('galeri')) return { ok: false, reason: 'kimden' };
  const islem = fields.find((f) => f.key === 'islemKabul');
  if (islem && fieldVisible(islem, alanlar)) {
    const kabul = asList(alanlar.islemKabul) ?? [];
    if (ISLEMLER.some(([k, d]) => v.damage[d] && !kabul.includes(k))) return { ok: false, reason: 'islem' };
  }
  const model = fields.find((f) => f.type === 'catalog');
  const wantMake = model ? (alanlar[model.key] as CatalogRef | undefined)?.make : undefined;
  if (wantMake && v.make !== wantMake) return { ok: false, reason: 'marka' };

  let best: { score: number; alternative: number; criteria: MatchCriterion[] } | null = null;
  let reason = 'butce';
  const alts = demand.alternatifler?.length ? demand.alternatifler : [{}];
  alts.forEach((alt, i) => {
    const values = { ...alanlar, ...alt };
    const butce = asRange(alt.butce);
    if (butce?.max !== undefined && v.price > butce.max * 1.05) return;
    const criteria: MatchCriterion[] = [];
    for (const f of fields) {
      if (f.key === 'konum') {
        if (!konum?.il) continue;
        const fit = locationFit(
          { il: konum.il, ilce: konum.ilce },
          { il: v.il, ilce: v.ilce ?? undefined },
          komsular,
        );
        criteria.push({ key: f.key, ad: 'konum', weight: f.weight, fit, secim: true });
        continue;
      }
      if (f.type === 'text' || f.key === 'islemKabul' || f.key === 'kimden') continue;
      if (!fieldVisible(f, values)) continue;
      const r = fieldFit(f, f.scope === 'talep' ? alanlar[f.key] : alt[f.key], v, opts.trimOrder ?? []);
      if (!r) continue;
      if (f.hard === 'yes' && r.secim && r.fit < 1 && f.key !== 'butce') {
        reason = f.key;
        return;
      }
      const ad = SHORT[f.key] ?? f.label.toLocaleLowerCase('tr-TR');
      criteria.push({ key: f.key, ad, weight: f.weight, ...r });
    }
    let total = 0;
    let sum = 0;
    for (const c of criteria) {
      if (c.weight <= 0) continue;
      total += c.weight;
      sum += c.weight * clamp(c.fit);
    }
    const score = total ? Math.round((sum / total) * 100) : 100;
    if (!best || score > best.score) best = { score, alternative: i, criteria };
  });
  const sonuc = best as { score: number; alternative: number; criteria: MatchCriterion[] } | null;
  if (!sonuc) return { ok: false, reason };
  return { ok: true, ...sonuc };
}

/** "a, b ve c" */
export function listeYaz(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`;
}

const cap = (s: string) => s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);

/**
 * Eşleşme kartındaki uyum (GaleriPanel.dc.html, GaleriMobil.dc.html): "Tüm kriterlere uyuyor",
 * "Yıl, kilometre, renk ve hasar kriterlerine uyuyor", "Bütçe ve kilometre kriterlerine uyuyor; renk farklı".
 */
export function matchSummary(criteria: readonly MatchCriterion[]): string {
  const secilen = criteria.filter((c) => c.secim);
  if (secilen.every((c) => c.fit >= 1)) return 'Tüm kriterlere uyuyor';
  const uyan = secilen.filter((c) => c.fit >= 1).map((c) => c.ad);
  const farkli = secilen.filter((c) => c.fit < 0.5).map((c) => c.ad);
  const bas = uyan.length ? `${cap(listeYaz(uyan))} kriterlerine uyuyor` : 'Kriterlerin bir kısmına uyuyor';
  return farkli.length ? `${bas}; ${listeYaz(farkli)} farklı` : bas;
}

/** Sayının iyelik eki: "6’sı", "1’i", "3’ü", "10’u" */
export function iyelik(n: number): string {
  const son = n % 10;
  const onlar = Math.floor(n / 10) % 10;
  const BIR = ['', 'i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u'];
  const ON = ['', 'u', 'si', 'u', 'ı', 'si', 'ı', 'si', 'i', 'ı'];
  const ek = son ? BIR[son] : onlar ? ON[onlar] : 'ı';
  return `${n}’${ek}`;
}

/** Araç sayfasındaki bant (PortfoyArac.dc.html): "6 kriterin 6’sı tutuyor: yıl, kilometre, vites, yakıt, boya ve hasar." */
export function matchCountText(criteria: readonly MatchCriterion[]): string {
  const secilen = criteria.filter((c) => c.secim);
  const tutan = secilen.filter((c) => c.fit >= 1);
  if (!secilen.length) return 'Talebindeki temel koşulları karşılıyor.';
  const liste = tutan.length ? `: ${listeYaz(tutan.map((c) => c.ad))}` : '';
  return `${secilen.length} kriterin ${iyelik(tutan.length)} tutuyor${liste}.`;
}
