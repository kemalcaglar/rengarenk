import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { DeliveryService } from '../src/notifications/delivery.service.js';
import { OrdersService } from '../src/payments/orders.service.js';
import { WorkerModule } from '../src/worker.module.js';

describe('işçi süreci', () => {
  it('bütün bağımlılıklar çözülür (eksik modül işçiyi açılışta düşürür)', async () => {
    const m = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    expect(m.get(OrdersService)).toBeDefined();
    expect(m.get(DeliveryService)).toBeDefined();
    await m.close();
  });
});
