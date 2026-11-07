import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditService } from '../audit/audit.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { StaffModule } from '../staff/staff.module.js';
import { FeatureFlagService } from './feature-flag.service.js';
import { FlagsController, StaffFlagsController } from './flags.controller.js';
import { MaintenanceGuard } from './maintenance.guard.js';

/** Özellik anahtarları ve bakım modu (T13). Diğer modüller FeatureFlagService ile anahtar sorar. */
@Module({
  imports: [AuthModule, StaffModule],
  controllers: [FlagsController, StaffFlagsController],
  providers: [
    FeatureFlagService,
    AuditService,
    OutboxService,
    { provide: APP_GUARD, useClass: MaintenanceGuard },
  ],
  exports: [FeatureFlagService],
})
export class FlagsModule {}
