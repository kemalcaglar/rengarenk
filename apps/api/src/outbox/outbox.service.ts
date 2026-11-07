import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@rengarenk/db';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';

/** Olay adları Teknik tasarım §12'deki listeden gelir. */
export type EventType =
  | 'kullanici.giris'
  | 'kullanici.kaydoldu'
  | 'talep.yayinlandi'
  | 'talep.suresi_doluyor'
  | 'odeme.alindi'
  | 'iade.onaylandi';

@Injectable()
export class OutboxService {
  private readonly log = new Logger(OutboxService.name);
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  /** Olayı, iş verisiyle aynı veritabanı işleminde kaydeder. */
  add(tx: Tx, type: EventType, payload: Prisma.InputJsonValue) {
    return tx.outboxEvent.create({ data: { type, payload } });
  }

  /**
   * Yayınlanmamış olayları sırayla kilitleyip `publish` ile iletir. Birden çok işçi aynı anda
   * çalışabilir (SKIP LOCKED). Yayın başarısızsa olay sonraki turda tekrar denenir.
   */
  async relayBatch(publish: (type: string, payload: unknown) => Promise<void>, limit = 100): Promise<number> {
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: bigint; type: string; payload: unknown }[]>`
        SELECT id, type, payload FROM outbox
        WHERE published_at IS NULL
        ORDER BY id
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED`;
      let sent = 0;
      for (const row of rows) {
        try {
          await publish(row.type, row.payload);
          await tx.outboxEvent.update({ where: { id: row.id }, data: { publishedAt: new Date() } });
          sent++;
        } catch (err) {
          this.log.warn(`olay ${row.id} iletilemedi: ${(err as Error).message}`);
          await tx.outboxEvent.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
        }
      }
      return sent;
    });
  }
}
