import { z } from 'zod';
import { GALLERY_PLANS } from './gallery.js';
import { PRODUCTS } from './payments.js';

/**
 * Kurallar ve fiyatlar (Karar 47, 56; YonetimSistem.dc.html › kural). Galeri paketlerinin fiyatı ve içeriği ile bireysel
 * ürünlerin web fiyatı bir "fiyat listesi"nde tutulur. Değişiklik dört göz onayı ister (PRICE_CHANGE, yalnızca Sahip
 * onaylar) ve ileri tarihe zamanlanır; mevcut aboneler yenileme tarihine kadar eski fiyattan devam eder (abonelik dönem
 * fiyatını saklar). Mobil fiyatlar mağaza panelinden yönetilir; konsol yalnızca gösterir. Liste yoksa başlangıç
 * değerleri (bu dosyadaki sabitler) geçerlidir.
 */

export type PaidPlanKey = keyof typeof GALLERY_PLANS;
export const PAID_PLAN_KEYS = Object.keys(GALLERY_PLANS) as PaidPlanKey[];

/** Paketin değiştirilebilen alanları (fiyatlar KDV hariç TL; portföy null = sınırsız) */
export interface PackageTerms {
  aylik: number;
  yillik: number;
  portfoy: number | null;
  gunlukMesaj: number;
  aylikTalep: number;
  oneCikarma: number;
  calisan: number;
}

export interface PriceBook {
  paketler: Record<PaidPlanKey, PackageTerms>;
  /** Ürün anahtarı → web fiyatı (TL, KDV dahil) */
  urunler: Record<string, number>;
}

/** Paket tablosu (özellik adlarıyla); `galleryAccess`, `planNetKurus` ve `memberLimit` bunu alır */
export type PlanTable = Record<
  PaidPlanKey,
  PackageTerms & { ad: string; toplu: boolean; eslesme: boolean; api: boolean }
>;

export const DEFAULT_PRICE_BOOK: PriceBook = {
  paketler: Object.fromEntries(
    PAID_PLAN_KEYS.map((k) => {
      const p = GALLERY_PLANS[k];
      return [
        k,
        {
          aylik: p.aylik,
          yillik: p.yillik,
          portfoy: p.portfoy,
          gunlukMesaj: p.gunlukMesaj,
          aylikTalep: p.aylikTalep,
          oneCikarma: p.oneCikarma,
          calisan: p.calisan,
        },
      ];
    }),
  ) as Record<PaidPlanKey, PackageTerms>,
  urunler: Object.fromEntries(PRODUCTS.map((p) => [p.key, p.tl])),
};

/** Fiyat listesinden paket tablosu: ad ve açık/kapalı özellikler koddan, fiyat ve sınırlar listeden */
export function plansOf(book: PriceBook): PlanTable {
  return Object.fromEntries(
    PAID_PLAN_KEYS.map((k) => {
      const p = GALLERY_PLANS[k];
      return [k, { ad: p.ad, toplu: p.toplu, eslesme: p.eslesme, api: p.api, ...book.paketler[k] }];
    }),
  ) as PlanTable;
}

/** Ürünün web fiyatı (TL, KDV dahil) */
export const productPrice = (book: PriceBook, key: string) =>
  book.urunler[key] ?? PRODUCTS.find((p) => p.key === key)?.tl ?? null;

/** Kupon en yüksek indirim yüzdesi; üstü sahip onayı ister (kuponlar kampanyalarla, Aşama 9) */
export const COUPON_MAX_PERCENT = 50;

/** Konsoldaki paket satırları (YonetimSistem.dc.html › Galeri paketleri) */
export const PACKAGE_ROWS: { alan: keyof PackageTerms; ad: string }[] = [
  { alan: 'aylik', ad: 'Aylık fiyat' },
  { alan: 'yillik', ad: 'Yıllık fiyat' },
  { alan: 'portfoy', ad: 'Portföy araç sınırı' },
  { alan: 'gunlukMesaj', ad: 'Günlük ilk mesaj hakkı' },
  { alan: 'aylikTalep', ad: 'Aylık talep açma hakkı' },
  { alan: 'oneCikarma', ad: 'Aylık öne çıkarma (7 gün)' },
  { alan: 'calisan', ad: 'Çalışan kullanıcı' },
];

