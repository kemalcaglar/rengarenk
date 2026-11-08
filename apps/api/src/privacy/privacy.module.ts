import {
  BadRequestException,
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
import {
  accountCloseSchema,
  breachCloseSchema,
  breachStartSchema,
  breachStepSchema,
  dataExportSchema,
  kvkkCreateSchema,
  kvkkExternalSchema,
  kvkkReplySchema,
  officialCreateSchema,
  officialGiveSchema,
  officialReplySchema,
} from '@rengarenk/shared';
import type { z } from 'zod';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { RefundsService } from '../refunds/refunds.service.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { AccountClosureService } from './account-closure.service.js';
import { ComplianceService } from './compliance.service.js';
import { PrivacyService } from './privacy.service.js';
import { RetentionService } from './retention.service.js';

type AuthedRequest = { user: AccessClaims; ip: string };
type Reply = { header: (k: string, v: string) => unknown; send: (b: unknown) => unknown };

/** Kullanıcı: verilerimi indir, KVKK başvurusu (Ayarlar › Gizlilik ve güvenlik; Karar 58) */
@Controller('me')
@UseGuards(AuthGuard)
export class PrivacyController {
  constructor(
    private readonly p: PrivacyService,
    private readonly kapat: AccountClosureService,
  ) {}

  /** Ayarlar › Hesap: kapatınca ne olacağı ve kullanılmamış hakların iade önerisi (Karar 31, 39) */
  @Get('close')
  closePreview(@Req() req: AuthedRequest) {
    return this.kapat.preview(req.user.sub);
  }

  /** Hesabı kapat (SMS koduyla). İade yalnızca öneri olarak Sahip'in onay kuyruğuna düşer. */
  @Post('close')
  @HttpCode(200)
  close(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(accountCloseSchema)) b: z.output<typeof accountCloseSchema>,
  ) {
    return this.kapat.close(req.user.sub, b, req.ip);
  }

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

/**
 * Konsol › Uyum ve KVKK › Saklama, imha ve VERBİS (Karar 59). Liste KVKK yetkisiyle görülür; imha listesini yalnızca
 * Sahip onaylar (servis rolü denetler).
 */
@Controller('staff/retention')
@UseGuards(StaffGuard)
export class RetentionStaffController {
  constructor(private readonly r: RetentionService) {}

  @Get()
  @RequirePermission('kvkk.yanitla', 'oneri')
  overview() {
    return this.r.overview();
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission('kvkk.yanitla', 'tam')
  approve(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.r.approve(req.staff.staff, id, req.ip);
  }

  @Get(':id/report')
  @RequirePermission('kvkk.yanitla', 'oneri')
  report(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.r.report(id);
  }
}

/** Konsol › Uyum ve KVKK › İhlal ve resmi talepler (Karar 59): yalnız sahip ve yönetici (`sistem.ayarla`) */
@Controller('staff')
@UseGuards(StaffGuard)
export class ComplianceStaffController {
  constructor(private readonly c: ComplianceService) {}

  @Get('breach')
  @RequirePermission('sistem.ayarla')
  breach(@Req() req: StaffRequest) {
    return this.c.breach(req.staff.staff.id);
  }

  @Post('breach')
  @HttpCode(200)
  @RequirePermission('sistem.ayarla')
  startBreach(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(breachStartSchema)) b: z.output<typeof breachStartSchema>,
  ) {
    return this.c.startBreach(req.staff.staff.id, b, req.ip);
  }

  @Post('breach/:id/steps/:step')
  @HttpCode(200)
  @RequirePermission('sistem.ayarla')
  step(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('step') step: string,
    @Body(new ZodPipe(breachStepSchema)) b: z.output<typeof breachStepSchema>,
  ) {
    return this.c.stepBreach(req.staff.staff.id, id, step, b.not, req.ip);
  }

  @Post('breach/:id/close')
  @HttpCode(200)
  @RequirePermission('sistem.ayarla')
  closeBreach(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(breachCloseSchema)) b: z.output<typeof breachCloseSchema>,
  ) {
    return this.c.closeBreach(req.staff.staff.id, id, b.rapor, req.ip);
  }

  @Get('official')
  @RequirePermission('sistem.ayarla')
  officialList() {
    return this.c.officialList();
  }

  @Post('official')
  @HttpCode(200)
  @RequirePermission('sistem.ayarla')
  officialCreate(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(officialCreateSchema)) b: z.output<typeof officialCreateSchema>,
  ) {
    return this.c.officialCreate(req.staff.staff.id, b, req.ip);
  }

  /** Resmi yazı: gövde dosyanın kendisi (PDF ya da görsel) */
  @Post('official/:id/document')
  @HttpCode(200)
  @RequirePermission('sistem.ayarla')
  document(@Req() req: StaffRequest & { body: unknown }, @Param('id', new ParseUUIDPipe()) id: string) {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new BadRequestException('Resmi yazıyı PDF ya da görsel olarak yükle');
    }
    return this.c.officialDocument(req.staff.staff.id, id, new Uint8Array(req.body), req.ip);
  }

  @Get('official/:id/document')
  @RequirePermission('sistem.ayarla')
  async documentFile(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() reply: Reply,
  ) {
    const f = await this.c.officialDocumentFile(req.staff.staff.id, id, req.ip);
    reply.header('content-type', f.tur);
    reply.header('cache-control', 'no-store');
    return reply.send(f.body);
  }

  @Post('official/:id/give')
  @HttpCode(200)
  @RequirePermission('sistem.ayarla')
  give(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(officialGiveSchema)) b: z.output<typeof officialGiveSchema>,
  ) {
    return this.c.officialGive(req.staff.staff.id, id, b.ne, req.ip);
  }

  @Post('official/:id/reply')
  @HttpCode(200)
  @RequirePermission('sistem.ayarla')
  reply(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(officialReplySchema)) b: z.output<typeof officialReplySchema>,
  ) {
    return this.c.officialReply(req.staff.staff.id, id, b, req.ip);
  }
}

@Module({
  imports: [AuthModule, StaffModule, ApprovalsModule],
  controllers: [
    PrivacyController,
    PrivacyStaffController,
    RetentionStaffController,
    ComplianceStaffController,
  ],
  providers: [
    PrivacyService,
    AccountClosureService,
    RetentionService,
    ComplianceService,
    RefundsService,
    AuditService,
    OutboxService,
  ],
})
export class PrivacyModule {}

/** İşçi: veri kopyasını hazırlar (kimlik doğrulaması gerekmez) */
@Module({
  providers: [PrivacyService, RetentionService, AuditService, OutboxService],
  exports: [PrivacyService, RetentionService],
})
export class PrivacyWorkerModule {}
