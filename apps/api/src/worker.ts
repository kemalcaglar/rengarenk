import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApprovalService } from './approvals/approval.service.js';
import { ApprovalExecutor } from './approvals/approval-executor.js';
import { CatalogPipelineService } from './catalog/catalog-pipeline.service.js';
import { type Db, PRISMA } from './database/prisma.js';
import { DemandService } from './demands/demand.service.js';
import { GalleryService } from './galleries/gallery.service.js';
import { GalleryApplicationService } from './galleries/gallery-application.service.js';
import { MatchingService } from './matching/matching.service.js';
import { ModerationService } from './moderation/moderation.service.js';
import { AutomationService } from './notifications/automations.js';
import { CommercialService, IYS, type IysProvider } from './notifications/commercial.js';
import { DeliveryService } from './notifications/delivery.service.js';
import { NOTIFY_EVENTS, NotificationEvents } from './notifications/notification-events.js';
import { ReputationService } from './notifications/reputation.js';
import { OutboxService } from './outbox/outbox.service.js';
import { OrdersService } from './payments/orders.service.js';
import { SubscriptionsService } from './payments/subscriptions.service.js';
import { PortfolioService } from './portfolio/portfolio.service.js';
import { PrivacyService } from './privacy/privacy.service.js';
import { QueueService } from './queue/queue.service.js';
import { DemandSearchService } from './search/demand-search.service.js';
import { SupportService } from './support/support.service.js';
import { TrustService } from './trust/trust.service.js';
import { WorkerModule } from './worker.module.js';

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
const matching = app.get(MatchingService);
const trust = app.get(TrustService);
const orders = app.get(OrdersService);
const subscriptions = app.get(SubscriptionsService);
const bildirimOlaylari = app.get(NotificationEvents);
const teslim = app.get(DeliveryService);
const ticari = app.get(CommercialService);
const akislar = app.get(AutomationService);
const moderasyon = app.get(ModerationService);
const itibar = app.get(ReputationService);
const destek = app.get(SupportService);
const gizlilik = app.get(PrivacyService);
const iys = app.get<IysProvider>(IYS);
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
// Eşleştirme (Teknik tasarım §6): talep ve araç olaylarında yeniden skorlanır
for (const event of [
  'talep.yayinlandi',
  'talep.guncellendi',
  'talep.pasife_alindi',
  'talep.suresi_doldu',
  'talep.uzatildi',
  'talep.kapandi',
  'arac.bulundu',
]) {
  await queue.consume<{ demandId: string }>(event, `eslesme-${event.replace('.', '-')}`, ({ demandId }) =>
    matching.onDemand(demandId),
  );
}
for (const event of ['portfoy.yayinlandi', 'portfoy.guncellendi', 'portfoy.kalkti']) {
  await queue.consume<{ vehicleId: string }>(event, `eslesme-${event.replace('.', '-')}`, ({ vehicleId }) =>
    matching.onVehicle(vehicleId),
  );
}
// Ödeme alındı: e-Arşiv fatura (Karar 12.7); başarısızsa beş dakikada bir yeniden denenir
await queue.consume<{ orderId: string }>('odeme.alindi', 'odeme-fatura', ({ orderId }) =>
  orders.issueInvoice(orderId),
);
// Ajan (Karar 41): satıcı mesajında açık kapora ve ödeme isteği varsa mesajı gizler, 24 saat askı, karar insana
await queue.consume<{ messageId?: string }>('mesaj.uyari', 'moderasyon-ajan', async ({ messageId }) => {
  if (!messageId) return;
  const r = await moderasyon.ajanMesajKontrolu(messageId);
  if (r !== 'islem_yok') log.log(`ajan mesaj kontrolü: ${r}`);
});
// KVKK (Karar 58): veri kopyası hazırlanır, hazır olunca bildirim gider
await queue.consume<{ exportId: string }>('veri.indirme_istendi', 'veri-indirme', async ({ exportId }) => {
  log.log(`veri kopyası ${exportId}: ${await gizlilik.buildExport(exportId)}`);
});
// Bildirim katmanı (Karar 48): olaylar alıcı ve şablona çevrilir; teslimleri döngü gönderir
for (const event of NOTIFY_EVENTS) {
  await queue.consume<Record<string, unknown>>(event, `bildirim-${event.replace('.', '-')}`, (payload) =>
    bildirimOlaylari.handle(event, payload),
  );
}
// Ticari ileti onayı değişti: İYS'ye bildirilir (bağlantı yoksa rıza kaydında bekler)
await queue.consume<{ userId: string; onay: boolean }>('iys.izin_degisti', 'iys-esitle', ({ userId, onay }) =>
  ticari.iysEsitle(iys, userId, onay),
);
// İade yürütüldü (iade yürütücü süreci): iade faturası kesilir; entegratör yoksa kuyrukta bekler
await queue.consume<{ refundId: string }>('iade.yurutuldu', 'iade-fatura', ({ refundId }) =>
  orders.issueRefundInvoice(refundId),
);
// Abonelik kartı kaydedildi: kartın gösterim adı ödeme kuruluşundan alınır
await queue.consume<{ accountId: string }>('abonelik.kart_kaydedildi', 'abonelik-kart', ({ accountId }) =>
  subscriptions.refreshCard(accountId),
);
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
const TESLIM_MS = 5_000;
let lastTeslim = 0;
const ITIBAR_MS = 3_600_000;
let lastItibar = 0;
let sonOzetGunu = '';
let sonAkisGunu = '';

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
      // Ödemeler: bekleyen e-Arşiv faturaları yeniden denenir, süresi geçen ödenmemiş siparişler iptal sayılır
      const od = await orders.housekeeping();
      if (od.iptal) log.log(`ödemeler: ${od.iptal} sipariş süresi doldu`);
      if (od.sessiz) log.warn(`ödemeler: ${od.sessiz} otomatik çekimin bildirimi gelmedi`);
      // Galeri abonelikleri (Karar 12.2, 12.7): dönem sonu yenileme ve yeniden deneme, hatırlatma, aylık hak döngüsü
      const ab = await subscriptions.renewDue();
      const abHat = await subscriptions.remindDue();
      const abDongu = await subscriptions.cycleDue();
      if (ab.yenilenen || ab.biten || ab.basarisiz || abHat || abDongu) {
        log.log(
          `abonelikler: ${ab.yenilenen} yenileme, ${ab.basarisiz} başarısız, ${ab.biten} bitti, ${abHat} hatırlatma, ${abDongu} hak döngüsü`,
        );
      }
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
    await matching
      .rebuildAll()
      .then((r) => log.log(`eşleştirme yenilendi: ${r.arac} araç, ${r.talep} talep`))
      .catch((err: Error) => log.error(`eşleştirme: ${err.message}`));
    // Satıcı göstergeleri ve rozetler her gece (Karar 55); takip edilen galerilerin günlük özeti (Karar 28)
    await trust
      .recomputeAll()
      .then((n) => log.log(`satıcı göstergeleri yenilendi: ${n} hesap`))
      .catch((err: Error) => log.error(`satıcı göstergeleri: ${err.message}`));
    await trust
      .followDigest()
      .then((n) => log.log(`takip özeti: ${n} kişi`))
      .catch((err: Error) => log.error(`takip özeti: ${err.message}`));
  }
  if (Date.now() - lastCatalogCheck > CATALOG_CHECK_MS) {
    lastCatalogCheck = Date.now();
    for (const key of ['tsb', 'vmm', 'yerli', 'wikidata', 'vehiclesdb', 'commons']) {
      const r = await catalog.checkSource(key, {}).catch((err: Error) => ({ durum: `hata: ${err.message}` }));
      if (r.durum !== 'kapali' && r.durum !== 'yeni_dosya_yok') log.log(`${key} kontrolü: ${r.durum}`);
    }
    await catalog.reportStaleSources().catch((err: Error) => log.error(err));
  }
  // Teslim: zamanı gelen push, e-posta ve SMS (gecikmeli e-posta, ticari iletide sessiz saat)
  if (Date.now() - lastTeslim > TESLIM_MS) {
    lastTeslim = Date.now();
    await teslim.dispatchDue().catch((err: Error) => log.error(`teslim: ${err.message}`));
  }
  // E-posta itibarı: sınır aşılırsa ticari e-posta kendiliğinden durur (saatte bir)
  if (Date.now() - lastItibar > ITIBAR_MS) {
    lastItibar = Date.now();
    await itibar.denetle().catch((err: Error) => log.error(`itibar: ${err.message}`));
    // Destek: çözümden 24 saat sonra memnuniyet sorusu (Karar 54)
    await destek
      .askRatings()
      .then((n) => n && log.log(`destek memnuniyet sorusu: ${n}`))
      .catch((err: Error) => log.error(`destek memnuniyet: ${err.message}`));
  }
  // Kayıtlı aramaların günlük özeti: İstanbul saatiyle 09.00'dan sonra günde bir (Karar 30)
  const trSaat = new Date(Date.now() + 3 * 3600_000);
  const gun = trSaat.toISOString().slice(0, 10);
  if (trSaat.getUTCHours() >= 9 && sonOzetGunu !== gun) {
    sonOzetGunu = gun;
    await bildirimOlaylari
      .dailyDigest()
      .then((n) => n && log.log(`kayıtlı arama özeti: ${n} kişi`))
      .catch((err: Error) => log.error(`kayıtlı arama özeti: ${err.message}`));
  }
  // Zamanlı akışlar (Karar 51): İstanbul saatiyle 09.30'dan sonra günde bir
  if (
    (trSaat.getUTCHours() > 9 || (trSaat.getUTCHours() === 9 && trSaat.getUTCMinutes() >= 30)) &&
    sonAkisGunu !== gun
  ) {
    sonAkisGunu = gun;
    await akislar
      .runDaily()
      .then((r) => log.log(`otomatik akışlar: ${JSON.stringify(r)}`))
      .catch((err: Error) => log.error(`otomatik akışlar: ${err.message}`));
  }
  if (sent === 0) await new Promise((r) => setTimeout(r, 500));
}
await app.close();
