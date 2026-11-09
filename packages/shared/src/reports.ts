import { z } from 'zod';

/**
 * Raporlar (Karar 44; YonetimRapor.dc.html › rapor). Sekmeler: huni, arz-talep haritası, gelir, reklam ve edinim, en çok
 * talep edilenler, birim ekonomisi, deneyler. Süzgeçler: tarih, karşılaştırma, il, kategori, platform. Dışa aktarma
 * yalnızca sahip, yönetici ve finansta (rapor.disa_aktar); kişisel veri hiçbir zaman dışa aktarılmaz.
 */

export const REPORT_TABS = [
  { key: 'huni', ad: 'Huni' },
  { key: 'harita', ad: 'Arz-talep haritası' },
  { key: 'gelir', ad: 'Gelir' },
  { key: 'reklam', ad: 'Reklam ve edinim' },
  { key: 'model', ad: 'En çok talep edilenler' },
  { key: 'birim', ad: 'Birim ekonomisi' },
  { key: 'deney', ad: 'Deneyler' },
] as const;
export type ReportTab = (typeof REPORT_TABS)[number]['key'];

export const REPORT_RANGES = [
  { key: '30', ad: 'Son 30 gün' },
  { key: '7', ad: 'Son 7 gün' },
  { key: 'bu_ay', ad: 'Bu ay' },
  { key: 'gecen_ay', ad: 'Geçen ay' },
] as const;
export type ReportRange = (typeof REPORT_RANGES)[number]['key'];

export const REPORT_COMPARE = [
  { key: 'onceki', ad: 'Önceki dönem' },
  { key: 'yok', ad: 'Karşılaştırma yok' },
] as const;
export type ReportCompare = (typeof REPORT_COMPARE)[number]['key'];

export const reportFilterSchema = z
  .object({
    tarih: z.enum(REPORT_RANGES.map((r) => r.key) as [ReportRange, ...ReportRange[]]).default('30'),
    karsilastir: z
      .enum(REPORT_COMPARE.map((r) => r.key) as [ReportCompare, ...ReportCompare[]])
      .default('onceki'),
    il: z.string().trim().max(40).optional(),
    kategori: z.string().trim().max(60).optional(),
    platform: z.enum(['WEB', 'IOS', 'ANDROID']).optional(),
  })
  .strict();
export type ReportFilter = z.output<typeof reportFilterSchema>;

/** Kişisel pano: rapor sekmesi ve süzgeçleri kaydedilir */
export const reportViewSchema = z
  .object({
    ad: z.string().trim().min(2).max(60),
    sekme: z.enum(REPORT_TABS.map((t) => t.key) as [ReportTab, ...ReportTab[]]),
    filtre: reportFilterSchema,
  })
  .strict();

/** Arz-talep durumu: uygun araç / talep oranı */
export function supplyState(arac: number, talep: number): 'dengeli' | 'arz_az' | 'buyuk_acik' {
  if (!talep) return 'dengeli';
  const r = arac / talep;
  return r >= 3 ? 'dengeli' : r >= 1 ? 'arz_az' : 'buyuk_acik';
}
export const SUPPLY_STATES = {
  dengeli: { ad: 'Dengeli', bg: '#E7FAF0', fg: '#11683F' },
  arz_az: { ad: 'Arz az', bg: '#FFF6DF', fg: '#7A5300' },
  buyuk_acik: { ad: 'Büyük açık', bg: '#FDECEC', fg: '#A3271F' },
} as const;

/** Isı haritası renk basamakları (tasarımdaki RAMP) */
export const HEAT_RAMP = ['#EEF3FF', '#D3E0FF', '#A9C2FF', '#3D6BDB', '#1F44AD'] as const;
export const heatStep = (v: number, esikler: readonly number[]) => {
  for (let i = 0; i < esikler.length; i++) if (v < (esikler[i] as number)) return i;
  return esikler.length;
};
