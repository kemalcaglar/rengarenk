import { z } from 'zod';
import { PAINT_PARTS, PAINT_STATES } from './category-schema.js';

// ── Galeri portföyü (Karar 07, 17; GaleriPanel.dc.html, PortfoyArac.dc.html) ──────

export const PORTFOLIO_STATUSES = [
  'DRAFT',
  'PENDING_EIDS',
  'PUBLISHED',
  'PASSIVE',
  'SOLD',
  'REJECTED',
] as const;
export type PortfolioStatus = (typeof PORTFOLIO_STATUSES)[number];
export const PORTFOLIO_STATUS_NAMES: Record<PortfolioStatus, string> = {
  DRAFT: 'Taslak',
  PENDING_EIDS: 'Doğrulama bekliyor',
  PUBLISHED: 'Yayında',
  PASSIVE: 'Pasif',
  SOLD: 'Satıldı',
  REJECTED: 'EİDS reddetti',
};

/** EİDS gerekmeyen kategoriler: deniz ve hava araçları (EİDS motorlu kara taşıtı ilanları içindir), kiralık filo */
const EIDS_YOK = new Set(['deniz', 'hava', 'kiralik']);
/** Kategori (kök) EİDS ve 6 ay / 6.000 km kuralına tabi mi (yönetmelik m.22/ç, geçici m.2) */
export const eidsRequired = (rootSlug: string) => !EIDS_YOK.has(rootSlug);

export const PHOTO_MIN = 6;
export const PHOTO_MAX = 30;
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const FUELS = [
  { key: 'benzin', ad: 'Benzin' },
  { key: 'dizel', ad: 'Dizel' },
  { key: 'lpg_benzin', ad: 'LPG & Benzin' },
  { key: 'hibrit', ad: 'Hibrit' },
  { key: 'elektrik', ad: 'Elektrik' },
] as const;
export const GEARBOXES = [
  { key: 'manuel', ad: 'Manuel' },
  { key: 'otomatik', ad: 'Otomatik' },
  { key: 'yari_otomatik', ad: 'Yarı otomatik' },
] as const;
export const COLORS = [
  { key: 'beyaz', ad: 'Beyaz' },
  { key: 'gri', ad: 'Gri' },
  { key: 'siyah', ad: 'Siyah' },
  { key: 'mavi', ad: 'Mavi' },
  { key: 'kirmizi', ad: 'Kırmızı' },
  { key: 'gumus', ad: 'Gümüş' },
  { key: 'lacivert', ad: 'Lacivert' },
  { key: 'yesil', ad: 'Yeşil' },
  { key: 'kahverengi', ad: 'Kahverengi' },
  { key: 'bej', ad: 'Bej' },
  { key: 'sari', ad: 'Sarı' },
  { key: 'turuncu', ad: 'Turuncu' },
  { key: 'bordo', ad: 'Bordo' },
] as const;

const FUEL_KEYS = FUELS.map((f) => f.key) as [string, ...string[]];
const GEAR_KEYS = GEARBOXES.map((f) => f.key) as [string, ...string[]];
const COLOR_KEYS = COLORS.map((f) => f.key) as [string, ...string[]];
const PART_KEYS = PAINT_PARTS.map((p) => p.key) as [string, ...string[]];
const STATE_KEYS = PAINT_STATES.map((p) => p.key) as [string, ...string[]];

/** "34 ABC 123" → "34ABC123"; geçersizse null (il kodu 01–81) */
export function normalizePlate(input: string): string | null {
  const p = input.toLocaleUpperCase('tr-TR').replace(/[\s-]/g, '');
  const m = /^(0[1-9]|[1-7]\d|8[01])([A-Z]{1,3})(\d{2,4})$/.exec(p);
  if (!m) return null;
  const harf = m[2] as string;
  const sayi = m[3] as string;
  // Harf sayısına göre rakam sayısı: 1 harf 4 rakam, 2 harf 3–4, 3 harf 2–3 (KTY m.8 biçimi)
  const ok = harf.length === 1 ? sayi.length === 4 : harf.length === 2 ? sayi.length >= 3 : sayi.length <= 3;
  return ok ? p : null;
}
/** "34ABC123" → "34 ABC 123" */
export const formatPlate = (p: string) => p.replace(/^(\d{2})([A-Z]{1,3})(\d+)$/, '$1 $2 $3');

export const damageSchema = z.object({
  /** Parça parça durum (talep sayfasıyla aynı şema); yazılmayan parça orijinal sayılır */
  parcalar: z.partialRecord(z.enum(PART_KEYS), z.enum(STATE_KEYS)).default({}),
  /** Tramer (hasar kaydı) toplamı, TL */
  tramer: z.coerce.number().int().min(0).max(100_000_000).default(0),
  sasiIslem: z.boolean().default(false),
  podyeIslem: z.boolean().default(false),
  airbagAcildi: z.boolean().default(false),
  agirHasar: z.boolean().default(false),
});
export type Damage = z.output<typeof damageSchema>;

