import {
  BadRequestException,
  Body,
  type CanActivate,
  Controller,
  Delete,
  type ExecutionContext,
  Get,
  Headers,
  HttpCode,
  Injectable,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { apiKeyCreateSchema, portfolioVehicleSchema } from '@rengarenk/shared';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AccessClaims } from '../auth/auth.service.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { type Ctx, PortfolioService } from './portfolio.service.js';
import { PortfolioBulkService } from './portfolio-bulk.service.js';

type AuthedRequest = {
  user: AccessClaims;
  ip: string;
  body?: unknown;
  headers: Record<string, string | undefined>;
};
type Reply = { header: (k: string, v: string) => unknown; send: (b: unknown) => unknown };

const vehicleBody = new ZodPipe(portfolioVehicleSchema);
type VehicleBody = z.output<typeof portfolioVehicleSchema>;
const siraSchema = z.object({ sira: z.array(z.string().uuid()).max(30) });
const atamaSchema = z.object({ userId: z.string().uuid().nullable() });

const ham = (req: { body?: unknown }) => {
  if (!Buffer.isBuffer(req.body)) throw new BadRequestException('Dosya gövdede gelmeli');
  return new Uint8Array(req.body);
};

/** Galeri paneli › Portföy, Araç ekle, Toplu yükleme (GaleriPanel.dc.html; Karar 07, 17, 20) */
@Controller('gallery/:accountId/portfolio')
@UseGuards(AuthGuard)
export class PortfolioController {
  constructor(
    private readonly portfolio: PortfolioService,
    private readonly bulk: PortfolioBulkService,
  ) {}

  private ctx(req: AuthedRequest, accountId: string, yaz = true) {
    return this.portfolio.ctx(req.user.sub, accountId, yaz);
  }

  @Get()
  async list(@Req() req: AuthedRequest, @Param('accountId', new ParseUUIDPipe()) a: string) {
    return this.portfolio.list(await this.ctx(req, a, false));
  }

  @Post()
  async create(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Body(vehicleBody) b: VehicleBody,
  ) {
    return this.portfolio.create(await this.ctx(req, a), b, req.ip);
  }

  /** Toplu yükleme şablonu (Excel) */
  @Get('template')
  async template(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Res() reply: Reply,
  ) {
    await this.ctx(req, a, false);
    reply.header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('content-disposition', 'attachment; filename="rengarenk_portfoy_sablonu.xlsx"');
    return reply.send(Buffer.from(this.bulk.template()));
  }

  /** Önizleme (`?onizle=1`) ya da içe aktarma; gövde Excel ya da CSV */
  @Post('bulk')
  @HttpCode(200)
  async upload(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Query('onizle') onizle: string | undefined,
    @Headers('content-type') tur = '',
  ) {
    const c = await this.ctx(req, a);
    if (onizle) {
      const { satirlar: _s, ...p } = await this.bulk.preview(c, ham(req), tur);
      return p;
    }
    return this.bulk.import(c, ham(req), tur, req.ip);
  }

  /** Hata raporu: önizlemedeki hatalı satırlar Excel olarak */
  @Post('bulk/report')
  @HttpCode(200)
  async report(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Headers('content-type') tur: string,
    @Res() reply: Reply,
  ) {
    const p = await this.bulk.preview(await this.ctx(req, a), ham(req), tur ?? '');
    reply.header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('content-disposition', 'attachment; filename="portfoy_hata_raporu.xlsx"');
    return reply.send(Buffer.from(this.bulk.errorReport(p.hatalar)));
  }

  @Get('api-keys')
  async keys(@Req() req: AuthedRequest, @Param('accountId', new ParseUUIDPipe()) a: string) {
    return this.bulk.keys(await this.ctx(req, a, false));
  }

  @Post('api-keys')
  async createKey(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Body(new ZodPipe(apiKeyCreateSchema)) b: z.output<typeof apiKeyCreateSchema>,
  ) {
    return this.bulk.createKey(await this.ctx(req, a), b.ad, req.ip);
  }

