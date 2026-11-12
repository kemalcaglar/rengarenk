import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  contactPrefsSchema,
  ilIlceKontrol,
  personNameSchema,
  phoneChangeRequestSchema,
  phoneChangeVerifySchema,
  profileLocationFields,
} from '@rengarenk/shared';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { type AccessClaims, AuthService } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { type Db, PRISMA } from '../database/prisma.js';

const updateSchema = z
  .object({
    displayName: z.string().trim().min(2, 'En az 2 karakter').max(60).nullable().optional(),
    /** Ad ve soyad ayrı (Karar 29); ikisi verilince görünen ad "Ad Soyad" olur */
    firstName: personNameSchema.optional(),
    lastName: personNameSchema.optional(),
    // E-posta giriş kimliğidir (Karar 18): yalnızca POST /notifications/email ile değişir (tekillik ve doğrulama)
    /** Ayarlar › Profil: il, ilçe ve talepte görünen ad (Karar 29) */
    ...profileLocationFields,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.il !== undefined || v.ilce !== undefined) ilIlceKontrol(v, ctx);
  })
  .transform((v) =>
    v.firstName && v.lastName && v.displayName === undefined
      ? { ...v, displayName: `${v.firstName} ${v.lastName}` }
      : v,
  );

type AuthedRequest = { user: AccessClaims; ip: string };

/** Kullanıcının kendi profili ve açık oturumları (Ayarlar > Giriş ve güvenlik). */
@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async get(@Req() req: AuthedRequest) {
    const { passwordHash, googleSub, appleSub, ...u } = await this.db.user.findUniqueOrThrow({
      where: { id: req.user.sub },
      select: {
        passwordHash: true,
        googleSub: true,
        appleSub: true,
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        il: true,
        ilce: true,
        nameMode: true,
        phoneVisible: true,
        whatsappVisible: true,
        callFrom: true,
        callTo: true,
        memberships: {
          select: { role: true, account: { select: { id: true, kind: true, name: true, status: true } } },
        },
      },
    });
    // Giriş yolları (Karar 18): özet ve kimliklerin kendisi değil, yalnızca var olup olmadıkları
    return { ...u, girisYollari: { sifre: !!passwordHash, google: !!googleSub, apple: !!appleSub } };
  }

  @Patch()
  async update(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(updateSchema)) body: z.output<typeof updateSchema>,
  ) {
    return this.db.$transaction(async (tx) => {
      const before = await tx.user.findUniqueOrThrow({
        where: { id: req.user.sub },
        select: {
          displayName: true,
          firstName: true,
          lastName: true,
          email: true,
          il: true,
          ilce: true,
          nameMode: true,
        },
      });
      const after = await tx.user.update({
        where: { id: req.user.sub },
        data: {
          ...body,
          // İl değişip ilçe verilmediyse eski ilçe silinir (başka ilin ilçesi kalmasın)
          ...(body.il !== undefined && body.ilce === undefined ? { ilce: null } : {}),
        },
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          email: true,
          il: true,
          ilce: true,
          nameMode: true,
        },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: req.user.sub,
          action: 'profil_guncelle',
          entityType: 'user',
          entityId: req.user.sub,
          // Kişisel veri işlem kaydına değer olarak değil, yalnızca değişen alan adı olarak yazılır.
          before: Object.keys(body).filter(
            (k) => before[k as keyof typeof before] !== after[k as keyof typeof after],
          ),
          ip: req.ip,
        },
        tx,
      );
      return after;
    });
  }

  /** Ayarlar › İletişim (Karar 29): telefon ve WhatsApp izni, aranabilir saatler; yeni talepler bunlarla açılır */
  @Put('contact')
  async contact(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(contactPrefsSchema)) b: z.output<typeof contactPrefsSchema>,
  ) {
    return this.db.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: req.user.sub },
        data: b,
        select: { phoneVisible: true, whatsappVisible: true, callFrom: true, callTo: true },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: req.user.sub,
          action: 'iletisim_tercihi',
          entityType: 'user',
          entityId: req.user.sub,
          ip: req.ip,
        },
        tx,
      );
      return u;
    });
  }

  /** Numarayı değiştir: yeni numaraya SMS kodu */
  @Post('phone/request')
  @HttpCode(200)
  phoneRequest(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(phoneChangeRequestSchema)) b: z.output<typeof phoneChangeRequestSchema>,
  ) {
    return this.auth.requestPhoneChange(req.user.sub, b.phone, req.ip);
  }

  @Post('phone/verify')
  @HttpCode(200)
  phoneVerify(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(phoneChangeVerifySchema)) b: z.output<typeof phoneChangeVerifySchema>,
  ) {
    return this.auth.confirmPhoneChange(req.user.sub, req.user.sid, b.challengeId, b.code, req.ip);
  }

  @Get('sessions')
  async sessions(@Req() req: AuthedRequest) {
    const rows = await this.db.session.findMany({
      where: { userId: req.user.sub, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        device: { select: { platform: true, lastSeenAt: true } },
      },
    });
    return rows.map((s) => ({ ...s, current: s.id === req.user.sid }));
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async revoke(@Req() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    const r = await this.db.session.updateMany({
      where: { id, userId: req.user.sub, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (r.count === 0) throw new NotFoundException();
    await this.audit.record({
      actorType: 'USER',
      actorId: req.user.sub,
      action: 'oturum_kapat',
      entityType: 'session',
      entityId: id,
      ip: req.ip,
    });
  }
}
