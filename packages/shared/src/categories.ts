/**
 * Vasıta kategorileri (Karar 19): katalog ataması ve ilk kurulumun sırası. Kategoriler canlıda konsoldan yönetilir
 * (Karar 45); web ve mobil menüyü `GET /categories` ile okur, API'ye ulaşılamazsa bu listeyi gösterir.
 */
export const VEHICLE_CATEGORIES = [
  { slug: 'otomobil', name: 'Otomobil', listingDays: 30 },
  { slug: 'arazi-suv-pickup', name: 'Arazi, SUV & Pickup', listingDays: 30 },
  { slug: 'elektrikli', name: 'Elektrikli Araçlar', listingDays: 30 },
  { slug: 'motosiklet', name: 'Motosiklet', listingDays: 30 },
  { slug: 'minivan-panelvan', name: 'Minivan & Panelvan', listingDays: 30 },
  { slug: 'ticari', name: 'Ticari Araçlar', listingDays: 30 },
  { slug: 'kiralik', name: 'Kiralık Araçlar', listingDays: 30 },
  { slug: 'deniz', name: 'Deniz Araçları', listingDays: 30 },
  { slug: 'hasarli', name: 'Hasarlı Araçlar', listingDays: 30 },
  { slug: 'karavan', name: 'Karavan', listingDays: 30 },
  { slug: 'klasik', name: 'Klasik Araçlar', listingDays: 30 },
  { slug: 'hava', name: 'Hava Araçları', listingDays: 90 },
  { slug: 'atv', name: 'ATV', listingDays: 30 },
  { slug: 'utv', name: 'UTV', listingDays: 30 },
] as const;

export type VehicleCategorySlug = (typeof VEHICLE_CATEGORIES)[number]['slug'];
