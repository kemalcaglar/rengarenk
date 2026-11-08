import { dotColor, type PublicCategory, VEHICLE_CATEGORIES } from '@rengarenk/shared';
import { useEffect, useState } from 'react';

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

/** API'ye ulaşılamazsa ilk kurulumdaki 14 vasıta kategorisi. */
const YEDEK: PublicCategory[] = VEHICLE_CATEGORIES.map((c, i) => ({
  slug: c.slug,
  name: c.name,
  vertical: 'vasita',
  color: dotColor(i),
  version: null,
  children: [],
}));

/** Menüdeki kategoriler (Karar 23, 45): konsoldan açılıp kapatılan, sırası ve rengi değişen liste. */
export function useKategoriler(): PublicCategory[] {
  const [list, setList] = useState<PublicCategory[]>(YEDEK);
  useEffect(() => {
    let alive = true;
    fetch(`${API}/categories`)
      .then((r) => (r.ok ? (r.json() as Promise<PublicCategory[]>) : null))
      .then((l) => alive && l && setList(l))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return list;
}
