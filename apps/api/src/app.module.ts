import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EntitlementsModule } from './entitlements/entitlements.module.js';
import { HealthController } from './health/health.controller.js';
import { MeModule } from './me/me.module.js';
import { HttpMetricsInterceptor } from './observability/http-metrics.interceptor.js';
import { loggingModule } from './observability/logging.js';
import { MetricsController } from './observability/metrics.controller.js';
import { MetricsModule } from './observability/metrics.js';
import { RateLimitModule } from './ratelimit/ratelimit.module.js';
import { SmsModule } from './sms/sms.module.js';

@Module({
  imports: [
    loggingModule(),
    DatabaseModule,
    MetricsModule,
    RateLimitModule,
    SmsModule,
    AuthModule,
    MeModule,
    EntitlementsModule,
  ],
  controllers: [HealthController, MetricsController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor }],
})
export class AppModule {}
