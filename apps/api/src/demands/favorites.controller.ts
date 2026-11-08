import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { savedSearchCreateSchema, savedSearchUpdateSchema } from '@rengarenk/shared';
import type { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { FavoritesService } from './favorites.service.js';

type AuthedRequest = { user: AccessClaims };

/** Favori talepler (Karar 06.4) */
@Controller('favorites')
@UseGuards(AuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.favorites.list(req.user.sub);
  }

  @Put(':no')
  @HttpCode(204)
  async add(@Req() req: AuthedRequest, @Param('no', new ParseIntPipe()) no: number) {
    await this.favorites.add(req.user.sub, no);
  }

  @Delete(':no')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param('no', new ParseIntPipe()) no: number) {
    await this.favorites.remove(req.user.sub, no);
  }
}

/** Kayıtlı aramalar (Karar 30): en fazla 10, her biri için bildirim tercihi */
@Controller('saved-searches')
@UseGuards(AuthGuard)
export class SavedSearchesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.favorites.searches(req.user.sub);
  }

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodPipe(savedSearchCreateSchema)) body: z.output<typeof savedSearchCreateSchema>,
  ) {
    return this.favorites.createSearch(req.user.sub, body.ad, body.sorgu);
  }

  @Patch(':id')
  @HttpCode(204)
  async update(
    @Req() req: AuthedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(savedSearchUpdateSchema)) body: z.output<typeof savedSearchUpdateSchema>,
  ) {
    await this.favorites.updateSearch(req.user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.favorites.removeSearch(req.user.sub, id);
  }
}
