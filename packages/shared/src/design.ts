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

/** Paletin düzenlenebilen renkleri (tasarımdaki sıra) ve `colors` karşılığı */
export const DESIGN_COLORS = {
  mavi: { ad: 'Mavi · ana renk', not: 'Butonlar, vurgular', anahtar: 'blue' },
  pembe: { ad: 'Pembe', not: 'Acil arıyorum, mesajlar', anahtar: 'pink' },
  sari: { ad: 'Sarı', not: 'Uyarılar, haklar', anahtar: 'yellow' },
  yesil: { ad: 'Yeşil', not: 'Onay, başarı', anahtar: 'green' },
  murekkep: { ad: 'Mürekkep', not: 'Metin', anahtar: 'ink' },
  baglanti: { ad: 'Bağlantı', not: 'Bağlantılar', anahtar: 'link' },
  zemin: { ad: 'Zemin', not: 'Sayfa arka planı', anahtar: 'background' },
  cizgi: { ad: 'Çizgi', not: 'Kart kenarları', anahtar: 'line' },
} as const satisfies Record<string, { ad: string; not: string; anahtar: keyof typeof colors }>;
export type DesignColor = keyof typeof DESIGN_COLORS;
export const DESIGN_COLOR_KEYS = Object.keys(DESIGN_COLORS) as DesignColor[];

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Renk #RRGGBB biçiminde olmalı');

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
    renkler: z.object(
      Object.fromEntries(DESIGN_COLOR_KEYS.map((k) => [k, hex])) as Record<DesignColor, typeof hex>,
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
  renkler: {
    mavi: colors.blue,
    pembe: colors.pink,
    sari: colors.yellow,
    yesil: colors.green,
    murekkep: colors.ink,
    baglanti: colors.link,
    zemin: colors.background,
    cizgi: colors.line,
  },
  yaziTipi: DEFAULT_FONT,
  kartKose: 18,
  butonKose: 14,
  etiketKose: 999,
  temalar: [],
};

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

/**
 * Yayından önce denetim: metin ve bağlantı zemine ve beyaza karşı en az 4,5:1 (WCAG AA); üst bant yazısı banda karşı
 * 4,5:1. Uymayan değerler gerekçesiyle döner.
 */
export function designProblems(t: DesignTokens): string[] {
  const out: string[] = [];
  const oran = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  for (const [k, ad] of [
    ['murekkep', 'Mürekkep'],
    ['baglanti', 'Bağlantı'],
  ] as const) {
    for (const [zemin, zad] of [
      [t.renkler.zemin, 'zemine'],
      ['#FFFFFF', 'beyaza'],
    ] as const) {
      const c = contrast(t.renkler[k], zemin);
      if (c < 4.5) out.push(`${ad} rengi ${zad} karşı okunmuyor (${oran(c)}:1, en az 4,5:1)`);
    }
  }
  for (const th of t.temalar) {
    const c = contrast(th.ustYazi, th.ustBant);
    if (c < 4.5) out.push(`${th.ad}: üst bant yazısı okunmuyor (${oran(c)}:1, en az 4,5:1)`);
  }
  return out;
}

/** Konsoldaki renk notu: metin renklerinde karşıtlık ("Metin · zemine karşıtlık 15:1") */
export function colorNote(k: DesignColor, t: DesignTokens): string {
  const base = DESIGN_COLORS[k].not;
  if (k !== 'murekkep' && k !== 'baglanti') return base;
  const c = contrast(t.renkler[k], t.renkler.zemin);
  return `${base} · zemine karşıtlık ${c.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}:1`;
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
    '--rr-ust-bant': tema?.ustBant ?? '#FFFFFF',
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
}

/** Herkese açık yanıt (GET /tasarim) */
export interface PublicDesign {
  surum: number;
  degerler: DesignTokens;
  tema: SeasonalTheme | null;
  font: { ad: string; css: string /** Mobil: kalınlık → TTF adresi */; dosyalar: Record<string, string> };
}
