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

/**
 * TSB dosyasını okur. Biçim (Ekim 2026): 1. satır dönem ("Ekim 2026"), 2. satır başlık (Marka Kodu, Tip Kodu,
 * Marka Adı, Tip Adı, 2026 … 2012), sonra her tip bir satır; yıl sütunlarındaki sıfırdan büyük değer o model
 * yılında tipin var olduğunu gösterir. Değerin kendisi (kasko bedeli) hiçbir yerde saklanmaz (Karar 33).
 * Başlık satırı aranarak bulunur; sütun sırası değişse de okunur.
 */
export function readTsbList(file: Uint8Array): TsbList {
  const rows = readFirstSheet(file);
  const headerIdx = rows.findIndex(
    (r) => r.some((c) => norm(c) === 'marka kodu') && r.some((c) => norm(c) === 'tip adı'),
  );
  if (headerIdx < 0) throw new Error('TSB başlık satırı bulunamadı (Marka Kodu, Tip Adı)');
  const header = rows[headerIdx] as Cell[];
  const col = (name: string) => header.findIndex((c) => norm(c) === name);
  const iBrandCode = col('marka kodu');
  const iTypeCode = col('tip kodu');
  const iBrand = col('marka adı');
  const iType = col('tip adı');
  if ([iBrandCode, iTypeCode, iBrand, iType].some((i) => i < 0))
    throw new Error('TSB başlığında beklenen sütunlar eksik');
  const yearCols = header
    .map((c, i) => ({ year: Number(String(c ?? '').trim()), i }))
    .filter((y) => Number.isInteger(y.year) && y.year >= 1950 && y.year <= 2100);
  if (yearCols.length === 0) throw new Error('TSB başlığında model yılı sütunu yok');

  const periodLabel =
    rows
      .slice(0, headerIdx)
      .flat()
      .map((c) => String(c ?? '').trim())
      .find((c) => /^[^\d\s]+\s+\d{4}$/.test(c)) ?? '';
  const [monthName = '', yearText = ''] = periodLabel.split(/\s+/);
  const month = MONTHS.indexOf(monthName.toLocaleLowerCase('tr-TR')) + 1;
  const year = Number(yearText);
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
      brandCode: String(r[iBrandCode] ?? '').trim(),
      typeCode: String(r[iTypeCode] ?? '').trim(),
      brandName,
      typeName,
      years,
    });
  }
  return { periodLabel, year, month, rows: out };
}
