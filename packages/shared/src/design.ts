import { z } from 'zod';
import { colors } from './tokens.js';

/**
 * Tasarım değerleri (Karar 46; YonetimIcerik.dc.html › Tasarım değerleri). Web, mobil uygulama ve e-posta şablonları aynı
 * değerleri kullanır: Gökkuşağı paletinin sekiz rengi, yazı tipi, köşeler ve tarihli mevsimsel temalar. Değişiklik sürümlü
 * yayınlanır; sahip ya da yönetici onaylar (DESIGN_TOKENS). Logo değişmez (dört renkli çubuk + "rengarenk").
 */

/** Yazı tipi türleri (konsoldaki süzgeç) */
export const FONT_TYPES = {
  duz: 'Düz (sans)',
  tirnakli: 'Tırnaklı (serif)',
  gosterisli: 'Gösterişli',
} as const;
export type FontType = keyof typeof FONT_TYPES;

/**
 * Seçilebilen yazı tipleri: Google Fonts kataloğunda Türkçe karakterleri (latin-ext) ve 400 ile 700 kalınlıkları olanlar
 * (katalogdan doğrulandı, 10 Kasım 2026). `agirliklar`: yüklenecek kalınlıklar (400–800 arasında olanlar); eksik kalınlık
 * en yakın olanla gösterilir.
 */
