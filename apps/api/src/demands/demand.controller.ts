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
import { demandCompleteSchema, demandCreateSchema, demandUpdateSchema } from '@rengarenk/shared';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { type AccessClaims, AuthService } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DemandSearchService } from '../search/demand-search.service.js';
import { DemandService } from './demand.service.js';

type AuthedRequest = { user: AccessClaims; ip: string };

/** Tekrarlanan ya da virgülle ayrılmış sorgu değeri → dizi */
const liste = z
  .union([z.string(), z.array(z.string())])
  .transform((v) =>
    (Array.isArray(v) ? v : v.split(','))
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 30),
  )
  .optional();
const sayi = z.coerce.number().int().min(0).max(1_000_000_000).optional();
const listQuery = z
  .object({
    kategori: z.string().max(60).optional(),
    marka: z.string().max(200).optional(),
    seri: liste,
    model: z.string().max(200).optional(),
    makyaj: liste,
    paket: liste,
    yilMin: sayi,
    yilMax: sayi,
    butceMin: sayi,
    butceMax: sayi,
    il: z.string().max(40).optional(),
    ilce: z.string().max(60).optional(),
    telefon: z
      .enum(['1', 'true'])
      .transform(() => true)
      .optional(),
    q: z.string().max(120).optional(),
    sira: z.enum(['onerilen', 'yeni', 'butce_azalan', 'butce_artan']).optional(),
    sayfa: z.coerce.number().int().min(1).max(500).optional(),
    boyut: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strip();

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
  constructor(private readonly demands: DemandService) {}

  @Get('mine')
  mine(@Req() req: AuthedRequest) {
    return this.demands.mine(req.user.sub);
  }

  @Get('rights')
  rights(@Req() req: AuthedRequest) {
    return this.demands.rights(req.user.sub);
  }

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(demandCreateSchema)) body: z.output<typeof demandCreateSchema>,
  ) {
    return this.demands.create(req.user.sub, body.kategori);
  }

  @Get(':id')
  detail(@Req() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.demands.ownerDetail(req.user.sub, id);
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
