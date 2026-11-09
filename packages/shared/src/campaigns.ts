import { z } from 'zod';

/**
 * Kampanyalar ve segmentler (Karar 49, 51; YonetimKampanya.dc.html › kampanya, segment). Segment kuralları "ve" ile
 * birleşir; kişi sayısı ve kanal bazında ulaşılabilir kişi canlı hesaplanır, kayıtlı segment her gönderimde yeniden
 * hesaplanır. Kampanya ticari iletidir: yalnızca ticari ileti onayı olanlara, kişi başı haftada en çok 2, 21.00–09.00
 * arası sabaha ertelenir (bildirim katmanı). 1.000 kişiyi aşan gönderim sahip ya da yönetici onayı ister.
 * Kampanya SMS'i sahip açana kadar kapalıdır.
 */

export const SEGMENT_ROLES = [
  { key: 'bireysel', ad: 'Bireysel' },
  { key: 'galeri', ad: 'Galeri' },
  { key: 'kiralama', ad: 'Kiralama firması' },
] as const;
export const SEGMENT_PLANS = [
  { key: 'deneme', ad: 'Deneme' },
  { key: 'baslangic', ad: 'Başlangıç' },
  { key: 'profesyonel', ad: 'Profesyonel' },
  { key: 'kurumsal', ad: 'Kurumsal' },
  { key: 'pasif', ad: 'Paket yok' },
] as const;
export const SEGMENT_PLATFORMS = [
  { key: 'WEB', ad: 'Web' },
  { key: 'IOS', ad: 'iOS' },
  { key: 'ANDROID', ad: 'Android' },
] as const;

const evetHayir = z.enum(['evet', 'hayir']);
export const segmentRuleSchema = z.discriminatedUnion('alan', [
  z.object({ alan: z.literal('rol'), deger: z.enum(['bireysel', 'galeri', 'kiralama']) }).strict(),
  z.object({ alan: z.literal('aktif_talep'), deger: evetHayir }).strict(),
  z
    .object({
      alan: z.literal('son_giris'),
      yon: z.enum(['icinde', 'once']),
      gun: z.number().int().min(1).max(365),
    })
    .strict(),
  z.object({ alan: z.literal('il'), deger: z.array(z.string().min(2).max(40)).min(1).max(81) }).strict(),
  z
    .object({ alan: z.literal('kategori'), deger: z.array(z.string().min(1).max(60)).min(1).max(40) })
    .strict(),
  z.object({ alan: z.literal('odeme'), deger: z.enum(['hic', 'var']) }).strict(),
  z
    .object({
      alan: z.literal('platform'),
      deger: z
        .array(z.enum(['WEB', 'IOS', 'ANDROID']))
        .min(1)
        .max(3),
    })
    .strict(),
  z.object({ alan: z.literal('acik_sohbet'), deger: evetHayir }).strict(),
  z
    .object({
      alan: z.literal('paket'),
      deger: z
        .array(z.enum(['deneme', 'baslangic', 'profesyonel', 'kurumsal', 'pasif']))
        .min(1)
        .max(5),
    })
    .strict(),
]);
export type SegmentRule = z.infer<typeof segmentRuleSchema>;
export type SegmentField = SegmentRule['alan'];

export const SEGMENT_FIELDS: Record<SegmentField, string> = {
  rol: 'Rol',
  aktif_talep: 'Aktif talebi var',
  son_giris: 'Son giriş',
  il: 'İl',
  kategori: 'Talep kategorisi',
  odeme: 'Ödeme yaptı',
  platform: 'Platform',
  acik_sohbet: 'Açık sohbeti var',
  paket: 'Galeri paketi',
};

