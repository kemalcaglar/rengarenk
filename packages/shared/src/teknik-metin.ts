import { kasaTipiOf } from './sihirbaz.js';
import type { DonanimGrubu, TeknikDuzeltme } from './teknik.js';

/**
 * Konsolda yapıştırılan teknik özellik ve donanım metni (sahip isteği, 18 Kasım 2026). Satırlar "Etiket<TAB>Değer"
 * (ya da "Etiket: Değer") biçimindedir; "--Bölüm--" başlıkları, "--Donanım--" bölümünden sonra "-Grup-" başlıkları ve
 * değersiz satırlar donanım öğesidir. Tanınan etiketler alanlara yazılır; tanınmayanlar `okunamayan` listesinde döner
 * (tahmin edilmez). Sonuç kaydedilmeden önce konsolda gösterilir ve düzeltilebilir.
 */
export interface TeknikMetinSonucu {
  degerler: TeknikDuzeltme;
  donanim: DonanimGrubu[];
  /** "Model Üretim Yılı (İlk / Son)": [2020, null] (devam ediyor) */
  yillar: [number | null, number | null] | null;
  okunamayan: string[];
}

/** Karşılaştırma için: küçük harf, Türkçe harfler sadeleşir, noktalama boşluk olur */
export function etiketNorm(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SAYI = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g;

/** "1.190" → 1190, "6.0" → 6, "12,4" → 12.4: noktadan sonra tam üç rakam binlik ayırıcıdır */
function sayiOku(t: string): number {
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  return Number(t.replace(',', '.'));
}

/** Metindeki sayılar sırayla */
function sayilar(v: string): number[] {
  return (v.match(SAYI) ?? []).map(sayiOku).filter(Number.isFinite);
}

/** Birimden hemen önceki sayı ya da aralık ("4.500 rpm", "1.750-3.500 rpm") */
function birimli(v: string, birim: RegExp): [number, number] | null {
  const re = new RegExp(`(\\d[\\d.,]*)(?:\\s*[-–]\\s*(\\d[\\d.,]*))?\\s*(?:${birim.source})(?![a-z])`, 'i');
  const m = re.exec(v);
  if (!m) return null;
  const a = sayiOku(m[1] as string);
  const b = m[2] ? sayiOku(m[2]) : a;
  return Number.isFinite(a) && Number.isFinite(b) && a <= b ? [a, b] : null;
}

const tek = (n: number | undefined): [number, number] | null =>
  n !== undefined && Number.isFinite(n) ? [n, n] : null;

const CEKIS: [RegExp, string][] = [
  [/onden|on ceker|fwd/, 'onden'],
  [/arkadan|arka ceker|rwd/, 'arkadan'],
  [/4x4|dort ceker|awd|4wd|quattro|xdrive|4matic|4motion|all4|q4|sh awd|4 ceker/, '4x4'],
];
const cekisOf = (n: string) => CEKIS.find(([re]) => re.test(n))?.[1] ?? null;

const YARI_OTOMATIK =
  /yari otomatik|\bamt\b|robotize|dualogic|easytronic|\bmmt\b|\basg\b|sensodrive|selespeed|\bsmg\b/;
const OTOMATIK =
  /otomatik|\bcvt\b|\becvt\b|tronic|\bedc\b|\bdsg\b|\bdct\b|\bpdk\b|\beat\d?\b|powershift|\bvt\b|\bat\b|tork konvertor|torque converter|geartronic|sportshift|speedshift|ivt|\b[789]g\b|dual clutch|cift kavrama/;
const MANUEL = /manuel|\bduz\b|\bmt\b|\bmanual\b/;

/** Vites türü ve ileri sayısı ("X-Tronic / VT Vites" → "otomatik:", "6 İleri Manuel" → "manuel:6") */
function vitesOku(n: string): string | null {
  const tur = YARI_OTOMATIK.test(n)
    ? 'yari_otomatik'
    : OTOMATIK.test(n)
      ? 'otomatik'
      : MANUEL.test(n)
        ? 'manuel'
        : null;
  if (!tur) return null;
  const adet = /(\d{1,2}) ?(?:ileri|vites|kademe|speed|hiz)/.exec(n)?.[1] ?? '';
  return `${tur}:${adet}`;
}

/** Donanım satırının değeri: yoksa düşer, isteğe bağlıysa işaretlenir, başka değer öğeye eklenir */
function donanimOgesi(etiket: string, deger: string): string | null {
  const d = etiketNorm(deger);
  if (!d || /^(var|evet|standart|std|seri|mevcut|x|v)$/.test(d) || /^[✓✔√•*+]+$/.test(deger.trim()))
    return etiket;
  if (/^(yok|hayir|bulunmuyor|mevcut degil)$/.test(d) || /^[-–—✗✘×]+$/.test(deger.trim())) return null;
  if (/^(opsiyonel|ops|istege bagli|paket)$/.test(d)) return `${etiket} (isteğe bağlı)`;
  return `${etiket}: ${deger.trim()}`;
}

type Yaz = (
  v: string,
  n: string,
  d: Record<string, [number, number] | string[]>,
  s: TeknikMetinSonucu,
) => boolean;

const ar =
  (key: string, birim?: RegExp, carp = 1): Yaz =>
  (v, _n, d) => {
    const r = birim ? (birimli(v, birim) ?? tek(sayilar(v)[0])) : tek(sayilar(v)[0]);
    if (!r) return false;
    d[key] = [r[0] * carp, r[1] * carp].map((x) => Math.round(x * 100) / 100) as [number, number];
    return true;
  };

/**
 * Etiket → alan (sıra önemli: "Maksimum Güç" "Maksimum Hız"dan, "Yerden Yükseklik" "Yükseklik"ten önce). Etiket
 * `etiketNorm` ile karşılaştırılır.
 */
const KURALLAR: [RegExp, Yaz][] = [
  [
    /uretim yil|model yil/,
    (v, n, _d, s) => {
      const y = (v.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number);
      if (!y.length) return false;
      s.yillar = [y[0] as number, /devam|halen|gunumuz|hala/.test(n) ? null : (y[1] ?? null)];
      return true;
    },
  ],
  [
    /segment/,
    (v, _n, d) => {
      const t = v
        .replace(/segmenti?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!t) return false;
      d.segmentler = [t.toLocaleUpperCase('tr-TR')];
      return true;
    },
  ],
  [
    /kasa tipi|kasa turu|govde tipi|kapi sayisi/,
    (v, _n, d) => {
      let ok = false;
      for (const p of v.split('/')) {
        const g = kasaTipiOf(p);
        if (g) {
          d.govdeler = [g];
          ok = true;
        }
        const k = /(\d)\s*kap/i.exec(p)?.[1] ?? (/^\s*\d\s*$/.test(p) ? p.trim() : null);
        if (k) {
          d.kapilar = [Number(k), Number(k)];
          ok = true;
        }
      }
      return ok;
    },
  ],
  [
    /motor tipi|silindir sayisi|^silindir$/,
    (v, _n, d) => {
      const m = /(\d{1,2})\s*silindir/i.exec(v) ?? /\b([LVHW]\d{1,2})\b/i.exec(v);
      const sade = /^\s*(\d{1,2})\s*$/.exec(v);
      const deger = m?.[1] ?? sade?.[1];
      if (!deger) return false;
      d.silindirler = [deger.toUpperCase()];
      return true;
    },
  ],
  [
    /tuketim|yakit ortalamasi/,
    (v, n, d) => {
      const x = sayilar(v);
      if (!x.length) return false;
      const etiket = n;
      if (/sehir ici/.test(etiket) && /sehir disi/.test(etiket)) {
        if (x[0] !== undefined) d.tuketimSehir = [x[0], x[0]];
        if (x[1] !== undefined) d.tuketimSehirDisi = [x[1], x[1]];
        if (x[2] !== undefined) d.tuketim = [x[2], x[2]];
        return true;
      }
      const k = /sehir ici/.test(etiket)
        ? 'tuketimSehir'
        : /sehir disi|otoyol/.test(etiket)
          ? 'tuketimSehirDisi'
          : 'tuketim';
      d[k] = [x[0] as number, x[0] as number];
      return true;
    },
  ],
  [
    /guc/,
    (v, _n, d) => {
      const hp = birimli(v, /hp|ps|bg|beygir/);
      const kw = birimli(v, /kw/);
      const devir = birimli(v, /rpm|d\/d|d\/dk|dev\/dk/);
      if (hp) d.hp = hp;
      else if (!kw && sayilar(v)[0] !== undefined) d.hp = tek(sayilar(v)[0]) as [number, number];
      if (kw) d.kw = kw;
      if (devir) d.gucDevir = devir;
      return !!(d.hp || kw);
    },
  ],
  [
    /tork/,
    (v, _n, d) => {
      const nm = birimli(v, /nm/) ?? tek(sayilar(v)[0]);
      const devir = birimli(v, /rpm|d\/d|d\/dk|dev\/dk/);
      if (!nm) return false;
      d.tork = nm;
      if (devir) d.torkDevir = devir;
      return true;
    },
  ],
  [
    /sanziman|vites|cekis/,
    (v, _n, d) => {
      const adlar: string[] = [];
      let vites: string | null = null;
      for (const p of v
        .split('/')
        .map((x) => x.trim())
        .filter(Boolean)) {
        const pn = etiketNorm(p);
        const c = cekisOf(pn);
        if (c) {
          d.cekisler = [c];
          continue;
        }
        vites ??= vitesOku(pn);
        // "Vites" ya da "Otomatik" gibi genel sözcük şanzımanın adı değildir
        if (!/^(vites|sanziman|otomatik|manuel|duz)( vites| sanziman)?$/.test(pn)) adlar.push(p);
      }
      if (!vites && adlar.length) vites = vitesOku(etiketNorm(adlar.join(' ')));
      if (vites) d.vitesler = [vites];
      if (adlar.length) d.sanzimanlar = [adlar.join(' / ')];
      return !!(vites || d.cekisler || adlar.length);
    },
  ],
  [/hizlanma|0 100/, ar('hizlanma', /sn|saniye|s/)],
  [/azami (surat|hiz)|maks\w* (hiz|surat)|son (surat|hiz)|en yuksek hiz|max hiz/, ar('azamiHiz', /km/)],
  [/depo/, ar('depo', /lt|l|litre/)],
  [
    /motor hacmi|silindir hacmi|hacim/,
    (v, _n, d) => {
      const x = birimli(v, /cc|cm3|cm³/) ?? tek(sayilar(v)[0]);
      if (!x) return false;
      // "1.0 L" gibi litreyle yazılmışsa
      d.hacimCc = x[1] < 10 ? [Math.round(x[0] * 1000), Math.round(x[1] * 1000)] : x;
      return true;
    },
  ],
  [/koltuk|yolcu kapasitesi/, ar('koltuklar')],
  [/yerden yukseklik/, ar('yerden', /mm/)],
  [/dingil|aks mesafesi|aks arasi/, ar('dingil', /mm/)],
  [/^uzunluk/, ar('uzunluk', /mm/)],
  [/^genislik/, ar('genislik', /mm/)],
  [/^yukseklik/, ar('yukseklik', /mm/)],
  [/azami agirlik|toplam agirlik|yuklu agirlik|izin verilen/, ar('azamiAgirlik', /kg/)],
  [/agirlik/, ar('agirlik', /kg/)],
  [/bagaj/, ar('bagaj', /lt|l|litre/)],
  [
    /lastik|jant olcu/,
    (v, _n, d) => {
      const t = v.replace(/\s+/g, ' ').trim();
      if (!t) return false;
      d.lastikler = [t];
      return true;
    },
  ],
  [/co2|karbondioksit/, ar('co2', /g/)],
  [
    /emisyon|euro/,
    (v, _n, d) => {
      const m = /euro\s*([0-9][a-z0-9-]*)/i.exec(v) ?? /^\s*([0-9][a-z0-9-]*)\s*$/i.exec(v);
      if (!m) return false;
      d.euro = [(m[1] as string).toLowerCase()];
      return true;
    },
  ],
  [/menzil/, ar('menzil', /km/)],
  [/batarya|aku kapasite/, ar('batarya', /kwh/)],
  [
    /on fren/,
    (v, _n, d) => {
      d.frenOn = [v.trim()];
      return !!v.trim();
    },
  ],
  [
    /arka fren/,
    (v, _n, d) => {
      d.frenArka = [v.trim()];
      return !!v.trim();
    },
  ],
  [/surtunme|^cd$/, ar('cd')],
];

/** Değeri olmayan bilgi satırları (katalogdan gelir, okunmaz ama "okunamadı" da sayılmaz) */
const BILGI = /^(yakit|yakit tipi|yakit turu|marka|model|seri|paket|donanim paketi|versiyon)$/;

/** "Etiket<TAB>Değer", "Etiket: Değer" ya da "Etiket   Değer" */
function bol(satir: string): [string, string] {
  const tab = satir.split('\t');
  if (tab.length > 1) return [(tab[0] as string).trim(), tab.slice(1).join(' ').trim()];
  const iki = /^(.+?)\s{2,}(.+)$/.exec(satir);
  if (iki) return [(iki[1] as string).trim(), (iki[2] as string).trim()];
  const nokta = /^([^:]{2,60}):\s*(.*)$/.exec(satir);
  if (nokta) return [(nokta[1] as string).trim(), (nokta[2] as string).trim()];
  return [satir.trim(), ''];
}

/** Yapıştırılan metni okur (bkz. `TeknikMetinSonucu`) */
export function teknikMetniOku(metin: string): TeknikMetinSonucu {
  const s: TeknikMetinSonucu = { degerler: {}, donanim: [], yillar: null, okunamayan: [] };
  const d = s.degerler as Record<string, [number, number] | string[]>;
  let donanimda = false;
  let grup: DonanimGrubu | null = null;
  const grupAc = (ad: string) => {
    grup = s.donanim.find((g) => g.ad === ad) ?? { ad, ogeler: [] };
    if (!s.donanim.includes(grup)) s.donanim.push(grup);
  };
  for (const ham of metin.replace(/\r/g, '').split('\n')) {
    const satir = ham.replace(/ /g, ' ').trimEnd();
    if (!satir.trim()) continue;
    // "--Bölüm--", "-Grup-" ya da "## Bölüm" (tireyle başlayıp bitmeyen satır madde işaretidir: "- ABS")
    const baslik = /^\s*-+\s*([^-].*?)\s*-+\s*$/.exec(satir) ?? /^\s*#{1,3}\s*(.+?)\s*$/.exec(satir);
    if (baslik && !satir.includes('\t')) {
      const ad = (baslik[1] as string).trim();
      const n = etiketNorm(ad);
      // Donanım bölümünden sonra her başlık bir gruptur ("-İç Donanım-")
      if (donanimda) grupAc(ad);
      else if (/donanim|ozellik listesi|ekipman/.test(n)) {
        donanimda = true;
        grup = null;
      }
      continue;
    }
    const [etiket, deger] = bol(satir.replace(/^\s*[-•*·]\s+/, ''));
    if (donanimda) {
      const oge = donanimOgesi(etiket, deger);
      if (!oge) continue;
      if (!grup) grupAc('Donanım');
      const g = grup as unknown as DonanimGrubu;
      if (!g.ogeler.includes(oge)) g.ogeler.push(oge);
      continue;
    }
    const n = etiketNorm(etiket);
    if (BILGI.test(n)) continue;
    const kural = deger ? KURALLAR.find(([re]) => re.test(n)) : undefined;
    const okundu = kural ? kural[1](deger, etiketNorm(`${etiket} ${deger}`), d, s) : false;
    if (!okundu) s.okunamayan.push(satir.trim());
  }
  s.donanim = s.donanim.filter((g) => g.ogeler.length);
  return s;
}

/** Donanım metni ("-Güvenlik-" satırı ve altında öğeler) → gruplar; konsoldaki donanım kutusu bu biçimdedir */
export function donanimOku(metin: string): DonanimGrubu[] {
  const r = teknikMetniOku(`--Donanım--\n${metin}`);
  return r.donanim;
}

/** Gruplar → donanım kutusunun metni */
export function donanimYaz(gruplar: readonly DonanimGrubu[]): string {
  return gruplar.map((g) => [`-${g.ad}-`, ...g.ogeler].join('\n')).join('\n');
}
