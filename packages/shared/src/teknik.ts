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
  /** Konsoldan elle girilen (sahip isteği, 18 Kasım 2026): segment ("B", "C-SUV"), kapı ve koltuk sayısı, azami gücün ve
   * torkun devri (d/d), şanzımanın adı ("X-Tronic", "EDC") */
  segmentler?: string[];
  kapilar?: Aralik;
  koltuklar?: Aralik;
  gucDevir?: Aralik;
  torkDevir?: Aralik;
  sanzimanlar?: string[];
  /** Kaynaklar: "ademe", "vmm", "tsb", "manuel" */
  kaynaklar?: string[];
  /** Konsolda bu araç için gizlenen satırlar (satır anahtarı: `TEKNIK_SATIRLAR`; sahip isteği, 18 Kasım 2026) */
  gizli?: string[];
  /** Konsolda bu araca eklenen serbest satırlar (bölümün sonuna ya da yeni bölüme) */
  ekSatirlar?: EkSatir[];
}

/** Konsoldan eklenen serbest teknik satır: "Ölçüler ve ağırlık" › "Bagaj (koltuklar yatık)" = "1.146 l" */
export interface EkSatir {
  bolum: string;
  etiket: string;
  deger: string;
}

/** Donanım grubu (sahip isteği, 18 Kasım 2026): "Güvenlik" → ["ABS", "Isofix"]; konsoldan elle girilir */
export interface DonanimGrubu {
  ad: string;
  ogeler: string[];
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
  const g = new Set(o.gizli ?? []);
  const out: Satir[] = [];
  if (o.vitesler.length && !g.has('vitesler')) out.push(['Vites', o.vitesler.map(vitesYaz).join(' ya da ')]);
  if (o.hp && !g.has('hp')) out.push(['Güç', `${aralik(o.hp)} hp${o.kw ? ` (${aralik(o.kw)} kW)` : ''}`]);
  if (o.hizlanma && !g.has('hizlanma')) out.push(['0-100 km/s', `${aralik(o.hizlanma, 1)} sn`]);
  if (o.tuketim && !g.has('tuketim')) out.push(['Karma tüketim', `${aralik(o.tuketim, 1)} l/100 km`]);
  if (o.co2 && !g.has('co2')) out.push(['CO₂', `${aralik(o.co2)} g/km`]);
  if (o.agirlik && !g.has('agirlik')) out.push(['Boş ağırlık', `${aralik(o.agirlik)} kg`]);
  if (o.euro.length && !g.has('euro')) out.push(['Emisyon', o.euro.map((e) => `Euro ${e}`).join(', ')]);
  return out;
}

export interface TeknikBolum {
  baslik: string;
  satirlar: Satir[];
}

/** Bölümlerin sırası (ek satırda yeni bölüm adı da yazılabilir; yeni bölümler sona eklenir) */
export const TEKNIK_BOLUMLER = [
  'Genel',
  'Motor',
  'Performans',
  'Şanzıman ve çekiş',
  'Yakıt tüketimi ve emisyon',
  'Ölçüler ve ağırlık',
  'Lastik ve fren',
] as const;

type SatirTanimi = {
  /** Satırın anahtarı (gizlemede kullanılır): değerin ana alanı */
  key: string;
  bolum: (typeof TEKNIK_BOLUMLER)[number];
  etiket: string;
  deger: (o: TeknikOzet) => string | null;
};

const ar = (a: Aralik | undefined, birim: string, basamak = 0): string | null =>
  a ? `${aralik(a, basamak)} ${birim}` : null;
const liste = (xs: string[] | undefined, f: (x: string) => string = (x) => x) =>
  xs?.length ? [...new Set(xs.map(f))].join(' ya da ') : null;
const devir = (a: Aralik | undefined) => (a ? `, ${aralik(a)} d/d` : '');

