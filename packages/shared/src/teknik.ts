/**
 * Bir motor sürümünün teknik özeti (API `GET /catalog/series/:id` → `models[].teknik`, talep sayfası `teknik`).
 * Türkiye'de satılan tipe (TSB) iki kaynaktan eşleşen değerler: ADEME Avrupa onay verisi (vites, güç, tüketim, CO2,
 * ağırlık, emisyon) ve vehicle-makes-models motor kayıtları (0-100, azami hız, tork, çekiş, kasa, ölçüler, depo,
 * bagaj, lastik, fren). Değerler sürümler arasında farklıysa aralık ya da seçenek olarak gelir; bilinmeyen alan yoktur
 * (tahmin edilmez). Yeni alanlar isteğe bağlıdır: eski özetler de okunur.
 */
export type Aralik = [number, number] | null;

export interface TeknikOzet {
  /** "manuel:6", "otomatik:7", "otomatik:" (vites sayısı bilinmiyor) */
  vitesler: string[];
  kw: Aralik;
  hp: Aralik;
  /** Karma tüketim, l/100 km */
  tuketim: Aralik;
  co2: Aralik;
  /** Boş ağırlık, kg */
  agirlik: Aralik;
  euro: string[];
  /** Eşleşen kayıt sayısı */
  surum: number;

  tuketimSehir?: Aralik;
  tuketimSehirDisi?: Aralik;
  /** Çekiş: "onden", "arkadan", "4x4"; tip başına kesinse tek değer */
  cekisler?: string[];
  /** Kasa tipi (talep şemasındaki değerler: sedan, hatchback, station_wagon …); tip başına kesinse tek değer */
  govdeler?: string[];
  /** "L4", "V8", "H4" */
  silindirler?: string[];
  /** Motor hacmi, cm³ */
  hacimCc?: Aralik;
  /** Tork, Nm */
  tork?: Aralik;
  /** 0-100 km/s, saniye */
  hizlanma?: Aralik;
  /** Azami hız, km/s */
  azamiHiz?: Aralik;
  yakitSistemleri?: string[];
  /** Yakıt deposu, litre */
  depo?: Aralik;
  uzunluk?: Aralik;
  genislik?: Aralik;
  yukseklik?: Aralik;
  dingil?: Aralik;
  /** Yerden yükseklik, mm */
  yerden?: Aralik;
  /** Bagaj hacmi, litre */
  bagaj?: Aralik;
  /** Azami yüklü ağırlık, kg */
  azamiAgirlik?: Aralik;
  /** Dönüş çapı, metre */
  donme?: Aralik;
  /** Sürtünme katsayısı (Cd) */
  cd?: Aralik;
  lastikler?: string[];
  frenOn?: string[];
  frenArka?: string[];
  /** Elektrikli: menzil (km) ve batarya (kWh) */
  menzil?: Aralik;
  batarya?: Aralik;
  /** Kaynaklar: "ademe", "vmm" */
  kaynaklar?: string[];
}

const VITES: Record<string, string> = {
  manuel: 'manuel',
  otomatik: 'otomatik',
  yari_otomatik: 'yarı otomatik',
};
const CEKIS: Record<string, string> = { onden: 'Önden çekiş', arkadan: 'Arkadan itiş', '4x4': '4x4 / AWD' };
const GOVDE: Record<string, string> = {
  sedan: 'Sedan',
  hatchback: 'Hatchback',
  station_wagon: 'Station wagon',
  coupe: 'Coupe',
  cabrio: 'Cabrio',
  mpv: 'MPV',
  suv: 'SUV',
  crossover: 'Crossover',
  pickup: 'Pickup',
  arazi: 'Arazi',
};

const sayi = (n: number, basamak = 0) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: basamak, maximumFractionDigits: basamak });

const aralik = (a: [number, number], basamak = 0) =>
  a[0] === a[1] ? sayi(a[0], basamak) : `${sayi(a[0], basamak)}–${sayi(a[1], basamak)}`;

/** "6 ileri manuel", "Otomatik" */
export function vitesYaz(v: string): string {
  const [tur = '', adet = ''] = v.split(':');
  const ad = VITES[tur] ?? tur;
  return adet ? `${adet} ileri ${ad}` : ad.charAt(0).toLocaleUpperCase('tr-TR') + ad.slice(1);
}

/** "L4" → "4 silindir, sıralı" */
export function silindirYaz(s: string): string {
  const m = /^([LVHW])?(\d{1,2})$/i.exec(s.trim());
  if (!m) return s;
  const duzen: Record<string, string> = { L: 'sıralı', V: 'V', H: 'boxer', W: 'W' };
  const d = m[1] ? duzen[m[1].toUpperCase()] : undefined;
  return `${m[2]} silindir${d ? `, ${d}` : ''}`;
}

