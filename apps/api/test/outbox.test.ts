import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { OutboxService } from '../src/outbox/outbox.service.js';
import { createTestApp } from './helpers.js';

let app: NestFastifyApplication;
let db: Db;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
});
afterAll(() => app.close());

describe('outbox', () => {
  it('olaylar sırayla iletilir; iletilemeyen olay sonra tekrar denenir', async () => {
    const outbox = new OutboxService(db);
    // Açılışta yazılan olaylar (ör. ilk kurulumdaki kategoriler) önce iletilir; test yalnızca kendi olaylarına bakar.
    while ((await outbox.relayBatch(async () => undefined)) > 0);
    await db.$transaction(async (tx) => {
      await outbox.add(tx, 'talep.yayinlandi', { id: 'a' });
      await outbox.add(tx, 'talep.yayinlandi', { id: 'b' });
    });
    const seen: unknown[] = [];
    let fail = true;
    const sent = await outbox.relayBatch(async (_t, p) => {
      if (fail && (p as { id: string }).id === 'b') throw new Error('kuyruk kapalı');
      seen.push(p);
    });
    expect(sent).toBe(1);
    fail = false;
    expect(await outbox.relayBatch(async (_t, p) => void seen.push(p))).toBe(1);
    expect(seen).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(await db.outboxEvent.count({ where: { publishedAt: null } })).toBe(0);
  });
});
