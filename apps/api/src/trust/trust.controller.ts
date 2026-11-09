import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { appealCreateSchema, appealDecideSchema, ratingSchema } from '@rengarenk/shared';
import type { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { RatingAppealService } from './rating-appeal.service.js';
import { TrustService } from './trust.service.js';

type AuthedRequest = { user: AccessClaims; ip?: string; headers: Record<string, string | undefined> };
const uuid = new ParseUUIDPipe();

/** Yıldız (Karar 55), galeri paneli göstergeleri, galeri takibi (Karar 28) */
@Controller()
@UseGuards(AuthGuard)
export class TrustController {
  constructor(
    private readonly trust: TrustService,
    private readonly appeals: RatingAppealService,
  ) {}

  @Get('ratings/pending')
  pending(@Req() req: AuthedRequest) {
    return this.trust.pending(req.user.sub);
  }

  @Get('conversations/:id/rating')
  eligibility(@Req() req: AuthedRequest, @Param('id', uuid) id: string) {
    return this.trust.eligibility(req.user.sub, id);
  }

  @Post('conversations/:id/rating')
  rate(
    @Req() req: AuthedRequest,
    @Param('id', uuid) id: string,
    @Body(new ZodPipe(ratingSchema)) b: z.output<typeof ratingSchema>,
  ) {
    return this.trust.rate(req.user.sub, id, b.yildiz, { ip: req.ip, ua: req.headers['user-agent'] });
  }

  @Get('gallery/:accountId/trust')
  gallery(@Req() req: AuthedRequest, @Param('accountId', uuid) accountId: string) {
    return this.trust.galleryView(req.user.sub, accountId);
  }

  /** Galerinin 1 yıldızları ve itirazları (Karar 55) */
  @Get('gallery/:accountId/ratings/low')
  lowRatings(@Req() req: AuthedRequest, @Param('accountId', uuid) accountId: string) {
    return this.appeals.list(req.user.sub, accountId);
  }

  @Post('gallery/:accountId/ratings/:ratingId/appeal')
  @HttpCode(201)
  appealRating(
    @Req() req: AuthedRequest,
    @Param('accountId', uuid) accountId: string,
    @Param('ratingId', uuid) ratingId: string,
    @Body(new ZodPipe(appealCreateSchema)) b: z.output<typeof appealCreateSchema>,
  ) {
    return this.appeals.appeal(req.user.sub, accountId, ratingId, b.metin, req.ip);
  }

  @Get('galeriler/:slug/takip')
  followState(@Req() req: AuthedRequest, @Param('slug') slug: string) {
    return this.trust.followState(req.user.sub, slug);
  }

  @Put('galeriler/:slug/takip')
  follow(@Req() req: AuthedRequest, @Param('slug') slug: string) {
    return this.trust.follow(req.user.sub, slug, true);
  }

  @Delete('galeriler/:slug/takip')
  @HttpCode(200)
  unfollow(@Req() req: AuthedRequest, @Param('slug') slug: string) {
    return this.trust.follow(req.user.sub, slug, false);
  }
}

/** Konsol › Satıcı puanı ve rozetler */
@Controller('staff/trust')
@UseGuards(StaffGuard)
export class StaffTrustController {
  constructor(
    private readonly trust: TrustService,
    private readonly appeals: RatingAppealService,
  ) {}

  @Get('overview')
  @RequirePermission('rapor.gor')
  overview() {
    return this.trust.staffOverview();
  }

  /** Moderasyon › İtirazlar: galerinin 1 yıldıza itirazları */
  @Get('appeals')
  @RequirePermission('sikayet.coz', 'tam')
  ratingAppeals() {
    return this.appeals.staffList();
  }

  @Post('appeals/:id/decide')
  @HttpCode(200)
  @RequirePermission('sikayet.coz', 'tam')
  decideRatingAppeal(
    @Req() req: StaffRequest,
    @Param('id', uuid) id: string,
    @Body(new ZodPipe(appealDecideSchema)) b: z.output<typeof appealDecideSchema>,
  ) {
    return this.appeals.decide(req.staff, id, b, req.ip);
  }
}
