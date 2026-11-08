import { Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { EntitlementsModule } from '../entitlements/entitlements.module.js';
import { FlagsModule } from '../flags/flags.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { StaffModule } from '../staff/staff.module.js';
import { OrdersController, PaymentCallbackController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { PaymentsStaffController, PaymentsStaffService } from './payments-staff.js';
import { EArsivFactory, PaymentProviderFactory } from './providers.js';
import { StoreController, StoreWebhookController } from './store.controller.js';
import { StoreService } from './store.service.js';
import { SubscriptionBilling } from './subscription-billing.js';
import { CardPageController, SubscriptionsController } from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';

const PROVIDERS = [
  OrdersService,
  SubscriptionsService,
  SubscriptionBilling,
  StoreService,
  PaymentProviderFactory,
  EArsivFactory,
  OutboxService,
  AuditService,
];

/** Web ödemeleri (Aşama 6): sipariş, PayTR, haklar ve öne çıkarma, galeri abonelikleri, e-Arşiv. İade burada değil. */
@Module({
  imports: [AuthModule, StaffModule, EntitlementsModule, FlagsModule],
  controllers: [
    PaymentsStaffController,
    OrdersController,
    PaymentCallbackController,
    SubscriptionsController,
    CardPageController,
    StoreController,
    StoreWebhookController,
  ],
  providers: [...PROVIDERS, PaymentsStaffService],
  exports: [OrdersService, SubscriptionsService],
})
export class PaymentsModule {}

/** İşçi için: fatura kesme, süresi geçen siparişler, abonelik yenileme, hatırlatma ve aylık hak döngüsü. */
@Module({
  imports: [EntitlementsModule, FlagsModule],
  providers: PROVIDERS,
  exports: [OrdersService, SubscriptionsService],
})
export class PaymentsWorkerModule {}
