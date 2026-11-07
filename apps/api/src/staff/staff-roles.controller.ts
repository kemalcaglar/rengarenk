import {
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Prisma, uuidv7 } from '@rengarenk/db';
import { BUILTIN_ROLES, customRoleSchema, PERMISSIONS, ROLE_GRANTS } from '@rengarenk/shared';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { RequirePermission, sanitizeGrants } from './permissions.js';
import { StaffGuard, type StaffRequest } from './staff.guard.js';

/** Roller ve yetkiler: hazır roller değiştirilemez; Sahip özel rol oluşturur (Karar 40). */
@Controller('staff/roles')
@UseGuards(StaffGuard)
export class StaffRolesController {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission('ekip.yonet')
  async list() {
    const custom = await this.db.staffCustomRole.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { members: true } } },
    });
    return {
      permissions: PERMISSIONS,
      builtin: BUILTIN_ROLES.map((r) => ({ key: r.key, name: r.ad, permissions: ROLE_GRANTS[r.key] })),
      custom: custom.map((r) => ({
        id: r.id,
        name: r.name,
        permissions: sanitizeGrants(r.permissions),
        members: r._count.members,
      })),
    };
  }

  @Post()
  @RequirePermission('ekip.yonet')
  async create(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(customRoleSchema)) body: z.output<typeof customRoleSchema>,
  ) {
    try {
      return await this.db.$transaction(async (tx) => {
        const r = await tx.staffCustomRole.create({
          data: {
            id: uuidv7(),
            name: body.name,
            permissions: body.permissions,
            createdBy: req.staff.staff.id,
          },
        });
        await this.audit.record(
          {
            actorType: 'STAFF',
            actorId: req.staff.staff.id,
            action: 'ozel_rol_olustur',
            entityType: 'staff_role',
            entityId: r.id,
            after: { ad: r.name, yetkiler: body.permissions },
            ip: req.ip,
          },
          tx,
        );
        return r;
      });
    } catch (e) {
      throw duplicate(e);
    }
  }

  @Patch(':id')
  @RequirePermission('ekip.yonet')
  async update(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(customRoleSchema)) body: z.output<typeof customRoleSchema>,
  ) {
    try {
      return await this.db.$transaction(async (tx) => {
        const before = await tx.staffCustomRole.findUnique({ where: { id } });
        if (!before) throw new NotFoundException('Rol bulunamadı');
        const r = await tx.staffCustomRole.update({
          where: { id },
          data: { name: body.name, permissions: body.permissions },
        });
        await this.audit.record(
          {
            actorType: 'STAFF',
            actorId: req.staff.staff.id,
            action: 'ozel_rol_degisti',
            entityType: 'staff_role',
            entityId: id,
            before: { ad: before.name, yetkiler: before.permissions as Prisma.InputJsonValue },
            after: { ad: r.name, yetkiler: body.permissions },
            ip: req.ip,
          },
          tx,
        );
        return r;
      });
    } catch (e) {
      throw duplicate(e);
    }
  }
}

function duplicate(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return new ConflictException('Bu adla bir rol zaten var');
  }
  return e;
}