export const FONTS: readonly { ad: string; tur: FontType; agirliklar: readonly number[] }[] = [
  { ad: 'Plus Jakarta Sans', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Inter', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Manrope', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Nunito', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Nunito Sans', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Poppins', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Montserrat', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Rubik', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Work Sans', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'DM Sans', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Outfit', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Urbanist', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Figtree', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Lexend', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Sora', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Mulish', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Raleway', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Open Sans', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Roboto', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Lato', tur: 'duz', agirliklar: [400, 700] },
  { ad: 'Source Sans 3', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'IBM Plex Sans', tur: 'duz', agirliklar: [400, 500, 600, 700] },
  { ad: 'Noto Sans', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Fira Sans', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Barlow', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Quicksand', tur: 'duz', agirliklar: [400, 500, 600, 700] },
  { ad: 'Karla', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Red Hat Display', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Albert Sans', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Onest', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Golos Text', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Be Vietnam Pro', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Space Grotesk', tur: 'duz', agirliklar: [400, 500, 600, 700] },
  { ad: 'Lexend Deca', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Hanken Grotesk', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Instrument Sans', tur: 'duz', agirliklar: [400, 500, 600, 700] },
  { ad: 'Schibsted Grotesk', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Bricolage Grotesque', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Wix Madefor Display', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Readex Pro', tur: 'duz', agirliklar: [400, 500, 600, 700] },
  { ad: 'Kumbh Sans', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Encode Sans', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Public Sans', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Archivo', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Exo 2', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Titillium Web', tur: 'duz', agirliklar: [400, 600, 700] },
  { ad: 'Ubuntu', tur: 'duz', agirliklar: [400, 500, 700] },
  { ad: 'Comfortaa', tur: 'gosterisli', agirliklar: [400, 500, 600, 700] },
  { ad: 'Josefin Sans', tur: 'duz', agirliklar: [400, 500, 600, 700] },
  { ad: 'Cabin', tur: 'duz', agirliklar: [400, 500, 600, 700] },
  { ad: 'Heebo', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Jost', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Overpass', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Libre Franklin', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Merriweather Sans', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'PT Sans', tur: 'duz', agirliklar: [400, 700] },
  { ad: 'Noto Serif', tur: 'tirnakli', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Merriweather', tur: 'tirnakli', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Playfair Display', tur: 'tirnakli', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Lora', tur: 'tirnakli', agirliklar: [400, 500, 600, 700] },
  { ad: 'Roboto Slab', tur: 'tirnakli', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Bitter', tur: 'tirnakli', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Libre Baskerville', tur: 'tirnakli', agirliklar: [400, 500, 600, 700] },
  { ad: 'Source Serif 4', tur: 'tirnakli', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Fraunces', tur: 'tirnakli', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Rethink Sans', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Gabarito', tur: 'gosterisli', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Geologica', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
  { ad: 'Afacad', tur: 'duz', agirliklar: [400, 500, 600, 700] },
  { ad: 'Reddit Sans', tur: 'duz', agirliklar: [400, 500, 600, 700, 800] },
];
export const FONT_NAMES = FONTS.map((f) => f.ad);
export const DEFAULT_FONT = 'Plus Jakarta Sans';

/** Konsoldaki renk grupları */
export const DESIGN_COLOR_GROUPS = {
  palet: 'Gökkuşağı paleti',
  yazi: 'Renkli zeminlerin üstündeki yazı',
  yuzey: 'Metin ve yüzeyler',
} as const;

/**
 * Düzenlenebilen renkler (tasarımdaki sıra) ve `colors` karşılığı. `zemin`: yazı renginin üstünde durduğu renk (karşıtlık
 * denetimi). Sonradan eklenen renklerin varsayılanı eski görünümdür (önceki sürümler değişmeden okunur).
 */
export const DESIGN_COLORS = {
  mavi: { ad: 'Mavi · ana renk', not: 'Butonlar, vurgular', anahtar: 'blue', grup: 'palet' },
  pembe: { ad: 'Pembe', not: 'Acil arıyorum, mesajlar', anahtar: 'pink', grup: 'palet' },
  sari: { ad: 'Sarı', not: 'Uyarılar, haklar', anahtar: 'yellow', grup: 'palet' },
  yesil: { ad: 'Yeşil', not: 'Onay, başarı', anahtar: 'green', grup: 'palet' },
  maviYazi: {
    ad: 'Mavi üstündeki yazı',
    not: 'Talep oluştur, Ara ve diğer mavi butonlar',
    anahtar: 'onBlue',
    grup: 'yazi',
    zemin: 'mavi',
  },
  pembeYazi: {
    ad: 'Pembe üstündeki yazı',
    not: 'Pembe rozetler ve sayaçlar',
    anahtar: 'onPink',
    grup: 'yazi',
    zemin: 'pembe',
  },
  sariYazi: {
    ad: 'Sarı üstündeki yazı',
    not: 'Sarı butonlar ve etiketler',
    anahtar: 'onYellow',
    grup: 'yazi',
    zemin: 'sari',
  },
  yesilYazi: {
    ad: 'Yeşil üstündeki yazı',
    not: 'Yeşil butonlar ve onaylar',
    anahtar: 'onGreen',
    grup: 'yazi',
    zemin: 'yesil',
  },
  murekkep: { ad: 'Mürekkep', not: 'Metin', anahtar: 'ink', grup: 'yuzey' },
  soluk: { ad: 'İkincil metin', not: 'Açıklamalar, tarih ve konum', anahtar: 'muted', grup: 'yuzey' },
  baglanti: { ad: 'Bağlantı', not: 'Bağlantılar', anahtar: 'link', grup: 'yuzey' },
  zemin: { ad: 'Zemin', not: 'Sayfa arka planı', anahtar: 'background', grup: 'yuzey' },
  kart: { ad: 'Kart zemini', not: 'Kartlar, kutular, üst çubuk', anahtar: 'surface', grup: 'yuzey' },
  cizgi: { ad: 'Çizgi', not: 'Kart kenarları', anahtar: 'line', grup: 'yuzey' },
} as const satisfies Record<
  string,
  {
    ad: string;
    not: string;
    anahtar: keyof typeof colors;
    grup: keyof typeof DESIGN_COLOR_GROUPS;
    zemin?: string;
  }
>;
export type DesignColor = keyof typeof DESIGN_COLORS;
export const DESIGN_COLOR_KEYS = Object.keys(DESIGN_COLORS) as DesignColor[];

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Renk #RRGGBB biçiminde olmalı');
/** Varsayılan renk değerleri (`colors`'tan) */
const ILK_RENK = Object.fromEntries(
  DESIGN_COLOR_KEYS.map((k) => [k, colors[DESIGN_COLORS[k].anahtar] as string]),
) as Record<DesignColor, string>;

/** Mevsimsel tema: tarih aralığında üst bant, logonun yanındaki rozet ve e-posta başlığı değişir; renkler değişmez */
export const seasonalThemeSchema = z
  .object({
    id: z.string().min(1).max(40),
    ad: z.string().trim().min(2).max(60),
    /** Türkiye saatiyle gün (YYYY-AA-GG); bitiş günü dahil */
    baslangic: z.iso.date(),
    bitis: z.iso.date(),
    ustBant: hex,
    ustYazi: hex,
    rozet: z.string().trim().max(30),
    /** Ana sayfa bannerı Banner ve vitrin'den zamanlanır; burada yalnızca not */
    not: z.string().trim().max(160).default(''),
  })
  .strict()
  .refine((t) => t.bitis >= t.baslangic, { message: 'Bitiş başlangıçtan önce olamaz', path: ['bitis'] });
export type SeasonalTheme = z.infer<typeof seasonalThemeSchema>;

export const designTokensSchema = z
  .object({
    // Eksik renk (önceki sürümlerde olmayan) varsayılanla tamamlanır
    renkler: z.object(
      Object.fromEntries(DESIGN_COLOR_KEYS.map((k) => [k, hex.default(ILK_RENK[k])])) as Record<
        DesignColor,
        z.ZodDefault<typeof hex>
      >,
    ),
    yaziTipi: z.enum(FONT_NAMES as [string, ...string[]]),
    /** px */
    kartKose: z.number().int().min(0).max(32),
    butonKose: z.number().int().min(0).max(28),
    /** 999: tam yuvarlak */
    etiketKose: z.number().int().min(0).max(999),
    temalar: z.array(seasonalThemeSchema).max(20),
  })
  .strict();
export type DesignTokens = z.infer<typeof designTokensSchema>;

export const DEFAULT_DESIGN: DesignTokens = {
  renkler: { ...ILK_RENK },
  yaziTipi: DEFAULT_FONT,
  kartKose: 18,
  butonKose: 14,
  etiketKose: 999,
  temalar: [],
};

/** Tasarım dosyalarındaki köşeler (oranların tabanı) */
export const DEFAULT_DESIGN_KOSE = { kart: 18, buton: 14 } as const;

/**
 * Köşeler (mobil): yayındaki tasarım değerleriyle güncellenir (`applyDesignColors`). Web CSS değişkeni kullanır
 * (`--rr-kart-kose` …); mobil bileşenler `radii.kart` gibi okur.
 */
export const radii = { kart: 18, buton: 14, etiket: 999 };

/**
 * Oranlı köşe (Karar 46): tasarımdaki her köşe kendi grubuna (kart 18, buton 14) oranla büyür ve küçülür; değer 0
 * seçilirse bütün köşeler kalkar. Ör. tasarımda 16 px olan kart köşesi: `kartOran(16)`. Tam daireler (avatar, nokta)
 * değişmez.
 */
export const kartOran = (px: number) => (radii.kart * px) / DEFAULT_DESIGN_KOSE.kart;
export const butonOran = (px: number) => (radii.buton * px) / DEFAULT_DESIGN_KOSE.buton;
/** Web: aynı oran CSS değişkeniyle (`calc(var(--rr-kart-kose) * 16 / 18)`) */
export const kartOranCss = (px: number) => `calc(var(--rr-kart-kose) * ${px} / ${DEFAULT_DESIGN_KOSE.kart})`;
export const butonOranCss = (px: number) =>
  `calc(var(--rr-buton-kose) * ${px} / ${DEFAULT_DESIGN_KOSE.buton})`;

/** Varsayılan renkler (değişmeden önceki değerler; e-posta ve mobil sıfırlama için) */
const BASLANGIC = { ...colors };

// ── Okunabilirlik (WCAG 2) ─────────────────────────────────────

function parlaklik(h: string) {
  const c = [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** İki renk arasındaki karşıtlık oranı (1–21) */
export function contrast(a: string, b: string): number {
  const [x, y] = [parlaklik(a), parlaklik(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

const oranYaz = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
/** Renkli zemin üstündeki yazının alt sınırı: altında onaya gönderilemez (kalın buton yazısı, WCAG 1.4.11) */
export const RENKLI_YAZI_EN_AZ = 3;

/**
 * Yayından önce denetim: metin, ikincil metin ve bağlantı zemine ve kart zeminine karşı en az 4,5:1 (WCAG AA); renkli
 * zemin üstündeki yazı en az 3:1; üst bant yazısı banda karşı 4,5:1. Uymayan değerler gerekçesiyle döner.
 */
export function designProblems(t: DesignTokens): string[] {
  const out: string[] = [];
  for (const [k, ad] of [
    ['murekkep', 'Mürekkep'],
    ['soluk', 'İkincil metin'],
    ['baglanti', 'Bağlantı'],
  ] as const) {
    for (const [zemin, zad] of [
      [t.renkler.zemin, 'zemine'],
      [t.renkler.kart, 'kart zeminine'],
    ] as const) {
      const c = contrast(t.renkler[k], zemin);
      if (c < 4.5) out.push(`${ad} rengi ${zad} karşı okunmuyor (${oranYaz(c)}:1, en az 4,5:1)`);
    }
  }
  for (const k of DESIGN_COLOR_KEYS) {
    const z = (DESIGN_COLORS[k] as { zemin?: DesignColor }).zemin;
    if (!z) continue;
    const c = contrast(t.renkler[k], t.renkler[z]);
    if (c < RENKLI_YAZI_EN_AZ)
      out.push(`${DESIGN_COLORS[k].ad} okunmuyor (${oranYaz(c)}:1, en az ${RENKLI_YAZI_EN_AZ}:1)`);
  }
  for (const th of t.temalar) {
    const c = contrast(th.ustYazi, th.ustBant);
    if (c < 4.5) out.push(`${th.ad}: üst bant yazısı okunmuyor (${oranYaz(c)}:1, en az 4,5:1)`);
  }
  return out;
}

/**
 * Uyarılar (gönderimi engellemez): renkli zemin üstündeki yazı 3:1 ile 4,5:1 arasındaysa küçük yazıda zor okunur.
 */
export function designWarnings(t: DesignTokens): string[] {
  const out: string[] = [];
  for (const k of DESIGN_COLOR_KEYS) {
    const z = (DESIGN_COLORS[k] as { zemin?: DesignColor }).zemin;
    if (!z) continue;
    const c = contrast(t.renkler[k], t.renkler[z]);
    if (c >= RENKLI_YAZI_EN_AZ && c < 4.5)
      out.push(
        `${DESIGN_COLORS[k].ad}: ${oranYaz(c)}:1, kalın yazıda okunur, küçük yazıda zorlaşır (önerilen 4,5:1)`,
      );
  }
  return out;
}

/** Konsoldaki renk notu: metin renklerinde ve renkli zemin yazısında karşıtlık ("Metin · zemine karşıtlık 15:1") */
export function colorNote(k: DesignColor, t: DesignTokens): string {
  const r = DESIGN_COLORS[k] as { not: string; zemin?: DesignColor };
  if (r.zemin) return `${r.not} · karşıtlık ${oranYaz(contrast(t.renkler[k], t.renkler[r.zemin]))}:1`;
  if (k !== 'murekkep' && k !== 'baglanti' && k !== 'soluk') return r.not;
  return `${r.not} · zemine karşıtlık ${oranYaz(contrast(t.renkler[k], t.renkler.zemin))}:1`;
}

/** Tarihe göre geçerli tema (Türkiye saatiyle gün) */
export function activeTheme(t: Pick<DesignTokens, 'temalar'>, now = new Date()): SeasonalTheme | null {
  const gun = new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
  return t.temalar.find((th) => th.baslangic <= gun && gun <= th.bitis) ?? null;
}

/** Temanın konsoldaki durumu */
export function themeStatus(th: SeasonalTheme, now = new Date()): 'Zamanlandı' | 'Yayında' | 'Bitti' {
  const gun = new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
  return gun < th.baslangic ? 'Zamanlandı' : gun > th.bitis ? 'Bitti' : 'Yayında';
}

/** Web: CSS değişkenleri (`:root` içine yazılır) */
export function designCssVars(t: DesignTokens, tema: SeasonalTheme | null = null): Record<string, string> {
  const v: Record<string, string> = {
    '--rr-font': `'${t.yaziTipi}', system-ui, sans-serif`,
    '--rr-kart-kose': `${t.kartKose}px`,
    '--rr-buton-kose': `${t.butonKose}px`,
    '--rr-etiket-kose': `${t.etiketKose}px`,
    '--rr-ust-bant': tema?.ustBant ?? t.renkler.kart,
    '--rr-ust-yazi': tema?.ustYazi ?? t.renkler.murekkep,
  };
  for (const k of DESIGN_COLOR_KEYS) v[`--rr-${k}`] = t.renkler[k];
  return v;
}

/** Google Fonts CSS adresi (web ve konsol önizlemesi) */
export function fontCssUrl(ad: string): string {
  const f = FONTS.find((x) => x.ad === ad) ?? FONTS.find((x) => x.ad === DEFAULT_FONT);
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f?.ad ?? DEFAULT_FONT).replace(/%20/g, '+')}:wght@${(
    f?.agirliklar ?? [400, 700]
  ).join(';')}&display=swap`;
}

/**
 * Mobil ve e-posta: ortak `colors` nesnesine yayındaki renkleri yazar (uygulama açılırken ve işçi/API süreçlerinde).
 * `null` verilirse başlangıç değerlerine döner.
 */
export function applyDesignColors(t: DesignTokens | null) {
  const hedef = colors as unknown as Record<string, string>;
  for (const k of DESIGN_COLOR_KEYS) {
    const a = DESIGN_COLORS[k].anahtar;
    hedef[a] = t ? t.renkler[k] : ((BASLANGIC as Record<string, string>)[a] as string);
  }
  radii.kart = t?.kartKose ?? DEFAULT_DESIGN.kartKose;
  radii.buton = t?.butonKose ?? DEFAULT_DESIGN.butonKose;
  radii.etiket = t?.etiketKose ?? DEFAULT_DESIGN.etiketKose;
}

/** Herkese açık yanıt (GET /tasarim) */
export interface PublicDesign {
  surum: number;
  degerler: DesignTokens;
  tema: SeasonalTheme | null;
  font: { ad: string; css: string /** Mobil: kalınlık → TTF adresi */; dosyalar: Record<string, string> };
}
