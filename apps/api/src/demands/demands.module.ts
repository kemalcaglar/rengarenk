import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { EntitlementsModule } from '../entitlements/entitlements.module.js';
import { FlagsModule } from '../flags/flags.module.js';
import { ModerationCoreModule, ModerationServiceModule } from '../moderation/moderation.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { SearchModule } from '../search/search.module.js';
import { DemandsController, PublicDemandsController } from './demand.controller.js';
import { DemandService } from './demand.service.js';
import { DemandAssistant } from './demand-assistant.js';
import { FavoritesController, SavedSearchesController } from './favorites.controller.js';
import { FavoritesService } from './favorites.service.js';

/** Talepler (Aşama 3). */
@Module({
  imports: [
    AuthModule,
    EntitlementsModule,
    SearchModule,
    ModerationCoreModule,
    ModerationServiceModule,
    FlagsModule,
  ],
  controllers: [DemandsController, PublicDemandsController, FavoritesController, SavedSearchesController],
  providers: [DemandService, DemandAssistant, FavoritesService, AuditService, OutboxService],
  exports: [DemandService],
})
export class DemandsModule {}

/** İşçi için: süre dolumu ve hatırlatmalar. */
@Module({
  imports: [EntitlementsModule, SearchModule, ModerationCoreModule, ModerationServiceModule],
  providers: [DemandService, AuditService, OutboxService],
  exports: [DemandService, SearchModule],
})
export class DemandsWorkerModule {}