const CEVIRI: [RegExp, string][] = [
  [/turbocharged/gi, 'Turbo'],
  [/supercharged/gi, 'Kompresör'],
  [/naturally aspirated/gi, 'Atmosferik'],
  [/direct injection/gi, 'Direkt enjeksiyon'],
  [/multipoint injection/gi, 'Çok noktalı enjeksiyon'],
  [/single-?point injection/gi, 'Tek noktalı enjeksiyon'],
  [/common rail/gi, 'Common rail'],
  [/carburetor|carburettor/gi, 'Karbüratör'],
  [/ventilated discs?/gi, 'Havalandırmalı disk'],
  [/\bdiscs?\b/gi, 'Disk'],
  [/\bdrums?\b/gi, 'Kampana'],
  [/ceramic/gi, 'Seramik'],
];
/** Kaynağın İngilizce kısa terimleri Türkçeye ("Turbocharged Direct Injection" → "Turbo Direkt enjeksiyon") */
export function teknikCevir(s: string): string {
  let t = s.replace(/\s+/g, ' ').trim();
  for (const [re, tr] of CEVIRI) t = t.replace(re, tr);
  return t;
}

type Satir = [string, string];

/** Kısa özet satırları (sihirbazda model seçilince): [etiket, değer] */
export function teknikSatirlari(o: TeknikOzet): Satir[] {
  const out: Satir[] = [];
  if (o.vitesler.length) out.push(['Vites', o.vitesler.map(vitesYaz).join(' ya da ')]);
  if (o.hp) out.push(['Güç', `${aralik(o.hp)} hp${o.kw ? ` (${aralik(o.kw)} kW)` : ''}`]);
  if (o.hizlanma) out.push(['0-100 km/s', `${aralik(o.hizlanma, 1)} sn`]);
  if (o.tuketim) out.push(['Karma tüketim', `${aralik(o.tuketim, 1)} l/100 km`]);
  if (o.co2) out.push(['CO₂', `${aralik(o.co2)} g/km`]);
  if (o.agirlik) out.push(['Boş ağırlık', `${aralik(o.agirlik)} kg`]);
  if (o.euro.length) out.push(['Emisyon', o.euro.map((e) => `Euro ${e}`).join(', ')]);
  return out;
}

export interface TeknikBolum {
  baslik: string;
  satirlar: Satir[];
}

/** Talep sayfasındaki ayrıntılı tablo: bölüm bölüm (boş bölüm gelmez) */
export function teknikBolumleri(o: TeknikOzet): TeknikBolum[] {
  const sat = (pairs: (Satir | null)[]): Satir[] => pairs.filter((p): p is Satir => p !== null);
  const ar = (a: Aralik | undefined, birim: string, basamak = 0): string | null =>
    a ? `${aralik(a, basamak)} ${birim}` : null;
  const s = (etiket: string, deger: string | null): Satir | null => (deger ? [etiket, deger] : null);
  const liste = (xs: string[] | undefined, f: (x: string) => string = (x) => x) =>
    xs?.length ? [...new Set(xs.map(f))].join(' ya da ') : null;

  const bolumler: TeknikBolum[] = [
    {
      baslik: 'Motor',
      satirlar: sat([
        s('Motor hacmi', ar(o.hacimCc, 'cm³')),
        s('Silindir', liste(o.silindirler, silindirYaz)),
        s('Güç', o.hp ? `${aralik(o.hp)} hp${o.kw ? ` (${aralik(o.kw)} kW)` : ''}` : null),
        s('Tork', ar(o.tork, 'Nm')),
        s('Yakıt sistemi', liste(o.yakitSistemleri, teknikCevir)),
      ]),
    },
    {
      baslik: 'Performans',
      satirlar: sat([s('0-100 km/s', ar(o.hizlanma, 'sn', 1)), s('Azami hız', ar(o.azamiHiz, 'km/s'))]),
    },
    {
      baslik: 'Şanzıman ve çekiş',
      satirlar: sat([
        s('Vites', liste(o.vitesler, vitesYaz)),
        s(
          'Çekiş',
          liste(o.cekisler, (c) => CEKIS[c] ?? c),
        ),
      ]),
    },
    {
      baslik: 'Yakıt tüketimi ve emisyon',
      satirlar: sat([
        s('Şehir içi', ar(o.tuketimSehir, 'l/100 km', 1)),
        s('Şehir dışı', ar(o.tuketimSehirDisi, 'l/100 km', 1)),
        s('Karma', ar(o.tuketim, 'l/100 km', 1)),
        s('CO₂', ar(o.co2, 'g/km')),
        s('Emisyon normu', o.euro.length ? o.euro.map((e) => `Euro ${e}`).join(', ') : null),
        s('Yakıt deposu', ar(o.depo, 'l')),
        s('Menzil', ar(o.menzil, 'km')),
        s('Batarya', ar(o.batarya, 'kWh', 1)),
      ]),
    },
    {
      baslik: 'Ölçüler ve ağırlık',
      satirlar: sat([
        s(
          'Kasa tipi',
          liste(o.govdeler, (g) => GOVDE[g] ?? g),
        ),
        s('Uzunluk', ar(o.uzunluk, 'mm')),
        s('Genişlik', ar(o.genislik, 'mm')),
        s('Yükseklik', ar(o.yukseklik, 'mm')),
        s('Dingil mesafesi', ar(o.dingil, 'mm')),
        s('Yerden yükseklik', ar(o.yerden, 'mm')),
        s('Bagaj hacmi', ar(o.bagaj, 'l')),
        s('Boş ağırlık', ar(o.agirlik, 'kg')),
        s('Azami yüklü ağırlık', ar(o.azamiAgirlik, 'kg')),
        s('Dönüş çapı', ar(o.donme, 'm', 1)),
        s('Sürtünme katsayısı (Cd)', o.cd ? aralik(o.cd, 2) : null),
      ]),
    },
    {
      baslik: 'Lastik ve fren',
      satirlar: sat([
        s('Lastik ölçüsü', liste(o.lastikler)),
        s('Ön fren', liste(o.frenOn, teknikCevir)),
        s('Arka fren', liste(o.frenArka, teknikCevir)),
      ]),
    },
  ];
  return bolumler.filter((b) => b.satirlar.length > 0);
}

