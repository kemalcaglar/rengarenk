import { generateKeyPairSync } from 'node:crypto';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  buildTsbSnapshot,
  qualityCheck,
  revisionFromFileName,
  signSnapshot,
  verifyPackage,
} from './snapshot.js';
import { readTsbList } from './tsb/read.js';
import { readFirstSheet } from './xlsx.js';

const YEARS = [2026, 2025, 2024];

/** TSB biçiminde (x: ön ekli, satır içi metin) küçük bir xlsx */
function tsbXlsx(types: [string, string, string, string, number[]][], period = 'Ekim 2026') {
  const cell = (ref: string, v: string | number) =>
    typeof v === 'number'
      ? `<x:c r="${ref}"><x:v>${v}</x:v></x:c>`
      : `<x:c r="${ref}" t="inlineStr"><x:is><x:t>${v.replace(/&/g, '&amp;')}</x:t></x:is></x:c>`;
  const cols = 'ABCDEFG';
  const rows = [
    `<x:row r="1">${cell('A1', period)}<x:c r="B1" /></x:row>`,
    `<x:row r="2">${['Marka Kodu', 'Tip Kodu', 'Marka Adı', 'Tip Adı', ...YEARS.map(String)].map((h, i) => cell(`${cols[i]}2`, h)).join('')}</x:row>`,
    ...types.map(
      (t, r) =>
        `<x:row r="${r + 3}">${[t[0], t[1], t[2], t[3], ...t[4]].map((v, i) => cell(`${cols[i]}${r + 3}`, v)).join('')}</x:row>`,
    ),
  ];
  const sheet = `<?xml version="1.0"?><x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData>${rows.join('')}</x:sheetData></x:worksheet>`;
  return zipSync({ 'xl/worksheets/sheet1.xml': strToU8(sheet) });
}

describe('xlsx okuyucu', () => {
  it('ortak metin tablosu ve boşluklu sütunlar okunur (Excel’de yeniden kaydedilmiş dosya)', () => {
    const sheet = `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>42</v></c></row><row r="3"><c r="B3" t="s"><v>1</v></c></row></sheetData></worksheet>`;
    const shared = `<sst><si><t>Marka &amp; Tip</t></si><si><r><t>Zengin </t></r><r><t>metin</t></r></si></sst>`;
    const file = zipSync({
      'xl/worksheets/sheet1.xml': strToU8(sheet),
      'xl/sharedStrings.xml': strToU8(shared),
    });
    expect(readFirstSheet(file)).toEqual([['Marka & Tip', null, 42], [], [null, 'Zengin metin']]);
  });

  it('xlsx olmayan dosyayı açık bir hatayla reddeder', () => {
    expect(() => readFirstSheet(strToU8('merhaba'))).toThrow('Excel');
  });
});

describe('TSB dosyası', () => {
  it('dönem okunur, kasko bedeli saklanmaz, yalnızca var olduğu yıllar kalır', () => {
    const list = readTsbList(
      tsbXlsx([['21', '1834', 'BMW', '320i SEDAN 1.6 170 M SPORT', [2510000, 2300000, 0]]]),
    );
    expect(list).toMatchObject({ periodLabel: 'Ekim 2026', year: 2026, month: 10 });
    expect(list.rows).toEqual([
      {
        brandCode: '21',
        brandName: 'BMW',
        typeCode: '1834',
        typeName: '320i SEDAN 1.6 170 M SPORT',
        years: [2025, 2026],
      },
    ]);
    expect(JSON.stringify(list)).not.toContain('2510000');
  });

  it('başlık yoksa açık hata verir', () => {
    const file = zipSync({
      'xl/worksheets/sheet1.xml': strToU8(
        '<worksheet><sheetData><row r="1"><c t="inlineStr"><is><t>x</t></is></c></row></sheetData></worksheet>',
      ),
    });
    expect(() => readTsbList(file)).toThrow('başlık');
  });

  it('sürüm dönem ve revizyondan; dosya adından revizyon', () => {
    const snap = buildTsbSnapshot(
      tsbXlsx([
        ['21', '1', 'BMW', '320i SEDAN 1.6 170', [1, 1, 1]],
        ['9', '9', 'ZIRAI TRAKTOR', 'X', [1, 0, 0]],
      ]),
      {
        revision: 'r2',
      },
    );
    expect(snap.version).toBe('2026-10-R2');
    expect(snap.stats).toMatchObject({ rows: 2, items: 1, outOfScope: 1, makes: 1 });
    expect(revisionFromFileName('202610R2.xlsx')).toBe('R2');
    expect(revisionFromFileName('202610.xlsx')).toBeUndefined();
  });
});

describe('kalite kontrolü ve imza', () => {
  const many = (n: number, prefix = 't') =>
    tsbXlsx(
      Array.from(
        { length: n },
        (_, i) =>
          ['21', `${prefix}${i}`, 'BMW', `320i SEDAN 1.6 170 PAKET${i}`, [1, 1, 1]] as [
            string,
            string,
            string,
            string,
            number[],
          ],
      ),
    );

  it('az kayıtlı dosya ve kaybolan tipler yayını durdurur; küçük kayıp uyarıdır', () => {
    const small = buildTsbSnapshot(many(10));
    expect(qualityCheck(small).ok).toBe(false);

    const next = buildTsbSnapshot(many(1200));
    const prevKeys = new Set(next.items.map((i) => i.sourceKey));
    for (let i = 0; i < 100; i++) prevKeys.add(`21-gone${i}`);
    const r = qualityCheck(next, { version: '2026-09', keys: prevKeys, perMake: { BMW: 1300, Saab: 40 } });
    expect(r.ok).toBe(true);
    expect(r.missing).toBe(100);
    expect(r.warnings.map((w) => w.kod)).toEqual(expect.arrayContaining(['kaybolan_tip', 'kaybolan_marka']));

    for (let i = 0; i < 400; i++) prevKeys.add(`21-x${i}`);
    expect(qualityCheck(next, { version: '2026-09', keys: prevKeys, perMake: {} }).ok).toBe(false);
  });

  it('imzalı paket doğrulanır; değiştirilmiş paket ya da başka anahtar reddedilir', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const priv = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const pub = publicKey.export({ type: 'spki', format: 'pem' }) as string;
    const snap = buildTsbSnapshot(many(3));
    const pkg = signSnapshot(snap, priv);
    expect(verifyPackage(pkg, pub).items).toHaveLength(3);

    const tampered = {
      ...pkg,
      payload: pkg.payload.replace('M SPORT', 'X SPORT').replace('PAKET0', 'PAKET9'),
    };
    expect(() => verifyPackage(tampered, pub)).toThrow('imza');
    const other = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }) as string;
    expect(() => verifyPackage(pkg, other)).toThrow('imza');
  });
});
