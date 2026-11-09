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
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  chartNoteSchema,
  DASH_METRICS,
  DASH_PERIODS,
  type DashMetric,
  type DashPeriod,
  goalsSchema,
  REPORT_TABS,
  type ReportTab,
  reportFilterSchema,
  reportViewSchema,
  scheduledReportSchema,
  scheduledSwitchSchema,
} from '@rengarenk/shared';
import type { z } from 'zod';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { AuditService } from '../audit/audit.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { NotificationsWorkerModule } from '../notifications/notifications.module.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { DashboardService } from './dashboard.service.js';
import { ExperimentService } from './experiments.service.js';
import { ReportService } from './report.service.js';
import { ScheduledReportService } from './scheduled-report.service.js';

const donemOf = (d?: string): DashPeriod =>
  DASH_PERIODS.some((p) => p.key === d) ? (d as DashPeriod) : 'bugun';

/** Konsol › Kontrol paneli (Karar 44) */
@Controller('staff/dashboard')
@UseGuards(StaffGuard)
export class DashboardController {
  constructor(private readonly d: DashboardService) {}

  @Get()
  @RequirePermission('rapor.gor')
  overview(@Req() req: StaffRequest, @Query('donem') donem?: string) {
    return this.d.overview(req.staff.staff, donemOf(donem));
  }

  @Get('breakdown/:metrik')
  @RequirePermission('rapor.gor')
  breakdown(@Param('metrik') m: string, @Query('donem') donem?: string) {
    const metrik = (DASH_METRICS.some((x) => x.key === m) ? m : 'talep') as DashMetric;
    return this.d.breakdown(metrik, donemOf(donem));
  }

  /** Aylık hedefler: Sahip ve yönetici (sistem ayarı) */
  @Put('goals')
  @RequirePermission('sistem.ayarla')
  goals(@Req() req: StaffRequest, @Body(new ZodPipe(goalsSchema)) b: z.output<typeof goalsSchema>) {
    return this.d.setGoals(req.staff.staff, b.ay, b.hedefler, req.ip);
  }

  @Post('notes')
  @HttpCode(200)
  @RequirePermission('rapor.gor')
  note(@Req() req: StaffRequest, @Body(new ZodPipe(chartNoteSchema)) b: z.output<typeof chartNoteSchema>) {
    return this.d.addNote(req.staff.staff, b.gun, b.metin);
  }

  @Delete('notes/:id')
  @RequirePermission('rapor.gor')
  removeNote(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.d.removeNote(id);
  }
}

/** Konsol › Raporlar (Karar 44) */
@Controller('staff/reports')
@UseGuards(StaffGuard)
export class ReportsController {
  constructor(private readonly r: ReportService) {}

  private filtre(q: Record<string, string | undefined>) {
    const v = reportFilterSchema.safeParse({
      tarih: q.tarih || undefined,
      karsilastir: q.karsilastir || undefined,
      il: q.il || undefined,
      kategori: q.kategori || undefined,
      platform: q.platform || undefined,
    });
    if (!v.success) throw new BadRequestException('Süzgeç geçersiz');
    return v.data;
  }

  private sekme(s: string): ReportTab {
    if (!REPORT_TABS.some((t) => t.key === s)) throw new BadRequestException('Bilinmeyen rapor');
    return s as ReportTab;
  }

  @Get('views')
  @RequirePermission('rapor.gor')
  views(@Req() req: StaffRequest) {
    return this.r.views(req.staff.staff.id);
  }

  @Post('views')
  @HttpCode(200)
  @RequirePermission('rapor.gor')
  saveView(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(reportViewSchema)) b: z.output<typeof reportViewSchema>,
  ) {
    return this.r.saveView(req.staff.staff.id, b);
  }

  /** Kayıtlı pano (Zamanlanmış raporlar ekranındaki takım panoları buradan açılır) */
  @Get('views/:id')
  @RequirePermission('rapor.gor')
  view(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.r.view(id);
  }

  @Delete('views/:id')
  @RequirePermission('rapor.gor')
  removeView(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.r.removeView(req.staff.staff.id, id);
  }

  /** Excel'e aktar (CSV): sahip, yönetici ve finans; kişisel veri yok; işlem kaydına girer */
  @Get(':sekme/export')
  @RequirePermission('rapor.disa_aktar')
  export(
    @Req() req: StaffRequest,
    @Param('sekme') sekme: string,
    @Query() q: Record<string, string | undefined>,
  ) {
    return this.r.export(req.staff.staff.id, this.sekme(sekme), this.filtre(q), req.ip);
  }

  @Get(':sekme')
  @RequirePermission('rapor.gor')
  report(@Param('sekme') sekme: string, @Query() q: Record<string, string | undefined>) {
    return this.r.report(this.sekme(sekme), this.filtre(q));
  }
}

/**
 * Büyüme › Zamanlanmış raporlar (YonetimRapor.dc.html › zaman; Karar 44). Ayrıntılı yetki serviste: hazır raporları
 * sahip ve yönetici, galeri raporunu toplu gönderim yetkisi olan açar; yeni raporu ekleyen ya da yönetici değiştirir.
 */
@Controller('staff/scheduled-reports')
@UseGuards(StaffGuard)
export class ScheduledReportsController {
  constructor(private readonly s: ScheduledReportService) {}

  @Get()
  @RequirePermission('rapor.gor')
  list(@Req() req: StaffRequest) {
    return this.s.list(req.staff);
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('rapor.gor')
  create(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(scheduledReportSchema)) b: z.output<typeof scheduledReportSchema>,
  ) {
    return this.s.create(req.staff, b, req.ip);
  }

  @Post(':id/switch')
  @HttpCode(200)
  @RequirePermission('rapor.gor')
  setEnabled(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(scheduledSwitchSchema)) b: z.output<typeof scheduledSwitchSchema>,
  ) {
    return this.s.setEnabled(req.staff, id, b.acik, req.ip);
  }

  @Delete(':id')
  @RequirePermission('rapor.gor')
  remove(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.s.remove(req.staff, id, req.ip);
  }
}

/** Hesaplamalar (API ve işçideki hedef sapması denetimi) */
@Module({
  providers: [DashboardService, ExperimentService, AuditService],
  exports: [DashboardService, ExperimentService],
})
export class DashboardCoreModule {}

@Module({
  imports: [StaffModule, DashboardCoreModule, ApprovalsModule],
  controllers: [DashboardController, ReportsController, ScheduledReportsController],
  providers: [ReportService, ScheduledReportService, AuditService],
})
export class DashboardModule {}

/** İşçi: zamanı gelen raporları gönderir; galeri raporunun onayını yürütür */
@Module({
  imports: [DashboardCoreModule, ApprovalsModule, NotificationsWorkerModule],
  providers: [ReportService, ScheduledReportService, AuditService],
  exports: [ScheduledReportService],
})
export class ScheduledReportsWorkerModule {}
