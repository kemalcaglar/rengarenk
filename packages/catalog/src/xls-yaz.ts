import type { Cell } from './xlsx.js';

/**
 * Testler için en küçük eski Excel (.xls, BIFF8) yazıcısı: tek sayfa, metin (ortak metin tablosu) ve sayı hücreleri.
 * `kayitBoyu` küçük verilirse ortak metin tablosu CONTINUE kayıtlarına bölünür (okuyucunun bölünmüş metni doğru
 * birleştirdiği sınanır). Üretimde kullanılmaz.
 */
export function xlsYaz(rows: Cell[][], opts: { kayitBoyu?: number } = {}): Uint8Array {
  const max = opts.kayitBoyu ?? 8224;
  const strings: string[] = [];
  const index = new Map<string, number>();
  for (const r of rows)
    for (const c of r)
      if (typeof c === 'string' && !index.has(c)) {
        index.set(c, strings.length);
        strings.push(c);
      }

  const rec = (type: number, data: number[]) => [
    type & 0xff,
    type >> 8,
    data.length & 0xff,
    data.length >> 8,
    ...data,
  ];
  const le16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

  // Ortak metin tablosu: başlık (karakter sayısı + seçenek) bölünmez; karakterler bölünürse yeni kayıt seçenek baytıyla başlar
  const parts: number[][] = [[...le32(strings.length), ...le32(strings.length)]];
  const cur = () => parts[parts.length - 1] as number[];
  for (const s of strings) {
    const high = [...s].some((ch) => ch.charCodeAt(0) > 0xff);
    if (cur().length + 3 > max) parts.push([]);
    cur().push(...le16(s.length), high ? 1 : 0);
    for (let i = 0; i < s.length; i++) {
      const w = high ? 2 : 1;
      if (cur().length + w > max) parts.push([high ? 1 : 0]);
      const code = s.charCodeAt(i);
      cur().push(...(high ? le16(code) : [code]));
    }
  }
  const sst = parts.flatMap((p, i) => rec(i === 0 ? 0x00fc : 0x003c, p));

  const bof = (dt: number) => rec(0x0809, [...le16(0x0600), ...le16(dt), ...new Array(12).fill(0)]);
  const sheetName = [...'Sayfa1'].map((c) => c.charCodeAt(0));
  const boundsheet = (pos: number) => rec(0x0085, [...le32(pos), 0, 0, sheetName.length, 0, ...sheetName]);
  const eof = rec(0x000a, []);
  const globalsLen = bof(5).length + boundsheet(0).length + sst.length + eof.length;
  const globals = [...bof(5), ...boundsheet(globalsLen), ...sst, ...eof];

  const cells: number[] = [];
  for (const [ri, r] of rows.entries()) {
    for (const [ci, c] of r.entries()) {
      if (typeof c === 'string')
        cells.push(...rec(0x00fd, [...le16(ri), ...le16(ci), 0, 0, ...le32(index.get(c) ?? 0)]));
      else if (typeof c === 'number') {
        const b = new Uint8Array(8);
        new DataView(b.buffer).setFloat64(0, c, true);
        cells.push(...rec(0x0203, [...le16(ri), ...le16(ci), 0, 0, ...b]));
      }
    }
  }
  let stream = [...globals, ...bof(0x10), ...cells];
  // Küçük akış (mini akış) yazmamak için en az 4096 bayt: tanınmayan dolgu kaydı
  while (stream.length + 4 + eof.length < 4096)
    stream.push(...rec(0x7777, new Array(Math.min(512, 4096 - stream.length)).fill(0)));
  stream = [...stream, ...eof];

  // Bileşik belge: önce FAT sektörleri, sonra dizin sektörü, sonra çalışma kitabı
  const S = 512;
  const dataSectors = Math.ceil(stream.length / S);
  let fatSectors = 1;
  while (fatSectors * (S / 4) < fatSectors + 1 + dataSectors) fatSectors++;
  const dirSector = fatSectors;
  const firstData = fatSectors + 1;
  const out = new Uint8Array(S * (1 + firstData + dataSectors));
  const dv = new DataView(out.buffer);
  [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].forEach((b, i) => {
    out[i] = b;
  });
  dv.setUint16(0x18, 0x3e, true);
  dv.setUint16(0x1a, 3, true);
  dv.setUint16(0x1c, 0xfffe, true);
  dv.setUint16(0x1e, 9, true);
  dv.setUint16(0x20, 6, true);
  dv.setUint32(0x2c, fatSectors, true);
  dv.setUint32(0x30, dirSector, true);
  dv.setUint32(0x38, 4096, true);
  dv.setUint32(0x3c, 0xfffffffe, true);
  dv.setUint32(0x44, 0xfffffffe, true);
  for (let i = 0; i < 109; i++) dv.setUint32(0x4c + i * 4, i < fatSectors ? i : 0xffffffff, true);
  const fat = (n: number, v: number) => dv.setUint32(S + n * 4, v, true);
  for (let i = 0; i < fatSectors * (S / 4); i++) fat(i, 0xffffffff);
  for (let i = 0; i < fatSectors; i++) fat(i, 0xfffffffd);
  fat(dirSector, 0xfffffffe);
  for (let i = 0; i < dataSectors; i++)
    fat(firstData + i, i === dataSectors - 1 ? 0xfffffffe : firstData + i + 1);
  const dir = (dirSector + 1) * S;
  const entry = (n: number, name: string, type: number, start: number, size: number) => {
    const p = dir + n * 128;
    [...name].forEach((ch, i) => {
      dv.setUint16(p + i * 2, ch.charCodeAt(0), true);
    });
    dv.setUint16(p + 0x40, (name.length + 1) * 2, true);
    out[p + 0x42] = type;
    dv.setUint32(p + 0x44, 0xffffffff, true);
    dv.setUint32(p + 0x48, 0xffffffff, true);
    dv.setUint32(p + 0x4c, n === 0 ? 1 : 0xffffffff, true);
    dv.setUint32(p + 0x74, start, true);
    dv.setUint32(p + 0x78, size, true);
  };
  entry(0, 'Root Entry', 5, 0xfffffffe, 0);
  entry(1, 'Workbook', 2, firstData, stream.length);
  out.set(stream, (firstData + 1) * S);
  return out;
}
