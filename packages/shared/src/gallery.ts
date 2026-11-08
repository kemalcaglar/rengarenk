import { z } from 'zod';
import { phoneSchema } from './auth.js';
import { ILLER } from './iller.js';

// ── Kurumsal hesap başvurusu (Karar 03, 17; Basvuru.dc.html) ─────────

/** İşletme türleri: veritabanındaki BusinessKind ile aynı anahtarlar */
export const BUSINESS_KINDS = ['DEALER', 'RENTAL', 'BOAT', 'AIRCRAFT'] as const;
export type BusinessKindKey = (typeof BUSINESS_KINDS)[number];

export interface GalleryDocumentDef {
  key: string;
  ad: string;
  not: string;
  zorunlu: boolean;
}

export interface BusinessKindDef {
  ad: string;
  /** Kısa ad (konsol ve profil): "Galeri", "Kiralama firması" … */
  kisa: string;
  /** Profildeki faaliyet alanı (GaleriProfil.dc.html: "Vasıta · yetki belgesi türü") */
  alan: string;
  alt: string;
  dot: string;
  tint: string;
  /** Bakanlık yetki belgesi gerekiyor mu (m.22/a) */
  yetkiVar: boolean;
  yetkiAd: string;
  belgeNotu: string;
  belgeler: GalleryDocumentDef[];
}

const VERGI_LEVHASI = { key: 'vergi_levhasi', ad: 'Vergi levhası', not: 'PDF veya fotoğraf', zorunlu: true };
const SICIL = {
  key: 'sicil_gazetesi',
  ad: 'Ticaret sicil gazetesi',
  not: 'Kuruluş veya son değişiklik',
  zorunlu: true,
};
const ODA = { key: 'oda_kayit', ad: 'Oda kayıt belgesi', not: 'Son 6 ay içinde alınmış', zorunlu: true };

export const BUSINESS_KIND_DEFS: Record<BusinessKindKey, BusinessKindDef> = {
  DEALER: {
    ad: 'Vasıta galerisi',
    kisa: 'Galeri',
    alan: 'Vasıta',
    alt: 'İkinci el ve sıfır kara taşıtı satan işletmeler',
    dot: '#5B8CFF',
    tint: '#EEF3FF',
    yetkiVar: true,
    yetkiAd: 'İkinci el motorlu kara taşıtı ticareti yetki belgesi no',
    belgeNotu: 'Yetki belgen, üyelikten önce Ticaret Bakanlığı sisteminden kontrol edilir.',
    belgeler: [VERGI_LEVHASI, SICIL, ODA],
  },
  RENTAL: {
    ad: 'Kiralama firması',
    kisa: 'Kiralama firması',
    alan: 'Kiralama',
    alt: 'Kısa ve uzun dönem araç kiralayan işletmeler',
    dot: '#FF6FB5',
    tint: '#FFEEF6',
    yetkiVar: true,
    yetkiAd: 'Araç kiralama yetki belgesi no',
    belgeNotu:
      'Kiralama yönetmeliği gereği yetki belgesi Bakanlık Bilgi Sistemi’nden doğrulanır; mevcut firmalar için belge 1 Temmuz 2027’ye kadar zorunlu hale gelir.',
    belgeler: [
      VERGI_LEVHASI,
      ODA,
      { key: 'sube_adresleri', ad: 'Şube adresleri', not: 'Teslim noktaları dahil', zorunlu: true },
    ],
  },
  BOAT: {
    ad: 'Tekne ve yat galerisi',
    kisa: 'Tekne ve yat galerisi',
    alan: 'Deniz araçları',
    alt: 'Tekne, yat ve deniz motoru satan işletmeler',
    dot: '#3DD68C',
    tint: '#E7FAF0',
    yetkiVar: false,
    yetkiAd: '',
    belgeNotu:
      'Deniz araçları için ayrı bir yetki belgesi yoktur; ticari belgelerin incelenir. Kiralık tekne sunacaksan turizm işletmesi belgesi de gerekir.',
    belgeler: [
      VERGI_LEVHASI,
      SICIL,
      {
        key: 'turizm_belgesi',
        ad: 'Turizm işletmesi belgesi',
        not: 'Yalnızca kiralık tekne için',
        zorunlu: false,
      },
    ],
  },
  AIRCRAFT: {
    ad: 'Hava aracı satıcısı',
    kisa: 'Hava aracı satıcısı',
    alan: 'Hava araçları',
    alt: 'Uçak, helikopter ve İHA satan işletmeler',
    dot: '#FFC84A',
    tint: '#FFF6DF',
    yetkiVar: false,
    yetkiAd: '',
    belgeNotu: 'Hava araçları için ayrı bir yetki belgesi yoktur; ticari belgelerin incelenir.',
    belgeler: [VERGI_LEVHASI, SICIL, ODA],
  },
};

