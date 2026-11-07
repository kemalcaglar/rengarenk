import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { ApprovalService } from './approval.service.js';
import { ApprovalExecutor } from './approval-executor.js';

/** Onay motoru; uç noktaları yönetim modülündedir (StaffModule). İşçi de bu modülü kullanır. */
@Module({
  providers: [ApprovalService, ApprovalExecutor, AuditService, OutboxService],
  exports: [ApprovalService, ApprovalExecutor],
})
export class ApprovalsModule {}
