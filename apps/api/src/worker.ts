import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApprovalService } from './approvals/approval.service.js';
import { ApprovalExecutor } from './approvals/approval-executor.js';
import { ApprovalsModule } from './approvals/approvals.module.js';
import { CatalogPipelineModule } from './catalog/catalog.module.js';
import { CatalogPipelineService } from './catalog/catalog-pipeline.service.js';
import { CategoriesWorkerModule } from './categories/categories.module.js';
import { DatabaseModule } from './database/database.module.js';
import { type Db, PRISMA } from './database/prisma.js';
import { OutboxService } from './outbox/outbox.service.js';
import { QueueService } from './queue/queue.service.js';
import { StorageModule } from './storage/storage.service.js';

/**
 * Arka plan işçisi: API ile aynı kod tabanı, ayrı süreç (Teknik tasarım §2).
 * Outbox aktarıcısı, onaylanan isteklerin yürütülmesi (ör. kategori şemasının yayına alınması) ve süre dolumları. Eşleştirme ve bildirim
 * sonraki sprintlerde eklenir. İade yürütücü ayrı bir süreç olacak ve PayTR iade anahtarı yalnızca
 * orada bulunacak (kilit 2); bu işçi iade yürütmez.
 */
@Module({
  imports: [DatabaseModule, StorageModule, ApprovalsModule, CatalogPipelineModule, CategoriesWorkerModule],
  providers: [OutboxService, QueueService],
})
class WorkerModule {}

const log = new Logger('worker');
const app = await NestFactory.createApplicationContext(WorkerModule);
app.enableShutdownHooks();
const outbox = app.get(OutboxService);
const queue = app.get(QueueService);
const approvals = app.get(ApprovalService);
const executor = app.get(ApprovalExecutor);
const db = app.get<Db>(PRISMA);
const catalog = app.get(CatalogPipelineService);
await queue.start();

await queue.consume<{ approvalId: string }>('onay.onaylandi', 'onay-yurut', async ({ approvalId }) => {
  const r = await executor.execute(approvalId);
  log.log(`onay ${approvalId}: ${r}`);
});

let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});

const HOUSEKEEPING_MS = 5 * 60_000;
let lastHousekeeping = 0;
/** TSB ayda birkaç kez (revizyonlarla) dosya yayımlar; 6 saatte bir bakılır. Otomatik çekme konsoldan açılır. */
const CATALOG_CHECK_MS = 6 * 3600_000;
let lastCatalogCheck = 0;

log.log('outbox aktarıcısı çalışıyor');
while (!stopping) {
  const sent = await outbox.relayBatch((type, payload) => queue.publish(type, payload as object));
  if (Date.now() - lastHousekeeping > HOUSEKEEPING_MS) {
    lastHousekeeping = Date.now();
    try {
      const expired = await approvals.expireDue();
      if (expired) log.log(`${expired} onay isteğinin süresi doldu`);
      // Yarım kalmış yönetim girişi adımları bir gün sonra silinir.
      await db.staffLoginChallenge.deleteMany({
        where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } },
      });
    } catch (err) {
      log.error(err);
    }
  }
  if (Date.now() - lastCatalogCheck > CATALOG_CHECK_MS) {
    lastCatalogCheck = Date.now();
    for (const key of ['tsb', 'vmm', 'yerli', 'wikidata', 'vehiclesdb', 'commons']) {
      const r = await catalog.checkSource(key, {}).catch((err: Error) => ({ durum: `hata: ${err.message}` }));
      if (r.durum !== 'kapali' && r.durum !== 'yeni_dosya_yok') log.log(`${key} kontrolü: ${r.durum}`);
    }
    await catalog.reportStaleSources().catch((err: Error) => log.error(err));
  }
  if (sent === 0) await new Promise((r) => setTimeout(r, 500));
}
await app.close();
