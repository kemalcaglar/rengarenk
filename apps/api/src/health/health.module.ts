import { Controller, Get, HttpCode, Module, Post, Req, UseGuards } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { SystemHealthService } from './system-health.service.js';

/** Konsol › Sistem › Sistem sağlığı ve yedek (YonetimSistem.dc.html › saglik; Karar 56) */
@Controller('staff/system-health')
@UseGuards(StaffGuard)
export class SystemHealthStaffController {
  constructor(private readonly h: SystemHealthService) {}

  @Get()
  @RequirePermission('sistem.ayarla', 'oneri')
  overview() {
    return this.h.overview();
  }

  /** Geri yükleme testi isteği: yedek ayrı ortama geri yüklenir, canlı sistemi etkilemez */
  @Post('restore-test')
  @HttpCode(201)
  @RequirePermission('sistem.ayarla')
  restoreTest(@Req() req: StaffRequest) {
    return this.h.testIste(req.staff, req.ip);
  }
}

/** Sağlık yoklaması: API'de konsol ucu, işçide dakikalık yoklama */
@Module({
  providers: [SystemHealthService, AuditService],
  exports: [SystemHealthService],
})
export class SystemHealthCoreModule {}

@Module({
  imports: [StaffModule, SystemHealthCoreModule],
  controllers: [SystemHealthStaffController],
})
export class SystemHealthModule {}
