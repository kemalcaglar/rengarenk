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
import { DemandService } from './demands/demand.service.js';
import { DemandsWorkerModule } from './demands/demands.module.js';
import { GalleriesWorkerModule } from './galleries/galleries.module.js';
import { GalleryService } from './galleries/gallery.service.js';
import { GalleryApplicationService } from './galleries/gallery-application.service.js';
import { OutboxService } from './outbox/outbox.service.js';
import { PortfolioWorkerModule } from './portfolio/portfolio.module.js';
import { PortfolioService } from './portfolio/portfolio.service.js';
import { QueueService } from './queue/queue.service.js';
import { DemandSearchService } from './search/demand-search.service.js';
import { StorageModule } from './storage/storage.service.js';

/**
 * Arka plan işçisi: API ile aynı kod tabanı, ayrı süreç (Teknik tasarım §2).
 * Outbox aktarıcısı, onaylanan isteklerin yürütülmesi (ör. kategori şemasının yayına alınması) ve süre dolumları. Eşleştirme ve bildirim
 * sonraki sprintlerde eklenir. İade yürütücü ayrı bir süreç olacak ve PayTR iade anahtarı yalnızca
 * orada bulunacak (kilit 2); bu işçi iade yürütmez.
 */
@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    ApprovalsModule,
    CatalogPipelineModule,
    CategoriesWorkerModule,
    DemandsWorkerModule,
    GalleriesWorkerModule,
    PortfolioWorkerModule,
  ],
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
const demands = app.get(DemandService);
const search = app.get(DemandSearchService);
const galleryApps = app.get(GalleryApplicationService);
const galleries = app.get(GalleryService);
const portfolio = app.get(PortfolioService);
await queue.start();

await queue.consume<{ approvalId: string }>('onay.onaylandi', 'onay-yurut', async ({ approvalId }) => {
  const r = await executor.execute(approvalId);
  log.log(`onay ${approvalId}: ${r}`);
});

// Galeri başvurusu (Karar 03): beş kontrol; hepsi geçerse ajan onaylar, değilse konsoldaki kuyruğa düşer
await queue.consume<{ applicationId: string }>(
  'galeri.basvuru_alindi',
  'galeri-kontrol',
  async ({ applicationId }) => {
    const r = await galleryApps.runChecks(applicationId);
    if (r) log.log(`galeri başvurusu ${applicationId}: ${r.hepsi ? 'ajan onayladı' : 'incelemeye düştü'}`);
  },
);

// EİDS (Karar 17): istek açılınca hemen sorulur; bekleyenler beş dakikada bir yeniden sorulur
await queue.consume<{ vehicleId: string }>('portfoy.eids_istendi', 'portfoy-eids', async ({ vehicleId }) => {
  await portfolio.processEids(vehicleId);
});

// Talep araması: talep olaylarında indeks güncellenir (Teknik tasarım §12)
for (const event of [
  'talep.yayinlandi',
  'talep.guncellendi',
  'talep.pasife_alindi',
  'talep.suresi_doldu',
  'talep.uzatildi',
  'talep.kapandi',
  'arac.bulundu',
]) {
  await queue.consume<{ demandId: string }>(event, `arama-${event.replace('.', '-')}`, ({ demandId }) =>
    search.sync(demandId),
  );
}
// Açılışta ve her gece indeks veritabanıyla eşitlenir (artakalan kayıt kalmaz)
const REINDEX_MS = 24 * 3600_000;
let lastReindex = 0;

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
      // Talep süreleri (Karar 10): dolanlar pasife düşer, 7/3/1 gün kala hatırlatma olayı
      const passive = await demands.expireDue();
      const reminded = await demands.remindDue();
      if (passive || reminded) log.log(`talepler: ${passive} süresi doldu, ${reminded} hatırlatma`);
      // Galeri denemesi (Karar 12.5): bitişe 7/3/1 gün kala ve bitince olay
      const eids = await portfolio.processEids();
      if (eids) log.log(`EİDS: ${eids} araç sonuçlandı`);
      const trials = await galleries.remindTrials();
      if (trials) log.log(`galeri denemesi: ${trials} hatırlatma`);
      // Yarım kalmış yönetim girişi adımları bir gün sonra silinir.
      await db.staffLoginChallenge.deleteMany({
        where: { expiresAt: { lt: new Date(Date.now() - 86_400_000) } },
      });
    } catch (err) {
      log.error(err);
    }
  }
  if (Date.now() - lastReindex > REINDEX_MS) {
    lastReindex = Date.now();
    await search
      .reindexAll()
      .then((n) => log.log(`arama indeksi yenilendi: ${n} talep`))
      .catch((err: Error) => log.error(`arama indeksi: ${err.message}`));
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
