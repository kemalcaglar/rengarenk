import { z } from 'zod';
import { GALLERY_PLANS } from './gallery.js';
import { PRODUCTS } from './payments.js';
import { BADGE_RULES, type BadgeRules } from './ratings.js';

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

/**
 * Rozet eşikleri (Karar 55, 56): Kurallar ve fiyatlar listesinin parçası; aynı onay ve yürürlük tarihiyle değişir.
 * Ölçüm pencereleri (hızlı yanıtta 30, güvenilir satıcıda 90 gün) sabittir.
 */
export interface BadgeThresholds {
  /** Hızlı yanıt: ortanca ilk yanıt bu dakikanın altında */
  hizliDakika: number;
  /** Hızlı yanıt: son 30 günde en az sohbet */
  hizliSohbet: number;
  /** Güvenilir satıcı: en az yıldız sayısı */
  guvenYildiz: number;
  /** Güvenilir satıcı: en düşük yıldız ortalaması */
  guvenOrtalama: number;
  /** Güvenilir satıcı: şikâyet oranı bu yüzdenin altında */
  guvenSikayetYuzde: number;
}

export interface PriceBook {
  paketler: Record<PaidPlanKey, PackageTerms>;
  /** Ürün anahtarı → web fiyatı (TL, KDV dahil) */
  urunler: Record<string, number>;
  /** Eski listelerde yok: başlangıç değerleri geçerli */
  rozetler?: BadgeThresholds;
}

export const DEFAULT_BADGE_THRESHOLDS: BadgeThresholds = {
  hizliDakika: BADGE_RULES.hizli.ortancaDakika,
  hizliSohbet: BADGE_RULES.hizli.enAzSohbet,
  guvenYildiz: BADGE_RULES.guven.enAzYildiz,
  guvenOrtalama: BADGE_RULES.guven.enAzOrtalama,
  guvenSikayetYuzde: BADGE_RULES.guven.sikayetOraniAlti * 100,
};

/** Listedeki rozet eşikleri (yoksa başlangıç değerleri) */
export const badgeThresholdsOf = (book: PriceBook): BadgeThresholds => ({
  ...DEFAULT_BADGE_THRESHOLDS,
  ...book.rozetler,
});

/** Yürürlükteki listeden rozet kuralları (`badgesOf`, `badgeProgress`) */
export function badgeRulesOf(book: PriceBook): BadgeRules {
  const t = badgeThresholdsOf(book);
  return {
    hizli: { ortancaDakika: t.hizliDakika, enAzSohbet: t.hizliSohbet, gun: BADGE_RULES.hizli.gun },
    guven: {
      enAzYildiz: t.guvenYildiz,
      enAzOrtalama: t.guvenOrtalama,
      sikayetOraniAlti: t.guvenSikayetYuzde / 100,
      gun: BADGE_RULES.guven.gun,
    },
  };
}

/** Konsoldaki rozet eşiği satırları (Kurallar ve fiyatlar › Rozet eşikleri; tasarıma ek) */
export const BADGE_THRESHOLD_ROWS: { alan: keyof BadgeThresholds; ad: string; birim: string }[] = [
  { alan: 'hizliDakika', ad: 'Hızlı yanıt · ortanca ilk yanıt', birim: 'dakikanın altında' },
  { alan: 'hizliSohbet', ad: 'Hızlı yanıt · en az sohbet', birim: 'son 30 gün' },
  { alan: 'guvenYildiz', ad: 'Güvenilir satıcı · en az yıldız', birim: 'adet' },
  { alan: 'guvenOrtalama', ad: 'Güvenilir satıcı · yıldız ortalaması', birim: 've üstü' },
  { alan: 'guvenSikayetYuzde', ad: 'Güvenilir satıcı · şikâyet oranı', birim: '% altında · son 90 gün' },
];

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
  rozetler: DEFAULT_BADGE_THRESHOLDS,
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

const badgeSchema = z
  .object({
    hizliDakika: tam(5, 24 * 60),
    hizliSohbet: tam(1, 1_000),
    guvenYildiz: tam(1, 1_000),
    guvenOrtalama: z.number().min(3).max(5).multipleOf(0.1),
    guvenSikayetYuzde: z.number().min(0.1).max(20).multipleOf(0.1),
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
    rozetler: badgeSchema.optional(),
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
  const ra = badgeThresholdsOf(a);
  const rb = badgeThresholdsOf(b);
  const sayi = (n: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(n);
  for (const r of BADGE_THRESHOLD_ROWS) {
    if (ra[r.alan] !== rb[r.alan]) out.push(`${r.ad}: ${sayi(ra[r.alan])} → ${sayi(rb[r.alan])}`);
  }
  return out;
}
