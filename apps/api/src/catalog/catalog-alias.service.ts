import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, uuidv7 } from '@rengarenk/db';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { matchGenerationCodes } from './catalog-generations.js';
import type { UnmatchedSeries } from './catalog-import.service.js';

/** "c-max" ve "cmax", "t.connect" ve "tconnect" aynı yazılır */
const compact = (key: string) => key.replace(/[^a-z0-9]/g, '');

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) (d[0] as number[])[j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const row = d[i] as number[];
      const prev = d[i - 1] as number[];
      row[j] = Math.min(
        (prev[j] as number) + 1,
        (row[j - 1] as number) + 1,
        (prev[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  return (d[a.length] as number[])[b.length] as number;
}

interface Target {
  key: string;
  name: string;
  count: number;
}

/**
 * Bir seri için hedef önerir. Kurallar sırayla: aynı yazım (noktalama farkı), ek ("Focus CC" → Focus), bitişik
 * yazım ("Tiguanallspace" → Tiguan), tek harf yazım farkı ("Touraeg" → Touareg). Hedef, kaynaktan daha çok tipi
 * olan seridir; birden çok aday varsa en çok tipi olan seçilir.
 */
export function proposeTarget(
  from: { key: string; name: string; count: number },
  targets: Target[],
  opts: { typos?: boolean; ratio?: number } = {},
): { target: Target; reason: string } | null {
  const fromSlug = from.key.split('/')[1] ?? '';
  const fromCompact = compact(fromSlug);
  const fromWords = from.name.toLocaleLowerCase('tr-TR');
  const noDigitChange = (a: string, b: string) => a.replace(/\D/g, '') === b.replace(/\D/g, '');
  const rules: [string, (t: Target) => boolean][] = [
    ['yazım farkı', (t) => compact(t.key.split('/')[1] ?? '') === fromCompact],
    // "E-Daily", "Corsa-E": aynı modelin elektrikli sürümü; ayrı tutmak da birleştirmek de katalog kararıdır.
    [
      'elektrikli sürüm',
      (t) => {
        const c = compact(t.key.split('/')[1] ?? '');
        return c.length >= 3 && (fromCompact === `e${c}` || fromCompact === `${c}e`);
      },
    ],
    [
      'ek',
      (t) => {
        const name = t.name.toLocaleLowerCase('tr-TR');
        return name.length >= 2 && fromWords.startsWith(`${name} `);
      },
    ],
    [
      'bitişik yazım',
      (t) => {
        const c = compact(t.key.split('/')[1] ?? '');
        return c.length >= 4 && fromCompact.length > c.length && fromCompact.startsWith(c);
      },
    ],
    [
      // Yalnızca az tipli yazımda ve çok tipli hedefe: "Touraeg" (1) → Touareg. Rakam farkı (Model 3 / Model S,
      // FM62 / FM64) ve Mercedes sınıfları (CLE / CLA, SLC / SL) ayrı modeldir.
      'yazım hatası',
      (t) => {
        const c = compact(t.key.split('/')[1] ?? '');
        return (
          opts.typos === true &&
          from.count <= 9 &&
          t.count >= 10 &&
          c.length >= 5 &&
          !/serisi$/.test(c) &&
          noDigitChange(c, fromCompact) &&
          !/\d/.test(c) &&
          Math.abs(c.length - fromCompact.length) <= 1 &&
          editDistance(c, fromCompact) === 1
        );
      },
    ],
  ];
  // Hedef en az üç tipli olmalı: kaynaktaki bir bitişik yazım ("911CARRERA") hedef olmasın.
  const pool = targets.filter(
    (t) => t.key !== from.key && t.count > from.count * (opts.ratio ?? 1) && t.count >= 3,
  );
  for (const [reason, test] of rules) {
    const hits = pool.filter(test).sort((a, b) => b.count - a.count);
    if (hits[0]) return { target: hits[0], reason };
  }
  return null;
}

/**
 * Ad eşleme (Teknik tasarım §5, Karar 33): aynı serinin farklı kaynaklardaki ya da TSB'deki farklı yazımları tek
 * seride birleşir. Sistem kurala göre önerir; katalog sorumlusu onaylar ya da reddeder. Onaylanan eşleme sonraki
 * içe aktarmalarda uygulanır ve var olan tipler hedef seriye taşınır. Hiçbir kayıt silinmez.
 */
@Injectable()
export class CatalogAliasService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * İçe aktarmadan sonra öneri üretir. `unmatched`: katalogda serisi olmayan kayıtlar (Wikidata); diğer
   * kaynaklarda bu kaynaktan gelip başka kaynakta karşılığı olmayan seriler adaydır.
   */
  async suggest(source: string, unmatched: UnmatchedSeries[] = []): Promise<number> {
    const counts = await this.db.$queryRaw<
      { key: string; name: string; make_id: string; source: string; n: number }[]
    >`
      SELECT s.key, s.name, s.make_id, v.source, count(*)::int AS n
      FROM catalog_series s JOIN catalog_variants v ON v.series_id = s.id
      GROUP BY s.key, s.name, s.make_id, v.source`;
    const byMake = new Map<string, Map<string, Target & { sources: Map<string, number> }>>();
    for (const r of counts) {
      const make = r.key.split('/')[0] as string;
      const m = byMake.get(make) ?? new Map();
      const t = m.get(r.key) ?? { key: r.key, name: r.name, count: 0, sources: new Map<string, number>() };
      t.count += r.n;
      t.sources.set(r.source, r.n);
      m.set(r.key, t);
      byMake.set(make, m);
    }
    const existing = new Set(
      (await this.db.catalogAlias.findMany({ select: { source: true, fromKey: true } })).map(
        (a) => `${a.source}|${a.fromKey}`,
      ),
    );

    const candidates: { key: string; name: string; count: number }[] = [];
    if (source === 'wikidata') {
      for (const u of unmatched) candidates.push({ key: u.fromKey, name: u.series, count: 0 });
    } else {
      for (const m of byMake.values())
        for (const t of m.values()) {
          const own = t.sources.get(source) ?? 0;
          if (!own) continue;
          // vehicle-makes-models ve yerli: TSB'de karşılığı olmayan seri. TSB: az tipli, benzer adlı seri.
          if (source !== 'tsb' && t.sources.has('tsb')) continue;
          if (source === 'tsb' && own > 5) continue;
          candidates.push({ key: t.key, name: t.name, count: source === 'tsb' ? t.count : 0 });
        }
    }

    let added = 0;
    for (const c of candidates) {
      if (existing.has(`${source}|${c.key}`)) continue;
      const make = c.key.split('/')[0] as string;
      const targets = [...(byMake.get(make)?.values() ?? [])].filter(
        (t) => t.key !== c.key && (source === 'tsb' || t.sources.has('tsb')),
      );
      const hit = proposeTarget(c, targets, { typos: source === 'tsb', ratio: source === 'tsb' ? 3 : 1 });
      if (!hit) continue;
      const res = await this.db.catalogAlias.createMany({
        data: [
          {
            id: uuidv7(),
            source,
            fromKey: c.key,
            fromName: c.name,
            toKey: hit.target.key,
            status: 'onerildi',
            method: 'kural',
            reason: hit.reason,
            variants: byMake.get(make)?.get(c.key)?.sources.get(source) ?? 0,
          },
        ],
        skipDuplicates: true,
      });
      added += res.count;
    }
    return added;
  }

  list(status?: string) {
    return this.db.catalogAlias.findMany({
      where: status ? { status } : {},
      orderBy: [{ status: 'asc' }, { variants: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  /** Öneriyi onaylar (hedef değiştirilebilir) ve var olan tipleri hedef seriye taşır. */
  async approve(id: string, staffId: string, ip?: string, toKey?: string) {
    const alias = await this.db.catalogAlias.findUnique({ where: { id } });
    if (!alias) throw new NotFoundException('Eşleme bulunamadı');
    if (alias.status === 'onaylandi') throw new ConflictException('Eşleme zaten onaylı');
    const target = toKey ?? alias.toKey;
    return this.db.$transaction(
      async (tx) => {
        const moved = await this.relink(tx, alias.source, alias.fromKey, target);
        const updated = await tx.catalogAlias.update({
          where: { id },
          data: { status: 'onaylandi', toKey: target, decidedBy: staffId, decidedAt: new Date() },
        });
        await this.audit.record(
          {
            actorType: 'STAFF',
            actorId: staffId,
            action: 'katalog_ad_esleme_onaylandi',
            entityType: 'catalog_alias',
            entityId: id,
            before: { durum: alias.status, hedef: alias.toKey },
            after: { durum: 'onaylandi', kaynak: alias.fromKey, hedef: target, tasinan: moved },
            ip,
          },
          tx,
        );
        await this.outbox.add(tx, 'katalog.ad_esleme', { aliasId: id, from: alias.fromKey, to: target });
        return { ...updated, tasinan: moved };
      },
      { timeout: 60_000 },
    );
  }

  async reject(id: string, staffId: string, ip?: string) {
    const alias = await this.db.catalogAlias.findUnique({ where: { id } });
    if (!alias) throw new NotFoundException('Eşleme bulunamadı');
    if (alias.status !== 'onerildi') throw new ConflictException('Yalnızca bekleyen öneri reddedilir');
    return this.db.$transaction(async (tx) => {
      const updated = await tx.catalogAlias.update({
        where: { id },
        data: { status: 'reddedildi', decidedBy: staffId, decidedAt: new Date() },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'katalog_ad_esleme_reddedildi',
          entityType: 'catalog_alias',
          entityId: id,
          after: { kaynak: alias.fromKey, hedef: alias.toKey },
          ip,
        },
        tx,
      );
      return updated;
    });
  }

  /** Çalışanın elle eklediği eşleme: karar da odur, hemen uygulanır. */
  async create(input: { fromSeriesId: string; toSeriesId: string }, staffId: string, ip?: string) {
    const [from, to] = await Promise.all([
      this.db.catalogSeries.findUnique({ where: { id: input.fromSeriesId } }),
      this.db.catalogSeries.findUnique({ where: { id: input.toSeriesId } }),
    ]);
    if (!from || !to) throw new NotFoundException('Seri bulunamadı');
    if (from.id === to.id) throw new BadRequestException('Seri kendisine eşlenemez');
    const exists = await this.db.catalogAlias.findUnique({
      where: { source_fromKey: { source: '*', fromKey: from.key } },
    });
    if (exists?.status === 'onaylandi') throw new ConflictException('Bu seri için onaylı eşleme var');
    const id = exists?.id ?? uuidv7();
    if (!exists) {
      await this.db.catalogAlias.create({
        data: {
          id,
          source: '*',
          fromKey: from.key,
          fromName: from.name,
          toKey: to.key,
          method: 'elle',
          reason: 'elle',
          createdBy: staffId,
        },
      });
    }
    return this.approve(id, staffId, ip, to.key);
  }

  /**
   * Kaynak serideki tipleri hedef seriye taşır: model, paket ve kasa kuşağı hedef serinin kapsamında açılır
   * (yoksa), tipler onlara bağlanır. Eski seri ve satırlar silinmez; tipi kalmayınca katalogda görünmez.
   */
  async relink(tx: Tx, source: string, fromKey: string, toKey: string): Promise<number> {
    const [from, to] = await Promise.all([
      tx.catalogSeries.findUnique({ where: { key: fromKey } }),
      tx.catalogSeries.findUnique({ where: { key: toKey } }),
    ]);
    if (!to) throw new BadRequestException('Hedef seri katalogda yok');
    if (!from) return 0; // Wikidata: katalogda seri yok, eşleme sonraki içe aktarmada uygulanır
    const sourceFilter = source === '*' ? Prisma.empty : Prisma.sql`AND source = ${source}`;
    const scoped = (key: string) => `${toKey}${key.slice(fromKey.length)}`;

    for (const table of ['catalog_models', 'catalog_trims'] as const) {
      const col = table === 'catalog_models' ? 'model_id' : 'trim_id';
      const rows = await tx.$queryRawUnsafe<{ id: string; key: string; name: string }[]>(
        `SELECT DISTINCT t.id, t.key, t.name FROM ${table} t JOIN catalog_variants v ON v.${col} = t.id
         WHERE v.series_id = $1::uuid ${source === '*' ? '' : 'AND v.source = $2'}`,
        ...(source === '*' ? [from.id] : [from.id, source]),
      );
      for (const r of rows) {
        const key = scoped(r.key);
        await tx.$executeRawUnsafe(
          `INSERT INTO ${table} (id, key, make_id, series_id, name) VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5)
           ON CONFLICT (key) DO NOTHING`,
          uuidv7(),
          key,
          to.makeId,
          to.id,
          r.name,
        );
        await tx.$executeRawUnsafe(
          `UPDATE catalog_variants SET ${col} = (SELECT id FROM ${table} WHERE key = $1), updated_at = now()
           WHERE ${col} = $2::uuid AND series_id = $3::uuid ${source === '*' ? '' : 'AND source = $4'}`,
          ...(source === '*' ? [key, r.id, from.id] : [key, r.id, from.id, source]),
        );
      }
    }
    // Kasa kuşakları da hedef seriye ve onun anahtar kapsamına geçer; sonraki içe aktarma aynı satırı bulur.
    const tail = fromKey.length + 1;
    await tx.$executeRaw`
      UPDATE catalog_generations g SET series_id = ${to.id}::uuid, key = ${toKey} || substr(g.key, ${tail}::int),
        updated_at = now()
      WHERE g.series_id = ${from.id}::uuid ${sourceFilter}
        AND NOT EXISTS (SELECT 1 FROM catalog_generations x WHERE x.key = ${toKey} || substr(g.key, ${tail}::int))`;
    const moved = await tx.$executeRaw`
      UPDATE catalog_variants SET series_id = ${to.id}::uuid, make_id = ${to.makeId}::uuid, updated_at = now()
      WHERE series_id = ${from.id}::uuid ${sourceFilter}`;
    await matchGenerationCodes(tx, [to.id]);
    return moved;
  }
}
