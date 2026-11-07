import { assignGenerationCodes, type PhaseCode } from '@rengarenk/catalog';
import { Prisma } from '@rengarenk/db';
import type { Tx } from '../database/prisma.js';

/**
 * Kasa kuşaklarına nesil kodu ve makyaj sırası yazar (Wikidata kodu olan serilerde). Örnek: BMW 3 Serisi
 * Sedan 2002 kuşağı → E46, makyaj 1. Döndürdüğü sayı kodlanan kuşak sayısıdır.
 */
export async function matchGenerationCodes(tx: Tx, seriesIds?: string[]): Promise<number> {
  const rows = await tx.$queryRaw<
    {
      id: string;
      series_id: string;
      source: string;
      code: string | null;
      body: string | null;
      start_year: number;
      end_year: number | null;
      wikidata_id: string | null;
      commons_category: string | null;
    }[]
  >`
    SELECT id, series_id, source, code, body, start_year, end_year, wikidata_id, commons_category
    FROM catalog_generations
    WHERE series_id IN (SELECT series_id FROM catalog_generations WHERE source = 'wikidata')
    ${seriesIds?.length ? Prisma.sql`AND series_id = ANY(${seriesIds}::uuid[])` : Prisma.empty}`;
  const bySeries = new Map<string, typeof rows>();
  for (const r of rows) bySeries.set(r.series_id, [...(bySeries.get(r.series_id) ?? []), r]);
  const updates: PhaseCode[] = [];
  for (const list of bySeries.values()) {
    const codes = list
      .filter((r) => r.source === 'wikidata')
      .map((r) => ({
        id: r.id,
        code: r.code,
        startYear: r.start_year,
        endYear: r.end_year,
        wikidataId: r.wikidata_id,
        commonsCategory: r.commons_category,
      }));
    const phases = list
      .filter((r) => r.source !== 'wikidata')
      .map((r) => ({ id: r.id, body: r.body, startYear: r.start_year, endYear: r.end_year }));
    updates.push(...assignGenerationCodes(phases, codes));
  }
  // Kuşaklarda kod, makyaj sırası ve Commons kategorisi yalnızca bu eşleştirmeden gelir; önce temizlenir ki
  // kuralı değişen ya da kodu düzeltilen seride eski eşleşme kalmasın.
  const touched = [...bySeries.keys()];
  if (touched.length) {
    await tx.$executeRaw`
      UPDATE catalog_generations SET code = NULL, facelift = NULL, wikidata_id = NULL, commons_category = NULL
      WHERE source <> 'wikidata' AND series_id = ANY(${touched}::uuid[])
        AND (code IS NOT NULL OR facelift IS NOT NULL OR wikidata_id IS NOT NULL OR commons_category IS NOT NULL)`;
  }
  for (const part of chunks(updates)) {
    await tx.$executeRaw`
      UPDATE catalog_generations g SET code = u.code, facelift = u.facelift, wikidata_id = u.wikidata_id,
        commons_category = u.commons, updated_at = now()
      FROM (VALUES ${Prisma.join(
        part.map(
          (u) =>
            Prisma.sql`(${u.phaseId}::uuid, ${u.code}, ${u.facelift}::int, ${u.wikidataId}, ${u.commonsCategory})`,
        ),
      )}) AS u(id, code, facelift, wikidata_id, commons)
      WHERE g.id = u.id`;
  }
  return updates.length;
}

function chunks<T>(arr: T[], size = 1000): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
