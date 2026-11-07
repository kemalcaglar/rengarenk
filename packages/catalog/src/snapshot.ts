import { createHash, sign, verify } from 'node:crypto';
import { type CatalogSourceKey, type ParsedVariant, parseTsbRow, TSB_PARSER } from './tsb/parse.js';
import { readTsbList } from './tsb/read.js';

/**
 * Katalog hattının çıktısı (Teknik tasarım §5): indir → normalize et → önceki sürümle karşılaştır → kalite
 * kontrolü → imzalı paket. Paket kişisel veri içermez; kaynak GCP'de üretilip Radore'ye yayınlanabilir.
 */
export interface CatalogSnapshot {
  format: 1;
  source: CatalogSourceKey;
  /** "2026-10" ya da revizyonla "2026-10-R2" */
  version: string;
  /** Ayrıştırıcı sürümü: aynı dosya yeni kurallarla yeniden işlenebilir */
  parser: string;
  periodLabel: string;
  generatedAt: string;
  items: ParsedVariant[];
  /**
   * Tiplerden bağımsız kasa kuşakları: vehicle-makes-models kuşakları (bütün yıllar, kasa başına) ve Wikidata
   * nesil kodları. Tip kaydı olmayan yıllarda da kasa kuşağı ve makyaj sorusunu besler.
   */
  generations?: SnapshotGeneration[];
  stats: SnapshotStats;
}

export interface SnapshotGeneration {
  make: string;
  series: string;
  name: string;
  startYear: number;
  endYear: number | null;
  body?: string | null;
  /** Nesil kodu (E46, W205, Mk7, B8) */
  code?: string | null;
  /** 0 makyajsız, 1 ilk makyaj … */
  facelift?: number | null;
  wikidataId?: string | null;
  commonsCategory?: string | null;
  /** Yılların alındığı yer (madde ve sürüm numarası) */
  yearsSource?: string | null;
}

export interface SnapshotStats {
  rows: number;
  items: number;
  outOfScope: number;
  confidence: Record<'yuksek' | 'orta' | 'dusuk', number>;
  makes: number;
}

/** TSB dosyasından anlık görüntü. `revision`: dosya adındaki revizyon (ör. 202610R2.xlsx → "R2"). */
export function buildTsbSnapshot(
  file: Uint8Array,
  opts: { revision?: string; now?: Date } = {},
): CatalogSnapshot {
  const list = readTsbList(file);
  const items: ParsedVariant[] = [];
  let outOfScope = 0;
  const seen = new Set<string>();
  for (const row of list.rows) {
    const r = parseTsbRow(row);
    if (!r.ok) {
      outOfScope++;
      continue;
    }
    // Aynı kimlik iki kez gelirse ilki geçerlidir.
    if (seen.has(r.variant.sourceKey)) continue;
    seen.add(r.variant.sourceKey);
    items.push(r.variant);
  }
  const confidence = { yuksek: 0, orta: 0, dusuk: 0 };
  for (const i of items) confidence[i.confidence]++;
  const month = String(list.month).padStart(2, '0');
  return {
    format: 1,
    source: 'tsb',
    version: `${list.year}-${month}${opts.revision ? `-${opts.revision.toUpperCase()}` : ''}`,
    parser: TSB_PARSER,
    periodLabel: list.periodLabel,
    generatedAt: (opts.now ?? new Date()).toISOString(),
    items,
    stats: {
      rows: list.rows.length,
      items: items.length,
      outOfScope,
      confidence,
      makes: new Set(items.map((i) => i.make)).size,
    },
  };
}

/** Dosya adından revizyon: "202610R2.xlsx" → "R2" */
export function revisionFromFileName(name: string): string | undefined {
  return /\d{6}(R\d+)\.xlsx$/i.exec(name)?.[1]?.toUpperCase();
}

// ── Kalite kontrolü ───────────────────────────────────────────────

export interface PreviousSummary {
  version: string;
  /** Önceki sürümde var olan kaynak kimlikleri */
  keys: Set<string>;
  /** Marka başına tip sayısı */
  perMake: Record<string, number>;
  /** Düşük güvenle ayrıştırılan tiplerin oranı (0–1) */
  lowRatio?: number;
}

export interface QualityIssue {
  kod: string;
  mesaj: string;
}

// Wikidata yalnızca nesil kodu ekler, hiçbir şey silmez; boş yanıt reddedilir.
const MIN_ITEMS: Record<string, number> = { tsb: 1000, vmm: 1000, yerli: 10, wikidata: 1, vehiclesdb: 1000 };

export interface QualityReport {
  /** false ise yayın durur (Teknik tasarım §5) */
  ok: boolean;
  blocking: QualityIssue[];
  warnings: QualityIssue[];
  added: number;
  missing: number;
}