/** Sihirbaz adımları (Basvuru.dc.html) */
export const APPLICATION_STEPS = [
  'İşletme türü',
  'İşletme bilgileri',
  'Yetki ve belgeler',
  'Hesap sahibi',
  'Gönder',
];

/** Belge dosyaları: PDF veya fotoğraf, en çok 10 MB */
export const DOCUMENT_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const APPLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'DOCS_REQUESTED',
  'APPROVED',
  'REJECTED',
  'REVOKED',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export const APPLICATION_STATUS_NAMES: Record<ApplicationStatus, string> = {
  DRAFT: 'Taslak',
  SUBMITTED: 'Kontrol ediliyor',
  IN_REVIEW: 'Yönetici incelemesinde',
  DOCS_REQUESTED: 'Ek belge istendi',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
  REVOKED: 'Onay geri alındı',
};

/** Otomatik kontroller (YonetimPazar.dc.html): hepsi geçerse ajan onaylar (Karar 03, 41) */
export const APPLICATION_CHECKS = [
  { key: 'yetki', ad: 'Yetki belgesi' },
  { key: 'vergi', ad: 'Vergi levhası' },
  { key: 'mersis', ad: 'MERSİS' },
  { key: 'adres', ad: 'Adres' },
  { key: 'telefon', ad: 'Telefon' },
] as const;
export type ApplicationCheckKey = (typeof APPLICATION_CHECKS)[number]['key'];
/** gecti ✓ · kaldi ✕ · uyari ◆ · yapilamadi (sağlayıcı yok ya da yanıt vermedi; insan bakar) */
export type CheckOutcome = 'gecti' | 'kaldi' | 'uyari' | 'yapilamadi';
export interface ApplicationCheck {
  key: ApplicationCheckKey;
  sonuc: CheckOutcome;
  not?: string;
}

// ── Kimlik numaraları ─────────────────────────────────────────

/** Vergi kimlik numarası (10 hane) sağlama hanesi (GİB algoritması) */
export function vknGecerli(v: string): boolean {
  if (!/^\d{10}$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const t = (Number(v[i]) + 9 - i) % 10;
    let p = (t * 2 ** (9 - i)) % 9;
    if (t !== 0 && p === 0) p = 9;
    sum += p;
  }
  return (10 - (sum % 10)) % 10 === Number(v[9]);
}

/** T.C. kimlik numarası (11 hane); şahıs işletmelerinde vergi numarası yerine geçer */
export function tcknGecerli(v: string): boolean {
  if (!/^[1-9]\d{10}$/.test(v)) return false;
  const d = (i: number) => Number(v[i]);
  const tek = d(0) + d(2) + d(4) + d(6) + d(8);
  const cift = d(1) + d(3) + d(5) + d(7);
  if ((((tek * 7 - cift) % 10) + 10) % 10 !== d(9)) return false;
  return [...v.slice(0, 10)].reduce((a, c) => a + Number(c), 0) % 10 === d(10);
}

