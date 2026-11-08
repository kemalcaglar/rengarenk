import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DatabaseModule } from './database/database.module.js';
import { RefundExecutorModule } from './refunds/executor/refund-executor.module.js';
import { RefundExecutorService } from './refunds/executor/refund-executor.service.js';

/**
 * İade yürütücü süreci (Teknik tasarım §7, kilit 2). API ve işçiden ayrı kapsayıcıda çalışır; ödeme kuruluşunun iade
 * bilgileri (IADE_PAYTR_*) yalnızca bu sürecin ortam dosyasındadır. Sahibin onayladığı iadeleri 30 saniyede bir yürütür.
 * Başka hiçbir iş yapmaz.
 */
@Module({ imports: [DatabaseModule, RefundExecutorModule] })
class IadeYurutucuModule {}

const log = new Logger('iade-yurutucu');
if (process.env.IADE_YURUTUCU !== '1') {
  log.error('IADE_YURUTUCU=1 olmadan iade yürütücü başlamaz');
  process.exit(1);
}
const app = await NestFactory.createApplicationContext(IadeYurutucuModule);
app.enableShutdownHooks();
const yurutucu = app.get(RefundExecutorService);
let durdur = false;
process.on('SIGTERM', () => {
  durdur = true;
});
log.log('iade yürütücü çalışıyor');
while (!durdur) {
  const n = await yurutucu.runOnce().catch((e: Error) => {
    log.error(e.message);
    return 0;
  });
  if (n) log.log(`${n} iade işlendi`);
  await new Promise((r) => setTimeout(r, 30_000));
}
await app.close();
