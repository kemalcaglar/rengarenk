import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { personNameSchema } from '@rengarenk/shared';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { type Db, PRISMA } from '../database/prisma.js';

const updateSchema = z
  .object({
    displayName: z.string().trim().min(2, 'En az 2 karakter').max(60).nullable().optional(),
    /** Ad ve soyad ayrı (Karar 29); ikisi verilince görünen ad "Ad Soyad" olur */
    firstName: personNameSchema.optional(),
    lastName: personNameSchema.optional(),
    email: z.email('Geçerli bir e-posta gir').max(254).nullable().optional(),
  })
  .strict()
  .transform((v) =>
    v.firstName && v.lastName && v.displayName === undefined
      ? { ...v, displayName: `${v.firstName} ${v.lastName}` }
      : v,
  );

type AuthedRequest = { user: AccessClaims; ip: string };

/** Kullanıcının kendi profili ve açık oturumları (Ayarlar > Giriş ve güvenlik). */
@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  @Get()
  get(@Req() req: AuthedRequest) {
    return this.db.user.findUniqueOrThrow({
      where: { id: req.user.sub },
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        memberships: {
          select: { role: true, account: { select: { id: true, kind: true, name: true, status: true } } },
        },
      },
    });
  }

  @Patch()
  async update(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(updateSchema)) body: z.output<typeof updateSchema>,
  ) {
    return this.db.$transaction(async (tx) => {
      const before = await tx.user.findUniqueOrThrow({
        where: { id: req.user.sub },
        select: { displayName: true, firstName: true, lastName: true, email: true },
      });
      const after = await tx.user.update({
        where: { id: req.user.sub },
        data: body,
        select: { id: true, displayName: true, firstName: true, lastName: true, email: true },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: req.user.sub,
          action: 'profil_guncelle',
          entityType: 'user',
          entityId: req.user.sub,
          // Kişisel veri işlem kaydına değer olarak değil, yalnızca değişen alan adı olarak yazılır.
          before: Object.keys(body).filter(
            (k) => before[k as keyof typeof before] !== after[k as keyof typeof after],
          ),
          ip: req.ip,
        },
        tx,
      );
      return after;
    });
  }

  @Get('sessions')
  async sessions(@Req() req: AuthedRequest) {
    const rows = await this.db.session.findMany({
      where: { userId: req.user.sub, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        device: { select: { platform: true, lastSeenAt: true } },
      },
    });
    return rows.map((s) => ({ ...s, current: s.id === req.user.sid }));
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async revoke(@Req() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    const r = await this.db.session.updateMany({
      where: { id, userId: req.user.sub, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (r.count === 0) throw new NotFoundException();
    await this.audit.record({
      actorType: 'USER',
      actorId: req.user.sub,
      action: 'oturum_kapat',
      entityType: 'session',
      entityId: id,
      ip: req.ip,
    });
  }
}
