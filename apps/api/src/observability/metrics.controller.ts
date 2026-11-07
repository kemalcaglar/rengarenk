import { Controller, ForbiddenException, Get, Headers, Inject, Res } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { Metrics } from './metrics.js';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: Metrics,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get()
  async scrape(
    @Headers('authorization') auth: string | undefined,
    @Res() reply: { header(k: string, v: string): { send(b: string): void } },
  ) {
    if (this.env.METRICS_TOKEN && auth !== `Bearer ${this.env.METRICS_TOKEN}`) throw new ForbiddenException();
    reply
      .header('content-type', this.metrics.registry.contentType)
      .send(await this.metrics.registry.metrics());
  }
}
