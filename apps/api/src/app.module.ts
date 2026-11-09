import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AgentCoreModule, AgentModule } from './agent/agent.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CampaignsModule } from './campaigns/campaigns.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ConsentModule } from './consents/consent.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DemandsModule } from './demands/demands.module.js';
import { EntitlementsModule } from './entitlements/entitlements.module.js';
import { FlagsModule } from './flags/flags.module.js';
import { GalleriesModule } from './galleries/galleries.module.js';
import { HealthController } from './health/health.controller.js';
import { MatchingModule } from './matching/matching.module.js';
import { MeModule } from './me/me.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { ModerationModule } from './moderation/moderation.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { HttpMetricsInterceptor } from './observability/http-metrics.interceptor.js';
import { loggingModule } from './observability/logging.js';
import { MetricsController } from './observability/metrics.controller.js';
import { MetricsModule } from './observability/metrics.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PeopleModule } from './people/people.module.js';
import { PortfolioModule } from './portfolio/portfolio.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { PricingCoreModule } from './pricing/pricing.service.js';
import { PrivacyModule } from './privacy/privacy.module.js';
import { RateLimitModule } from './ratelimit/ratelimit.module.js';
import { RedisModule } from './redis/redis.module.js';
import { RefundsModule } from './refunds/refunds.module.js';
import { SmsModule } from './sms/sms.module.js';
import { StaffModule } from './staff/staff.module.js';
import { StaffAlertsModule } from './staff-alerts/staff-alerts.module.js';
import { StorageModule } from './storage/storage.service.js';
import { SupportModule } from './support/support.module.js';
import { TrustModule } from './trust/trust.module.js';

@Module({
  imports: [
    loggingModule(),
    DatabaseModule,
    AgentCoreModule,
    AgentModule,
    MetricsModule,
    RateLimitModule,
    RedisModule,
    SmsModule,
    AuthModule,
    MeModule,
    EntitlementsModule,
    StaffModule,
    StaffAlertsModule,
    FlagsModule,
    GalleriesModule,
    PortfolioModule,
    MatchingModule,
    MessagesModule,
    ModerationModule,
    PeopleModule,
    SupportModule,
    PrivacyModule,
    TrustModule,
    PaymentsModule,
    RefundsModule,
    NotificationsModule,
    StorageModule,
    ConsentModule,
    CatalogModule,
    CategoriesModule,
    DemandsModule,
    PricingCoreModule,
    PricingModule,
    DashboardModule,
    CampaignsModule,
  ],
  controllers: [HealthController, MetricsController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor }],
})
export class AppModule {}
