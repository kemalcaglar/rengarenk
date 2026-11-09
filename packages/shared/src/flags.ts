import { z } from 'zod';

/**
 * Özellik anahtarları (T13, Karar 47): yeni özellik önce küçük bir gruba açılır, sorun çıkarsa kod
 * değişmeden kapatılır. Anahtarlar burada tanımlanır; durumları veritabanında (`feature_flags`) ve
 * Redis önbelleğindedir. Listede olmayan anahtar her zaman kapalıdır. Liste tasarımla aynıdır
 * (docs/tasarim/YonetimSistem › Özellik anahtarları ve bakım).
 */
export const FEATURE_FLAGS = [
  { key: 'talep_asistani', ad: 'Talep asistanı', not: 'Serbest metinden talep taslağı (Karar 42)' },
  { key: 'mesaj_guvenligi', ad: 'Mesaj güvenliği', not: 'Kapora, IBAN ve şüpheli bağlantı uyarısı' },
  { key: 'toplu_portfoy', ad: 'Yapay zekâyla toplu portföy yükleme', not: 'Excel ve fotoğraftan araç kartı' },
  { key: 'butce_b', ad: 'Sihirbaz bütçe adımı · B kolu', not: 'İki kutulu bütçe girişi (deney)' },
  { key: 'kiralik_kategori', ad: 'Kiralık Araçlar kategorisi', not: 'Kiralama firmaları için talep türü' },
  { key: 'web_push', ad: 'Web push bildirimleri', not: 'Tarayıcı bildirimi izni isteme' },
  { key: 'emlak', ad: 'Emlak dikeyi', not: 'Karar 23 · taslak' },
  { key: 'ajan', ad: 'Rengarenk Ajanı', not: 'Kapatılırsa ajan hiçbir görev çalıştırmaz (Karar 41)' },
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[number]['key'];
export const FEATURE_FLAG_KEYS = FEATURE_FLAGS.map((f) => f.key) as FeatureFlagKey[];

/** Bakım modu alanları. "tum" açıkken kullanıcılara bakım sayfası gösterilir, API 503 döner. */
export const MAINTENANCE_AREAS = [
  { key: 'tum', ad: 'Tüm site', not: 'Herkese bakım sayfası gösterilir' },
  { key: 'odeme', ad: 'Ödemeler', not: 'Satın alma düğmeleri kapanır, haklar kullanılmaya devam eder' },
  { key: 'mesaj', ad: 'Mesajlaşma', not: 'Yeni mesaj gönderilemez, mevcut sohbetler okunur' },
  { key: 'talep', ad: 'Talep oluşturma', not: 'Yeni talep açılamaz, mevcut talepler yayında kalır' },
] as const;

export type MaintenanceArea = (typeof MAINTENANCE_AREAS)[number]['key'];
export const MAINTENANCE_KEYS = MAINTENANCE_AREAS.map((a) => a.key) as MaintenanceArea[];
/** Veritabanında bakım alanları `bakim.<alan>` anahtarıyla tutulur. */
export const maintenanceFlagKey = (a: MaintenanceArea) => `bakim.${a}` as const;

export const FLAG_AUDIENCES = ['ALL', 'BUSINESS', 'TESTERS'] as const;
export type FlagAudience = (typeof FLAG_AUDIENCES)[number];
export const FLAG_AUDIENCE_NAMES: Record<FlagAudience, string> = {
  ALL: 'Herkes',
  BUSINESS: 'Kurumsal galeriler',
  /** Çalışanların kendi kullanıcı hesapları (konsoldaki liste) */
  TESTERS: 'Yalnızca çalışanlar',
};

export const FLAG_PLATFORMS = ['WEB', 'IOS', 'ANDROID'] as const;
export type FlagPlatform = (typeof FLAG_PLATFORMS)[number];

export const flagUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    audience: z.enum(FLAG_AUDIENCES).optional(),
    percent: z.number().int().min(0).max(100).optional(),
    /** Boş liste: tüm platformlar */
    platforms: z.array(z.enum(FLAG_PLATFORMS)).max(3).optional(),
  })
  .strict();

export const maintenanceUpdateSchema = z
  .object({
    enabled: z.boolean(),
    /** Kullanıcılara üst şeritte gösterilen duyuru */
    note: z.string().trim().max(200).optional(),
  })
  .strict();

/** İstemcilere (web, mobil) dönen, kişiye göre değerlendirilmiş durum: GET /flags */
export interface ClientFlags {
  flags: Record<FeatureFlagKey, boolean>;
  bakim: Record<MaintenanceArea, boolean>;
  /** Bakımdaki alan varsa kullanıcıya gösterilecek duyuru */
  duyuru: string | null;
}

/**
 * Arayüz deneyleri (Karar 44; YonetimSistem › özellik anahtarları "B kolu", YonetimRapor › deney). Anahtar açık ve
 * yüzdesi 1–99 arasındayken deney sürer: dilimi yüzdenin altında kalan kullanıcı B kolunu (anahtar açık), diğerleri A
 * kolunu görür. Deney yalnızca kitle "Herkes" iken ve tanımdaki platformda ölçülür. Yüzde 100'e çekilince B herkese
 * açılmış, anahtar kapanınca A'da kalınmış olur; ikisinde de deney biter.
 */
export interface UiExperiment {
  soru: string;
  a: string;
  b: string;
  /** Ölçü: görenlerden geçenlerin oranı */
  olcu: string;
  platform: FlagPlatform;
}
export const UI_EXPERIMENTS: Partial<Record<FeatureFlagKey, UiExperiment>> = {
  butce_b: {
    soru: 'Sihirbaz bütçe adımı: kaydırıcı mı, iki kutu mu?',
    a: 'kaydırıcı',
    b: 'en az / en çok iki kutu',
    olcu: 'bütçe adımını geçen kullanıcı oranı',
    platform: 'WEB',
  },
};

/** İstemcinin deney olayı: adımı gördü ya da geçti (kol sunucuda hesaplanır) */
export const uiExperimentEventSchema = z.object({ tur: z.enum(['gorus', 'gecis']) }).strict();

/** Bir kullanıcının yüzde dilimindeki yeri (0–99); aynı kullanıcı aynı anahtarda hep aynı sonucu alır. */
export function rolloutBucket(key: string, userId: string): number {
  // FNV-1a: tarayıcı, mobil ve sunucuda aynı sonucu veren küçük bir özet.
  let h = 0x811c9dc5;
  for (const ch of `${key}:${userId}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
}