/** Kuralın okunur hâli: ["İl", "şunlardan biri", "İstanbul, Ankara"] */
export function ruleText(
  r: SegmentRule,
  kategoriAd: (slug: string) => string = (s) => s,
): [string, string, string] {
  const ad = SEGMENT_FIELDS[r.alan];
  switch (r.alan) {
    case 'rol':
      return [ad, 'eşittir', SEGMENT_ROLES.find((x) => x.key === r.deger)?.ad ?? r.deger];
    case 'aktif_talep':
    case 'acik_sohbet':
      return [ad, 'eşittir', r.deger === 'evet' ? 'Evet' : 'Hayır'];
    case 'son_giris':
      return [
        ad,
        r.yon === 'icinde' ? 'son' : 'en az',
        `${r.gun} gün ${r.yon === 'icinde' ? 'içinde' : 'önce'}`,
      ];
    case 'il':
      return [ad, 'şunlardan biri', r.deger.join(', ')];
    case 'kategori':
      return [ad, 'şunlardan biri', r.deger.map(kategoriAd).join(', ')];
    case 'odeme':
      return [ad, r.deger === 'hic' ? 'hiç' : 'en az bir kez', r.deger === 'hic' ? '—' : 'Evet'];
    case 'platform':
      return [
        ad,
        'şunlardan biri',
        r.deger.map((p) => SEGMENT_PLATFORMS.find((x) => x.key === p)?.ad ?? p).join(', '),
      ];
    default:
      return [
        ad,
        'şunlardan biri',
        r.deger.map((p) => SEGMENT_PLANS.find((x) => x.key === p)?.ad ?? p).join(', '),
      ];
  }
}

export const segmentSchema = z
  .object({
    ad: z.string().trim().min(3).max(80),
    kurallar: z.array(segmentRuleSchema).min(1).max(12),
  })
  .strict();

/** Kampanya kanalları: uygulama içi bildirim push'u da kapsar; SMS kapalı (Karar 49) */
export const CAMPAIGN_CHANNELS = [
  { key: 'uygulama', ad: 'Uygulama içi ve push', acik: true },
  { key: 'eposta', ad: 'E-posta (ticari)', acik: true },
  { key: 'sms', ad: 'SMS', acik: false },
] as const;
export type CampaignChannel = 'uygulama' | 'eposta';

export const CAMPAIGN_GOALS = [
  { key: 'ust_sira', ad: 'Üst sıra satın alma' },
  { key: 'talep', ad: 'Talep oluşturma' },
  { key: 'galeri_basvuru', ad: 'Galeri başvurusu' },
  { key: 'geri_kazanma', ad: 'Geri kazanma' },
  { key: 'duyuru', ad: 'Duyuru' },
] as const;

/** 1.000 kişiyi aşan gönderim sahip ya da yönetici onayı ister (Karar 40, 49) */
export const CAMPAIGN_APPROVAL_LIMIT = 1000;

export const CAMPAIGN_STATUSES = {
  taslak: { ad: 'Taslak', bg: '#F3F5FA', fg: '#5A6073' },
  onay_bekliyor: { ad: 'Onay bekliyor', bg: '#FFF6DF', fg: '#7A5300' },
  zamanlandi: { ad: 'Zamanlandı', bg: '#EEF3FF', fg: '#2450C8' },
  gonderiliyor: { ad: 'Gönderiliyor', bg: '#EEF3FF', fg: '#2450C8' },
  gonderildi: { ad: 'Gönderildi', bg: '#E7FAF0', fg: '#11683F' },
  reddedildi: { ad: 'Onaylanmadı', bg: '#FDECEC', fg: '#A3271F' },
  iptal: { ad: 'İptal edildi', bg: '#F3F5FA', fg: '#5A6073' },
} as const;
export type CampaignStatus = keyof typeof CAMPAIGN_STATUSES;

/** İç bağlantı ya da rengarenk alan adı (ticari iletide dış bağlantı yok) */
const yol = z
  .string()
  .trim()
  .max(200)
  .regex(/^\/[A-Za-z0-9/_\-?=&.%]*$/, 'Bağlantı site içinde bir yol olmalı (ör. /haklarim)');

export const campaignSchema = z
  .object({
    ad: z.string().trim().min(3).max(100),
    hedef: z.enum(CAMPAIGN_GOALS.map((g) => g.key) as [string, ...string[]]),
    segmentId: z.uuid(),
    kanallar: z
      .array(z.enum(['uygulama', 'eposta']))
      .min(1)
      .max(2),
    baslik: z.string().trim().min(3).max(80),
    metin: z.string().trim().min(10).max(400),
    dugme: z.string().trim().min(2).max(30),
    url: yol,
    zaman: z.iso.datetime({ offset: true }),
  })
  .strict();
