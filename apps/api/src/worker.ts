import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DatabaseModule } from './database/database.module.js';
import { OutboxService } from './outbox/outbox.service.js';
import { QueueService } from './queue/queue.service.js';

/**
 * Arka plan işçisi: API ile aynı kod tabanı, ayrı süreç (Teknik tasarım §2).
 * Şimdilik outbox aktarıcısını çalıştırır; eşleştirme, bildirim ve iade yürütücü sonraki sprintlerde eklenir.
 * İade yürütücü ayrı bir süreç olacak ve PayTR iade anahtarı yalnızca orada bulunacak (kilit 2).
 */
@Module({ imports: [DatabaseModule], providers: [OutboxService, QueueService] })
class WorkerModule {}

const log = new Logger('worker');
const app = await NestFactory.createApplicationContext(WorkerModule);
app.enableShutdownHooks();
const outbox = app.get(OutboxService);
const queue = app.get(QueueService);
await queue.start();

let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});

log.log('outbox aktarıcısı çalışıyor');
while (!stopping) {
  const sent = await outbox.relayBatch((type, payload) => queue.publish(type, payload as object));
  if (sent === 0) await new Promise((r) => setTimeout(r, 500));
}
await app.close();
