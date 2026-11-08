import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ConsentModule } from './consents/consent.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DemandsModule } from './demands/demands.module.js';
import { EntitlementsModule } from './entitlements/entitlements.module.js';
import { FlagsModule } from './flags/flags.module.js';
import { GalleriesModule } from './galleries/galleries.module.js';
import { HealthController } from './health/health.controller.js';
import { MatchingModule } from './matching/matching.module.js';
import { MeModule } from './me/me.module.js';
import { HttpMetricsInterceptor } from './observability/http-metrics.interceptor.js';
import { loggingModule } from './observability/logging.js';
import { MetricsController } from './observability/metrics.controller.js';
import { MetricsModule } from './observability/metrics.js';
import { PortfolioModule } from './portfolio/portfolio.module.js';
import { RateLimitModule } from './ratelimit/ratelimit.module.js';
import { RedisModule } from './redis/redis.module.js';
import { SmsModule } from './sms/sms.module.js';
import { StaffModule } from './staff/staff.module.js';
import { StorageModule } from './storage/storage.service.js';

@Module({
  imports: [
    loggingModule(),
    DatabaseModule,
    MetricsModule,
    RateLimitModule,
    RedisModule,
    SmsModule,
    AuthModule,
    MeModule,
    EntitlementsModule,
    StaffModule,
    FlagsModule,
    GalleriesModule,
    PortfolioModule,
    MatchingModule,
    StorageModule,
    ConsentModule,
    CatalogModule,
    CategoriesModule,
    DemandsModule,
  ],
  controllers: [HealthController, MetricsController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor }],
})
export class AppModule {}
