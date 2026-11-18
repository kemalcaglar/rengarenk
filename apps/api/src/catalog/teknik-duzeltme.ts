import type { DonanimGrubu, TeknikDuzeltme } from '@rengarenk/shared';
import type { Db } from '../database/prisma.js';

export interface MotorDonanimi {
  /** Pakete özel kayıtsa paketin adı; boşsa bütün paketler */
  paket: string | null;
  gruplar: DonanimGrubu[];
}

/**
 * Konsoldan elle girilen teknik değerler ve donanım (sahip isteği, 17 ve 18 Kasım 2026): motor sürümlerinin (model)
 * etkin kayıtları, yıl aralığı talebin ya da seçilen kasanın yıllarıyla örtüşenler. Yıl bilinmiyorsa yalnızca yılı
 * yazılmamış kayıtlar uygulanır. Pakete özel kayıt yalnızca o paket seçildiyse uygulanır (`paketKeys`). Teknik
 * değerler eskiden yeniye sırayla (sonraki öncekinin üstüne yazar, `duzeltmeUygula`); donanımda aynı paketin en
 * yeni listesi geçerlidir.
 */
export async function elleGirilenler(
  db: Db,
  modelIds: readonly string[],
  aralik: [number, number] | null,
  paketKeys: readonly string[] = [],
): Promise<{ degerler: Map<string, TeknikDuzeltme[]>; donanim: Map<string, MotorDonanimi[]> }> {
  const degerler = new Map<string, TeknikDuzeltme[]>();
  const donanim = new Map<string, MotorDonanimi[]>();
  if (!modelIds.length) return { degerler, donanim };
  const rows = await db.catalogSpecOverride.findMany({
    where: {
      modelId: { in: [...new Set(modelIds)] },
      status: 'aktif',
      OR: [{ trimId: null }, ...(paketKeys.length ? [{ trim: { key: { in: [...paketKeys] } } }] : [])],
      ...(aralik
        ? {
            AND: [
              { OR: [{ yearFrom: null }, { yearFrom: { lte: aralik[1] } }] },
              { OR: [{ yearTo: null }, { yearTo: { gte: aralik[0] } }] },
            ],
          }
        : { yearFrom: null, yearTo: null }),
    },
    select: { modelId: true, values: true, equipment: true, trimId: true, trim: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const sonDonanim = new Map<string, Map<string, MotorDonanimi>>();
  for (const r of rows) {
    const v = r.values as TeknikDuzeltme;
    if (Object.keys(v).length) degerler.set(r.modelId, [...(degerler.get(r.modelId) ?? []), v]);
    const g = r.equipment as DonanimGrubu[] | null;
    if (g?.length) {
      const m = sonDonanim.get(r.modelId) ?? new Map<string, MotorDonanimi>();
      m.set(r.trimId ?? '', { paket: r.trim?.name ?? null, gruplar: g });
      sonDonanim.set(r.modelId, m);
    }
  }
  for (const [modelId, m] of sonDonanim) {
    // Bütün paketlerin listesi önce, sonra paketler adıyla
    donanim.set(
      modelId,
      [...m.values()].sort((a, b) =>
        a.paket === null ? -1 : b.paket === null ? 1 : a.paket.localeCompare(b.paket, 'tr'),
      ),
    );
  }
  return { degerler, donanim };
}

/** Yalnızca teknik değerler (sihirbazdaki seri ayrıntısı; pakete özel kayıtlar uygulanmaz) */
export async function duzeltmeleri(
  db: Db,
  modelIds: readonly string[],
  aralik: [number, number] | null,
  paketKeys: readonly string[] = [],
): Promise<Map<string, TeknikDuzeltme[]>> {
  return (await elleGirilenler(db, modelIds, aralik, paketKeys)).degerler;
}
