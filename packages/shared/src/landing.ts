import { z } from 'zod';

/**
 * Açılış sayfaları (Karar 46; YonetimIcerik.dc.html › acilis): reklamlar için hazır bloklardan sayfa kurulur, sitenin
 * kök adresinde (rengarenksite.com/galeri-ol) yayınlanır. UTM'li reklam bağlantısı kendiliğinden üretilir; ziyaret ve
 * düğme tıklaması günlük toplam olarak sayılır (kişisel veri tutulmaz). Ölçüm olayları (PageView, Lead) reklam
 * ölçümüne izin veren ziyaretçiler için Pixel ve Google etiketiyle gönderilir (Karar 35; bağlantı kurulunca).
 * Yayınlanan her sürüm saklanır; önceki sürüme tek tıkla dönülür.
 */

const kisa = (n: number) => z.string().trim().min(1).max(n);
const hedef = z.enum(['talep', 'galeri']);

export const landingBlockSchema = z.discriminatedUnion('tur', [
  z
    .object({
      tur: z.literal('baslik'),
      baslik: kisa(90),
      alt: z.string().trim().max(200),
      dugme: kisa(30),
      hedef,
    })
    .strict(),
  z
    .object({
      tur: z.literal('rakamlar'),
      maddeler: z
        .array(z.object({ deger: kisa(20), etiket: kisa(60) }).strict())
        .min(1)
        .max(4),
    })
    .strict(),
  z
    .object({
      tur: z.literal('avantajlar'),
      maddeler: z
        .array(z.object({ baslik: kisa(60), metin: z.string().trim().max(160) }).strict())
        .min(1)
        .max(6),
    })
    .strict(),
  z
    .object({
      tur: z.literal('form'),
      baslik: kisa(80),
      metin: z.string().trim().max(200),
      dugme: kisa(30),
      hedef,
    })
    .strict(),
  z
    .object({
      tur: z.literal('nasil'),
      adimlar: z
        .array(z.object({ baslik: kisa(60), metin: z.string().trim().max(160) }).strict())
        .min(2)
        .max(5),
    })
    .strict(),
  z
    .object({
      tur: z.literal('sss'),
      sorular: z
        .array(z.object({ soru: kisa(120), cevap: kisa(600) }).strict())
        .min(1)
        .max(10),
    })
    .strict(),
  z.object({ tur: z.literal('guven'), maddeler: z.array(kisa(80)).min(1).max(6) }).strict(),
]);
export type LandingBlock = z.infer<typeof landingBlockSchema>;
export type LandingBlockType = LandingBlock['tur'];

/** Blok türleri: konsoldaki ad ve renk noktası (YonetimIcerik.dc.html) */
export const LANDING_BLOCKS: Record<LandingBlockType, { ad: string; renk: string }> = {
  baslik: { ad: 'Başlık', renk: '#5B8CFF' },
  rakamlar: { ad: 'Rakamlar', renk: '#FFC84A' },
  avantajlar: { ad: 'Avantajlar', renk: '#3DD68C' },
  form: { ad: 'Form', renk: '#FF6FB5' },
  nasil: { ad: 'Nasıl çalışır', renk: '#3DD68C' },
  sss: { ad: 'Sık sorulanlar', renk: '#9B7BFF' },
  guven: { ad: 'Güven rozetleri', renk: '#FFC84A' },
};

/** Yeni bloğun başlangıç içeriği */
export const LANDING_BLOCK_DEFAULTS: Record<LandingBlockType, LandingBlock> = {
  baslik: {
    tur: 'baslik',
    baslik: 'Aradığın aracı yaz, satıcılar sana gelsin',
    alt: '',
    dugme: 'Talep oluştur',
    hedef: 'talep',
  },
  rakamlar: { tur: 'rakamlar', maddeler: [{ deger: '12 dk', etiket: 'ortalama ilk mesaj süresi' }] },
  avantajlar: {
    tur: 'avantajlar',
    maddeler: [{ baslik: 'İlan vermeden', metin: 'Aradığını yaz, uygun aracı olanlar yazsın.' }],
  },
  form: { tur: 'form', baslik: 'Hemen başla', metin: '', dugme: 'Talep oluştur', hedef: 'talep' },
  nasil: {
    tur: 'nasil',
    adimlar: [
      { baslik: 'Aradığını yaz', metin: '' },
      { baslik: 'Satıcılar sana yazsın', metin: '' },
      { baslik: 'Sohbet et, karar ver', metin: '' },
    ],
  },
  sss: { tur: 'sss', sorular: [{ soru: 'Ücretli mi?', cevap: 'İlk talebin ücretsiz.' }] },
  guven: { tur: 'guven', maddeler: ['Doğrulanmış galeriler', 'Numaran gizli kalır'] },
};

/** Sitenin kendi kök adresleri: açılış sayfası bunlarla çakışamaz */
export const LANDING_RESERVED = [
  'api',
  'arac',
  'ayarlar',
  'bildirimler',
  'cerez-aydinlatma',
  'destek',
  'eposta-dogrula',
  'favoriler',
  'galeri',
  'galeri-paneli',
  'galeri-sozlesmesi',
  'giris',
  'haklarim',
  'iletisim',
  'itiraz',
  'kullanim-kosullari',
  'kurumsal-basvuru',
  'kvkk',
  'mesafeli-sozlesme',
  'mesajlarim',
  'on-bilgilendirme',
  'talep',
  'talep-olustur',
  'talepler',
  'taleplerim',
  'veri-kaynaklari',
  'yardim',
  'odeme',
  'k',
] as const;

export const landingSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Adres küçük harf, rakam ve tireden oluşmalı (ör. galeri-ol)')
  .refine(
    (s) => !(LANDING_RESERVED as readonly string[]).includes(s),
    'Bu adres sitenin bir sayfasıyla çakışıyor',
  );

const utmParca = z
  .string()
  .trim()
  .max(60)
  .regex(/^[a-z0-9_.-]*$/, 'UTM değeri küçük harf, rakam, alt çizgi, nokta ve tire olmalı');

export const landingSchema = z
  .object({
    ad: z.string().trim().min(3).max(80),
    slug: landingSlugSchema,
    seoBaslik: z.string().trim().min(10).max(70),
    utm: z.object({ source: utmParca, medium: utmParca, campaign: utmParca }).strict(),
    bloklar: z.array(landingBlockSchema).min(1).max(12),
  })
  .strict();
export type LandingInput = z.infer<typeof landingSchema>;

/** Reklamda kullanılacak bağlantı: kök adres + UTM */
export function landingAdUrl(
  site: string,
  slug: string,
  utm: { source: string; medium: string; campaign: string },
) {
  const q = new URLSearchParams(
    Object.entries({ utm_source: utm.source, utm_medium: utm.medium, utm_campaign: utm.campaign }).filter(
      ([, v]) => v,
    ),
  ).toString();
  return `${site.replace(/\/$/, '')}/${slug}${q ? `?${q}` : ''}`;
}

/** Ölçüm olayları (Karar 35): sayfa görüntüleme ve hedefe göre dönüşüm */
export const landingEvents = (bloklar: LandingBlock[]) => {
  const hedefler = new Set(bloklar.flatMap((b) => ('hedef' in b ? [b.hedef] : [])));
  return [
    'PageView',
    ...(hedefler.has('talep') ? ['Lead (talep yayınlandı)', 'CompleteRegistration (üyelik)'] : []),
    ...(hedefler.has('galeri') ? ['SubmitApplication (galeri başvurusu)'] : []),
  ];
};

export const landingEventSchema = z.object({ tur: z.enum(['ziyaret', 'tiklama']) }).strict();
