import { z } from 'zod';
import { variantSchema } from './experiments.js';
import { ilBul } from './iller.js';

/**
 * Banner, duyuru ve vitrin (Karar 46; YonetimIcerik.dc.html › banner). Banner bir yere (ana sayfa üstü, galeri paneli,
 * talep listesi, talep detayı, uygulama içi duyuru, bütün sayfaların üst şeridi), kitleye (isteğe bağlı il), platforma
 * ve tarih aralığına yayınlanır. Gösterim ve tıklama günlük toplam olarak sayılır (kişisel veri tutulmaz). A/B testi
 * deney altyapısıyla gelecek.
 */

export const BANNER_PLACES = {
  anasayfa_ust: { ad: 'Ana sayfa üstü' },
  galeri_paneli: { ad: 'Galeri paneli üstü' },
  talep_listesi: { ad: 'Talep listesi üstü' },
  talep_detay: { ad: 'Talep detayı' },
  duyuru: { ad: 'Uygulama içi duyuru' },
  ust_serit: { ad: 'Tüm sayfalar üst şerit' },
} as const;
export type BannerPlace = keyof typeof BANNER_PLACES;
export const BANNER_PLACE_KEYS = Object.keys(BANNER_PLACES) as BannerPlace[];

/** Kitle: ziyaretçi (giriş yapmamış), bireysel üye, galeri (kurumsal hesap üyesi) */
export const BANNER_AUDIENCES = {
  herkes: 'Herkes',
  ziyaretci: 'Ziyaretçi',
  bireysel: 'Bireysel üye',
  galeri: 'Galeri',
} as const;
export type BannerAudience = keyof typeof BANNER_AUDIENCES;
export type Viewer = Exclude<BannerAudience, 'herkes'>;

export const BANNER_PLATFORMS = { hepsi: 'Web ve mobil', web: 'Yalnız web', mobil: 'Yalnız mobil' } as const;
export type BannerPlatform = keyof typeof BANNER_PLATFORMS;

/** Bannerın vurgu rengi (tasarım değerlerinden) */
export const BANNER_COLORS = ['#5B8CFF', '#FF6FB5', '#FFC84A', '#3DD68C', '#9B7BFF'] as const;
/** Vurgu renginin açık zemini */
export const BANNER_TINTS: Record<(typeof BANNER_COLORS)[number], string> = {
  '#5B8CFF': '#EEF3FF',
  '#FF6FB5': '#FFEEF6',
  '#FFC84A': '#FFF6DF',
  '#3DD68C': '#E7FAF0',
  '#9B7BFF': '#F3EFFF',
};

/** Bir yerde aynı anda gösterilen banner sayısı (duyuruda birden çok) */
export const BANNER_LIMIT: Record<BannerPlace, number> = {
  anasayfa_ust: 1,
  galeri_paneli: 1,
  talep_listesi: 1,
  talep_detay: 1,
  duyuru: 3,
  ust_serit: 1,
};

/** En uzun yayın süresi (gün) */
export const BANNER_MAX_DAYS = 90;

const sitePath = z
  .string()
  .trim()
  .max(200)
  .regex(/^\/(?!\/)[^\s]*$/, 'Bağlantı sitenin bir sayfası olmalı (ör. /kurumsal-basvuru)');

export const bannerSchema = z
  .object({
    baslik: z.string().trim().min(3).max(80),
    metin: z.string().trim().max(160).default(''),
    dugme: z.string().trim().max(30).default(''),
    url: sitePath.or(z.literal('')).default(''),
    yer: z.enum(BANNER_PLACE_KEYS as [BannerPlace, ...BannerPlace[]]),
    kitle: z.enum(Object.keys(BANNER_AUDIENCES) as [BannerAudience, ...BannerAudience[]]),
    il: z
      .string()
      .trim()
      .refine((v) => Boolean(ilBul(v)), 'İl listede yok')
      .nullable()
      .default(null),
    platform: z.enum(Object.keys(BANNER_PLATFORMS) as [BannerPlatform, ...BannerPlatform[]]),
    renk: z.enum(BANNER_COLORS),
    baslangic: z.iso.datetime({ offset: true }).nullable().default(null),
    bitis: z.iso.datetime({ offset: true }).nullable().default(null),
    /** A/B testi: ikinci sürüm (başlık, metin, düğme); ölçü tıklama oranı */
    b: variantSchema.nullable().default(null),
  })
  .strict()
  .refine((b) => !b.dugme || b.url, { message: 'Düğme için bağlantı gerekli', path: ['url'] })
  .refine((b) => (b.baslangic === null) === (b.bitis === null), {
    message: 'Başlangıç ve bitiş birlikte seçilir',
    path: ['bitis'],
  })
  .refine(
    (b) =>
      !b.baslangic ||
      !b.bitis ||
      (new Date(b.bitis) > new Date(b.baslangic) &&
        new Date(b.bitis).getTime() - new Date(b.baslangic).getTime() <= BANNER_MAX_DAYS * 86_400_000),
    { message: `Bitiş başlangıçtan sonra ve en çok ${BANNER_MAX_DAYS} gün içinde olmalı`, path: ['bitis'] },
  )
  .refine((b) => b.kitle !== 'ziyaretci' || !b.il, {
    message: 'Ziyaretçinin ili bilinmez; il yalnızca üye ve galeri kitlesinde seçilir',
    path: ['il'],
  });
