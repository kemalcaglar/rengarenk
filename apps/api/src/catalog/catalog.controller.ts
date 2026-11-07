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
import type { Prisma } from '@rengarenk/db';
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

/** Veritabanı sıralaması Türkçe alfabeyi bilmez (Ş'yi S'nin önüne koyar); listeler Türkçe kurallarla sıralanır. */
const trOrder = <T extends { name: string }>(rows: T[]) =>
  rows.sort((a, b) => a.name.localeCompare(b.name, 'tr', { numeric: true }));

/**
 * Araç kataloğu (Karar 32–33): sihirbaz, portföy ve filtreler marka → seri → model, kasa ve makyaj, paket
 * seçimlerini buradan alır. Giriş gerekmez. Kasko bedeli hiçbir yanıtta yoktur.
 */
@Controller('catalog')
export class CatalogController {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  /** Konsoldan kapatılan kaynakların kayıtları görünmez (silinmez). */
  private async visible(kategori?: string): Promise<Prisma.CatalogVariantWhereInput> {
    const active = await this.db.catalogSource.findMany({ where: { active: true }, select: { key: true } });
    return {
      source: { in: active.map((a) => a.key) },
      ...(kategori ? { categories: { has: kategori } } : {}),
    };
  }

  @Get('makes')
  async makes(@Query('kategori', new ZodPipe(categorySchema)) kategori?: string) {
    return trOrder(
      await this.db.catalogMake.findMany({
        where: { variants: { some: await this.visible(kategori) } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
    );
  }

  @Get('makes/:id/series')
  async series(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('kategori', new ZodPipe(categorySchema)) kategori?: string,
  ) {
    return trOrder(
      await this.db.catalogSeries.findMany({
        where: { makeId: id, variants: { some: await this.visible(kategori) } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, categories: true },
      }),
    );
  }

  /** Seri katmanı olmayan kategoriler (motosiklet, ATV) için markanın modelleri */
  @Get('makes/:id/models')
  async makeModels(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('kategori', new ZodPipe(categorySchema)) kategori?: string,
  ) {
    return trOrder(
      await this.db.catalogModel.findMany({
        where: {
          makeId: id,
          seriesId: null,
          variants: { some: await this.visible(kategori) },
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
    );
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
      where: { seriesId: id, ...(await this.visible()), ...(yil ? { years: { has: yil } } : {}) },
      select: {
        years: true,
        generation: { select: { id: true, name: true, code: true, startYear: true, endYear: true } },
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
    const generations = [...group((v) => v.generation?.id ?? null)]
      .map(([gid, vs]) => ({
        id: gid,
        name: vs[0]?.generation?.name,
        code: vs[0]?.generation?.code ?? null,
        startYear: vs[0]?.generation?.startYear ?? null,
        endYear: vs[0]?.generation?.endYear ?? null,
        years: yearsOf(vs),
        bodies: [...new Set(vs.map((v) => v.body).filter(Boolean))],
      }))
      .sort((a, b) => (a.startYear ?? 0) - (b.startYear ?? 0));
    const byName = (a: { name?: string | null }, b: { name?: string | null }) =>
      (a.name ?? '').localeCompare(b.name ?? '', 'tr');
    return {
      ...s,
      years: yearsOf(variants),
      models: models.sort(byName),
      bodies: bodies.sort(byName),
      /** Kasa kuşakları (nesiller); TSB'de yoktur, açık kaynaklardan gelir */
      generations,
      makyaj: {
        makyajsiz: yearsOf(variants.filter((v) => !v.facelift)),
        makyajli: yearsOf(variants.filter((v) => v.facelift)),
      },
      trims: trims.sort(byName),
    };
  }
}

const sourcePatchSchema = z
  .object({ autoFetch: z.boolean().optional(), active: z.boolean().optional() })
  .strict()
  .refine((v) => v.autoFetch !== undefined || v.active !== undefined, { message: 'Değişiklik yok' });

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
      const after = await tx.catalogSource.update({ where: { key }, data: body });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: req.staff.staff.id,
          action: 'katalog_kaynak_ayari',
          entityType: 'setting',
          entityId: `katalog.${key}`,
          before: { otomatik: before.autoFetch, etkin: before.active },
          after: { otomatik: after.autoFetch, etkin: after.active },
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
    @Query('arsiv') arsiv?: string,
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
      archive: arsiv === '1',
      staffId: req.staff.staff.id,
      ip: req.ip,
    });
  }

  /** TSB arşivinden eski model yıllarını tamamla (2020'den bugüne her yılın ilk dosyası). */
  @Post('tsb/archive')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  archive(@Req() req: StaffRequest) {
    return this.pipeline.backfillTsbArchive({ staffId: req.staff.staff.id, ip: req.ip });
  }

  /** "Şimdi kontrol et": kaynakta yeni dosya ya da sürüm varsa indirip işler. */
  @Post('sources/:key/check')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  checkSource(@Req() req: StaffRequest, @Param('key') key: string) {
    return this.pipeline.checkSource(key, { force: true, staffId: req.staff.staff.id, ip: req.ip });
  }

  /** "Şimdi kontrol et": TSB'de yeni dosya varsa indirip işler (otomatik çekme kapalı olsa da). */
  @Post('tsb/check')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  check(@Req() req: StaffRequest) {
    return this.pipeline.checkTsb({ force: true, staffId: req.staff.staff.id, ip: req.ip });
  }
}
