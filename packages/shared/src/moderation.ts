import { z } from 'zod';

/**
 * Şikâyet ve moderasyon (Karar 13.2, 41, 53; YonetimPazar.dc.html › Moderasyon). Kullanıcı mesajı, talebi ya da
 * portföy aracını şikâyet eder; kural ya da ajan da şikâyet açabilir. Öncelik nedenle belirlenir ve süre sınırı
 * öncelikten gelir. Karar iki tarafa şablonla bildirilir; şikâyet edilen 7 gün içinde itiraz eder.
 */

export const REPORT_TARGETS = ['mesaj', 'talep', 'arac'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
/** Konsolda kullanıcı kartından verilen kararın hedefi hesaptır (Karar 52) */
export type ModerationTarget = ReportTarget | 'kullanici';
export const REPORT_TARGET_NAMES: Record<ModerationTarget, string> = {
  mesaj: 'Mesaj',
  talep: 'Talep',
  arac: 'Portföy aracı',
  kullanici: 'Hesap',
};

export const REPORT_PRIORITIES = ['kritik', 'yuksek', 'normal'] as const;
export type ReportPriority = (typeof REPORT_PRIORITIES)[number];
export const PRIORITY_NAMES: Record<ReportPriority, string> = {
  kritik: 'Kritik',
  yuksek: 'Yüksek',
  normal: 'Normal',
};
/** Karara bağlama süresi (Karar 53): kritik 1 saat, yüksek 4 saat, normal 24 saat */
export const PRIORITY_HOURS: Record<ReportPriority, number> = { kritik: 1, yuksek: 4, normal: 24 };

export interface ReportReason {
  ad: string;
  oncelik: ReportPriority;
  /** Kullanıcının seçebileceği hedefler; boşsa yalnızca kural ve ajan açar */
  hedefler: readonly ReportTarget[];
}

export const REPORT_REASONS = {
  kapora: { ad: 'Kapora ya da ön ödeme istedi', oncelik: 'kritik', hedefler: ['mesaj'] },
  dolandiricilik: { ad: 'Dolandırıcılık şüphesi', oncelik: 'kritik', hedefler: ['mesaj', 'talep', 'arac'] },
  tehdit: { ad: 'Tehdit', oncelik: 'kritik', hedefler: ['mesaj'] },
  sahte: { ad: 'Sahte talep ya da ilan', oncelik: 'yuksek', hedefler: ['talep', 'arac'] },
  hakaret: { ad: 'Hakaret', oncelik: 'yuksek', hedefler: ['mesaj', 'talep'] },
  spam: { ad: 'Spam ya da reklam', oncelik: 'normal', hedefler: ['mesaj', 'talep', 'arac'] },
  yanlis_kategori: { ad: 'Yanlış kategori', oncelik: 'normal', hedefler: ['talep', 'arac'] },
  diger: { ad: 'Diğer', oncelik: 'normal', hedefler: ['mesaj', 'talep', 'arac'] },
  yasakli_kelime: { ad: 'Yasaklı kelime', oncelik: 'normal', hedefler: [] },
  /** İlan kopyalama (sazan sarmalı): başka bir galerinin ilanındaki fotoğrafın kopyası; kural açar */
  kopya_foto: { ad: 'Kopya fotoğraf', oncelik: 'yuksek', hedefler: [] },
} as const satisfies Record<string, ReportReason>;
export type ReportReasonKey = keyof typeof REPORT_REASONS;
export const REPORT_REASON_KEYS = Object.keys(REPORT_REASONS) as ReportReasonKey[];

/** Kullanıcının hedefe göre seçebileceği nedenler */
export function reasonsFor(hedef: ReportTarget): ReportReasonKey[] {
  return REPORT_REASON_KEYS.filter((k) => (REPORT_REASONS[k].hedefler as readonly string[]).includes(hedef));
}

/** Şikâyeti kim açtı */
export const REPORT_SOURCES = ['kullanici', 'kural', 'ajan', 'calisan'] as const;
export type ReportSource = (typeof REPORT_SOURCES)[number];

export const MODERATION_DECISIONS = ['uyari', 'gizle', 'aski', 'engel', 'red'] as const;
export type ModerationDecision = (typeof MODERATION_DECISIONS)[number];
export const DECISION_NAMES: Record<ModerationDecision, string> = {
  uyari: 'Uyarı',
  gizle: 'Mesajı gizle',
  aski: '24 saat askı',
  engel: 'Kalıcı engelleme öner',
  red: 'Şikâyeti reddet',
};
/** Hedefe göre "gizle" düğmesinin adı */
export const HIDE_NAMES: Record<ModerationTarget, string> = {
  mesaj: 'Mesajı gizle',
  talep: 'Talebi yayından kaldır',
  arac: 'Aracı yayından kaldır',
  kullanici: 'Gizlenecek içerik yok',
};
/** Karar açıklaması (YonetimPazar.dc.html › KNOT) */
export const DECISION_NOTES: Record<ModerationDecision, string> = {
  uyari: 'Şablonlu uyarı gider; 30 gün içinde ikinci uyarıda otomatik askı.',
  gizle: 'İçerik yayından kalkar; gönderene gerekçe bildirilir.',
  aski: '24 saat ilk mesaj ve mesaj gönderemez; 7 gün itiraz hakkı.',
  engel: 'Öneri onay kuyruğuna düşer; onaylanınca hesap kapanır. Askı onaya kadar sürer.',
  red: 'Şikâyet edene gerekçe gider; şikâyet edilen bilgilendirilmez.',
};
/** Kararın gerektirdiği yetki (packages/shared/src/staff.ts) */
export const DECISION_PERMISSION = {
  uyari: 'sikayet.coz',
  gizle: 'sikayet.coz',
  red: 'sikayet.coz',
  aski: 'hesap.askiya_al',
  engel: 'hesap.kalici_engelle',
} as const;

/** Kanıtta işaretlerin kısa adı (YonetimPazar.dc.html: "[kapora talebi işaretlendi]") */
export const FLAG_SHORT: Record<string, string> = {
  kapora: 'kapora talebi',
  odeme: 'ödeme isteği',
  iban: 'IBAN',
  telefon: 'telefon numarası',
  baglanti: 'bağlantı',
  supheli: 'şüpheli ödeme ya da teslim yöntemi',
};
export const flagShort = (f: string) => FLAG_SHORT[f] ?? f;

export const SUSPEND_HOURS = 24;
export const APPEAL_DAYS = 7;
/** 30 gün içinde ikinci uyarı otomatik askıdır */
export const WARN_WINDOW_DAYS = 30;
/** Bir kullanıcının günde açabileceği şikâyet */
export const REPORTS_PER_DAY = 10;
/** Ajanın günde verebileceği en fazla askı (Karar 41 güvenlik kuralı) */
export const AGENT_DAILY_SUSPENSIONS = 50;

/** Otomatik içerik filtreleri (konsolda aç/kapat) */
export const CONTENT_FILTERS = {
  tel: {
    ad: 'Telefon numarası tespiti',
    not: 'Telefon iznini kapatan alıcılara gelen mesajlarda numarayı gizler (13.2)',
  },
  kapora: {
    ad: 'Kapora, IBAN ve ödeme isteği uyarısı',
    not: 'Mesajın altına alıcı için uyarı bandı ekler (Karar 25)',
  },
  link: {
    ad: 'Harici bağlantı kontrolü',
    not: 'Bağlantı içeren satıcı mesajında alıcıya uyarı bandı gösterir',
  },
  kelime: {
    ad: 'Yasaklı kelime filtresi',
    not: 'Aşağıdaki listedeki kelimeler talep ve mesajlarda işaretlenir, moderasyona düşer',
  },
} as const;
export type ContentFilterKey = keyof typeof CONTENT_FILTERS;
export const CONTENT_FILTER_KEYS = Object.keys(CONTENT_FILTERS) as ContentFilterKey[];

/** İlk kurulumda yasaklı kelimeler (konsoldan değişir) */
export const DEFAULT_BANNED_WORDS = ['kapora', 'ön ödeme', 'IBAN', 'ödeme iste', 'güvenli ödeme linki'];

/** Metindeki yasaklı kelimeler (Türkçe küçük harfle, kelime içinde de yakalar) */
export function bannedWordsIn(text: string, words: readonly string[]): string[] {
  const t = text.toLocaleLowerCase('tr-TR');
  return words.filter((w) => w.trim() && t.includes(w.toLocaleLowerCase('tr-TR').trim()));
}

/**
 * Kanıt maskesi (Karar 53): telefon numarası ve IBAN maskelenir, bağlantılar işaretlenir. Moderatör içeriği görür ama
 * kişisel veri açık gelmez.
 */
export function maskEvidence(text: string): string {
  return text
    .replace(
      /\bTR\s?\d{2}(?:\s?\d{4}){4,5}(?:\s?\d{1,4})?/gi,
      (m) => `TR•• •••• •••• •••• •••• ${m.replace(/\s/g, '').slice(-4)}`,
    )
    .replace(
      /(?:\+?90[\s.-]?|\b0)?\(?5\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g,
      (m) => `05•• ••• •• ${m.replace(/\D/g, '').slice(-2)}`,
    )
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[bağlantı]');
}

// ── Talep metni (Karar 41, 13.2) ───────────────────────────────

/** Talep başlığı ve açıklamasında aranan iletişim ve ödeme bilgileri */
export const DEMAND_TEXT_FLAGS = {
  telefon: 'telefon numarası',
  iban: 'IBAN',
  eposta: 'e-posta adresi',
  baglanti: 'bağlantı',
  yasakli: 'uygunsuz ifade',
} as const;
export type DemandTextFlag = keyof typeof DEMAND_TEXT_FLAGS;

const T_IBAN = /\bTR\s?\d{2}(?:\s?\d){22}\b/gi;
const T_EPOSTA = /[\p{L}\d._%+-]+@[\p{L}\d.-]+\.[\p{L}]{2,}/gu;
const T_BAGLANTI =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|info|biz|io|me|ly|link|site|online|xyz)(?:\.tr)?(?:\/\S*)?/gi;
// Cep ve sabit hat: +90 / 0 ön ekli ya da 10 hane; boşluk, tire, nokta ve parantezle
const T_TELEFON =
  /(?<!\d)(?:(?:\+|00)90[\s.-]?|0[\s.-]?)?\(?[2-5]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?!\d)/g;

/** Talep metnindeki iletişim ve ödeme bilgileri (yasaklı kelime ayrı, konsoldaki listeden) */
export function scanDemandText(text: string): DemandTextFlag[] {
  const f: DemandTextFlag[] = [];
  const t = text.replace(T_EPOSTA, () => {
    f.push('eposta');
    return ' ';
  });
  if (new RegExp(T_IBAN.source, 'i').test(t)) f.push('iban');
  if (new RegExp(T_TELEFON.source).test(t.replace(new RegExp(T_IBAN.source, 'gi'), ' '))) f.push('telefon');
  if (new RegExp(T_BAGLANTI.source, 'i').test(t)) f.push('baglanti');
  return [...new Set(f)];
}

/**
 * Herkese açık talep metninde telefon, IBAN, e-posta ve bağlantı gizlenir (talep düzeltilene kadar yayında kalır).
 * Talep sahibi kendi taleplerinde asıl metni görür.
 */
export function hideDemandText(text: string): string;
export function hideDemandText(text: string | null): string | null;
export function hideDemandText(text: string | null): string | null {
  if (!text) return text;
  return text
    .replace(T_EPOSTA, '[e-posta gizlendi]')
    .replace(T_IBAN, '[IBAN gizlendi]')
    .replace(T_BAGLANTI, '[bağlantı gizlendi]')
    .replace(T_TELEFON, '[numara gizlendi]');
}

/** Alıcıya giden mesajda numara gizleme (telefon izni kapalıysa; Karar 13.2) */
export function hidePhones(text: string): string {
  return text.replace(
    /(?:\+?90[\s.-]?|\b0)?\(?5\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g,
    '[numara gizlendi]',
  );
}

/** "Emre Kaya" → "Emre K." */
export function shortName(first?: string | null, last?: string | null): string {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  if (!f && !l) return 'Kullanıcı';
  return l ? `${f} ${l.charAt(0).toLocaleUpperCase('tr-TR')}.`.trim() : f;
}

export const reportCreateSchema = z
  .object({
    hedef: z.enum(REPORT_TARGETS),
    /** mesaj: mesaj kimliği; talep ve araç: görünen numara */
    id: z.string().min(1).max(64),
    neden: z.enum(REPORT_REASON_KEYS as [ReportReasonKey, ...ReportReasonKey[]]),
    aciklama: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((b) => (REPORT_REASONS[b.neden].hedefler as readonly string[]).includes(b.hedef), {
    message: 'Bu neden bu içerik için seçilemez',
    path: ['neden'],
  });
export type ReportCreate = z.infer<typeof reportCreateSchema>;

export const moderationDecideSchema = z
  .object({
    karar: z.enum(MODERATION_DECISIONS),
    not: z.string().trim().max(500).optional(),
  })
  .strict();

export const appealCreateSchema = z.object({ metin: z.string().trim().min(10).max(1000) }).strict();
export const appealDecideSchema = z
  .object({ kabul: z.boolean(), not: z.string().trim().max(500).optional() })
  .strict();

export const bannedWordSchema = z.object({ kelime: z.string().trim().min(2).max(40) }).strict();
export const filterSwitchSchema = z.object({ acik: z.boolean() }).strict();
