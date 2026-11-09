import { z } from 'zod';
import { GALLERY_PLANS } from './gallery.js';
import { VAT_RATE } from './payments.js';
import type { PlanTable } from './pricing.js';

/**
 * Galeri abonelikleri (Karar 12.2, 12.3, 12.7, 38, 39; Teknik tasarım §7). Yalnızca web'den, PayTR ile; ilk ödemede kart
 * ödeme kuruluşunda saklanır, sonraki dönemler saklanan karttan tahsil edilir. Fiyatlar KDV hariçtir; faturaya %20 KDV
 * eklenir. Başarısız yenileme 3 gün içinde yeniden denenir, olmazsa abonelik askıya alınır ve galeri yalnızca portföyünü
 * görüntüler. İptal dönem sonunda geçerli olur, kısmi iade yapılmaz.
 */

export type PaidPlan = keyof typeof GALLERY_PLANS;
export const PAID_PLANS = ['baslangic', 'profesyonel', 'kurumsal'] as const satisfies readonly PaidPlan[];

export const SUB_PERIODS = {
  aylik: { ad: 'Aylık', ay: 1 },
  yillik: { ad: 'Yıllık', ay: 12 },
} as const;
export type SubPeriod = keyof typeof SUB_PERIODS;
export const SUB_PERIOD_KEYS = ['aylik', 'yillik'] as const satisfies readonly SubPeriod[];

/** Başarısız yenileme günde bir, en çok bu kadar gün yeniden denenir */
export const SUB_RETRY_DAYS = 3;
/** Yenileme hatırlatması: aylıkta 7, yıllıkta 30 gün önce (Karar 39) */
export const SUB_REMINDER_DAYS: Record<SubPeriod, number> = { aylik: 7, yillik: 30 };

export const SUB_STATUSES = ['ACTIVE', 'PAST_DUE', 'ENDED'] as const;
export type SubStatusKey = (typeof SUB_STATUSES)[number];
export const SUB_STATUS_NAMES: Record<SubStatusKey, string> = {
  ACTIVE: 'Etkin',
  PAST_DUE: 'Ödeme bekleniyor',
  ENDED: 'Sona erdi',
};

/** Paketin dönem fiyatı, KDV hariç (kuruş) */
export const planNetKurus = (plan: PaidPlan, donem: SubPeriod, plans: PlanTable = GALLERY_PLANS) =>
  plans[plan][donem === 'aylik' ? 'aylik' : 'yillik'] * 100;
/** KDV hariç tutara KDV ekler */
export const withVat = (netKurus: number) => Math.round((netKurus * (100 + VAT_RATE)) / 100);

export const planRank = (plan: string) => PAID_PLANS.indexOf(plan as PaidPlan);

/** Takvim ayı ekler; ayın son günü taşarsa ayın son gününe çeker (31 Ocak + 1 ay = 28/29 Şubat) */
export function addMonths(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  const gun = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + n);
  const son = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(gun, son));
  return r;
}

/**
 * Dönem içinde üst pakete geçişte alınacak fark (KDV hariç, kuruş): yeni ve eski fiyat farkının kalan süreye düşen
 * kısmı. Eski paketin kalan süresi iade edilmez, farka mahsup edilir.
 */
export function prorateKurus(oldNet: number, newNet: number, start: Date, end: Date, now: Date): number {
  const toplam = end.getTime() - start.getTime();
  const kalan = Math.max(0, Math.min(toplam, end.getTime() - now.getTime()));
  if (toplam <= 0 || newNet <= oldNet) return 0;
  return Math.round(((newNet - oldNet) * kalan) / toplam);
}

/** Abonelik onayları (Karar 39): sözleşme ve otomatik yenileme ayrı ayrı işaretlenir */
export const SUBSCRIPTION_CONSENT = 'Galeri Hizmet Sözleşmesi’ni ve ön bilgilendirmeyi okudum, onaylıyorum.';
export const RENEWAL_CONSENT =
  'Aboneliğimin her dönem sonunda kayıtlı kartımdan otomatik yenilenmesini kabul ediyorum. Dilediğim zaman iptal edebilirim; iptal dönem sonunda geçerli olur ve kalan süre için iade yapılmaz.';

const onaylar = z
  .object({
    sozlesme: z.literal(true, 'Sözleşme onayı gerekli'),
    yenileme: z.literal(true, 'Otomatik yenileme onayı gerekli'),
  })
  .strict();

/** Paket satın alma ya da üst pakete geçiş: ödeme sayfası açılır */
export const subscriptionCheckoutSchema = z
  .object({
    plan: z.enum(PAID_PLANS),
    donem: z.enum(SUB_PERIOD_KEYS),
    eposta: z.email('Fatura için geçerli bir e-posta yaz').max(100),
    onay: onaylar,
  })
  .strict();
export type SubscriptionCheckout = z.infer<typeof subscriptionCheckoutSchema>;

/** Sonraki dönem için alt pakete ya da başka ödeme dönemine geçiş (ödeme yenilemede) */
export const subscriptionScheduleSchema = z
  .object({ plan: z.enum(PAID_PLANS), donem: z.enum(SUB_PERIOD_KEYS) })
  .strict();

/** Bekleyen yenilemeyi şimdi öde (ödeme alınamadıysa): yeni kart kaydedilir */
export const subscriptionPaySchema = z
  .object({ eposta: z.email('Fatura için geçerli bir e-posta yaz').max(100), onay: onaylar })
  .strict();

/** Dönem sonunda iptal ya da iptali geri alma */
export const subscriptionCancelSchema = z.object({ iptal: z.boolean() }).strict();

export type PlanChange = 'yeni' | 'yukseltme' | 'sonraki_donem' | 'ayni';

/**
 * Seçilen paketin nasıl uygulanacağı: abonelik yoksa yeni; aynı dönemde üst paket hemen (fark ödenir); alt paket ya da
 * ödeme dönemi değişikliği sonraki dönemde.
 */
export function planChangeKind(
  cur: { plan: string; donem: SubPeriod; etkin: boolean } | null,
  next: { plan: PaidPlan; donem: SubPeriod },
): PlanChange {
  if (!cur?.etkin) return 'yeni';
  if (cur.plan === next.plan && cur.donem === next.donem) return 'ayni';
  if (cur.donem === next.donem && planRank(next.plan) > planRank(cur.plan)) return 'yukseltme';
  return 'sonraki_donem';
}
