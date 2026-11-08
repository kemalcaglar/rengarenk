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
  { key: 'rengarenk', ad: 'Rengarenk’te mesajlaştığım bir satıcıdan' },
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
    /** Alıcının yazdığı başlık (Sihirbaz 5. adım); boş bırakılırsa katalogdan üretilen başlık gösterilir */
    headline: z.string().trim().min(5, 'Başlık en az 5 karakter').max(120).nullable().optional(),
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

/**
 * Bireysel hizmet fiyatları, KDV dahil (Karar 12.8). Başlangıç değerleridir; ödeme modülüyle birlikte
 * konsoldaki "Kurallar ve fiyatlar" ekranından yönetilecek (Karar 13.3, 47).
 */
export const BIREYSEL_FIYATLAR = {
  ekTalep: { ad: 'Ek talep', sure: '1 talep, 30 gün', tl: 199 },
  talepPaketi: { ad: 'Talep paketi', sure: '3 talep', tl: 499 },
  uzatma: { ad: 'Ücretli uzatma', sure: '30 gün', tl: 99 },
} as const;

/** Öne çıkarma seçenekleri (Karar 12.6, 12.8; Sihirbaz 6. adım) */
export const ONE_CIKARMA = [
  { key: 'ust_sira', ad: 'Üst sıra', aciklama: 'Satıcıların listelerinde 7 gün üstte', tl: 149 },
  { key: 'acil', ad: 'Acil arıyorum', aciklama: '7 gün dikkat çeken etiket', tl: 79 },
  { key: 'vitrin', ad: 'Ana sayfa vitrini', aciklama: '7 gün ana sayfada', tl: 299 },
] as const;
