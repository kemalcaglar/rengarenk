import { z } from 'zod';

/**
 * Kuponlar (Karar 40, 51, 56; Teknik tasarım: kupon dört göz onayıyla). Pazarlama kuponu hazırlar; sahip ya da yönetici
 * onaylar, en yüksek indirimin (%50) üstünü yalnızca sahip onaylar. Kupon web ödemesinde kodla kullanılır: seçilen ürün
 * gruplarına yüzde indirim, hesap başına bir kez, isteğe bağlı toplam kullanım sınırı. Galeri paketinde yalnızca ilk
 * ödemeye uygulanır (yenileme tam fiyat). Uygulama içi (mağaza) satın almalarda kupon yoktur; fiyatı mağaza belirler.
 */

/** Kupon en yüksek indirim yüzdesi; üstünü yalnızca sahip onaylar (Kurallar ve fiyatlar) */
export const COUPON_MAX_PERCENT = 50;

/** Kuponun uygulanabildiği ürün grupları */
export const COUPON_TARGETS = {
  ust_sira: { ad: 'Üst sıra', urunler: ['ust_sira_7', 'ust_sira_30'] },
  acil: { ad: 'Acil arıyorum', urunler: ['acil_7'] },
  vitrin: { ad: 'Ana sayfa vitrini', urunler: ['vitrin_7'] },
  talep: { ad: 'Ek talep ve uzatma', urunler: ['ek_talep', 'talep_paketi', 'uzatma'] },
  mesaj: { ad: 'Ek ilk mesaj', urunler: ['mesaj_10', 'mesaj_30'] },
  abonelik: { ad: 'Galeri paketi (ilk ödeme)', urunler: ['abonelik'] },
} as const;
export type CouponTarget = keyof typeof COUPON_TARGETS;
export const COUPON_TARGET_KEYS = Object.keys(COUPON_TARGETS) as CouponTarget[];

export const COUPON_AUDIENCES = { herkes: 'Herkes', bireysel: 'Bireysel üye', galeri: 'Galeri' } as const;
export type CouponAudience = keyof typeof COUPON_AUDIENCES;

/** Ürünün kupon grubu */
export const couponTargetOf = (urun: string): CouponTarget | undefined =>
  COUPON_TARGET_KEYS.find((k) => (COUPON_TARGETS[k].urunler as readonly string[]).includes(urun));

export const couponCodeSchema = z
  .string()
  .trim()
  .transform((s) => s.toLocaleUpperCase('tr-TR').replace(/İ/g, 'I'))
  .pipe(z.string().regex(/^[A-Z0-9]{4,16}$/, 'Kupon kodu 4–16 harf ve rakam olmalı'));

export const couponSchema = z
  .object({
    kod: couponCodeSchema,
    ad: z.string().trim().min(3).max(60),
    yuzde: z.number().int().min(1).max(100),
    hedefler: z
      .array(z.enum(COUPON_TARGET_KEYS as [CouponTarget, ...CouponTarget[]]))
      .min(1, 'En az bir ürün grubu seç'),
    kitle: z.enum(Object.keys(COUPON_AUDIENCES) as [CouponAudience, ...CouponAudience[]]),
    baslangic: z.iso.datetime({ offset: true }),
    bitis: z.iso.datetime({ offset: true }),
    toplamSinir: z.number().int().min(1).max(1_000_000).nullable().default(null),
  })
  .strict()
  .refine((c) => new Date(c.bitis) > new Date(c.baslangic), {
    message: 'Bitiş başlangıçtan sonra olmalı',
    path: ['bitis'],
  })
  .refine((c) => !c.hedefler.includes('abonelik') || c.kitle !== 'bireysel', {
    message: 'Galeri paketi kuponu bireysel kitleye verilemez',
    path: ['kitle'],
  });
export type CouponInput = z.output<typeof couponSchema>;

/** Kullanıcının ödemede girdiği kod: ürünler (ve galeri adına alımda hesap) için önizleme */
export const couponCheckSchema = z
  .object({
    kod: couponCodeSchema,
    urunler: z.array(z.string()).min(1).max(20),
    hesap: z.uuid().optional(),
    /** Galeri paketi önizlemesinde paket ve ödeme dönemi */
    plan: z.enum(['baslangic', 'profesyonel', 'kurumsal']).optional(),
    donem: z.enum(['aylik', 'yillik']).optional(),
  })
  .strict();

/** Sahibin onayını gerektiren indirim (en yüksek indirimin üstü) */
export const couponNeedsOwner = (yuzde: number) => yuzde > COUPON_MAX_PERCENT;

/** Kalem indirimi (kuruş, aşağı yuvarlanır: kullanıcı aleyhine kuruş farkı olmaz) */
export const couponDiscount = (tutarKurus: number, yuzde: number) => Math.floor((tutarKurus * yuzde) / 100);

export type CouponStatus =
  | 'onay_bekliyor'
  | 'reddedildi'
  | 'zamanlandi'
  | 'aktif'
  | 'tukendi'
  | 'bitti'
  | 'iptal';
export const COUPON_STATUSES: Record<CouponStatus, { ad: string; bg: string; fg: string }> = {
  onay_bekliyor: { ad: 'Onay bekliyor', bg: '#FFF6DF', fg: '#7A5300' },
  reddedildi: { ad: 'Onaylanmadı', bg: '#FDECEC', fg: '#A3271F' },
  zamanlandi: { ad: 'Zamanlandı', bg: '#EEF3FF', fg: '#2450C8' },
  aktif: { ad: 'Geçerli', bg: '#E7FAF0', fg: '#11683F' },
  tukendi: { ad: 'Tükendi', bg: '#F3F5FA', fg: '#5A6073' },
  bitti: { ad: 'Süresi bitti', bg: '#F3F5FA', fg: '#5A6073' },
  iptal: { ad: 'İptal edildi', bg: '#F3F5FA', fg: '#5A6073' },
};

/** Kuponun durumu: kayıt durumu (onay), onayın sonucu, tarih ve kullanım sınırı */
export function couponStatus(
  c: { status: string; startsAt: Date; endsAt: Date; maxUses: number | null },
  onay: string | null,
  kullanim: number,
  now = new Date(),
): CouponStatus {
  if (c.status === 'iptal') return 'iptal';
  if (c.status === 'onay_bekliyor')
    return onay && onay !== 'PENDING' && onay !== 'APPROVED' ? 'reddedildi' : 'onay_bekliyor';
  if (now >= c.endsAt) return 'bitti';
  if (c.maxUses !== null && kullanim >= c.maxUses) return 'tukendi';
  if (now < c.startsAt) return 'zamanlandi';
  return 'aktif';
}
