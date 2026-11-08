import { z } from 'zod';
import { MAX_ALTERNATIVES } from './category-schema.js';

/**
 * Talep yaşam döngüsü (Karar 09, 10; Kullanıcı akışları › Talep yaşam döngüsü):
 * Taslak → Yayında ⇄ Pasif; Yayında/Pasif → Tamamlandı (aracı buldum) ya da Kapatıldı. Talep silinmez.
 */
export const DEMAND_STATUSES = ['DRAFT', 'PUBLISHED', 'PASSIVE', 'CLOSED', 'COMPLETED'] as const;
export type DemandStatusKey = (typeof DEMAND_STATUSES)[number];

export const DEMAND_STATUS_NAMES: Record<DemandStatusKey, string> = {
  DRAFT: 'Taslak',
  PUBLISHED: 'Yayında',
  PASSIVE: 'Pasif',
  CLOSED: 'Kapatıldı',
  COMPLETED: 'Tamamlandı',
};

/** Bitişten kaç gün önce hatırlatma gider (Karar 10) */
export const REMINDER_DAYS = [7, 3, 1] as const;
/** Süresi dolmak üzere olan talep bu kadar gün kala uzatılabilir */
export const EXTEND_WINDOW_DAYS = 7;

/** "Aracı buldum" sorusu (Karar 31); cevap satıcıya gösterilmez, başarı ölçümünde kullanılır. */
export const FOUND_VIA = [
  { key: 'rengarenk', ad: "Rengarenk'te bir satıcıdan" },
  { key: 'baska_site', ad: 'Başka bir siteden veya galeriden' },
  { key: 'tanidik', ad: 'Tanıdık üzerinden' },
  { key: 'vazgectim', ad: 'Almaktan vazgeçtim' },
] as const;
export type FoundViaKey = (typeof FOUND_VIA)[number]['key'];

/** Talep sihirbazının adımları (Sihirbaz.dc.html) */
export const WIZARD_LABELS = [
  'Kategori',
  'Ana araç',
  'Kriterler',
  'Boya ve hasar',
  'Konum ve iletişim',
  'Önizleme',
] as const;

const record = z.record(z.string(), z.unknown());

/** Taslakta veri yarım olabilir; yalnızca biçim ve boyut denetlenir. Tam doğrulama yayında (demandSchema). */
export const demandDataSchema = z
  .object({
    alanlar: record.default({}),
    alternatifler: z.array(record).max(MAX_ALTERNATIVES).default([{}]),
  })
  .strict()
  .refine((v) => JSON.stringify(v).length <= 20_000, { message: 'Talep çok uzun' });

export const demandContactSchema = z
  .object({
    phoneVisible: z.boolean(),
    whatsappVisible: z.boolean(),
    nameMode: z.enum(['tam', 'kisa']),
  })
  .strict()
  .refine((v) => !v.whatsappVisible || v.phoneVisible, {
    message: 'WhatsApp için telefon numaranın görünmesine izin ver',
    path: ['whatsappVisible'],
  });

export const demandCreateSchema = z.object({ kategori: z.string().min(1).max(60) }).strict();

export const demandUpdateSchema = z
  .object({
    kategori: z.string().min(1).max(60).optional(),
    step: z.number().int().min(1).max(WIZARD_LABELS.length).optional(),
    data: demandDataSchema.optional(),
    contact: demandContactSchema.optional(),
  })
  .strict();

export const demandCompleteSchema = z
  .object({ foundVia: z.enum(FOUND_VIA.map((f) => f.key) as [FoundViaKey, ...FoundViaKey[]]) })
  .strict();

/** Talep sahibinin görünen adı (Karar 29): "Ayşe Yılmaz" ya da "Ayşe Y." */
export function demandOwnerName(
  first: string | null | undefined,
  last: string | null | undefined,
  mode: 'tam' | 'kisa',
  fallback = 'Rengarenk üyesi',
): string {
  const f = first?.trim();
  const l = last?.trim();
  if (!f) return fallback;
  if (!l) return f;
  return mode === 'kisa' ? `${f} ${l.charAt(0).toLocaleUpperCase('tr-TR')}.` : `${f} ${l}`;
}
