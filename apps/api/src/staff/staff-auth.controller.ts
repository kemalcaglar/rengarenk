import { Body, Controller, Get, Headers, HttpCode, Inject, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { APPROVAL_POLICIES, BUILTIN_ROLES, STAFF_IDLE_MINUTES, totpCodeSchema } from '@rengarenk/shared';
import { z } from 'zod';
import { ApprovalService } from '../approvals/approval.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { StaffOnly, StaffPublic } from './permissions.js';
import { StaffGuard, type StaffRequest } from './staff.guard.js';
import { StaffAuthService } from './staff-auth.service.js';

const callbackSchema = z
  .object({ state: z.string().min(20).max(200), code: z.string().min(1).max(4096) })
  .strict();
const ticketSchema = z.object({ ticket: z.string().min(20).max(200) }).strict();
const verifySchema = z
  .object({
    ticket: z.string().min(20).max(200),
    code: totpCodeSchema,
    deviceId: z.string().min(16).max(200).optional(),
  })
  .strict();

/** Yönetim konsolu girişi. Konsolun sunucu tarafı (Next.js) bu uçları çağırır; tarayıcı doğrudan çağırmaz. */
@Controller('staff/auth')
@UseGuards(StaffGuard)
export class StaffAuthController {
  constructor(private readonly auth: StaffAuthService) {}

  @Post('google/start')
  @HttpCode(200)
  @StaffPublic()
  start(@Ip() ip: string) {
    return this.auth.start(ip);
  }

  @Post('google/callback')
  @HttpCode(200)
  @StaffPublic()
  callback(@Body(new ZodPipe(callbackSchema)) body: z.output<typeof callbackSchema>, @Ip() ip: string) {
    return this.auth.google(body.state, body.code, ip);
  }

  @Post('2fa/setup')
  @HttpCode(200)
  @StaffPublic()
  setup(@Body(new ZodPipe(ticketSchema)) body: z.output<typeof ticketSchema>) {
    return this.auth.setup(body.ticket);
  }

  @Post('2fa/verify')
  @HttpCode(200)
  @StaffPublic()
  verify(
    @Body(new ZodPipe(verifySchema)) body: z.output<typeof verifySchema>,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.auth.verify(body.ticket, body.code, { deviceId: body.deviceId, userAgent, ip });
  }

  @Post('logout')
  @HttpCode(204)
  @StaffOnly()
  async logout(@Req() req: StaffRequest) {
    await this.auth.logout(req.staff, req.ip);
  }
}

/** Giriş yapmış çalışanın kendi bilgisi: rolü, yetkileri ve onayını bekleyen istek sayısı. */
@Controller('staff/me')
@UseGuards(StaffGuard)
export class StaffMeController {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly approvals: ApprovalService,
  ) {}

  @Get()
  @StaffOnly()
  async me(@Req() req: StaffRequest) {
    const { staff, grants } = req.staff;
    const custom = staff.customRoleId
      ? await this.db.staffCustomRole.findUnique({
          where: { id: staff.customRoleId },
          select: { name: true },
        })
      : null;
    return {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      roleName: custom?.name ?? BUILTIN_ROLES.find((r) => r.key === staff.role)?.ad ?? staff.role,
      permissions: grants,
      approverOf: Object.entries(APPROVAL_POLICIES)
        .filter(([, p]) => (p.approvers as string[]).includes(staff.role))
        .map(([k]) => k),
      pendingApprovals: await this.approvals.pendingCount(req.staff),
      /** Menüde Entegrasyonlar rozeti: son denemesi hata veren etkin kaynaklar (tasarım: "1 uyarı") */
      integrationWarnings: await this.db.catalogSource.count({
        where: { active: true, lastError: { not: null } },
      }),
      idleMinutes: STAFF_IDLE_MINUTES,
    };
  }
}
