import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { couponCheckSchema, orderCreateSchema } from '@rengarenk/shared';
import type { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ENV, type Env } from '../config/env.js';
import { OrdersService } from './orders.service.js';

type AuthedRequest = { user: AccessClaims; ip?: string };
type Reply = {
  header: (k: string, v: string) => Reply;
  removeHeader: (k: string) => Reply;
  status: (n: number) => Reply;
  redirect: (url: string, code?: number) => unknown;
  send: (b: unknown) => unknown;
};

/** Haklarım ve ödemeler (Haklarim.dc.html; Karar 12, 39) */
@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('overview')
  overview(@Req() req: AuthedRequest) {
    return this.orders.overview(req.user.sub);
  }

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(orderCreateSchema)) b: z.output<typeof orderCreateSchema>,
  ) {
    return this.orders.create(req.user.sub, b, { ip: req.ip });
  }

  /** Kupon kodu önizlemesi (ödeme formunda "Uygula") */
  @Post('kupon')
  @HttpCode(200)
  coupon(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(couponCheckSchema)) b: z.output<typeof couponCheckSchema>,
  ) {
    return this.orders.couponPreview(req.user.sub, b);
  }

  @Get(':no')
  status(@Req() req: AuthedRequest, @Param('no') no: string) {
    return this.orders.status(req.user.sub, no);
  }

  @Get(':id/invoice')
  async invoice(@Req() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string, @Res() res: Reply) {
    const f = await this.orders.invoicePdf(req.user.sub, id);
    res
      .header('content-type', 'application/pdf')
      .header('content-disposition', `attachment; filename="${f.ad}"`);
    return res.send(f.body);
  }

  @Get(':id/contract')
  contract(@Req() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.contract(req.user.sub, id);
  }
}

/**
 * Ödeme kuruluşunun bildirimi (PayTR iFrame API 2. adım): oturum istemez, imzayla doğrulanır, yanıt yalnızca düz
 * "OK". Bakım modunda da açıktır. Sahte ödeme sayfası yalnızca geliştirme ve testte (PAYMENT_PROVIDER=fake) çalışır.
 */
@Controller('odeme')
export class PaymentCallbackController {
  constructor(
    private readonly orders: OrdersService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Sahte sayfa web sitesinin ödeme ekranında çerçevede açılır; yalnızca o adrese izin verilir */
  private cerceve(res: Reply) {
    const web = this.env.WEB_ORIGIN;
    res
      .removeHeader('x-frame-options')
      .header(
        'content-security-policy',
        `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${web}; frame-ancestors ${web}`,
      );
  }

  @Post('bildirim')
  @HttpCode(200)
  async notify(@Body() body: Record<string, string>, @Res() res: Reply) {
    const ok = await this.orders.notify(body ?? {});
    res.header('content-type', 'text/plain; charset=utf-8');
    if (!ok) return res.status(400).send('PAYTR notification failed: bad hash');
    return res.send('OK');
  }

  @Get('sahte/:no')
  async fakePage(@Param('no') no: string, @Res() res: Reply) {
    const html = await this.orders.fakePage(no);
    this.cerceve(res);
    return res.header('content-type', 'text/html; charset=utf-8').send(html);
  }

  @Post('sahte/:no')
  async fakeSubmit(@Param('no') no: string, @Body() body: Record<string, string>, @Res() res: Reply) {
    const url = await this.orders.fakeSubmit(no, body?.durum ?? 'failed');
    this.cerceve(res);
    return res.redirect(url, 303);
  }
}
