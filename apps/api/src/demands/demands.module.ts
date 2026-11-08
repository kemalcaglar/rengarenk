import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { EntitlementsModule } from '../entitlements/entitlements.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { DemandsController, PublicDemandsController } from './demand.controller.js';
import { DemandService } from './demand.service.js';

/** Talepler (Aşama 3). */
@Module({
  imports: [AuthModule, EntitlementsModule],
  controllers: [DemandsController, PublicDemandsController],
  providers: [DemandService, AuditService, OutboxService],
  exports: [DemandService],
})
export class DemandsModule {}

/** İşçi için: süre dolumu ve hatırlatmalar. */
@Module({
  imports: [EntitlementsModule],
  providers: [DemandService, AuditService, OutboxService],
  exports: [DemandService],
})
export class DemandsWorkerModule {}
