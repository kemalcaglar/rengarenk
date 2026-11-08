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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { categoryCreateSchema, categoryUpdateSchema } from '@rengarenk/shared';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { CategoryService } from './category.service.js';

const versionQuery = z.coerce.number().int().positive().optional();

/** Kategoriler: web ve mobil menü, ana sayfa ve talep sihirbazı bu uçları okur (giriş gerekmez). */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoryService) {}

  @Get()
  tree() {
    return this.categories.publicTree();
  }

  /** Yayındaki şema; `surum` verilirse o sürüm (eski talepler oluşturuldukları sürümle okunur). */
  @Get(':slug/schema')
  schema(@Param('slug') slug: string, @Query('surum', new ZodPipe(versionQuery)) surum?: number) {
    return this.categories.schema(slug, surum);
  }
}

/** Konsol › Katalog › Kategoriler ve alanlar, Eşleştirme ayarı (yetki: "Kategori, alan ve eşleştirme ayarı"). */
@Controller('staff/categories')
@UseGuards(StaffGuard)
export class StaffCategoriesController {
  constructor(private readonly categories: CategoryService) {}

  @Get()
  @RequirePermission('kategori.ayarla')
  list() {
    return this.categories.staffTree();
  }

  @Post()
  @RequirePermission('kategori.ayarla')
  create(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(categoryCreateSchema)) body: z.output<typeof categoryCreateSchema>,
  ) {
    return this.categories.create(req.staff, body, req.ip);
  }

  @Get(':id')
  @RequirePermission('kategori.ayarla')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.categories.detail(id);
  }

  @Patch(':id')
  @RequirePermission('kategori.ayarla')
  update(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(categoryUpdateSchema)) body: z.output<typeof categoryUpdateSchema>,
  ) {
    return this.categories.update(req.staff, id, body, req.ip);
  }

  @Put(':id/draft')
  @RequirePermission('kategori.ayarla')
  saveDraft(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.categories.saveDraft(req.staff, id, body, req.ip);
  }

  @Delete(':id/draft')
  @HttpCode(204)
  @RequirePermission('kategori.ayarla')
  async discard(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.categories.discardDraft(req.staff, id, req.ip);
  }

  @Post(':id/draft/submit')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  submit(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.categories.submit(req.staff, id, req.ip);
  }

  @Post(':id/versions/:version/restore')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  restore(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('version', new ParseIntPipe()) version: number,
  ) {
    return this.categories.restore(req.staff, id, version, req.ip);
  }
}