/** Teknik değerlerin kaynağı (kullanıcıya gösterilen not) */
export const TEKNIK_KAYNAK =
  'Avrupa onay değerleri (ADEME, Fransa) ve vehicle-makes-models motor kayıtları; Türkiye’de satılan sürümle eşleşir';

// ── Elle düzeltme (sahip isteği, 17 Kasım 2026) ───────────────────────────────

/** Boş özet: kaynaklarda bilgisi olmayan sürüme elle değer eklenirken taban */
export const bosOzet = (): TeknikOzet => ({
  vitesler: [],
  kw: null,
  hp: null,
  tuketim: null,
  co2: null,
  agirlik: null,
  euro: [],
  surum: 0,
});

type AralikAlani = {
  [K in keyof TeknikOzet]-?: NonNullable<TeknikOzet[K]> extends [number, number] ? K : never;
}[keyof TeknikOzet];
type ListeAlani = {
  [K in keyof TeknikOzet]-?: NonNullable<TeknikOzet[K]> extends string[] ? K : never;
}[keyof TeknikOzet];

export interface TeknikAlan {
  key: AralikAlani | ListeAlani;
  ad: string;
  /** aralik: "150" ya da "150–170"; liste: virgülle ayrılmış değerler; secim: listeden */
  tur: 'aralik' | 'liste' | 'secim';
  birim?: string;
  basamak?: number;
  secenekler?: readonly (readonly [string, string])[];
  ipucu?: string;
}

