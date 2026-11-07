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

export function catalogKeys(v: Pick<ParsedVariant, 'make' | 'series' | 'model' | 'trim'>) {
  const make = slug(v.make);
  const scope = v.series ? `${make}/${slug(v.series)}` : `${make}/-`;
  return {
    make,
    series: v.series ? scope : null,
    model: `${scope}/${slug(v.model)}`,
    trim: v.trim ? `${scope}/paket/${slug(v.trim)}` : null,
  };
}

export interface ImportMeta {
  fileName?: string;
  /** Kaynak dosyanın SHA-256 özeti: aynı dosya ikinci kez uygulanmaz */
  fileSha256?: string;
  trigger: 'elle' | 'otomatik';
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

    if (meta.fileSha256) {
      const same = await this.db.catalogImport.findFirst({
        where: { sourceKey: snap.source, sha256: meta.fileSha256, status: 'APPLIED' },
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

    const quality = qualityCheck(snap, await this.previousSummary(snap.source));
    const lowRatio = snap.stats.confidence.dusuk / Math.max(snap.items.length, 1);
    const baseStats = { ...snap.stats, lowRatio, periodLabel: snap.periodLabel };
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
      const counts = await this.db.$transaction((tx) => this.write(tx, snap), {
        timeout: 180_000,
        maxWait: 10_000,
      });
      const stats = { ...baseStats, ...counts };
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
        await this.audit.record(
          {
            actorType: meta.staffId ? 'STAFF' : 'SYSTEM',
            actorId: meta.staffId ?? null,
            action: 'katalog_ice_aktarildi',
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

  /** Paketin kataloğa yazılması: marka, seri, model, paket ve tipler; toplu SQL ile. */
  private async write(tx: Tx, snap: CatalogSnapshot) {
    const items = snap.items.map((v) => ({ v, k: catalogKeys(v) }));

    const makes = new Map<string, string>();
    const series = new Map<string, { make: string; name: string; categories: Set<string> }>();
    const models = new Map<string, { make: string; series: string | null; name: string }>();
    const trims = new Map<string, { make: string; series: string | null; name: string }>();
    for (const { v, k } of items) {
      makes.set(k.make, v.make);
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
    const seriesIds = await ids('catalog_series', [...series.keys()]);

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

    let added = 0;
    let updated = 0;
    for (const part of chunks(items)) {
      const rows = await tx.$queryRaw<{ inserted: boolean }[]>`
        INSERT INTO catalog_variants (id, source, source_key, make_id, series_id, model_id, trim_id, categories, body,
          engine_l, power_hp, power_kw, fuel, gearbox, drive, facelift, years, raw_name, confidence, in_latest,
          first_version, last_version, updated_at)
        VALUES ${Prisma.join(
          part.map(
            ({
              v,
              k,
            }) => Prisma.sql`(${uuidv7()}::uuid, ${v.source}, ${v.sourceKey}, ${makeIds.get(k.make)}::uuid,
              ${k.series ? seriesIds.get(k.series) : null}::uuid, ${modelIds.get(k.model)}::uuid,
              ${k.trim ? trimIds.get(k.trim) : null}::uuid, ${v.categories}::text[], ${v.body}, ${v.engineL}::float8,
              ${v.powerHp}::int, ${v.powerKw}::int, ${v.fuel}, ${v.gearbox}, ${v.drive}, ${v.facelift},
              ${v.years}::int[], ${v.raw}, ${v.confidence}, true, ${snap.version}, ${snap.version}, now())`,
          ),
        )}
        ON CONFLICT (source, source_key) DO UPDATE SET
          make_id = EXCLUDED.make_id, series_id = EXCLUDED.series_id, model_id = EXCLUDED.model_id,
          trim_id = EXCLUDED.trim_id, categories = EXCLUDED.categories, body = EXCLUDED.body,
          engine_l = EXCLUDED.engine_l, power_hp = EXCLUDED.power_hp, power_kw = EXCLUDED.power_kw,
          fuel = EXCLUDED.fuel, gearbox = EXCLUDED.gearbox, drive = EXCLUDED.drive, facelift = EXCLUDED.facelift,
          years = ARRAY(SELECT DISTINCT unnest(catalog_variants.years || EXCLUDED.years) ORDER BY 1),
          raw_name = EXCLUDED.raw_name, confidence = EXCLUDED.confidence, in_latest = true,
          last_version = EXCLUDED.last_version, updated_at = now()
        RETURNING (xmax = 0) AS inserted`;
      for (const r of rows) r.inserted ? added++ : updated++;
    }

    // Bu sürümde görünmeyen tipler silinmez; "son sürümde yok" olarak işaretlenir (Karar 33).
    const missing = await tx.$executeRaw`
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
