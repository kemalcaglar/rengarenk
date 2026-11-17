import type { CategoryField, FieldOption } from './category-schema.js';

/**
 * Talep sihirbazının 3. adımı (Kriterler) ve tanıtımı (sahip isteği, 17 Kasım 2026). Web ve uygulama aynı kuralları
 * kullanır:
 * - Kasa ve makyaj tek seçilir; birden çok kasa için alternatif eklenir. Kasa seçilince model yılı kasadan gelir;
 *   yıl elle girilirse kasa seçilmez.
 * - Kasa seçildiyse yakıt, vites ve kasa tipi o kasanın yıllarında satılan tiplere göre daralır (çoklu seçilir).
 * - Hasar kaydı (tramer tutarı yeterli), motor hacmi ve motor gücü (teknik özelliklerden gelir) sorulmaz.
 * - Bütçe tek rakamdır (üst sınır; eşleşmede %5 pay).
 * - Alanlar yukarıdan aşağı adım adım açılır: bir alan yanıtlanınca (değer ya da "Fark etmez") sıradaki görünür.
 */

/** Sihirbazda sorulmayan alanlar ve nedeni (şemada durur; eski taleplerdeki değerler görünür) */
export const SIHIRBAZDA_SORULMAZ: Readonly<Record<string, string>> = {
  hasar: 'Hasar durumu boya ve hasar adımındaki tramer tutarıyla belirlenir',
  motorHacmi: 'Teknik özelliklerden gelir',
  motorGucu: 'Teknik özelliklerden gelir',
};

const ONDE = ['kasa', 'paket', 'yil'];

/** 3. adımdaki sorular, açılış sırasıyla: kasa ve makyaj, donanım paketi, model yılı, diğerleri; bütçe en sonda */
export function kriterSirasi(fields: readonly CategoryField[]): CategoryField[] {
  const kalan = fields.filter((f) => !(f.key in SIHIRBAZDA_SORULMAZ));
  return [
    ...ONDE.flatMap((k) => kalan.filter((f) => f.key === k)),
    ...kalan.filter((f) => !ONDE.includes(f.key) && f.key !== 'butce'),
    ...kalan.filter((f) => f.key === 'butce'),
  ];
}

/**
 * Adım adım açılış: son yanıtlanan sorunun bir sonrasına kadar açıktır. `gecilen`: bu oturumda "Fark etmez" denen
 * sorular (değer yazılmaz). Sayfa yeniden açıldığında yanıtlanmış en son sorunun öncesi zaten açık kalır.
 */
export function acikSoruSayisi(
  sirali: readonly CategoryField[],
  yanitli: (f: CategoryField) => boolean,
  gecilen: ReadonlySet<string>,
): number {
  let n = 0;
  sirali.forEach((f, i) => {
    if (yanitli(f) || gecilen.has(f.key)) n = i + 1;
  });
  return Math.min(sirali.length, n + 1);
}

/**
 * Katalogdaki tipin seçimi daraltan özeti (seri ayrıntısındaki `tipler`). `body`: talep şemasındaki kasa tipi değeri
 * (sedan, station_wagon …), `drive`: çekiş (onden, arkadan, 4x4); ikisi de yalnızca kesinse dolu.
 */
export interface KatalogTipi {
  years: number[];
  fuel: string | null;
  gearbox: string | null;
  body: string | null;
  drive?: string | null;
  /** Donanım paketi (katalogdaki paket kimliği) */
  trimId?: string | null;
}

/** Kriterlerdeki seçim: kasanın ya da elle girilen yılın aralığı ve seçilen paketler (kimlik) */
export interface KriterSecimi {
  yillar: { min: number; max: number } | null;
  paketler?: readonly string[];
}

/** Seçime uyan tipler: yılları aralıkta, paket seçildiyse o paketlerde */
export function secimTipleri(tipler: readonly KatalogTipi[], secim: KriterSecimi): KatalogTipi[] {
  const y = secim.yillar;
  if (!y) return [];
  const paket = secim.paketler?.length ? new Set(secim.paketler) : null;
  return tipler.filter(
    (t) =>
      t.years.some((x) => x >= y.min && x <= y.max) && (!paket || (t.trimId != null && paket.has(t.trimId))),
  );
}

/** Çekiş değerinin kategorideki seçeneği: otomobilde 4x4 "dort"; SUV'deki ayrıntılı 4x4 türleri bilinemez */
const CEKIS_SECENEGI: Record<string, string[]> = { onden: ['onden'], arkadan: ['arkadan'], '4x4': ['dort'] };