const yilSiniri = () => new Date().getFullYear() + 1;

/** Portföy aracı (Araç ekle formu, toplu yükleme satırı, API). Katalogsuz kategoride marka ve model yazıyla girilir. */
export const portfolioVehicleSchema = z
  .object({
    kategori: z.string().trim().min(2).max(60),
    marka: z.string().trim().max(200).optional(),
    seri: z.string().trim().max(200).optional(),
    model: z.string().trim().max(200).optional(),
    /** Kasa kuşağı: "G20:0" (kod:makyaj) ya da kuşak anahtarı */
    kasa: z.string().trim().max(200).optional(),
    paket: z.string().trim().max(200).optional(),
    /** Katalogda olmayan araçlar için (tekne, uçak, eski klasik) */
    markaAd: z.string().trim().max(80).optional(),
    modelAd: z.string().trim().max(120).optional(),
    yil: z.coerce
      .number()
      .int()
      .min(1900, 'Model yılı geçerli değil')
      .refine((y) => y <= yilSiniri(), 'Model yılı geçerli değil'),
    km: z.coerce.number().int('Kilometre tam sayı olmalı').min(0).max(5_000_000),
    yakit: z.enum(FUEL_KEYS).optional(),
    vites: z.enum(GEAR_KEYS).optional(),
    renk: z.enum(COLOR_KEYS).optional(),
    fiyat: z.coerce.number().int().min(1000, 'Fiyat en az 1.000 TL olmalı').max(10_000_000_000),
    /** @pii Plaka: EİDS doğrulaması için; alıcıya yalnızca il kodu gösterilir */
    plaka: z.string().trim().max(12).optional(),
    /** @pii Şasi numarasının son 6 hanesi */
    sasiSon6: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-HJ-NPR-Z0-9]{6}$/, 'Şasi numarasının son 6 hanesini yaz')
      .optional(),
    /** İlk tescil tarihi (6 ay / 6.000 km kuralı) */
    ilkTescil: z.iso.date().optional(),
    rehin: z.boolean().default(false),
    garanti: z.string().trim().max(80).optional(),
    takas: z.boolean().default(false),
    hasar: damageSchema.default({
      parcalar: {},
      tramer: 0,
      sasiIslem: false,
      podyeIslem: false,
      airbagAcildi: false,
      agirHasar: false,
    }),
    aciklama: z.string().trim().max(2000).optional(),
    /** Satış fiyatının sıfır aracın üretici tavsiye fiyatını aşmadığı beyanı (geçici m.2) */
    fiyatBeyani: z.boolean().default(false),
    /** Bilinen üretici tavsiye fiyatı; yazılırsa fiyat bununla karşılaştırılır */
    ureticiFiyati: z.coerce.number().int().min(0).max(10_000_000_000).optional(),
    /** Fotoğrafların katalogda temsilî görsel olarak kullanılma izni (galeri adıyla) */
    fotoKatalogIzni: z.boolean().default(false),
    /** Toplu yükleme ve API: galerinin kendi stok numarası */
    disNo: z.string().trim().max(60).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.marka && !v.markaAd) ctx.addIssue({ code: 'custom', path: ['marka'], message: 'Marka seç' });
    if (v.plaka !== undefined && v.plaka !== '' && !normalizePlate(v.plaka)) {
      ctx.addIssue({ code: 'custom', path: ['plaka'], message: 'Plaka geçerli değil (ör. 34 ABC 123)' });
    }
  });
export type PortfolioVehicleInput = z.input<typeof portfolioVehicleSchema>;
export type PortfolioVehicleData = z.output<typeof portfolioVehicleSchema>;

// ── Yasal kurallar (yönetmelik; avukat teyidi Karar 17) ─────────

/**
 * Geçici m.2: galeri, tescilden sonra 6 ay ve 6.000 km dolmadan aracı satamaz. 1 Ocak 2027'ye uzatıldı; süre yeniden
 * uzatılırsa bu tarih güncellenir.
 */
export const RULE_6M_6000KM_UNTIL = '2027-01-01';
const DAY = 86_400_000;

export interface RuleResult {
  key: 'alti_ay' | 'uretici_fiyat' | 'ekspertiz';
  ok: boolean;
  /** Engel mi, uyarı mı */
  engel: boolean;
  metin: string;
}

