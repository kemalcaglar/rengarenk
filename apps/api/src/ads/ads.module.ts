import {
  Body,
  Controller,
  Get,
  Global,
  Headers,
  HttpCode,
  Module,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { touchReportSchema } from '@rengarenk/shared';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { type AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { channelOf } from '../consents/consent.service.js';
import { RateLimiter } from '../ratelimit/rate-limiter.js';
import { AdNetworkFactory } from './ad-networks.js';
import { AdsService } from './ads.service.js';

type AuthedRequest = { user: AccessClaims; ip: string; headers: Record<string, string | undefined> };
const ayarSchema = z.object({ acik: z.boolean() }).strict();

/** Üyenin teması ve reklam ölçümü onayı (Karar 35, 59) */
@Controller('me')
@UseGuards(AuthGuard)
export class AdsController {
  constructor(
    private readonly ads: AdsService,
    private readonly limiter: RateLimiter,
  ) {}

  /** Tarayıcıda saklanan ilk ve son temas (girişten sonra ve yeni temasta) */
  @Post('temas')
  @HttpCode(204)
  async temas(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(touchReportSchema)) body: z.output<typeof touchReportSchema>,
  ) {
    await this.limiter.hit(`temas:${req.user.sub}`, 30, 3600);
    await this.ads.temas(req.user.sub, body, req.ip, req.headers['user-agent']);
  }

  @Get('reklam-olcum')
  ayar(@Req() req: AuthedRequest) {
    return this.ads.ayarlar(req.user.sub);
  }

  @Put('reklam-olcum')
  degistir(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(ayarSchema)) body: z.output<typeof ayarSchema>,
    @Headers('x-rr-platform') platform?: string,
  ) {
    return this.ads.onayDegistir(req.user.sub, body.acik, channelOf(platform), req.ip);
  }
}

/** Olay yazımı her modülden (aynı veritabanı işleminde) kullanılır; işçi gönderir */
@Global()
@Module({ providers: [AdsService, AdNetworkFactory], exports: [AdsService] })
export class AdsCoreModule {}

@Module({ imports: [AuthModule], controllers: [AdsController] })
export class AdsModule {}
