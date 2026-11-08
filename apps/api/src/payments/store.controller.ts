import { Body, Controller, Headers, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { storeIntentSchema } from '@rengarenk/shared';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { type StoreEventBody, StoreService } from './store.service.js';

type AuthedRequest = { user: AccessClaims };
const sahteSchema = z.object({ no: z.string().regex(/^[A-Z0-9]{6,40}$/) }).strict();

/** Uygulama içi satın alma (HaklarimMobil.dc.html; Karar 38) */
@Controller('store')
@UseGuards(AuthGuard)
export class StoreController {
  constructor(private readonly store: StoreService) {}

  /** Satın almadan önce niyet: ürün ve öne çıkarmada talep; yanıt mağaza ürün kimliğini verir */
  @Post('intents')
  intent(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(storeIntentSchema)) b: z.output<typeof storeIntentSchema>,
  ) {
    return this.store.intent(req.user.sub, b);
  }

  /** Yalnızca geliştirme ve test (STORE_PROVIDER=fake): mağaza ekranı yerine satış olayı */
  @Post('fake-purchase')
  fake(@Req() req: AuthedRequest, @Body(new ZodPipe(sahteSchema)) b: z.output<typeof sahteSchema>) {
    return this.store.fakePurchase(req.user.sub, b.no);
  }
}

/**
 * RevenueCat bildirimi (Integrations › Webhooks): oturum istemez, panelde tanımlanan Authorization değeriyle doğrulanır.
 * Bakım modunda da açıktır.
 */
@Controller('odeme')
export class StoreWebhookController {
  constructor(private readonly store: StoreService) {}

  @Post('magaza')
  @HttpCode(200)
  async webhook(
    @Headers('authorization') auth: string | undefined,
    @Body() body: { event?: StoreEventBody },
  ) {
    const r = await this.store.webhook(auth, body);
    return { ok: true, sonuc: r.result };
  }
}
