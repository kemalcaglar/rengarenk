import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { couponSchema } from '@rengarenk/shared';
import type { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { CouponService } from './coupon.service.js';

/** Konsol › Kampanyalar › Kuponlar: pazarlama hazırlar, sahip ya da yönetici onaylar (Karar 40, 51) */
@Controller('staff/coupons')
@UseGuards(StaffGuard)
export class CouponsStaffController {
  constructor(private readonly c: CouponService) {}

  @Get()
  @RequirePermission('kampanya.hazirla', 'oneri')
  list() {
    return this.c.list();
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('kampanya.hazirla', 'oneri')
  create(@Req() req: StaffRequest, @Body(new ZodPipe(couponSchema)) b: z.output<typeof couponSchema>) {
    return this.c.create(req.staff, b, req.ip);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('kampanya.hazirla', 'oneri')
  cancel(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.c.cancel(req.staff, id, req.ip);
  }
}
