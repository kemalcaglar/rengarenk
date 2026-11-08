import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type PortfolioVehicle, type Prisma, uuidv7 } from '@rengarenk/db';
import {
  COLORS,
  type Damage,
  damageSummary,
  eidsRequired,
  FUELS,
  formatPlate,
  GALLERY_PLANS,
  GALLERY_TRIAL,
  type GalleryPlanKey,
  GEARBOXES,
  normalizePlate,
  PAINT_PARTS,
  PAINT_STATES,
  PHOTO_MAX,
  PHOTO_MAX_BYTES,
  PHOTO_MIN,
  PORTFOLIO_STATUS_NAMES,
  type PortfolioVehicleData,
  portfolioRules,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { sniff } from '../common/files.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { STORAGE, type Storage } from '../storage/storage.service.js';
import { EidsFactory, type EidsProvider } from './eids.js';

const AKTIF = ['DRAFT', 'PENDING_EIDS', 'PUBLISHED', 'PASSIVE'] as const;
const ad = <T extends { key: string; ad: string }>(list: readonly T[], k: string | null) =>
  k ? (list.find((x) => x.key === k)?.ad ?? k) : null;
const binlik = (n: number | bigint) => new Intl.NumberFormat('tr-TR').format(n);

/** Galeri bağlamı: rol ve paket; yazma işlemlerinde askı ve bitmiş deneme engeldir (Karar 12.5) */
export interface Ctx {
  userId: string;
  accountId: string;
  role: 'OWNER' | 'MANAGER' | 'SALES';
  plan: GalleryPlanKey;
  limit: number | null;
  toplu: boolean;
  api: boolean;
  taxNo: string;
  slug: string;
  ad: string;
}

/**
 * Galeri portföyü (Karar 07, 17, 20). Araç taslak olarak eklenir; fotoğraf ve kurallar tamamlanınca "Kaydet ve EİDS'e
 * gönder" ile EİDS'e gider, ruhsat sahibi onaylayınca yayına girer ve alıcılara görünür. Satılan araç hemen kalkar.
 */
@Injectable()
export class PortfolioService {
  private readonly eids: EidsProvider;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(STORAGE) private readonly storage: Storage,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    eids: EidsFactory,
  ) {
    this.eids = eids.create();
  }

  // ── Bağlam ve yetki ───────────────────────────────────────────

  async ctx(userId: string, accountId: string, yaz: boolean): Promise<Ctx> {
    const m = await this.db.accountMember.findUnique({
      where: { accountId_userId: { accountId, userId } },
      include: { account: { include: { gallery: true } } },
    });
    const g = m?.account.gallery;
    if (!m || !g) throw new NotFoundException('Galeri bulunamadı');
    const plan = g.plan as GalleryPlanKey;
    if (yaz) {
      if (m.account.status !== 'ACTIVE') throw new ForbiddenException('Galeri hesabı askıda');
      if (plan === 'deneme' && g.trialEndsAt && g.trialEndsAt < new Date()) {
        throw new ForbiddenException(
          'Deneme süren bitti; paket seçene kadar portföyünü yalnızca görüntüleyebilirsin',
        );
      }
    }
    const ozellik = plan === 'deneme' ? GALLERY_TRIAL : GALLERY_PLANS[plan];
    return {
      userId,
      accountId,
      role: m.role,
      plan,
      limit: ozellik.portfoy,
      toplu: ozellik.toplu,
      api: ozellik.api,
      taxNo: g.taxNo,
      slug: g.slug,
      ad: g.displayName,
    };
  }

  /** Satış temsilcisi yalnızca kendine atanan aracı düzenler (Karar 20) */
  private async own(c: Ctx, id: string) {
    const v = await this.db.portfolioVehicle.findFirst({ where: { id, accountId: c.accountId } });
    if (!v) throw new NotFoundException('Araç bulunamadı');
    if (c.role === 'SALES' && v.assignedTo !== c.userId) {
      throw new ForbiddenException('Bu aracı yalnızca atanan satış temsilcisi ya da yönetici düzenleyebilir');
    }
    return v;
  }

  private async capacity(c: Ctx, tx: Tx | Db = this.db) {
    if (c.limit === null) return Number.POSITIVE_INFINITY;
    const n = await tx.portfolioVehicle.count({
      where: { accountId: c.accountId, status: { in: [...AKTIF] } },
    });
    return c.limit - n;
  }

  // ── Katalog ve kategori ───────────────────────────────────────

  private async category(slug: string) {
    const cat = await this.db.category.findUnique({
      where: { slug },
      include: { parent: { select: { slug: true } } },
    });
    if (!cat?.enabled) throw new BadRequestException('Kategori geçerli değil');
    return { id: cat.id, slug: cat.slug, root: cat.parent?.slug ?? cat.slug };
  }

  /** Katalog anahtarlarının varlığı ve birbirine bağlılığı */
  private async checkCatalog(d: PortfolioVehicleData) {
    if (!d.marka) return;
    const make = await this.db.catalogMake.findUnique({ where: { key: d.marka }, select: { id: true } });
    if (!make) throw new BadRequestException('Marka katalogda yok');
    if (d.seri) {
      const s = await this.db.catalogSeries.findUnique({ where: { key: d.seri }, select: { makeId: true } });
      if (s?.makeId !== make.id) throw new BadRequestException('Seri bu markada yok');
    }
    if (d.model) {
      const m = await this.db.catalogModel.findUnique({ where: { key: d.model }, select: { makeId: true } });
      if (m?.makeId !== make.id) throw new BadRequestException('Model bu markada yok');
    }
    if (
      d.paket &&
      !(await this.db.catalogTrim.findUnique({ where: { key: d.paket }, select: { id: true } }))
    ) {
      throw new BadRequestException('Paket katalogda yok');
    }
  }

  private columns(
    d: PortfolioVehicleData,
  ): Omit<Prisma.PortfolioVehicleUncheckedCreateInput, 'id' | 'accountId' | 'categoryId' | 'createdBy'> {
    return {
      makeKey: d.marka ?? null,
      seriesKey: d.seri ?? null,
      modelKey: d.model ?? null,
      generationKey: d.kasa ?? null,
      trimKey: d.paket ?? null,
      makeName: d.marka ? null : (d.markaAd ?? null),
      modelName: d.model ? null : (d.modelAd ?? null),
      year: d.yil,
      km: d.km,
      fuel: d.yakit ?? null,
      gearbox: d.vites ?? null,
      color: d.renk ?? null,
      priceTl: BigInt(d.fiyat),
      plate: d.plaka ? normalizePlate(d.plaka) : null,
      chassisTail: d.sasiSon6 ?? null,
      firstRegistration: d.ilkTescil ? new Date(`${d.ilkTescil}T00:00:00Z`) : null,
      lien: d.rehin,
      warranty: d.garanti || null,
      tradeIn: d.takas,
      damage: d.hasar as unknown as Prisma.InputJsonValue,
      description: d.aciklama || null,
      priceDeclared: d.fiyatBeyani,
      manufacturerPrice: d.ureticiFiyati ? BigInt(d.ureticiFiyati) : null,
      externalId: d.disNo || null,
      photoCatalogOk: d.fotoKatalogIzni,
    };
  }

  // ── Ekle, düzenle ─────────────────────────────────────────────

  async create(c: Ctx, d: PortfolioVehicleData, ip?: string) {
    const cat = await this.category(d.kategori);
    await this.checkCatalog(d);
    if ((await this.capacity(c)) <= 0) {
      throw new ConflictException(`Paketinde en çok ${c.limit} araçlık portföy olabilir`);
    }
    const id = uuidv7();
    await this.db.$transaction(async (tx) => {
      await tx.portfolioVehicle.create({
        data: {
          id,
          accountId: c.accountId,
          categoryId: cat.id,
          createdBy: c.userId,
          assignedTo: c.role === 'SALES' ? c.userId : null,
          ...this.columns(d),
        },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: c.userId,
          action: 'portfoy_eklendi',
          entityType: 'portfolio_vehicle',
          entityId: id,
          ip,
        },
        tx,
      );
    });
    return this.detail(c, id);
  }

  /**
   * Düzenleme. Yayındaki araçta plaka değişirse araç yeniden EİDS doğrulamasına gider; fiyat ve kurallar her
   * değişiklikte yeniden denetlenir.
   */
  async update(c: Ctx, id: string, d: PortfolioVehicleData, ip?: string) {
    const v = await this.own(c, id);
    if (v.status === 'SOLD') throw new ConflictException('Satılan araç düzenlenemez');
    const cat = await this.category(d.kategori);
    await this.checkCatalog(d);
    const cols = this.columns(d);
    const plakaDegisti = (cols.plate ?? null) !== v.plate;
    const yeniden = plakaDegisti && ['PUBLISHED', 'PASSIVE', 'PENDING_EIDS'].includes(v.status);
    if (v.status !== 'DRAFT' && v.status !== 'REJECTED') {
      const engel = portfolioRules(d, { rootSlug: cat.root, ekspertizTarihi: v.reportDate }).find(
        (r) => r.engel,
      );
      if (engel) throw new UnprocessableEntityException(engel.metin);
    }
    await this.db.$transaction(async (tx) => {
      await tx.portfolioVehicle.update({
        where: { id },
        data: {
          ...cols,
          categoryId: cat.id,
          ...(yeniden
            ? {
                status: 'PENDING_EIDS',
                publishedAt: null,
                statusNote: 'Plaka değişti; EİDS onayı yeniden isteniyor',
              }
            : {}),
        },
      });
      if (yeniden) await this.openEids(tx, id, cols.plate as string);
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: c.userId,
          action: 'portfoy_guncellendi',
          entityType: 'portfolio_vehicle',
          entityId: id,
          before: { fiyat: Number(v.priceTl), km: v.km, durum: v.status },
          after: { fiyat: d.fiyat, km: d.km },
          ip,
        },
        tx,
      );
      if (v.status === 'PUBLISHED' && !yeniden)
        await this.outbox.add(tx, 'portfoy.guncellendi', { vehicleId: id });
    });
    return this.detail(c, id);
  }

  /** Aracı satış temsilcisine atar (sahip ve yönetici) */
  async assign(c: Ctx, id: string, userId: string | null) {
    if (c.role === 'SALES') throw new ForbiddenException('Atamayı sahip ya da yönetici yapar');
    await this.own(c, id);
    if (userId) {
      const m = await this.db.accountMember.findUnique({
        where: { accountId_userId: { accountId: c.accountId, userId } },
      });
      if (!m) throw new BadRequestException('Bu kişi ekipte değil');
    }
    await this.db.portfolioVehicle.update({ where: { id }, data: { assignedTo: userId } });
    return this.detail(c, id);
  }

  // ── Fotoğraf ve ekspertiz ─────────────────────────────────────

  async addPhoto(c: Ctx, id: string, body: Uint8Array) {
    const v = await this.own(c, id);
    if (v.status === 'SOLD') throw new ConflictException('Satılan aracın fotoğrafı değiştirilemez');
    if (body.byteLength === 0 || body.byteLength > PHOTO_MAX_BYTES)
      throw new BadRequestException('Fotoğraf en çok 8 MB olabilir');
    const mime = sniff(body);
    if (!mime || mime === 'application/pdf')
      throw new BadRequestException('Yalnızca JPG, PNG ya da WEBP fotoğraf yükleyebilirsin');
    const n = await this.db.portfolioPhoto.count({ where: { vehicleId: id } });
    if (n >= PHOTO_MAX) throw new ConflictException(`En fazla ${PHOTO_MAX} fotoğraf yükleyebilirsin`);
    const pid = uuidv7();
    const storageKey = `portfoy/${id}/${pid}`;
    await this.storage.put(storageKey, body, mime);
    await this.db.portfolioPhoto.create({
      data: {
        id: pid,
        vehicleId: id,
        storageKey,
        mime,
        size: body.byteLength,
        sha256: createHash('sha256').update(body).digest('hex'),
        sort: n,
      },
    });
    if (v.status === 'PUBLISHED')
      await this.db.$transaction((tx) => this.outbox.add(tx, 'portfoy.guncellendi', { vehicleId: id }));
    return this.detail(c, id);
  }

  async removePhoto(c: Ctx, id: string, photoId: string) {
    const v = await this.own(c, id);
    const n = await this.db.portfolioPhoto.count({ where: { vehicleId: id } });
    if (v.status === 'PUBLISHED' && n <= PHOTO_MIN) {
      throw new ConflictException(`Yayındaki araçta en az ${PHOTO_MIN} fotoğraf olmalı`);
    }
    const r = await this.db.portfolioPhoto.deleteMany({ where: { id: photoId, vehicleId: id } });
    if (!r.count) throw new NotFoundException('Fotoğraf bulunamadı');
    const kalan = await this.db.portfolioPhoto.findMany({
      where: { vehicleId: id },
      orderBy: { sort: 'asc' },
    });
    await this.db.$transaction(
      kalan.map((p, i) => this.db.portfolioPhoto.update({ where: { id: p.id }, data: { sort: i } })),
    );
    return this.detail(c, id);
  }

  /** Fotoğraf sırası: ilk fotoğraf kapak olur */
  async reorderPhotos(c: Ctx, id: string, sira: string[]) {
    await this.own(c, id);
    const fotolar = await this.db.portfolioPhoto.findMany({ where: { vehicleId: id }, select: { id: true } });
    const var_ = new Set(fotolar.map((f) => f.id));
    if (sira.length !== var_.size || !sira.every((x) => var_.has(x)))
      throw new BadRequestException('Fotoğraf listesi eksik');
    await this.db.$transaction(
      sira.map((pid, i) => this.db.portfolioPhoto.update({ where: { id: pid }, data: { sort: i } })),
    );
    return this.detail(c, id);
  }

  async setReport(c: Ctx, id: string, body: Uint8Array, tarih: string, fileName: string) {
    await this.own(c, id);
    if (sniff(body) !== 'application/pdf') throw new BadRequestException('Ekspertiz raporu PDF olmalı');
    if (body.byteLength > 10 * 1024 * 1024) throw new BadRequestException('Rapor en çok 10 MB olabilir');
    const d = new Date(`${tarih}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d > new Date())
      throw new BadRequestException('Rapor tarihi geçerli değil');
    const reportKey = `portfoy/${id}/ekspertiz-${uuidv7()}`;
    await this.storage.put(reportKey, body, 'application/pdf');
    await this.db.portfolioVehicle.update({
      where: { id },
      data: { reportKey, reportDate: d, reportName: fileName.slice(0, 200) || 'ekspertiz.pdf' },
    });
    return this.detail(c, id);
  }

  // ── Yayın akışı ───────────────────────────────────────────────

  private dataOf(v: PortfolioVehicle) {
    return {
      yil: v.year,
      km: v.km,
      fiyat: Number(v.priceTl),
      fiyatBeyani: v.priceDeclared,
      ureticiFiyati: v.manufacturerPrice === null ? undefined : Number(v.manufacturerPrice),
      ilkTescil: v.firstRegistration ? v.firstRegistration.toISOString().slice(0, 10) : undefined,
    };
  }

  private async openEids(tx: Tx, vehicleId: string, plate: string) {
    await tx.eidsCheck.create({ data: { id: uuidv7(), vehicleId, provider: this.eids.ad, plate } });
    await this.outbox.add(tx, 'portfoy.eids_istendi', { vehicleId });
  }

  /**
   * "Kaydet ve EİDS'e gönder": kurallar (engel olanlar), en az 6 fotoğraf, plaka ve şasi. EİDS gerekmeyen
   * kategoride (deniz, hava, kiralık) araç doğrudan yayına girer.
   */
  async submit(c: Ctx, id: string, ip?: string) {
    const v = await this.own(c, id);
    if (!['DRAFT', 'REJECTED'].includes(v.status)) throw new ConflictException('Araç zaten gönderildi');
    const cat = await this.db.category.findUniqueOrThrow({
      where: { id: v.categoryId },
      include: { parent: { select: { slug: true } } },
    });
    const root = cat.parent?.slug ?? cat.slug;
    const engel = portfolioRules(this.dataOf(v), { rootSlug: root, ekspertizTarihi: v.reportDate }).find(
      (r) => r.engel,
    );
    if (engel) throw new UnprocessableEntityException(engel.metin);
    const fotolar = await this.db.portfolioPhoto.count({ where: { vehicleId: id } });
    if (fotolar < PHOTO_MIN)
      throw new UnprocessableEntityException(`En az ${PHOTO_MIN} fotoğraf yükle (şu an ${fotolar})`);
    const eids = eidsRequired(root);
    if (eids && (!v.plate || !v.chassisTail)) {
      throw new UnprocessableEntityException(
        'EİDS doğrulaması için plaka ve şasi numarasının son 6 hanesi gerekir',
      );
    }
    const ayni = v.plate
      ? await this.db.portfolioVehicle.findFirst({
          where: {
            plate: v.plate,
            id: { not: id },
            status: { in: ['PENDING_EIDS', 'PUBLISHED', 'PASSIVE'] },
          },
          select: { id: true },
        })
      : null;
    if (ayni) throw new ConflictException('Bu plakayla açık bir ilan zaten var');
    await this.db.$transaction(async (tx) => {
      if (eids) {
        await tx.portfolioVehicle.update({
          where: { id },
          data: { status: 'PENDING_EIDS', statusNote: null },
        });
        await this.openEids(tx, id, v.plate as string);
      } else {
        await tx.portfolioVehicle.update({
          where: { id },
          data: { status: 'PUBLISHED', publishedAt: new Date(), statusNote: null },
        });
        await this.outbox.add(tx, 'portfoy.yayinlandi', { vehicleId: id });
      }
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: c.userId,
          action: eids ? 'portfoy_eidse_gonderildi' : 'portfoy_yayinlandi',
          entityType: 'portfolio_vehicle',
          entityId: id,
          ip,
        },
        tx,
      );
    });
    return this.detail(c, id);
  }

  async passivate(c: Ctx, id: string, ip?: string) {
    const v = await this.own(c, id);
    if (v.status !== 'PUBLISHED') throw new ConflictException('Yalnızca yayındaki araç pasife alınır');
    return this.change(
      c,
      v,
      { status: 'PASSIVE', passiveAt: new Date() },
      'portfoy_pasife_alindi',
      'portfoy.kalkti',
      ip,
    );
  }

  /** Pasif araç yeniden yayına: son EİDS onayı geçerliyse doğrudan, değilse yeniden doğrulama */
  async activate(c: Ctx, id: string, ip?: string) {
    const v = await this.own(c, id);
    if (v.status !== 'PASSIVE') throw new ConflictException('Yalnızca pasif araç yeniden yayına alınır');
    return this.change(
      c,
      v,
      { status: 'PUBLISHED', passiveAt: null, publishedAt: new Date() },
      'portfoy_yayinlandi',
      'portfoy.yayinlandi',
      ip,
    );
  }

  /** Satıldı (m.21): araç alıcılardan hemen kalkar, bir daha düzenlenmez */
  async markSold(c: Ctx, id: string, ip?: string) {
    const v = await this.own(c, id);
    if (v.status === 'SOLD') throw new ConflictException('Araç zaten satıldı');
    return this.change(c, v, { status: 'SOLD', soldAt: new Date() }, 'portfoy_satildi', 'portfoy.kalkti', ip);
  }

  private async change(
    c: Ctx,
    v: PortfolioVehicle,
    data: Prisma.PortfolioVehicleUpdateInput,
    action: string,
    event: 'portfoy.kalkti' | 'portfoy.yayinlandi',
    ip?: string,
  ) {
    await this.db.$transaction(async (tx) => {
      await tx.portfolioVehicle.update({ where: { id: v.id }, data });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: c.userId,
          action,
          entityType: 'portfolio_vehicle',
          entityId: v.id,
          before: { durum: v.status },
          after: { durum: data.status as string },
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, event, { vehicleId: v.id });
    });
    return this.detail(c, v.id);
  }

  // ── EİDS (işçi) ───────────────────────────────────────────────

  /** Bekleyen EİDS isteklerini sağlayıcıya sorar; onaylanan araç yayına girer, reddedilen geri döner. */
  async processEids(vehicleId?: string) {
    const rows = await this.db.eidsCheck.findMany({
      where: { status: 'PENDING', ...(vehicleId ? { vehicleId } : {}) },
      include: { vehicle: { include: { account: { include: { gallery: { select: { taxNo: true } } } } } } },
      orderBy: { requestedAt: 'asc' },
      take: 100,
    });
    let n = 0;
    for (const ch of rows) {
      // Araç bu arada değiştiyse (plaka, satış) eski istek kapanır
      if (ch.vehicle.status !== 'PENDING_EIDS' || ch.vehicle.plate !== ch.plate) {
        await this.db.eidsCheck.update({
          where: { id: ch.id },
          data: { status: 'REJECTED', note: 'Araç değişti', decidedAt: new Date() },
        });
        continue;
      }
      try {
        let ref = ch.reference;
        if (!ref) {
          ref = await this.eids.request({
            plate: ch.plate,
            chassisTail: ch.vehicle.chassisTail,
            taxNo: ch.vehicle.account.gallery?.taxNo ?? '',
          });
          await this.db.eidsCheck.update({
            where: { id: ch.id },
            data: { reference: ref, attempts: { increment: 1 } },
          });
          if (!ref) continue;
        }
        const r = await this.eids.status(ref);
        if (r.sonuc === 'bekliyor') continue;
        const ok = r.sonuc === 'onaylandi';
        await this.db.$transaction(async (tx) => {
          await tx.eidsCheck.update({
            where: { id: ch.id },
            data: { status: ok ? 'APPROVED' : 'REJECTED', note: r.not ?? null, decidedAt: new Date() },
          });
          await tx.portfolioVehicle.update({
            where: { id: ch.vehicleId },
            data: ok
              ? { status: 'PUBLISHED', publishedAt: new Date(), statusNote: null }
              : { status: 'REJECTED', statusNote: r.not ?? 'EİDS onayı alınamadı' },
          });
          await this.audit.record(
            {
              actorType: 'SYSTEM',
              action: ok ? 'portfoy_eids_onaylandi' : 'portfoy_eids_reddedildi',
              entityType: 'portfolio_vehicle',
              entityId: ch.vehicleId,
            },
            tx,
          );
          await this.outbox.add(tx, ok ? 'portfoy.yayinlandi' : 'portfoy.eids_reddedildi', {
            vehicleId: ch.vehicleId,
          });
        });
        n++;
      } catch {
        await this.db.eidsCheck.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
      }
    }
    return n;
  }

  // ── Görünümler ────────────────────────────────────────────────

  /** Katalog adları (marka, seri, model, paket) toplu */
  private async names(vs: PortfolioVehicle[]) {
    const keys = (f: (v: PortfolioVehicle) => string | null) => [
      ...new Set(vs.map(f).filter((x): x is string => Boolean(x))),
    ];
    const [m, s, mo, t] = await Promise.all([
      this.db.catalogMake.findMany({
        where: { key: { in: keys((v) => v.makeKey) } },
        select: { key: true, name: true },
      }),
      this.db.catalogSeries.findMany({
        where: { key: { in: keys((v) => v.seriesKey) } },
        select: { key: true, name: true },
      }),
      this.db.catalogModel.findMany({
        where: { key: { in: keys((v) => v.modelKey) } },
        select: { key: true, name: true },
      }),
      this.db.catalogTrim.findMany({
        where: { key: { in: keys((v) => v.trimKey) } },
        select: { key: true, name: true },
      }),
    ]);
    const map = new Map([...m, ...s, ...mo, ...t].map((x) => [x.key, x.name]));
    return (v: PortfolioVehicle) => {
      const marka = v.makeKey ? (map.get(v.makeKey) ?? v.makeKey) : (v.makeName ?? '');
      const seri = v.seriesKey ? map.get(v.seriesKey) : null;
      const model = v.modelKey ? map.get(v.modelKey) : v.modelName;
      const paket = v.trimKey ? map.get(v.trimKey) : null;
      return {
        marka,
        seri,
        model,
        paket,
        ad: [String(v.year), marka, seri, model, paket].filter(Boolean).join(' '),
      };
    };
  }

  private ozet(v: PortfolioVehicle) {
    return [`${binlik(v.km)} km`, ad(FUELS, v.fuel), ad(GEARBOXES, v.gearbox)].filter(Boolean).join(' · ');
  }

  /** Panel listesi (GaleriPanel.dc.html › Portföy) */
  async list(c: Ctx) {
    const vs = await this.db.portfolioVehicle.findMany({
      where: { accountId: c.accountId, ...(c.role === 'SALES' ? {} : {}) },
      orderBy: { updatedAt: 'desc' },
      include: {
        photos: { orderBy: { sort: 'asc' }, take: 1, select: { id: true } },
        eidsChecks: { orderBy: { requestedAt: 'desc' }, take: 1, select: { status: true, note: true } },
        _count: { select: { photos: true } },
      },
    });
    const n = await this.names(vs);
    const aktif = vs.filter((v) => (AKTIF as readonly string[]).includes(v.status)).length;
    return {
      sinir: c.limit,
      aktif,
      toplu: c.toplu,
      api: c.api,
      araclar: vs.map((v) => ({
        id: v.id,
        no: Number(v.no),
        ad: n(v).ad,
        detay: this.ozet(v),
        fiyat: Number(v.priceTl),
        durum: v.status,
        durumAd: PORTFOLIO_STATUS_NAMES[v.status],
        not: v.statusNote,
        eids: v.eidsChecks[0]?.status ?? null,
        foto: v.photos[0] ? `/portfoy/fotolar/${v.photos[0].id}` : null,
        fotoSayisi: v._count.photos,
        atanan: v.assignedTo,
        duzenlenebilir: c.role !== 'SALES' || v.assignedTo === c.userId,
        disNo: v.externalId,
      })),
    };
  }

  /** Düzenleme formu: bütün alanlar, fotoğraflar, rapor, kural sonuçları */
  async detail(c: Ctx, id: string) {
    const v = await this.db.portfolioVehicle.findFirst({
      where: { id, accountId: c.accountId },
      include: {
        photos: { orderBy: { sort: 'asc' } },
        category: { include: { parent: { select: { slug: true } } } },
        eidsChecks: { orderBy: { requestedAt: 'desc' }, take: 1 },
      },
    });
    if (!v) throw new NotFoundException('Araç bulunamadı');
    const root = v.category.parent?.slug ?? v.category.slug;
    return {
      id: v.id,
      no: Number(v.no),
      ad: (await this.names([v]))(v).ad,
      durum: v.status,
      durumAd: PORTFOLIO_STATUS_NAMES[v.status],
      not: v.statusNote,
      eids: v.eidsChecks[0] ? { durum: v.eidsChecks[0].status, not: v.eidsChecks[0].note } : null,
      eidsGerekli: eidsRequired(root),
      veri: {
        kategori: v.category.slug,
        marka: v.makeKey ?? undefined,
        seri: v.seriesKey ?? undefined,
        model: v.modelKey ?? undefined,
        kasa: v.generationKey ?? undefined,
        paket: v.trimKey ?? undefined,
        markaAd: v.makeName ?? undefined,
        modelAd: v.modelName ?? undefined,
        yil: v.year,
        km: v.km,
        yakit: v.fuel ?? undefined,
        vites: v.gearbox ?? undefined,
        renk: v.color ?? undefined,
        fiyat: Number(v.priceTl),
        plaka: v.plate ? formatPlate(v.plate) : undefined,
        sasiSon6: v.chassisTail ?? undefined,
        ilkTescil: v.firstRegistration?.toISOString().slice(0, 10),
        rehin: v.lien,
        garanti: v.warranty ?? undefined,
        takas: v.tradeIn,
        hasar: v.damage as unknown as Damage,
        aciklama: v.description ?? undefined,
        fiyatBeyani: v.priceDeclared,
        ureticiFiyati: v.manufacturerPrice === null ? undefined : Number(v.manufacturerPrice),
        disNo: v.externalId ?? undefined,
        fotoKatalogIzni: v.photoCatalogOk,
      },
      fotolar: v.photos.map((p) => ({ id: p.id, url: `/portfoy/fotolar/${p.id}` })),
      ekspertiz: v.reportKey ? { ad: v.reportName, tarih: v.reportDate } : null,
      kurallar: portfolioRules(this.dataOf(v), { rootSlug: root, ekspertizTarihi: v.reportDate }),
      atanan: v.assignedTo,
      yayin: v.publishedAt,
    };
  }

  // ── Herkese açık ──────────────────────────────────────────────

  async publicListBySlug(slug: string) {
    const g = await this.db.gallery.findUnique({
      where: { slug },
      include: { account: { select: { status: true } } },
    });
    if (g?.account.status !== 'ACTIVE') throw new NotFoundException('Galeri bulunamadı');
    return this.publicList(g.accountId);
  }

  /** Galeri profilindeki yayındaki araçlar (GaleriProfil.dc.html) */
  async publicList(accountId: string) {
    const vs = await this.db.portfolioVehicle.findMany({
      where: { accountId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      include: {
        photos: { orderBy: { sort: 'asc' }, take: 1, select: { id: true } },
        _count: { select: { photos: true } },
      },
      take: 200,
    });
    const n = await this.names(vs);
    return vs.map((v) => ({
      no: Number(v.no),
      ad: n(v).ad,
      ozellik: this.ozet(v),
      fiyat: Number(v.priceTl),
      foto: v.photos[0] ? `/portfoy/fotolar/${v.photos[0].id}` : null,
      fotoSayisi: v._count.photos,
      yayin: v.publishedAt,
    }));
  }

  /** Portföy aracı sayfası (PortfoyArac.dc.html): yalnızca yayındaki araç; plakanın yalnızca il kodu */
  async publicDetail(no: number) {
    const v = await this.db.portfolioVehicle.findUnique({
      where: { no: BigInt(no) },
      include: {
        photos: { orderBy: { sort: 'asc' } },
        category: { select: { slug: true, name: true } },
        account: { include: { gallery: true } },
      },
    });
    const g = v?.account.gallery;
    if (!v || !g || v.status !== 'PUBLISHED' || v.account.status !== 'ACTIVE')
      throw new NotFoundException('Araç bulunamadı');
    const n = (await this.names([v]))(v);
    const gen = v.generationKey ? await this.generationLabel(v.seriesKey, v.generationKey) : null;
    const hasar = v.damage as unknown as Damage;
    const temsilci = await this.contactOf(v);
    return {
      no: Number(v.no),
      ad: n.ad,
      baslik: [n.ad, `${binlik(v.km)} km`, ad(COLORS, v.color)].filter(Boolean).join(' · '),
      kategori: v.category,
      marka: n.marka,
      seri: n.seri,
      model: n.model,
      galeri: { slug: g.slug, ad: g.displayName, isletmeAdi: g.legalName, yetkiNo: g.authorityNo },
      temsilci: temsilci.ad,
      fotolar: v.photos.map((p) => `/portfoy/fotolar/${p.id}`),
      bilgiler: [
        ['Marka', n.marka],
        ['Seri', n.seri],
        ['Model', n.model],
        ['Donanım paketi', n.paket],
        ['Kasa ve makyaj', gen],
        ['Yıl', String(v.year)],
        ['Kilometre', `${binlik(v.km)} km`],
        ['Yakıt', ad(FUELS, v.fuel)],
        ['Vites', ad(GEARBOXES, v.gearbox)],
        ['Renk', ad(COLORS, v.color)],
        ['Garanti', v.warranty ?? 'Yok'],
        ['Plaka', v.plate ? `TR plakalı · ${v.plate.slice(0, 2)}` : null],
        ['Takas', v.tradeIn ? 'Kabul ediyor' : 'Yok'],
        ['Kimden', 'Galeriden'],
      ].filter((x): x is [string, string] => Boolean(x[1])),
      hasar: {
        ozet: damageSummary(hasar),
        parcalar: PAINT_PARTS.map((p) => ({
          key: p.key,
          ad: p.ad,
          durum: hasar.parcalar[p.key] ?? 'orijinal',
        })),
        durumlar: PAINT_STATES.map((s) => ({
          ...s,
          sayi: PAINT_PARTS.filter((p) => (hasar.parcalar[p.key] ?? 'orijinal') === s.key).length,
        })),
        satirlar: [
          ['Ağır hasar kaydı', hasar.agirHasar ? 'Var' : 'Yok', !hasar.agirHasar],
          [
            'Şasi ve podye',
            hasar.sasiIslem || hasar.podyeIslem ? 'İşlem var' : 'İşlem yok',
            !(hasar.sasiIslem || hasar.podyeIslem),
          ],
          ['Airbag', hasar.airbagAcildi ? 'Açılmış' : 'Açılmamış', !hasar.airbagAcildi],
          ['Tramer kaydı', hasar.tramer ? `${binlik(hasar.tramer)} TL` : 'Yok', !hasar.tramer],
        ],
      },
      ekspertiz: v.reportKey ? { tarih: v.reportDate, url: `/araclar/${Number(v.no)}/ekspertiz` } : null,
      aciklama: v.description,
      fiyat: Number(v.priceTl),
      yayin: v.publishedAt,
      dogrulamalar: [
        eidsRequired(v.category.slug) ? 'İlan, ruhsat sahibinin EİDS onayıyla yayında.' : null,
        g.authorityNo
          ? 'Galerinin yetki belgesi Bakanlık sisteminden doğrulandı.'
          : 'Galerinin ticari belgeleri Rengarenk tarafından incelendi.',
        v.reportKey ? 'Kilometre ve hasar kaydı ekspertiz raporunda var.' : null,
      ].filter(Boolean),
    };
  }

  private async generationLabel(seriesKey: string | null, key: string) {
    const m = /^([^:/]+):(\d+)$/.exec(key);
    if (!m) {
      const g = await this.db.catalogGeneration.findFirst({
        where: { key },
        select: { body: true, startYear: true, endYear: true },
      });
      return g ? `${g.body ?? 'Kasa'} (${g.startYear}–${g.endYear ?? 'devam'})` : null;
    }
    const rows = seriesKey
      ? await this.db.catalogGeneration.findMany({
          where: {
            code: m[1],
            facelift: Number(m[2]),
            series: { key: seriesKey },
            source: { not: 'wikidata' },
          },
          select: { startYear: true, endYear: true },
        })
      : [];
    const yil = rows.length
      ? ` (${Math.min(...rows.map((r) => r.startYear))}–${Math.max(...rows.map((r) => r.endYear ?? new Date().getFullYear()))})`
      : '';
    return `${m[1]} · ${m[2] === '0' ? 'makyajsız' : 'makyajlı'}${yil}`;
  }

  /** Aracın satış temsilcisi; atanmadıysa hesap sahibi */
  private async contactOf(v: PortfolioVehicle) {
    const uid =
      v.assignedTo ??
      (
        await this.db.accountMember.findFirst({
          where: { accountId: v.accountId, role: 'OWNER' },
          select: { userId: true },
        })
      )?.userId;
    const u = uid
      ? await this.db.user.findUnique({
          where: { id: uid },
          select: { firstName: true, lastName: true, phone: true },
        })
      : null;
    return { ad: [u?.firstName, u?.lastName].filter(Boolean).join(' ') || null, phone: u?.phone ?? null };
  }

  /** "Telefonu göster": girişli kullanıcıya temsilcinin numarası (PortfoyArac.dc.html) */
  async contact(no: number) {
    const v = await this.db.portfolioVehicle.findUnique({ where: { no: BigInt(no) } });
    if (v?.status !== 'PUBLISHED') throw new NotFoundException('Araç bulunamadı');
    return this.contactOf(v);
  }

  async photo(id: string) {
    const p = await this.db.portfolioPhoto.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Fotoğraf bulunamadı');
    return { ...(await this.storage.get(p.storageKey)), mime: p.mime, sha256: p.sha256 };
  }

  /** Ekspertiz raporu yalnızca yayındaki araçta açılır */
  async report(no: number) {
    const v = await this.db.portfolioVehicle.findUnique({ where: { no: BigInt(no) } });
    if (v?.status !== 'PUBLISHED' || !v.reportKey) throw new NotFoundException('Rapor bulunamadı');
    return this.storage.get(v.reportKey);
  }

  /** Galerinin yayındaki araç sayısı (profil) */
  publishedCount(accountId: string) {
    return this.db.portfolioVehicle.count({ where: { accountId, status: 'PUBLISHED' } });
  }
}
