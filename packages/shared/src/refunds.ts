import { z } from 'zod';

/**
 * İadeler (Karar 39, 40; Teknik tasarım §7). İadeyi Finans ya da Destek önerir, sistem tutarı önerir, yalnızca Sahip
 * onaylar (onaylarken tutarı düşürebilir, ödenenden fazla olamaz). Onaylanan iadeyi yalnızca ayrı "iade yürütücü"
 * süreci yapar; o siparişten kalan kullanılmamış hak düşer, süren öne çıkarma biter. Mağaza satışlarının iadesi
 * App Store ve Google Play üzerinden yapılır.
 */

/** Cayma süresi: kullanılmayan hak bu süre içinde tam, kısmen kullanılan kalan kısım oranlı iade edilir */
export const REFUND_WINDOW_DAYS = 14;

export const refundRequestSchema = z
  .object({
    siparis: z.uuid(),
    tutarKurus: z.number().int().positive('İade tutarı sıfırdan büyük olmalı'),
    neden: z.string().trim().min(10, 'Gerekçe en az 10 karakter').max(500),
  })
  .strict();
export type RefundRequest = z.infer<typeof refundRequestSchema>;

export const REFUND_STATUS_NAMES = {
  PENDING_EXECUTION: 'Yürütülüyor',
  EXECUTED: 'İade edildi',
  FAILED: 'İade başarısız',
} as const;