const metin = (min: number, max: number, ad: string) =>
  z
    .string()
    .trim()
    .min(min, `${ad} en az ${min} karakter olmalı`)
    .max(max, `${ad} en çok ${max} karakter olabilir`);

export const galleryOwnerSchema = z.object({
  ad: metin(2, 40, 'Ad'),
  soyad: metin(2, 40, 'Soyad'),
  gorev: metin(2, 60, 'Görev'),
  eposta: z.string().trim().toLowerCase().email('Geçerli bir e-posta adresi gir').max(120),
});

/** Başvuru taslağı: her alan isteğe bağlı, sihirbaz her adımda kaydeder */
export const galleryApplicationDraftSchema = z.object({
  tur: z.enum(BUSINESS_KINDS).optional(),
  unvan: z.string().trim().max(200).optional(),
  gorunenAd: z.string().trim().max(60).optional(),
  vergiNo: z.string().trim().max(11).optional(),
  vergiDairesi: z.string().trim().max(80).optional(),
  mersis: z.string().trim().max(16).optional(),
  il: z.string().trim().max(40).optional(),
  ilce: z.string().trim().max(60).optional(),
  adres: z.string().trim().max(300).optional(),
  yetkiNo: z.string().trim().max(40).optional(),
  sahip: galleryOwnerSchema.partial().optional(),
});
export type GalleryApplicationDraft = z.output<typeof galleryApplicationDraftSchema>;

/** Gönderim: bütün alanlar dolu ve biçimleri doğru */
export const galleryApplicationSchema = z
  .object({
    tur: z.enum(BUSINESS_KINDS, { message: 'İşletme türünü seç' }),
    unvan: metin(3, 200, 'Ticari unvan'),
    gorunenAd: metin(2, 60, 'Platformda görünecek ad'),
    vergiNo: z
      .string()
      .trim()
      .refine(
        (v) => vknGecerli(v) || tcknGecerli(v),
        'Vergi numarası geçerli değil (10 haneli VKN ya da 11 haneli TCKN)',
      ),
    vergiDairesi: metin(2, 80, 'Vergi dairesi'),
    mersis: z
      .string()
      .trim()
      .regex(/^\d{16}$/, 'MERSİS numarası 16 haneli olmalı'),
    il: z.string().trim(),
    ilce: z.string().trim(),
    adres: metin(10, 300, 'İşletme adresi'),
    yetkiNo: z.string().trim().max(40).optional(),
    sahip: galleryOwnerSchema,
  })
  .superRefine((v, ctx) => {
    const il = ILLER.find((x) => x.ad === v.il);
    if (!il) ctx.addIssue({ code: 'custom', path: ['il'], message: 'İl seç' });
    else if (!il.ilceler.includes(v.ilce))
      ctx.addIssue({ code: 'custom', path: ['ilce'], message: 'İlçe seç' });
    if (BUSINESS_KIND_DEFS[v.tur].yetkiVar && !/^[A-Za-z0-9./-]{3,40}$/.test(v.yetkiNo ?? '')) {
      ctx.addIssue({ code: 'custom', path: ['yetkiNo'], message: 'Yetki belgesi numarasını gir' });
    }
  });
export type GalleryApplicationData = z.output<typeof galleryApplicationSchema>;

export const applicationRejectSchema = z.object({ gerekce: metin(10, 500, 'Gerekçe') });
export const applicationDocsRequestSchema = z.object({ not: metin(10, 500, 'Açıklama') });

// ── Paketler ve deneme (Karar 12.2, 12.5) ─────────────────────

