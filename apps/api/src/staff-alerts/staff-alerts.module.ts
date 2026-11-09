import { Body, Controller, Get, HttpCode, Module, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  STAFF_ALERT_KEYS,
  type StaffAlertKey,
  staffAlertReadSchema,
  staffAlertSwitchSchema,
} from '@rengarenk/shared';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { NotificationsWorkerModule } from '../notifications/notifications.module.js';
import { RequirePermission, StaffOnly } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { StaffAlertService } from './staff-alert.service.js';

const ruleSchema = z.enum(STAFF_ALERT_KEYS as [StaffAlertKey, ...StaffAlertKey[]]);

/** Konsol: çalışanın kendi uyarıları ve Büyüme › Zamanlanmış raporlar ve uyarılar (YonetimRapor.dc.html › zaman) */
@Controller('staff/alerts')
@UseGuards(StaffGuard)
export class StaffAlertsController {
  constructor(private readonly alerts: StaffAlertService) {}

  /** Her çalışan yalnızca kendine gelen uyarıları görür */
  @Get()
  @StaffOnly()
  list(@Req() req: StaffRequest) {
    return this.alerts.list(req.staff.staff.id);
  }

  @Post('read')
  @HttpCode(200)
  @StaffOnly()
  read(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(staffAlertReadSchema)) b: z.output<typeof staffAlertReadSchema>,
  ) {
    return this.alerts.read(req.staff.staff.id, b);
  }

  @Get('rules')
  @RequirePermission('rapor.gor', 'maskeli')
  rules(@Req() req: StaffRequest) {
    return this.alerts.rules(req.staff.staff);
  }

  /** Kritik olmayan kuralı kapatma: yalnızca Sahip (serviste denetlenir) */
  @Post('rules/:key')
  @HttpCode(200)
  @RequirePermission('sistem.ayarla')
  setRule(
    @Req() req: StaffRequest,
    @Param('key', new ZodPipe(ruleSchema)) key: StaffAlertKey,
    @Body(new ZodPipe(staffAlertSwitchSchema)) b: z.output<typeof staffAlertSwitchSchema>,
  ) {
    return this.alerts.setRule(req.staff.staff, key, b.enabled, req.ip);
  }
}

@Module({
  imports: [AuthModule, StaffModule],
  controllers: [StaffAlertsController],
  providers: [StaffAlertService, AuditService],
})
export class StaffAlertsModule {}

/** İşçi: olaylardan uyarı, saatlik denetimler ve e-posta teslimi */
@Module({
  imports: [NotificationsWorkerModule],
  providers: [StaffAlertService, AuditService],
  exports: [StaffAlertService],
})
export class StaffAlertsWorkerModule {}
