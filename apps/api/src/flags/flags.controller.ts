import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  FLAG_PLATFORMS,
  type FlagPlatform,
  flagUpdateSchema,
  maintenanceUpdateSchema,
} from '@rengarenk/shared';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { FeatureFlagService } from './feature-flag.service.js';

/**
 * İstemcilerin (web, mobil) kendi durumunu öğrendiği uç: açık anahtarlar, bakımdaki alanlar ve duyuru.
 * Giriş zorunlu değildir; jeton varsa kişiye göre (deneme kullanıcısı, kurumsal, yüzde dilimi) değerlendirilir.
 * Platform `x-rr-platform` başlığıyla bildirilir (WEB, IOS, ANDROID).
 */
@Controller('flags')
export class FlagsController {
  constructor(
    private readonly flags: FeatureFlagService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async get(@Headers('authorization') authorization?: string, @Headers('x-rr-platform') platform?: string) {
    let userId: string | undefined;
    if (authorization?.startsWith('Bearer ')) {
      userId = await this.auth
        .verifyAccess(authorization.slice(7))
        .then((c) => c.sub)
        .catch(() => undefined);
    }
    const p = platform?.toUpperCase();
    return this.flags.forClient({
      userId,
      platform: FLAG_PLATFORMS.includes(p as FlagPlatform) ? (p as FlagPlatform) : undefined,
    });
  }
}

const testerSchema = z.object({ phone: z.string().min(10).max(20) }).strict();

/** Yönetim: özellik anahtarları ve bakım modu (yetki: "Bakım modu ve özellik anahtarları"). */
@Controller('staff/flags')
@UseGuards(StaffGuard)
export class StaffFlagsController {
  constructor(private readonly flags: FeatureFlagService) {}

  @Get()
  @RequirePermission('sistem.ayarla')
  list() {
    return this.flags.list();
  }

  @Patch(':key')
  @RequirePermission('sistem.ayarla')
  update(
    @Req() req: StaffRequest,
    @Param('key') key: string,
    @Body(new ZodPipe(flagUpdateSchema)) body: z.output<typeof flagUpdateSchema>,
  ) {
    return this.flags.update(req.staff, key, body, req.ip);
  }

  @Put('bakim/:area')
  @RequirePermission('sistem.ayarla')
  maintenance(
    @Req() req: StaffRequest,
    @Param('area') area: string,
    @Body(new ZodPipe(maintenanceUpdateSchema)) body: z.output<typeof maintenanceUpdateSchema>,
  ) {
    return this.flags.setMaintenance(req.staff, area, body, req.ip);
  }

  @Get('testers')
  @RequirePermission('sistem.ayarla')
  testers() {
    return this.flags.testers();
  }

  @Post('testers')
  @HttpCode(204)
  @RequirePermission('sistem.ayarla')
  async addTester(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(testerSchema)) body: z.output<typeof testerSchema>,
  ) {
    await this.flags.addTester(req.staff, body.phone, req.ip);
  }

  @Delete('testers/:userId')
  @HttpCode(204)
  @RequirePermission('sistem.ayarla')
  async removeTester(@Req() req: StaffRequest, @Param('userId', new ParseUUIDPipe()) userId: string) {
    await this.flags.removeTester(req.staff, userId, req.ip);
  }
}
