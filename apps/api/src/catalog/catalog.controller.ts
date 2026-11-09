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
  Res,
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
import { CatalogAliasService } from './catalog-alias.service.js';
import { CatalogImageService } from './catalog-image.service.js';
import { CatalogPipelineService, STALE_HOURS } from './catalog-pipeline.service.js';
import { makyajFoto } from './photo-pick.js';
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
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly images: CatalogImageService,
  ) {}

  /** Seçilmiş nesil fotoğrafı (Karar 34): depodaki kopya. Atfı seri ayrıntısındaki `photo.caption`'dadır. */
  @Get('images/:id')
  async image(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() reply: { header: (k: string, v: string) => unknown; send: (b: unknown) => unknown },
  ) {
    const f = await this.images.file(id);
    reply.header('content-type', f.contentType ?? 'image/jpeg');
    reply.header('cache-control', 'public, max-age=604800, immutable');
    // Temsilî fotoğraf web sitesinde ve uygulamada gösterilir (başka köken); helmet'in "same-origin" varsayılanı burada gevşer
    reply.header('cross-origin-resource-policy', 'cross-origin');
    if (f.sha256) reply.header('etag', `"${f.sha256}"`);
    return reply.send(f.body);
  }

  /** Konsoldan kapatılan kaynakların kayıtları görünmez (silinmez). */
  private async visible(kategori?: string): Promise<Prisma.CatalogVariantWhereInput> {
    const active = await this.db.catalogSource.findMany({ where: { active: true }, select: { key: true } });
    return {
      source: { in: active.map((a) => a.key) },
      ...(kategori ? { categories: { has: kategori } } : {}),
    };
  }

  /**
   * Veri kaynakları ve atıflar (Teknik tasarım §5; CC BY ve ODbL atıf koşulu): sitenin ve uygulamanın "Veri
   * kaynakları" sayfası buradan okur. Yalnızca etkin kaynaklar; kaynağın zorunlu atıf metni olduğu gibi döner.
   */
  @Get('attributions')
  async attributions() {
    const rows = await this.db.catalogSource.findMany({
      where: { active: true },
      orderBy: { key: 'asc' },
      select: { key: true, name: true, license: true, attribution: true, url: true, notice: true },
    });
    const order = ['tsb', 'vehiclesdb', 'wikidata', 'vmm', 'yerli'];
    return [
      ...rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)),
      // İl komşulukları (eşleştirmede komşu il; `il-komsulari.ts`): il sınırlarından hesaplandı, katalog hattı değil
      {
        key: 'iller',
        name: 'İl komşulukları (eşleştirme)',
        license: 'CC BY-SA 2.0',
        attribution:
          'İl sınırları © OpenStreetMap katkıcıları, geoBoundaries (William & Mary geoLab) üzerinden',
        url: 'https://www.geoboundaries.org',
        notice: null,
      },
    ];
  }

  @Get('makes')
  async makes(@Query('kategori', new ZodPipe(categorySchema)) kategori?: string) {
    return trOrder(
      await this.db.catalogMake.findMany({
        where: { variants: { some: await this.visible(kategori) } },
        orderBy: { name: 'asc' },
        select: { id: true, key: true, name: true },
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
        select: { id: true, key: true, name: true, categories: true },
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
        select: { id: true, key: true, name: true },
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
      select: {
        id: true,
        key: true,
        name: true,
        categories: true,
        make: { select: { id: true, key: true, name: true } },
      },
    });
    if (!s) throw new NotFoundException('Seri bulunamadı');
    const variants = await this.db.catalogVariant.findMany({
      where: { seriesId: id, ...(await this.visible()), ...(yil ? { years: { has: yil } } : {}) },
      select: {
        years: true,
        body: true,
        facelift: true,
        fuel: true,
        gearbox: true,
        engineL: true,
        powerHp: true,
        powerKw: true,
        model: { select: { id: true, key: true, name: true } },
        trim: { select: { id: true, key: true, name: true } },
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
      key: vs[0]?.model.key,
      name: vs[0]?.model.name,
      years: yearsOf(vs),
      fuels: [...new Set(vs.map((v) => v.fuel).filter(Boolean))],
      powerHp: uniqSorted(vs.map((v) => v.powerHp ?? 0).filter(Boolean)),
    }));
    const bodies = [...group((v) => v.body)].map(([name, vs]) => ({ name, years: yearsOf(vs) }));
    const trims = [...group((v) => v.trim?.id ?? null)].map(([tid, vs]) => ({
      id: tid,
      key: vs[0]?.trim?.key,
      name: vs[0]?.trim?.name,
      years: yearsOf(vs),
      modelIds: [...new Set(vs.map((v) => v.model.id))],
    }));
    // Kasa kuşakları tablodan gelir (tip kaydı olmayan yıllar dahil); kapalı kaynağınkiler görünmez.
    const activeSources = (await this.visible()).source as { in: string[] };
    const thisYear = new Date().getFullYear();
    const genRows = await this.db.catalogGeneration.findMany({
      where: {
        seriesId: id,
        source: activeSources,
        ...(yil ? { startYear: { lte: yil }, OR: [{ endYear: null }, { endYear: { gte: yil } }] } : {}),
      },
      select: {
        id: true,
        key: true,
        source: true,
        name: true,
        code: true,
        body: true,
        startYear: true,
        endYear: true,
        facelift: true,
        wikidataId: true,
        commonsCategory: true,
      },
      orderBy: [{ startYear: 'asc' }, { name: 'asc' }],
    });
    const span = (g: { startYear: number; endYear: number | null }) =>
      Array.from(
        { length: Math.max((g.endYear ?? thisYear) - g.startYear + 1, 0) },
        (_, i) => g.startYear + i,
      ).filter((y) => !yil || y === yil);
    const phases = genRows.filter((g) => g.source !== 'wikidata');
    // Nesil fotoğrafı (Karar 34) kod satırına bağlıdır; aynı koddaki kasa kuşakları onu paylaşır.
    const codeRows = genRows.filter((g) => g.source === 'wikidata');
    const selected = await this.db.catalogImage.findMany({
      where: { status: 'secildi', generationId: { in: codeRows.map((g) => g.id) } },
    });
    // Makyaj başına fotoğraf (Karar 34): kuşağın makyajı, yoksa nesil geneli
    const photoOf = (wikidataId: string | null, makyaj: number | null) => {
      const owner = wikidataId ? codeRows.find((g) => g.wikidataId === wikidataId) : undefined;
      const f = owner
        ? makyajFoto(
            selected.filter((i) => i.generationId === owner.id),
            makyaj,
          )
        : undefined;
      return f ? CatalogImageService.publicPhoto(f) : null;
    };
    const generations = phases.map((g) => ({
      ...g,
      years: span(g),
      photo: photoOf(g.wikidataId, g.facelift),
    }));
    const codes = codeRows.map(
      ({ id: cid, code, name, startYear, endYear, wikidataId, commonsCategory }) => ({
        id: cid,
        code,
        name,
        startYear,
        endYear,
        wikidataId,
        commonsCategory,
        photo: photoOf(wikidataId, null),
      }),
    );

    // Makyaj: nesil kodu eşleşen kuşaklarda sıradan (0 makyajsız, 1+ makyajlı); kodlanmamış yıllarda TSB'nin
    // tip adındaki işaretinden (LCI, FL).
    const coded = phases.filter((g) => g.facelift !== null);
    const codedYears = new Set(coded.flatMap(span));
    const tsbYears = (vs: typeof variants) => yearsOf(vs).filter((y) => !codedYears.has(y));
    const makyaj = {
      makyajsiz: uniqSorted([
        ...coded.filter((g) => g.facelift === 0).flatMap(span),
        ...tsbYears(variants.filter((v) => !v.facelift)),
      ]),
      makyajli: uniqSorted([
        ...coded.filter((g) => (g.facelift ?? 0) > 0).flatMap(span),
        ...tsbYears(variants.filter((v) => v.facelift)),
      ]),
    };
    const byName = (a: { name?: string | null }, b: { name?: string | null }) =>
      (a.name ?? '').localeCompare(b.name ?? '', 'tr');
    return {
      ...s,
      years: yearsOf(variants),
      models: models.sort(byName),
      bodies: bodies.sort(byName),
      /** Kasa kuşakları (kasa başına, makyaj sırasıyla); TSB'de yoktur, açık kaynaklardan gelir */
      generations,
      /** Nesil kodları (E46, Mk7 …) ve Commons kategorisi; Wikidata */
      codes,
      makyaj,
      trims: trims.sort(byName),
    };
  }
}

