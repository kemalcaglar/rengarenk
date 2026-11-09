import { z } from 'zod';

/**
 * Rengarenk Ajanı ve yapay zekâ katmanı (Karar 41, 57; Teknik tasarım §10). Görevler, bütçe, maskeleme ve ajanın
 * günlük sınırları burada tanımlıdır; konsol ekranları (YonetimEkip › ajan, YonetimSistem › yz) aynı listeyi okur.
 */

/** Yapay zekâ görevleri (tasarımdaki sıra). Kritik görev bütçe sınırında da çalışır (Karar 57). */
export const AI_TASKS = {
  moderasyon: { ad: 'Moderasyon ve dolandırıcılık', kritik: true },
  destek: { ad: 'Destek taslakları ve yanıtlar', kritik: false },
  talep_asistani: { ad: 'Talep asistanı', kritik: false },
  mesaj_guvenligi: { ad: 'Mesaj güvenliği', kritik: true },
  rapor: { ad: 'Raporlar ve neden analizi', kritik: false },
  kampanya: { ad: 'Kampanya ve şablon metinleri', kritik: false },
  toplu_yukleme: { ad: 'Toplu portföy yükleme', kritik: false },
} as const;
export type AiTask = keyof typeof AI_TASKS;
export const AI_TASK_KEYS = Object.keys(AI_TASKS) as AiTask[];

/** Aylık sınır (USD): başlangıç 150, konsolda 25'er adımla, en az 25 */
export const AI_BUDGET = {
  baslangicUsd: 150,
  adimUsd: 25,
  enAzUsd: 25,
  enCokUsd: 5000,
  uyariOrani: 0.8,
} as const;

/**
 * Model boyları (Teknik tasarım §10): sınıflandırma gibi basit işlerde küçük, taslak ve neden analizinde büyük model.
 * Fiyatlar 1 milyon token başına USD; sözleşme imzalanınca güncel fiyat listesiyle doğrulanır.
 */
export const AI_MODELS = {
  kucuk: { id: 'gemini-2.5-flash', girdiUsd: 0.3, ciktiUsd: 2.5 },
  buyuk: { id: 'gemini-2.5-pro', girdiUsd: 1.25, ciktiUsd: 10 },
} as const;
export type AiModelSize = keyof typeof AI_MODELS;

/** Bir çağrının maliyeti, milyonda bir USD (tamsayı) */
export function aiCostMicroUsd(size: AiModelSize, inputTokens: number, outputTokens: number): number {
  const m = AI_MODELS[size];
  return Math.ceil(inputTokens * m.girdiUsd + outputTokens * m.ciktiUsd);
}

/** "41 USD" / "4,1 $" biçimleri için */
export const microToUsd = (micro: number) => micro / 1_000_000;

export const aiBudgetSchema = z
  .object({ limitUsd: z.number().int().min(AI_BUDGET.enAzUsd).max(AI_BUDGET.enCokUsd) })
  .strict();
export const aiTaskSwitchSchema = z.object({ enabled: z.boolean() }).strict();

// ── Maskeleme ──────────────────────────────────────────────────

/** Panelde görünen kurallar (YonetimSistem › yz › Maskeleme kuralları) */
export const MASK_RULES = [
  { key: 'telefon', ad: 'Telefon', ornek: '0532 418 22 41', sonuc: '[TELEFON_1]' },
  { key: 'eposta', ad: 'E-posta', ornek: 'ayse@ornek.com', sonuc: '[EPOSTA_1]' },
  { key: 'iban', ad: 'IBAN', ornek: 'TR12 0006 …', sonuc: '[IBAN_1]' },
  { key: 'tckn', ad: 'T.C. kimlik no', ornek: '11 haneli sayı', sonuc: '[TCKN]' },
  { key: 'plaka', ad: 'Plaka', ornek: '34 ABC 123', sonuc: '[PLAKA_1]' },
  { key: 'kisi', ad: 'Ad soyad', ornek: 'Ayşe Yılmaz', sonuc: '[KİŞİ_1]' },
] as const;

const PATTERNS: { tur: string; re: RegExp; geriKonur: boolean }[] = [
  { tur: 'EPOSTA', re: /[\p{L}\d._%+-]+@[\p{L}\d.-]+\.[\p{L}]{2,}/gu, geriKonur: true },
  // IBAN: TR + 24 hane, aralarda boşluk olabilir
  { tur: 'IBAN', re: /\bTR\s?\d{2}(?:\s?\d){22}\b/gi, geriKonur: true },
  // Telefon: +90 / 0 ön ekli ya da 10 hane (5xx, 2xx, 3xx, 4xx), boşluk, tire, nokta ve parantezle
  {
    tur: 'TELEFON',
    re: /(?<!\d)(?:(?:\+|00)90[\s.-]?|0[\s.-]?)?\(?[2-5]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?!\d)/g,
    geriKonur: true,
  },
  // T.C. kimlik no: 11 hane, ilk hane 0 değil. Geri konmaz.
  { tur: 'TCKN', re: /(?<!\d)[1-9]\d{10}(?!\d)/g, geriKonur: false },
  // Plaka: il kodu (01–81), 1–3 harf, 2–5 hane
  {
    tur: 'PLAKA',
    re: /(?<![\p{L}\d])(?:0[1-9]|[1-7]\d|8[01])\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,5}(?![\p{L}\d])/gu,
    geriKonur: true,
  },
];

