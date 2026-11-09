import { z } from 'zod';
import { PRODUCTS } from './payments.js';

/**
 * Fiyat deneyleri (Karar 44, 56; YonetimRapor.dc.html › deney: "Ek ilk mesaj (10 adet) fiyatı: 99 TL mi, 119 TL mi?").
 * Yalnızca web'deki ürün fiyatı ve yalnızca bireysel kullanıcılar: kullanıcı kimliğinden sabit kol (`armOf`), B koluna
 * deneme fiyatı, A koluna fiyat listesindeki fiyat. Kullanıcı sihirbazda, Haklarım'da ve ödemede hep aynı fiyatı görür.
 * Deney sahibin onayıyla açılır (PRICE_CHANGE, `price_experiment`); ölçü fiyatı gören kullanıcı başına web geliridir.
 * Kazanan fiyat yine sahip onaylı bir fiyat değişikliği olarak önerilir. Mağaza (mobil) fiyatları değişmez; galeri
 * hesabıyla alımda liste fiyatı geçerlidir.
 */

/** B fiyatı liste fiyatından en çok bu oranda farklı olabilir */
export const PRICE_EXP_MAX_FARK = 0.5;
export const PRICE_EXP_GUN = { min: 7, max: 60 } as const;

export const priceExperimentSchema = z
  .object({
    ad: z.string().trim().min(5).max(120),
    urun: z.string().refine((k) => PRODUCTS.some((p) => p.key === k), 'Ürün bulunamadı'),
    /** B kolunun fiyatı (TL, KDV dahil, en çok 2 basamak kuruş) */
    fiyatB: z
      .number()
      .positive()
      .max(100_000)
      .refine((x) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6, 'Kuruş en çok iki basamak'),
    gun: z.number().int().min(PRICE_EXP_GUN.min).max(PRICE_EXP_GUN.max),
  })
  .strict();
export type PriceExperimentInput = z.output<typeof priceExperimentSchema>;

export type PriceExperimentStatus = 'onay_bekliyor' | 'reddedildi' | 'suruyor' | 'bitti' | 'durduruldu';
export const PRICE_EXP_STATUS_NAMES: Record<PriceExperimentStatus, string> = {
  onay_bekliyor: 'Sahibin onayını bekliyor',
  reddedildi: 'Reddedildi',
  suruyor: 'Sürüyor',
  bitti: 'Bitti',
  durduruldu: 'Durduruldu',
};

/** B fiyatı liste fiyatına göre kabul edilebilir mi */
export function priceExperimentCheck(listeTl: number, fiyatB: number): string | null {
  if (Math.round(fiyatB * 100) === Math.round(listeTl * 100)) return 'B fiyatı liste fiyatıyla aynı';
  if (Math.abs(fiyatB - listeTl) / listeTl > PRICE_EXP_MAX_FARK)
    return `B fiyatı liste fiyatından en çok %${PRICE_EXP_MAX_FARK * 100} farklı olabilir`;
  return null;
}
