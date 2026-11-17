import type { TeknikDuzeltme } from '@rengarenk/shared';
import type { Db } from '../database/prisma.js';

/**
 * Teknik özelliğin elle düzeltilmesi (sahip isteği, 17 Kasım 2026): motor sürümlerinin (model) etkin düzeltmeleri,
 * yıl aralığı talebin ya da seçilen kasanın yıllarıyla örtüşenler, eskiden yeniye (sonraki öncekinin üstüne yazar).
 * Yıl bilinmiyorsa yalnızca yılı yazılmamış (bütün yıllar için) düzeltmeler uygulanır. Talep sayfası ve sihirbazdaki
 * seri ayrıntısı bunu `duzeltmeUygula` ile kullanır.
 */
export async function duzeltmeleri(
  db: Db,
  modelIds: readonly string[],
  aralik: [number, number] | null,
): Promise<Map<string, TeknikDuzeltme[]>> {
  const out = new Map<string, TeknikDuzeltme[]>();
  if (!modelIds.length) return out;
  const rows = await db.catalogSpecOverride.findMany({
    where: {
      modelId: { in: [...new Set(modelIds)] },
      status: 'aktif',
      ...(aralik
        ? {
            AND: [
              { OR: [{ yearFrom: null }, { yearFrom: { lte: aralik[1] } }] },
              { OR: [{ yearTo: null }, { yearTo: { gte: aralik[0] } }] },
            ],
          }
        : { yearFrom: null, yearTo: null }),
    },
    select: { modelId: true, values: true },
    orderBy: { createdAt: 'asc' },
  });
  for (const r of rows) {
    const l = out.get(r.modelId) ?? [];
    l.push(r.values as TeknikDuzeltme);
    out.set(r.modelId, l);
  }
  return out;
}
