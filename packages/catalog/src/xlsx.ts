import { strFromU8, unzipSync } from 'fflate';

export type Cell = string | number | null;

/**
 * Küçük bir Excel (.xlsx) okuyucusu: ilk sayfanın hücrelerini satır satır döndürür. Biçim, renk ve
 * formül okunmaz. TSB dosyası satır içi metin (inlineStr) kullanır; Excel'de yeniden kaydedilen
 * dosyalar ortak metin tablosu (sharedStrings) kullanır. İkisi de desteklenir. Ad alanı öneki
 * (`x:`) olsa da olmasa da çalışır.
 */
export function readFirstSheet(file: Uint8Array): Cell[][] {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(file);
  } catch {
    throw new Error('Dosya bir Excel (.xlsx) dosyası değil');
  }
  const sheetPath = firstSheetPath(entries);
  const sheet = entries[sheetPath];
  if (!sheet) throw new Error('Excel dosyasında sayfa bulunamadı');
  const shared = entries['xl/sharedStrings.xml']
    ? sharedStrings(strFromU8(entries['xl/sharedStrings.xml']))
    : [];
  return parseSheet(strFromU8(sheet), shared);
}

function firstSheetPath(entries: Record<string, Uint8Array>): string {
  const wb = entries['xl/workbook.xml'];
  const rels = entries['xl/_rels/workbook.xml.rels'];
  if (wb && rels) {
    const rid = /<(?:\w+:)?sheet\b[^>]*\br:id="([^"]+)"/.exec(strFromU8(wb))?.[1];
    if (rid) {
      const target =
        new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(strFromU8(rels))?.[1] ??
        new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`).exec(strFromU8(rels))?.[1];
      if (target) {
        const p = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
        if (entries[p]) return p;
      }
    }
  }
  const any = Object.keys(entries)
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort();
  return any[0] ?? 'xl/worksheets/sheet1.xml';
}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#')
      return String.fromCodePoint(
        e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)),
      );
    return XML_ENTITIES[e] ?? m;
  });
}

/** Bir <si> ya da <is> içindeki tüm <t> parçalarını birleştirir (zengin metinde birden çok parça olur). */
function textOf(xml: string): string {
  let out = '';
  for (const m of xml.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)) out += m[1];
  return decodeXml(out);
}

function sharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)].map((m) => textOf(m[1] ?? ''));
}

/** "AB12" → 27 (sıfırdan başlayan sütun numarası) */
export function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

function parseSheet(xml: string, shared: string[]): Cell[][] {
  const rows: Cell[][] = [];
  const rowRe = /<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g;
  const cellRe = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
  for (const rm of xml.matchAll(rowRe)) {
    const rowNo = Number(/\br="(\d+)"/.exec(rm[1] ?? '')?.[1] ?? rows.length + 1);
    const row: Cell[] = [];
    let col = 0;
    for (const cm of (rm[2] ?? '').matchAll(cellRe)) {
      const attrs = cm[1] ?? '';
      const body = cm[2] ?? '';
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      if (ref) col = columnIndex(ref);
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const v = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(body)?.[1];
      let value: Cell = null;
      if (type === 'inlineStr') value = textOf(body);
      else if (type === 's') value = v === undefined ? null : (shared[Number(v)] ?? null);
      else if (type === 'str' || type === 'b' || type === 'e') value = v === undefined ? null : decodeXml(v);
      else if (v !== undefined && v !== '') value = Number(v);
      row[col] = value;
      col++;
    }
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = null;
    rows[rowNo - 1] = row;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}
