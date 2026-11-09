import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  assistantSchema,
  demandCompleteSchema,
  demandCreateSchema,
  demandPromoteSchema,
  demandSearchQuerySchema,
  demandUpdateSchema,
  FLAG_PLATFORMS,
  type FlagPlatform,
} from '@rengarenk/shared';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { type AccessClaims, AuthService } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DemandSearchService } from '../search/demand-search.service.js';
import { DemandService } from './demand.service.js';
import { DemandAssistant } from './demand-assistant.js';

const platformOf = (p?: string): FlagPlatform | undefined => {
  const u = p?.toUpperCase();
  return FLAG_PLATFORMS.includes(u as FlagPlatform) ? (u as FlagPlatform) : undefined;
};

type AuthedRequest = { user: AccessClaims; ip: string };

const listQuery = demandSearchQuerySchema;

/** Herkese açık talep sayfası; jeton varsa izin verilen telefon numarası görünür (Karar 11.4). */
@Controller('talepler')
export class PublicDemandsController {
  constructor(
    private readonly demands: DemandService,
    private readonly auth: AuthService,
    private readonly search: DemandSearchService,
  ) {}

  /** Talep listesi ve arama (Karar 06.1, 06.3): yalnızca yayındaki talepler. */
  @Get()
  list(@Query(new ZodPipe(listQuery)) q: z.output<typeof listQuery>) {
    return this.search.search(q);
  }

  /** Ana sayfa vitrini (Karar 46): karışık sıra */
  @Get('vitrin')
  vitrin(@Query('boyut') boyut?: string) {
    const n = Number(boyut);
    return this.search.vitrin(Number.isInteger(n) && n > 0 ? n : 17);
  }

  @Get(':no')
  async detail(
    @Param('no', new ParseIntPipe()) no: number,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer = authorization?.startsWith('Bearer ')
      ? await this.auth
          .verifyAccess(authorization.slice(7))
          .then((c) => c.sub)
          .catch(() => undefined)
      : undefined;
    return this.demands.publicDetail(no, viewer);
  }
}

/** Alıcının talepleri: sihirbaz taslağı, yayın ve yaşam döngüsü (Karar 09, 10, 21). */
@Controller('demands')
@UseGuards(AuthGuard)
export class DemandsController {
  constructor(
    private readonly demands: DemandService,
    private readonly asistan: DemandAssistant,
  ) {}

  @Get('mine')
  mine(@Req() req: AuthedRequest) {
    return this.demands.mine(req.user.sub);
  }

  @Get('rights')
  rights(@Req() req: AuthedRequest, @Query('hesap') hesap?: string) {
    return this.demands.rights(req.user.sub, hesap && /^[0-9a-f-]{36}$/i.test(hesap) ? hesap : undefined);
  }

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(demandCreateSchema)) body: z.output<typeof demandCreateSchema>,
  ) {
    return this.demands.create(req.user.sub, body.kategori, body.hesap);
  }

  /** Hakla öne çıkarma (paketin aylık hakkı ya da talep seçilmeden alınmış hak) */
  @Post(':id/promote')
  promote(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(demandPromoteSchema)) body: z.output<typeof demandPromoteSchema>,
  ) {
    return this.demands.promote(req.user.sub, id, body.tur, req.ip);
  }

  @Get(':id')
  async detail(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('x-rr-platform') platform?: string,
  ) {
    const d = await this.demands.ownerDetail(req.user.sub, id);
    /** Talep asistanı bu kişi ve platform için açık mı (Karar 42, özellik anahtarı) */
    const asistan = d.status === 'DRAFT' && (await this.asistan.acik(req.user.sub, platformOf(platform)));
    return { ...d, asistan };
  }

  /** Talep asistanı: serbest metinden taslağı doldurur; alıcı kontrol edip kendisi yayınlar (Karar 42) */
  @Post(':id/asistan')
  @HttpCode(200)
  doldur(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(assistantSchema)) body: z.output<typeof assistantSchema>,
    @Headers('x-rr-platform') platform?: string,
  ) {
    return this.asistan.doldur(req.user.sub, id, body.metin, platformOf(platform));
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(demandUpdateSchema)) body: z.output<typeof demandUpdateSchema>,
  ) {
    return this.demands.update(req.user.sub, id, body, req.ip);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Req() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.demands.publish(req.user.sub, id, req.ip);
  }

  @Post(':id/passivate')
  @HttpCode(200)
  passivate(@Req() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.demands.passivate(req.user.sub, id, req.ip);
  }

  @Post(':id/activate')
  @HttpCode(200)
  activate(@Req() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.demands.activate(req.user.sub, id, req.ip);
  }

  @Post(':id/extend')
  @HttpCode(200)
  extend(@Req() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.demands.extend(req.user.sub, id, req.ip);
  }

  @Post(':id/close')
  @HttpCode(200)
  close(@Req() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.demands.close(req.user.sub, id, req.ip);
  }

  @Post(':id/complete')
  @HttpCode(200)
  complete(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(demandCompleteSchema)) body: z.output<typeof demandCompleteSchema>,
  ) {
    return this.demands.complete(req.user.sub, id, body.foundVia, req.ip);
  }
}