  @Delete('api-keys/:id')
  @HttpCode(204)
  async revokeKey(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.bulk.revokeKey(await this.ctx(req, a), id, req.ip);
  }

  @Get(':id')
  async detail(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.portfolio.detail(await this.ctx(req, a, false), id);
  }

  @Put(':id')
  async update(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(vehicleBody) b: VehicleBody,
  ) {
    return this.portfolio.update(await this.ctx(req, a), id, b, req.ip);
  }

  @Patch(':id/assign')
  async assign(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(atamaSchema)) b: z.output<typeof atamaSchema>,
  ) {
    return this.portfolio.assign(await this.ctx(req, a), id, b.userId);
  }

  /** Fotoğraf: gövde JPG, PNG ya da WEBP */
  @Post(':id/photos')
  async photo(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.portfolio.addPhoto(await this.ctx(req, a), id, ham(req));
  }

  @Patch(':id/photos')
  async reorder(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(siraSchema)) b: z.output<typeof siraSchema>,
  ) {
    return this.portfolio.reorderPhotos(await this.ctx(req, a), id, b.sira);
  }

  @Delete(':id/photos/:photoId')
  async removePhoto(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('photoId', new ParseUUIDPipe()) photoId: string,
  ) {
    return this.portfolio.removePhoto(await this.ctx(req, a), id, photoId);
  }

  /** Ekspertiz raporu (PDF); tarih `?tarih=YYYY-AA-GG` */
  @Post(':id/report')
  async setReport(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('tarih') tarih: string,
    @Headers('x-file-name') ad?: string,
  ) {
    let dosya = 'ekspertiz.pdf';
    try {
      dosya = decodeURIComponent(ad ?? dosya);
    } catch {
      // bozuk ad
    }
    return this.portfolio.setReport(await this.ctx(req, a), id, ham(req), tarih ?? '', dosya);
  }

  @Post(':id/submit')
  @HttpCode(200)
  async submit(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.portfolio.submit(await this.ctx(req, a), id, req.ip);
  }

  @Post(':id/passivate')
  @HttpCode(200)
  async passivate(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.portfolio.passivate(await this.ctx(req, a), id, req.ip);
  }

  @Post(':id/activate')
  @HttpCode(200)
  async activate(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.portfolio.activate(await this.ctx(req, a), id, req.ip);
  }

  @Post(':id/sold')
  @HttpCode(200)
  async sold(
    @Req() req: AuthedRequest,
    @Param('accountId', new ParseUUIDPipe()) a: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.portfolio.markSold(await this.ctx(req, a), id, req.ip);
  }
}

