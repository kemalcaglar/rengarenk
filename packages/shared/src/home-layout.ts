import { z } from 'zod';

/**
 * Ana sayfa düzeni (Karar 46; YonetimIcerik.dc.html › anasayfa). Her kitle (ziyaretçi, bireysel üye, galeri) ve platform
 * (web, mobil) için bölümlerin sırası ve görünürlüğü. Karşılama bölümü her zaman en üstte ve açıktır. Düzen sürümlü
 * yayınlanır; ileri tarihe zamanlanabilir ve eski sürüme dönülür.
 *
 * Varsayılan düzen ana sayfa tasarımlarıyla (Anasayfa.dc.html, AnasayfaMobil.dc.html) aynıdır: tasarımlarda olmayan
 * bölümler (ör. sık sorulanlar, taleplerim özeti) hazırdır ama kapalı gelir; konsoldan açılır.
 */

export const HOME_AUDIENCES = { ziyaretci: 'Ziyaretçi', bireysel: 'Bireysel üye', galeri: 'Galeri' } as const;
export type HomeAudience = keyof typeof HOME_AUDIENCES;
export const HOME_AUDIENCE_KEYS = Object.keys(HOME_AUDIENCES) as HomeAudience[];

export const HOME_PLATFORMS = { web: 'Web', mobil: 'Mobil uygulama' } as const;
export type HomePlatform = keyof typeof HOME_PLATFORMS;
export const HOME_PLATFORM_KEYS = Object.keys(HOME_PLATFORMS) as HomePlatform[];

export interface HomeSection {
  key: string;
  ad: string;
  not: string;
  renk: string;
  /** Önizlemedeki yükseklik (px) */
  h: number;
}

const b = (key: string, ad: string, not: string, renk: string, h: number): HomeSection => ({
  key,
  ad,
  not,
  renk,
  h,
});

/** Kitlelerin bölümleri (konsol tasarımındaki sırayla) */
export const HOME_SECTIONS: Record<HomeAudience, HomeSection[]> = {
  ziyaretci: [
    b('karsi', 'Karşılama ve arama', 'Sabit · en üstte', '#5B8CFF', 70),
    b('kat', 'Kategori kutuları', 'Web’de sol sütun, mobilde yatay kutular', '#FFC84A', 46),
    b('vitrin', 'Vitrin talepleri', '17 yer · ücretliler önce', '#FF6FB5', 64),
    b('nasil', 'Nasıl çalışır', '3 adım', '#3DD68C', 40),
    b('son', 'Son talepler', 'En yeni 6 talep', '#5B8CFF', 56),
    b('galeri_cagri', 'Galeriler için banner', 'Galeri başvurusuna çağrı', '#9B7BFF', 36),
    b('guven', 'Güven rozetleri', 'Doğrulanmış galeriler, gizli numara', '#3DD68C', 30),
    b('sss', 'Sık sorulanlar', '6 soru', '#FFC84A', 40),
  ],
  bireysel: [
    b('karsi', 'Karşılama ve arama', 'Sabit · en üstte', '#5B8CFF', 56),
    b('taleplerim', 'Taleplerim özeti', 'Aktif talepler ve kalan gün', '#3DD68C', 50),
    b('mesaj', 'Gelen ilk mesajlar', 'Okunmamışlar önce', '#FF6FB5', 54),
    b('duyuru', 'Duyuru', 'Aktif duyuru varsa görünür', '#9B7BFF', 30),
    b('arama', 'Kayıtlı aramalarınız', 'Yeni talep gelen aramalar', '#5B8CFF', 40),
    b('kat', 'Kategori kutuları', 'Web’de sol sütun, mobilde yatay kutular', '#FFC84A', 46),
    b('vitrin', 'Vitrin talepleri', '17 yer · ücretliler önce', '#FF6FB5', 56),
    b('son', 'Son talepler', 'En yeni 6 talep', '#5B8CFF', 50),
  ],
  galeri: [
    b('karsi', 'Karşılama ve arama', 'Galeri adı, paket ve bugünkü hak', '#5B8CFF', 48),
    b('eslesme', 'Bugünkü eşleşmeler', 'Portföyüne uyan yeni talepler', '#3DD68C', 70),
    b('hak', 'Kalan ilk mesaj hakkı', 'Paket ve ek haklar', '#FFC84A', 34),
    b('aranan', 'Bölgende aranan modeller', 'Son 30 günün talepleri ve portföyün', '#FF6FB5', 50),
    b('duyuru', 'Duyuru', 'Galeri duyuruları', '#9B7BFF', 30),
    b('son', 'Son talepler · bölgen', 'Galerinin ilindeki en yeni talepler', '#5B8CFF', 56),
  ],
};

export interface AudienceLayout {
  sira: string[];
  gizli: string[];
}
export type HomeLayout = Record<HomeAudience, Record<HomePlatform, AudienceLayout>>;

/** Tasarımlarda olmayan bölümler kapalı başlar */
const VARSAYILAN_GIZLI: Record<HomeAudience, Record<HomePlatform, string[]>> = {
  ziyaretci: {
    // Web'de "Nasıl çalışır" adımları karşılama kartının içinde
    web: ['nasil', 'galeri_cagri', 'guven', 'sss'],
    mobil: ['kat', 'galeri_cagri', 'guven', 'sss'],
  },
  bireysel: { web: ['taleplerim', 'mesaj'], mobil: ['taleplerim', 'mesaj', 'kat'] },
  galeri: { web: ['hak', 'aranan'], mobil: ['hak', 'aranan'] },
};