export type BannerInput = z.output<typeof bannerSchema>;

export const bannerEventSchema = z
  .object({ tur: z.enum(['gosterim', 'tiklama']), kol: z.enum(['A', 'B']).default('A') })
  .strict();

export type BannerStatus = 'taslak' | 'zamanlandi' | 'yayinda' | 'bitti' | 'durduruldu';
export const BANNER_STATUSES: Record<BannerStatus, { ad: string; bg: string; fg: string }> = {
  taslak: { ad: 'Taslak', bg: '#FFF6DF', fg: '#7A5300' },
  zamanlandi: { ad: 'Zamanlandı', bg: '#EEF3FF', fg: '#2450C8' },
  yayinda: { ad: 'Yayında', bg: '#E7FAF0', fg: '#11683F' },
  bitti: { ad: 'Bitti', bg: '#F3F5FA', fg: '#5A6073' },
  durduruldu: { ad: 'Durduruldu', bg: '#FDECEC', fg: '#A3271F' },
};

export function bannerStatus(
  b: { published: boolean; stoppedAt: Date | null; startsAt: Date | null; endsAt: Date | null },
  now = new Date(),
): BannerStatus {
  if (b.stoppedAt) return 'durduruldu';
  if (!b.published || !b.startsAt || !b.endsAt) return 'taslak';
  if (now < b.startsAt) return 'zamanlandi';
  if (now >= b.endsAt) return 'bitti';
  return 'yayinda';
}

/** Kitle eşleşmesi: "herkes" bütün görüntüleyenlere; il seçiliyse kişinin ya da galerinin ili */
export function bannerMatches(
  b: { audience: string; il: string | null; platform: string },
  v: { kitle: Viewer; il: string | null; platform: 'web' | 'mobil' },
) {
  if (b.platform !== 'hepsi' && b.platform !== v.platform) return false;
  if (b.audience !== 'herkes' && b.audience !== v.kitle) return false;
  return !b.il || b.il === v.il;
}

const KISA_AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const trParca = (d: Date) => {
  const t = new Date(d.getTime() + 3 * 3_600_000);
  return { g: t.getUTCDate(), a: t.getUTCMonth(), y: t.getUTCFullYear() };
};
/** "10 – 30 Kas 2026", "28 Eki – 3 Kas 2026", "Tarih seçilmedi" (bitiş günü dahil yazılır) */
export function bannerDateText(bas: Date | null, bit: Date | null) {
  if (!bas || !bit) return 'Tarih seçilmedi';
  const a = trParca(bas);
  const b = trParca(new Date(bit.getTime() - 1));
  if (a.y !== b.y) return `${a.g} ${KISA_AY[a.a]} ${a.y} – ${b.g} ${KISA_AY[b.a]} ${b.y}`;
  if (a.a !== b.a) return `${a.g} ${KISA_AY[a.a]} – ${b.g} ${KISA_AY[b.a]} ${b.y}`;
  return a.g === b.g ? `${a.g} ${KISA_AY[a.a]} ${a.y}` : `${a.g} – ${b.g} ${KISA_AY[b.a]} ${b.y}`;
}

/** Ana sayfa vitrini: yer sayısı (17 talep ve "vitrine taşı" kartı, Anasayfa.dc.html) */
export const VITRIN_YER = 17;
export const vitrinEditorSchema = z.object({ acik: z.boolean() }).strict();
