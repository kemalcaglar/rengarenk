import { createHash } from 'node:crypto';
import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { photoCaption } from '@rengarenk/catalog';
import { uuidv7 } from '@rengarenk/db';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { STORAGE, type Storage } from '../storage/storage.service.js';
import { COMMONS_CLIENT, type CommonsClient } from './commons-client.js';

/** Bir nesil için saklanan en çok aday sayısı */
const MAX_CANDIDATES = 12;

/**
 * Nesil fotoğrafları (Karar 34). Adaylar nesil kodunun Commons kategorisinden gelir; katalog sorumlusu birini seçer,
 * seçilen fotoğrafın kopyası atfıyla depoya alınır ve talep sayfasında temsilî görsel olarak gösterilir. Bir kez
 * seçilen fotoğraf o nesil için kalır. Kayıtlar silinmez.
 */
@Injectable()
export class CatalogImageService {
  private readonly log = new Logger(CatalogImageService.name);

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(COMMONS_CLIENT) private readonly commons: CommonsClient,
    @Inject(STORAGE) private readonly storage: Storage,
    private readonly audit: AuditService,
  ) {}

  /**
   * Fotoğrafı seçilmemiş ve adayı olmayan nesiller için Commons'tan aday toplar. `limit`: bir çalıştırmada en çok
   * kaç kategori sorulur (Wikimedia'ya yük bindirmemek için).
   */
  async findCandidates(opts: { limit?: number; force?: boolean } = {}) {
    const source = await this.db.catalogSource.findUniqueOrThrow({ where: { key: 'commons' } });
    if (!source.autoFetch && !opts.force) return { durum: 'kapali', nesil: 0, aday: 0 };
    const gens = await this.db.catalogGeneration.findMany({
      where: {
        source: 'wikidata',
        commonsCategory: { not: null },
        images: { none: {} },
      },
      select: { id: true, commonsCategory: true },
      take: opts.limit ?? 50,
      orderBy: { createdAt: 'asc' },
    });
    let added = 0;
    let failed = 0;
    for (const g of gens) {
      try {
        const list = (await this.commons.candidates(g.commonsCategory as string)).slice(0, MAX_CANDIDATES);
        if (!list.length) continue;
        const r = await this.db.catalogImage.createMany({
          data: list.map((c) => ({ id: uuidv7(), generationId: g.id, ...c })),
          skipDuplicates: true,
        });
        added += r.count;
      } catch (err) {
        failed++;
        this.log.warn(`Commons adayı alınamadı (${g.commonsCategory}): ${(err as Error).message}`);
      }
    }
    await this.db.catalogSource.update({
      where: { key: 'commons' },
      data: {
        lastCheckedAt: new Date(),
        ...(failed < gens.length || gens.length === 0
          ? { lastSuccessAt: new Date(), lastError: null }
          : { lastError: 'Commons yanıt vermedi' }),
      },
    });
    return { durum: 'uygulandi', nesil: gens.length, aday: added };
  }

  /** Konsol: nesil başına adaylar (seçilmiş nesiller dahil), tip sayısı çok olan seri önde. */
  async review(opts: { durum?: 'bekleyen' | 'secili' } = {}) {
    const gens = await this.db.catalogGeneration.findMany({
      where: {
        source: 'wikidata',
        images: opts.durum === 'secili' ? { some: { status: 'secildi' } } : { some: { status: 'aday' } },
        ...(opts.durum === 'secili' ? {} : { NOT: { images: { some: { status: 'secildi' } } } }),
      },
      select: {
        id: true,
        code: true,
        name: true,
        startYear: true,
        endYear: true,
        commonsCategory: true,
        series: { select: { name: true, make: { select: { name: true } } } },
        images: {
          where: { status: { in: ['aday', 'secildi'] } },
          orderBy: [{ status: 'desc' }, { score: 'desc' }],
          select: {
            id: true,
            status: true,
            commonsFile: true,
            pageUrl: true,
            sourceUrl: true,
            width: true,
            height: true,
            author: true,
            license: true,
            score: true,
          },
        },
      },
      orderBy: [{ series: { name: 'asc' } }, { startYear: 'asc' }],
      take: 200,
    });
    return gens.map((g) => ({
      ...g,
      images: g.images.map((i) => ({
        ...i,
        // Konsolda önizleme Commons'un küçük kopyasından (seçilmeden depoya alınmaz)
        preview: i.sourceUrl.replace(/\/1600px-/, '/400px-'),
      })),
    }));
  }

  /** Seçim: dosya Commons'tan indirilir, depoya yazılır, nesil için kalıcı olur. */
  async select(id: string, staffId: string, ip?: string) {
    const img = await this.db.catalogImage.findUnique({ where: { id } });
    if (!img) throw new NotFoundException('Fotoğraf bulunamadı');
    if (img.status !== 'aday') throw new ConflictException('Yalnızca aday fotoğraf seçilir');
    const taken = await this.db.catalogImage.findFirst({
      where: { generationId: img.generationId, status: 'secildi' },
      select: { id: true },
    });
    if (taken) throw new ConflictException('Bu nesil için fotoğraf zaten seçili (Karar 34)');

    const file = await this.commons.download(img.sourceUrl);
    const sha256 = createHash('sha256').update(file.body).digest('hex');
    const ext = file.contentType === 'image/png' ? 'png' : 'jpg';
    const storageKey = `katalog/nesil/${img.generationId}/${sha256}.${ext}`;
    await this.storage.put(storageKey, file.body, file.contentType);

    return this.db.$transaction(async (tx) => {
      const updated = await tx.catalogImage.update({
        where: { id },
        data: { status: 'secildi', storageKey, sha256, decidedBy: staffId, decidedAt: new Date() },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'katalog_fotograf_secildi',
          entityType: 'catalog_image',
          entityId: id,
          after: { nesil: img.generationId, dosya: img.commonsFile, lisans: img.license, yazar: img.author },
          ip,
        },
        tx,
      );
      return updated;
    });
  }

  async reject(id: string, staffId: string, ip?: string) {
    const img = await this.db.catalogImage.findUnique({ where: { id } });
    if (!img) throw new NotFoundException('Fotoğraf bulunamadı');
    if (img.status !== 'aday') throw new ConflictException('Yalnızca aday fotoğraf elenir');
    return this.db.$transaction(async (tx) => {
      const updated = await tx.catalogImage.update({
        where: { id },
        data: { status: 'reddedildi', decidedBy: staffId, decidedAt: new Date() },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'katalog_fotograf_elendi',
          entityType: 'catalog_image',
          entityId: id,
          after: { nesil: img.generationId, dosya: img.commonsFile },
          ip,
        },
        tx,
      );
      return updated;
    });
  }

  /** Seçili fotoğrafın kamuya açık bilgisi ve atfı */
  static publicPhoto(i: {
    id: string;
    author: string;
    license: string;
    licenseUrl: string | null;
    pageUrl: string;
    width: number;
    height: number;
  }) {
    return {
      id: i.id,
      url: `/catalog/images/${i.id}`,
      author: i.author,
      license: i.license,
      licenseUrl: i.licenseUrl,
      pageUrl: i.pageUrl,
      caption: photoCaption(i),
    };
  }

  async file(id: string) {
    const img = await this.db.catalogImage.findUnique({ where: { id } });
    if (img?.status !== 'secildi' || !img.storageKey) throw new NotFoundException('Fotoğraf bulunamadı');
    return { ...(await this.storage.get(img.storageKey)), sha256: img.sha256 };
  }
}