/**
 * Kasa tipi ve çekiş sorusu (sahip isteği, 17 Kasım 2026): seçilen kasa ve paketteki bütün tiplerde değer kesin
 * biliniyorsa ve en az iki farklı değer varsa sorulur; seçenekler yalnızca var olanlardır ("hatchback ve coupe varsa
 * sedan yok"). Bilinmiyorsa ya da tek değer varsa soru sorulmaz: null.
 */
export function kesinSecenekler(
  f: CategoryField,
  tipler: readonly KatalogTipi[],
  secim: KriterSecimi,
): FieldOption[] | null {
  if (f.key !== 'kasaTipi' && f.key !== 'cekis') return f.options ?? [];
  const uyan = secimTipleri(tipler, secim);
  if (!uyan.length) return null;
  const degerler = uyan.map((t) => (f.key === 'kasaTipi' ? t.body : t.drive) ?? null);
  if (degerler.some((d) => d === null)) return null;
  const izin = new Set<string>();
  for (const d of new Set(degerler as string[])) {
    const karsilik = f.key === 'kasaTipi' ? [d] : (CEKIS_SECENEGI[d] ?? []);
    const var_ = karsilik.filter((k) => f.options?.some((o) => o.value === k));
    // Kategorinin seçeneklerinde karşılığı yoksa (ör. SUV'de 4x4'ün türü) bilinmiyor sayılır
    if (!var_.length) return null;
    for (const k of var_) izin.add(k);
  }
  if (izin.size < 2) return null;
  return (f.options ?? []).filter((o) => izin.has(o.value));
}

/** Katalog yakıtı → talepteki yakıt seçenekleri (benzinli araca sonradan LPG takılabilir) */
const YAKIT: Record<string, string[]> = {
  benzin: ['benzin', 'lpg_benzin'],
  dizel: ['dizel'],
  hibrit: ['hibrit'],
  elektrik: ['elektrik'],
  lpg: ['lpg_benzin'],
};

/**
 * Tip talepteki seçimlere uyuyor mu (sahip bildirimi, 18 Kasım 2026: otomatik seçilen Clio'nun teknik özelliklerinde
 * manuel yazıyordu). Yakıt, vites, kasa tipi ve çekişte talepte seçim varsa ve tipin değeri biliniyorsa karşılaştırılır;
 * bilinmeyen değer elenmez (tahmin edilmez).
 */
export function tipSecimeUyar(
  tip: { fuel: string | null; gearbox: string | null; body: string | null; drive: string | null },
  secim: Record<string, unknown>,
): boolean {
  const liste = (k: string) => {
    const v = secim[k];
    return Array.isArray(v) && v.length ? new Set(v.map(String)) : null;
  };
  const uyar = (k: string, karsilik: string[] | null) => {
    const s = liste(k);
    return !s || !karsilik?.length || karsilik.some((x) => s.has(x));
  };
  return (
    uyar('yakit', tip.fuel ? (YAKIT[tip.fuel] ?? null) : null) &&
    uyar('vites', tip.gearbox ? [tip.gearbox] : null) &&
    uyar('kasaTipi', kasaTipiOf(tip.body) ? [kasaTipiOf(tip.body) as string] : null) &&
    uyar('cekis', tip.drive ? (CEKIS_SECENEGI[tip.drive] ?? null) : null)
  );
}

const KASA_TIPI: [RegExp, string][] = [
  [/sedan|saloon|limuzin/i, 'sedan'],
  [/station|kombi|estate|touring|variant|avant|sports ?tourer/i, 'station_wagon'],
  [/hatchback|liftback|sportback/i, 'hatchback'],
  [/coup[eé]/i, 'coupe'],
  [/cabrio|roadster|convertible|spider|spyder/i, 'cabrio'],
  [/\bmpv\b|minivan/i, 'mpv'],
  [/crossover/i, 'crossover'],
  [/\bsuv\b/i, 'suv'],
  [/pick ?up/i, 'pickup'],
  [/arazi|off.?road/i, 'arazi'],
];

/** Katalogdaki kasa adının talepteki kasa tipi karşılığı ("Hatchback 5 kapı" → hatchback); bilinmiyorsa null */
export function kasaTipiOf(body: string | null | undefined): string | null {
  if (!body) return null;
  return KASA_TIPI.find(([re]) => re.test(body))?.[1] ?? null;
}

/** Bilinen değerin payı bundan azsa daraltılmaz (bilinmeyen tipler başka seçenekte olabilir; tahmin edilmez) */
const YETER = 0.8;

/**
 * Seçilen kasaya göre uygun seçenekler. Yakıt ve vites kasanın yıllarında satılan tiplerden, kasa tipi kasanın
 * gövdelerinden (yoksa tiplerden) gelir. Katalog yeterince bilgi vermiyorsa bütün seçenekler kalır.
 */