/** Portföy girişindeki kontroller (Karar 17): 6 ay / 6.000 km, üretici fiyatı, ekspertiz (m.16) */
export function portfolioRules(
  v: Pick<PortfolioVehicleData, 'km' | 'ilkTescil' | 'fiyat' | 'fiyatBeyani' | 'ureticiFiyati' | 'yil'>,
  o: { rootSlug: string; ekspertizTarihi?: Date | null; now?: Date },
): RuleResult[] {
  const now = o.now ?? new Date();
  const out: RuleResult[] = [];
  if (eidsRequired(o.rootSlug)) {
    if (now < new Date(`${RULE_6M_6000KM_UNTIL}T00:00:00+03:00`)) {
      if (!v.ilkTescil) {
        out.push({
          key: 'alti_ay',
          ok: false,
          engel: true,
          metin: 'İlk tescil tarihini yaz (6 ay / 6.000 km kontrolü)',
        });
      } else {
        const ay6 = new Date(`${v.ilkTescil}T00:00:00+03:00`);
        ay6.setMonth(ay6.getMonth() + 6);
        const ok = now >= ay6 && v.km >= 6000;
        out.push({
          key: 'alti_ay',
          ok,
          engel: !ok,
          metin: ok
            ? '6 ay / 6.000 km kontrolü geçti'
            : 'Tescilden sonra 6 ay ve 6.000 km dolmadan galeri satışı yapılamaz',
        });
      }
    }
    // m.16: 8 model yaşı ve 160.000 km altındaki araçta satıştan önceki 10 günde ekspertiz raporu
    if (now.getFullYear() - v.yil < 8 && v.km < 160_000) {
      const taze = o.ekspertizTarihi && now.getTime() - o.ekspertizTarihi.getTime() <= 10 * DAY;
      out.push({
        key: 'ekspertiz',
        ok: Boolean(taze),
        engel: false,
        metin: taze
          ? 'Ekspertiz raporu son 10 gün içinde'
          : 'Satıştan önceki 10 gün içinde alınmış ekspertiz raporu gerekir',
      });
    }
  }
  if (v.ureticiFiyati) {
    const ok = v.fiyat <= v.ureticiFiyati;
    out.push({
      key: 'uretici_fiyat',
      ok,
      engel: !ok,
      metin: ok
        ? 'Fiyat, üretici tavsiye fiyatının altında'
        : 'Fiyat üretici tavsiye fiyatının üzerinde; ilan yayınlanamaz',
    });
  } else {
    out.push({
      key: 'uretici_fiyat',
      ok: v.fiyatBeyani,
      engel: !v.fiyatBeyani,
      metin: v.fiyatBeyani
        ? 'Fiyatın üretici tavsiye fiyatını aşmadığı beyan edildi'
        : 'Fiyatın üretici tavsiye fiyatını aşmadığını onayla',
    });
  }
  return out;
}

/** Hasar özeti: "1 lokal boya, değişen yok" */
export function damageSummary(d: Damage): string {
  const say = (s: string) => Object.values(d.parcalar).filter((x) => x === s).length;
  const parca = [
    say('lokal') ? `${say('lokal')} lokal boya` : '',
    say('boya') ? `${say('boya')} boyalı` : '',
    say('degisen') ? `${say('degisen')} değişen` : 'değişen yok',
  ].filter(Boolean);
  return parca.join(', ');
}

// ── Toplu yükleme (Karar 07.2) ──────────────────────────────────

/** Şablon sütunları: başlık → alan. Sıra şablondakiyle aynı. */
export const BULK_COLUMNS = [
  ['Stok no', 'disNo'],
  ['Kategori', 'kategori'],
  ['Marka', 'marka'],
  ['Seri', 'seri'],
  ['Model', 'model'],
  ['Paket', 'paket'],
  ['Model yılı', 'yil'],
  ['Kilometre', 'km'],
  ['Yakıt', 'yakit'],
  ['Vites', 'vites'],
  ['Renk', 'renk'],
  ['Fiyat (TL)', 'fiyat'],
  ['Plaka', 'plaka'],
  ['Şasi son 6', 'sasiSon6'],
  ['İlk tescil (GG.AA.YYYY)', 'ilkTescil'],
  ['Tramer (TL)', 'tramer'],
  ['Takas (E/H)', 'takas'],
  ['Üretici fiyatını aşmıyor (E/H)', 'fiyatBeyani'],
  ['Açıklama', 'aciklama'],
] as const;
export const BULK_MAX_ROWS = 500;

// ── API entegrasyonu (Karar 07.3; yalnızca Kurumsal paket) ───────

export const API_KEY_PREFIX = 'rgk_';
export const apiKeyCreateSchema = z.object({ ad: z.string().trim().min(2).max(60) });
