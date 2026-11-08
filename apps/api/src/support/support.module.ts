import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Module,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  supportCreateSchema,
  supportInboundSchema,
  supportMessageSchema,
  supportRateSchema,
  supportReplySchema,
} from '@rengarenk/shared';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ENV, type Env } from '../config/env.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { SupportService } from './support.service.js';

type AuthedRequest = { user: AccessClaims };

/** Kullanıcı: destek talebi aç, yazışma, puan (Yardim.dc.html; Karar 54) */
@Controller('support/tickets')
@UseGuards(AuthGuard)
export class SupportController {
  constructor(private readonly s: SupportService) {}

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

/** İşçi için: memnuniyet sorusu ve bildirim metni */
@Module({
  providers: [SupportService, AuditService, OutboxService],
  exports: [SupportService],
})
export class SupportServiceModule {}

@Module({
  imports: [AuthModule, StaffModule, SupportServiceModule],
  controllers: [SupportController, SupportInboundController, SupportStaffController],
})
export class SupportModule {}
