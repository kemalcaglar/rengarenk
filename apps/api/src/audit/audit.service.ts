import { Inject, Injectable } from '@nestjs/common';
import type { ActorType, Prisma } from '@rengarenk/db';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';

export interface AuditEntry {
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ip?: string | null;
}

/** İşlem kaydı: yalnızca ekleme (Karar 40). Değişiklikle aynı işlemde yazılmalıdır. */
@Injectable()
export class AuditService {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  record(entry: AuditEntry, tx: Tx | Db = this.db) {
    return tx.auditLog.create({ data: { ...entry, actorId: entry.actorId ?? null, ip: entry.ip ?? null } });
  }
}