/** Herkese açık: portföy aracı sayfası, fotoğraflar, ekspertiz (PortfoyArac.dc.html) */
@Controller()
export class PublicPortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  /** Galeri profilindeki yayındaki araçlar (GaleriProfil.dc.html) */
  @Get('galeriler/:slug/araclar')
  galleryVehicles(@Param('slug') slug: string) {
    return this.portfolio.publicListBySlug(slug);
  }

  @Get('araclar/:no')
  detail(@Param('no', new ParseIntPipe()) no: number) {
    return this.portfolio.publicDetail(no);
  }

  /** Favori araçlar (PortfoyArac.dc.html › "Favorilere ekle") */
  @Get('favoriler/araclar')
  @UseGuards(AuthGuard)
  favorites(@Req() req: { user: AccessClaims }) {
    return this.portfolio.favoriler(req.user.sub);
  }

  @Get('araclar/:no/favori')
  @UseGuards(AuthGuard)
  isFavorite(@Req() req: { user: AccessClaims }, @Param('no', new ParseIntPipe()) no: number) {
    return this.portfolio.favoriMi(req.user.sub, no);
  }

  @Put('araclar/:no/favori')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async addFavorite(@Req() req: { user: AccessClaims }, @Param('no', new ParseIntPipe()) no: number) {
    await this.portfolio.favoriEkle(req.user.sub, no);
  }

  @Delete('araclar/:no/favori')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async removeFavorite(@Req() req: { user: AccessClaims }, @Param('no', new ParseIntPipe()) no: number) {
    await this.portfolio.favoriCikar(req.user.sub, no);
  }

  /** "Telefonu göster": yalnızca girişli kullanıcıya */
  @Get('araclar/:no/iletisim')
  @UseGuards(AuthGuard)
  contact(@Param('no', new ParseIntPipe()) no: number) {
    return this.portfolio.contact(no);
  }

  @Get('araclar/:no/ekspertiz')
  async report(@Param('no', new ParseIntPipe()) no: number, @Res() reply: Reply) {
    const f = await this.portfolio.report(no);
    reply.header('content-type', 'application/pdf');
    reply.header('content-disposition', 'inline; filename="ekspertiz.pdf"');
    reply.header('cross-origin-resource-policy', 'cross-origin');
    return reply.send(f.body);
  }

  @Get('portfoy/fotolar/:id')
  async photo(@Param('id', new ParseUUIDPipe()) id: string, @Res() reply: Reply) {
    const f = await this.portfolio.photo(id);
    reply.header('content-type', f.mime);
    reply.header('cache-control', 'public, max-age=604800, immutable');
    reply.header('cross-origin-resource-policy', 'cross-origin');
    reply.header('etag', `"${f.sha256}"`);
    return reply.send(f.body);
  }
}

/** API anahtarı: `Authorization: Bearer rgk_…` (Karar 07.3) */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly bulk: PortfolioBulkService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; galeri?: Ctx }>();
    const h = req.headers.authorization ?? '';
    if (!h.startsWith('Bearer rgk_')) throw new UnauthorizedException('API anahtarı gerekli');
    req.galeri = await this.bulk.contextFromKey(h.slice(7));
    return true;
  }
}

/**
 * Stok sistemi entegrasyonu (Karar 07.3, yalnızca Kurumsal): galerinin stok numarasıyla araç ekler ya da günceller,
 * satıldı ve pasif bildirir. Fotoğraflar panelden eklenir; araç EİDS onayıyla yayına girer.
 */
@Controller('entegrasyon/v1/araclar')
@UseGuards(ApiKeyGuard)
export class IntegrationController {
  constructor(
    private readonly portfolio: PortfolioService,
    private readonly bulk: PortfolioBulkService,
  ) {}

  @Get()
  async list(@Req() req: { galeri: Ctx }) {
    const l = await this.portfolio.list(req.galeri);
    return l.araclar.map((v) => ({
      stokNo: v.disNo,
      no: v.no,
      ad: v.ad,
      fiyat: v.fiyat,
      durum: v.durum,
      fotoSayisi: v.fotoSayisi,
    }));
  }

  @Put(':stokNo')
  async upsert(
    @Req() req: { galeri: Ctx },
    @Param('stokNo') stokNo: string,
    @Body(vehicleBody) b: VehicleBody,
  ) {
    if (!/^[\w.-]{1,60}$/.test(stokNo)) throw new BadRequestException('Stok numarası geçerli değil');
    const d = await this.bulk.upsertByExternal(req.galeri, stokNo, b);
    return { no: d.no, durum: d.durum, kurallar: d.kurallar };
  }

  @Post(':stokNo/satildi')
  @HttpCode(200)
  async sold(@Req() req: { galeri: Ctx }, @Param('stokNo') stokNo: string) {
    const d = await this.portfolio.markSold(req.galeri, await this.bulk.byExternal(req.galeri, stokNo));
    return { no: d.no, durum: d.durum };
  }

  @Post(':stokNo/pasif')
  @HttpCode(200)
  async passive(@Req() req: { galeri: Ctx }, @Param('stokNo') stokNo: string) {
    const d = await this.portfolio.passivate(req.galeri, await this.bulk.byExternal(req.galeri, stokNo));
    return { no: d.no, durum: d.durum };
  }
}
