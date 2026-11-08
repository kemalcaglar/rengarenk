import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { dataExportSchema, kvkkCreateSchema, kvkkExternalSchema, kvkkReplySchema } from '@rengarenk/shared';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { PrivacyService } from './privacy.service.js';

type AuthedRequest = { user: AccessClaims; ip: string };
type Reply = { header: (k: string, v: string) => unknown; send: (b: unknown) => unknown };

/** Kullanıcı: verilerimi indir, KVKK başvurusu (Ayarlar › Gizlilik ve güvenlik; Karar 58) */
@Controller('me')
@UseGuards(AuthGuard)
export class PrivacyController {
  constructor(private readonly p: PrivacyService) {}

  @Post('data-exports')
  @HttpCode(200)
  requestExport(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(dataExportSchema)) b: z.output<typeof dataExportSchema>,
  ) {
    return this.p.requestExport(req.user.sub, b, req.ip);
  }

  @Get('data-exports')
  exports(@Req() req: AuthedRequest) {
    return this.p.exports(req.user.sub);
  }

  @Get('data-exports/:id/download')
  async download(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() reply: Reply,
  ) {
    const f = await this.p.download(req.user.sub, id, req.ip);
    reply.header('content-type', 'application/json; charset=utf-8');
    reply.header('content-disposition', 'attachment; filename="rengarenk-verilerim.json"');
    reply.header('cache-control', 'no-store');
    return reply.send(f.body);
  }

  @Get('blocks')
  blocks(@Req() req: AuthedRequest) {
    return this.p.blocks(req.user.sub);
  }

  @Delete('blocks/:accountId')
  unblock(@Req() req: AuthedRequest, @Param('accountId', new ParseUUIDPipe()) accountId: string) {
    return this.p.unblock(req.user.sub, accountId);
  }

  @Post('kvkk')
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(kvkkCreateSchema)) b: z.output<typeof kvkkCreateSchema>,
  ) {
    return this.p.createRequest(req.user.sub, b, req.ip);
  }

  @Get('kvkk')
  mine(@Req() req: AuthedRequest) {
    return this.p.myRequests(req.user.sub);
  }
}

/** Konsol › Uyum ve KVKK › KVKK başvuruları, Rıza ve çerez kayıtları (YonetimSistem.dc.html) */
@Controller('staff')
@UseGuards(StaffGuard)
export class PrivacyStaffController {
  constructor(private readonly p: PrivacyService) {}

  @Get('kvkk')
  @RequirePermission('kvkk.yanitla', 'oneri')
  list() {
    return this.p.staffList();
  }

  @Get('kvkk/:id')
  @RequirePermission('kvkk.yanitla', 'oneri')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.p.staffDetail(id);
  }

  @Post('kvkk')
  @HttpCode(200)
  @RequirePermission('kvkk.yanitla', 'oneri')
  create(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(kvkkExternalSchema)) b: z.output<typeof kvkkExternalSchema>,
  ) {
    return this.p.staffCreate(req.staff.staff.id, b, req.ip);
  }

  /** Yanıtı yalnızca tam yetkili çalışan gönderir (sahip, yönetici ya da yetki verilen kişi) */
  @Post('kvkk/:id/reply')
  @HttpCode(200)
  @RequirePermission('kvkk.yanitla', 'tam')
  reply(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(kvkkReplySchema)) b: z.output<typeof kvkkReplySchema>,
  ) {
    return this.p.reply(req.staff.staff.id, id, b.metin, req.ip);
  }

  @Get('consents/overview')
  @RequirePermission('kvkk.yanitla', 'oneri')
  consentOverview() {
    return this.p.consentOverview();
  }

  @Get('consents')
  @RequirePermission('kvkk.yanitla', 'oneri')
  consentHistory(@Query('q') q = '') {
    return this.p.consentHistory(String(q).slice(0, 80));
  }
}

@Module({
  imports: [AuthModule, StaffModule],
  controllers: [PrivacyController, PrivacyStaffController],
  providers: [PrivacyService, AuditService, OutboxService],
})
export class PrivacyModule {}

/** İşçi: veri kopyasını hazırlar (kimlik doğrulaması gerekmez) */
@Module({
  providers: [PrivacyService, AuditService, OutboxService],
  exports: [PrivacyService],
})
export class PrivacyWorkerModule {}
