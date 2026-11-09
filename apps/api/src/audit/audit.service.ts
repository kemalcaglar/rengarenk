import { Inject, Injectable } from '@nestjs/common';
import type { ActorType, Prisma } from '@rengarenk/db';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { IpVault } from './ip-vault.js';

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

/**
 * İşlem kaydı: yalnızca ekleme (Karar 40). Değişiklikle aynı işlemde yazılmalıdır. IP adresi dönem anahtarıyla
 * şifreli yazılır; 2 yıl sonra anahtar imha edilir (`ip-vault.ts`).
 */
@Injectable()
export class AuditService {
  readonly ips: IpVault;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) env: Env,
  ) {
    this.ips = new IpVault(db, env);
  }

  async record(entry: AuditEntry, tx: Tx | Db = this.db) {
    const ip = await this.ips.seal(entry.ip);
    return tx.auditLog.create({ data: { ...entry, actorId: entry.actorId ?? null, ip } });
  }
}
