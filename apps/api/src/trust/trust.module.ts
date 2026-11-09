import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { StaffModule } from '../staff/staff.module.js';
import { RatingAppealService } from './rating-appeal.service.js';
import { StaffTrustController, TrustController } from './trust.controller.js';
import { TrustService } from './trust.service.js';

/** Güven (Aşama 5): yıldız, satıcı göstergeleri ve rozetler, galeri takibi. */
@Module({
  imports: [AuthModule, StaffModule],
  controllers: [TrustController, StaffTrustController],
  providers: [TrustService, RatingAppealService, AuditService, OutboxService],
  exports: [TrustService],
})
export class TrustModule {}

/** İşçi için: gecelik göstergeler ve takip özeti. */
@Module({ providers: [TrustService, OutboxService], exports: [TrustService] })
export class TrustWorkerModule {}
