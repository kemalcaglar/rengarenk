import { Body, Controller, Get, Global, Header, Module, Post, Put, Req, UseGuards } from '@nestjs/common';
import { designTokensSchema } from '@rengarenk/shared';
import { z } from 'zod';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { AuditService } from '../audit/audit.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { DesignService } from './design.service.js';

const taslakSchema = z
  .object({ degerler: designTokensSchema, not: z.string().trim().max(500).optional() })
  .strict();

/** Herkese açık: web, mobil ve e-posta yayındaki tasarım değerlerini okur (Karar 46) */
@Controller('tasarim')
export class DesignPublicController {
  constructor(private readonly d: DesignService) {}

  @Get()
  @Header('cache-control', 'public, max-age=60')
  get() {
    return this.d.publicDesign();
  }
}

/** Konsol › Görünüm › Tasarım değerleri (YonetimIcerik.dc.html; yetki "Tasarım değerleri ve yasal metin") */
@Controller('staff/design')
@UseGuards(StaffGuard)
export class DesignStaffController {
  constructor(private readonly d: DesignService) {}

  @Get()
  @RequirePermission('tasarim_yasal.duzenle', 'oneri')
  view() {
    return this.d.staffView();
  }

  @Put('draft')
  @RequirePermission('tasarim_yasal.duzenle', 'oneri')
  save(@Req() req: StaffRequest, @Body(new ZodPipe(taslakSchema)) b: z.output<typeof taslakSchema>) {
    return this.d.saveDraft(req.staff, b.degerler, b.not, req.ip);
  }

  @Post('submit')
  @RequirePermission('tasarim_yasal.duzenle', 'oneri')
  submit(@Req() req: StaffRequest) {
    return this.d.submit(req.staff, req.ip);
  }
}

/** Tasarım değerleri her süreçte (API, işçi): e-posta şablonu ve onay yürütücüsü kullanır */
@Global()
@Module({
  imports: [ApprovalsModule],
  providers: [DesignService, AuditService],
  exports: [DesignService],
})
export class DesignCoreModule {}

@Module({
  imports: [StaffModule, DesignCoreModule],
  controllers: [DesignPublicController, DesignStaffController],
})
export class DesignModule {}
