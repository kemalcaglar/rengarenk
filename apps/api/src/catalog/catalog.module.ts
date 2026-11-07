import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { StaffModule } from '../staff/staff.module.js';
import { CatalogController, StaffCatalogController } from './catalog.controller.js';
import { CatalogAliasService } from './catalog-alias.service.js';
import { CatalogImageService } from './catalog-image.service.js';
import { CatalogImportService } from './catalog-import.service.js';
import { CATALOG_KEYS, loadCatalogKeys } from './catalog-keys.js';
import { CatalogPipelineService } from './catalog-pipeline.service.js';
import { COMMONS_CLIENT, HttpCommonsClient } from './commons-client.js';
import { createTsbClient, TSB_CLIENT } from './tsb-client.js';
import { HttpVehiclesDbClient, VEHICLESDB_CLIENT } from './vehiclesdb-client.js';
import { HttpVmmClient, VMM_CLIENT } from './vmm-client.js';
import { HttpWikidataClient, WIKIDATA_CLIENT } from './wikidata-client.js';

const providers = [
  CatalogImportService,
  CatalogAliasService,
  CatalogImageService,
  CatalogPipelineService,
  AuditService,
  OutboxService,
  { provide: CATALOG_KEYS, inject: [ENV], useFactory: loadCatalogKeys },
  { provide: TSB_CLIENT, inject: [ENV], useFactory: (env: Env) => createTsbClient(env) },
  { provide: VMM_CLIENT, useFactory: () => new HttpVmmClient() },
  { provide: WIKIDATA_CLIENT, useFactory: () => new HttpWikidataClient() },
  { provide: VEHICLESDB_CLIENT, useFactory: () => new HttpVehiclesDbClient() },
  { provide: COMMONS_CLIENT, useFactory: () => new HttpCommonsClient() },
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