/** Konsolda elle düzeltilebilen alanlar, talep sayfasındaki bölüm sırasıyla */
export const TEKNIK_ALANLARI: readonly TeknikAlan[] = [
  { key: 'hacimCc', ad: 'Motor hacmi', tur: 'aralik', birim: 'cm³' },
  { key: 'silindirler', ad: 'Silindir', tur: 'liste', ipucu: 'L4, V6, H4' },
  { key: 'hp', ad: 'Güç', tur: 'aralik', birim: 'hp' },
  { key: 'kw', ad: 'Güç (kW)', tur: 'aralik' },
  { key: 'tork', ad: 'Tork', tur: 'aralik', birim: 'Nm' },
  { key: 'yakitSistemleri', ad: 'Yakıt sistemi', tur: 'liste', ipucu: 'Turbo direkt enjeksiyon' },
  { key: 'hizlanma', ad: '0-100 km/s', tur: 'aralik', birim: 'sn', basamak: 1 },
  { key: 'azamiHiz', ad: 'Azami hız', tur: 'aralik', birim: 'km/s' },
  { key: 'vitesler', ad: 'Vites', tur: 'liste', ipucu: 'manuel:6, otomatik:7, yari_otomatik:6' },
  {
    key: 'cekisler',
    ad: 'Çekiş',
    tur: 'secim',
    secenekler: Object.entries(CEKIS) as [string, string][],
  },
  { key: 'tuketimSehir', ad: 'Şehir içi tüketim', tur: 'aralik', birim: 'l/100 km', basamak: 1 },
  { key: 'tuketimSehirDisi', ad: 'Şehir dışı tüketim', tur: 'aralik', birim: 'l/100 km', basamak: 1 },
  { key: 'tuketim', ad: 'Karma tüketim', tur: 'aralik', birim: 'l/100 km', basamak: 1 },
  { key: 'co2', ad: 'CO₂', tur: 'aralik', birim: 'g/km' },
  { key: 'euro', ad: 'Emisyon normu', tur: 'liste', ipucu: '6d, 6' },
  { key: 'depo', ad: 'Yakıt deposu', tur: 'aralik', birim: 'l' },
  { key: 'menzil', ad: 'Menzil', tur: 'aralik', birim: 'km' },
  { key: 'batarya', ad: 'Batarya', tur: 'aralik', birim: 'kWh', basamak: 1 },
  {
    key: 'govdeler',
    ad: 'Kasa tipi',
    tur: 'secim',
    secenekler: Object.entries(GOVDE) as [string, string][],
  },
  { key: 'uzunluk', ad: 'Uzunluk', tur: 'aralik', birim: 'mm' },
  { key: 'genislik', ad: 'Genişlik', tur: 'aralik', birim: 'mm' },
  { key: 'yukseklik', ad: 'Yükseklik', tur: 'aralik', birim: 'mm' },
  { key: 'dingil', ad: 'Dingil mesafesi', tur: 'aralik', birim: 'mm' },
  { key: 'yerden', ad: 'Yerden yükseklik', tur: 'aralik', birim: 'mm' },
  { key: 'bagaj', ad: 'Bagaj hacmi', tur: 'aralik', birim: 'l' },
  { key: 'agirlik', ad: 'Boş ağırlık', tur: 'aralik', birim: 'kg' },
  { key: 'azamiAgirlik', ad: 'Azami yüklü ağırlık', tur: 'aralik', birim: 'kg' },
  { key: 'donme', ad: 'Dönüş çapı', tur: 'aralik', birim: 'm', basamak: 1 },
  { key: 'cd', ad: 'Sürtünme katsayısı (Cd)', tur: 'aralik', basamak: 2 },
  { key: 'lastikler', ad: 'Lastik ölçüsü', tur: 'liste', ipucu: '205/55 R16' },
  { key: 'frenOn', ad: 'Ön fren', tur: 'liste' },
  { key: 'frenArka', ad: 'Arka fren', tur: 'liste' },
];

/** Elle düzeltme değerleri: alan → aralık ya da liste (yazılmayan alan kaynaklardan gelir) */
export type TeknikDuzeltme = Partial<Record<TeknikAlan['key'], [number, number] | string[]>>;

/** "150", "1,5–1,7", "150-170" → [a, b]; okunamazsa null */
export function aralikOku(metin: string): [number, number] | null {
  const sayi = (s: string) => {
    const t = s.trim().replace(/\s/g, '');
    // Binlik nokta ("1.598") ve ondalık virgül ("1,5")
    const n = Number(/^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t.replace(',', '.'));
    return Number.isFinite(n) && t !== '' ? n : null;
  };
  const p = metin.split(/\s*[–—-]\s*/).filter((x) => x.trim() !== '');
  if (p.length < 1 || p.length > 2) return null;
  const a = sayi(p[0] as string);
  const b = p.length === 2 ? sayi(p[1] as string) : a;
  if (a === null || b === null || a < 0 || b < a) return null;
  return [a, b];
}

/** Konsoldaki kutuda gösterilen değer: [150, 170] → "150–170" */
export function aralikMetni(a: [number, number] | null | undefined, basamak = 0): string {
  if (!a) return '';
  const f = (n: number) => sayi(n, basamak).replace(/\./g, '');
  return a[0] === a[1] ? f(a[0]) : `${f(a[0])}–${f(a[1])}`;
}

/**
 * Elle düzeltmeyi özete uygular: yazılan alan kaynaklardaki değerin yerine geçer, kaynaklara "manuel" eklenir.
 * Birden çok düzeltme sırayla uygulanır (sonraki önce gelenin üstüne yazar).
 */
export function duzeltmeUygula(
  o: TeknikOzet | null | undefined,
  duzeltmeler: readonly TeknikDuzeltme[],
): TeknikOzet | null {
  if (!duzeltmeler.length) return o ?? null;
  const out: TeknikOzet = { ...(o ?? bosOzet()) };
  const yaz = out as unknown as Record<string, unknown>;
  for (const d of duzeltmeler) for (const [k, v] of Object.entries(d)) if (v !== undefined) yaz[k] = v;
  out.kaynaklar = [...new Set([...(out.kaynaklar ?? []), 'manuel'])];
  return out;
}
