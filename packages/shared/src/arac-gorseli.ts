/**
 * Talep görseli (sahip isteği, 17 Kasım 2026; Karar 34). Her talep görselle yayına girer: katalogda seçili fotoğraf
 * yoksa arayüz marka ve model kapağı gösterir, talep konsolda "Görsel bekleyen talepler" listesine düşer; katalog
 * sorumlusu fotoğrafı Commons adaylarından seçer ya da elle yükler.
 */

/**
 * Elle yüklenen fotoğrafın lisansı (Karar 34: ticari kullanıma izin veren lisanslar; NC ve ND alınmaz). Başka
 * sitelerdeki ilan fotoğrafları ve lisanssız üretici görselleri kullanılmaz; kaynak sayfası ve yazar zorunludur.
 */
export const GORSEL_LISANSLARI = [
  'Kamu malı',
  'CC0',
  'CC BY 4.0',
  'CC BY-SA 4.0',
  'CC BY 3.0',
  'CC BY-SA 3.0',
  'CC BY 2.0',
  'CC BY-SA 2.0',
  'Kendi fotoğrafımız',
  'Yazılı izinle',
] as const;
export type GorselLisansi = (typeof GORSEL_LISANSLARI)[number];

/** Elle yüklenen fotoğrafta en az genişlik (piksel) */
export const GORSEL_EN_AZ_GENISLIK = 800;

/** Kapak renkleri: paletin rengi ve açık tonu (web ve mobil aynı sırayla) */
export const KAPAK_TONLARI = ['blue', 'pink', 'yellow', 'green'] as const;
export type KapakTonu = (typeof KAPAK_TONLARI)[number];

/** Markaya göre sabit ton: aynı marka her yerde aynı renkte görünür */
export function kapakTonu(anahtar: string | null | undefined): KapakTonu {
  let h = 0;
  for (const c of anahtar ?? '') h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return KAPAK_TONLARI[h % KAPAK_TONLARI.length] as KapakTonu;
}

/** Kapaktaki büyük harfler: "Mercedes-Benz" → "MB", "BMW" → "BMW", "Renault" → "R" */
export function kapakHarfleri(marka: string | null | undefined): string {
  const m = (marka ?? '').trim();
  if (!m) return '';
  if (/^[A-ZÇĞİÖŞÜ0-9]{2,4}$/.test(m)) return m;
  const parcalar = m.split(/[\s-]+/).filter(Boolean);
  return parcalar
    .slice(0, 2)
    .map((p) => p.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('');
}
