import { z } from 'zod';

/**
 * Kategori şeması (Karar 45, Teknik tasarım §5). Her kategori sürümü kendi alanlarını, kurallarını ve
 * eşleştirme ağırlıklarını taşır; taban şema (konum, bütçe, açıklama) koddadır ve her kategoriye eklenir.
 * Web, mobil ve API talebi aynı tanımdan üretilen doğrulayıcıyla denetler (`demandSchema`).
 */

// ── Alan tipleri ──────────────────────────────────────────────

export const FIELD_TYPES = [
  'boolean',
  'select',
  'multiselect',
  'range',
  'number',
  'text',
  'catalog',
  'location',
  'paint',
  'daterange',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Konsoldan eklenebilen tipler, tasarımdaki sırayla (YonetimIcerik › Alan ekle). Diğerleri sistem tipidir. */
export const EDITABLE_FIELD_TYPES = ['boolean', 'select', 'multiselect', 'range', 'number', 'text'] as const;
export type EditableFieldType = (typeof EDITABLE_FIELD_TYPES)[number];

export const FIELD_TYPE_NAMES: Record<FieldType, string> = {
  boolean: 'Evet / hayır',
  select: 'Seçim',
  multiselect: 'Çoklu seçim',
  range: 'Aralık',
  number: 'Sayı',
  text: 'Metin',
  catalog: 'Katalog seçimi',
  location: 'Konum',
  paint: 'Boya ve değişen şeması',
  daterange: 'Tarih aralığı',
};

/** Alanın değeri nereden gelir (konsoldaki "Kaynak" sütunu). */
export const FIELD_SOURCES = ['taban', 'katalog', 'liste', 'alici'] as const;
export type FieldSource = (typeof FIELD_SOURCES)[number];
export const FIELD_SOURCE_NAMES: Record<FieldSource, string> = {
  taban: 'Taban şema',
  katalog: 'Katalog',
  liste: 'Liste',
  alici: 'Alıcı girer',
};

/** Talep sihirbazındaki adım (Sihirbaz.dc.html: kategori, ana araç, kriterler, boya ve hasar, konum, önizleme). */
export const WIZARD_STEPS = ['ana_arac', 'kriterler', 'boya_hasar', 'konum_iletisim'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];
export const WIZARD_STEP_NAMES: Record<WizardStep, string> = {
  ana_arac: 'Ana araç',
  kriterler: 'Kriterler',
  boya_hasar: 'Boya ve hasar',
  konum_iletisim: 'Konum ve iletişim',
};

/**
 * Sert koşul: `yes` eşleşmeden önce eler, `strict` yalnızca alıcı "kesin" dediyse eler (vites, yakıt),
 * `no` yalnızca ağırlıkla skora katılır (Teknik tasarım §6).
 */
export const HARD_MODES = ['no', 'yes', 'strict'] as const;
export type HardMode = (typeof HARD_MODES)[number];

export const MAX_WEIGHT = 40;
/** Bir talepte en çok alternatif sayısı (Karar 05: ana araç sabit, diğer kriterler alternatifli). */
export const MAX_ALTERNATIVES = 5;

/** Boya ve değişen şemasının 13 parçası (Sihirbaz.dc.html, adım 4). */
export const PAINT_PARTS = [
  { key: 'onTampon', ad: 'Ön tampon' },
  { key: 'motorKaputu', ad: 'Motor kaputu' },
  { key: 'tavan', ad: 'Tavan' },
  { key: 'arkaKaput', ad: 'Arka kaput' },
  { key: 'arkaTampon', ad: 'Arka tampon' },
  { key: 'solOnCamurluk', ad: 'Sol ön çamurluk' },
  { key: 'solOnKapi', ad: 'Sol ön kapı' },
  { key: 'solArkaKapi', ad: 'Sol arka kapı' },
  { key: 'solArkaCamurluk', ad: 'Sol arka çamurluk' },
  { key: 'sagOnCamurluk', ad: 'Sağ ön çamurluk' },
  { key: 'sagOnKapi', ad: 'Sağ ön kapı' },
  { key: 'sagArkaKapi', ad: 'Sağ arka kapı' },
  { key: 'sagArkaCamurluk', ad: 'Sağ arka çamurluk' },
] as const;
/** Parça başına kabul edilen en kötü durum: orijinal < lokal boya < boya < değişen */
export const PAINT_STATES = [
  { key: 'orijinal', ad: 'Orijinal', renk: '#EEF0F5' },
  { key: 'lokal', ad: 'Lokal boya', renk: '#FFE08A' },
  { key: 'boya', ad: 'Boya', renk: '#9EC1FF' },
  { key: 'degisen', ad: 'Değişen', renk: '#FF9C9C' },
] as const;

// ── Tanım şeması ──────────────────────────────────────────────

const FIELD_KEY = /^[a-z][a-zA-Z0-9]{1,39}$/;
const OPTION_KEY = /^[a-z0-9][a-z0-9_]{0,39}$/;

export const fieldOptionSchema = z
  .object({
    value: z.string().regex(OPTION_KEY, 'Seçenek kodu küçük harf, rakam ve alt çizgi olmalı'),
    label: z.string().trim().min(1).max(60),
    /** Renk seçeneklerinde gösterilen renk */
    hex: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
  })
  .strict();
export type FieldOption = z.infer<typeof fieldOptionSchema>;

export const categoryFieldSchema = z
  .object({
    key: z.string().regex(FIELD_KEY, 'Alan kodu harfle başlamalı, yalnızca harf ve rakam içermeli'),
    label: z.string().trim().min(2, 'Alan adı en az 2 karakter').max(80),
    type: z.enum(FIELD_TYPES),
    required: z.boolean(),
    filter: z.boolean(),
    hard: z.enum(HARD_MODES),
    /** Eşleşme skorundaki ağırlık; 0 kullanılmaz demektir */
    weight: z.number().int().min(0).max(MAX_WEIGHT),
    source: z.enum(FIELD_SOURCES),
    /** Kaynak sütununda kaynağın yanına yazılan not (ör. "TSB ve açık kaynaklar") */
    sourceNote: z.string().trim().max(80).optional(),
    /** Eşleştirme ayarında görünen ad (verilmezse alan adı) */
    matchName: z.string().trim().max(60).optional(),
    options: z.array(fieldOptionSchema).max(80).optional(),
    unit: z.string().trim().max(12).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.enum(WIZARD_STEPS),
    /** `alternatif`: her alternatif için ayrı girilir (Karar 05); `talep`: talepte bir kez */
    scope: z.enum(['talep', 'alternatif']),
    /** Yalnızca başka bir alanın seçimi şuysa görünür (ör. pickup kabini yalnızca pickup seçilince) */
    when: z
      .object({ field: z.string().regex(FIELD_KEY), in: z.array(z.string()).min(1).max(20) })
      .strict()
      .optional(),
    help: z.string().trim().max(240).optional(),
  })
  .strict();
export type CategoryField = z.infer<typeof categoryFieldSchema>;

export const VERIFICATIONS = [
  { key: 'yetki_belgesi', ad: 'Yetki belgesi' },
  { key: 'kiralama_yetki', ad: 'Kiralama yetki belgesi' },
  { key: 'vergi_levhasi', ad: 'Vergi levhası' },
  { key: 'mersis', ad: 'MERSİS' },
  { key: 'turizm_belgesi', ad: 'Turizm işletmesi belgesi' },
] as const;
export type VerificationKey = (typeof VERIFICATIONS)[number]['key'];

export const CATALOG_SOURCES = [
  { key: 'tsb', ad: 'TSB aylık (ana kaynak) + açık veri setleri · otomatik' },
  { key: 'acik', ad: 'Açık veri setleri + TSB · otomatik' },
  { key: 'motosiklet', ad: 'TSB + VehiclesDB · otomatik' },
  { key: 'ticari', ad: 'TSB (hafif ticari) + VehiclesDB + kullanıcı girdileri' },
  { key: 'klasik', ad: 'Wikidata, vehicle-makes-models ve yerli klasikler + kullanıcı girdileri' },
  { key: 'ana', ad: 'Ana kategorinin kataloğu' },
  { key: 'hava', ad: 'FAA tescil verisi ve ICAO tip kodları + kullanıcı girdileri' },
  { key: 'kullanici', ad: 'Kullanıcı girdileriyle büyüyen liste · ajan onaylar' },
  { key: 'yok', ad: 'Katalog yok' },
] as const;
export type CatalogSourceKey = (typeof CATALOG_SOURCES)[number]['key'];

export const TARIFFS = [
  { key: 'genel', ad: 'Genel tarife' },
  { key: 'kiralik', ad: 'Kiralık tarifesi' },
] as const;

export const categoryRulesSchema = z
  .object({
    /** Talep bu kadar gün sonra kendiliğinden pasife düşer (Karar 10, 19) */
    listingDays: z.number().int().min(1).max(365),
    /** Süreye ek kural metni (kiralıkta "alış tarihine kadar, en fazla 30 gün") */
    listingNote: z.string().trim().max(120).optional(),
    tariff: z.enum(TARIFFS.map((t) => t.key) as ['genel', 'kiralik']),
    /** Talep oluştururken ve galeri ilk mesajında gösterilen yasal uyarı */
    legalNotice: z.string().trim().max(1000).nullable(),
    /** Bu kategoride ilk mesaj gönderebilmek için galeriden istenen belgeler */
    verifications: z
      .array(z.enum(VERIFICATIONS.map((v) => v.key) as [VerificationKey, ...VerificationKey[]]))
      .max(VERIFICATIONS.length),
    catalog: z.enum(CATALOG_SOURCES.map((c) => c.key) as [CatalogSourceKey, ...CatalogSourceKey[]]),
    /** Galeri olmayan satıcının günlük ücretsiz ilk mesaj hakkı */
    freeFirstMessages: z.number().int().min(0).max(50),
    /** Bu skorun üstündeki galeriye "sana uygun talep" bildirimi gider (Teknik tasarım §6) */
    matchThreshold: z.number().int().min(50).max(100),
  })
  .strict();
export type CategoryRules = z.infer<typeof categoryRulesSchema>;

export const RULE_NAMES: Record<keyof CategoryRules, string> = {
  listingDays: 'Yayın süresi',
  listingNote: 'Yayın süresi notu',
  tariff: 'Fiyat tarifesi',
  legalNotice: 'Yasal uyarı metni',
  verifications: 'Galeri için zorunlu doğrulama',
  catalog: 'Katalog kaynağı',
  freeFirstMessages: 'Bireysel günlük ücretsiz ilk mesaj',
  matchThreshold: 'Bildirim eşiği',
};

// ── Taban şema ────────────────────────────────────────────────

/** Tüm kategorilerde ortak ve kilitli alanlar (tasarımdaki "Kilitli" satırlar). Yalnızca ağırlıkları değişir. */
export const BASE_FIELDS: readonly CategoryField[] = [
  {
    key: 'konum',
    label: 'Konum (il, ilçe)',
    type: 'location',
    required: true,
    filter: true,
    hard: 'yes',
    weight: 12,
    source: 'taban',
    matchName: 'Konum yakınlığı',
    step: 'konum_iletisim',
    scope: 'talep',
  },
  {
    key: 'butce',
    label: 'Bütçe (en az – en çok)',
    type: 'range',
    required: true,
    filter: true,
    hard: 'yes',
    weight: 20,
    source: 'taban',
    matchName: 'Bütçe uyumu',
    unit: 'TL',
    min: 0,
    max: 1_000_000_000,
    step: 'kriterler',
    scope: 'alternatif',
  },
  {
    key: 'aciklama',
    label: 'Açıklama',
    type: 'text',
    required: false,
    filter: false,
    hard: 'no',
    weight: 0,
    source: 'taban',
    step: 'konum_iletisim',
    scope: 'talep',
    help: 'Telefon numarası, IBAN veya bağlantı yazma; iletişim bilgilerin yalnızca izin ayarlarınla paylaşılır.',
  },
];
export const BASE_FIELD_KEYS = BASE_FIELDS.map((f) => f.key);
/** Taban alanlarda ağırlığı değişebilenler (Eşleştirme ayarı) */
export const BASE_WEIGHTED = ['konum', 'butce'] as const;

export const categoryDefinitionSchema = z
  .object({
    fields: z.array(categoryFieldSchema).max(60),
    rules: categoryRulesSchema,
    /** Taban alanların ağırlıkları (konum, bütçe) */
    baseWeights: z
      .object({
        konum: z.number().int().min(0).max(MAX_WEIGHT),
        butce: z.number().int().min(0).max(MAX_WEIGHT),
      })
      .strict(),
  })
  .strict()
  .superRefine((def, ctx) => {
    const seen = new Map<string, CategoryField>();
    def.fields.forEach((f, i) => {
      const at = (p: (string | number)[], message: string) =>
        ctx.addIssue({ code: 'custom', path: ['fields', i, ...p], message: `${f.label}: ${message}` });
      if (BASE_FIELD_KEYS.includes(f.key)) at(['key'], 'taban şemadaki bir alanla aynı kodu taşıyor');
      if (seen.has(f.key)) at(['key'], 'aynı kodla iki alan var');
      if (f.source === 'taban') at(['source'], 'taban kaynağı yalnızca taban şemaya ait');
      if ((f.type === 'select' || f.type === 'multiselect') && f.source !== 'katalog') {
        if (!f.options || f.options.length < 2) at(['options'], 'en az iki seçenek gir');
      }
      if (f.options) {
        const vals = f.options.map((o) => o.value);
        if (new Set(vals).size !== vals.length) at(['options'], 'aynı kodla iki seçenek var');
        if (f.type !== 'select' && f.type !== 'multiselect')
          at(['options'], 'seçenekler yalnızca seçim alanında');
      }
      if (f.min !== undefined && f.max !== undefined && f.min > f.max)
        at(['min'], 'en az değer en çoktan büyük');
      if ((f.min !== undefined || f.max !== undefined) && f.type !== 'range' && f.type !== 'number') {
        at(['min'], 'sınır yalnızca sayı ve aralıkta');
      }
      if (f.hard === 'strict' && f.type !== 'select' && f.type !== 'multiselect') {
        at(['hard'], '"kesin ise sert koşul" yalnızca seçim alanında');
      }
      if (f.type === 'text' && (f.weight > 0 || f.hard !== 'no'))
        at(['weight'], 'metin alanı eşleşmede kullanılmaz');
      if (f.type === 'text' && f.filter) at(['filter'], 'metin alanı filtrede kullanılmaz');
      if (f.when) {
        const dep = seen.get(f.when.field);
        if (!dep) at(['when', 'field'], 'koşul alanı bu alandan önce gelmeli');
        else if (dep.type !== 'select' && dep.type !== 'multiselect' && dep.type !== 'boolean') {
          at(['when', 'field'], 'koşul yalnızca seçim veya evet/hayır alanına bağlanır');
        } else if (dep.scope === 'alternatif' && f.scope === 'talep') {
          at(['when', 'field'], 'talep alanı alternatif alanına bağlanamaz');
        } else if (dep.type === 'boolean') {
          if (f.when.in.some((v) => v !== 'evet' && v !== 'hayir'))
            at(['when', 'in'], 'koşul evet ya da hayır olmalı');
        } else if (dep.options) {
          const known = new Set(dep.options.map((o) => o.value));
          if (f.when.in.some((v) => !known.has(v))) at(['when', 'in'], 'koşulda bilinmeyen seçenek var');
        }
      }
      seen.set(f.key, f);
    });
  });
export type CategoryDefinition = z.infer<typeof categoryDefinitionSchema>;

/** Taban alanlar (kategorinin ağırlıklarıyla) + kategori alanları: sihirbaz, doğrulama ve eşleşme bunu kullanır. */
export function effectiveFields(def: CategoryDefinition): CategoryField[] {
  const base = BASE_FIELDS.map((f) =>
    f.key === 'konum' || f.key === 'butce' ? { ...f, weight: def.baseWeights[f.key] } : { ...f },
  );
  return [...base, ...def.fields];
}

// ── Konsoldaki gösterim ───────────────────────────────────────

/** "Eşleşmede" sütunu: "Ağırlık 30", "Sert koşul", "Sert koşul + ağırlık 20", "Sert koşul (“kesin” ise)", "—" */
export function matchLabel(f: Pick<CategoryField, 'hard' | 'weight'>): string {
  if (f.hard === 'yes') return f.weight > 0 ? `Sert koşul + ağırlık ${f.weight}` : 'Sert koşul';
  if (f.hard === 'strict') {
    // Ağırlıklı alanda tasarımdaki gibi yalnızca ağırlık yazar; "kesin" kuralı ipucunda (matchHint)
    return f.weight > 0 ? `Ağırlık ${f.weight}` : 'Sert koşul (“kesin” ise)';
  }
  return f.weight > 0 ? `Ağırlık ${f.weight}` : '—';
}

/** Eşleşme hücresinin ipucu: alıcı "kesin" derse sert koşul olan ağırlıklı alanlar */
export function matchHint(f: Pick<CategoryField, 'hard' | 'weight'>): string | undefined {
  return f.hard === 'strict' && f.weight > 0 ? 'Alıcı “kesin” derse sert koşul' : undefined;
}

/** "Kaynak" sütunu: "Katalog · TSB ve açık kaynaklar", "Alıcı girer" … */
export function sourceLabel(f: Pick<CategoryField, 'source' | 'sourceNote'>): string {
  const ad = FIELD_SOURCE_NAMES[f.source];
  return f.sourceNote ? `${ad} · ${f.sourceNote}` : ad;
}

/** Konsolda yeni alana kod üretir: "Garantisi devam ediyor" → "garantisiDevamEdiyor" (taban ve mevcut kodlardan farklı). */
export function fieldKeyFor(label: string, taken: Iterable<string>): string {
  const ascii = label
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let key = ascii.map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join('');
  if (!/^[a-z]/.test(key)) key = `alan${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  key = key.slice(0, 36);
  if (key.length < 2) key = 'alan';
  const used = new Set([...taken, ...BASE_FIELD_KEYS]);
  let out = key;
  for (let n = 2; used.has(out); n++) out = `${key}${n}`;
  return out;
}

// ── Sürüm farkı ───────────────────────────────────────────────

export interface DefinitionDiff {
  /** Okunur değişiklik listesi (Sürümler ve "Yayına gönder · N değişiklik") */
  changes: string[];
  /** Taslakta yeni ya da değişen alanlar (satır rozeti) */
  fields: Record<string, { status: 'yeni' | 'degisti'; notes: string[] }>;
}

const evetHayir = (v: boolean) => (v ? 'evet' : 'hayır');
/** Anahtar sırasından bağımsız karşılaştırma (PostgreSQL JSONB anahtarları kendi sırasıyla saklar). */
function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => x !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, stable(x)]),
    );
  }
  return v;
}
const sameJson = (a: unknown, b: unknown) =>
  JSON.stringify(stable(a ?? null)) === JSON.stringify(stable(b ?? null));

function ruleValue(k: keyof CategoryRules, v: unknown): string {
  if (v === null || v === undefined || v === '') return 'yok';
  if (k === 'listingDays') return `${v} gün`;
  if (k === 'tariff') return TARIFFS.find((t) => t.key === v)?.ad ?? String(v);
  if (k === 'catalog') return CATALOG_SOURCES.find((c) => c.key === v)?.ad ?? String(v);
  if (k === 'verifications') {
    const list = (v as string[]).map((x) => VERIFICATIONS.find((y) => y.key === x)?.ad ?? x);
    return list.length ? list.join(', ') : 'yok';
  }
  if (k === 'matchThreshold') return `%${v}`;
  return String(v);
}

/** Yayındaki ve taslak tanım arasındaki farklar. `before` yoksa (ilk sürüm) her alan yenidir. */
export function diffDefinitions(
  before: CategoryDefinition | null,
  after: CategoryDefinition,
): DefinitionDiff {
  const changes: string[] = [];
  const fields: DefinitionDiff['fields'] = {};
  if (!before) {
    for (const f of after.fields) fields[f.key] = { status: 'yeni', notes: [] };
    return { changes: ['İlk sürüm'], fields };
  }
  const old = new Map(before.fields.map((f) => [f.key, f]));
  const now = new Map(after.fields.map((f) => [f.key, f]));
  for (const f of after.fields) {
    const o = old.get(f.key);
    if (!o) {
      fields[f.key] = { status: 'yeni', notes: [] };
      changes.push(`${f.label} alanı eklendi`);
      continue;
    }
    const notes: string[] = [];
    if (o.label !== f.label) notes.push(`Ad: ${o.label} → ${f.label}`);
    if (o.type !== f.type) notes.push(`Tip: ${FIELD_TYPE_NAMES[o.type]} → ${FIELD_TYPE_NAMES[f.type]}`);
    if (o.required !== f.required) notes.push(`Zorunlu: ${evetHayir(o.required)} → ${evetHayir(f.required)}`);
    if (o.filter !== f.filter) notes.push(`Filtrede: ${evetHayir(o.filter)} → ${evetHayir(f.filter)}`);
    if (o.weight !== f.weight) notes.push(`Ağırlık ${o.weight} → ${f.weight}`);
    if (o.hard !== f.hard) notes.push(`Eşleşmede: ${matchLabel(o)} → ${matchLabel(f)}`);
    if (!sameJson(o.options, f.options)) notes.push('Seçenekler değişti');
    const rest = [
      'source',
      'sourceNote',
      'unit',
      'min',
      'max',
      'step',
      'scope',
      'when',
      'help',
      'matchName',
    ] as const;
    if (rest.some((k) => !sameJson(o[k], f[k]))) notes.push('Ayrıntılar değişti');
    if (notes.length) {
      fields[f.key] = { status: 'degisti', notes };
      const ad = o.label !== f.label ? o.label : f.label;
      for (const n of notes) {
        changes.push(
          n.startsWith('Ağırlık')
            ? `${ad} ağırlığı ${n.slice(8)}`
            : `${ad} · ${n.charAt(0).toLocaleLowerCase('tr-TR')}${n.slice(1)}`,
        );
      }
    }
  }
  for (const o of before.fields) if (!now.has(o.key)) changes.push(`${o.label} alanı kaldırıldı`);
  const keptOld = before.fields.map((f) => f.key).filter((k) => now.has(k));
  const keptNew = after.fields.map((f) => f.key).filter((k) => old.has(k));
  if (!sameJson(keptOld, keptNew)) changes.push('Alan sırası değişti');
  for (const k of BASE_WEIGHTED) {
    if (before.baseWeights[k] !== after.baseWeights[k]) {
      const ad = BASE_FIELDS.find((f) => f.key === k)?.matchName ?? k;
      changes.push(`${ad} ağırlığı ${before.baseWeights[k]} → ${after.baseWeights[k]}`);
    }
  }
  for (const k of Object.keys(RULE_NAMES) as (keyof CategoryRules)[]) {
    if (!sameJson(before.rules[k], after.rules[k])) {
      changes.push(
        k === 'legalNotice'
          ? `${RULE_NAMES[k]} değişti`
          : `${RULE_NAMES[k]}: ${ruleValue(k, before.rules[k])} → ${ruleValue(k, after.rules[k])}`,
      );
    }
  }
  return { changes, fields };
}

export const ruleValueLabel = ruleValue;

// ── Talep doğrulayıcı ─────────────────────────────────────────

const catalogValue = z
  .object({
    make: z.string().trim().min(1).max(200),
    series: z.string().trim().min(1).max(200).optional(),
    model: z.string().trim().min(1).max(200).optional(),
  })
  .strict();
const locationValue = z
  .object({ il: z.string().trim().min(2).max(40), ilce: z.string().trim().min(2).max(60).optional() })
  .strict();
const paintValue = z
  .object({
    limit: z.number().int().min(0).max(PAINT_PARTS.length),
    parts: z.partialRecord(
      z.enum(PAINT_PARTS.map((p) => p.key) as [string, ...string[]]),
      z.enum(PAINT_STATES.map((s) => s.key) as [string, ...string[]]),
    ),
  })
  .strict();
const dateRangeValue = z
  .object({ from: z.iso.datetime({ offset: true }), to: z.iso.datetime({ offset: true }) })
  .strict()
  .refine((v) => new Date(v.to) > new Date(v.from), { message: 'İade tarihi alış tarihinden sonra olmalı' });

function bounded(f: CategoryField) {
  let n = z.number();
  if (f.min !== undefined) n = n.min(f.min, `En az ${f.min}`);
  if (f.max !== undefined) n = n.max(f.max, `En çok ${f.max}`);
  return n;
}

/** Bir alanın değer şeması (zorunluluk ve koşul ayrıca denetlenir). */
export function fieldValueSchema(f: CategoryField): z.ZodType {
  const values = (f.options ?? []).map((o) => o.value);
  const choice = values.length ? z.enum(values as [string, ...string[]]) : z.string().trim().min(1).max(200);
  switch (f.type) {
    case 'boolean':
      return z.boolean();
    case 'select':
      return choice;
    case 'multiselect':
      return z
        .array(choice)
        .min(1)
        .max(values.length || 50)
        .refine((a) => new Set(a).size === a.length, { message: 'Aynı seçenek iki kez seçilmiş' });
    case 'range':
      return z
        .object({ min: bounded(f).optional(), max: bounded(f).optional() })
        .strict()
        .refine((v) => v.min !== undefined || v.max !== undefined, {
          message: 'En az ya da en çok değeri gir',
        })
        .refine((v) => v.min === undefined || v.max === undefined || v.min <= v.max, {
          message: 'En az değer en çoktan büyük olamaz',
        });
    case 'number':
      return bounded(f);
    case 'text':
      return z.string().trim().max(2000);
    case 'catalog':
      return catalogValue;
    case 'location':
      return locationValue;
    case 'paint':
      return paintValue;
    case 'daterange':
      return dateRangeValue;
  }
}

/** Koşullu alan bu değerlerle görünür mü? */
export function fieldVisible(f: CategoryField, values: Record<string, unknown>): boolean {
  if (!f.when) return true;
  const v = values[f.when.field];
  if (Array.isArray(v)) return v.some((x) => f.when?.in.includes(String(x)));
  if (typeof v === 'boolean') return f.when.in.includes(v ? 'evet' : 'hayir');
  return v !== undefined && f.when.in.includes(String(v));
}

function scopeObject(fields: CategoryField[], context: () => Record<string, unknown>) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) shape[f.key] = fieldValueSchema(f).optional();
  return z
    .object(shape)
    .strict()
    .superRefine((vals, ctx) => {
      const all = { ...context(), ...vals };
      for (const f of fields) {
        const visible = fieldVisible(f, all);
        const has = vals[f.key] !== undefined;
        if (!visible && has) {
          ctx.addIssue({ code: 'custom', path: [f.key], message: `${f.label}: bu seçimde kullanılmaz` });
        } else if (visible && f.required && !has) {
          ctx.addIssue({ code: 'custom', path: [f.key], message: `${f.label} zorunlu` });
        }
      }
    });
}

/**
 * Talep doğrulayıcı: `{ alanlar: {...talep alanları}, alternatifler: [{...alternatif alanları}] }`.
 * Ana araç ve talep alanları bir kez, alternatif alanları (bütçe, yıl, km …) her alternatifte ayrı girilir.
 */
export function demandSchema(def: CategoryDefinition) {
  const all = effectiveFields(def);
  const talep = all.filter((f) => f.scope === 'talep');
  const alt = all.filter((f) => f.scope === 'alternatif');
  let talepValues: Record<string, unknown> = {};
  const talepSchema = scopeObject(talep, () => ({}));
  const altSchema = scopeObject(alt, () => talepValues);
  return z
    .object({
      alanlar: z.record(z.string(), z.unknown()),
      alternatifler: z.array(z.record(z.string(), z.unknown())).min(1).max(MAX_ALTERNATIVES),
    })
    .strict()
    .transform((input, ctx) => {
      const t = talepSchema.safeParse(input.alanlar);
      if (!t.success) {
        for (const i of t.error.issues) ctx.addIssue({ ...i, code: 'custom', path: ['alanlar', ...i.path] });
      }
      // Talep alanları hatalı olsa da alternatiflerin hataları birlikte gösterilir.
      talepValues = t.success ? t.data : input.alanlar;
      const alternatifler: Record<string, unknown>[] = [];
      input.alternatifler.forEach((a, n) => {
        const r = altSchema.safeParse(a);
        if (!r.success) {
          for (const i of r.error.issues) {
            ctx.addIssue({ ...i, code: 'custom', path: ['alternatifler', n, ...i.path] });
          }
        } else alternatifler.push(r.data);
      });
      if (!t.success || alternatifler.length !== input.alternatifler.length) return z.NEVER;
      return { alanlar: t.data, alternatifler };
    });
}

/** Sihirbaz ve galeri API'si için JSON Schema (koşullu kurallar `demandSchema` içinde ayrıca denetlenir). */
export function demandJsonSchema(def: CategoryDefinition): Record<string, unknown> {
  const all = effectiveFields(def);
  const obj = (fields: CategoryField[]) =>
    z.toJSONSchema(
      z
        .object(
          Object.fromEntries(
            fields.map((f) => {
              const s = fieldValueSchema(f).describe(f.label);
              return [f.key, f.required && !f.when ? s : s.optional()];
            }),
          ),
        )
        .strict(),
      { unrepresentable: 'any' },
    );
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    required: ['alanlar', 'alternatifler'],
    properties: {
      alanlar: obj(all.filter((f) => f.scope === 'talep')),
      alternatifler: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_ALTERNATIVES,
        items: obj(all.filter((f) => f.scope === 'alternatif')),
      },
    },
  };
}

// ── Konsol istekleri ──────────────────────────────────────────

export const categoryCreateSchema = z
  .object({
    name: z.string().trim().min(2, 'Kategori adı en az 2 karakter').max(60),
    vertical: z.enum(['vasita', 'emlak', 'ikinci_el']).default('vasita'),
    parentId: z.uuid().optional(),
  })
  .strict();

export const categoryUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    enabled: z.boolean().optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .nullable()
      .optional(),
    move: z.enum(['up', 'down']).optional(),
  })
  .strict();

/** `GET /categories`: açık kategoriler, menü ve ana sayfa sırasıyla (web, mobil). */
export interface PublicCategory {
  slug: string;
  name: string;
  vertical: string;
  /** Nokta rengi (konsolda seçilmediyse sıradaki renk) */
  color: string;
  version: number | null;
  children: { slug: string; name: string; version: number | null }[];
}

export const VERTICALS = [
  { key: 'vasita', ad: 'Vasıta' },
  { key: 'emlak', ad: 'Emlak' },
  { key: 'ikinci_el', ad: 'İkinci el' },
] as const;
