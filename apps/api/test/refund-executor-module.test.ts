import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { DatabaseModule } from '../src/database/database.module.js';
import { RefundExecutorModule } from '../src/refunds/executor/refund-executor.module.js';
import { REFUND_GATEWAY, RefundExecutorService } from '../src/refunds/executor/refund-executor.service.js';

/**
 * İade yürütücü süreci (`src/refund-executor.ts`) canlıdaki gibi aynı modüllerle kurulabilmeli. Diğer iade testleri
 * hizmeti elle kurduğu için eksik bağımlılık yalnızca canlı kapsayıcıda görülüyordu (12 Kasım 2026). Ödeme
 * kuruluşunun iade ucu yalnızca IADE_YURUTUCU=1 sürecinde kurulur (kilit 2); bu koruma gevşetilmez, testte uç yer
 * tutucuyla değiştirilir.
 */
describe('iade yürütücü modülü', () => {
  it('bağımlılıkları eksiksiz çözülür', async () => {
    const m = await Test.createTestingModule({ imports: [DatabaseModule, RefundExecutorModule] })
      .overrideProvider(REFUND_GATEWAY)
      .useValue({})
      .compile();
    expect(m.get(RefundExecutorService)).toBeInstanceOf(RefundExecutorService);
    await m.close();
  });
});
