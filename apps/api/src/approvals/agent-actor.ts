import { uuidv7 } from '@rengarenk/db';
import type { Db, Tx } from '../database/prisma.js';
import { grantsFor } from '../staff/permissions.js';
import type { Actor } from './approval.service.js';

/** Rengarenk Ajanı'nın servis hesabı (Karar 41): giriş yapamaz, davetle açılmaz, çalışan listesinde görünmez. */
export const AJAN_EPOSTA = 'ajan@rengarenksite.com';

/**
 * Ajanın onay motorundaki kimliği. Ajan yalnızca yetki matrisindeki düzeyle istek açar (iade: öneri); kararı her zaman
 * bir çalışan, iadede yalnızca Sahip verir.
 */
export async function ajanAktor(db: Db | Tx): Promise<Actor> {
  const staff = await db.staffMember.upsert({
    where: { email: AJAN_EPOSTA },
    update: {},
    create: { id: uuidv7(), email: AJAN_EPOSTA, name: 'Rengarenk Ajanı', role: 'AGENT' },
  });
  return { staff, grants: grantsFor(staff) };
}