/** Talep sayfasındaki ayrıntılı tablonun satırları, bölüm sırasıyla (konsolda gizlenebilir) */
export const TEKNIK_SATIRLAR: readonly SatirTanimi[] = [
  {
    key: 'govdeler',
    bolum: 'Genel',
    etiket: 'Kasa tipi',
    deger: (o) => liste(o.govdeler, (g) => GOVDE[g] ?? g),
  },
  { key: 'segmentler', bolum: 'Genel', etiket: 'Segment', deger: (o) => liste(o.segmentler) },
  {
    key: 'kapilar',
    bolum: 'Genel',
    etiket: 'Kapı sayısı',
    deger: (o) => (o.kapilar ? aralik(o.kapilar) : null),
  },
  {
    key: 'koltuklar',
    bolum: 'Genel',
    etiket: 'Koltuk sayısı',
    deger: (o) => (o.koltuklar ? aralik(o.koltuklar) : null),
  },
  { key: 'hacimCc', bolum: 'Motor', etiket: 'Motor hacmi', deger: (o) => ar(o.hacimCc, 'cm³') },
  { key: 'silindirler', bolum: 'Motor', etiket: 'Silindir', deger: (o) => liste(o.silindirler, silindirYaz) },
  {
    key: 'hp',
    bolum: 'Motor',
    etiket: 'Güç',
    deger: (o) =>
      o.hp ? `${aralik(o.hp)} hp${o.kw ? ` (${aralik(o.kw)} kW)` : ''}${devir(o.gucDevir)}` : null,
  },
  {
    key: 'tork',
    bolum: 'Motor',
    etiket: 'Tork',
    deger: (o) => (o.tork ? `${aralik(o.tork)} Nm${devir(o.torkDevir)}` : null),
  },
  {
    key: 'yakitSistemleri',
    bolum: 'Motor',
    etiket: 'Yakıt sistemi',
    deger: (o) => liste(o.yakitSistemleri, teknikCevir),
  },
  { key: 'hizlanma', bolum: 'Performans', etiket: '0-100 km/s', deger: (o) => ar(o.hizlanma, 'sn', 1) },
  { key: 'azamiHiz', bolum: 'Performans', etiket: 'Azami hız', deger: (o) => ar(o.azamiHiz, 'km/s') },
  { key: 'vitesler', bolum: 'Şanzıman ve çekiş', etiket: 'Vites', deger: (o) => liste(o.vitesler, vitesYaz) },
  { key: 'sanzimanlar', bolum: 'Şanzıman ve çekiş', etiket: 'Şanzıman', deger: (o) => liste(o.sanzimanlar) },
  {
    key: 'cekisler',
    bolum: 'Şanzıman ve çekiş',
    etiket: 'Çekiş',
    deger: (o) => liste(o.cekisler, (c) => CEKIS[c] ?? c),
  },
  {
    key: 'tuketimSehir',
    bolum: 'Yakıt tüketimi ve emisyon',
    etiket: 'Şehir içi',
    deger: (o) => ar(o.tuketimSehir, 'l/100 km', 1),
  },
  {
    key: 'tuketimSehirDisi',
    bolum: 'Yakıt tüketimi ve emisyon',
    etiket: 'Şehir dışı',
    deger: (o) => ar(o.tuketimSehirDisi, 'l/100 km', 1),
  },
  {
    key: 'tuketim',
    bolum: 'Yakıt tüketimi ve emisyon',
    etiket: 'Karma',
    deger: (o) => ar(o.tuketim, 'l/100 km', 1),
  },
  { key: 'co2', bolum: 'Yakıt tüketimi ve emisyon', etiket: 'CO₂', deger: (o) => ar(o.co2, 'g/km') },
  {
    key: 'euro',
    bolum: 'Yakıt tüketimi ve emisyon',
    etiket: 'Emisyon normu',
    deger: (o) => (o.euro.length ? o.euro.map((e) => `Euro ${e}`).join(', ') : null),
  },
  { key: 'depo', bolum: 'Yakıt tüketimi ve emisyon', etiket: 'Yakıt deposu', deger: (o) => ar(o.depo, 'l') },
  { key: 'menzil', bolum: 'Yakıt tüketimi ve emisyon', etiket: 'Menzil', deger: (o) => ar(o.menzil, 'km') },
  {
    key: 'batarya',
    bolum: 'Yakıt tüketimi ve emisyon',
    etiket: 'Batarya',
    deger: (o) => ar(o.batarya, 'kWh', 1),
  },
  { key: 'uzunluk', bolum: 'Ölçüler ve ağırlık', etiket: 'Uzunluk', deger: (o) => ar(o.uzunluk, 'mm') },
  { key: 'genislik', bolum: 'Ölçüler ve ağırlık', etiket: 'Genişlik', deger: (o) => ar(o.genislik, 'mm') },
  { key: 'yukseklik', bolum: 'Ölçüler ve ağırlık', etiket: 'Yükseklik', deger: (o) => ar(o.yukseklik, 'mm') },
  { key: 'dingil', bolum: 'Ölçüler ve ağırlık', etiket: 'Dingil mesafesi', deger: (o) => ar(o.dingil, 'mm') },
  {
    key: 'yerden',
    bolum: 'Ölçüler ve ağırlık',
    etiket: 'Yerden yükseklik',
    deger: (o) => ar(o.yerden, 'mm'),
  },
  { key: 'bagaj', bolum: 'Ölçüler ve ağırlık', etiket: 'Bagaj hacmi', deger: (o) => ar(o.bagaj, 'l') },
  { key: 'agirlik', bolum: 'Ölçüler ve ağırlık', etiket: 'Boş ağırlık', deger: (o) => ar(o.agirlik, 'kg') },
  {
    key: 'azamiAgirlik',
    bolum: 'Ölçüler ve ağırlık',
    etiket: 'Azami yüklü ağırlık',
    deger: (o) => ar(o.azamiAgirlik, 'kg'),
  },
  { key: 'donme', bolum: 'Ölçüler ve ağırlık', etiket: 'Dönüş çapı', deger: (o) => ar(o.donme, 'm', 1) },
  {
    key: 'cd',
    bolum: 'Ölçüler ve ağırlık',
    etiket: 'Sürtünme katsayısı (Cd)',
    deger: (o) => (o.cd ? aralik(o.cd, 2) : null),
  },
  { key: 'lastikler', bolum: 'Lastik ve fren', etiket: 'Lastik ölçüsü', deger: (o) => liste(o.lastikler) },
  { key: 'frenOn', bolum: 'Lastik ve fren', etiket: 'Ön fren', deger: (o) => liste(o.frenOn, teknikCevir) },
  {
    key: 'frenArka',
    bolum: 'Lastik ve fren',
    etiket: 'Arka fren',
    deger: (o) => liste(o.frenArka, teknikCevir),
  },
];

