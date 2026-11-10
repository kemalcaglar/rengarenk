import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Ip,
  Module,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  helpArticleSchema,
  supportCreateSchema,
  supportInboundSchema,
  supportMessageSchema,
  supportRateSchema,
  supportReplySchema,
} from '@rengarenk/shared';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ENV, type Env } from '../config/env.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { RateLimiter } from '../ratelimit/rate-limiter.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { HelpService } from './help.service.js';
import { SupportService } from './support.service.js';
import { SupportAgent } from './support-agent.js';

type AuthedRequest = { user: AccessClaims };

/** Kullanıcı: destek talebi aç, yazışma, puan (Yardim.dc.html; Karar 54) */
@Controller('support/tickets')
@UseGuards(AuthGuard)
export class SupportController {
  constructor(
    private readonly s: SupportService,
    private readonly ajan: SupportAgent,
  ) {}

  /**
   * Destek sohbeti (Karar 42): talep açılmadan önce ajan sık sorulanlardan ve kişinin hesap bilgisinden hemen yanıt
   * önerir; kişi "Yine de ekibe gönder" derse talep açılır. Yanıt yoksa ya da konu insana kalıyorsa boş döner.
   */
  @Post('oneri')
  @HttpCode(200)
  oneri(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(supportCreateSchema)) b: z.output<typeof supportCreateSchema>,
  ) {
    return this.ajan.hemenYanit(req.user.sub, b.konu, b.metin);
  }

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(supportCreateSchema)) b: z.output<typeof supportCreateSchema>,
  ) {
    return this.s.create(req.user.sub, b);
  }

  @Get()
  mine(@Req() req: AuthedRequest) {
    return this.s.mine(req.user.sub);
  }

  @Get(':no')
  thread(@Req() req: AuthedRequest, @Param('no', new ParseIntPipe()) no: number) {
    return this.s.thread(req.user.sub, no);
  }

  @Post(':no/messages')
  message(
    @Req() req: AuthedRequest,
    @Param('no', new ParseIntPipe()) no: number,
    @Body(new ZodPipe(supportMessageSchema)) b: z.output<typeof supportMessageSchema>,
  ) {
    return this.s.userMessage(req.user.sub, no, b.metin);
  }

  @Post(':no/rating')
  @HttpCode(200)
  rate(
    @Req() req: AuthedRequest,
    @Param('no', new ParseIntPipe()) no: number,
    @Body(new ZodPipe(supportRateSchema)) b: z.output<typeof supportRateSchema>,
  ) {
    return this.s.rate(req.user.sub, no, b.puan);
  }
}

/**
 * Destek e-postası (Karar 54): posta sunucusu gelen e-postayı imzalı bildirimle iletir (`x-rr-eposta-imza` =
 * gövdenin EPOSTA_WEBHOOK_SECRET ile HMAC-SHA256'sı). Posta sunucusu kurulunca bağlanır.
 */
@Controller('destek')
export class SupportInboundController {
  constructor(
    private readonly s: SupportService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('eposta')
  @HttpCode(200)
  inbound(@Headers('x-rr-eposta-imza') imza: string | undefined, @Body() body: unknown) {
    const sir = this.env.EPOSTA_WEBHOOK_SECRET;
    const beklenen = sir
      ? Buffer.from(
          createHmac('sha256', sir)
            .update(JSON.stringify(body ?? {}))
            .digest('hex'),
        )
      : null;
    const gelen = Buffer.from(imza ?? '');
    if (!beklenen || gelen.length !== beklenen.length || !timingSafeEqual(gelen, beklenen)) {
      throw new UnauthorizedException();
    }
    return this.s.inbound(supportInboundSchema.parse(body));
  }
}

/** Konsol › Pazar › Destek (YonetimPazar.dc.html › destek) */
@Controller('staff/support/tickets')
@UseGuards(StaffGuard)
export class SupportStaffController {
  constructor(private readonly s: SupportService) {}

  @Get()
  @RequirePermission('destek.yanitla', 'tam')
  queue() {
    return this.s.queue();
  }

  @Get(':id')
  @RequirePermission('destek.yanitla', 'tam')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.s.detail(id);
  }

  @Post(':id/reply')
  @HttpCode(200)
  @RequirePermission('destek.yanitla', 'tam')
  reply(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(supportReplySchema)) b: z.output<typeof supportReplySchema>,
  ) {
    return this.s.reply(req.staff.staff.id, id, b, req.ip);
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @RequirePermission('destek.yanitla', 'tam')
  resolve(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.s.resolve(req.staff.staff.id, id, req.ip);
  }
}

const helpVoteSchema = z.object({ evet: z.boolean() }).strict();

/** Yardım merkezi (herkese açık; Yardim.dc.html): yayındaki makaleler, okunma ve "işine yaradı mı" */
@Controller('yardim/makaleler')
export class HelpPublicController {
  constructor(
    private readonly help: HelpService,
    private readonly limiter: RateLimiter,
  ) {}

  @Get()
  list() {
    return this.help.publicTopics();
  }

  @Post(':id/okundu')
  @HttpCode(204)
  async read(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string | undefined,
  ) {
    await this.limiter.hit(`yardim:ip:${ip}`, 300, 3600);
    await this.help.okundu(id, { ip, ua });
  }

  @Post(':id/faydali')
  @HttpCode(204)
  async vote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(helpVoteSchema)) b: z.output<typeof helpVoteSchema>,
    @Ip() ip: string,
    @Headers('user-agent') ua: string | undefined,
  ) {
    await this.limiter.hit(`yardim:ip:${ip}`, 300, 3600);
    await this.help.faydali(id, b.evet, { ip, ua });
  }
}

/** Konsol › Görünüm › Yardım ve yasal metinler › Yardım makaleleri (yetki: görünüm; yayın insanla) */
@Controller('staff/help')
@UseGuards(StaffGuard)
export class HelpStaffController {
  constructor(private readonly help: HelpService) {}

  @Get()
  @RequirePermission('gorunum.duzenle', 'oneri')
  list() {
    return this.help.staffList();
  }

  @Post()
  @RequirePermission('gorunum.duzenle')
  create(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(helpArticleSchema)) b: z.output<typeof helpArticleSchema>,
  ) {
    return this.help.save(req.staff, null, b, req.ip);
  }

  @Put(':id')
  @RequirePermission('gorunum.duzenle')
  update(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(helpArticleSchema)) b: z.output<typeof helpArticleSchema>,
  ) {
    return this.help.save(req.staff, id, b, req.ip);
  }

  /** Ajan, karşılanmayan destek konusu için taslak hazırlar (yapay zekâ ağ geçidinden, maskelenerek) */
  @Post('ajan-taslak')
  @RequirePermission('gorunum.duzenle', 'oneri')
  draft(@Req() req: StaffRequest) {
    return this.help.ajanTaslak(req.staff, req.ip);
  }
}

/** İşçi için: memnuniyet sorusu ve bildirim metni */
@Module({
  providers: [SupportService, SupportAgent, HelpService, AuditService, OutboxService],
  exports: [SupportService, SupportAgent, HelpService],
})
export class SupportServiceModule {}

@Module({
  imports: [AuthModule, StaffModule, SupportServiceModule],
  controllers: [
    SupportController,
    SupportInboundController,
    SupportStaffController,
    HelpPublicController,
    HelpStaffController,
  ],
})
export class SupportModule {}
