import { z } from 'zod';
import { couponCodeSchema } from './coupons.js';

/**
 * Web ödemeleri (Karar 12.8, 31, 38, 39; Teknik tasarım §7). Bireysel fiyatlar KDV dahildir. Uygulamada satış mağaza
 * ödemeleriyle (Karar 38) yapılır; `mobil` uygulama içi fiyatıdır ve uygulamada web fiyatından söz edilmez.
 * Fiyatlar başlangıç değerleridir; konsoldaki "Kurallar ve fiyatlar" ekranıyla (Karar 12.9, 56) yönetilecek.
 */

export const VAT_RATE = 20;

export type ProductGroup = 'talep' | 'mesaj' | 'one_cikarma';
export type PromotionKind = 'ust_sira' | 'acil' | 'vitrin';
export type EntitlementProductKind = 'talep' | 'ilk_mesaj' | 'uzatma';

export interface Product {
  key: string;
  grup: ProductGroup;
  ad: string;
  not: string;
  /** Web fiyatı, TL, KDV dahil */
  tl: number;
  /** Uygulama içi fiyatı (Karar 38) */
  mobil: number;
  /** Hak defterine eklenen hak */
  hak?: { kind: EntitlementProductKind; adet: number };
  /** Bir talebe uygulanan öne çıkarma */
  oneCikarma?: { tur: PromotionKind; gun: number };
  /** Satın alındığı anda başlayan hizmet: cayma hakkı için ikinci onay (Karar 39) */
  hemenBaslar: boolean;
}

/** Haklarım.dc.html'deki ürünler, Karar 12.8 fiyatları */
export const PRODUCTS: readonly Product[] = [
  {
    key: 'ek_talep',
    grup: 'talep',
    ad: 'Ek talep hakkı · 1 adet',
    not: 'Yeni talep açmak veya taslağını yayınlamak için',
    tl: 199,
    mobil: 239.99,
    hak: { kind: 'talep', adet: 1 },
    hemenBaslar: false,
  },
  {
    key: 'talep_paketi',
    grup: 'talep',
    ad: 'Talep paketi · 3 adet',
    not: 'Tanesi 166 TL’ye gelir',
    tl: 499,
    mobil: 599.99,
    hak: { kind: 'talep', adet: 3 },
    hemenBaslar: false,
  },
  {
    key: 'uzatma',
    grup: 'talep',
    ad: 'Talep uzatma · 30 gün',
    not: 'Ücretsiz uzatma hakkını kullandıktan sonra',
    tl: 99,
    mobil: 119.99,
    hak: { kind: 'uzatma', adet: 1 },
    hemenBaslar: true,
  },
  {
    key: 'mesaj_10',
    grup: 'mesaj',
    ad: 'Ek ilk mesaj · 10 adet',
    not: 'Günlük 5 ücretsiz hakkın bitince kullanılır, süresi dolmaz',
    tl: 99,
    mobil: 119.99,
    hak: { kind: 'ilk_mesaj', adet: 10 },
    hemenBaslar: false,
  },
  {
    key: 'mesaj_30',
    grup: 'mesaj',
    ad: 'Ek ilk mesaj · 30 adet',
    not: 'Tanesi 8,30 TL’ye gelir',
    tl: 249,
    mobil: 299.99,
    hak: { kind: 'ilk_mesaj', adet: 30 },
    hemenBaslar: false,
  },
  {
    key: 'ust_sira_7',
    grup: 'one_cikarma',
    ad: 'Üst sıra · 7 gün',
    not: 'Listelerde ve eşleşmelerde en üstte',
    tl: 149,
    mobil: 179.99,
    oneCikarma: { tur: 'ust_sira', gun: 7 },
    hemenBaslar: true,
  },
  {
    key: 'ust_sira_30',
    grup: 'one_cikarma',
    ad: 'Üst sıra · 30 gün',
    not: 'Talebin yayın süresi boyunca',
    tl: 449,
    mobil: 539.99,
    oneCikarma: { tur: 'ust_sira', gun: 30 },
    hemenBaslar: true,
  },
  {
    key: 'acil_7',
    grup: 'one_cikarma',
    ad: 'Acil arıyorum etiketi · 7 gün',
    not: 'Talebinin üstünde pembe etiket',
    tl: 79,
    mobil: 94.99,
    oneCikarma: { tur: 'acil', gun: 7 },
    hemenBaslar: true,
  },
  {
    key: 'vitrin_7',
    grup: 'one_cikarma',
    ad: 'Ana sayfa vitrini · 7 gün',
    not: 'Ana sayfadaki vitrin alanında',
    tl: 299,
    mobil: 359.99,
    oneCikarma: { tur: 'vitrin', gun: 7 },
    hemenBaslar: true,
  },
];

export const PRODUCT_GROUP_NAMES: Record<ProductGroup, string> = {
  talep: 'Talep hakları',
  mesaj: 'Mesaj hakları (satıcı olarak yazarken)',
  one_cikarma: 'Öne çıkarma',
};

export const PROMOTION_NAMES: Record<PromotionKind, string> = {
  ust_sira: 'Üst sıra',
  acil: 'Acil arıyorum',
  vitrin: 'Ana sayfa vitrini',
};

export const productByKey = (key: string) => PRODUCTS.find((p) => p.key === key);