const sourcePatchSchema = z
  .object({ autoFetch: z.boolean().optional(), active: z.boolean().optional() })
  .strict()
  .refine((v) => v.autoFetch !== undefined || v.active !== undefined, { message: 'Değişiklik yok' });

const aliasStatusSchema = z.enum(['onerildi', 'onaylandi', 'reddedildi']).optional();
const imageStatusSchema = z.enum(['bekleyen', 'secili']).optional();
const aliasCreateSchema = z.object({ fromSeriesId: z.uuid(), toSeriesId: z.uuid() }).strict();
const aliasApproveSchema = z
  .object({ toKey: z.string().min(3).max(200).optional() })
  .strict()
  .optional()
  .transform((v) => v ?? {});

const imageSelectSchema = z
  .object({ makyaj: z.number().int().min(0).max(5).nullable().optional() })
  .strict()
  .optional()
  .transform((v) => v ?? {});
const oran = z.number().min(0).max(1);
const imageBlurSchema = z
  .object({
    alanlar: z
      .array(z.object({ x: oran, y: oran, w: oran.positive(), h: oran.positive() }).strict())
      .min(1)
      .max(6),
  })
  .strict();

/** Yönetim: katalog kaynaklarını izleme (Karar 33: konsoldaki katalog bölümü yalnızca izleme içindir). */
@Controller('staff/catalog')
@UseGuards(StaffGuard)
export class StaffCatalogController {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly pipeline: CatalogPipelineService,
    private readonly audit: AuditService,
    private readonly aliases: CatalogAliasService,
    private readonly images: CatalogImageService,
  ) {}

  // ── Nesil fotoğrafları (Karar 34) ────────────────────────────────

  @Get('images')
  @RequirePermission('kategori.ayarla')
  imageReview(@Query('durum', new ZodPipe(imageStatusSchema)) durum?: 'bekleyen' | 'secili') {
    return this.images.review({ durum });
  }

  @Post('images/:id/select')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  imageSelect(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(imageSelectSchema)) body: z.output<typeof imageSelectSchema>,
  ) {
    return this.images.select(id, req.staff.staff.id, req.ip, body.makyaj ?? null);
  }

  /** Plaka bulanıklaştırma (Karar 34): alanlar fotoğrafa oranla */
  @Post('images/:id/blur')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  imageBlur(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(imageBlurSchema)) body: z.output<typeof imageBlurSchema>,
  ) {
    return this.images.blur(id, body.alanlar, req.staff.staff.id, req.ip);
  }

  @Post('images/:id/unblur')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  imageUnblur(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.images.unblur(id, req.staff.staff.id, req.ip);
  }

  @Post('images/:id/reject')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  imageReject(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.images.reject(id, req.staff.staff.id, req.ip);
  }

  @Get('sources')
  @RequirePermission('kategori.ayarla')
  async sources() {
    const rows = await this.db.catalogSource.findMany({ orderBy: { key: 'asc' } });
    const limit = Date.now() - STALE_HOURS * 3600_000;
    const counts = await this.db.$queryRaw<{ source: string; total: bigint; latest: bigint }[]>`
      SELECT source, count(*) AS total, count(*) FILTER (WHERE in_latest) AS latest FROM catalog_variants GROUP BY source`;
    const gens = await this.db.$queryRaw<{ source: string; total: bigint; coded: bigint }[]>`
      SELECT source, count(*) AS total, count(*) FILTER (WHERE code IS NOT NULL) AS coded
      FROM catalog_generations GROUP BY source`;
    return rows.map((s) => {
      const c = counts.find((x) => x.source === s.key);
      const g = gens.find((x) => x.source === s.key);
      return {
        ...s,
        variants: Number(c?.total ?? 0),
        variantsInLatest: Number(c?.latest ?? 0),
        generations: Number(g?.total ?? 0),
        generationsCoded: Number(g?.coded ?? 0),
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

  // ── Ad eşleme (Teknik tasarım §5, Karar 33) ──────────────────────

  /** Öneriler ve kararlar; seri adları ve tip sayılarıyla. */
  @Get('aliases')
  @RequirePermission('kategori.ayarla')
  async aliasList(@Query('durum', new ZodPipe(aliasStatusSchema)) durum?: string) {
    const rows = await this.aliases.list(durum);
    const keys = [...new Set(rows.flatMap((r) => [r.fromKey, r.toKey]))];
    const series = await this.db.catalogSeries.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true, name: true, make: { select: { name: true } } },
    });
    const byKey = new Map(series.map((s) => [s.key, { id: s.id, name: s.name, make: s.make.name }]));
    return rows.map((r) => ({ ...r, from: byKey.get(r.fromKey) ?? null, to: byKey.get(r.toKey) ?? null }));
  }

  /** Bütün kaynaklar için öneri üretir (içe aktarma sonrası kendiliğinden de çalışır). */
  @Post('aliases/suggest')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  async aliasSuggest() {
    let added = 0;
    for (const source of ['tsb', 'vmm', 'yerli']) added += await this.aliases.suggest(source);
    return { eklenen: added };
  }

  /** Elle eşleme: kaynak seri hedef seriye bağlanır ve tipler hemen taşınır. */
  @Post('aliases')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  aliasCreate(
    @Req() req: StaffRequest,
    @Body(new ZodPipe(aliasCreateSchema)) body: z.output<typeof aliasCreateSchema>,
  ) {
    return this.aliases.create(body, req.staff.staff.id, req.ip);
  }

  @Post('aliases/:id/approve')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  aliasApprove(
    @Req() req: StaffRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(aliasApproveSchema)) body: z.output<typeof aliasApproveSchema>,
  ) {
    return this.aliases.approve(id, req.staff.staff.id, req.ip, body.toKey);
  }

  @Post('aliases/:id/reject')
  @HttpCode(200)
  @RequirePermission('kategori.ayarla')
  aliasReject(@Req() req: StaffRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.aliases.reject(id, req.staff.staff.id, req.ip);
  }
}
