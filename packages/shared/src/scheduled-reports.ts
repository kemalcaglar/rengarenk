import { z } from 'zod';
import { REPORT_TABS, type ReportTab } from './reports.js';
import type { BuiltinRole } from './staff.js';
import { ekle } from './tr-ek.js';

/**
 * Zamanlanmış raporlar (Karar 44; YonetimRapor.dc.html › zaman). Haftalık ve aylık rapor çalışanların şirket
 * e-postasına PDF ekiyle gider (aylıkta dışa aktarma yetkisi olana ayrıca Excel); "Yeni zamanlanmış rapor" ile bir rapor
 * sekmesi ya da kayıtlı pano seçilen sıklık ve saatte gönderilir. Alıcılar yalnızca raporları görebilen çalışanlardır;
 * rapor kişisel veri taşımaz (e-posta Google Workspace'e gider, Karar 37).
 *
 * Galerilere "aranan modeller" raporu her ayın 3'ünde ücretli galerilere bildirim katmanından gider (galeri konusu,
 * kişi ayarından kapatılabilir). Açmak toplu gönderim onayı (BULK_SEND) ister; kapatmak hemen olur.
 */

/** Sıklık: her gün, haftanın bir günü (1 pazartesi … 7 pazar) ya da ayın bir günü (1–28) */
export type ReportFrequency = 'gun' | `hafta:${number}` | `ay:${number}`;

const HAFTA = ['pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi', 'pazar'] as const;

export const REPORT_FREQUENCIES: { key: ReportFrequency; ad: string }[] = [
  { key: 'gun', ad: 'Her gün' },
  ...HAFTA.map((g, i) => ({ key: `hafta:${i + 1}` as ReportFrequency, ad: `Her ${g}` })),
  { key: 'ay:1', ad: 'Her ayın 1’i' },
];

const frequencySchema = z
  .string()
  .regex(/^(gun|hafta:[1-7]|ay:([1-9]|1\d|2[0-8]))$/, 'Sıklık geçersiz') as z.ZodType<ReportFrequency>;

/** "Her pazartesi 09.30" */
export function scheduleText(siklik: ReportFrequency, saat: string) {
  const s = saat.replace(':', '.');
  if (siklik === 'gun') return `Her gün ${s}`;
  const [tur, n] = siklik.split(':') as [string, string];
  if (tur === 'hafta') return `Her ${HAFTA[Number(n) - 1]} ${s}`;
  return `Her ayın ${ekle(Number(n), 'iyelik')} ${s}`;
}

const TR_MS = 3 * 3_600_000;
const DAY = 24 * 3_600_000;

/** Türkiye saatinde (UTC+3, yaz saati yok) gün parçaları */
function trParcalar(t: number) {
  const d = new Date(t + TR_MS);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    g: d.getUTCDate(),
    hafta: ((d.getUTCDay() + 6) % 7) + 1,
  };
}

function uyar(siklik: ReportFrequency, p: { g: number; hafta: number }) {
  if (siklik === 'gun') return true;
  const [tur, n] = siklik.split(':') as [string, string];
  return tur === 'hafta' ? p.hafta === Number(n) : p.g === Number(n);
}

function slotOf(p: { y: number; m: number; g: number }, saat: string) {
  const [hh, mm] = saat.split(':').map(Number) as [number, number];
  return new Date(Date.UTC(p.y, p.m, p.g, hh, mm) - TR_MS);
}

/** Şu andan önceki (ya da şu andaki) son gönderim zamanı */
export function lastSlot(siklik: ReportFrequency, saat: string, now = new Date()): Date {
  for (let i = 0; i <= 62; i++) {
    const p = trParcalar(now.getTime() - i * DAY);
    if (!uyar(siklik, p)) continue;
    const s = slotOf(p, saat);
    if (s.getTime() <= now.getTime()) return s;
  }
  return new Date(0);
}

/** Şu andan sonraki ilk gönderim zamanı */
export function nextSlot(siklik: ReportFrequency, saat: string, now = new Date()): Date {
  for (let i = 0; i <= 62; i++) {
    const p = trParcalar(now.getTime() + i * DAY);
    if (!uyar(siklik, p)) continue;
    const s = slotOf(p, saat);
    if (s.getTime() > now.getTime()) return s;
  }
  return new Date(now.getTime() + DAY);
}

/** Hazır raporlar: alıcıları role göre (raporları görebilenler), galeri raporu ücretli galerilere */
export interface BuiltinReport {
  ad: string;
  siklik: ReportFrequency;
  saat: string;
  bicim: string;
  /** Çalışan raporunun alıcı rolleri; boşsa galeri raporu */
  roller: BuiltinRole[];
  varsayilan: boolean;
}

export const BUILTIN_REPORTS = {
  haftalik: {
    ad: 'Haftalık rapor',
    siklik: 'hafta:1',
    saat: '09:30',
    bicim: 'E-posta (PDF) · huni, hedefler, reklam, deneyler',
    roller: ['OWNER', 'ADMIN', 'MARKETING'],
    varsayilan: true,
  },
  aylik: {
    ad: 'Aylık rapor',
    siklik: 'ay:1',
    saat: '10:00',
    bicim: 'E-posta (PDF ve Excel) · gelir, birim ekonomisi, kohortlar',
    roller: ['OWNER', 'FINANCE'],
    varsayilan: true,
  },
  galeri: {
    ad: 'Galerilere “aranan modeller” raporu',
    siklik: 'ay:3',
    saat: '10:00',
    bicim: 'E-posta ve bildirim · ajan önerisi; açılınca toplu gönderim kuralı geçerli, onay ister',
    roller: [],
    varsayilan: false,
  },
} as const satisfies Record<string, BuiltinReport>;
export type BuiltinReportKey = keyof typeof BUILTIN_REPORTS;
export const BUILTIN_REPORT_KEYS = Object.keys(BUILTIN_REPORTS) as BuiltinReportKey[];

/** Zamanlanmış raporun kaynağı: rapor sekmesi ya da kayıtlı pano */
export const scheduledSourceSchema = z.discriminatedUnion('tur', [
  z
    .object({
      tur: z.literal('sekme'),
      sekme: z.enum(REPORT_TABS.map((t) => t.key) as [ReportTab, ...ReportTab[]]),
    })
    .strict(),
  z.object({ tur: z.literal('pano'), panoId: z.uuid() }).strict(),
]);
export type ScheduledSource = z.infer<typeof scheduledSourceSchema>;

export const scheduledReportSchema = z
  .object({
    kaynak: scheduledSourceSchema,
    siklik: frequencySchema,
    saat: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Saat SS:DD biçiminde olmalı'),
    alicilar: z.array(z.uuid()).min(1, 'En az bir alıcı seç').max(10),
  })
  .strict();
export type ScheduledReportInput = z.infer<typeof scheduledReportSchema>;

export const scheduledSwitchSchema = z.object({ acik: z.boolean() }).strict();

/** Galeri raporu: ilde en az bu kadar talep yoksa Türkiye geneli kullanılır */
export const GALLERY_REPORT_MIN_DEMANDS = 5;
/** Galeri raporunda gösterilen model sayısı */
export const GALLERY_REPORT_MODELS = 5;
