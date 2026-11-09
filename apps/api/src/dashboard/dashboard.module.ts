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
  chartNoteSchema,
  DASH_METRICS,
  DASH_PERIODS,
  type DashMetric,
  type DashPeriod,
  goalsSchema,
} from '@rengarenk/shared';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { DashboardService } from './dashboard.service.js';

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

/** Hesaplamalar (API ve işçideki hedef sapması denetimi) */
@Module({ providers: [DashboardService, AuditService], exports: [DashboardService] })
export class DashboardCoreModule {}

@Module({ imports: [StaffModule, DashboardCoreModule], controllers: [DashboardController] })
export class DashboardModule {}
