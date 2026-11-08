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
 * konsoldaki "Kurallar ve fiyatlar" ekranından yönetilecek (Karar 13.3, 47). `mobil`: uygulama içi satın alma
 * fiyatı (Karar 38; mağaza komisyonu nedeniyle yaklaşık %20 yüksek, ,99 ile biter). Uygulamada web fiyatı gösterilmez.
 */
export const BIREYSEL_FIYATLAR = {
  ekTalep: { ad: 'Ek talep', sure: '1 talep, 30 gün', tl: 199, mobil: 239.99 },
  talepPaketi: { ad: 'Talep paketi', sure: '3 talep', tl: 499, mobil: 599.99 },
  uzatma: { ad: 'Ücretli uzatma', sure: '30 gün', tl: 99, mobil: 119.99 },
} as const;

/** Öne çıkarma seçenekleri (Karar 12.6, 12.8, 38; Sihirbaz 6. adım) */
export const ONE_CIKARMA = [
  {
    key: 'ust_sira',
    ad: 'Üst sıra',
    aciklama: 'Satıcıların listelerinde 7 gün üstte',
    tl: 149,
    mobil: 179.99,
  },
  { key: 'acil', ad: 'Acil arıyorum', aciklama: '7 gün dikkat çeken etiket', tl: 79, mobil: 94.99 },
  { key: 'vitrin', ad: 'Ana sayfa vitrini', aciklama: '7 gün ana sayfada', tl: 299, mobil: 359.99 },
] as const;

/** "359,99" · "299" */
export const fiyatYaz = (n: number) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);

// ── Liste, arama ve kayıtlı arama ─────────────────────────────

/** Tekrarlanan ya da virgülle ayrılmış sorgu değeri → dizi */
const liste = z
  .union([z.string(), z.array(z.string())])
  .transform((v) =>
    (Array.isArray(v) ? v : v.split(','))
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 30),
  )
  .optional();
const sayi = z.coerce.number().int().min(0).max(1_000_000_000).optional();

/** GET /talepler filtreleri; kayıtlı arama da aynı biçimi saklar (sayfa ve sıra hariç) */
export const demandSearchQuerySchema = z
  .object({
    kategori: z.string().max(60).optional(),
    marka: z.string().max(200).optional(),
    seri: liste,
    model: z.string().max(200).optional(),
    makyaj: liste,
    paket: liste,
    yilMin: sayi,
    yilMax: sayi,
    butceMin: sayi,
    butceMax: sayi,
    il: z.string().max(40).optional(),
    ilce: z.string().max(60).optional(),
    telefon: z
      .union([z.literal(true), z.enum(['1', 'true'])])
      .transform(() => true as const)
      .optional(),
    q: z.string().max(120).optional(),
    sira: z.enum(['onerilen', 'yeni', 'butce_azalan', 'butce_artan']).optional(),
    sayfa: z.coerce.number().int().min(1).max(500).optional(),
    boyut: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strip();
export type DemandSearchQuery = z.output<typeof demandSearchQuerySchema>;

/**
 * Aramanın karşılaştırma anahtarı: sayfa, sıra ve boş değerler hariç, değerler sıralı. Listedeki "Aramayı kaydet"
 * düğmesi bu anahtarla aynı aramanın zaten kayıtlı olup olmadığına bakar.
 */
export function searchQueryKey(input: Record<string, unknown>): string {
  const r = demandSearchQuerySchema.safeParse(input);
  if (!r.success) return '';
  const { sayfa: _s, sira: _o, boyut: _b, ...q } = r.data;
  return JSON.stringify(
    Object.entries(q)
      .map(
        ([k, v]) =>
          [k, (Array.isArray(v) ? v : v === undefined || v === '' ? [] : [v]).map(String).sort()] as const,
      )
      .filter(([, v]) => v.length > 0)
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  );
}

/**
 * Kartların kısa bütçesi (Anasayfa.dc.html): "1,35 – 1,6 mn TL", "850 bin – 1 mn TL", "700 – 850 bin TL".
 * Mobil son talepler milyonu açık yazar (AnasayfaMobil.dc.html: "850 bin – 1 milyon TL").
 */
export function compactBudget(
  min?: number | null,
  max?: number | null,
  milyon: 'mn' | 'milyon' = 'mn',
): string {
  const birim = (n: number) => (n >= 1_000_000 ? milyon : n >= 1_000 ? 'bin' : '');
  const sayi = (n: number) => {
    const b = birim(n);
    const v = b === milyon ? n / 1_000_000 : b === 'bin' ? n / 1_000 : n;
    return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(v);
  };
  const tam = (n: number) => [sayi(n), birim(n)].filter(Boolean).join(' ');
  if (min && max && min !== max) {
    return birim(min) === birim(max) ? `${sayi(min)} – ${tam(max)} TL` : `${tam(min)} – ${tam(max)} TL`;
  }
  if (max) return min === max ? `${tam(max)} TL` : `En çok ${tam(max)} TL`;
  if (min) return `En az ${tam(min)} TL`;
  return '';
}

/** Kayıtlı arama en fazla 10 (Karar 30) */
export const MAX_SAVED_SEARCHES = 10;
export const SAVED_SEARCH_NOTIFY = [
  { key: 'anlik', ad: 'Anlık' },
  { key: 'gunluk', ad: 'Günlük özet' },
  { key: 'kapali', ad: 'Kapalı' },
] as const;

export const savedSearchCreateSchema = z
  .object({
    ad: z.string().trim().min(2, 'Arama adı en az 2 karakter').max(80),
    sorgu: demandSearchQuerySchema,
  })
  .strict();

export const savedSearchUpdateSchema = z
  .object({
    ad: z.string().trim().min(2).max(80).optional(),
    bildirim: z.enum(['anlik', 'gunluk', 'kapali']).optional(),
    /** "N yeni" sayacını sıfırlar */
    gordum: z.literal(true).optional(),
  })
  .strict();
