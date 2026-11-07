import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { createIdentityProvider, IDENTITY_PROVIDER } from './identity.js';
import { SecretBox } from './secret-box.js';
import { StaffGuard } from './staff.guard.js';
import { StaffApprovalsController } from './staff-approvals.controller.js';
import { StaffAuditController } from './staff-audit.controller.js';
import { StaffAuthController, StaffMeController } from './staff-auth.controller.js';
import { StaffAuthService } from './staff-auth.service.js';
import { StaffMembersController } from './staff-members.controller.js';
import { StaffRolesController } from './staff-roles.controller.js';

/** Yönetim konsolunun API'si: giriş (T10), çalışanlar, roller ve yetkiler, onay kuyruğu, işlem kaydı (Karar 40). */
@Module({
  imports: [ApprovalsModule],
  controllers: [
    StaffAuthController,
    StaffMeController,
    StaffMembersController,
    StaffRolesController,
    StaffApprovalsController,
    StaffAuditController,
  ],
  providers: [
    StaffAuthService,
    StaffGuard,
    AuditService,
    OutboxService,
    { provide: IDENTITY_PROVIDER, inject: [ENV], useFactory: createIdentityProvider },
    { provide: SecretBox, inject: [ENV], useFactory: (env: Env) => SecretBox.fromEnv(env) },
  ],
  exports: [StaffAuthService, StaffGuard],
})
export class StaffModule {}
