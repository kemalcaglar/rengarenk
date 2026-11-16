import type { Cell } from './xlsx.js';

/**
 * Küçük bir eski Excel (.xls, BIFF5/BIFF8) okuyucusu: ilk sayfanın hücrelerini satır satır döndürür. 2019 öncesi TSB
 * kasko değer listeleri bu biçimdedir (Karar 33). Biçim, renk ve formül okunmaz; formülün son hesaplanmış sayısal
 * sonucu okunur. Bileşik belge (Compound File Binary) içindeki "Workbook" ya da "Book" akışı okunur.
 */
export function readXlsFirstSheet(file: Uint8Array): Cell[][] {
  const stream = workbookStream(file);
  return parseBiff(stream);
}

/** Dosya eski Excel (bileşik belge) mi: D0 CF 11 E0 A1 B1 1A E1 */
export function isXls(file: Uint8Array): boolean {
  const sig = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return file.length >= 512 && sig.every((b, i) => file[i] === b);
}

const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;

function workbookStream(file: Uint8Array): Uint8Array {
  if (!isXls(file)) throw new Error('Dosya bir Excel (.xls) dosyası değil');
  const dv = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const sectorSize = 1 << dv.getUint16(0x1e, true);
  const miniSize = 1 << dv.getUint16(0x20, true);
  const firstDir = dv.getUint32(0x30, true);
  const miniCutoff = dv.getUint32(0x38, true);
  const firstMiniFat = dv.getUint32(0x3c, true);
  let difatSector = dv.getUint32(0x44, true);
  const sectorOffset = (s: number) => (s + 1) * sectorSize;

  // FAT sektörlerinin listesi: başlıktaki 109 kayıt, sonra DIFAT zinciri
  const fatSectors: number[] = [];
  for (let i = 0; i < 109; i++) {
    const s = dv.getUint32(0x4c + i * 4, true);
    if (s !== FREESECT) fatSectors.push(s);
  }
  const perSector = sectorSize / 4;
  for (let guard = 0; difatSector !== ENDOFCHAIN && difatSector !== FREESECT && guard < 1e5; guard++) {
    const off = sectorOffset(difatSector);
    for (let i = 0; i < perSector - 1; i++) {
      const s = dv.getUint32(off + i * 4, true);
      if (s !== FREESECT) fatSectors.push(s);
    }
    difatSector = dv.getUint32(off + (perSector - 1) * 4, true);
  }
  const fat: number[] = [];
  for (const s of fatSectors) {
    const off = sectorOffset(s);
    for (let i = 0; i < perSector && off + i * 4 + 4 <= file.length; i++)
      fat.push(dv.getUint32(off + i * 4, true));
  }
  const chain = (start: number, table: number[]) => {
    const out: number[] = [];
    for (
      let s = start;
      s !== ENDOFCHAIN && s < table.length && out.length <= table.length;
      s = table[s] ?? ENDOFCHAIN
    )
      out.push(s);
    return out;
  };
  const readChain = (start: number, size: number) => {
    const out = new Uint8Array(size);
    let pos = 0;
    for (const s of chain(start, fat)) {
      if (pos >= size) break;
      const off = sectorOffset(s);
      const n = Math.min(sectorSize, size - pos, file.length - off);
      if (n <= 0) break;
      out.set(file.subarray(off, off + n), pos);
      pos += n;
    }
    return out;
  };

  // Dizin girdileri (128 bayt): ad UTF-16, tür, başlangıç sektörü, boyut
  const dirSectors = chain(firstDir, fat);
  const entries: { name: string; type: number; start: number; size: number }[] = [];
  for (const s of dirSectors) {
    const off = sectorOffset(s);
    for (let e = 0; e < sectorSize / 128; e++) {
      const p = off + e * 128;
      if (p + 128 > file.length) break;
      const nameLen = dv.getUint16(p + 0x40, true);
      let name = '';
      for (let i = 0; i + 2 < nameLen; i += 2) name += String.fromCharCode(dv.getUint16(p + i, true));
      entries.push({
        name,
        type: file[p + 0x42] ?? 0,
        start: dv.getUint32(p + 0x74, true),
        size: dv.getUint32(p + 0x78, true),
      });
    }
  }
  const book = entries.find((e) => e.type === 2 && (e.name === 'Workbook' || e.name === 'Book'));
  if (!book) throw new Error('Excel (.xls) dosyasında çalışma kitabı bulunamadı');
  if (book.size >= miniCutoff) return readChain(book.start, book.size);

  // Küçük akış: kök girdinin taşıdığı mini akıştan
  const root = entries.find((e) => e.type === 5);
  if (!root) throw new Error('Excel (.xls) dosyasında kök dizin yok');
  const ministream = readChain(root.start, root.size);
  const miniFatBytes = readChain(firstMiniFat, chain(firstMiniFat, fat).length * sectorSize);
  const mdv = new DataView(miniFatBytes.buffer);
  const miniFat = Array.from({ length: miniFatBytes.length / 4 }, (_, i) => mdv.getUint32(i * 4, true));
  const out = new Uint8Array(book.size);
  let pos = 0;
  for (const s of chain(book.start, miniFat)) {
    const n = Math.min(miniSize, book.size - pos);
    out.set(ministream.subarray(s * miniSize, s * miniSize + n), pos);
    pos += n;
  }
  return out;
}

