import type { Order } from '@rengarenk/db';
import { productByKey } from '@rengarenk/shared';
import type { Tx } from '../database/prisma.js';
import type { OutboxService } from '../outbox/outbox.service.js';
import { kalemler } from './order-item.js';

/**
 * İade edilen siparişin etkisini geri alır (Karar 38, 39; sahip kararı 8 Kasım 2026): siparişten kalan kullanılmamış hak
 * düşülür (kullanılmış kısım düşülmez), süren ya da sırada bekleyen öne çıkarma biter. Aynı sipariş için ikinci kez
 * düşülmez (kaynak no tekil). Para iadesi burada yapılmaz. Yapılanların okunur listesini döner.
 */
export async function revokeOrder(
  tx: Tx,
  o: Order,
  outbox: OutboxService,
  kaynak: { reason: string; sourceType: string; createdBy: string },
): Promise<string[]> {
  const now = new Date();
  const yapilan: string[] = [];
  const talepler = new Set<string>();
  for (const [i, k] of kalemler(o.items).entries()) {
    const p = productByKey(k.urun);
    if (!p) continue;
    const hak = p.hak
      ? { kind: p.hak.kind as string, adet: p.hak.adet }
      : p.oneCikarma && !k.talepId
        ? { kind: p.oneCikarma.tur as string, adet: 1 }
        : null;
    if (hak) {
      const b = await tx.entitlementLedger.aggregate({
        where: { accountId: o.accountId, kind: hak.kind },
        _sum: { delta: true },
      });
      const dus = Math.min(hak.adet, Math.max(0, b._sum.delta ?? 0));
      if (dus > 0) {
        await tx.entitlementLedger.createMany({
          data: [
            {
              accountId: o.accountId,
              kind: hak.kind,
              delta: -dus,
              reason: kaynak.reason,
              sourceType: kaynak.sourceType,
              sourceId: `${o.id}:${i}`,
              createdBy: kaynak.createdBy,
            },
          ],
          skipDuplicates: true,
        });
      }
      yapilan.push(
        dus === hak.adet
          ? `${k.ad}: ${dus} hak düşüldü`
          : `${k.ad}: ${dus} / ${hak.adet} hak düşüldü (kalanı kullanılmıştı)`,
      );
    }
    if (p.oneCikarma && k.talepId) {
      const suren = await tx.demandPromotion.findMany({ where: { orderId: o.id, endsAt: { gt: now } } });
      for (const pr of suren) {
        await tx.demandPromotion.update({
          where: { id: pr.id },
          data: { endsAt: pr.startsAt < now ? now : new Date(pr.startsAt.getTime() + 1) },
        });
      }
      talepler.add(k.talepId);
      yapilan.push(suren.length ? `${k.ad}: öne çıkarma bitirildi` : `${k.ad}: süresi zaten dolmuştu`);
    }
  }
  for (const demandId of talepler) await outbox.add(tx, 'talep.guncellendi', { demandId });
  return yapilan;
}
