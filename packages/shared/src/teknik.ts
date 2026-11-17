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
