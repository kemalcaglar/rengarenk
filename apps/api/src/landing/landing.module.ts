import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Module,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { landingEventSchema, landingSchema } from '@rengarenk/shared';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { LandingService } from './landing.service.js';

/** Herkese açık: yayındaki açılış sayfası ve sayımlar (Karar 46) */
@Controller('acilis')
export class LandingPublicController {
  constructor(private readonly l: LandingService) {}

  @Get(':slug')
  page(@Param('slug') slug: string, @Query('onizleme') onizleme?: string) {
    return this.l.publicPage(slug, onizleme);
  }

  @Post(':slug/olay')
  @HttpCode(200)
  event(
    @Param('slug') slug: string,
    @Body(new ZodPipe(landingEventSchema)) b: z.output<typeof landingEventSchema>,
    @Ip() ip: string,
  ) {
    return this.l.event(slug, b.tur, ip);
  }
}

/** Konsol › Görünüm › Açılış sayfaları (pazarlama; onay gerekmez, Karar 46) */
@Controller('staff/landing')
@UseGuards(StaffGuard)
export class LandingStaffController {
  constructor(private readonly l: LandingService) {}

  @Get()
  @RequirePermission('gorunum.duzenle', 'oneri')
  list() {
    return this.l.list();
  }

  @Get(':id')
  @RequirePermission('gorunum.duzenle', 'oneri')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.l.get(id);
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('gorunum.duzenle', 'oneri')
  create(@Req() req: StaffRequest, @Body(new ZodPipe(landingSchema)) b: z.output<typeof landingSchema>) {
    return this.l.save(req.staff.staff.id, b);
  }

  @Put(':id')
  @RequirePermission('gorunum.duzenle', 'oneri')
  update(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(landingSchema)) b: z.output<typeof landingSchema>,
  ) {
    return this.l.save(req.staff.staff.id, b, id);
  }

  /** Yayınlama ve kapatma yalnızca tam yetkiyle (ajan öneri düzeyinde taslak hazırlar) */
  @Post(':id/publish')
  @HttpCode(200)
  @RequirePermission('gorunum.duzenle')
  publish(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.l.publish(req.staff.staff.id, id, req.ip);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  @RequirePermission('gorunum.duzenle')
  unpublish(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.l.unpublish(req.staff.staff.id, id, req.ip);
  }

  @Post(':id/rollback/:surum')
  @HttpCode(200)
  @RequirePermission('gorunum.duzenle')
  rollback(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('surum', ParseIntPipe) surum: number,
  ) {
    return this.l.rollback(req.staff.staff.id, id, surum, req.ip);
  }
}

@Module({
  imports: [StaffModule],
  controllers: [LandingPublicController, LandingStaffController],
  providers: [LandingService, AuditService],
})
export class LandingModule {}
