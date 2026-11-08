import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { EntitlementsModule } from '../entitlements/entitlements.module.js';
import { FlagsModule } from '../flags/flags.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { OrdersController, PaymentCallbackController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { EArsivFactory, PaymentProviderFactory } from './providers.js';

/** Web ödemeleri (Aşama 6): sipariş, PayTR, haklar ve öne çıkarma, e-Arşiv fatura. İade burada değil. */
@Module({
  imports: [AuthModule, EntitlementsModule, FlagsModule],
  controllers: [OrdersController, PaymentCallbackController],
  providers: [OrdersService, PaymentProviderFactory, EArsivFactory, OutboxService, AuditService],
  exports: [OrdersService],
})
export class PaymentsModule {}

/** İşçi için: fatura kesme ve süresi geçen siparişler. */
@Module({
  imports: [EntitlementsModule, FlagsModule],
  providers: [OrdersService, PaymentProviderFactory, EArsivFactory, OutboxService, AuditService],
  exports: [OrdersService],
})
export class PaymentsWorkerModule {}
