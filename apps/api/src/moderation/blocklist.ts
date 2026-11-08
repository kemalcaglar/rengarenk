import { createHmac } from 'node:crypto';
import type { BlockKind } from '@rengarenk/shared';
import type { Db, Tx } from '../database/prisma.js';

/** Kara liste özeti (Karar 43): değer saklanmaz; JWT_SECRET'ten türeyen anahtarla HMAC tutulur */
export function blockHash(secret: string, kind: BlockKind, value: string) {
  return createHmac('sha256', `rr-kara-liste:${secret}`).update(`${kind}:${value}`).digest('hex');
}

/** Değer kara listede mi (etkin kayıt) */
export async function karaListede(db: Db | Tx, secret: string, kind: BlockKind, values: string[]) {
  if (!values.length) return false;
  const n = await db.blocklist.count({
    where: { kind, removedAt: null, valueHash: { in: values.map((v) => blockHash(secret, kind, v)) } },
  });
  return n > 0;
}
