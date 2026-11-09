import { z } from 'zod';

/**
 * Satıcı puanı ve rozetler (Karar 55). Alıcı yalnızca 1–5 yıldız verir, yorum yazılmaz. Puan içeride hesaplanır ve
 * alıcıya sayı olarak gösterilmez; alıcı yalnızca rozetleri görür. Eşikler başlangıç değerleridir; konsoldan
 * değiştirilmesi kurallar ve fiyatlar ekranıyla (Karar 47, 56) gelecek.
 */

/** Yıldız sohbetten sonraki bu kadar gün içinde verilir */
export const RATING_WINDOW_DAYS = 30;
/** Bu kadar günden yeni hesapların yıldızı hesaba katılmaz (manipülasyon, Karar 55) */
export const RATING_NEW_ACCOUNT_DAYS = 3;

export const RATING_LABELS = ['', 'Çok kötü', 'Kötü', 'İdare eder', 'İyi', 'Çok iyi'] as const;

export const ratingSchema = z.object({ yildiz: z.number().int().min(1).max(5) }).strict();

/** Hesaba katılmayan yıldızın nedeni (konsolda "Ajanın işaretledikleri") */
export const RATING_FLAGS = {
  yeni_hesap: 'Son 3 günde açılmış hesaptan',
  ayni_cihaz: 'Aynı cihaz ve ağdan birden çok hesaptan',
  bagli_hesap: 'Satıcıyla bağlantılı hesaptan',
  itiraz: 'Galerinin itirazı moderasyonda kabul edildi',
} as const;
export type RatingFlag = keyof typeof RATING_FLAGS;

/**
 * Galerinin 1 yıldıza itirazı (Karar 55): galeri sahibi ya da yöneticisi yıldızdan sonraki 30 gün içinde bir kez itiraz
 * eder; yıldızı verenin kimliği galeriye gösterilmez. Moderasyon sohbetin kanıtıyla 7 gün içinde inceler; kabulde yıldız
 * hesaba katılmaz (`itiraz` işareti), redde yıldız kalır. Sonuç galeriye bildirilir.
 */
export const RATING_APPEAL_DAYS = 30;
export const RATING_APPEAL_REVIEW_DAYS = 7;

export const BADGES = {
  onay: {
    ad: '✓ Onaylı galeri',
    bg: '#E7FAF0',
    renk: '#11683F',
    aciklama: 'Yetki belgesi, vergi levhası ve MERSİS doğrulandı',
  },
  hizli: {
    ad: '⚡ Hızlı yanıt',
    bg: '#FFEEF6',
    renk: '#A0256A',
    aciklama: 'Son 30 günde ortanca ilk yanıt 1 saatin altında',
  },
  guven: {
    ad: '★ Güvenilir satıcı',
    bg: '#FFF6DF',
    renk: '#7A5300',
    aciklama: 'Alıcı yıldızları yüksek, şikâyet oranı düşük',
  },
} as const;
export type BadgeKey = keyof typeof BADGES;

/** Rozet eşikleri (Karar 55) */
export const BADGE_RULES = {
  hizli: { ortancaDakika: 60, enAzSohbet: 10, gun: 30 },
  guven: { enAzYildiz: 10, enAzOrtalama: 4.5, sikayetOraniAlti: 0.01, gun: 90 },
} as const;

/** İç puanın bileşenleri ve ağırlıkları (YonetimPazar.dc.html › Satıcı puanı) */
export const SCORE_WEIGHTS = { yildiz: 40, yanit: 25, sikayet: 25, dogrulama: 10 } as const;
export const SCORE_NAMES: Record<keyof typeof SCORE_WEIGHTS, string> = {
  yildiz: 'Yıldız ortalaması',
  yanit: 'İlk yanıt süresi',
  sikayet: 'Şikâyet oranı',
  dogrulama: 'Doğrulama durumu',
};

export interface SellerFigures {
  /** Hesaba katılan yıldız sayısı ve ortalaması */
  yildizSayisi: number;
  yildizOrtalama: number | null;
  /** Son 30 günde alıcının yazdığı sohbet sayısı ve ortanca ilk yanıt (dakika; yanıtlanmayan sonsuz sayılır) */
  yanitSohbet: number;
  ortancaDakika: number | null;
  /** Son 90 günde şikâyet oranı (moderasyonla gelir; o zamana kadar 0) */
  sikayetOrani: number;
  onayliGaleri: boolean;
}

