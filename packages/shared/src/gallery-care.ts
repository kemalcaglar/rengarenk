import { z } from 'zod';

/**
 * Galeri müşteri yönetimi (Karar 43 ek başlık: sorumlu çalışan, notlar, yenileme takibi, ayrılma riski). Ayrılma riski
 * kurallarla hesaplanır; her sinyalin ağırlığı ve gerekçesi konsolda görünür. Eşikler başlangıç değerleridir.
 */

export interface CareFigures {
  /** deneme | baslangic | profesyonel | kurumsal | pasif */
  plan: string;
  trialEndsAt: Date | null;
  /** Aboneliğin durumu: yoksa null */
  abonelik: { status: 'ACTIVE' | 'PAST_DUE' | 'ENDED'; cancelAtPeriodEnd: boolean; periodEnd: Date } | null;
  /** Galerinin gönderdiği ilk mesajlar: son 30 gün ve önceki 30 gün */
  ilkMesaj30: number;
  ilkMesajOnceki30: number;
  /** Ekipten son giriş (cihazın son görülmesi) */
  sonGiris: Date | null;
  /** Yayındaki portföy aracı */
  portfoy: number;
}

export const CARE_SIGNALS = {
  odeme_alinamadi: { agirlik: 40, ad: 'Yenileme ödemesi alınamadı' },
  paket_bitti: { agirlik: 45, ad: 'Paketi sona erdi' },
  yenileme_kapali: { agirlik: 30, ad: 'Otomatik yenilemeyi kapattı' },
  deneme_bitiyor: { agirlik: 25, ad: 'Denemesi 7 gün içinde bitiyor' },
  deneme_mesajsiz: { agirlik: 20, ad: 'Denemede hiç ilk mesaj göndermedi' },
  sessiz: { agirlik: 25, ad: '14 gündür giriş yok' },
  mesaj_dususu: { agirlik: 20, ad: 'İlk mesajları önceki aya göre yarıdan fazla düştü' },
  portfoy_bos: { agirlik: 15, ad: 'Yayında aracı yok' },
} as const;
export type CareSignal = keyof typeof CARE_SIGNALS;

export const CARE_LEVELS = {
  yuksek: { ad: 'Yüksek', bg: '#FDECEC', fg: '#A3271F', esik: 50 },
  orta: { ad: 'Orta', bg: '#FFF6DF', fg: '#7A5300', esik: 25 },
  dusuk: { ad: 'Düşük', bg: '#E7FAF0', fg: '#11683F', esik: 0 },
} as const;
export type CareLevel = keyof typeof CARE_LEVELS;

const DAY = 86_400_000;

/** Ayrılma riski: 0–100 puan, düzey ve gerekçeler (ağırlığa göre) */
export function churnRisk(f: CareFigures, now = new Date()) {
  const s: CareSignal[] = [];
  const deneme = f.plan === 'deneme';
  if (f.abonelik?.status === 'PAST_DUE') s.push('odeme_alinamadi');
  if (
    f.plan === 'pasif' ||
    f.abonelik?.status === 'ENDED' ||
    (deneme && f.trialEndsAt && f.trialEndsAt <= now)
  )
    s.push('paket_bitti');
  if (f.abonelik?.status === 'ACTIVE' && f.abonelik.cancelAtPeriodEnd) s.push('yenileme_kapali');
  if (deneme && f.trialEndsAt && f.trialEndsAt > now && f.trialEndsAt.getTime() - now.getTime() <= 7 * DAY) {
    s.push('deneme_bitiyor');
  }
  if (deneme && f.ilkMesaj30 === 0) s.push('deneme_mesajsiz');
  if (!f.sonGiris || now.getTime() - f.sonGiris.getTime() >= 14 * DAY) s.push('sessiz');
  if (f.ilkMesajOnceki30 >= 5 && f.ilkMesaj30 < f.ilkMesajOnceki30 / 2) s.push('mesaj_dususu');
  if (f.portfoy === 0) s.push('portfoy_bos');
  const sirali = s.sort((a, b) => CARE_SIGNALS[b].agirlik - CARE_SIGNALS[a].agirlik);
  const puan = Math.min(
    100,
    sirali.reduce((t, k) => t + CARE_SIGNALS[k].agirlik, 0),
  );
  const duzey: CareLevel =
    puan >= CARE_LEVELS.yuksek.esik ? 'yuksek' : puan >= CARE_LEVELS.orta.esik ? 'orta' : 'dusuk';
  return { puan, duzey, sinyaller: sirali };
}

/** Yenileme: bir sonraki önemli tarih ve ne olacağı */
export function renewalOf(f: Pick<CareFigures, 'plan' | 'trialEndsAt' | 'abonelik'>) {
  if (f.plan === 'deneme' && f.trialEndsAt) return { tarih: f.trialEndsAt, ne: 'Deneme bitişi' };
  if (!f.abonelik || f.abonelik.status === 'ENDED') return null;
  if (f.abonelik.cancelAtPeriodEnd) return { tarih: f.abonelik.periodEnd, ne: 'Paket sona eriyor' };
  if (f.abonelik.status === 'PAST_DUE') return { tarih: f.abonelik.periodEnd, ne: 'Ödeme yeniden deneniyor' };
  return { tarih: f.abonelik.periodEnd, ne: 'Otomatik yenileme' };
}

export const CARE_FILTERS = [
  ['hepsi', 'Hepsi'],
  ['benim', 'Sorumlu olduklarım'],
  ['riskli', 'Riski yüksek'],
  ['yenileme', '30 gün içinde yenileme'],
  ['sorumsuz', 'Sorumlusu yok'],
] as const;
export type CareFilter = (typeof CARE_FILTERS)[number][0];

export const careAssignSchema = z.object({ calisan: z.uuid().nullable() }).strict();
