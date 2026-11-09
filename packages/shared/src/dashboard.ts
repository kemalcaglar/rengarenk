import { z } from 'zod';

/**
 * Kontrol paneli ve hedefler (Karar 44; YonetimRapor.dc.html › panel). Ana ölçü: talebine 48 saat içinde en az bir
 * satıcının yazdığı talep oranı. Ölçüler bugün, son 7 ve son 30 gün; önceki eşit dönemle karşılaştırılır. Aylık hedefler
 * girilir; ilerleme ayın geçen kısmıyla karşılaştırılır, sapma %10'u geçerse çalışanlara uyarı gider.
 */

export const DASH_PERIODS = [
  { key: 'bugun', ad: 'Bugün', karsi: 'düne göre' },
  { key: 'hafta', ad: 'Son 7 gün', karsi: 'önceki 7 güne göre' },
  { key: 'ay', ad: 'Son 30 gün', karsi: 'önceki 30 güne göre' },
] as const;
export type DashPeriod = (typeof DASH_PERIODS)[number]['key'];

export const DASH_METRICS = [
  { key: 'talep', ad: 'Yeni talep', birim: '' },
  { key: 'mesaj', ad: 'İlk mesaj', birim: '' },
  { key: 'sohbet', ad: 'Açılan sohbet', birim: '' },
  { key: 'buldum', ad: 'Aracı buldum', birim: '' },
  { key: 'gelir', ad: 'Gelir', birim: '₺' },
  { key: 'galeri', ad: 'Yeni ücretli galeri', birim: '' },
] as const;
export type DashMetric = (typeof DASH_METRICS)[number]['key'];

/** Ana ölçü penceresi: talep yayınlandıktan sonra bu kadar saat içinde ilk mesaj */
export const MAIN_METRIC_HOURS = 48;

export const GOAL_KEYS = [
  { key: 'talep', ad: 'Yeni talep', birim: '' },
  { key: 'buldum', ad: 'Aracı buldum', birim: '' },
  { key: 'gelir', ad: 'Gelir', birim: '₺' },
  { key: 'ucretli_galeri', ad: 'Ücretli galeri (toplam)', birim: '' },
  { key: 'ana_olcu', ad: 'Ana ölçü', birim: '%' },
] as const;
export type GoalKey = (typeof GOAL_KEYS)[number]['key'];

export const goalsSchema = z
  .object({
    ay: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    hedefler: z
      .object(
        Object.fromEntries(GOAL_KEYS.map((g) => [g.key, z.number().min(0).max(1e12).optional()])) as Record<
          GoalKey,
          z.ZodOptional<z.ZodNumber>
        >,
      )
      .strict(),
  })
  .strict()
  .refine((v) => v.hedefler.ana_olcu === undefined || v.hedefler.ana_olcu <= 100, {
    message: 'Ana ölçü hedefi en çok %100',
    path: ['hedefler', 'ana_olcu'],
  });

export const chartNoteSchema = z
  .object({
    gun: z.iso.date(),
    metin: z.string().trim().min(3).max(80),
  })
  .strict();

/** Hedef sapması bu oranı geçerse uyarı (Karar 44) */
export const GOAL_DEVIATION = 0.1;

export type GoalState = 'yolunda' | 'yakin' | 'geride';
export const GOAL_STATES: Record<GoalState, { ad: string; bg: string; fg: string }> = {
  yolunda: { ad: '● Yolunda', bg: '#E7FAF0', fg: '#11683F' },
  yakin: { ad: '◆ Yakın', bg: '#FFF6DF', fg: '#7A5300' },
  geride: { ad: '▲ Geride', bg: '#FFF6DF', fg: '#7A5300' },
};

/**
 * Hedefin durumu. Aylık birikenlerde (talep, buldum, gelir) ilerleme ayın geçen kısmıyla karşılaştırılır; ücretli galeri
 * ay başındaki sayıdan hedefe ilerlemeyle; ana ölçü doğrudan hedefle (3 puan içi "yakın").
 */
export function goalStatus(
  key: GoalKey,
  mevcut: number,
  hedef: number,
  gecen: number,
  ayBasi = 0,
): { durum: GoalState; ilerleme: number; beklenen: number; sapma: number } {
  if (key === 'ana_olcu') {
    const fark = hedef - mevcut;
    return {
      durum: fark <= 0 ? 'yolunda' : fark <= 3 ? 'yakin' : 'geride',
      ilerleme: hedef ? Math.min(1, mevcut / hedef) : 1,
      beklenen: 1,
      sapma: hedef ? Math.max(0, fark / hedef) : 0,
    };
  }
  const ilerleme =
    key === 'ucretli_galeri'
      ? hedef > ayBasi
        ? Math.max(0, (mevcut - ayBasi) / (hedef - ayBasi))
        : 1
      : hedef
        ? mevcut / hedef
        : 1;
  const beklenen = Math.min(1, Math.max(0, gecen));
  // Ayın başında (beklenen çok küçükken) sapma ölçülmez
  const sapma = beklenen > 0.05 ? Math.max(0, (beklenen - ilerleme) / beklenen) : 0;
  return { durum: sapma <= GOAL_DEVIATION ? 'yolunda' : 'geride', ilerleme, beklenen, sapma };
}

/** "▲ %12" / "▼ %5" / "—": önceki döneme göre değişim */
export function changeText(simdi: number, once: number) {
  if (!once) return simdi ? { metin: 'yeni', artis: true } : { metin: '—', artis: true };
  const p = Math.round(((simdi - once) / once) * 100);
  return { metin: `${p >= 0 ? '▲' : '▼'} %${Math.abs(p)}`, artis: p >= 0 };
}
