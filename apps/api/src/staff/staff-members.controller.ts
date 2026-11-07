import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { type StaffMember, uuidv7 } from '@rengarenk/db';
import { STAFF_INVITE_HOURS, staffInviteSchema, staffRoleChangeSchema } from '@rengarenk/shared';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { RequirePermission } from './permissions.js';
import { StaffGuard, type StaffRequest } from './staff.guard.js';
import { StaffAuthService } from './staff-auth.service.js';

const select = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  twoFactorEnabled: true,
  inviteExpiresAt: true,
  lastLoginAt: true,
  createdAt: true,
  customRole: { select: { id: true, name: true } },
} as const;

/** Çalışanlar (Karar 40): e-postayla davet, rol değişikliği, hesap ve oturum kapatma. Yalnızca Sahip. */
@Controller('staff/members')
@UseGuards(StaffGuard)
export class StaffMembersController {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly auth: StaffAuthService,
  ) {}

  @Get()
  @RequirePermission('ekip.yonet')
  list() {
    return this.db.staffMember.findMany({
      where: { role: { not: 'AGENT' } },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      select,
    });
  }

  @Post()
  @RequirePermission('ekip.yonet')
  async invite(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(staffInviteSchema)) body: z.output<typeof staffInviteSchema>,
  ) {
    const domain = body.email.split('@')[1] ?? '';
    if (!this.env.STAFF_EMAIL_DOMAINS.includes(domain)) {
      throw new BadRequestException(`Yalnızca şirket e-postası: ${this.env.STAFF_EMAIL_DOMAINS.join(', ')}`);
    }
    return this.db.$transaction(async (tx) => {
      if (await tx.staffMember.findUnique({ where: { email: body.email } })) {
        throw new ConflictException('Bu e-postayla bir çalışan zaten var');
      }
      await this.assertCustomRole(tx, body.customRoleId);
      const m = await tx.staffMember.create({
        data: {
          id: uuidv7(),
          email: body.email,
          name: body.name,
          role: body.role,
          customRoleId: body.customRoleId ?? null,
          status: 'INVITED',
          invitedBy: req.staff.staff.id,
          inviteExpiresAt: new Date(Date.now() + STAFF_INVITE_HOURS * 3600_000),
        },
        select,
      });
      await this.record(tx, req, 'calisan_davet', m.id, undefined, {
        rol: m.role,
        ozelRol: m.customRole?.name,
      });
      await this.outbox.add(tx, 'calisan.davet_edildi', { staffId: m.id });
      return m;
    });
  }

  @Patch(':id/role')
  @RequirePermission('ekip.yonet')
  async changeRole(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(staffRoleChangeSchema)) body: z.output<typeof staffRoleChangeSchema>,
  ) {
    return this.db.$transaction(async (tx) => {
      const before = await this.target(tx, req, id);
      await this.assertCustomRole(tx, body.customRoleId);
      const after = await tx.staffMember.update({
        where: { id },
        data: { role: body.role, customRoleId: body.customRoleId ?? null },
        select,
      });
      await this.record(
        tx,
        req,
        'calisan_rol_degisti',
        id,
        { rol: before.role, ozelRol: before.customRoleId },
        { rol: after.role, ozelRol: after.customRole?.id ?? null },
      );
      return after;
    });
  }

  @Post(':id/reinvite')
  @HttpCode(200)
  @RequirePermission('ekip.yonet')
  async reinvite(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.db.$transaction(async (tx) => {
      const m = await this.target(tx, req, id);
      if (m.status !== 'INVITED') throw new ConflictException('Bu çalışan daveti zaten kabul etmiş');
      const after = await tx.staffMember.update({
        where: { id },
        data: { inviteExpiresAt: new Date(Date.now() + STAFF_INVITE_HOURS * 3600_000) },
        select,
      });
      await this.record(tx, req, 'calisan_davet_yenilendi', id);
      await this.outbox.add(tx, 'calisan.davet_edildi', { staffId: id });
      return after;
    });
  }

  /** Ayrılan çalışan: hesap ve açık oturumları tek tıkla kapanır (Karar 40). */
  @Post(':id/disable')
  @HttpCode(200)
  @RequirePermission('ekip.yonet')
  async disable(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.db.$transaction(async (tx) => {
      const m = await this.target(tx, req, id);
      if (m.status === 'DISABLED') throw new ConflictException('Hesap zaten kapalı');
      const after = await tx.staffMember.update({
        where: { id },
        data: { status: 'DISABLED', disabledAt: new Date(), inviteExpiresAt: null },
        select,
      });
      const sessions = await this.auth.revokeAll(tx, id);
      await this.record(
        tx,
        req,
        'calisan_kapatildi',
        id,
        { durum: m.status },
        {
          durum: 'DISABLED',
          kapatilanOturum: sessions.count,
        },
      );
      await this.outbox.add(tx, 'calisan.kapatildi', { staffId: id });
      return after;
    });
  }

  /** Telefonunu kaybeden çalışan için: doğrulama uygulaması sıfırlanır, sonraki girişte yeniden kurulur. */
  @Post(':id/2fa-reset')
  @HttpCode(200)
  @RequirePermission('ekip.yonet')
  async resetTwoFactor(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.db.$transaction(async (tx) => {
      await this.target(tx, req, id);
      const after = await tx.staffMember.update({
        where: { id },
        data: { twoFactorEnabled: false, totpSecretEnc: null, totpLastStep: null },
        select,
      });
      await tx.staffRecoveryCode.deleteMany({ where: { staffId: id } });
      await this.auth.revokeAll(tx, id);
      await this.record(tx, req, 'calisan_2fa_sifirlandi', id);
      return after;
    });
  }

  /** Sahip kendi hesabını ve başka bir sahibi bu uçlardan değiştiremez; ajan ayrı yönetilir. */
  private async target(tx: Tx, req: StaffRequest, id: string): Promise<StaffMember> {
    if (id === req.staff.staff.id) throw new ForbiddenException('Kendi hesabında bu işlemi yapamazsın');
    const m = await tx.staffMember.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Çalışan bulunamadı');
    if (m.role === 'OWNER' || m.role === 'AGENT')
      throw new ForbiddenException('Bu hesap buradan değiştirilemez');
    return m;
  }

  private async assertCustomRole(tx: Tx, id?: string) {
    if (id && !(await tx.staffCustomRole.findUnique({ where: { id } }))) {
      throw new BadRequestException('Özel rol bulunamadı');
    }
  }

  private record(
    tx: Tx,
    req: StaffRequest,
    action: string,
    id: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
  ) {
    return this.audit.record(
      {
        actorType: 'STAFF',
        actorId: req.staff.staff.id,
        action,
        entityType: 'staff_member',
        entityId: id,
        before: before as never,
        after: after as never,
        ip: req.ip,
      },
      tx,
    );
  }
}