export const GALLERY_PLANS = {
  baslangic: {
    ad: 'Başlangıç',
    aylik: 1490,
    yillik: 14900,
    portfoy: 25,
    gunlukMesaj: 20,
    aylikTalep: 2,
    oneCikarma: 0,
    toplu: false,
    eslesme: false,
    api: false,
    calisan: 2,
  },
  profesyonel: {
    ad: 'Profesyonel',
    aylik: 3490,
    yillik: 34900,
    portfoy: 100,
    gunlukMesaj: 50,
    aylikTalep: 5,
    oneCikarma: 2,
    toplu: true,
    eslesme: true,
    api: false,
    calisan: 5,
  },
  kurumsal: {
    ad: 'Kurumsal',
    aylik: 7490,
    yillik: 74900,
    portfoy: null,
    gunlukMesaj: 150,
    aylikTalep: 15,
    oneCikarma: 5,
    toplu: true,
    eslesme: true,
    api: true,
    calisan: 15,
  },
} as const;
export type GalleryPlanKey = keyof typeof GALLERY_PLANS | 'deneme';

/** 30 gün deneme: Profesyonel özellikleri, sınırlı haklar; kart istenmez, kendiliğinden ücretliye geçmez */
export const GALLERY_TRIAL = {
  gun: 30,
  portfoy: 15,
  gunlukMesaj: 10,
  talep: 1,
  oneCikarma: 0,
  toplu: true,
  eslesme: true,
  api: false,
  calisan: 5,
  hatirlatmaGunleri: [7, 3, 1],
} as const;

/** Galerinin kullanabileceği çalışan sayısı */
export const memberLimit = (plan: GalleryPlanKey) =>
  plan === 'deneme' ? GALLERY_TRIAL.calisan : GALLERY_PLANS[plan].calisan;

// ── Çalışanlar (Karar 20) ─────────────────────────────────────

export const MEMBER_ROLES = ['OWNER', 'MANAGER', 'SALES'] as const;
export type MemberRoleKey = (typeof MEMBER_ROLES)[number];
export const MEMBER_ROLE_NAMES: Record<MemberRoleKey, string> = {
  OWNER: 'Sahip',
  MANAGER: 'Yönetici',
  SALES: 'Satış temsilcisi',
};
export const MEMBER_ROLE_NOTES: Record<MemberRoleKey, string> = {
  OWNER: 'Tüm yetkiler; paket, ödeme, fatura; kullanıcı ekleme ve çıkarma',
  MANAGER: 'Portföy, toplu yükleme, API, eşleşmeler ve mesajlar; satış temsilcisi ekleme',
  SALES: 'Eşleşmeler ve mesajlar; kendine atanan portföy araçlarını düzenleme',
};
/** Kim kimi davet edebilir: sahip yönetici ve satış temsilcisi, yönetici yalnızca satış temsilcisi */
export const canInvite = (by: MemberRoleKey, role: MemberRoleKey) =>
  role !== 'OWNER' && (by === 'OWNER' || (by === 'MANAGER' && role === 'SALES'));

export const galleryInviteSchema = z.object({
  telefon: phoneSchema,
  rol: z.enum(['MANAGER', 'SALES'], { message: 'Rol seç' }),
});
export const INVITE_DAYS = 7;

/** Galeri profilinin herkese açık bölümü (GaleriProfil.dc.html) */
export const galleryProfileSchema = z.object({
  gorunenAd: metin(2, 60, 'Platformda görünecek ad').optional(),
  hakkinda: z.string().trim().max(1000, 'Tanıtım en çok 1000 karakter olabilir').nullable().optional(),
  calismaSaatleri: z.string().trim().max(120).nullable().optional(),
});

/** "yildiz-otomotiv" (Türkçe harfler sadeleşir) */
export function gallerySlug(ad: string): string {
  const harf: Record<string, string> = {
    ç: 'c',
    ğ: 'g',
    ı: 'i',
    ö: 'o',
    ş: 's',
    ü: 'u',
    â: 'a',
    î: 'i',
    û: 'u',
  };
  return (
    ad
      .toLocaleLowerCase('tr-TR')
      .replace(/[çğıöşüâîû]/g, (c) => harf[c] ?? c)
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'galeri'
  );
}
