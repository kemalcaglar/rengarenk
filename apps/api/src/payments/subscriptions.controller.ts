import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  subscriptionCancelSchema,
  subscriptionCheckoutSchema,
  subscriptionPaySchema,
  subscriptionScheduleSchema,
} from '@rengarenk/shared';
import type { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ENV, type Env } from '../config/env.js';
import { SubscriptionsService } from './subscriptions.service.js';

type AuthedRequest = { user: AccessClaims; ip?: string };
type Reply = {
  header: (k: string, v: string) => Reply;
  removeHeader: (k: string) => Reply;
  redirect: (url: string, code?: number) => unknown;
  send: (b: unknown) => unknown;
};

/** Galeri paneli › Paket ve faturalar (GaleriPanel.dc.html; Karar 12.2, 12.7, 39). Satın alma yalnızca web'den. */
@Controller('gallery/:accountId/subscription')
@UseGuards(AuthGuard)
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get()
  overview(@Req() req: AuthedRequest, @Param('accountId', new ParseUUIDPipe()) accountId: string) {
    return this.subs.overview(req.user.sub, accountId);
  }

  @Post('checkout')
  checkout(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Body(new ZodPipe(subscriptionCheckoutSchema)) b: z.output<typeof subscriptionCheckoutSchema>,
  ) {
    return this.subs.checkout(req.user.sub, accountId, b, { ip: req.ip });
  }

  @Post('pay')
  pay(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Body(new ZodPipe(subscriptionPaySchema)) b: z.output<typeof subscriptionPaySchema>,
  ) {
    return this.subs.checkout(req.user.sub, accountId, { yenile: true, ...b }, { ip: req.ip });
  }

  @Patch('next')
  schedule(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Body(new ZodPipe(subscriptionScheduleSchema)) b: z.output<typeof subscriptionScheduleSchema>,
  ) {
    return this.subs.schedule(req.user.sub, accountId, b);
  }

  @Post('cancel')
  cancel(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Body(new ZodPipe(subscriptionCancelSchema)) b: z.output<typeof subscriptionCancelSchema>,
  ) {
    return this.subs.cancel(req.user.sub, accountId, b.iptal);
  }
}

/**
 * Kart sayfası (abonelik): web sitesinin ödeme ekranında çerçevede açılır. PayTR'de kart formu doğrudan
 * `https://www.paytr.com/odeme` adresine gönderilir; kart bilgisi Rengarenk sunucusuna gelmez.
 */
@Controller('odeme/kart')
export class CardPageController {
  constructor(
    private readonly subs: SubscriptionsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get(':no')
  async page(@Param('no') no: string, @Res() res: Reply) {
    const r = await this.subs.cardPage(no);
    if (r.yonlendir) return res.redirect(r.yonlendir, 302);
    const web = this.env.WEB_ORIGIN;
    res
      .removeHeader('x-frame-options')
      .header(
        'content-security-policy',
        `default-src 'none'; style-src 'unsafe-inline'; form-action https://www.paytr.com; frame-ancestors ${web}`,
      );
    return res.header('content-type', 'text/html; charset=utf-8').send(r.html);
  }
}
