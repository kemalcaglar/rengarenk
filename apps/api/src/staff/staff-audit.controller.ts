import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
import type { Prisma } from '@rengarenk/db';
import { auditActionsMatching, maskIp } from '@rengarenk/shared';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { RequirePermission } from './permissions.js';
import { StaffGuard, type StaffRequest } from './staff.guard.js';

const querySchema = z
  .object({
    filtre: z.enum(['hepsi', 'ajan', 'veri', 'para', 'yetki']).default('hepsi'),
    q: z.string().trim().max(100).optional(),
    once: z.string().regex(/^\d+$/).optional(),
  })
  .strict();

const FILTERS: Record<string, Prisma.AuditLogWhereInput> = {
  hepsi: {},
  ajan: { actorType: 'AGENT' },
  veri: { action: { startsWith: 'kisisel_veri' } },
  para: { entityType: { in: ['payment', 'refund', 'order', 'invoice', 'subscription'] } },
  yetki: {
    entityType: { in: ['staff_member', 'staff_role', 'staff_session', 'staff_login', 'approval', 'setting'] },
  },
};

const PAGE = 50;

/** İşlem kaydı (Karar 40): silinemez, 2 yıl saklanır; kişiye ve işleme göre aranır. */
@Controller('staff/audit')
@UseGuards(StaffGuard)
export class StaffAuditController {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  @Get()
  @RequirePermission('islem_kaydi.gor')
  async list(@Req() req: StaffRequest, @Query(new ZodPipe(querySchema)) query: z.output<typeof querySchema>) {
    const q = query.q;
    // Kişi adıyla, işlemin okunur adıyla, işlem koduyla ya da kayıt kimliğiyle aranır
    const people = q
      ? await this.db.staffMember.findMany({
          where: { name: { contains: q, mode: 'insensitive' } },
          select: { id: true },
          take: 50,
        })
      : [];
    const where: Prisma.AuditLogWhereInput = {
      ...FILTERS[query.filtre],
      ...(query.once ? { id: { lt: BigInt(query.once) } } : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q } },
              { action: { in: auditActionsMatching(q) } },
              { entityId: q },
              { actorId: { in: [q, ...people.map((p) => p.id)] } },
            ],
          }
        : {}),
    };
    const rows = await this.db.auditLog.findMany({ where, orderBy: { id: 'desc' }, take: PAGE });

    const staffIds = [
      ...new Set(rows.filter((r) => r.actorType !== 'USER' && r.actorId).map((r) => r.actorId)),
    ];
    const names = new Map(
      (
        await this.db.staffMember.findMany({
          where: { id: { in: staffIds as string[] } },
          select: { id: true, name: true },
        })
      ).map((s) => [s.id, s.name]),
    );
    // IP adresi kişisel veridir: açık görme yetkisi olmayan maskeli görür.
    const showIp = req.staff.grants['kisisel_veri.gor'] === 'tam';

    return {
      items: rows.map((r) => ({
        id: r.id.toString(),
        createdAt: r.createdAt,
        actorType: r.actorType,
        actorId: r.actorId,
        actorName:
          r.actorType === 'SYSTEM'
            ? 'Sistem'
            : r.actorType === 'USER'
              ? 'Kullanıcı'
              : (names.get(r.actorId ?? '') ?? (r.actorType === 'AGENT' ? 'Rengarenk Ajanı' : 'Çalışan')),
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        before: r.before,
        after: r.after,
        ip: r.ip ? (showIp ? r.ip : maskIp(r.ip)) : null,
      })),
      next: rows.length === PAGE ? rows[rows.length - 1]?.id.toString() : null,
    };
  }
}
