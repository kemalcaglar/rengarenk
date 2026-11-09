import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  FLAG_PLATFORMS,
  type FlagPlatform,
  flagUpdateSchema,
  maintenanceUpdateSchema,
  uiExperimentEventSchema,
} from '@rengarenk/shared';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { FeatureFlagService } from './feature-flag.service.js';
import { uiDeneyOlayi, uiDeneySonuc } from './ui-experiments.js';

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
    @Inject(PRISMA) private readonly db: Db,
  ) {}

  /**
   * Arayüz deneyi olayı (Karar 44): üye adımı gördü ya da geçti. Kol sunucuda kimlikten hesaplanır; açık deney
   * yoksa yok sayılır. Kişi başına tek satır.
   */
  @Post('deney/:key')
  @HttpCode(204)
  async deneyOlayi(
    @Param('key') key: string,
    @Body(new ZodPipe(uiExperimentEventSchema)) body: z.output<typeof uiExperimentEventSchema>,
    @Headers('authorization') authorization?: string,
    @Headers('x-rr-platform') platform?: string,
  ) {
    const userId = authorization?.startsWith('Bearer ')
      ? await this.auth
          .verifyAccess(authorization.slice(7))
          .then((c) => c.sub)
          .catch(() => undefined)
      : undefined;
    if (!userId) throw new UnauthorizedException('Giriş gerekli');
    await uiDeneyOlayi(this.db, key, userId, body.tur, platform);
  }

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
  constructor(
    private readonly flags: FeatureFlagService,
    @Inject(PRISMA) private readonly db: Db,
  ) {}

  /**
   * Arayüz deneyinin kazananı (Raporlar › Deneyler): B herkese açılır (yüzde 100) ya da A'da kalınır (anahtar kapanır).
   * Yalnızca sonuç hazırken ve kazanan kolla; dönem anahtar değişikliğiyle aynı işlemde kapanır.
   */
  @Post(':key/deney/:kol')
  @HttpCode(200)
  @RequirePermission('sistem.ayarla')
  async deneyKazanan(@Req() req: StaffRequest, @Param('key') key: string, @Param('kol') kol: string) {
    const run = await this.db.uiExperimentRun.findFirst({ where: { flagKey: key, endedAt: null } });
    if (!run) throw new ConflictException('Bu anahtarda süren deney yok');
    const r = await uiDeneySonuc(this.db, run.id);
    if (!r.kazanan || r.kazanan !== kol) throw new ConflictException('Sonuç henüz bu kolu göstermiyor');
    return this.flags.update(
      req.staff,
      key,
      kol === 'B' ? { enabled: true, percent: 100 } : { enabled: false },
      req.ip,
    );
  }

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
