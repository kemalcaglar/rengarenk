import type { CatalogSnapshot, SnapshotGeneration } from './snapshot.js';
import { vmmSeries } from './vmm.js';

/**
 * Wikidata (CC0): seri (Q59773381 "otomobil model serisi") ve ona bağlı nesiller; nesil kodu etiketten, Commons
 * kategorisi P373'ten. Wikidata'da üretim yılları çoğunlukla yoktur; o zaman yıllar İngilizce Vikipedi maddesinin
 * bilgi kutusundaki "production" alanından okunur ve madde ile sürüm numarası saklanır (Teknik tasarım §5).
 * Kapsam sınırlıdır: yaygın Avrupa modellerinde iyi, diğerlerinde eksik. Kod bulunamayan seride vehicle-makes-models
 * kuşakları kodsuz kalır.
 */
export const WIKIDATA_PARSER = '2026-11-08.2';

export const WIKIDATA_GENERATIONS_QUERY = `
SELECT ?series ?seriesLabel ?gen ?genLabel ?start ?end ?inc ?cc ?en WHERE {
  ?series wdt:P31 wd:Q59773381 .
  { ?series wdt:P527 ?gen } UNION { ?gen wdt:P179 ?series } UNION { ?gen wdt:P361 ?series }
  OPTIONAL { ?gen wdt:P2031 ?start } OPTIONAL { ?gen wdt:P2032 ?end }
  OPTIONAL { ?gen wdt:P571 ?inc }
  OPTIONAL { ?gen wdt:P373 ?cc }
  OPTIONAL { ?en schema:about ?gen ; schema:isPartOf <https://en.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

/** SPARQL sonucundan bir satır (değerler düz metin). */
export interface WikidataGenRow {
  seriesId: string;
  seriesLabel: string;
  genId: string;
  genLabel: string;
  start?: string;
  end?: string;
  inception?: string;
  commons?: string;
  /** İngilizce Vikipedi madde adı */
  enTitle?: string;
}

/** Vikipedi bilgi kutusundan okunan üretim alanı. */
export interface EnwikiProduction {
  revision: number;
  production: string | null;
}

type Binding = Record<string, { type: string; value: string } | undefined>;

/** SPARQL JSON bağlamalarını satıra çevirir. */
export function wikidataRows(bindings: Binding[]): WikidataGenRow[] {
  const id = (v?: { value: string }) => v?.value.split('/').pop() ?? '';
  const out = new Map<string, WikidataGenRow>();
  for (const b of bindings) {
    const genId = id(b.gen);
    const seriesId = id(b.series);
    if (!genId || !seriesId || genId === seriesId) continue;
    const k = `${seriesId}|${genId}`;
    const prev = out.get(k);
    const enTitle = b.en ? decodeURIComponent(id(b.en)).replace(/_/g, ' ') : undefined;
    out.set(k, {
      seriesId,
      seriesLabel: b.seriesLabel?.value ?? seriesId,
      genId,
      genLabel: b.genLabel?.value ?? genId,
      start: prev?.start ?? b.start?.value,
      end: prev?.end ?? b.end?.value,
      inception: prev?.inception ?? b.inception?.value ?? b.inc?.value,
      commons: prev?.commons ?? b.cc?.value,
      enTitle: prev?.enTitle ?? enTitle,
    });
  }
  return [...out.values()];
}

/** Bilgi kutusu metninden "production" alanının değeri (birden çok satıra yayılabilir). */
export function infoboxField(wikitext: string, field = 'production'): string | null {
  const re = new RegExp(`\\|\\s*${field}\\s*=`, 'i');
  const m = re.exec(wikitext);
  if (!m) return null;
  const rest = wikitext.slice(m.index + m[0].length);
  const next = /\n\s*\|\s*[a-z_ 0-9]+\s*=|\n\s*\}\}/i.exec(rest);
  const value = (next ? rest.slice(0, next.index) : rest.slice(0, 400)).trim();
  return value || null;
}

const yearOf = (iso?: string) => {
  const y = iso ? Number(/^\+?(\d{4})/.exec(iso)?.[1]) : Number.NaN;
  return Number.isFinite(y) && y > 1880 ? y : null;
};

/**
 * Üretim alanından ilk aralık: "December 1997 – November 2006" → 1997–2006, "2019–present" → 2019–(açık).
 * Birden çok pazar yazılmışsa ilk satır (ana üretim) alınır.
 */
export function parseProductionYears(text: string): { start: number; end: number | null } | null {
  let t = text
    .replace(/<ref[^>]*\/>/gi, ' ')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;|&mdash;|—|−/g, '–');
  // {{ubl|a|b}}, {{hlist|a|b}}, {{unbulleted list|a|b}}, {{plainlist| * a}}: içerik
  t = t.replace(/\{\{\s*(ubl|hlist|unbulleted list|plainlist|flatlist)\s*\|/gi, '');
  const pieces = t
    .split(/<br\s*\/?>|\n|\||;/i)
    .map((p) => p.replace(/[{}*[\]]/g, ' ').trim())
    .filter((p) => /\b(19|20)\d{2}\b/.test(p));
  const first = pieces[0];
  if (!first) return null;
  const years = [...first.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => Number(m[1]));
  const start = years[0];
  if (start === undefined) return null;
  if (/present|günümüz/i.test(first)) return { start, end: null };
  if (years.length >= 2) return { start, end: Math.max(...years.slice(1)) };
  return /–|-/.test(first) ? { start, end: null } : { start, end: start };
}

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10 };
const roman = (r: string) =>
  [...r].reduce(
    (acc, c, i, arr) =>
      (ROMAN[c] ?? 0) < (ROMAN[arr[i + 1] as string] ?? 0) ? acc - (ROMAN[c] ?? 0) : acc + (ROMAN[c] ?? 0),
    0,
  );

/**
 * Nesil etiketinden kod: "BMW 3 Series (E46)" → E46, "Volkswagen Golf Mk7" → Mk7, "Renault Clio IV" → IV,
 * "Opel Astra K" → K, "Mercedes-Benz W205" → W205, "Mercedes-Benz type 204" → W204. Nesil olmayan alt modeller
 * ("Golf Plus", "A4 allroad", "Focus CC") reddedilir. Sıra adı ("4th generation") kodsuz kabul edilir.
 */
export function generationCode(
  genLabel: string,
  seriesLabel: string,
  make: string,
): { ok: boolean; code: string | null } {
  const strip = (s: string, prefix: string) =>
    s.toLowerCase().startsWith(`${prefix.toLowerCase()} `) ? s.slice(prefix.length).trim() : null;
  const rem = (strip(genLabel, seriesLabel) ?? strip(genLabel, make) ?? '')
    .replace(/^\((.*)\)$/, '$1')
    .trim();
  if (!rem) return { ok: false, code: null };
  if (/^[A-Z]{1,2}\d{1,3}[A-Z]?$/.test(rem)) return { ok: true, code: rem };
  const mk = /^Mk\.? ?([IVX]+|\d+)$/i.exec(rem);
  if (mk) {
    const n = /^\d+$/.test(mk[1] as string) ? Number(mk[1]) : roman((mk[1] as string).toUpperCase());
    return { ok: true, code: `Mk${n}` };
  }
  if (/^[IVX]{1,5}$/.test(rem)) return { ok: true, code: rem };
  if (/^[A-Z]$/.test(rem)) return { ok: true, code: rem };
  const type = /^type (\d{3})$/i.exec(rem);
  if (type) return { ok: true, code: make === 'Mercedes-Benz' ? `W${type[1]}` : (type[1] as string) };
  if (/^\d+(st|nd|rd|th) generation$/i.test(rem)) return { ok: true, code: null };
  if (/^(19|20)\d{2}$/.test(rem)) return { ok: true, code: null };
  return { ok: false, code: null };
}

const nameKey = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Seri etiketinden marka ve seri: "Mercedes-Benz C-Class" → Mercedes-Benz / C Serisi, "Range Rover" → Land Rover */
export function splitSeriesLabel(label: string, makes: string[]): { make: string; series: string } | null {
  const k = nameKey(label);
  if (k === 'range rover' || k.startsWith('range rover ')) return { make: 'Land Rover', series: label };
  const make = [...makes]
    .sort((a, b) => b.length - a.length)
    .find((m) => k.startsWith(`${nameKey(m)} `) && nameKey(m).length > 0);
  if (!make) return null;
  // Etiketin kelimeleri marka anahtarını tamamlayana kadar atılır ("Mercedes-Benz" tek kelime, anahtarı iki).
  const parts = label.split(/\s+/);
  let used = 0;
  while (used < parts.length && nameKey(parts.slice(0, used).join(' ')) !== nameKey(make)) used++;
  const rest = parts.slice(used).join(' ').trim();
  if (!rest) return null;
  return { make, series: vmmSeries(make, rest) };
}

/** Wikidata satırları ve Vikipedi üretim alanlarından anlık görüntü (yalnızca nesil kodları; tip yok). */
export function buildWikidataSnapshot(
  rows: WikidataGenRow[],
  enwiki: Record<string, EnwikiProduction>,
  opts: { makes: string[]; version: string; now?: Date },
): CatalogSnapshot {
  const generations: SnapshotGeneration[] = [];
  let outOfScope = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    const ms = splitSeriesLabel(r.seriesLabel, opts.makes);
    if (!ms) {
      outOfScope++;
      continue;
    }
    const { ok, code } = generationCode(r.genLabel, r.seriesLabel, ms.make);
    if (!ok) {
      outOfScope++;
      continue;
    }
    let start = yearOf(r.start) ?? yearOf(r.inception);
    let end = yearOf(r.end);
    let yearsSource: string | null = start ? `wikidata:${r.genId}` : null;
    const page = r.enTitle ? enwiki[r.enTitle] : undefined;
    if (page?.production) {
      const p = parseProductionYears(page.production);
      if (p && !start) {
        start = p.start;
        end = p.end;
        yearsSource = `enwiki:${r.enTitle}@${page.revision}`;
      } else if (p && start && end === null) {
        end = p.end;
      }
    }
    if (!start) {
      outOfScope++;
      continue;
    }
    const k = `${ms.make}|${ms.series}|${r.genId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    generations.push({
      make: ms.make,
      series: ms.series,
      name: r.genLabel,
      startYear: start,
      endYear: end,
      body: null,
      code,
      wikidataId: r.genId,
      commonsCategory: r.commons ?? null,
      yearsSource,
    });
  }
  return {
    format: 1,
    source: 'wikidata',
    version: opts.version,
    parser: WIKIDATA_PARSER,
    periodLabel: `Wikidata ${opts.version}`,
    generatedAt: (opts.now ?? new Date()).toISOString(),
    items: [],
    generations,
    stats: {
      rows: rows.length,
      items: 0,
      outOfScope,
      confidence: { yuksek: generations.length, orta: 0, dusuk: 0 },
      makes: new Set(generations.map((g) => g.make)).size,
    },
  };
}
