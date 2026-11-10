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
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  appealCreateSchema,
  appealDecideSchema,
  bannedWordSchema,
  filterSwitchSchema,
  listingActionSchema,
  moderationDecideSchema,
  reportCreateSchema,
} from '@rengarenk/shared';
import { z } from 'zod';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { ContentRulesService } from './content-rules.service.js';
import { ListingsService } from './listings.service.js';
import { ModerationService } from './moderation.service.js';
import { SanctionService } from './sanctions.service.js';

type AuthedRequest = { user: AccessClaims; ip: string };

/** Kullanıcı: şikâyet et, hakkındaki kararı gör, itiraz et (Karar 53) */
@Controller()
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly m: ModerationService) {}

  @Post('reports')
  @HttpCode(201)
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(reportCreateSchema)) b: z.output<typeof reportCreateSchema>,
  ) {
    return this.m.create(req.user.sub, b, req.ip);
  }

  @Get('moderation/decisions/:id')
  decision(@Req() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.m.myDecision(req.user.sub, id);
  }

  @Post('moderation/decisions/:id/appeal')
  appeal(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(appealCreateSchema)) b: z.output<typeof appealCreateSchema>,
  ) {
    return this.m.appeal(req.user.sub, id, b.metin, req.ip);
  }
}

const turSchema = z.enum(['talep', 'arac']);
const araSchema = z.string().trim().max(80).optional();

/** Konsol › Pazar › Talepler ve portföy (YonetimPazar.dc.html › talep; Karar 53): liste ve toplu işlem */
@Controller('staff/listings')
@UseGuards(StaffGuard)
export class ListingsStaffController {
  constructor(private readonly l: ListingsService) {}

  @Get(':tur')
  @RequirePermission('sikayet.coz', 'tam')
  list(
    @Param('tur', new ZodPipe(turSchema)) tur: 'talep' | 'arac',
    @Query('q', new ZodPipe(araSchema)) q?: string,
  ) {
    return tur === 'talep' ? this.l.talepler(q) : this.l.araclar(q);
  }

  @Post(':tur/islem')
  @HttpCode(200)
  @RequirePermission('sikayet.coz', 'tam')
  act(
    @Req() req: StaffRequest,
    @Param('tur', new ZodPipe(turSchema)) tur: 'talep' | 'arac',
    @Body(new ZodPipe(listingActionSchema)) b: z.output<typeof listingActionSchema>,
  ) {
    return tur === 'talep' ? this.l.talepIslem(req.staff, b, req.ip) : this.l.aracIslem(req.staff, b, req.ip);
  }
}

/** Konsol › Pazar › Moderasyon (YonetimPazar.dc.html; Karar 53) */
@Controller('staff/moderation')
@UseGuards(StaffGuard)
export class ModerationStaffController {
  constructor(private readonly m: ModerationService) {}

  @Get('reports')
  @RequirePermission('sikayet.coz', 'tam')
  queue() {
    return this.m.queue();
  }

  @Get('reports/:id')
  @RequirePermission('sikayet.coz', 'tam')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.m.detail(id);
  }

  /** Kararın kendi yetkisi (askı, kalıcı engelleme) serviste ayrıca denetlenir */
  @Post('reports/:id/decide')
  @HttpCode(200)
  @RequirePermission('sikayet.coz', 'tam')
  decide(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(moderationDecideSchema)) b: z.output<typeof moderationDecideSchema>,
  ) {
    return this.m.decide(req.staff, id, b, req.ip);
  }

  @Get('appeals')
  @RequirePermission('sikayet.coz', 'tam')
  appeals() {
    return this.m.appeals();
  }

  @Post('appeals/:id/decide')
  @HttpCode(200)
  @RequirePermission('sikayet.coz', 'tam')
  decideAppeal(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(appealDecideSchema)) b: z.output<typeof appealDecideSchema>,
  ) {
    return this.m.decideAppeal(req.staff, id, b, req.ip);
  }

  @Get('filters')
  @RequirePermission('sikayet.coz', 'tam')
  filters() {
    return this.m.filters();
  }

  @Put('filters/:key')
  @RequirePermission('sikayet.coz', 'tam')
  setFilter(
    @Req() req: StaffRequest,
    @Param('key') key: string,
    @Body(new ZodPipe(filterSwitchSchema)) b: z.output<typeof filterSwitchSchema>,
  ) {
    return this.m.setFilter(req.staff.staff.id, key, b.acik, req.ip);
  }

  @Post('words')
  @HttpCode(200)
  @RequirePermission('sikayet.coz', 'tam')
  addWord(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(bannedWordSchema)) b: z.output<typeof bannedWordSchema>,
  ) {
    return this.m.addWord(req.staff.staff.id, b.kelime, req.ip);
  }

  @Delete('words/:kelime')
  @RequirePermission('sikayet.coz', 'tam')
  removeWord(@Req() req: StaffRequest, @Param('kelime') kelime: string) {
    return this.m.removeWord(req.staff.staff.id, kelime, req.ip);
  }
}

/** Mesajlaşma ve talepler için: içerik kuralları ve askı denetimi */
@Module({
  providers: [ContentRulesService, SanctionService],
  exports: [ContentRulesService, SanctionService],
})
export class ModerationCoreModule {}

/** Şikâyet, karar, itiraz; kalıcı engellemeyi onay yürütücüsüne kaydeder (API ve işçi) */
@Module({
  imports: [ApprovalsModule, ModerationCoreModule],
  providers: [ModerationService, AuditService, OutboxService],
  exports: [ModerationService],
})
export class ModerationServiceModule {}

@Module({
  imports: [AuthModule, StaffModule, ModerationServiceModule],
  controllers: [ReportsController, ModerationStaffController, ListingsStaffController],
  providers: [ListingsService, AuditService, OutboxService],
})
export class ModerationModule {}
