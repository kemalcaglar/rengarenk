import { z } from 'zod';

/**
 * Konsol › Pazar › Talepler ve portföy (YonetimPazar.dc.html › talep; Karar 53). Seçilen kayıtlara toplu işlem; gizleme
 * moderasyon kararıdır (itiraz yolu açık). Kayıt sahibine gerekçe şablonla bildirilir.
 */

export const DEMAND_ACTIONS = {
  duzeltme: 'Düzeltme iste',
  gizle: 'Gizle',
  kategori: 'Kategori değiştir',
} as const;
export type DemandAction = keyof typeof DEMAND_ACTIONS;

export const VEHICLE_ACTIONS = {
  gizle: 'Gizle',
  belge: 'Belge iste',
  bildir: 'Galeriye bildir',
} as const;
export type VehicleAction = keyof typeof VEHICLE_ACTIONS;

/** Gerekçe şablonları (kayıt sahibine giden metin; konsolda düzenlenebilir) */
export const ACTION_REASONS: Record<`talep.${DemandAction}` | `arac.${VehicleAction}`, string[]> = {
  'talep.duzeltme': [
    'Başlık aradığın aracı anlatmıyor; marka ve modeli yazarsan satıcılar daha kolay bulur.',
    'Açıklamada talep dışı bilgi var; yalnızca aradığın aracı anlat.',
    'Bütçe ve yıl aralığı birbiriyle uyuşmuyor; kontrol eder misin?',
  ],
  'talep.gizle': [
    'Talep, satış ilanı gibi yazılmış; Rengarenk’te yalnızca aranan araç için talep açılır.',
    'Talepte yanıltıcı ya da uygunsuz içerik var.',
    'Aynı talep birden çok kez açılmış.',
  ],
  'talep.kategori': ['Talebin bu kategoride daha çok satıcıya ulaşır.'],
  'arac.gizle': [
    'Araç fotoğrafları başka bir ilandan kopyalanmış görünüyor.',
    'Araç bilgileri ile fotoğraflar uyuşmuyor.',
    'Fiyat ya da araç bilgisi yanıltıcı.',
  ],
  'arac.belge': [
    'Araç için güncel ekspertiz raporunu yükler misin?',
    'Ruhsat bilgileriyle ilan bilgileri uyuşmuyor; ruhsatın ilgili sayfasını destek ekibine iletir misin?',
  ],
  'arac.bildir': [
    'Aracın fotoğraflarında plaka okunuyor; plakayı kapatarak yeniden yükler misin?',
    'Araç uzun süredir yayında; hâlâ satışta değilse satıldı olarak işaretler misin?',
  ],
};

export const listingActionSchema = z
  .object({
    ids: z.array(z.uuid()).min(1).max(50),
    islem: z.string().min(1).max(20),
    gerekce: z.string().trim().min(10).max(500),
    /** Kategori değiştir: önerilen kategori (slug) */
    kategori: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export type ListingActionInput = z.infer<typeof listingActionSchema>;

/** Liste satırı (iki sekme aynı biçim; tasarımdaki sütunlar) */
export interface ListingRow {
  id: string;
  ad: string;
  alt: string;
  /** Talep: kategori · araç: doğrulama */
  b: string;
  /** Talep: ilk mesaj · araç: fiyat */
  c: string;
  durum: string;
  ton: 'yesil' | 'sari' | 'kirmizi' | 'mavi' | 'gri';
  /** Konsolda bağlantı (talep ya da araç sayfası) */
  url: string;
}
