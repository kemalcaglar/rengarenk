import type { PaidPlan, SubPeriod } from '@rengarenk/shared';

/** Sipariş kalemi (orders.items). Tutarlar KDV dahil kuruş; galeride KDV hariç tutar ayrıca `netKurus`. */
export interface Kalem {
  urun: string;
  ad: string;
  adet: number;
  birimKurus: number;
  tutarKurus: number;
  netKurus?: number;
  talepId?: string;
  talepNo?: number;
  talepBaslik?: string;
  /** Abonelik kalemi (Karar 12.2) */
  plan?: PaidPlan;
  donem?: SubPeriod;
  /** Kupon indirimi (tutarKurus indirimli; abonelikte netKurus liste fiyatı kalır, yenileme tam fiyat) */
  indirimKurus?: number;
  kupon?: string;
}

export const kalemler = (items: unknown) => items as Kalem[];