/** Olağandışı değişimleri yakalar: kaybolan tipler, kaybolan markalar, sert düşüşler, düşük ayrıştırma oranı. */
export function qualityCheck(next: CatalogSnapshot, prev?: PreviousSummary): QualityReport {
  const blocking: QualityIssue[] = [];
  const warnings: QualityIssue[] = [];
  const keys = new Set(next.items.map((i) => i.sourceKey));
  // Kaynağın beklenen en küçük hacmi: TSB ve açık veri binlerce tip, kaynaklı yerli listesi birkaç düzine.
  // Wikidata tip taşımaz, yalnızca nesil kodu; sayılan şey kuşaklardır.
  const minItems = MIN_ITEMS[next.source] ?? 1000;
  const count = next.source === 'wikidata' ? (next.generations?.length ?? 0) : next.items.length;
  if (count < minItems) {
    blocking.push({
      kod: 'az_kayit',
      mesaj: `Dosyada yalnızca ${count} ${next.source === 'wikidata' ? 'nesil' : 'tip'} var; bu kaynak en az ${minItems} içerir`,
    });
  }
  // Eski ve özel modellerin bir kısmı tip adında motor bilgisi taşımaz; oranın kendisi değil, önceki dosyaya göre
  // sıçraması biçim değişikliğinin işaretidir.
  const low = next.stats.confidence.dusuk / Math.max(next.items.length, 1);
  if (prev?.lowRatio !== undefined ? low - prev.lowRatio > 0.05 : low > 0.4) {
    warnings.push({
      kod: 'ayristirma',
      mesaj: `Tiplerin %${Math.round(low * 100)}'i düşük güvenle ayrıştırıldı${prev?.lowRatio !== undefined ? ` (önceki dosyada %${Math.round(prev.lowRatio * 100)})` : ''}; dosya biçimi değişmiş olabilir`,
    });
  }
  let added = next.items.length;
  let missing = 0;
  if (prev) {
    added = [...keys].filter((k) => !prev.keys.has(k)).length;
    missing = [...prev.keys].filter((k) => !keys.has(k)).length;
    const ratio = missing / Math.max(prev.keys.size, 1);
    if (ratio > 0.2) {
      blocking.push({
        kod: 'kaybolan_tip',
        mesaj: `Önceki sürümdeki tiplerin %${Math.round(ratio * 100)}'i (${missing}) yeni dosyada yok`,
      });
    } else if (ratio > 0.05) {
      warnings.push({
        kod: 'kaybolan_tip',
        mesaj: `${missing} tip yeni dosyada yok (%${Math.round(ratio * 100)})`,
      });
    }
    const perMake: Record<string, number> = {};
    // Marka adı kaynaklar arasında aksanla farklı yazılabilir (Citroen / Citroën); karşılaştırma aksansızdır.
    const mk = (m: string) => m.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (const i of next.items) perMake[mk(i.make)] = (perMake[mk(i.make)] ?? 0) + 1;
    for (const [make, n] of Object.entries(prev.perMake)) {
      if (n >= 20 && !perMake[mk(make)])
        warnings.push({ kod: 'kaybolan_marka', mesaj: `${make} markası (${n} tip) yeni dosyada yok` });
    }
  }
  return { ok: blocking.length === 0, blocking, warnings, added, missing };
}

// ── İmzalı paket ──────────────────────────────────────────────────

export interface SignedPackage {
  format: 1;
  /** Anlık görüntünün JSON metni; imza bu metnin üzerindedir */
  payload: string;
  /** Ed25519 imzası, base64 */
  signature: string;
  /** payload'ın SHA-256 özeti, hex */
  sha256: string;
}

export function signSnapshot(snapshot: CatalogSnapshot, privateKeyPem: string): SignedPackage {
  const payload = JSON.stringify(snapshot);
  const data = Buffer.from(payload, 'utf8');
  return {
    format: 1,
    payload,
    signature: sign(null, data, privateKeyPem).toString('base64'),
    sha256: createHash('sha256').update(data).digest('hex'),
  };
}

/** İmzayı doğrular; geçersizse hata fırlatır. Yalnızca imzası doğru paket kataloğa yazılır. */
export function verifyPackage(pkg: SignedPackage, publicKeyPem: string): CatalogSnapshot {
  const data = Buffer.from(pkg.payload, 'utf8');
  if (!verify(null, data, publicKeyPem, Buffer.from(pkg.signature, 'base64'))) {
    throw new Error('Katalog paketinin imzası geçersiz');
  }
  const snap = JSON.parse(pkg.payload) as CatalogSnapshot;
  if (snap.format !== 1 || !Array.isArray(snap.items)) throw new Error('Katalog paketi biçimi tanınmadı');
  return snap;
}
