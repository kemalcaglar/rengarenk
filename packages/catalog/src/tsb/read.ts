import { isXls, readXlsFirstSheet } from '../xls.js';
import { type Cell, readFirstSheet } from '../xlsx.js';

/** TSB kasko değer listesinin bir satırı. Kasko bedelleri okunmaz; yalnızca hangi model yıllarında var olduğu. */
export interface TsbRow {
  brandCode: string;
  typeCode: string;
  brandName: string;
  typeName: string;
  /** Bu tipin listede bulunduğu model yılları (artan sırada) */
  years: number[];
}

export interface TsbList {
  /** Dosyanın başlığındaki dönem, ör. "Ekim 2026" */
  periodLabel: string;
  year: number;
  month: number;
  rows: TsbRow[];
}

const MONTHS = [
  'ocak',
  'şubat',
  'mart',
  'nisan',
  'mayıs',
  'haziran',
  'temmuz',
  'ağustos',
  'eylül',
  'ekim',
  'kasım',
  'aralık',
];

const norm = (c: Cell) =>
  String(c ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR');
/** Başlık hücresi boşluksuz: "Marka Kodu" = "MarkaKodu" (2006–2019 dosyaları) */
const head = (c: Cell) => norm(c).replace(/\s+/g, '');

/**
 * TSB dosyasını okur. Biçim (Ekim 2026): 1. satır dönem ("Ekim 2026"), 2. satır başlık (Marka Kodu, Tip Kodu,
 * Marka Adı, Tip Adı, 2026 … 2012), sonra her tip bir satır; yıl sütunlarındaki sıfırdan büyük değer o model
 * yılında tipin var olduğunu gösterir. Değerin kendisi (kasko bedeli) hiçbir yerde saklanmaz (Karar 33).
 * Başlık satırı aranarak bulunur; sütun sırası değişse de okunur. 2006–2019 dosyaları eski Excel (.xls) biçimindedir
 * ve başlıkları farklı yazılır ("MarkaKodu", "Tip", "2007_Fiyatı"; dönem "2006 KASIM"); onlar da okunur.
 * `period`: dosyada dönem yazılı değilse kullanılacak dönem.
 */
export function readTsbList(
  file: Uint8Array,
  opts: { period?: { year: number; month: number } } = {},
): TsbList {
  const rows = isXls(file) ? readXlsFirstSheet(file) : readFirstSheet(file);
  const headerIdx = rows.findIndex(
    (r) =>
      r.some((c) => ['markakodu', 'markaadı', 'marka'].includes(head(c))) &&
      r.some((c) => ['tipadı', 'tip'].includes(head(c))),
  );
  if (headerIdx < 0) throw new Error('TSB başlık satırı bulunamadı (Marka Kodu, Tip Adı)');
  const header = rows[headerIdx] as Cell[];
  const col = (...names: string[]) => header.findIndex((c) => names.includes(head(c)));
  const iBrandCode = col('markakodu');
  const iTypeCode = col('tipkodu');
  const iBrand = col('markaadı', 'marka');
  const iType = col('tipadı', 'tip');
  if ([iBrand, iType].some((i) => i < 0)) throw new Error('TSB başlığında beklenen sütunlar eksik');
  // "15 model yılından eski araçlar" listesinde (2010–2017) kod sütunu yoktur: kimlik marka ve tip adından
  const kodsuz = iBrandCode < 0 || iTypeCode < 0;
  const yearCols = header
    .map((c, i) => ({ year: Number(/^(\d{4})(?:_\S*)?$/.exec(String(c ?? '').trim())?.[1]), i }))
    .filter((y) => Number.isInteger(y.year) && y.year >= 1950 && y.year <= 2100);
  if (yearCols.length === 0) throw new Error('TSB başlığında model yılı sütunu yok');

  const before = rows
    .slice(0, headerIdx)
    .flat()
    .map((c) => String(c ?? '').trim());
  const periodLabel = before.find((c) => /^[^\d\s]+\s+\d{4}$/.test(c) || /^\d{4}\s+[^\d\s]+$/.test(c)) ?? '';
  const parts = periodLabel.split(/\s+/);
  const [monthName = '', yearText = ''] = /^\d/.test(parts[0] ?? '') ? [parts[1], parts[0]] : parts;
  const month = MONTHS.indexOf(monthName.toLocaleLowerCase('tr-TR')) + 1 || (opts.period?.month ?? 0);
  const year = Number(yearText) || (opts.period?.year ?? 0);
  if (!month || !year) throw new Error(`TSB dosyasının dönemi okunamadı ("${periodLabel}")`);

  const out: TsbRow[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const typeName = String(r[iType] ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    const brandName = String(r[iBrand] ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!typeName || !brandName) continue;
    const years = yearCols
      .filter(({ i }) => {
        const v = r[i];
        return typeof v === 'number' ? v > 0 : Number(v) > 0;
      })
      .map((y) => y.year)
      .sort((a, b) => a - b);
    if (years.length === 0) continue;
    out.push({
      brandCode: kodsuz ? kodsuzMarka(brandName) : kod(r[iBrandCode]),
      typeCode: kodsuz ? kodsuzTip(typeName) : kod(r[iTypeCode]),
      brandName,
      typeName,
      years,
    });
  }
  return { periodLabel, year, month, rows: out };
}

/** Kod sıfırsız yazılır: bazı yıllarda ("Nisan 2010", "Ağustos 2013") kodlar "003", "090" diye metin olarak gelir */
const kod = (c: Cell | undefined) => {
  const t = String(c ?? '').trim();
  return /^\d+$/.test(t) ? String(Number(t)) : t;
};

const alnum = (s: string) =>
  s
    .toLocaleUpperCase('tr-TR')
    .replace(/[^A-Z0-9ÇĞİÖŞÜ]/g, '')
    .replace(/[ÇĞİÖŞÜ]/g, (c) => ({ Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' })[c] ?? c);

/** Kodsuz listede marka kimliği: "E" + harf ve rakamlar ("ALFA ROMEO" → "EALFAROMEO"); TSB'nin sayısal kodlarıyla çakışmaz */
export const kodsuzMarka = (brand: string) => `E${alnum(brand)}`;

/** Kodsuz listede tip kimliği: tip adının (harf ve rakam) FNV-1a özeti; aynı yazım her yıl aynı kimliği alır */
export function kodsuzTip(type: string): string {
  let h = 0x811c9dc5;
  for (const ch of alnum(type)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
