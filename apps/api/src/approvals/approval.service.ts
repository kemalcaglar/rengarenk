import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Approval, type ApprovalKind, type Prisma, uuidv7 } from '@rengarenk/db';
import {
  APPROVAL_KINDS,
  APPROVAL_POLICIES,
  APPROVAL_TTL_HOURS,
  type ApprovalKindKey,
  type PermissionGrants,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';

/** Onay motorunun ihtiyaç duyduğu çalışan bilgisi (StaffContext'in alt kümesi). */
export interface Actor {
  staff: { id: string; role: string; status: string };
  grants: PermissionGrants;
}

export interface ApprovalRequestInput {
  kind: ApprovalKindKey;
  subjectType: string;
  subjectId: string;
  title: string;
  reason?: string;
  payload?: Prisma.InputJsonValue;
  amountKurus?: bigint;
}

export type ApprovalScope = 'bekleyen' | 'benim' | 'gecmis';

/**
 * Dört göz onay motoru (Teknik tasarım §11): istek, kimin onaylayacağı, süre ve sonuç. Fiyat, toplu
 * gönderim, kupon, kalıcı engelleme, hesap silme ve iade aynı motoru kullanır.
 *
 * - İsteği yalnızca ilgili yetkisi "tam" veya "öneri" düzeyinde olan çalışan açar.
 * - Onaylayıcı, türün kuralındaki hazır rollerden biri olmalıdır; özel roller ve ajan onaylayamaz.
 * - İsteyen kendi isteğini onaylayamaz; Sahip bunun dışındadır (sahip kararı, 7 Kasım 2026).
 * - İadeyi yalnızca Sahip onaylar. Bu motor iade kaydı oluşturmaz; veritabanı iade kilidi ayrıca denetler.
 * - Karara bağlanan onay değiştirilemez (rr_approval_immutable); onaylanan işlem kuyruktan yürütülür.
 */
@Injectable()
export class ApprovalService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /** Onay isteği açar. Çağıran modül kendi değişikliğiyle aynı işlemde çağırabilir (`tx`). */
  async request(actor: Actor, input: ApprovalRequestInput, tx?: Tx, ip?: string): Promise<Approval> {
    const policy = APPROVAL_POLICIES[input.kind];
    if (!policy) throw new BadRequestException('Bilinmeyen onay türü');
    const level = actor.grants[policy.permission];
    if (actor.staff.status !== 'ACTIVE' || (level !== 'tam' && level !== 'oneri')) {
      throw new ForbiddenException('Bu işlem için istek açma yetkin yok');
    }
    if (
      input.kind === 'REFUND' &&
      (input.subjectType !== 'payment' || !input.amountKurus || input.amountKurus <= 0n)
    ) {
      throw new BadRequestException('İade isteği bir ödemeye ve sıfırdan büyük tutara bağlı olmalı');
    }
    const run = async (t: Tx) => {
      const a = await t.approval.create({
        data: {
          id: uuidv7(),
          kind: input.kind,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          title: input.title,
          reason: input.reason ?? null,
          payload: input.payload ?? {},
          amountKurus: input.amountKurus ?? null,
          requestedBy: actor.staff.id,
          expiresAt: new Date(Date.now() + APPROVAL_TTL_HOURS * 3600_000),
        },
      });
      await this.audit.record(
        {
          actorType: actor.staff.role === 'AGENT' ? 'AGENT' : 'STAFF',
          actorId: actor.staff.id,
          action: 'onay_istendi',
          entityType: 'approval',
          entityId: a.id,
          after: {
            tur: a.kind,
            konu: `${a.subjectType}:${a.subjectId}`,
            tutarKurus: a.amountKurus?.toString() ?? null,
          },
          ip,
        },
        t,
      );
      await this.outbox.add(t, 'onay.istendi', { approvalId: a.id, kind: a.kind });
      return a;
    };
    return tx ? run(tx) : this.db.$transaction(run);
  }

  /** Çalışan bu isteği onaylayabilir ya da reddedebilir mi? */
  canDecide(actor: Actor, a: Pick<Approval, 'kind' | 'requestedBy'>): boolean {
    const policy = APPROVAL_POLICIES[a.kind as ApprovalKindKey];
    if (!policy || actor.staff.status !== 'ACTIVE') return false;
    if (!(policy.approvers as string[]).includes(actor.staff.role)) return false;
    return actor.staff.id !== a.requestedBy || actor.staff.role === 'OWNER';
  }

  /**
   * Karar. İade onayında Sahip istenen tutarı düşürebilir (`tutarKurus`); artıramaz. Tutar karar anında, karar
   * bekleyen satırda yazılır; karardan sonra onay değiştirilemez (rr_approval_immutable).
   */
  async decide(
    actor: Actor,
    id: string,
    decision: 'approve' | 'reject',
    note?: string,
    ip?: string,
    tutarKurus?: number,
  ) {
    const a = await this.db.approval.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('İstek bulunamadı');
    if (tutarKurus !== undefined) {
      if (a.kind !== 'REFUND' || decision !== 'approve') {
        throw new BadRequestException('Tutar yalnızca iade onayında değiştirilebilir');
      }
      if (!a.amountKurus || tutarKurus <= 0 || BigInt(tutarKurus) > a.amountKurus) {
        throw new BadRequestException('Onaylanan iade tutarı istenenden fazla olamaz');
      }
    }
    if (!this.canDecide(actor, a)) throw new ForbiddenException('Bu isteği karara bağlama yetkin yok');
    if (a.status !== 'PENDING') throw new ConflictException('Bu istek zaten karara bağlandı');
    if (a.expiresAt && a.expiresAt < new Date()) {
      await this.expire(a.id);
      throw new ConflictException('İsteğin süresi doldu; yeniden istek açılmalı');
    }
    const status = decision === 'approve' ? 'APPROVED' : 'REJECTED';
    return this.db.$transaction(async (tx) => {
      const r = await tx.approval.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status,
          decidedBy: actor.staff.id,
          decidedAt: new Date(),
          decisionNote: note ?? null,
          ...(tutarKurus !== undefined ? { amountKurus: BigInt(tutarKurus) } : {}),
        },
      });
      if (r.count !== 1) throw new ConflictException('Bu istek zaten karara bağlandı');
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: decision === 'approve' ? 'onay_onaylandi' : 'onay_reddedildi',
          entityType: 'approval',
          entityId: id,
          before: { durum: 'PENDING' },
          after: {
            durum: status,
            tur: a.kind,
            isteyen: a.requestedBy,
            ...(tutarKurus !== undefined
              ? { istenenKurus: a.amountKurus?.toString(), onaylananKurus: String(tutarKurus) }
              : {}),
          },
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, decision === 'approve' ? 'onay.onaylandi' : 'onay.reddedildi', {
        approvalId: id,
        kind: a.kind,
      });
      return tx.approval.findUniqueOrThrow({ where: { id } });
    });
  }

  /** İsteyen, karar verilmeden isteğini geri çekebilir. */
  async cancel(actor: Actor, id: string, ip?: string) {
    const a = await this.db.approval.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('İstek bulunamadı');
    if (a.requestedBy !== actor.staff.id) throw new ForbiddenException('Yalnızca isteyen geri çekebilir');
    await this.db.$transaction(async (tx) => {
      const r = await tx.approval.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      if (r.count !== 1) throw new ConflictException('Bu istek zaten karara bağlandı');
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'onay_geri_cekildi',
          entityType: 'approval',
          entityId: id,
          ip,
        },
        tx,
      );
    });
  }

  /** Çalışanın karar verebileceği türler. */
  private decidableKinds(actor: Actor): ApprovalKind[] {
    return APPROVAL_KINDS.filter((k) =>
      (APPROVAL_POLICIES[k].approvers as string[]).includes(actor.staff.role),
    );
  }

  private pendingWhere(actor: Actor): Prisma.ApprovalWhereInput {
    return {
      status: 'PENDING',
      kind: { in: this.decidableKinds(actor) },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      ...(actor.staff.role === 'OWNER' ? {} : { requestedBy: { not: actor.staff.id } }),
    };
  }

  pendingCount(actor: Actor) {
    if (this.decidableKinds(actor).length === 0) return Promise.resolve(0);
    return this.db.approval.count({ where: this.pendingWhere(actor) });
  }

  async list(actor: Actor, scope: ApprovalScope) {
    const where: Prisma.ApprovalWhereInput =
      scope === 'bekleyen'
        ? this.pendingWhere(actor)
        : scope === 'benim'
          ? { requestedBy: actor.staff.id }
          : { status: { not: 'PENDING' }, kind: { in: this.decidableKinds(actor) } };
    const rows = await this.db.approval.findMany({
      where,
      orderBy: { createdAt: scope === 'bekleyen' ? 'asc' : 'desc' },
      take: 100,
      include: {
        requester: { select: { id: true, name: true, role: true } },
        decider: { select: { id: true, name: true } },
        results: { orderBy: { id: 'desc' }, take: 1, select: { outcome: true, createdAt: true } },
      },
    });
    return rows.map(({ results, ...a }) => ({
      ...a,
      amountKurus: a.amountKurus?.toString() ?? null,
      rule: APPROVAL_POLICIES[a.kind as ApprovalKindKey]?.kural ?? '',
      kindName: APPROVAL_POLICIES[a.kind as ApprovalKindKey]?.ad ?? a.kind,
      canDecide: a.status === 'PENDING' && this.canDecide(actor, a),
      result: results[0] ?? null,
    }));
  }

  /** Süresi dolan bekleyen istekleri düşürür (işçi her birkaç dakikada çağırır). */
  async expireDue(): Promise<number> {
    const due = await this.db.approval.findMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      select: { id: true },
      take: 500,
    });
    let n = 0;
    for (const { id } of due) if (await this.expire(id)) n++;
    return n;
  }

  private expire(id: string) {
    return this.db.$transaction(async (tx) => {
      const r = await tx.approval.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      if (r.count !== 1) return false;
      await this.audit.record(
        { actorType: 'SYSTEM', action: 'onay_suresi_doldu', entityType: 'approval', entityId: id },
        tx,
      );
      await this.outbox.add(tx, 'onay.suresi_doldu', { approvalId: id });
      return true;
    });
  }
}