/** KDV dahil tutardan KDV (kuruş): %20 dahil tutarın 20/120'si */
export const vatOfGross = (kurus: number) => Math.round((kurus * VAT_RATE) / (100 + VAT_RATE));

export const ORDER_STATUSES = ['PENDING', 'PAID', 'FAILED', 'CANCELLED'] as const;
export type OrderStatusKey = (typeof ORDER_STATUSES)[number];
export const ORDER_STATUS_NAMES: Record<OrderStatusKey, string> = {
  PENDING: 'Ödeme bekleniyor',
  PAID: 'Ödendi',
  FAILED: 'Ödeme alınamadı',
  CANCELLED: 'İptal',
};

/** Ödeme onayları (Karar 39; Haklarim.dc.html) */
export const CONTRACT_CONSENT =
  'Ön Bilgilendirme Formu’nu ve Mesafeli Hizmet Sözleşmesi’ni okudum, onaylıyorum.';
export const WAIVER_CONSENT =
  'Öne çıkarma ve uzatma hizmetlerinin cayma süresi içinde hemen başlatılmasını talep ediyorum; hizmet başladığında bu kalemlerde cayma hakkımı kaybedeceğimi kabul ediyorum.';

const vkn = z.string().regex(/^\d{10,11}$/, 'Vergi no 10, T.C. kimlik no 11 hane olmalı');

export const billingSchema = z
  .object({
    ad: z.string().trim().min(3, 'Ad soyad en az 3 karakter').max(120),
    eposta: z.email('Geçerli bir e-posta yaz').max(100),
    il: z.string().trim().min(2).max(40),
    ilce: z.string().trim().min(2).max(60),
    /** Kurumsal fatura (Karar 31): vergi numarasıyla */
    kurumsal: z
      .object({
        unvan: z.string().trim().min(2).max(200),
        vergiNo: vkn,
        vergiDairesi: z.string().trim().min(2).max(80),
      })
      .strict()
      .optional(),
  })
  .strict();
export type Billing = z.infer<typeof billingSchema>;

export const orderCreateSchema = z
  .object({
    kalemler: z
      .array(
        z
          .object({
            urun: z.string().refine((k) => !!productByKey(k), 'Ürün bulunamadı'),
            /** Öne çıkarmada hangi talebe */
            talepNo: z.number().int().positive().optional(),
          })
          .strict(),
      )
      .min(1, 'Sepet boş')
      .max(20),
    fatura: billingSchema,
    /** Galeri adına ek paket (yalnızca galeri sahibi; fatura galerinin ticari bilgileriyle) */
    hesap: z.uuid().optional(),
    /** Kupon kodu (Karar 51): yalnızca web ödemesinde */
    kupon: couponCodeSchema.optional(),
    onay: z
      .object({
        sozlesme: z.literal(true, 'Sözleşme onayı gerekli'),
        cayma: z.boolean().optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((v, ctx) => {
    v.kalemler.forEach((k, i) => {
      const p = productByKey(k.urun);
      if (p?.oneCikarma && !k.talepNo && !v.hesap) {
        ctx.addIssue({
          code: 'custom',
          path: ['kalemler', i, 'talepNo'],
          message: 'Öne çıkarılacak talebi seç',
        });
      }
    });
    // Galeri (kurumsal) alımında öne çıkarma hak olarak alınır, talebe sonra uygulanır; tüketici cayma onayı aranmaz
    const hemen = !v.hesap && v.kalemler.some((k) => productByKey(k.urun)?.hemenBaslar);
    if (hemen && !v.onay.cayma) {
      ctx.addIssue({
        code: 'custom',
        path: ['onay', 'cayma'],
        message: 'Hemen başlayan hizmetler için ikinci onay gerekli',
      });
    }
  });
export type OrderCreate = z.infer<typeof orderCreateSchema>;

// ── Mağaza ödemeleri (Karar 38) ──────────────────────────────

/** Mağaza ürün kimliği: App Store Connect ve Google Play Console'da aynı adla tanımlanır (tüketilebilir ürün) */
export const storeProductId = (key: string) => `rr_${key}`;
export const productByStoreId = (id: string) => PRODUCTS.find((p) => storeProductId(p.key) === id);

/** Uygulamada satın almadan önce: hangi ürün, öne çıkarmada hangi talep (mağaza bildirimi bu kayda bağlanır) */
export const storeIntentSchema = z
  .object({
    urun: z.string().refine((k) => !!productByKey(k), 'Ürün bulunamadı'),
    talepNo: z.number().int().positive().optional(),
    platform: z.enum(['ios', 'android']),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (productByKey(v.urun)?.oneCikarma && !v.talepNo) {
      ctx.addIssue({ code: 'custom', path: ['talepNo'], message: 'Öne çıkarılacak talebi seç' });
    }
  });
export type StoreIntent = z.infer<typeof storeIntentSchema>;

/** HaklarimMobil.dc.html alt bilgisi; uygulamada web fiyatından söz edilmez */
export const STORE_NOTES = {
  ios: 'Ödeme Apple hesabınla alınır. İade talepleri Apple üzerinden yapılır. Satın aldığın haklar web sitesinde de geçerlidir.',
  android:
    'Ödeme Google Play hesabınla alınır. İade talepleri Google Play üzerinden yapılır. Satın aldığın haklar web sitesinde de geçerlidir.',
} as const;

/** "1.234,50 TL" */
export const tlYaz = (kurus: number) =>
  `${new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: kurus % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(kurus / 100)} TL`;
