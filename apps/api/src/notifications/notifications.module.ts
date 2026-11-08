import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { emailSetSchema, notifyPrefsSchema, pushTokenSchema } from '@rengarenk/shared';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ENV, type Env } from '../config/env.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { SearchModule } from '../search/search.module.js';
import { StaffModule } from '../staff/staff.module.js';
import { AutomationService } from './automations.js';
import { createEmailSender, createPushSender, EMAIL_SENDER, PUSH_SENDER } from './channels.js';
import { CommercialController, CommercialService, FakeIys, IYS, NoIys } from './commercial.js';
import { DeliveryService } from './delivery.service.js';
import { NotificationService } from './notification.service.js';
import { NotificationEvents } from './notification-events.js';
import { NotificationsStaffController, NotificationsStaffService } from './notifications-staff.js';
import { ReputationService } from './reputation.js';
import { SwitchService } from './switches.js';
import { TemplatesService } from './templates.service.js';

type AuthedRequest = { user: AccessClaims; ip?: string };
const okuSchema = z
  .object({ ids: z.array(z.uuid()).max(200).optional(), hepsi: z.literal(true).optional() })
  .strict()
  .refine((v) => v.ids?.length || v.hepsi, 'Okunacak bildirim yok');
const kodSchema = z.object({ kod: z.string().min(20).max(200) }).strict();
const silSchema = z.object({ token: z.string().min(20).max(4096) }).strict();

/** Bildirimler (zil, AnasayfaMobil.dc.html › bildirimler) ve Ayarlar › Bildirimler (Ayarlar.dc.html) */
@Controller()
export class NotificationsController {
  constructor(private readonly n: NotificationService) {}

  @Get('notifications')
  @UseGuards(AuthGuard)
  list(@Req() req: AuthedRequest, @Query('grup') grup?: string) {
    return this.n.list(req.user.sub, grup);
  }

  @Get('notifications/unread')
  @UseGuards(AuthGuard)
  unread(@Req() req: AuthedRequest) {
    return this.n.unread(req.user.sub);
  }

  @Post('notifications/read')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  read(@Req() req: AuthedRequest, @Body(new ZodPipe(okuSchema)) b: z.output<typeof okuSchema>) {
    return this.n.read(req.user.sub, b.hepsi ? 'hepsi' : (b.ids ?? []));
  }

  @Get('me/notification-preferences')
  @UseGuards(AuthGuard)
  prefs(@Req() req: AuthedRequest) {
    return this.n.prefs(req.user.sub);
  }

  @Put('me/notification-preferences')
  @UseGuards(AuthGuard)
  setPrefs(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(notifyPrefsSchema)) b: z.output<typeof notifyPrefsSchema>,
  ) {
    return this.n.setPrefs(req.user.sub, b.tercihler, { ip: req.ip });
  }

  @Post('me/push-tokens')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  push(@Req() req: AuthedRequest, @Body(new ZodPipe(pushTokenSchema)) b: z.output<typeof pushTokenSchema>) {
    return this.n.registerPush(req.user.sub, b.token, b.platform);
  }

  @Delete('me/push-tokens')
  @UseGuards(AuthGuard)
  unpush(@Req() req: AuthedRequest, @Body(new ZodPipe(silSchema)) b: z.output<typeof silSchema>) {
    return this.n.unregisterPush(req.user.sub, b.token);
  }

  @Post('me/email')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  email(@Req() req: AuthedRequest, @Body(new ZodPipe(emailSetSchema)) b: z.output<typeof emailSetSchema>) {
    return this.n.setEmail(req.user.sub, b.eposta);
  }

  /** E-postadaki bağlantı: oturum istemez (bağlantı başka tarayıcıda açılabilir), tek kullanımlık koddur */
  @Post('eposta/dogrula')
  @HttpCode(200)
  verify(@Body(new ZodPipe(kodSchema)) b: z.output<typeof kodSchema>) {
    return this.n.verifyEmail(b.kod);
  }
}

const KANALLAR = [
  { provide: EMAIL_SENDER, inject: [ENV], useFactory: (env: Env) => createEmailSender(env) },
  { provide: PUSH_SENDER, inject: [ENV], useFactory: (env: Env) => createPushSender(env) },
];

/** API: uçlar ve bildirim üretimi (e-posta doğrulama) */
@Module({
  imports: [AuthModule, StaffModule],
  controllers: [NotificationsController, CommercialController, NotificationsStaffController],
  providers: [
    NotificationService,
    TemplatesService,
    CommercialService,
    SwitchService,
    NotificationsStaffService,
    ReputationService,
    AuditService,
    OutboxService,
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}

/** İşçi: olay eşlemesi, teslim (e-posta, SMS, push), günlük özet */
@Module({
  imports: [SearchModule],
  providers: [
    NotificationService,
    TemplatesService,
    DeliveryService,
    NotificationEvents,
    CommercialService,
    SwitchService,
    AutomationService,
    ReputationService,
    AuditService,
    OutboxService,
    ...KANALLAR,
    {
      provide: IYS,
      inject: [ENV],
      useFactory: (env: Env) => (env.IYS_PROVIDER === 'fake' ? new FakeIys() : new NoIys()),
    },
  ],
  exports: [
    NotificationService,
    DeliveryService,
    NotificationEvents,
    CommercialService,
    AutomationService,
    ReputationService,
    IYS,
  ],
})
export class NotificationsWorkerModule {}
