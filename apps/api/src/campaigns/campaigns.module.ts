import {
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { campaignSchema, segmentRuleSchema, segmentSchema } from '@rengarenk/shared';
import { z } from 'zod';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { AuditService } from '../audit/audit.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ExperimentService } from '../dashboard/experiments.service.js';
import { NotificationsModule, NotificationsWorkerModule } from '../notifications/notifications.module.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { CampaignService } from './campaign.service.js';
import { SegmentService } from './segment.service.js';

const previewSchema = z.object({ kurallar: z.array(segmentRuleSchema).min(1).max(12) }).strict();
const estimateSchema = z
  .object({
    segmentId: z.uuid(),
    kanallar: z
      .array(z.enum(['uygulama', 'eposta']))
      .min(1)
      .max(2),
  })
  .strict();

/** Konsol › Büyüme › Segmentler (Karar 51) */
@Controller('staff/segments')
@UseGuards(StaffGuard)
export class SegmentsController {
  constructor(private readonly s: SegmentService) {}

  @Get()
  @RequirePermission('kampanya.hazirla', 'oneri')
  list() {
    return this.s.list();
  }

  /** Canlı kişi sayısı ve kanal ulaşımı */
  @Post('preview')
  @HttpCode(200)
  @RequirePermission('kampanya.hazirla', 'oneri')
  preview(@Body(new ZodPipe(previewSchema)) b: z.output<typeof previewSchema>) {
    return this.s.preview(b.kurallar);
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('kampanya.hazirla', 'oneri')
  create(@Req() req: StaffRequest, @Body(new ZodPipe(segmentSchema)) b: z.output<typeof segmentSchema>) {
    return this.s.save(req.staff.staff.id, b);
  }

  @Put(':id')
  @RequirePermission('kampanya.hazirla', 'oneri')
  update(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(segmentSchema)) b: z.output<typeof segmentSchema>,
  ) {
    return this.s.save(req.staff.staff.id, b, id);
  }
}

/** Konsol › Büyüme › Kampanyalar (Karar 49, 51) */
@Controller('staff/campaigns')
@UseGuards(StaffGuard)
export class CampaignsController {
  constructor(private readonly c: CampaignService) {}

  @Get()
  @RequirePermission('kampanya.hazirla', 'oneri')
  list() {
    return this.c.list();
  }

  @Post('estimate')
  @HttpCode(200)
  @RequirePermission('kampanya.hazirla', 'oneri')
  estimate(@Body(new ZodPipe(estimateSchema)) b: z.output<typeof estimateSchema>) {
    return this.c.estimate(b.segmentId, b.kanallar);
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('kampanya.hazirla', 'oneri')
  create(@Req() req: StaffRequest, @Body(new ZodPipe(campaignSchema)) b: z.output<typeof campaignSchema>) {
    return this.c.create(req.staff, b, req.ip);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('kampanya.hazirla', 'oneri')
  cancel(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.c.cancel(req.staff, id, req.ip);
  }
}

@Module({
  imports: [StaffModule, ApprovalsModule, NotificationsModule],
  controllers: [SegmentsController, CampaignsController],
  providers: [SegmentService, CampaignService, ExperimentService, AuditService],
})
export class CampaignsModule {}

/** İşçi: onaylanan toplu gönderimi zamanlar ve zamanı gelen kampanyaları gönderir */
@Module({
  imports: [ApprovalsModule, NotificationsWorkerModule],
  providers: [SegmentService, CampaignService, ExperimentService, AuditService],
  exports: [CampaignService],
})
export class CampaignsWorkerModule {}
