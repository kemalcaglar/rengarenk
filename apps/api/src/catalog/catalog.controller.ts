import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { VEHICLE_CATEGORIES } from '@rengarenk/shared';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { CatalogPipelineService, STALE_HOURS } from './catalog-pipeline.service.js';
import { XLSX_MIME } from './xlsx-body.js';

const categorySchema = z.enum(VEHICLE_CATEGORIES.map((c) => c.slug) as [string, ...string[]]).optional();
const yearSchema = z.coerce.number().int().min(1950).max(2100).optional();

const uniqSorted = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

/**
 * Araç kataloğu (Karar 32–33): sihirbaz, portföy ve filtreler marka → seri → model, kasa ve makyaj, paket
 * seçimlerini buradan alır. Giriş gerekmez. Kasko bedeli hiçbir yanıtta yoktur.
 */
@Controller('catalog')
export class CatalogController {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  @Get('makes')
  makes(@Query('kategori', new ZodPipe(categorySchema)) kategori?: string) {
    return this.db.catalogMake.findMany({
      where: kategori ? { variants: { some: { categories: { has: kategori } } } } : {},
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  @Get('makes/:id/series')
  series(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('kategori', new ZodPipe(categorySchema)) kategori?: string,
  ) {
    return this.db.catalogSeries.findMany({
      where: { makeId: id, ...(kategori ? { categories: { has: kategori } } : {}) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, categories: true },
    });
  }

  /** Seri katmanı olmayan kategoriler (motosiklet, ATV) için markanın modelleri */
  @Get('makes/:id/models')
  async makeModels(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('kategori', new ZodPipe(categorySchema)) kategori?: string,
  ) {
    return this.db.catalogModel.findMany({
      where: {
        makeId: id,
        seriesId: null,
        ...(kategori ? { variants: { some: { categories: { has: kategori } } } } : {}),
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  /**
   * Bir serinin seçenekleri: modeller (motor sürümleri), kasa tipleri, makyajsız / makyajlı yılları ve
   * donanım paketleri, her biri hangi model yıllarında var olduğuyla. `yil` verilirse o yıla daraltılır.
   */
  @Get('series/:id')
  async seriesDetail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('yil', new ZodPipe(yearSchema)) yil?: number,
  ) {
    const s = await this.db.catalogSeries.findUnique({
      where: { id },
      select: { id: true, name: true, categories: true, make: { select: { id: true, name: true } } },
    });
    if (!s) throw new NotFoundException('Seri bulunamadı');
    const variants = await this.db.catalogVariant.findMany({
      where: { seriesId: id, ...(yil ? { years: { has: yil } } : {}) },
      select: {
        years: true,
        body: true,
        facelift: true,
        fuel: true,
        gearbox: true,
        engineL: true,
        powerHp: true,
        powerKw: true,
        model: { select: { id: true, name: true } },
        trim: { select: { id: true, name: true } },
      },
    });
    const yearsOf = (vs: typeof variants) =>
      uniqSorted(vs.flatMap((v) => v.years).filter((y) => !yil || y === yil));
    const group = <K extends string>(keyOf: (v: (typeof variants)[number]) => K | null) => {
      const m = new Map<K, typeof variants>();
      for (const v of variants) {
        const k = keyOf(v);
        if (k === null) continue;
        m.set(k, [...(m.get(k) ?? []), v]);
      }
      return m;
    };

    const models = [...group((v) => v.model.id)].map(([mid, vs]) => ({
      id: mid,
      name: vs[0]?.model.name,
      years: yearsOf(vs),
      fuels: [...new Set(vs.map((v) => v.fuel).filter(Boolean))],
      powerHp: uniqSorted(vs.map((v) => v.powerHp ?? 0).filter(Boolean)),
    }));
    const bodies = [...group((v) => v.body)].map(([name, vs]) => ({ name, years: yearsOf(vs) }));
    const trims = [...group((v) => v.trim?.id ?? null)].map(([tid, vs]) => ({
      id: tid,
      name: vs[0]?.trim?.name,
      years: yearsOf(vs),
      modelIds: [...new Set(vs.map((v) => v.model.id))],
    }));
    const byName = (a: { name?: string | null }, b: { name?: string | null }) =>
      (a.name ?? '').localeCompare(b.name ?? '', 'tr');
    return {
      ...s,
      years: yearsOf(variants),
      models: models.sort(byName),
      bodies: bodies.sort(byName),
      makyaj: {
        makyajsiz: yearsOf(variants.filter((v) => !v.facelift)),
        makyajli: yearsOf(variants.filter((v) => v.facelift)),
      },
      trims: trims.sort(byName),
    };
  }
}

const sourcePatchSchema = z.object({ autoFetch: z.boolean() }).strict();

/** Yönetim: katalog kaynaklarını izleme (Karar 33: konsoldaki katalog bölümü yalnızca izleme içindir). */
@Controller('staff/catalog')
@UseGuards(StaffGuard)
export class StaffCatalogController {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly pipeline: CatalogPipelineService,
    private readonly audit: AuditService,
  ) {}

  @Get('sources')
  @RequirePermission('kategori.ayarla')
  async sources() {
    const rows = await this.db.catalogSource.findMany({ orderBy: { key: 'asc' } });
    const limit = Date.now() - STALE_HOURS * 3600_000;
    const counts = await this.db.$queryRaw<{ source: string; total: bigint; latest: bigint }[]>`
      SELECT source, count(*) AS total, count(*) FILTER (WHERE in_latest) AS latest FROM catalog_variants GROUP BY source`;
    return rows.map((s) => {
      const c = counts.find((x) => x.source === s.key);
      return {
        ...s,
        variants: Number(c?.total ?? 0),
        variantsInLatest: Number(c?.latest ?? 0),
        stale: s.autoFetch && Boolean(s.lastError) && (!s.lastSuccessAt || s.lastSuccessAt.getTime() < limit),
      };
    });
  }

  @Patch('sources/:key')
  @RequirePermission('kategori.ayarla')
  async updateSource(
    @Req() req: StaffRequest,
    @Param('key') key: string,
    @Body(new ZodPipe(sourcePatchSchema)) body: z.output<typeof sourcePatchSchema>,
  ) {
    return this.db.$transaction(async (tx) => {
      const before = await tx.catalogSource.findUnique({ where: { key } });
      if (!before) throw new NotFoundException('Kaynak bulunamadı');
      const after = await tx.catalogSource.update({ where: { key }, data: { autoFetch: body.autoFetch } });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: req.staff.staff.id,
          action: 'katalog_kaynak_ayari',
          entityType: 'setting',
          entityId: `katalog.${key}`,
          before: { otomatik: before.autoFetch },
          after: { otomatik: after.autoFetch },
          ip: req.ip,
        },
        tx,
      );
      return after;
    });
  }

  @Get('imports')
  @RequirePermission('kategori.ayarla')
  imports(@Query('kaynak') kaynak?: string) {
    return this.db.catalogImport.findMany({
      where: kaynak ? { sourceKey: kaynak } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** TSB dosyasını konsoldan yükleme. Gövde: xlsx dosyasının kendisi; dosya adı `x-dosya-adi` başlığında. */
  @Post('tsb/upload')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  upload(
    @Req() req: StaffRequest & { body: unknown },
    @Headers('content-type') contentType?: string,
    @Headers('x-dosya-adi') fileName?: string,
  ) {
    if (!contentType?.startsWith(XLSX_MIME) || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new BadRequestException('Bir Excel (.xlsx) dosyası yükle');
    }
    const name = fileName
      ? decodeURIComponent(fileName)
          .replace(/[^\w.-]/g, '_')
          .slice(0, 120)
      : undefined;
    return this.pipeline.runTsbFile(new Uint8Array(req.body), {
      fileName: name,
      trigger: 'elle',
      staffId: req.staff.staff.id,
      ip: req.ip,
    });
  }

  /** "Şimdi kontrol et": TSB'de yeni dosya varsa indirip işler (otomatik çekme kapalı olsa da). */
  @Post('tsb/check')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  check(@Req() req: StaffRequest) {
    return this.pipeline.checkTsb({ force: true, staffId: req.staff.staff.id, ip: req.ip });
  }
}