/**
 * Talep sayfasındaki ayrıntılı tablo: bölüm bölüm (boş bölüm gelmez). Konsolda gizlenen satırlar çıkar, eklenen
 * serbest satırlar bölümünün sonuna (aynı etiket varsa onun yerine) ya da yeni bölüm olarak sona eklenir.
 */
export function teknikBolumleri(o: TeknikOzet): TeknikBolum[] {
  const gizli = new Set(o.gizli ?? []);
  const bolumler = new Map<string, Satir[]>(TEKNIK_BOLUMLER.map((b) => [b, []]));
  for (const t of TEKNIK_SATIRLAR) {
    if (gizli.has(t.key)) continue;
    const d = t.deger(o);
    if (d) bolumler.get(t.bolum)?.push([t.etiket, d]);
  }
  for (const e of o.ekSatirlar ?? []) {
    const bolum = e.bolum.trim() || 'Diğer';
    const satirlar = bolumler.get(bolum) ?? bolumler.set(bolum, []).get(bolum) ?? [];
    const i = satirlar.findIndex(
      ([et]) => et.toLocaleLowerCase('tr-TR') === e.etiket.toLocaleLowerCase('tr-TR'),
    );
    if (i >= 0) satirlar[i] = [e.etiket, e.deger];
    else satirlar.push([e.etiket, e.deger]);
  }
  return [...bolumler]
    .filter(([, satirlar]) => satirlar.length > 0)
    .map(([baslik, satirlar]) => ({ baslik, satirlar }));
}

/** Öne çıkan dört değer (talep sayfasının üstündeki renkli kutular): gizlenmeyen ve bilinenler */
export function teknikOneCikanlar(o: TeknikOzet): { etiket: string; deger: string; birim: string }[] {
  const gizli = new Set(o.gizli ?? []);
  const out: { etiket: string; deger: string; birim: string }[] = [];
  const ekle = (key: string, etiket: string, a: Aralik | undefined, birim: string, basamak = 0) => {
    if (a && !gizli.has(key)) out.push({ etiket, deger: aralik(a, basamak), birim });
  };
  ekle('hp', 'Güç', o.hp, 'hp');
  ekle('tork', 'Tork', o.tork, 'Nm');
  ekle('hizlanma', '0-100 km/s', o.hizlanma, 'sn', 1);
  if (o.tuketim) ekle('tuketim', 'Karma tüketim', o.tuketim, 'l/100 km', 1);
  else if (o.menzil) ekle('menzil', 'Menzil', o.menzil, 'km');
  else ekle('azamiHiz', 'Azami hız', o.azamiHiz, 'km/s');
  return out;
}

