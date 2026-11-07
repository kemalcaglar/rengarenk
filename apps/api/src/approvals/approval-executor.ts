import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Approval, Prisma } from '@rengarenk/db';
import type { ApprovalKindKey } from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';

/** Onaylanan işlemi gerçekleştiren modül işlevi; dönen değer sonuç kaydına yazılır. */
export type ApprovalHandler = (approval: Approval, tx: Tx) => Promise<Prisma.InputJsonValue>;

export type ExecutionOutcome = 'yurutuldu' | 'zaten_yurutuldu' | 'atlandi' | 'yurutucu_yok';

/**
 * Onaylanan istekleri kuyruktan yürütür (işçi, `onay.onaylandi` olayı). Her modül kendi türü için
 * işlev kaydeder (ör. fiyat modülü PRICE_CHANGE). Aynı onay iki kez yürütülmez; hata olursa
 * FAILED sonucu yazılır ve kuyruk yeniden dener.
 *
 * İade bu yürütücüden hiçbir zaman yapılmaz: PayTR iade anahtarı yalnızca ayrı "iade yürütücü"
 * sürecinde bulunur (Teknik tasarım §7, kilit 2).
 */
@Injectable()
export class ApprovalExecutor {
  private readonly log = new Logger(ApprovalExecutor.name);
  private readonly handlers = new Map<ApprovalKindKey, ApprovalHandler>();

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  register(kind: ApprovalKindKey, handler: ApprovalHandler) {
    if (kind === 'REFUND')
      throw new Error('İade onay yürütücüsünden yapılamaz (iade yürütücü ayrı süreçtir)');
    this.handlers.set(kind, handler);
  }

  async execute(approvalId: string): Promise<ExecutionOutcome> {
    const a = await this.db.approval.findUnique({ where: { id: approvalId } });
    if (a?.status !== 'APPROVED' || a.kind === 'REFUND') return 'atlandi';
    const done = await this.db.approvalResult.findFirst({ where: { approvalId, outcome: 'SUCCEEDED' } });
    if (done) return 'zaten_yurutuldu';

    const handler = this.handlers.get(a.kind as ApprovalKindKey);
    if (!handler) {
      // Türün modülü henüz yazılmadıysa onay kayıtta kalır; modül eklenince yeniden yürütülebilir.
      this.log.warn(`onay ${a.id} (${a.kind}) için yürütücü tanımlı değil`);
      return 'yurutucu_yok';
    }
    try {
      await this.db.$transaction(async (tx) => {
        const detail = await handler(a, tx);
        await tx.approvalResult.create({ data: { approvalId, outcome: 'SUCCEEDED', detail } });
        await this.audit.record(
          { actorType: 'SYSTEM', action: 'onay_yurutuldu', entityType: 'approval', entityId: approvalId },
          tx,
        );
      });
      return 'yurutuldu';
    } catch (err) {
      await this.db.approvalResult.create({
        data: { approvalId, outcome: 'FAILED', detail: { hata: (err as Error).message.slice(0, 500) } },
      });
      throw err;
    }
  }
}
