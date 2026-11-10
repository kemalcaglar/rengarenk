import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { StaffModule } from '../staff/staff.module.js';
import { MeLegalController, StaffLegalController } from './legal.controller.js';
import { LegalService } from './legal.service.js';

/** Yasal metinlerin konsoldan yayını ve yeniden onay (Karar 46, 59). Onaylanan sürümü işçi yayına alır. */
@Module({
  imports: [ApprovalsModule, StaffModule, AuthModule],
  controllers: [StaffLegalController, MeLegalController],
  providers: [LegalService, AuditService, OutboxService],
  exports: [LegalService],
})
export class LegalModule {}

/** İşçi için: uçlar olmadan, yalnızca onaylanan sürümün yayına alınması */
@Module({
  imports: [ApprovalsModule],
  providers: [LegalService, AuditService, OutboxService],
})
export class LegalWorkerModule {}
