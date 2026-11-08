import { BADGES, type BadgeKey } from '@rengarenk/shared';
import type { Db } from '../database/prisma.js';

export interface Rozet {
  key: BadgeKey;
  ad: string;
  bg: string;
  renk: string;
  aciklama: string;
}

/**
 * Hesapların alıcıya görünen rozetleri (Karar 55). Hesaplanmış göstergesi olmayan onaylı galeri yine "Onaylı galeri"
 * rozetini taşır; diğer rozetler işçinin hesapladığı göstergelerden gelir.
 */
export async function rozetler(db: Db, accountIds: string[]): Promise<Map<string, Rozet[]>> {
  const ids = [...new Set(accountIds)];
  if (!ids.length) return new Map();
  const [stats, galeriler] = await Promise.all([
    db.sellerStats.findMany({ where: { accountId: { in: ids } }, select: { accountId: true, badges: true } }),
    db.gallery.findMany({
      where: { accountId: { in: ids }, account: { status: 'ACTIVE' } },
      select: { accountId: true },
    }),
  ]);
  const onayli = new Set(galeriler.map((g) => g.accountId));
  const sb = new Map(stats.map((s) => [s.accountId, s.badges as BadgeKey[]]));
  return new Map(
    ids.map((id) => {
      const keys = new Set<BadgeKey>(sb.get(id) ?? []);
      if (onayli.has(id)) keys.add('onay');
      else keys.delete('onay');
      const sirali = (['onay', 'hizli', 'guven'] as const).filter((k) => keys.has(k));
      return [id, sirali.map((k) => ({ key: k, ...BADGES[k] }))];
    }),
  );
}
