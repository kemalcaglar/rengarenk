import { Module } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service.js';
import { ENV, type Env } from '../../config/env.js';
import { OutboxService } from '../../outbox/outbox.service.js';
import { SubscriptionBilling } from '../../payments/subscription-billing.js';
import { PricingCoreModule } from '../../pricing/pricing.service.js';
import { REFUND_GATEWAY, RefundExecutorService } from './refund-executor.service.js';
import { createRefundGateway } from './refund-gateway.js';

/**
 * Yalnızca `src/refund-executor.ts` sürecinde kullanılır (kilit 2). SubscriptionBilling fiyat listesini okur
 * (PricingCoreModule; onay yürütmez, yalnızca okur); reklam ölçümü isteğe bağlıdır ve iade sürecinde yoktur.
 */
@Module({
  imports: [PricingCoreModule],
  providers: [
    RefundExecutorService,
    SubscriptionBilling,
    OutboxService,
    AuditService,
    { provide: REFUND_GATEWAY, inject: [ENV], useFactory: (env: Env) => createRefundGateway(env) },
  ],
  exports: [RefundExecutorService],
})
export class RefundExecutorModule {}
