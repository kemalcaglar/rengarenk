import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';

export type EntitlementKind = 'talep' | 'ilk_mesaj' | 'uzatma' | 'ust_sira' | 'acil' | 'vitrin';

export interface LedgerSource {
  sourceType: string;
  sourceId: string;
  createdBy: string;
}

/**
 * Hak defteri (Teknik tasarım §7). Bakiye her zaman defterden hesaplanır. Aynı kaynak
 * (source_type, source_id, kind) ikinci kez yazılamaz; bu yüzden ödeme bildirimi iki kez gelse
 * de hak bir kez tanımlanır.
 */
@Injectable()
export class EntitlementService {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  async balance(accountId: string, kind: EntitlementKind, tx: Tx | Db = this.db): Promise<number> {
    const r = await tx.entitlementLedger.aggregate({ where: { accountId, kind }, _sum: { delta: true } });
    return r._sum.delta ?? 0;
  }

  /** Hak tanımlar. Kaynak daha önce işlendiyse hiçbir şey yapmaz ve false döner. */
  async grant(
    accountId: string,
    kind: EntitlementKind,
    amount: number,
    reason: string,
    src: LedgerSource,
  ): Promise<boolean> {
    if (amount <= 0) throw new Error('tanımlanan hak pozitif olmalı');
    const r = await this.db.entitlementLedger.createMany({
      data: [{ accountId, kind, delta: amount, reason, ...src }],
      skipDuplicates: true,
    });
    return r.count === 1;
  }

  /**
   * Bir hakkı kullanır. Bakiye yetmezse ConflictException. Hesap başına danışma kilidi alındığı
   * için eş zamanlı iki istek aynı hakkı iki kez harcayamaz. Çağıran işlemin içinde çalışır.
   */
  async consume(tx: Tx, accountId: string, kind: EntitlementKind, src: LedgerSource): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`hak:${accountId}:${kind}`}))`;
    const already = await tx.entitlementLedger.findUnique({
      where: { sourceType_sourceId_kind: { sourceType: src.sourceType, sourceId: src.sourceId, kind } },
    });
    if (already) return;
    if ((await this.balance(accountId, kind, tx)) < 1) {
      throw new ConflictException({ code: 'hak_yetersiz', kind });
    }
    await tx.entitlementLedger.create({ data: { accountId, kind, delta: -1, reason: 'kullanim', ...src } });
  }
}