export interface Masked {
  text: string;
  /** Yer tutucu → asıl değer (yalnızca geri konabilenler; T.C. kimlik no hiç saklanmaz) */
  map: Record<string, string>;
  /** Tür başına kaç değer maskelendi */
  sayim: Record<string, number>;
}

const kacir = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Kişisel veriyi yer tutucuyla değiştirir (Karar 41, 57). Ad soyad metinden tahmin edilmez; isteğe konu kişilerin
 * bilinen adları `names` ile verilir. Aynı değer aynı yer tutucuyu alır.
 */
export function maskPii(input: string, opts: { names?: (string | null | undefined)[] } = {}): Masked {
  let text = input;
  const map: Record<string, string> = {};
  const sayim: Record<string, number> = {};
  const seen = new Map<string, string>();
  const yer = (tur: string, deger: string, geriKonur: boolean) => {
    if (!geriKonur) {
      sayim[tur] = (sayim[tur] ?? 0) + 1;
      return `[${tur}]`;
    }
    const anahtar = `${tur}:${deger.replace(/\s+/g, '').toLocaleLowerCase('tr')}`;
    const var_ = seen.get(anahtar);
    if (var_) return var_;
    sayim[tur] = (sayim[tur] ?? 0) + 1;
    const t = `[${tur}_${sayim[tur]}]`;
    seen.set(anahtar, t);
    map[t] = deger;
    return t;
  };
  for (const p of PATTERNS) text = text.replace(p.re, (m) => yer(p.tur, m, p.geriKonur));
  const adlar = [
    ...new Set(
      (opts.names ?? [])
        .flatMap((n) => (n ? [n.trim(), ...n.trim().split(/\s+/)] : []))
        .filter((n) => n.length >= 2),
    ),
  ].sort((a, b) => b.length - a.length);
  for (const ad of adlar) {
    const re = new RegExp(`(?<![\\p{L}])${kacir(ad)}(?![\\p{L}])`, 'giu');
    text = text.replace(re, (m) => yer('KİŞİ', m, true));
  }
  return { text, map, sayim };
}

/** Yanıttaki yer tutucuları asıl değerlerle değiştirir */
export function unmaskPii(text: string, map: Record<string, string>): string {
  return text.replace(/\[[A-ZÇĞİÖŞÜ]+_\d+\]/gu, (t) => map[t] ?? t);
}

// ── Ajan ───────────────────────────────────────────────────────

/** Günlük işlem sınırları (Karar 41 güvenlik kuralları) */
export const AGENT_LIMITS = { aski: 50, otomatikYanit: 500 } as const;

/** Ajanın kendi yaptığı işlem türleri; geri alınabilenler konsolda "Geri al" düğmesi taşır */
export const AGENT_ACTION_KINDS = {
  mesaj_gizle: { ad: 'Mesaj gizleme ve askı', geriAlinir: true, izin: 'sikayet.coz' },
  galeri_onay: { ad: 'Galeri başvurusu onayı', geriAlinir: true, izin: 'galeri_basvuru.onayla' },
  ticari_durdur: { ad: 'Ticari e-postayı durdurma', geriAlinir: true, izin: 'sistem.ayarla' },
  iade_onerisi: { ad: 'İade önerisi', geriAlinir: false, izin: null },
  imha_sayimi: { ad: 'İmha listesi sayımı', geriAlinir: false, izin: null },
  ozet: { ad: 'Günlük özet', geriAlinir: false, izin: null },
  insana: { ad: 'İnsana bırakıldı', geriAlinir: false, izin: null },
} as const;
export type AgentActionKind = keyof typeof AGENT_ACTION_KINDS;

/** Öneri türleri ve rozet renkleri (tasarımla aynı) */
export const AGENT_SUGGESTION_KINDS = {
  kampanya: { ad: 'Kampanya fikri', bg: '#F3EFFF', fg: '#4B2FA6' },
  kural: { ad: 'Kural önerisi', bg: '#EEF3FF', fg: '#2450C8' },
  gelir: { ad: 'Gelir', bg: '#FFF6DF', fg: '#7A5300' },
} as const;
export type AgentSuggestionKind = keyof typeof AGENT_SUGGESTION_KINDS;

export const agentAskSchema = z.object({ soru: z.string().trim().min(3).max(300) }).strict();
export const agentRunSchema = z.object({ calisiyor: z.boolean() }).strict();
