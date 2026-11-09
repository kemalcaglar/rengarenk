import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Ip,
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
  BANNER_PLACE_KEYS,
  type BannerPlace,
  bannerEventSchema,
  bannerSchema,
  vitrinEditorSchema,
} from '@rengarenk/shared';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthService } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { BannerService } from './banner.service.js';

/** Herkese açık: görüntüleyene uyan bannerlar ve sayımlar (Karar 46) */
@Controller('icerik')
export class ContentPublicController {
  constructor(
    private readonly b: BannerService,
    private readonly auth: AuthService,
  ) {}

  @Get('banner')
  async banner(
    @Query('yer') yer: string,
    @Query('platform') platform: string,
    @Headers('authorization') authorization?: string,
  ) {
    if (!BANNER_PLACE_KEYS.includes(yer as BannerPlace)) throw new BadRequestException('Bilinmeyen yer');
    const viewer = authorization?.startsWith('Bearer ')
      ? await this.auth
          .verifyAccess(authorization.slice(7))
          .then((c) => c.sub)
          .catch(() => undefined)
      : undefined;
    return this.b.active(yer as BannerPlace, platform === 'mobil' ? 'mobil' : 'web', viewer);
  }

  @Post('banner/:id/olay')
  @HttpCode(200)
  event(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(bannerEventSchema)) b: z.output<typeof bannerEventSchema>,
    @Ip() ip: string,
  ) {
    return this.b.event(id, b.tur, ip);
  }
}

/**
 * Konsol › Görünüm › Banner ve vitrin. Taslak öneri düzeyiyle hazırlanır (ajan dahil); yayın, durdurma ve vitrin ayarı
 * görünüm yetkisi "tam" ister.
 */
@Controller('staff/banners')
@UseGuards(StaffGuard)
export class ContentStaffController {
  constructor(private readonly b: BannerService) {}

  @Get()
  @RequirePermission('gorunum.duzenle', 'oneri')
  list() {
    return this.b.list();
  }

  @Post()
  @HttpCode(200)
  @RequirePermission('gorunum.duzenle', 'oneri')
  create(@Req() req: StaffRequest, @Body(new ZodPipe(bannerSchema)) b: z.output<typeof bannerSchema>) {
    return this.b.save(req.staff.staff.id, b);
  }

  @Put(':id')
  @RequirePermission('gorunum.duzenle', 'oneri')
  update(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(bannerSchema)) b: z.output<typeof bannerSchema>,
  ) {
    return this.b.save(req.staff.staff.id, b, id);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @RequirePermission('gorunum.duzenle')
  publish(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.b.publish(req.staff.staff.id, id, req.ip);
  }

  @Post(':id/stop')
  @HttpCode(200)
  @RequirePermission('gorunum.duzenle')
  stop(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.b.stop(req.staff.staff.id, id, req.ip);
  }

  @Post(':id/copy')
  @HttpCode(200)
  @RequirePermission('gorunum.duzenle', 'oneri')
  copy(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.b.copy(req.staff.staff.id, id);
  }

  @Delete(':id')
  @RequirePermission('gorunum.duzenle', 'oneri')
  remove(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.b.remove(req.staff.staff.id, id);
  }

  @Put('vitrin/editor')
  @RequirePermission('gorunum.duzenle')
  vitrinEditor(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(vitrinEditorSchema)) b: z.output<typeof vitrinEditorSchema>,
  ) {
    return this.b.setVitrinEditor(req.staff.staff.id, b.acik, req.ip);
  }
}

@Module({
  imports: [AuthModule, StaffModule],
  controllers: [ContentPublicController, ContentStaffController],
  providers: [BannerService, AuditService],
  exports: [BannerService],
})
export class ContentModule {}