const tam = (en: number, cok: number) => z.number().int().min(en).max(cok);
const packageSchema = z
  .object({
    aylik: tam(1, 1_000_000),
    yillik: tam(1, 10_000_000),
    portfoy: tam(1, 100_000).nullable(),
    gunlukMesaj: tam(0, 10_000),
    aylikTalep: tam(0, 1_000),
    oneCikarma: tam(0, 1_000),
    calisan: tam(1, 1_000),
  })
  .strict();

export const priceBookSchema = z
  .object({
    paketler: z.object(
      Object.fromEntries(PAID_PLAN_KEYS.map((k) => [k, packageSchema])) as Record<
        PaidPlanKey,
        typeof packageSchema
      >,
    ),
    urunler: z
      .record(z.string(), z.number().positive().max(1_000_000))
      .refine((u) => PRODUCTS.every((p) => typeof u[p.key] === 'number'), 'Her ürünün fiyatı olmalı')
      .refine((u) => Object.keys(u).every((k) => PRODUCTS.some((p) => p.key === k)), 'Bilinmeyen ürün'),
  })
  .strict()
  .superRefine((b, ctx) => {
    // Üst paket alt paketten ucuz olamaz; yıllık fiyat aylığın 12 katını geçemez
    for (const [i, k] of PAID_PLAN_KEYS.entries()) {
      const p = b.paketler[k];
      if (p.yillik > p.aylik * 12)
        ctx.addIssue({
          code: 'custom',
          path: ['paketler', k, 'yillik'],
          message: 'Yıllık fiyat 12 aydan pahalı olamaz',
        });
      const ust = PAID_PLAN_KEYS[i + 1];
      if (ust && b.paketler[ust].aylik <= p.aylik)
        ctx.addIssue({
          code: 'custom',
          path: ['paketler', ust, 'aylik'],
          message: 'Üst paket alttakinden pahalı olmalı',
        });
    }
  });

/** Değişiklik önerisi: yeni liste ve yürürlük tarihi (YYYY-AA-GG, Türkiye saatiyle o günün başı) */
export const priceProposalSchema = z
  .object({
    kitap: priceBookSchema,
    yururluk: z.iso.date(),
    not: z.string().trim().max(500).optional(),
  })
  .strict();

const tl = (n: number) => `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n)} TL`;
const deger = (alan: keyof PackageTerms, v: number | null) =>
  v === null
    ? 'Sınırsız'
    : alan === 'aylik' || alan === 'yillik'
      ? tl(v)
      : alan === 'oneCikarma' && v === 0
        ? 'Yok'
        : String(v);

/** Konsolda gösterim: "1.490 TL", "Sınırsız", "Yok" */
export const packageValueText = deger;

/** İki liste arasındaki değişiklikler: "Profesyonel · Aylık fiyat: 3.490 TL → 3.990 TL" */
export function priceChanges(a: PriceBook, b: PriceBook): string[] {
  const out: string[] = [];
  for (const k of PAID_PLAN_KEYS) {
    for (const r of PACKAGE_ROWS) {
      const x = a.paketler[k][r.alan];
      const y = b.paketler[k][r.alan];
      if (x !== y) out.push(`${GALLERY_PLANS[k].ad} · ${r.ad}: ${deger(r.alan, x)} → ${deger(r.alan, y)}`);
    }
  }
  for (const p of PRODUCTS) {
    const x = productPrice(a, p.key);
    const y = productPrice(b, p.key);
    if (x !== y) out.push(`${p.ad}: ${tl(x ?? 0)} → ${tl(y ?? 0)}`);
  }
  return out;
}