interface Rec {
  type: number;
  data: Uint8Array;
  offset: number;
}

function records(stream: Uint8Array): Rec[] {
  const dv = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  const out: Rec[] = [];
  let p = 0;
  while (p + 4 <= stream.length) {
    const type = dv.getUint16(p, true);
    const len = dv.getUint16(p + 2, true);
    out.push({ type, data: stream.subarray(p + 4, p + 4 + len), offset: p });
    p += 4 + len;
  }
  return out;
}

const u16 = (b: Uint8Array, o: number) => (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8);
const u32 = (b: Uint8Array, o: number) => (u16(b, o) | (u16(b, o + 2) << 16)) >>> 0;
const f64 = (b: Uint8Array, o: number) => new DataView(b.buffer, b.byteOffset + o, 8).getFloat64(0, true);

function rk(v: number): number {
  let n: number;
  if (v & 0x02) n = v >> 2;
  else {
    const buf = new DataView(new ArrayBuffer(8));
    buf.setUint32(4, v & 0xfffffffc, true);
    n = buf.getFloat64(0, true);
  }
  return v & 0x01 ? n / 100 : n;
}

/**
 * Sıkıştırılmış (8 bit) karakterler BIFF8'de ilk 256 Unicode karakteridir (ISO-8859-1), BIFF5'te dosyanın kod
 * sayfasıdır (`decoder`).
 */
function decodeChars(b: Uint8Array, high: boolean, decoder?: { decode(b: Uint8Array): string }): string {
  if (!high && decoder) return decoder.decode(b);
  let s = '';
  if (high) for (let i = 0; i + 1 < b.length; i += 2) s += String.fromCharCode(u16(b, i));
  else for (const c of b) s += String.fromCharCode(c);
  return s;
}

/** CONTINUE kayıtlarıyla bölünmüş ortak metin tablosunu (SST) sırayla okuyan okuyucu */
class Parcali {
  private i = 0;
  private p = 0;
  private readonly parts: Uint8Array[];
  constructor(parts: Uint8Array[]) {
    this.parts = parts;
  }
  private get cur() {
    return this.parts[this.i] as Uint8Array;
  }
  get bitti() {
    return this.i >= this.parts.length || (this.i === this.parts.length - 1 && this.p >= this.cur.length);
  }
  private ilerle() {
    while (this.i < this.parts.length && this.p >= this.cur.length) {
      this.i++;
      this.p = 0;
    }
  }
  bytes(n: number): Uint8Array {
    const out = new Uint8Array(n);
    let k = 0;
    while (k < n) {
      this.ilerle();
      if (this.i >= this.parts.length) break;
      const m = Math.min(n - k, this.cur.length - this.p);
      out.set(this.cur.subarray(this.p, this.p + m), k);
      k += m;
      this.p += m;
    }
    return out;
  }
  /** Karakterler kayıt sınırını aşarsa yeni kayıt kendi seçenek baytıyla başlar */
  chars(n: number, high: boolean): string {
    let s = '';
    let left = n;
    let h = high;
    while (left > 0) {
      if (this.p >= this.cur.length) {
        this.ilerle();
        if (this.i >= this.parts.length) break;
        h = ((this.bytes(1)[0] ?? 0) & 0x01) === 1;
      }
      const w = h ? 2 : 1;
      const m = Math.min(left, Math.floor((this.cur.length - this.p) / w));
      if (m <= 0) {
        this.p = this.cur.length;
        continue;
      }
      s += decodeChars(this.cur.subarray(this.p, this.p + m * w), h);
      this.p += m * w;
      left -= m;
    }
    return s;
  }
}

