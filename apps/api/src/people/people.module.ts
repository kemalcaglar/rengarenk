import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  blockAddSchema,
  CARE_FILTERS,
  type CareFilter,
  cardActionSchema,
  careAssignSchema,
  deviceBlockSchema,
  grantSchema,
  PEOPLE_FILTERS,
  type PeopleFilter,
  revealSchema,
  staffNoteSchema,
} from '@rengarenk/shared';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ModerationCoreModule, ModerationServiceModule } from '../moderation/moderation.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { StaffModule } from '../staff/staff.module.js';
import { GalleryCareService } from './gallery-care.service.js';
import { PeopleService } from './people.service.js';

const tipPipe = new ZodPipe(z.enum(['kisi', 'galeri']));
const filtreler = PEOPLE_FILTERS.map(([k]) => k) as string[];
type Tip = 'kisi' | 'galeri';

/** Konsol › Pazar › Kullanıcılar ve galeriler (Karar 40, 43, 52) */
@Controller('staff')
@UseGuards(StaffGuard)
export class PeopleStaffController {
  constructor(
    private readonly p: PeopleService,
    private readonly care: GalleryCareService,
  ) {}

  /** Pazar › Galeri müşterileri (Karar 43): risk, yenileme, sorumlu */
  @Get('galleries/care')
  @RequirePermission('kisisel_veri.gor', 'maskeli')
  careList(@Req() req: StaffRequest, @Query('filtre') filtre = 'hepsi', @Query('q') q = '') {
    const f = CARE_FILTERS.some(([k]) => k === filtre) ? (filtre as CareFilter) : 'hepsi';
    return this.care.list(req.staff, f, String(q).slice(0, 80));
  }

  /** Galeri kartı › Müşteri yönetimi › sorumlu çalışan */
  @Post('people/galeri/:id/manager')
  @HttpCode(200)
  @RequirePermission('galeri_basvuru.onayla', 'tam')
  manager(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(careAssignSchema)) b: z.output<typeof careAssignSchema>,
  ) {
    return this.care.assign(req.staff, id, b.calisan, req.ip);
  }

  @Get('people')
  @RequirePermission('kisisel_veri.gor', 'maskeli')
  search(@Query('q') q = '', @Query('tur') tur = 'hepsi') {
    return this.p.search(String(q).slice(0, 80), (filtreler.includes(tur) ? tur : 'hepsi') as PeopleFilter);
  }

  @Get('people/:tip/:id')
  @RequirePermission('kisisel_veri.gor', 'maskeli')
  card(@Param('tip', tipPipe) tip: Tip, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.p.card(tip, id);
  }

  /** Kişisel veriyi açar: gerekçe işlem kaydına girer (Karar 40) */
  @Post('people/:tip/:id/reveal')
  @HttpCode(200)
  @RequirePermission('kisisel_veri.gor', 'maskeli')
  reveal(
    @Req() req: StaffRequest,
    @Param('tip', tipPipe) tip: Tip,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(revealSchema)) b: z.output<typeof revealSchema>,
  ) {
    return this.p.reveal(req.staff, tip, id, b.gerekce, req.ip);
  }

  /** Uyarı, askı, kalıcı engelleme önerisi: kararın yetkisi moderasyonda denetlenir */
  @Post('people/:tip/:id/action')
  @HttpCode(200)
  @RequirePermission('kisisel_veri.gor', 'maskeli')
  action(
    @Req() req: StaffRequest,
    @Param('tip', tipPipe) tip: Tip,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(cardActionSchema)) b: z.output<typeof cardActionSchema>,
  ) {
    return this.p.action(req.staff, tip, id, b, req.ip);
  }

  @Post('people/:tip/:id/grant')
  @HttpCode(200)
  @RequirePermission('hak.tanimla', 'tam')
  grant(
    @Req() req: StaffRequest,
    @Param('tip', tipPipe) tip: Tip,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(grantSchema)) b: z.output<typeof grantSchema>,
  ) {
    return this.p.grant(req.staff, tip, id, b, req.ip);
  }

  @Post('people/:tip/:id/sessions/revoke')
  @HttpCode(200)
  @RequirePermission('kisisel_veri.gor', 'maskeli')
  revoke(
    @Req() req: StaffRequest,
    @Param('tip', tipPipe) tip: Tip,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!PeopleService.izin(req.staff.grants).oturum)
      throw new ForbiddenException('Bu işlem için yetkin yok');
    return this.p.revokeSessions(req.staff, tip, id, req.ip);
  }

  /** Giriş bağlantısı gönder (Karar 52): kişinin doğrulanmış e-postasına tek kullanımlık bağlantı */
  @Post('people/:tip/:id/login-link')
  @HttpCode(200)
  @RequirePermission('kisisel_veri.gor', 'maskeli')
  loginLink(
    @Req() req: StaffRequest,
    @Param('tip', tipPipe) tip: Tip,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!PeopleService.izin(req.staff.grants).baglanti)
      throw new ForbiddenException('Bu işlem için yetkin yok');
    return this.p.sendLoginLink(req.staff, tip, id, req.ip);
  }

  @Post('people/:tip/:id/notes')
  @HttpCode(200)
  @RequirePermission('kisisel_veri.gor', 'maskeli')
  note(
    @Req() req: StaffRequest,
    @Param('tip', tipPipe) tip: Tip,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(staffNoteSchema)) b: z.output<typeof staffNoteSchema>,
  ) {
    return this.p.addNote(req.staff, tip, id, b.metin);
  }

  /** Kişi kartı › Cihazlar › Kara listeye al (Karar 43) */
  @Post('people/kisi/:id/devices/:deviceId/block')
  @HttpCode(200)
  @RequirePermission('sikayet.coz', 'tam')
  blockDevice(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @Body(new ZodPipe(deviceBlockSchema)) b: z.output<typeof deviceBlockSchema>,
  ) {
    return this.p.blockDevice(req.staff, id, deviceId, b.not, req.ip);
  }

  @Get('blocklist')
  @RequirePermission('sikayet.coz', 'tam')
  blocklist() {
    return this.p.blocklist();
  }

  @Post('blocklist')
  @HttpCode(200)
  @RequirePermission('sikayet.coz', 'tam')
  blockAdd(@Req() req: StaffRequest, @Body(new ZodPipe(blockAddSchema)) b: z.output<typeof blockAddSchema>) {
    return this.p.blockAdd(req.staff, b, req.ip);
  }

  @Delete('blocklist/:id')
  @RequirePermission('sikayet.coz', 'tam')
  blockRemove(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.p.blockRemove(req.staff, id, req.ip);
  }
}

@Module({
  imports: [StaffModule, ModerationCoreModule, ModerationServiceModule, NotificationsModule],
  controllers: [PeopleStaffController],
  providers: [PeopleService, GalleryCareService, AuditService, OutboxService],
})
export class PeopleModule {}
