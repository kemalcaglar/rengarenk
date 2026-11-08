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
  Req,
  UseGuards,
} from '@nestjs/common';
import { demandCompleteSchema, demandCreateSchema, demandUpdateSchema } from '@rengarenk/shared';
import type { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { type AccessClaims, AuthService } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { DemandService } from './demand.service.js';

type AuthedRequest = { user: AccessClaims; ip: string };

/** Herkese açık talep sayfası; jeton varsa izin verilen telefon numarası görünür (Karar 11.4). */
@Controller('talepler')
export class PublicDemandsController {
  constructor(
    private readonly demands: DemandService,
    private readonly auth: AuthService,
  ) {}

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