function sst(parts: Uint8Array[]): string[] {
  const first = parts[0];
  if (!first) return [];
  const unique = u32(first, 4);
  const r = new Parcali([first.subarray(8), ...parts.slice(1)]);
  const out: string[] = [];
  for (let k = 0; k < unique && !r.bitti; k++) {
    const head = r.bytes(3);
    const cch = u16(head, 0);
    const flags = head[2] ?? 0;
    const runs = flags & 0x08 ? u16(r.bytes(2), 0) : 0;
    const ext = flags & 0x04 ? u32(r.bytes(4), 0) : 0;
    out.push(r.chars(cch, (flags & 0x01) === 1));
    if (runs) r.bytes(runs * 4);
    if (ext) r.bytes(ext);
  }
  return out;
}

function parseBiff(stream: Uint8Array): Cell[][] {
  const recs = records(stream);
  const bof = recs[0];
  if (!bof || (bof.type & 0xff) !== 0x09) throw new Error('Excel (.xls) dosyası okunamadı (BOF yok)');
  const biff8 = u16(bof.data, 0) === 0x0600;
  let decoder = new TextDecoder('windows-1252');
  const strings: Uint8Array[] = [];
  let sheetOffset = -1;
  let i = 1;
  for (; i < recs.length; i++) {
    const r = recs[i] as Rec;
    if (r.type === 0x000a) break; // genel bölümün sonu
    if (r.type === 0x0042) {
      const cp = u16(r.data, 0);
      try {
        decoder = new TextDecoder(cp === 1200 ? 'utf-16le' : `windows-${cp}`);
      } catch {
        /* bilinmeyen kod sayfası: varsayılan kalır */
      }
    } else if (r.type === 0x0085 && sheetOffset < 0) sheetOffset = u32(r.data, 0);
    else if (r.type === 0x00fc) {
      strings.push(r.data);
      for (let j = i + 1; recs[j]?.type === 0x003c; j++) strings.push((recs[j] as Rec).data);
    }
  }
  const shared = sst(strings);
  const start = sheetOffset >= 0 ? recs.findIndex((r) => r.offset === sheetOffset) : i + 1;
  if (start < 0) throw new Error('Excel (.xls) dosyasında sayfa bulunamadı');

  const rows: Cell[][] = [];
  const put = (row: number, col: number, v: Cell) => {
    const r = rows[row] ?? [];
    r[col] = v;
    rows[row] = r;
  };
  const label = (b: Uint8Array, o: number): string => {
    const cch = u16(b, o);
    if (!biff8) return decoder.decode(b.subarray(o + 2, o + 2 + cch));
    const flags = b[o + 2] ?? 0;
    let p = o + 3;
    if (flags & 0x08) p += 2;
    if (flags & 0x04) p += 4;
    const high = (flags & 0x01) === 1;
    return decodeChars(b.subarray(p, p + cch * (high ? 2 : 1)), high);
  };
  let pendingFormula: { row: number; col: number } | null = null;
  for (let j = start + 1; j < recs.length; j++) {
    const { type, data: d } = recs[j] as Rec;
    if (type === 0x000a) break;
    switch (type) {
      case 0x00fd: // LABELSST
        put(u16(d, 0), u16(d, 2), shared[u32(d, 6)] ?? null);
        break;
      case 0x0204: // LABEL
      case 0x00d6: // RSTRING
        put(u16(d, 0), u16(d, 2), label(d, 6));
        break;
      case 0x0203: // NUMBER
        put(u16(d, 0), u16(d, 2), f64(d, 6));
        break;
      case 0x027e: // RK
        put(u16(d, 0), u16(d, 2), rk(u32(d, 6)));
        break;
      case 0x00bd: {
        // MULRK
        const row = u16(d, 0);
        const first = u16(d, 2);
        const last = u16(d, d.length - 2);
        for (let c = first; c <= last; c++) put(row, c, rk(u32(d, 4 + (c - first) * 6 + 2)));
        break;
      }
      case 0x0006: {
        // FORMULA: sonuç sayıysa yazılır; metin sonucu ardından gelen STRING kaydındadır
        const row = u16(d, 0);
        const col = u16(d, 2);
        if (u16(d, 12) === 0xffff) {
          pendingFormula = d[6] === 0 ? { row, col } : null;
        } else put(row, col, f64(d, 6));
        break;
      }
      case 0x0207: // STRING
        if (pendingFormula) put(pendingFormula.row, pendingFormula.col, label(d, 0));
        pendingFormula = null;
        break;
    }
  }
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) if (row[c] === undefined) row[c] = null;
    rows[r] = row;
  }
  return rows;
}
