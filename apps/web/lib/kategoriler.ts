import { dotColor, type PublicCategory, VEHICLE_CATEGORIES } from '@rengarenk/shared';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** API'ye ulaşılamazsa ilk kurulumdaki 14 vasıta kategorisi (site açık kalsın). */
const YEDEK: PublicCategory[] = VEHICLE_CATEGORIES.map((c, i) => ({
  slug: c.slug,
  name: c.name,
  vertical: 'vasita',
  color: dotColor(i),
  version: null,
  children: [],
}));

/**
 * Menüdeki kategoriler (Karar 23, 45): konsolda açılan, kapatılan ya da sırası değişen kategori bir dakika
 * içinde sitede de değişir.
 */
export async function getCategories(): Promise<PublicCategory[]> {
  try {
    const r = await fetch(`${API}/categories`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(2000),
    });
    return r.ok ? ((await r.json()) as PublicCategory[]) : YEDEK;
  } catch {
    return YEDEK;
  }
}
