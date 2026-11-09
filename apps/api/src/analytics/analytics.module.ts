import { Controller, Global, HttpCode, Module, Post, Req } from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';

type AnyRequest = { ip: string; headers: Record<string, string | string[] | undefined> };

/** Web analitiği: istemci her sayfa görüntülemesinde bildirir (gövde yok, çerez yok, giriş gerekmez) */
@Controller('analitik')
export class AnalyticsController {
  constructor(private readonly analitik: AnalyticsService) {}

  @Post('ziyaret')
  @HttpCode(204)
  async ziyaret(@Req() req: AnyRequest) {
    await this.analitik.ziyaret(req.ip, req.headers['user-agent'] as string | undefined);
  }
}

@Global()
@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
