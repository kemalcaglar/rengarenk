import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { TeknikDuzeltmeService } from './teknik-duzeltme.service.js';

const yil = z.coerce.number().int().min(1900).max(2100);
const durumSchema = z.enum(['acik', 'kapali']).optional();
const kararSchema = z.object({ durum: z.enum(['duzeltildi', 'reddedildi']) }).strict();
const yilSorgu = z
  .object({ yilBas: yil.optional(), yilSon: yil.optional() })
  .refine((v) => !v.yilBas || !v.yilSon || v.yilBas <= v.yilSon, 'Yıl aralığı ters');
const ekleSchema = z
  .object({
    yilBas: yil.nullable().optional(),
    yilSon: yil.nullable().optional(),
    /** Alan → [en az, en çok] ya da metin listesi; servis alan tanımına göre denetler */
    degerler: z.record(z.string(), z.union([z.tuple([z.number(), z.number()]), z.array(z.string())])),
    not: z.string().trim().max(500).nullable().optional(),
    /** Bir bildirimden gelindiyse: düzeltmeyle birlikte kapanır */
    bildirim: z.uuid().nullable().optional(),
  })
  .strict()
  .refine((v) => !v.yilBas || !v.yilSon || v.yilBas <= v.yilSon, 'Yıl aralığı ters');

/**
 * Konsol › Katalog › Teknik özellikler (sahip isteği, 17 Kasım 2026): kullanıcıların "yanlış" bildirimleri ve motor
 * sürümlerinin değerlerini elle düzeltme ya da ekleme.
 */
@Controller('staff/catalog/teknik')
@UseGuards(StaffGuard)
export class StaffTeknikController {
  constructor(private readonly teknik: TeknikDuzeltmeService) {}

  @Get('bildirimler')
  @RequirePermission('kategori.ayarla')
  bildirimler(@Query('durum', new ZodPipe(durumSchema)) durum?: 'acik' | 'kapali') {
    return this.teknik.bildirimler(durum);
  }

  @Post('bildirimler/:id')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  karar(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(kararSchema)) b: z.output<typeof kararSchema>,
  ) {
    return this.teknik.bildirimKarar(id, b.durum, req.staff.staff.id, req.ip);
  }

  @Get('seri/:id')
  @RequirePermission('kategori.ayarla')
  seri(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.teknik.seriModelleri(id);
  }

  @Get('model/:id')
  @RequirePermission('kategori.ayarla')
  model(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query(new ZodPipe(yilSorgu)) q: z.output<typeof yilSorgu>,
  ) {
    const a =
      q.yilBas || q.yilSon ? ([q.yilBas ?? q.yilSon, q.yilSon ?? q.yilBas] as [number, number]) : null;
    return this.teknik.model(id, a);
  }

  @Post('model/:id')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  ekle(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(ekleSchema)) b: z.output<typeof ekleSchema>,
  ) {
    return this.teknik.ekle(id, b, req.staff.staff.id, req.ip);
  }

  @Post('duzeltme/:id/kaldir')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  kaldir(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.teknik.kaldir(id, req.staff.staff.id, req.ip);
  }
}
