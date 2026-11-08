import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  applicationDocsRequestSchema,
  applicationRejectSchema,
  applicationSubmitSchema,
  galleryApplicationDraftSchema,
  galleryInviteSchema,
  galleryProfileSchema,
} from '@rengarenk/shared';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { GalleryService } from './gallery.service.js';
import { GalleryApplicationService } from './gallery-application.service.js';

type AuthedRequest = { user: AccessClaims; ip: string };
type Reply = { header: (k: string, v: string) => unknown; send: (b: unknown) => unknown };

const roleSchema = z.object({ rol: z.enum(['MANAGER', 'SALES']) });

/** Kurumsal hesap başvurusu, başvuranın tarafı (Karar 03; Basvuru.dc.html) */
@Controller('gallery-applications/me')
@UseGuards(AuthGuard)
export class GalleryApplicationController {
  constructor(private readonly apps: GalleryApplicationService) {}

  @Get()
  mine(@Req() req: AuthedRequest) {
    return this.apps.mine(req.user.sub);
  }

  @Patch()
  save(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(galleryApplicationDraftSchema)) body: z.output<typeof galleryApplicationDraftSchema>,
  ) {
    return this.apps.saveDraft(req.user.sub, body);
  }

  /** Ham gövde: PDF ya da fotoğraf; dosya adı `x-file-name` başlığında (URL kodlu) */
  @Post('documents/:kind')
  upload(
    @Req() req: AuthedRequest & { body: unknown },
    @Param('kind') kind: string,
    @Headers('x-file-name') fileName?: string,
  ) {
    if (!Buffer.isBuffer(req.body))
      throw new BadRequestException('Dosya gövdede PDF ya da fotoğraf olarak gelmeli');
    let ad = 'belge';
    try {
      ad = decodeURIComponent(fileName ?? 'belge');
    } catch {
      // bozuk ad: varsayılan
    }
    return this.apps.upload(req.user.sub, kind, ad, new Uint8Array(req.body));
  }

  @Post('verify-authority')
  @HttpCode(200)
  verify(@Req() req: AuthedRequest) {
    return this.apps.verifyAuthority(req.user.sub);
  }

  @Post('submit')
  @HttpCode(200)
  submit(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(applicationSubmitSchema)) body: z.output<typeof applicationSubmitSchema>,
  ) {
    return this.apps.submit(req.user.sub, body, req.ip);
  }
}

/** Galeri hesabı: panel, profil, ekip (Karar 12.5, 20) */
@Controller('gallery')
@UseGuards(AuthGuard)
export class GalleryController {
  constructor(private readonly galleries: GalleryService) {}

  @Get('mine')
  mine(@Req() req: AuthedRequest) {
    return this.galleries.mine(req.user.sub);
  }

  @Get(':accountId')
  panel(@Req() req: AuthedRequest, @Param('accountId', new ParseUUIDPipe()) accountId: string) {
    return this.galleries.panel(req.user.sub, accountId);
  }

  @Patch(':accountId/profile')
  profile(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Body(new ZodPipe(galleryProfileSchema)) body: z.output<typeof galleryProfileSchema>,
  ) {
    return this.galleries.updateProfile(req.user.sub, accountId, body, req.ip);
  }

  @Post(':accountId/invites')
  invite(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Body(new ZodPipe(galleryInviteSchema)) body: z.output<typeof galleryInviteSchema>,
  ) {
    return this.galleries.invite(req.user.sub, accountId, body.telefon, body.rol, req.ip);
  }

  @Delete(':accountId/invites/:id')
  revokeInvite(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.galleries.revokeInvite(req.user.sub, accountId, id, req.ip);
  }

  @Patch(':accountId/members/:userId')
  role(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body(new ZodPipe(roleSchema)) body: z.output<typeof roleSchema>,
  ) {
    return this.galleries.changeRole(req.user.sub, accountId, userId, body.rol, req.ip);
  }

  @Delete(':accountId/members/:userId')
  @HttpCode(204)
  async remove(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    await this.galleries.removeMember(req.user.sub, accountId, userId, req.ip);
  }
}

/** Davet edilen kullanıcının bekleyen galeri davetleri */
@Controller('me/invites')
@UseGuards(AuthGuard)
export class MyInvitesController {
  constructor(private readonly galleries: GalleryService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.galleries.myInvites(req.user.sub);
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(@Req() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.galleries.respond(req.user.sub, id, true, req.ip);
  }

  @Post(':id/decline')
  @HttpCode(204)
  async decline(@Req() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.galleries.respond(req.user.sub, id, false, req.ip);
  }
}

/** Herkese açık galeri profili (GaleriProfil.dc.html) */
@Controller('galeriler')
export class PublicGalleryController {
  constructor(private readonly galleries: GalleryService) {}

  @Get(':slug')
  profile(@Param('slug') slug: string) {
    return this.galleries.publicProfile(slug);
  }
}

/** Konsol: Galeri başvuruları (YonetimPazar.dc.html, Karar 13.1, 52) */
@Controller('staff/gallery-applications')
@UseGuards(StaffGuard)
export class StaffGalleryApplicationsController {
  constructor(private readonly apps: GalleryApplicationService) {}

  @Get()
  @RequirePermission('galeri_basvuru.onayla')
  queue() {
    return this.apps.queue();
  }

  @Get(':id')
  @RequirePermission('galeri_basvuru.onayla')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.apps.detail(id);
  }

  @Get(':id/documents/:docId')
  @RequirePermission('galeri_basvuru.onayla')
  async document(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('docId', new ParseUUIDPipe()) docId: string,
    @Query('indir') indir: string | undefined,
    @Req() req: StaffRequest,
    @Res() reply: Reply,
  ) {
    const f = await this.apps.document(id, docId, { staffId: req.staff.staff.id, ip: req.ip });
    reply.header('content-type', f.mime);
    reply.header('cache-control', 'private, no-store');
    reply.header(
      'content-disposition',
      `${indir ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(f.ad)}`,
    );
    return reply.send(f.body);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission('galeri_basvuru.onayla')
  approve(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.apps.approve(id, { staffId: req.staff.staff.id, ip: req.ip });
  }

  @Post(':id/reject')
  @HttpCode(204)
  @RequirePermission('galeri_basvuru.onayla')
  async reject(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(applicationRejectSchema)) body: z.output<typeof applicationRejectSchema>,
  ) {
    await this.apps.reject(id, { staffId: req.staff.staff.id, ip: req.ip }, body.gerekce);
  }

  @Post(':id/request-docs')
  @HttpCode(204)
  @RequirePermission('galeri_basvuru.onayla')
  async requestDocs(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(applicationDocsRequestSchema)) body: z.output<typeof applicationDocsRequestSchema>,
  ) {
    await this.apps.requestDocs(id, { staffId: req.staff.staff.id, ip: req.ip }, body.not);
  }

  @Post(':id/revoke')
  @HttpCode(204)
  @RequirePermission('galeri_basvuru.onayla')
  async revoke(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(applicationRejectSchema)) body: z.output<typeof applicationRejectSchema>,
  ) {
    await this.apps.revoke(id, { staffId: req.staff.staff.id, ip: req.ip }, body.gerekce);
  }
}
