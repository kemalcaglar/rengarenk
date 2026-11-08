import { type CategoryDefinition, effectiveFields } from './category-schema.js';

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

/** Donanım paketi: aynı paket 1 · üst paket 0,6 · alt paket 0,2 (sıra: düşükten yükseğe paket kodları) */
export function packageFit(
  selected: readonly string[] | undefined,
  value: string,
  order: readonly string[],
): number {
  if (!selected || selected.length === 0 || selected.includes(value)) return 1;
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
