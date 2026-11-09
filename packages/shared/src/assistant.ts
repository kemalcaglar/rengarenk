import { z } from 'zod';
import { ILLER } from './iller.js';

/**
 * Talep asistanı (Karar 42): alıcı aradığı aracı kendi cümleleriyle yazar ("2019 sonrası otomatik, dizel, aile arabası,
 * 1,5 milyon bütçe"); asistan sihirbazı doldurur, alıcı kontrol edip kendisi yayınlar. Bu dosya metindeki sayıları ve
 * seçenekleri kurallarla çıkarır; marka, seri ve model API'de katalogla eşleşir. Yapay zekâ önerisi de aynı alanlara
 * dönüştürülür ve kategori şemasıyla doğrulanır; şemada olmayan alan ya da seçenek yazılmaz.
 */

export const ASSISTANT_TEXT_MAX = 500;
export const assistantSchema = z.object({ metin: z.string().trim().min(5).max(ASSISTANT_TEXT_MAX) }).strict();

/** Metinden çıkan değerler (alan anahtarları kategori şemasıyla aynı) */
export interface AssistantParse {
  yil?: { min?: number; max?: number };
  butce?: { min?: number; max?: number };
  km?: number;
  yakit?: string[];
  vites?: string[];
  renk?: string[];
  durum?: string[];
  kimden?: string[];
  hasar?: 'yok' | 'kucuk' | 'fark_etmez';
  takas?: boolean;
  konum?: { il: string; ilce?: string };
}

const kucuk = (s: string) => s.toLocaleLowerCase('tr-TR');
/** Harf ve rakam olmayan sınırla kelime arama (Türkçe harfler \b ile çalışmaz; "2", "2019"un içinde bulunmaz) */
export const kelimeVar = (metin: string, kelime: string) =>
  new RegExp(`(?<![\\p{L}\\d])${kelime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\d])`, 'iu').test(
    metin,
  );

/** "1,5 milyon" → 1_500_000; "800 bin" → 800_000; "1.250.000" → 1_250_000 */
function tutar(sayi: string, carpan?: string): number {
  let n: number;
  if (/^\d{1,3}(\.\d{3})+$/.test(sayi)) n = Number(sayi.replace(/\./g, ''));
  else if (/^\d+\.\d{1,2}$/.test(sayi)) n = Number(sayi);
  else n = Number(sayi.replace(/\./g, '').replace(',', '.'));
  const c = carpan ? kucuk(carpan) : '';
  if (c.startsWith('milyon') || c === 'm') n *= 1_000_000;
  else if (c.startsWith('bin') || c === 'k') n *= 1_000;
  return Math.round(n);
}

const YAKIT: [RegExp, string][] = [
  [/(?<!\p{L})(dizel|mazot|diesel)/iu, 'dizel'],
  [/(?<!\p{L})lpg/iu, 'lpg_benzin'],
  [/(?<!\p{L})(hibrit|hybrid)/iu, 'hibrit'],
  [/(?<!\p{L})(elektrikli|elektrik)(?!\p{L})/iu, 'elektrik'],
  [/(?<!\p{L})benzin(li)?(?!\p{L})/iu, 'benzin'],
];
const RENKLER: [string, string][] = [
  ['beyaz', 'beyaz'],
  ['gri', 'gri'],
  ['siyah', 'siyah'],
  ['lacivert', 'lacivert'],
  ['mavi', 'mavi'],
  ['kırmızı', 'kirmizi'],
  ['gümüş', 'gumus'],
  ['yeşil', 'yesil'],
  ['kahverengi', 'kahverengi'],
  ['bej', 'bej'],
  ['sarı', 'sari'],
  ['turuncu', 'turuncu'],
  ['bordo', 'bordo'],
];

