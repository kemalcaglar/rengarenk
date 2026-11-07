import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  Post,
} from '@nestjs/common';
import { cookieConsentSchema } from '@rengarenk/shared';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe.js';
import { RateLimiter } from '../ratelimit/rate-limiter.js';
import { ConsentService, channelOf, LEGAL_KEYS } from './consent.service.js';

const keySchema = z.enum(LEGAL_KEYS);
const visitorSchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, 'Ziyaretçi kimliği geçersiz');

/**
 * Yasal metinler (herkese açık; Karar 46 sürümlü) ve çerez tercihi kaydı. Üyelik onayları giriş akışında
 * (auth) kaydedilir.
 */
@Controller()
export class ConsentController {
  constructor(
    private readonly consents: ConsentService,
    private readonly limiter: RateLimiter,
  ) {}

  @Get('legal/:key')
  text(@Param('key', new ZodPipe(keySchema)) key: string) {
    return this.consents.publicText(key);
  }

  /** Çerez paneli: ziyaretçi kimliğiyle (web sunucusu httpOnly çerezde tutar). Kişisel veri istemez. */
  @Post('consents/cookie')
  @HttpCode(204)
  async cookie(
    @Body(new ZodPipe(cookieConsentSchema)) body: z.output<typeof cookieConsentSchema>,
    @Headers('x-rr-ziyaretci') visitor: string | undefined,
    @Headers('x-rr-platform') platform: string | undefined,
    @Ip() ip: string,
  ) {
    await this.limiter.hit(`cerez:ip:${ip}`, 30, 3600);
    const v = visitorSchema.safeParse(visitor);
    if (!v.success) throw new BadRequestException('Ziyaretçi kimliği geçersiz');
    await this.consents.recordCookie({ visitorId: v.data }, body, channelOf(platform), ip);
  }
}