/** Teknik değerlerin kaynağı (kullanıcıya gösterilen not) */
export const TEKNIK_KAYNAK =
  'Avrupa onay değerleri (ADEME, Fransa) ve vehicle-makes-models motor kayıtları; Türkiye’de satılan sürümle eşleşir, vites türü sürümün TSB’deki adından';

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
  {
    key: 'govdeler',
    ad: 'Kasa tipi',
    tur: 'secim',
    secenekler: Object.entries(GOVDE) as [string, string][],
  },
  { key: 'segmentler', ad: 'Segment', tur: 'liste', ipucu: 'B, C-SUV' },
  { key: 'kapilar', ad: 'Kapı sayısı', tur: 'aralik' },
  { key: 'koltuklar', ad: 'Koltuk sayısı', tur: 'aralik' },
  { key: 'hacimCc', ad: 'Motor hacmi', tur: 'aralik', birim: 'cm³' },
  { key: 'silindirler', ad: 'Silindir', tur: 'liste', ipucu: 'L4, V6, H4' },
  { key: 'hp', ad: 'Güç', tur: 'aralik', birim: 'hp' },
  { key: 'kw', ad: 'Güç (kW)', tur: 'aralik' },
  { key: 'gucDevir', ad: 'Azami güç devri', tur: 'aralik', birim: 'd/d' },
  { key: 'tork', ad: 'Tork', tur: 'aralik', birim: 'Nm' },
  {
    key: 'torkDevir',
    ad: 'Azami tork devri',
    tur: 'aralik',
    birim: 'd/d',
    ipucu: 'ör. 1750 ya da 1750–3500',
  },
  { key: 'yakitSistemleri', ad: 'Yakıt sistemi', tur: 'liste', ipucu: 'Turbo direkt enjeksiyon' },
  { key: 'hizlanma', ad: '0-100 km/s', tur: 'aralik', birim: 'sn', basamak: 1 },
  { key: 'azamiHiz', ad: 'Azami hız', tur: 'aralik', birim: 'km/s' },
  { key: 'vitesler', ad: 'Vites', tur: 'liste', ipucu: 'manuel:6, otomatik:7, yari_otomatik:6' },
  { key: 'sanzimanlar', ad: 'Şanzıman', tur: 'liste', ipucu: 'X-Tronic, EDC, DSG' },
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

/** Bir kaydın satır düzeni: gizlenen satırlar ve eklenen serbest satırlar (sahip isteği, 18 Kasım 2026) */
export interface TeknikDuzen {
  gizli?: string[];
  ekSatirlar?: EkSatir[];
}

/** Gizlenebilen satır anahtarları */
export const TEKNIK_SATIR_ANAHTARLARI: ReadonlySet<string> = new Set(TEKNIK_SATIRLAR.map((t) => t.key));

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
  duzenler: readonly TeknikDuzen[] = [],
): TeknikOzet | null {
  const duzenli = duzenler.filter((d) => d.gizli?.length || d.ekSatirlar?.length);
  if (!duzeltmeler.length && !duzenli.length) return o ?? null;
  const out: TeknikOzet = { ...(o ?? bosOzet()) };
  const yaz = out as unknown as Record<string, unknown>;
  for (const d of duzeltmeler) for (const [k, v] of Object.entries(d)) if (v !== undefined) yaz[k] = v;
  // Gizlenenler birleşir; aynı bölüm ve etiketli ek satırda sonraki (daha özel ya da yeni kayıt) geçerlidir
  const gizli = new Set(out.gizli ?? []);
  const ek = new Map((out.ekSatirlar ?? []).map((e) => [ekAnahtari(e), e]));
  for (const d of duzenli) {
    for (const g of d.gizli ?? []) gizli.add(g);
    for (const e of d.ekSatirlar ?? []) ek.set(ekAnahtari(e), e);
  }
  if (gizli.size) out.gizli = [...gizli];
  if (ek.size) out.ekSatirlar = [...ek.values()];
  if (duzeltmeler.length || ek.size) out.kaynaklar = [...new Set([...(out.kaynaklar ?? []), 'manuel'])];
  return out;
}

const ekAnahtari = (e: EkSatir) =>
  `${e.bolum.trim().toLocaleLowerCase('tr-TR')}|${e.etiket.trim().toLocaleLowerCase('tr-TR')}`;

/**
 * Bilgisi eksik sayılan alanlar (sahip isteği, 18 Kasım 2026: konsolda "Bilgisi eksik araçlar"): özette yoksa eksiktir.
 * Tüketimde karma ya da şehir içi değerden biri yeter.
 */
const EKSIK_KONTROL: readonly (readonly [string, string, (o: TeknikOzet) => boolean])[] = [
  ['Vites', 'vitesler', (o) => o.vitesler.length > 0],
  ['Güç', 'hp', (o) => !!o.hp],
  ['Tork', 'tork', (o) => !!o.tork],
  ['0-100 km/s', 'hizlanma', (o) => !!o.hizlanma],
  ['Azami hız', 'azamiHiz', (o) => !!o.azamiHiz],
  ['Yakıt tüketimi', 'tuketim', (o) => !!(o.tuketim || o.tuketimSehir)],
  ['Yakıt deposu', 'depo', (o) => !!(o.depo || o.batarya)],
  ['Ölçüler', 'uzunluk', (o) => !!o.uzunluk],
  ['Bagaj hacmi', 'bagaj', (o) => !!o.bagaj],
  ['Boş ağırlık', 'agirlik', (o) => !!o.agirlik],
];

/** Özette eksik olan temel alanların adları (özet yoksa hepsi); konsolda gizlenen satır eksik sayılmaz */
export function teknikEksikleri(o: TeknikOzet | null | undefined): string[] {
  const gizli = new Set(o?.gizli ?? []);
  return EKSIK_KONTROL.filter(([, key, var_]) => !gizli.has(key) && (!o || !var_(o))).map(([ad]) => ad);
}
