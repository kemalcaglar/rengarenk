import { z } from 'zod';

/**
 * A/B testleri (Karar 44, 46, 51; YonetimRapor.dc.html › deney). Kampanya ve bannerda ikinci sürüm (B) yazılır; kişi
 * ya da ziyaretçi kimliğinden sabit bir özetle iki kola ayrılır (aynı kişi hep aynı kolu görür). Kampanyada ölçü
 * uygulamada okunma, bannerda tıklama oranıdır. İki oranlı z testiyle güven hesaplanır; her kolda en az
 * `AB_MIN_ORNEK` kişi olunca ve güven %95'i geçince kazanan belli olur, ajan bildirir. Bannerda kazanan
 * "herkese açılır" (B içerik bannerın kendisi olur). Fiyat deneylerinde ölçü kullanıcı başına gelirdir (`meanTest`).
 */

export type Arm = 'A' | 'B';

/** FNV-1a: kimlik ve deney anahtarından sabit kol (dağılım %50 / %50) */
export function armOf(subject: string, key: string): Arm {
  let h = 0x811c9dc5;
  const s = `${key}:${subject}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 2 === 0 ? 'A' : 'B';
}

export const AB_MIN_ORNEK = 100;
export const AB_GUVEN = 0.95;

/** Standart normal dağılımın birikimli fonksiyonu (Abramowitz–Stegun 26.2.17) */
function phi(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p =
    d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

export interface AbResult {
  a: { n: number; x: number; oran: number | null };
  b: { n: number; x: number; oran: number | null };
  /** B − A, yüzde puan */
  farkPuan: number | null;
  /** Farkın rastlantı olmama güveni (0–1; iki yönlü) */
  guven: number | null;
  /** Yeterli örnek ve güven varsa önde olan kol */
  kazanan: Arm | null;
}

/** İki oranlı z testi: n kişi (gösterim), x dönüşüm (okunma, tıklama) */
export function abTest(aN: number, aX: number, bN: number, bX: number): AbResult {
  const oran = (n: number, x: number) => (n ? x / n : null);
  const pa = oran(aN, aX);
  const pb = oran(bN, bX);
  const out: AbResult = {
    a: { n: aN, x: aX, oran: pa },
    b: { n: bN, x: bX, oran: pb },
    farkPuan: pa !== null && pb !== null ? (pb - pa) * 100 : null,
    guven: null,
    kazanan: null,
  };
  if (pa === null || pb === null) return out;
  const p = (aX + bX) / (aN + bN);
  const se = Math.sqrt(p * (1 - p) * (1 / aN + 1 / bN));
  if (!se) return out;
  const zz = (pb - pa) / se;
  out.guven = 2 * phi(Math.abs(zz)) - 1;
  if (aN >= AB_MIN_ORNEK && bN >= AB_MIN_ORNEK && out.guven >= AB_GUVEN && pa !== pb)
    out.kazanan = pb > pa ? 'B' : 'A';
  return out;
}

/** Kol başına kullanıcı sayısı, toplam ve kareler toplamı (ör. kuruş cinsinden gelir) */
export interface KolOzet {
  n: number;
  toplam: number;
  kare: number;
}

export interface MeanResult {
  a: { n: number; ort: number | null };
  b: { n: number; ort: number | null };
  /** B − A (aynı birim) */
  fark: number | null;
  guven: number | null;
  kazanan: Arm | null;
}

/**
 * İki ortalamanın karşılaştırması (Welch, normal yaklaşım): fiyat deneyinde kullanıcı başına gelir. Çoğu kullanıcı
 * hiç ödemediği için dağılım çarpıktır; her kolda en az `AB_MIN_ORNEK` kişi aranır.
 */
export function meanTest(a: KolOzet, b: KolOzet): MeanResult {
  const ort = (k: KolOzet) => (k.n ? k.toplam / k.n : null);
  const varyans = (k: KolOzet) => (k.n > 1 ? (k.kare - (k.toplam * k.toplam) / k.n) / (k.n - 1) : 0);
  const ma = ort(a);
  const mb = ort(b);
  const out: MeanResult = {
    a: { n: a.n, ort: ma },
    b: { n: b.n, ort: mb },
    fark: ma !== null && mb !== null ? mb - ma : null,
    guven: null,
    kazanan: null,
  };
  if (ma === null || mb === null || a.n < 2 || b.n < 2) return out;
  const se = Math.sqrt(Math.max(0, varyans(a)) / a.n + Math.max(0, varyans(b)) / b.n);
  if (!se) return out;
  out.guven = 2 * phi(Math.abs((mb - ma) / se)) - 1;
  if (a.n >= AB_MIN_ORNEK && b.n >= AB_MIN_ORNEK && out.guven >= AB_GUVEN && ma !== mb)
    out.kazanan = mb > ma ? 'B' : 'A';
  return out;
}

const yuzde = (x: number | null, basamak = 1) =>
  x === null ? '—' : `%${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: basamak }).format(x * 100)}`;

/** Güven aşağı kesilerek yazılır: %94,9 "%95" görünüp eşiği geçmiş sanılmasın */
export const guvenYaz = (g: number) => `%${Math.floor(g * 100)}`;

/** "B önde: tıklama %4,4 / A %3,1 · güven %88" */
export function abSummary(r: AbResult, olcu: string) {
  if (r.a.n === 0 && r.b.n === 0) return 'A/B · henüz veri yok';
  if (r.a.oran === null || r.b.oran === null) return 'A/B · iki kolda da veri birikiyor';
  const once = r.b.oran >= r.a.oran ? 'B' : 'A';
  const [o1, o2] = once === 'B' ? [r.b.oran, r.a.oran] : [r.a.oran, r.b.oran];
  const diger = once === 'B' ? 'A' : 'B';
  return `A/B · ${r.a.oran === r.b.oran ? 'eşit' : `${once} önde`}: ${olcu} ${yuzde(o1)} / ${diger} ${yuzde(o2)}${
    r.guven === null ? '' : ` · güven ${guvenYaz(r.guven)}`
  }`;
}

/** İkinci sürüm (B): kampanya ve banner metni */
export const variantSchema = z
  .object({
    baslik: z.string().trim().min(3).max(80),
    metin: z.string().trim().max(400).default(''),
    dugme: z.string().trim().max(30).default(''),
  })
  .strict();
export type Variant = z.output<typeof variantSchema>;
