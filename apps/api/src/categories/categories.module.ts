import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { AuditService } from '../audit/audit.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { StaffModule } from '../staff/staff.module.js';
import { CategoriesController, StaffCategoriesController } from './category.controller.js';
import { CategoryService } from './category.service.js';

/** Kategori ağacı ve sürümlü şema (Karar 45). Onaylanan sürümü yayına alan işlev onay yürütücüsüne kayıtlıdır. */
@Module({
  imports: [ApprovalsModule, StaffModule],
  controllers: [CategoriesController, StaffCategoriesController],
  providers: [CategoryService, AuditService, OutboxService],
  exports: [CategoryService],
})
export class CategoriesModule {}

/** İşçi için: uçlar olmadan, yalnızca onaylanan sürümün yayına alınması. */
@Module({
  imports: [ApprovalsModule],
  providers: [CategoryService, AuditService, OutboxService],
})
export class CategoriesWorkerModule {}
