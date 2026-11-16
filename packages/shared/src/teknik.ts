/**
 * Bir motor sürümünün teknik özeti (API `GET /catalog/series/:id` → `models[].teknik`; kaynak ADEME Avrupa onay verisi,
 * Türkiye'de satılan tiplerle eşleşmiş). Değerler sürümler arasında farklıysa aralık ya da seçenek olarak gelir.
 */
export interface TeknikOzet {
  /** "manuel:6", "otomatik:7", "otomatik:" (vites sayısı bilinmiyor) */
  vitesler: string[];
  kw: [number, number] | null;
  hp: [number, number] | null;
  tuketim: [number, number] | null;
  co2: [number, number] | null;
  agirlik: [number, number] | null;
  euro: string[];
  surum: number;
}

const VITES: Record<string, string> = {
  manuel: 'manuel',
  otomatik: 'otomatik',
  yari_otomatik: 'yarı otomatik',
};

const sayi = (n: number, basamak = 0) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: basamak, maximumFractionDigits: basamak });

const aralik = (a: [number, number], basamak = 0) =>
  a[0] === a[1] ? sayi(a[0], basamak) : `${sayi(a[0], basamak)}–${sayi(a[1], basamak)}`;

/** "6 ileri manuel", "Otomatik" */
export function vitesYaz(v: string): string {
  const [tur = '', adet = ''] = v.split(':');
  const ad = VITES[tur] ?? tur;
  return adet ? `${adet} ileri ${ad}` : ad.charAt(0).toLocaleUpperCase('tr-TR') + ad.slice(1);
}

/** Gösterim satırları: [etiket, değer] (boş alanlar atlanır) */
export function teknikSatirlari(o: TeknikOzet): [string, string][] {
  const out: [string, string][] = [];
  if (o.vitesler.length) out.push(['Vites', o.vitesler.map(vitesYaz).join(' ya da ')]);
  if (o.hp) out.push(['Güç', `${aralik(o.hp)} hp${o.kw ? ` (${aralik(o.kw)} kW)` : ''}`]);
  if (o.tuketim) out.push(['Karma tüketim', `${aralik(o.tuketim, 1)} l/100 km`]);
  if (o.co2) out.push(['CO₂', `${aralik(o.co2)} g/km`]);
  if (o.agirlik) out.push(['Boş ağırlık', `${aralik(o.agirlik)} kg`]);
  if (o.euro.length) out.push(['Emisyon', o.euro.map((e) => `Euro ${e}`).join(', ')]);
  return out;
}

/** Teknik değerlerin kaynağı (kullanıcıya gösterilen not) */
export const TEKNIK_KAYNAK = 'Avrupa onay değerleri (ADEME, Fransa); Türkiye’de satılan sürümle eşleşir';
