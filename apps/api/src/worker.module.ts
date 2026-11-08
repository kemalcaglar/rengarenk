import { Module } from '@nestjs/common';
import { ApprovalsModule } from './approvals/approvals.module.js';
import { CatalogPipelineModule } from './catalog/catalog.module.js';
import { CategoriesWorkerModule } from './categories/categories.module.js';
import { ConsentModule } from './consents/consent.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DemandsWorkerModule } from './demands/demands.module.js';
import { GalleriesWorkerModule } from './galleries/galleries.module.js';
import { MatchingWorkerModule } from './matching/matching.module.js';
import { ModerationServiceModule } from './moderation/moderation.module.js';
import { NotificationsWorkerModule } from './notifications/notifications.module.js';
import { MetricsModule } from './observability/metrics.js';
import { OutboxService } from './outbox/outbox.service.js';
import { PaymentsWorkerModule } from './payments/payments.module.js';
import { PortfolioWorkerModule } from './portfolio/portfolio.module.js';
import { QueueService } from './queue/queue.service.js';
import { RateLimitModule } from './ratelimit/ratelimit.module.js';
import { RedisModule } from './redis/redis.module.js';
import { SmsModule } from './sms/sms.module.js';
import { StorageModule } from './storage/storage.service.js';
import { TrustWorkerModule } from './trust/trust.module.js';

/**
 * Arka plan işçisi: API ile aynı kod tabanı, ayrı süreç (Teknik tasarım §2).
 * Outbox aktarıcısı, onaylanan isteklerin yürütülmesi (ör. kategori şemasının yayına alınması), süre dolumları ve
 * eşleştirme, bildirim katmanı (olay eşlemesi ve teslim). İade yürütücü ayrı süreçtir (`refund-executor.ts`, kilit 2);
 * bu işçi iade yürütmez. Bağımlılıkların eksiksiz olduğunu `test/worker-module.test.ts` denetler.
 */
@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    MetricsModule,
    RateLimitModule,
    ConsentModule,
    StorageModule,
    ApprovalsModule,
    CatalogPipelineModule,
    CategoriesWorkerModule,
    DemandsWorkerModule,
    GalleriesWorkerModule,
    PortfolioWorkerModule,
    MatchingWorkerModule,
    TrustWorkerModule,
    PaymentsWorkerModule,
    SmsModule,
    NotificationsWorkerModule,
    ModerationServiceModule,
  ],
  providers: [OutboxService, QueueService],
})
export class WorkerModule {}