/** Tasarımdaki sıra konsol listesinden farklıysa (AnasayfaMobil: vitrin, son talepler, nasıl çalışır) */
const VARSAYILAN_SIRA: Partial<Record<HomeAudience, Partial<Record<HomePlatform, string[]>>>> = {
  ziyaretci: { mobil: ['karsi', 'kat', 'vitrin', 'son', 'nasil', 'galeri_cagri', 'guven', 'sss'] },
};

export function defaultHomeLayout(): HomeLayout {
  const out = {} as HomeLayout;
  for (const k of HOME_AUDIENCE_KEYS) {
    out[k] = {} as Record<HomePlatform, AudienceLayout>;
    for (const p of HOME_PLATFORM_KEYS)
      out[k][p] = {
        sira: [...(VARSAYILAN_SIRA[k]?.[p] ?? HOME_SECTIONS[k].map((s) => s.key))],
        gizli: [...VARSAYILAN_GIZLI[k][p]],
      };
  }
  return out;
}

const audienceLayoutSchema = z.object({ sira: z.array(z.string()), gizli: z.array(z.string()) }).strict();

export const homeLayoutSchema = z
  .object(
    Object.fromEntries(
      HOME_AUDIENCE_KEYS.map((k) => [
        k,
        z.object(Object.fromEntries(HOME_PLATFORM_KEYS.map((p) => [p, audienceLayoutSchema]))).strict(),
      ]),
    ) as Record<HomeAudience, z.ZodObject<Record<HomePlatform, typeof audienceLayoutSchema>>>,
  )
  .strict()
  .superRefine((v, ctx) => {
    for (const k of HOME_AUDIENCE_KEYS) {
      const anahtarlar = HOME_SECTIONS[k].map((s) => s.key).sort();
      for (const p of HOME_PLATFORM_KEYS) {
        const d = (v as HomeLayout)[k][p];
        const yol = [k, p];
        if ([...d.sira].sort().join() !== anahtarlar.join())
          ctx.addIssue({ code: 'custom', path: yol, message: 'Bölüm listesi eksik ya da fazla' });
        if (d.sira[0] !== 'karsi')
          ctx.addIssue({ code: 'custom', path: yol, message: 'Karşılama bölümü en üstte kalır' });
        if (d.gizli.includes('karsi'))
          ctx.addIssue({ code: 'custom', path: yol, message: 'Karşılama bölümü kapatılamaz' });
        if (d.gizli.some((g) => !anahtarlar.includes(g)))
          ctx.addIssue({ code: 'custom', path: yol, message: 'Bilinmeyen bölüm' });
      }
    }
  });

export const homePublishSchema = z
  .object({
    duzen: homeLayoutSchema,
    /** Boşsa hemen; doluysa ileri tarihte yayına girer */
    zaman: z.iso.datetime({ offset: true }).nullable().default(null),
  })
  .strict();

/** Görünen bölümler, sırasıyla */
export const visibleSections = (d: AudienceLayout) => d.sira.filter((s) => !d.gizli.includes(s));

/** Sürüm notu: önceki düzene göre değişiklikler ("Bireysel · mobil: “Gelen ilk mesajlar” açıldı") */
export function homeLayoutChanges(once: HomeLayout, sonra: HomeLayout): string[] {
  const out: string[] = [];
  for (const k of HOME_AUDIENCE_KEYS)
    for (const p of HOME_PLATFORM_KEYS) {
      const a = once[k][p];
      const b2 = sonra[k][p];
      const ad = (key: string) => HOME_SECTIONS[k].find((s) => s.key === key)?.ad ?? key;
      const yer = `${HOME_AUDIENCES[k]} · ${p === 'web' ? 'web' : 'mobil'}`;
      for (const s of b2.gizli) if (!a.gizli.includes(s)) out.push(`${yer}: “${ad(s)}” kapatıldı`);
      for (const s of a.gizli) if (!b2.gizli.includes(s)) out.push(`${yer}: “${ad(s)}” açıldı`);
      const i = b2.sira.findIndex((s, j) => a.sira[j] !== s);
      if (i >= 0) {
        const s = b2.sira[i] as string;
        out.push(`${yer}: “${ad(s)}” ${a.sira.indexOf(s) > i ? 'yukarı' : 'aşağı'} taşındı`);
      }
    }
  return out;
}

/** Herkese açık ana sayfa yanıtı: kitleye göre görünen bölümler ve kişiye özel veriler */
export interface HomeResponse {
  kitle: HomeAudience;
  sira: string[];
  taleplerim?: { no: number; baslik: string; kalanGun: number; yazan: number }[];
  mesajlar?: { id: string; satici: string; talep: string; okunmadi: boolean; zaman: string }[];
  galeri?: {
    accountId: string;
    ad: string;
    paket: string;
    il: string;
    portfoy: number;
    okunmamis: number;
    gunluk: { toplam: number; kalan: number } | null;
    ek: number;
  };
  aranan?: {
    bolge: string;
    modeller: { sira: number; ad: string; talep: number; arac: number }[];
    oneri: string;
  } | null;
}