export function parseDemandText(input: string): AssistantParse {
  const t = kucuk(input).replace(/[’']/g, ' ').replace(/\s+/g, ' ');
  const r: AssistantParse = {};

  // Kilometre önce: "100 bin km", "120.000 km altı" bütçe sanılmasın
  let kalan = t;
  const km = t.match(/(\d{1,3}(?:[.,]\d{3})*|\d+(?:,\d+)?)\s*(bin|k)?\s*(km|kilometre)/u);
  if (km) {
    r.km = tutar(km[1] as string, km[2]);
    kalan = kalan.replace(km[0], ' ');
  }

  // Model yılı
  const aralik = kalan.match(
    /(?<![\d.,])((?:19|20)\d{2})\s*(?:-|–|ile|ila)\s*((?:19|20)\d{2})(?!\d|[.,]\d)/u,
  );
  if (aralik) {
    const a = Number(aralik[1]);
    const b = Number(aralik[2]);
    r.yil = { min: Math.min(a, b), max: Math.max(a, b) };
    kalan = kalan.replace(aralik[0], ' ');
  } else {
    const yil = kalan.match(
      /(?<![\d.,])((?:19|20)\d{2})(?!\d|[.,]\d)\s*(?:model\s*)?(ve\s*)?(sonrası|sonra|üstü|üzeri|ve üzeri|ve sonrası|ve üstü|öncesi|önce|altı|ve altı|ve öncesi|model)?/u,
    );
    if (yil) {
      const y = Number(yil[1]);
      const ek = yil[3] ?? '';
      if (/sonra|üst|üzer/.test(ek)) r.yil = { min: y };
      else if (/önce|alt/.test(ek)) r.yil = { max: y };
      else r.yil = { min: y, max: y };
      kalan = kalan.replace(yil[0], ' ');
    }
  }

  // Bütçe: "1,5 milyon", "800 bin tl", "1.500.000 ₺", "1-1,5 milyon", "en fazla 900 bin"
  const PARA = /(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*(milyon|bin|m|k)?\s*(tl|₺|lira)?/gu;
  const adaylar: { n: number; i: number; birimli: boolean }[] = [];
  for (const m of kalan.matchAll(PARA)) {
    const birimli = Boolean(m[2] || m[3]);
    const n = tutar(m[1] as string, m[2]);
    if (!birimli && n < 10_000) continue;
    if (n < 10_000 || n > 1_000_000_000) continue;
    adaylar.push({ n, i: m.index ?? 0, birimli });
  }
  // "1-1,5 milyon": ilk sayı birimsizse ikincinin birimini alır
  const tire = kalan.match(/(\d+(?:,\d+)?)\s*(?:-|–|ile)\s*(\d+(?:,\d+)?)\s*(milyon|bin)/u);
  if (tire) {
    const a = tutar(tire[1] as string, tire[3]);
    const b = tutar(tire[2] as string, tire[3]);
    r.butce = { min: Math.min(a, b), max: Math.max(a, b) };
  } else if (adaylar.length >= 2) {
    const [a, b] = adaylar.slice(0, 2).map((x) => x.n) as [number, number];
    r.butce = { min: Math.min(a, b), max: Math.max(a, b) };
  } else if (adaylar.length === 1) {
    const a = adaylar[0] as { n: number; i: number };
    const once = kalan.slice(Math.max(0, a.i - 12), a.i);
    const sonra = kalan.slice(a.i, a.i + 40);
    if (/en az|minimum|min\./.test(once) || /(den|dan|ten|tan) (fazla|yukarı)|üstü/.test(sonra))
      r.butce = { min: a.n };
    else r.butce = { max: a.n };
  }

  const yakit = YAKIT.filter(([re]) => re.test(t)).map(([, v]) => v);
  if (yakit.length) r.yakit = yakit;
  if (/yarı\s*otomatik/u.test(t)) r.vites = ['yari_otomatik'];
  else if (/(?<!\p{L})(otomatik|otomatic|auto)(?!\p{L})/iu.test(t)) r.vites = ['otomatik'];
  if (/(?<!\p{L})(manuel|düz vites)/iu.test(t)) r.vites = [...(r.vites ?? []), 'manuel'];
  const renk = RENKLER.filter(([ad]) => kelimeVar(t, ad)).map(([, v]) => v);
  if (renk.length) r.renk = renk;

  if (/hasarsız|hasar kaydı (olmasın|yok)|tramersiz|kazasız|boyasız/u.test(t)) r.hasar = 'yok';
  else if (/küçük hasar|az hasar/u.test(t)) r.hasar = 'kucuk';
  if (kelimeVar(t, 'sıfır')) r.durum = ['sifir'];
  else if (/ikinci\s*el/u.test(t)) r.durum = ['ikinci_el'];
  const kimden = [/galeriden/u.test(t) ? 'galeri' : null, /sahibinden/u.test(t) ? 'sahibinden' : null].filter(
    (x): x is string => x !== null,
  );
  if (kimden.length) r.kimden = kimden;
  if (/takas(sız| yok| olmasın| istemiyorum)/u.test(t)) r.takas = false;
  else if (/takas/u.test(t)) r.takas = true;

  // İl ve ilçe: en uzun ad önce ("Kahramanmaraş" "Maraş"tan önce)
  const iller = [...ILLER].sort((a, b) => b.ad.length - a.ad.length);
  const il = iller.find(
    (i) => kelimeVar(t, kucuk(i.ad)) || new RegExp(`(?<!\\p{L})${kucuk(i.ad)}`, 'u').test(t),
  );
  if (il) {
    const ilce = [...il.ilceler]
      .sort((a, b) => b.length - a.length)
      .find(
        (x) =>
          kucuk(x) !== kucuk(il.ad) &&
          kucuk(x) !== 'merkez' &&
          new RegExp(`(?<!\\p{L})${kucuk(x)}`, 'u').test(t),
      );
    r.konum = ilce ? { il: il.ad, ilce } : { il: il.ad };
  }
  return r;
}