export function uygunSecenekler(
  f: CategoryField,
  tipler: readonly KatalogTipi[],
  yillar: { min: number; max: number } | null,
  kasaGovdeleri: readonly (string | null)[] = [],
  paketler?: readonly string[],
): FieldOption[] {
  const hepsi = f.options ?? [];
  if (!yillar || !['yakit', 'vites', 'kasaTipi'].includes(f.key)) return hepsi;
  const icinde = secimTipleri(tipler, { yillar, paketler });
  const daralt = (degerler: (string[] | null)[]) => {
    const bilinen = degerler.filter((d): d is string[] => d !== null);
    if (!bilinen.length || bilinen.length < degerler.length * YETER) return hepsi;
    const izin = new Set(bilinen.flat());
    const kalan = hepsi.filter((o) => izin.has(o.value));
    return kalan.length ? kalan : hepsi;
  };
  if (f.key === 'yakit') return daralt(icinde.map((t) => (t.fuel ? (YAKIT[t.fuel] ?? null) : null)));
  if (f.key === 'vites') return daralt(icinde.map((t) => (t.gearbox ? [t.gearbox] : null)));
  // Kasa tipi: kasa kuşağının gövdeleri (açık kaynak), yoksa tiplerin gövdesi
  const govde = kasaGovdeleri.map(kasaTipiOf);
  if (govde.some(Boolean)) return daralt(govde.filter(Boolean).map((g) => [g as string]));
  return daralt(icinde.map((t) => (kasaTipiOf(t.body) ? [kasaTipiOf(t.body) as string] : null)));
}

/** Seçeneklerden düşenleri değerden çıkarır (kasa değişince); hiçbiri kalmazsa undefined */
export function secimiDaralt(deger: unknown, secenekler: readonly FieldOption[]): string[] | undefined {
  if (!Array.isArray(deger)) return undefined;
  const izin = new Set(secenekler.map((o) => o.value));
  const kalan = deger.filter((x) => izin.has(String(x))) as string[];
  return kalan.length ? kalan : undefined;
}

/** Bütçe değeri tek rakam: eski taleplerdeki aralıkta en çok (yoksa en az) */
export function butceDegeri(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object') {
    const r = v as { min?: number; max?: number };
    return r.max ?? r.min;
  }
  return undefined;
}

/** Sihirbaz adımlarının tanıtımı: her üyeye her adım için bir kez gösterilir (`POST /me/tanitim`) */
export const SIHIRBAZ_TANITIM = {
  kategori: {
    baslik: 'Ne aradığını seç',
    metin:
      "Rengarenk'te ilanı alıcı verir: aradığın aracı yazarsın, uygun aracı olan galeriler ve satıcılar sana ulaşır. Önce kategoriyi seç; sonraki adımlar kategoriye göre değişir.",
  },
  ana_arac: {
    baslik: 'Aradığın aracı belirle',
    metin:
      "Marka, seri ve modeli seç. Ana araç talep boyunca sabit kalır. Model seçince Türkiye'de satılan sürümlerin teknik özellikleri görünür.",
  },
  kriterler: {
    baslik: 'Kriterlerini adım adım gir',
    metin:
      'Önce kasa ve makyajı seç ya da yılı kendin gir; sonra donanım paketi ve diğer sorular sırayla açılır. Kasa seçince yakıt, vites ve kasa tipi o araca göre daralır. Başka bir kasa da istiyorsan "Alternatif ekle" ile ikinci bir seçenek oluştur.',
  },
  boya_hasar: {
    baslik: 'Boya, değişen ve hasar',
    metin:
      'Şemada her parça için kabul ettiğin en fazla işlemi seç ve en çok tramer tutarını yaz. Kabul etmediğin işlemlerden biri olan araçların sahipleri sana yazamaz.',
  },
  konum_iletisim: {
    baslik: 'Konum, açıklama ve iletişim',
    metin:
      'Konumunu seç, talebine bir başlık ve açıklama yaz. Açıklamada kalın, renkli ve büyük yazı kullanabilirsin. Satıcıların sana nasıl ulaşacağını (mesaj, telefon, WhatsApp) sen belirlersin.',
  },
  onizleme: {
    baslik: 'Kontrol et ve yayınla',
    metin:
      'Talebin satıcılara böyle görünecek. Bilgileri kontrol et; istersen öne çıkarma seç ve yayınla. Yayından sonra da düzenleyebilirsin.',
  },
} as const;
export type SihirbazAdimi = keyof typeof SIHIRBAZ_TANITIM;
/** Tanıtım anahtarı: `sihirbaz.kriterler` */
export const tanitimAnahtari = (adim: SihirbazAdimi) => `sihirbaz.${adim}`;
export const TANITIM_ANAHTARLARI = (Object.keys(SIHIRBAZ_TANITIM) as SihirbazAdimi[]).map(tanitimAnahtari);
