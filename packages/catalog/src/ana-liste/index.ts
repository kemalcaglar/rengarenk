import { MARKA_ADI, SERI_KURALLARI } from './kurallar.js';
import { ANA_LISTE } from './liste.js';
import type { AnaKategori, AnaMarka, SeriKurali } from './tipler.js';

export type { AnaKategori, AnaMarka, AnaSeri, SeriKurali } from './tipler.js';
export { ANA_LISTE, MARKA_ADI, SERI_KURALLARI };

/**
 * Ana liste ve bağlama kurallarının sürümü. Liste ya da kural değişince artar; bütün katalog kaynakları (TSB, arşiv,
 * vehicle-makes-models, yerli liste, Wikidata) bu sürümle yeniden işlenir.
 */
export const ANA_LISTE_SURUM = '2026-11-16-6';

/** Kaynağın ayrıştırıcı sürümü ile ana liste sürümü: biri değişince kaynak yeniden işlenir. */
export const anaKural = (parser: string) => `${parser}+ana.${ANA_LISTE_SURUM}`;

/** Ana listenin kapsadığı kategoriler */
export const ANA_KATEGORILER: readonly AnaKategori[] = ['otomobil', 'arazi-suv-pickup'];

const TR: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };

/**
 * Ad anahtarı: büyük/küçük harf, Türkçe harf, aksan, boşluk ve noktalama ("+" hariç: 206 ≠ 206+) önemsiz; "Serisi", "Series", "Class"
 * kelimeleri atılır. "L 200" = "L200", "5 Serisi" = "5 Series", "C-Elysée" = "C-Elysee".
 */
export function adAnahtari(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (c) => TR[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(serisi|series|class|sinifi)\b/g, '')
    .replace(/[^a-z0-9+]/g, '');
}

/** "1997-2000,2003" → [1997, 1998, 1999, 2000, 2003] */
export function yillariAc(s: string): number[] {
  const out = new Set<number>();
  for (const parca of s.split(',')) {
    const [a, b] = parca.split('-').map((x) => Number(x.trim()));
    if (!a) continue;
    for (let y = a; y <= (b || a); y++) out.add(y);
  }
  return [...out].sort((x, y) => x - y);
}

export interface AnaListeSerisi {
  marka: string;
  seri: string;
  kategoriler: AnaKategori[];
  yillar: number[];
}

/** Ana liste seri başına: aynı seri iki kategoride yazıldıysa kategoriler ve yıllar birleşir. */
export function anaListe(liste: AnaMarka[] = ANA_LISTE): AnaListeSerisi[] {
  const m = new Map<string, AnaListeSerisi>();
  for (const marka of liste) {
    for (const s of marka.seriler) {
      const k = `${adAnahtari(marka.marka)}|${s.ad}`;
      const e = m.get(k) ?? { marka: marka.marka, seri: s.ad, kategoriler: [], yillar: [] };
      if (!e.kategoriler.includes(s.kategori)) e.kategoriler.push(s.kategori);
      e.yillar = [...new Set([...e.yillar, ...yillariAc(s.yillar)])].sort((a, b) => a - b);
      m.set(k, e);
    }
  }
  return [...m.values()];
}

interface Dizin {
  marka: Map<string, string>;
  seri: Map<string, Map<string, string>>;
}

let dizin: Dizin | undefined;
function dizinAl(): Dizin {
  if (dizin) return dizin;
  const marka = new Map<string, string>();
  const seri = new Map<string, Map<string, string>>();
  for (const m of ANA_LISTE) {
    marka.set(adAnahtari(m.marka), m.marka);
    const s = seri.get(m.marka) ?? new Map<string, string>();
    for (const x of m.seriler) if (!s.has(adAnahtari(x.ad))) s.set(adAnahtari(x.ad), x.ad);
    seri.set(m.marka, s);
  }
  for (const [k, ad] of Object.entries(MARKA_ADI)) marka.set(k, ad);
  dizin = { marka, seri };
  return dizin;
}

export interface Yerlestirilecek {
  make: string;
  series: string | null;
  /** Tip adı (TSB tip metni); kurallar bunda arar */
  raw?: string;
  fuel?: string | null;
  categories?: readonly string[];
  years?: readonly number[];
}

const kuralTutar = (k: SeriKurali, v: Yerlestirilecek) =>
  (!k.tip || k.tip.test(v.raw ?? '')) &&
  (!k.yakit || v.fuel === k.yakit) &&
  (!k.ilkYil || Math.min(...(v.years?.length ? v.years : [0])) >= k.ilkYil);

/**
 * Kaynaktaki marka ve seriyi ana listeye yerleştirir (Karar 33, sahip kararı 16 Kasım 2026): marka ana listedeki
 * adı alır; otomobil ve SUV serisi önce kurala, sonra ad anahtarı eşit olan ana liste serisine bağlanır. Ana listede
 * karşılığı olmayan seri olduğu gibi kalır (TSB'de olup listede olmayan araçlar da katalogda kalır).
 * `ana`: seri ana listedeki adı aldı.
 */
export function anaYerlestir(v: Yerlestirilecek): { make: string; series: string | null; ana: boolean } {
  const d = dizinAl();
  const make = d.marka.get(adAnahtari(v.make)) ?? v.make;
  if (!v.series) return { make, series: v.series, ana: false };
  if (v.categories && !v.categories.some((c) => (ANA_KATEGORILER as readonly string[]).includes(c)))
    return { make, series: v.series, ana: false };
  const anahtar = adAnahtari(v.series);
  const kural = SERI_KURALLARI[make]?.find((k) => adAnahtari(k.kaynak) === anahtar && kuralTutar(k, v));
  if (kural) return { make: kural.marka ?? make, series: kural.hedef, ana: true };
  const ad = d.seri.get(make)?.get(anahtar);
  return ad ? { make, series: ad, ana: true } : { make, series: v.series, ana: false };
}
