import { Body, Controller, Get, Headers, Ip, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { LEGAL_KEY_LIST, type LegalKey, legalAcceptSchema, legalDraftSchema } from '@rengarenk/shared';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { channelOf } from './consent.service.js';
import { LegalService } from './legal.service.js';

const keySchema = z.enum(LEGAL_KEY_LIST as [LegalKey, ...LegalKey[]]);
const surumSchema = z.coerce.number().int().positive().optional();

/**
 * Konsol › Görünüm › Yardım ve yasal metinler (YonetimIcerik.dc.html; yetki "Tasarım değerleri ve yasal metin").
 * Taslağı sahip ya da öneri yetkisi olan çalışan hazırlar; yayın yalnızca sahip onayıyla (LEGAL_TEXT).
 */
@Controller('staff/legal')
@UseGuards(StaffGuard)
export class StaffLegalController {
  constructor(private readonly legal: LegalService) {}

  @Get()
  @RequirePermission('tasarim_yasal.duzenle', 'oneri')
  list() {
    return this.legal.staffList();
  }

  @Get(':key')
  @RequirePermission('tasarim_yasal.duzenle', 'oneri')
  detail(
    @Param('key', new ZodPipe(keySchema)) key: LegalKey,
    @Query('karsilastir', new ZodPipe(surumSchema)) karsilastir?: number,
  ) {
    return this.legal.staffDetail(key, karsilastir);
  }

  @Put(':key/draft')
  @RequirePermission('tasarim_yasal.duzenle', 'oneri')
  save(
    @Req() req: StaffRequest,
    @Param('key', new ZodPipe(keySchema)) key: LegalKey,
    @Body(new ZodPipe(legalDraftSchema)) body: z.output<typeof legalDraftSchema>,
  ) {
    return this.legal.saveDraft(req.staff, key, body, req.ip);
  }

  @Post(':key/submit')
  @RequirePermission('tasarim_yasal.duzenle', 'oneri')
  submit(@Req() req: StaffRequest, @Param('key', new ZodPipe(keySchema)) key: LegalKey) {
    return this.legal.submit(req.staff, key, req.ip);
  }
}

/** Kullanıcı: esaslı değişiklikten sonra bir sonraki girişte yeni sürümü onaylama (web ve mobil) */
@Controller('me/legal')
@UseGuards(AuthGuard)
export class MeLegalController {
  constructor(private readonly legal: LegalService) {}

  @Get('pending')
  pending(@Req() req: { user: AccessClaims }) {
    return this.legal.pending(req.user.sub);
  }

  @Post('accept')
  accept(
    @Req() req: { user: AccessClaims },
    @Body(new ZodPipe(legalAcceptSchema)) body: z.output<typeof legalAcceptSchema>,
    @Headers('x-rr-platform') platform: string | undefined,
    @Ip() ip: string,
  ) {
    return this.legal.accept(req.user.sub, body.onaylar, channelOf(platform), ip);
  }
}
