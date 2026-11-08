import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { refundRequestSchema } from '@rengarenk/shared';
import type { z } from 'zod';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { RefundsService } from './refunds.service.js';

/**
 * Konsol › İade önerisi (Karar 39, 40). İade yetkisi "öneri" ya da "tam" olan çalışan (Finans, Destek, ajan) iade
 * önerir; istek Onay kuyruğuna düşer ve yalnızca Sahip onaylar. Bu modülde ödeme kuruluşu iade kodu yoktur: onaylanan
 * iadeyi ayrı iade yürütücü süreci yapar (`src/refund-executor.ts`, kilit 2).
 */
@Controller('staff/refunds')
@UseGuards(StaffGuard)
export class RefundsStaffController {
  constructor(private readonly refunds: RefundsService) {}

  @Get()
  @RequirePermission('rapor.gor', 'maskeli')
  list() {
    return this.refunds.list();
  }

  @Get('quote/:orderId')
  @RequirePermission('iade', 'oneri')
  quote(@Param('orderId', new ParseUUIDPipe()) orderId: string) {
    return this.refunds.quote(orderId);
  }

  @Post()
  @RequirePermission('iade', 'oneri')
  request(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(refundRequestSchema)) b: z.output<typeof refundRequestSchema>,
  ) {
    return this.refunds.request(req.staff, b, req.ip);
  }
}

@Module({
  imports: [StaffModule, ApprovalsModule],
  controllers: [RefundsStaffController],
  providers: [RefundsService],
})
export class RefundsModule {}
