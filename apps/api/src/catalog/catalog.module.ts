import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { StaffModule } from '../staff/staff.module.js';
import { CatalogController, StaffCatalogController } from './catalog.controller.js';
import { CatalogImportService } from './catalog-import.service.js';
import { CATALOG_KEYS, loadCatalogKeys } from './catalog-keys.js';
import { CatalogPipelineService } from './catalog-pipeline.service.js';
import { createTsbClient, TSB_CLIENT } from './tsb-client.js';

const providers = [
  CatalogImportService,
  CatalogPipelineService,
  AuditService,
  OutboxService,
  { provide: CATALOG_KEYS, inject: [ENV], useFactory: loadCatalogKeys },
  { provide: TSB_CLIENT, inject: [ENV], useFactory: (env: Env) => createTsbClient(env) },
];

/** Araç kataloğu: okuma uçları, konsoldan izleme ve katalog hattı (Aşama 2). */
@Module({
  imports: [StaffModule],
  controllers: [CatalogController, StaffCatalogController],
  providers,
  exports: [CatalogPipelineService],
})
export class CatalogModule {}

/** İşçi için: uçlar olmadan yalnızca hat (otomatik TSB kontrolü). */
@Module({ providers, exports: [CatalogPipelineService] })
export class CatalogPipelineModule {}
