import { Inject, Injectable } from '@nestjs/common';
import {
  type CatalogSnapshot,
  type ParsedVariant,
  type PreviousSummary,
  type QualityReport,
  qualityCheck,
  type SignedPackage,
  verifyPackage,
} from '@rengarenk/catalog';
import { type CatalogImportStatus, Prisma, uuidv7 } from '@rengarenk/db';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { CatalogAliasService } from './catalog-alias.service.js';
import { matchGenerationCodes } from './catalog-generations.js';
import { CATALOG_KEYS, type CatalogKeys } from './catalog-keys.js';

/** Türkçe karakterleri sadeleştirip URL'ye uygun anahtar üretir: "3 Serisi" → "3-serisi" */
export function slug(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(
      /[çğıöşüâîû]/g,
      (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' })[c] ?? c,
    )
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, '-ve-')
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Seri anahtarı: "BMW" + "3 Serisi" → "bmw/3-serisi" */
export const seriesKey = (make: string, series: string) => `${slug(make)}/${slug(series)}`;

/** Nesil anahtarı: kaynağı ve başlangıç yılıyla, seri kapsamında */
export const generationKey = (scope: string, source: string, name: string, start: number) =>
  `${scope}/nesil/${source}/${slug(name)}-${start}`;

/**
 * Doğal anahtarlar. `alias`: onaylanmış ad eşlemesi (kaynaktaki seri anahtarı → katalogdaki seri anahtarı);
 * eşlenen seride model, paket ve nesil anahtarları da hedef serinin kapsamına girer.
 */
export function catalogKeys(
  v: Pick<ParsedVariant, 'make' | 'series' | 'model' | 'trim' | 'generation' | 'source'>,
  alias?: Map<string, string>,
) {
  const make = slug(v.make);
  const raw = v.series ? `${make}/${slug(v.series)}` : `${make}/-`;
  const scope = (v.series && alias?.get(raw)) || raw;
  return {
    make: scope.split('/')[0] as string,
    series: v.series ? scope : null,
    model: `${scope}/${slug(v.model)}`,
    trim: v.trim ? `${scope}/paket/${slug(v.trim)}` : null,
    generation:
      v.series && v.generation
        ? generationKey(scope, v.source, v.generation.name, v.generation.startYear)
        : null,
  };
}

export interface ImportMeta {
  fileName?: string;
  /** Kaynak dosyanın SHA-256 özeti: aynı dosya ikinci kez uygulanmaz */
  fileSha256?: string;
  trigger: 'elle' | 'otomatik';
  /**
   * Arşiv dosyası (geçmiş bir ayın listesi): yalnızca eksik model yıllarını ve listeden çoktan düşmüş tipleri
   * ekler; güncel listeden gelen alanları ve "son sürümde" işaretini değiştirmez. TSB'nin güncel dosyası son
   * 15 model yılını taşır; eski aylar daha eski yılları getirir (Karar 33).
   */
  archive?: boolean;
  staffId?: string;
  ip?: string;
}

export interface ImportOutcome {
  id: string;
  status: CatalogImportStatus;
  version: string | null;
  stats: Record<string, unknown>;
  quality: QualityReport | null;
  error?: string;
}

const CHUNK = 1000;

/** Kaynakta olup katalogda karşılığı bulunmayan seri (ad eşleme önerisine gider) */
export interface UnmatchedSeries {
  make: string;
  series: string;
  fromKey: string;
  count: number;
}

/**
 * Katalog yayın alıcısı (Teknik tasarım §5): imzası doğrulanan paketi kalite kontrolünden geçirip kataloğa yazar.
 * Kaynaktan düşen tipler silinmez, "son sürümde yok" diye işaretlenir (Karar 33). Her deneme içe aktarma
 * geçmişine (yalnızca ekleme) ve işlem kaydına girer.
 */
@Injectable()
export class CatalogImportService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(CATALOG_KEYS) private readonly keys: CatalogKeys,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly aliases: CatalogAliasService,
  ) {}

  async previousSummary(source: string): Promise<PreviousSummary | undefined> {
    const last = await this.db.catalogImport.findFirst({
      where: { sourceKey: source, status: 'APPLIED' },
      orderBy: { createdAt: 'desc' },
    });
    if (!last) return undefined;
    const rows = await this.db.$queryRaw<{ source_key: string; make: string }[]>`
      SELECT v.source_key, m.name AS make FROM catalog_variants v JOIN catalog_makes m ON m.id = v.make_id
      WHERE v.source = ${source} AND v.in_latest`;
    const perMake: Record<string, number> = {};
    for (const r of rows) perMake[r.make] = (perMake[r.make] ?? 0) + 1;
    const stats = last.stats as { lowRatio?: number };
    return {
      version: last.version ?? '',
      keys: new Set(rows.map((r) => r.source_key)),
      perMake,
      lowRatio: stats.lowRatio,
    };
  }

  async apply(pkg: SignedPackage, meta: ImportMeta): Promise<ImportOutcome> {
    let snap: CatalogSnapshot;
    try {
      snap = verifyPackage(pkg, this.keys.publicPem);
    } catch (err) {
      return this.record('tsb', null, 'REJECTED', meta, {}, null, (err as Error).message);
    }

    // Aynı dosya aynı ayrıştırıcı sürümüyle ikinci kez uygulanmaz; kurallar değiştiyse yeniden işlenir.
    if (meta.fileSha256) {
      const same = await this.db.catalogImport.findFirst({
        where: {
          sourceKey: snap.source,
          sha256: meta.fileSha256,
          status: 'APPLIED',
          stats: { path: ['parser'], equals: snap.parser },
        },
      });
      if (same)
        return this.record(
          snap.source,
          snap.version,
          'SKIPPED',
          meta,
          { neden: 'ayni_dosya', onceki: same.id },
          null,
        );
    }

    // Arşiv dosyasında yeni modellerin olmaması doğaldır: kaybolan tip denetimi yapılmaz.
    const quality = qualityCheck(snap, meta.archive ? undefined : await this.previousSummary(snap.source));
    const lowRatio = snap.stats.confidence.dusuk / Math.max(snap.items.length, 1);
    const baseStats = {
      ...snap.stats,
      lowRatio,
      periodLabel: snap.periodLabel,
      parser: snap.parser,
      arsiv: Boolean(meta.archive),
    };
    if (!quality.ok) {
      const out = await this.record(snap.source, snap.version, 'REJECTED', meta, baseStats, quality);
      await this.db.$transaction((tx) =>
        this.outbox.add(tx, 'katalog.reddedildi', {
          importId: out.id,
          source: snap.source,
          version: snap.version,
        }),
      );
      return out;
    }

    try {
      const { unmatched, ...counts } = await this.db.$transaction(
        (tx) => this.write(tx, snap, Boolean(meta.archive)),
        { timeout: 180_000, maxWait: 10_000 },
      );
      // Ad eşleme önerileri (onaya düşer; kendiliğinden uygulanmaz). Öneri üretilemezse içe aktarma geçerlidir.
      const aliasSuggested = await this.aliases.suggest(snap.source, unmatched).catch(() => 0);
      const stats = { ...baseStats, ...counts, unmatchedSeries: unmatched.length, aliasSuggested };
      const id = uuidv7();
      await this.db.$transaction(async (tx) => {
        await tx.catalogImport.create({
          data: {
            id,
            sourceKey: snap.source,
            version: snap.version,
            fileName: meta.fileName ?? null,
            sha256: meta.fileSha256 ?? pkg.sha256,
            trigger: meta.trigger,
            status: 'APPLIED',
            stats: stats as Prisma.InputJsonValue,
            quality: quality as unknown as Prisma.InputJsonValue,
            createdBy: meta.staffId ?? null,
          },
        });
        // Arşiv yüklemesi kaynağın güncel sürümünü değiştirmez.
        if (!meta.archive) {
          await tx.catalogSource.update({
            where: { key: snap.source },
            data: {
              lastSuccessAt: new Date(),
              lastCheckedAt: new Date(),
              lastVersion: snap.version,
              ...(meta.fileName ? { lastFileName: meta.fileName } : {}),
              lastError: null,
            },
          });
        }
        await this.audit.record(
          {
            actorType: meta.staffId ? 'STAFF' : 'SYSTEM',
            actorId: meta.staffId ?? null,
            action: meta.archive ? 'katalog_arsiv_ice_aktarildi' : 'katalog_ice_aktarildi',
            entityType: 'catalog_import',
            entityId: id,
            after: {
              kaynak: snap.source,
              surum: snap.version,
              eklenen: counts.added,
              kaybolan: counts.missing,
            },
            ip: meta.ip,
          },
          tx,
        );
        await this.outbox.add(tx, 'katalog.guncellendi', {
          importId: id,
          source: snap.source,
          version: snap.version,
          added: counts.added,
          missing: counts.missing,
        });
      });
      return { id, status: 'APPLIED', version: snap.version, stats, quality };
    } catch (err) {
      return this.record(
        snap.source,
        snap.version,
        'FAILED',
        meta,
        baseStats,
        quality,
        (err as Error).message,
      );
    }
  }

  /** Dosya okunamadıysa (bozuk, biçim değişmiş): deneme FAILED olarak kayda geçer. */
  recordReadFailure(source: string, meta: ImportMeta, message: string) {
    return this.record(source, null, 'FAILED', meta, {}, null, message);
  }

  /** Onaylanmış ad eşlemeleri: kaynaktaki seri anahtarı → katalogdaki seri anahtarı */
  private async aliasMap(tx: Tx, source: string): Promise<Map<string, string>> {
    const rows = await tx.catalogAlias.findMany({
      where: { status: 'onaylandi', source: { in: [source, '*'] } },
      select: { fromKey: true, toKey: true, source: true },
    });
    // Kaynağa özgü eşleme, "*" eşlemesinden sonra yazılır ve onu ezer.
    rows.sort((x, y) => (x.source === '*' ? 0 : 1) - (y.source === '*' ? 0 : 1));
    return new Map(rows.map((r) => [r.fromKey, r.toKey]));
  }

  /** Paketin kataloğa yazılması: marka, seri, model, paket, kasa kuşakları ve tipler; toplu SQL ile. */
  private async write(tx: Tx, snap: CatalogSnapshot, archive = false) {
    const alias = await this.aliasMap(tx, snap.source);
    const items = snap.items.map((v) => ({ v, k: catalogKeys(v, alias) }));
    // Tiplerden bağımsız kasa kuşakları (vehicle-makes-models bütün yıllar, Wikidata nesil kodları)
    const extra = (snap.generations ?? []).map((g) => ({
      g,
      k: catalogKeys(
        {
          make: g.make,
          series: g.series,
          model: '-',
          trim: null,
          source: snap.source,
          generation: { name: g.name, startYear: g.startYear, endYear: g.endYear },
        },
        alias,
      ),
    }));
    // Wikidata yalnızca katalogda var olan seriye kod ekler; seri açmaz.
    const createsSeries = snap.source !== 'wikidata';

    const makes = new Map<string, string>();
    const series = new Map<string, { make: string; name: string; categories: Set<string> }>();
    const models = new Map<string, { make: string; series: string | null; name: string }>();
    const trims = new Map<string, { make: string; series: string | null; name: string }>();
    for (const { v, k } of items) {
      if (!makes.has(k.make)) makes.set(k.make, v.make);
      if (k.series) {
        const s = series.get(k.series) ?? {
          make: k.make,
          name: v.series as string,
          categories: new Set<string>(),
        };
        for (const c of v.categories) s.categories.add(c);
        series.set(k.series, s);
      }
      if (!models.has(k.model)) models.set(k.model, { make: k.make, series: k.series, name: v.model });
      if (k.trim && !trims.has(k.trim))
        trims.set(k.trim, { make: k.make, series: k.series, name: v.trim as string });
    }
    if (createsSeries) {
      for (const { g, k } of extra) {
        if (!makes.has(k.make)) makes.set(k.make, g.make);
        if (k.series && !series.has(k.series))
          series.set(k.series, { make: k.make, name: g.series, categories: new Set() });
      }
    }

    const ids = async (table: string, keys: string[]) => {
      const rows = await tx.$queryRawUnsafe<{ id: string; key: string }[]>(
        `SELECT id, key FROM ${table} WHERE key = ANY($1::text[])`,
        keys,
      );
      return new Map(rows.map((r) => [r.key, r.id]));
    };

    for (const part of chunks([...makes])) {
      await tx.$executeRaw`
        INSERT INTO catalog_makes (id, key, name) VALUES
        ${Prisma.join(part.map(([key, name]) => Prisma.sql`(${uuidv7()}::uuid, ${key}, ${name})`))}
        ON CONFLICT (key) DO NOTHING`;
    }
    const makeIds = await ids('catalog_makes', [...makes.keys()]);

    for (const part of chunks([...series])) {
      await tx.$executeRaw`
        INSERT INTO catalog_series (id, key, make_id, name, categories) VALUES
        ${Prisma.join(
          part.map(
            ([key, s]) =>
              Prisma.sql`(${uuidv7()}::uuid, ${key}, ${makeIds.get(s.make)}::uuid, ${s.name}, ${[...s.categories]}::text[])`,
          ),
        )}
        ON CONFLICT (key) DO UPDATE SET categories =
          ARRAY(SELECT DISTINCT unnest(catalog_series.categories || EXCLUDED.categories) ORDER BY 1)`;
    }
    const seriesIds = await ids('catalog_series', [
      ...new Set([...series.keys(), ...extra.map((e) => e.k.series as string)]),
    ]);

    const upsertNamed = async (
      table: string,
      map: Map<string, { make: string; series: string | null; name: string }>,
    ) => {
      for (const part of chunks([...map])) {
        await tx.$executeRaw`
          INSERT INTO ${Prisma.raw(table)} (id, key, make_id, series_id, name) VALUES
          ${Prisma.join(
            part.map(
              ([key, m]) =>
                Prisma.sql`(${uuidv7()}::uuid, ${key}, ${makeIds.get(m.make)}::uuid, ${m.series ? seriesIds.get(m.series) : null}::uuid, ${m.name})`,
            ),
          )}
          ON CONFLICT (key) DO NOTHING`;
      }
      return ids(table, [...map.keys()]);
    };
    const modelIds = await upsertNamed('catalog_models', models);
    const trimIds = await upsertNamed('catalog_trims', trims);

    // Kasa kuşakları (nesiller): kaynaktan gelir, seri başına. Kod, makyaj sırası ve Commons kategorisi
    // kod eşleştirmesiyle (matchGenerationCodes) dolar.
    type Gen = {
      series: string;
      name: string;
      start: number;
      end: number | null;
      body: string | null;
      code: string | null;
      wikidataId: string | null;
      commons: string | null;
      yearsSource: string | null;
    };
    const generations = new Map<string, Gen>();
    const unmatched = new Map<string, UnmatchedSeries>();
    for (const { g, k } of extra) {
      if (!k.generation || !k.series) continue;
      if (!seriesIds.has(k.series)) {
        const u = unmatched.get(k.series) ?? { make: g.make, series: g.series, fromKey: k.series, count: 0 };
        u.count++;
        unmatched.set(k.series, u);
        continue;
      }
      generations.set(k.generation, {
        series: k.series,
        name: g.name,
        start: g.startYear,
        end: g.endYear,
        body: g.body ?? null,
        code: g.code ?? null,
        wikidataId: g.wikidataId ?? null,
        commons: g.commonsCategory ?? null,
        yearsSource: g.yearsSource ?? null,
      });
    }
    for (const { v, k } of items) {
      if (k.generation && k.series && v.generation && !generations.has(k.generation)) {
        generations.set(k.generation, {
          series: k.series,
          name: v.generation.name,
          start: v.generation.startYear,
          end: v.generation.endYear,
          body: v.body,
          code: null,
          wikidataId: null,
          commons: null,
          yearsSource: null,
        });
      }
    }
    for (const part of chunks([...generations])) {
      await tx.$executeRaw`
        INSERT INTO catalog_generations (id, key, series_id, source, name, start_year, end_year, body, code,
          wikidata_id, commons_category, years_source) VALUES
        ${Prisma.join(
          part.map(
            ([key, g]) =>
              Prisma.sql`(${uuidv7()}::uuid, ${key}, ${seriesIds.get(g.series)}::uuid, ${snap.source}, ${g.name},
                ${g.start}::int, ${g.end}::int, ${g.body}, ${g.code}, ${g.wikidataId}, ${g.commons}, ${g.yearsSource})`,
          ),
        )}
        ON CONFLICT (key) DO UPDATE SET end_year = EXCLUDED.end_year, name = EXCLUDED.name,
          series_id = EXCLUDED.series_id,
          body = COALESCE(EXCLUDED.body, catalog_generations.body),
          code = COALESCE(EXCLUDED.code, catalog_generations.code),
          wikidata_id = COALESCE(EXCLUDED.wikidata_id, catalog_generations.wikidata_id),
          commons_category = COALESCE(EXCLUDED.commons_category, catalog_generations.commons_category),
          years_source = COALESCE(EXCLUDED.years_source, catalog_generations.years_source),
          updated_at = now()`;
    }
    const generationIds = await ids('catalog_generations', [...generations.keys()]);

    // Güncel liste tipin bütün alanlarını yeniler. Arşiv dosyası güncel listede olan tipte yalnızca model
    // yıllarını birleştirir; listeden düşmüş tipte (güncel kaynağı yok) seri, model ve teknik alanları da yeniler,
    // böylece ayrıştırıcı düzeltmeleri eski tiplere de ulaşır.
    const currentUpdate = Prisma.sql`
          make_id = EXCLUDED.make_id, series_id = EXCLUDED.series_id, model_id = EXCLUDED.model_id,
          trim_id = EXCLUDED.trim_id, generation_id = COALESCE(EXCLUDED.generation_id, catalog_variants.generation_id),
          categories = EXCLUDED.categories, body = EXCLUDED.body,
          engine_l = EXCLUDED.engine_l, power_hp = EXCLUDED.power_hp, power_kw = EXCLUDED.power_kw,
          fuel = EXCLUDED.fuel, gearbox = EXCLUDED.gearbox, drive = EXCLUDED.drive, facelift = EXCLUDED.facelift,
          years = ARRAY(SELECT DISTINCT unnest(catalog_variants.years || EXCLUDED.years) ORDER BY 1),
          raw_name = EXCLUDED.raw_name, confidence = EXCLUDED.confidence, in_latest = true,
          last_version = EXCLUDED.last_version, updated_at = now()`;
    const keep = (col: string) =>
      Prisma.raw(
        `${col} = CASE WHEN catalog_variants.in_latest THEN catalog_variants.${col} ELSE EXCLUDED.${col} END`,
      );
    const archiveUpdate = Prisma.sql`
          ${Prisma.join(
            [
              'make_id',
              'series_id',
              'model_id',
              'trim_id',
              'categories',
              'body',
              'engine_l',
              'power_hp',
              'power_kw',
              'fuel',
              'gearbox',
              'drive',
              'facelift',
              'raw_name',
              'confidence',
            ].map(keep),
          )},
          generation_id = COALESCE(catalog_variants.generation_id, EXCLUDED.generation_id),
          years = ARRAY(SELECT DISTINCT unnest(catalog_variants.years || EXCLUDED.years) ORDER BY 1),
          first_version = LEAST(catalog_variants.first_version, EXCLUDED.first_version), updated_at = now()`;

    let added = 0;
    let updated = 0;
    for (const part of chunks(items)) {
      const rows = await tx.$queryRaw<{ inserted: boolean }[]>`
        INSERT INTO catalog_variants (id, source, source_key, make_id, series_id, model_id, trim_id, generation_id, categories, body,
          engine_l, power_hp, power_kw, fuel, gearbox, drive, facelift, years, raw_name, confidence, in_latest,
          first_version, last_version, updated_at)
        VALUES ${Prisma.join(
          part.map(
            ({
              v,
              k,
            }) => Prisma.sql`(${uuidv7()}::uuid, ${v.source}, ${v.sourceKey}, ${makeIds.get(k.make)}::uuid,
              ${k.series ? seriesIds.get(k.series) : null}::uuid, ${modelIds.get(k.model)}::uuid,
              ${k.trim ? trimIds.get(k.trim) : null}::uuid, ${k.generation ? generationIds.get(k.generation) : null}::uuid,
              ${v.categories}::text[], ${v.body}, ${v.engineL}::float8,
              ${v.powerHp}::int, ${v.powerKw}::int, ${v.fuel}, ${v.gearbox}, ${v.drive}, ${v.facelift},
              ${v.years}::int[], ${v.raw}, ${v.confidence}, ${!archive}, ${snap.version}, ${snap.version}, now())`,
          ),
        )}
        ON CONFLICT (source, source_key) DO UPDATE SET ${archive ? archiveUpdate : currentUpdate}
        RETURNING (xmax = 0) AS inserted`;
      for (const r of rows) r.inserted ? added++ : updated++;
    }

    // Bu sürümde görünmeyen tipler silinmez; "son sürümde yok" olarak işaretlenir (Karar 33). Arşivde yapılmaz.
    const missing = archive
      ? 0
      : await tx.$executeRaw`
      UPDATE catalog_variants SET in_latest = false, updated_at = now()
      WHERE source = ${snap.source} AND in_latest AND last_version <> ${snap.version}`;

    return {
      added,
      updated,
      missing,
      makesTotal: makes.size,
      seriesTotal: series.size,
      modelsTotal: models.size,
      trimsTotal: trims.size,
      generationsTotal: generations.size,
      generationsCoded: await matchGenerationCodes(tx),
      unmatched: [...unmatched.values()],
    };
  }

  private async record(
    source: string,
    version: string | null,
    status: CatalogImportStatus,
    meta: ImportMeta,
    stats: Record<string, unknown>,
    quality: QualityReport | null,
    error?: string,
  ): Promise<ImportOutcome> {
    const id = uuidv7();
    await this.db.$transaction(async (tx) => {
      await tx.catalogImport.create({
        data: {
          id,
          sourceKey: source,
          version,
          fileName: meta.fileName ?? null,
          sha256: meta.fileSha256 ?? null,
          trigger: meta.trigger,
          status,
          stats: stats as Prisma.InputJsonValue,
          quality: (quality ?? {}) as unknown as Prisma.InputJsonValue,
          error: error?.slice(0, 1000) ?? null,
          createdBy: meta.staffId ?? null,
        },
      });
      if (status !== 'SKIPPED') {
        await tx.catalogSource.update({
          where: { key: source },
          data: {
            lastCheckedAt: new Date(),
            lastError:
              error ?? (quality && !quality.ok ? quality.blocking.map((b) => b.mesaj).join('; ') : null),
          },
        });
      }
      await this.audit.record(
        {
          actorType: meta.staffId ? 'STAFF' : 'SYSTEM',
          actorId: meta.staffId ?? null,
          action: status === 'SKIPPED' ? 'katalog_ice_aktarma_atlandi' : 'katalog_ice_aktarma_reddedildi',
          entityType: 'catalog_import',
          entityId: id,
          after: { kaynak: source, surum: version, durum: status, hata: error ?? null },
          ip: meta.ip,
        },
        tx,
      );
    });
    return { id, status, version, stats, quality, error };
  }
}

function chunks<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