/** Rozetler (Karar 55): onaylı galeri, hızlı yanıt, güvenilir satıcı */
export function badgesOf(f: SellerFigures): BadgeKey[] {
  const out: BadgeKey[] = [];
  if (f.onayliGaleri) out.push('onay');
  const h = BADGE_RULES.hizli;
  if (f.yanitSohbet >= h.enAzSohbet && f.ortancaDakika !== null && f.ortancaDakika < h.ortancaDakika) {
    out.push('hizli');
  }
  const g = BADGE_RULES.guven;
  if (
    f.onayliGaleri &&
    f.yildizSayisi >= g.enAzYildiz &&
    (f.yildizOrtalama ?? 0) >= g.enAzOrtalama &&
    f.sikayetOrani < g.sikayetOraniAlti
  ) {
    out.push('guven');
  }
  return out;
}

const sinirla = (n: number) => Math.max(0, Math.min(1, n));

/** İç puan (0–100): bileşenlerin ağırlıklı ortalaması. Yalnızca konsol ve galerinin kendi panelinde görünür. */
export function sellerScore(f: SellerFigures): number {
  const yildiz = f.yildizOrtalama === null ? 0.5 : sinirla((f.yildizOrtalama - 1) / 4);
  // 1 saatin altı tam puan, 24 saat ve üstü sıfır; yanıt verisi yoksa orta
  const yanit = f.ortancaDakika === null ? 0.5 : sinirla(1 - (f.ortancaDakika - 60) / (24 * 60 - 60));
  const sikayet = sinirla(1 - f.sikayetOrani / 0.05);
  const dogrulama = f.onayliGaleri ? 1 : 0.5;
  const w = SCORE_WEIGHTS;
  const toplam = w.yildiz + w.yanit + w.sikayet + w.dogrulama;
  return Math.round(
    ((w.yildiz * yildiz + w.yanit * yanit + w.sikayet * sikayet + w.dogrulama * dogrulama) / toplam) * 100,
  );
}

/** Galeri paneli: "rozete ne kadar kaldı" (Karar 55) */
export function badgeProgress(f: SellerFigures): { rozet: BadgeKey; var: boolean; eksik: string[] }[] {
  const has = new Set(badgesOf(f));
  const h = BADGE_RULES.hizli;
  const g = BADGE_RULES.guven;
  const hizliEksik: string[] = [];
  if (f.yanitSohbet < h.enAzSohbet)
    hizliEksik.push(`son 30 günde ${h.enAzSohbet - f.yanitSohbet} sohbet daha`);
  if (f.ortancaDakika === null || f.ortancaDakika >= h.ortancaDakika) {
    hizliEksik.push('ortanca ilk yanıtın 1 saatin altına inmeli');
  }
  const guvenEksik: string[] = [];
  if (!f.onayliGaleri) guvenEksik.push('onaylı galeri olmalı');
  if (f.yildizSayisi < g.enAzYildiz) guvenEksik.push(`${g.enAzYildiz - f.yildizSayisi} yıldız daha`);
  if (f.yildizSayisi > 0 && (f.yildizOrtalama ?? 0) < g.enAzOrtalama) {
    guvenEksik.push('yıldız ortalaman 4,5 ve üstü olmalı');
  }
  if (f.sikayetOrani >= g.sikayetOraniAlti) guvenEksik.push('şikâyet oranın %1’in altına inmeli');
  return [
    { rozet: 'onay', var: has.has('onay'), eksik: has.has('onay') ? [] : ['galeri doğrulaması'] },
    { rozet: 'hizli', var: has.has('hizli'), eksik: has.has('hizli') ? [] : hizliEksik },
    { rozet: 'guven', var: has.has('guven'), eksik: has.has('guven') ? [] : guvenEksik },
  ];
}

/** Ortanca */
export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** Çalışan başına günlük ilk mesaj sınırı (Karar 20); null: sınır yok */
export const memberLimitSchema = z
  .object({ gunlukSinir: z.number().int().min(1).max(1000).nullable() })
  .strict();
