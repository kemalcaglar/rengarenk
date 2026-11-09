import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { photoCaption } from '@rengarenk/catalog';
import { Prisma, uuidv7 } from '@rengarenk/db';
import sharp from 'sharp';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { STORAGE, type Storage } from '../storage/storage.service.js';
import { COMMONS_CLIENT, type CommonsClient } from './commons-client.js';

/** Bir nesil için saklanan en çok aday sayısı */
const MAX_CANDIDATES = 12;

/** Bulanıklaştırılacak alan: fotoğrafın genişlik ve yüksekliğine oranla (0–1) */
export interface BlurArea {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Depodaki dosyayı belleğe okur */
async function oku(akis: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const parca: Buffer[] = [];
  for await (const p of akis) parca.push(Buffer.from(p));
  return Buffer.concat(parca);
}

export const MAKYAJ_ADI = (m: number | null) =>
  m === null ? 'Nesil geneli' : m === 0 ? 'Makyaj öncesi' : `${m}. makyaj`;

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
            facelift: true,
            edited: true,
            blurAreas: true,
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
        // Konsolda önizleme Commons'un küçük kopyasından (seçilmeden depoya alınmaz); seçilende depodaki kopya
        // (plaka bulanıklaştırması bunun üzerinde işaretlenir)
        preview: i.sourceUrl.replace(/\/1600px-/, '/400px-'),
        kopya: i.status === 'secildi' ? `/catalog/images/${i.id}?v=${i.edited ? 'd' : 'o'}` : null,
        makyajAd: i.status === 'secildi' ? MAKYAJ_ADI(i.facelift) : null,
      })),
    }));
  }

  /**
   * Seçim: dosya Commons'tan indirilir, depoya yazılır, nesil ve makyaj için kalıcı olur (Karar 34). `makyaj`: 0
   * makyaj öncesi, 1+ makyajlı, boş nesil geneli.
   */
  async select(id: string, staffId: string, ip?: string, makyaj: number | null = null) {
    const img = await this.db.catalogImage.findUnique({ where: { id } });
    if (!img) throw new NotFoundException('Fotoğraf bulunamadı');
    if (img.status !== 'aday') throw new ConflictException('Yalnızca aday fotoğraf seçilir');
    const taken = await this.db.catalogImage.findFirst({
      where: { generationId: img.generationId, status: 'secildi', facelift: makyaj },
      select: { id: true },
    });
    if (taken)
      throw new ConflictException(
        `Bu nesil için ${MAKYAJ_ADI(makyaj).toLocaleLowerCase('tr-TR')} fotoğrafı zaten seçili (Karar 34)`,
      );

    const file = await this.commons.download(img.sourceUrl);
    const sha256 = createHash('sha256').update(file.body).digest('hex');
    const ext = file.contentType === 'image/png' ? 'png' : 'jpg';
    const storageKey = `katalog/nesil/${img.generationId}/${sha256}.${ext}`;
    await this.storage.put(storageKey, file.body, file.contentType);

    return this.db.$transaction(async (tx) => {
      const updated = await tx.catalogImage.update({
        where: { id },
        data: {
          status: 'secildi',
          storageKey,
          sha256,
          facelift: makyaj,
          decidedBy: staffId,
          decidedAt: new Date(),
        },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'katalog_fotograf_secildi',
          entityType: 'catalog_image',
          entityId: id,
          after: {
            nesil: img.generationId,
            makyaj,
            dosya: img.commonsFile,
            lisans: img.license,
            yazar: img.author,
          },
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

  /**
   * Plaka bulanıklaştırma (Karar 34): katalog sorumlusu seçili fotoğrafta plakayı işaretler; alanlar pikselleştirilip
   * bulanıklaştırılır, düzenlenmiş kopya depoya yazılır ve gösterilen kopya o olur. Özgün kopya saklanır (geri alınabilir);
   * atıfta "düzenlendi" yazar, fotoğraf aynı lisansla yayınlanır. Her düzenleme özgün kopyadan yeniden yapılır.
   */
  async blur(id: string, alanlar: BlurArea[], staffId: string, ip?: string) {
    const img = await this.db.catalogImage.findUnique({ where: { id } });
    if (img?.status !== 'secildi' || !img.storageKey)
      throw new NotFoundException('Seçili fotoğraf bulunamadı');
    if (!alanlar.length) throw new BadRequestException('Bulanıklaştırılacak alan seç');
    const kaynakKey = img.originalKey ?? img.storageKey;
    const kaynak = await this.storage.get(kaynakKey);
    // Yön bilgisi uygulanır: konsoldaki görüntüyle aynı koordinatlar
    const taban = await sharp(await oku(kaynak.body))
      .rotate()
      .toBuffer();
    const { width: W = 0, height: H = 0 } = await sharp(taban).metadata();
    if (!W || !H) throw new BadRequestException('Fotoğraf okunamadı');
    const parcalar: sharp.OverlayOptions[] = [];
    for (const a of alanlar) {
      const left = Math.max(0, Math.min(W - 1, Math.round(a.x * W)));
      const top = Math.max(0, Math.min(H - 1, Math.round(a.y * H)));
      const width = Math.max(4, Math.min(W - left, Math.round(a.w * W)));
      const height = Math.max(4, Math.min(H - top, Math.round(a.h * H)));
      // Pikselleştir (yaklaşık 10 blok) ve yumuşat: plaka geri okunamaz
      const kucuk = await sharp(taban)
        .extract({ left, top, width, height })
        .resize(Math.max(1, Math.round(width / Math.max(6, width / 10))), undefined, { kernel: 'nearest' })
        .toBuffer();
      const parca = await sharp(kucuk)
        .resize(width, height, { kernel: 'nearest', fit: 'fill' })
        .blur(Math.max(2, Math.round(Math.min(width, height) / 8)))
        .toBuffer();
      parcalar.push({ input: parca, left, top });
    }
    const png = kaynak.contentType === 'image/png';
    const cikti = await (png
      ? sharp(taban).composite(parcalar).png()
      : sharp(taban).composite(parcalar).jpeg({ quality: 88 })
    ).toBuffer();
    const sha256 = createHash('sha256').update(cikti).digest('hex');
    const storageKey = `katalog/nesil/${img.generationId}/${sha256}-duzenlendi.${png ? 'png' : 'jpg'}`;
    await this.storage.put(storageKey, cikti, png ? 'image/png' : 'image/jpeg');
    return this.db.$transaction(async (tx) => {
      const updated = await tx.catalogImage.update({
        where: { id },
        data: {
          storageKey,
          sha256,
          edited: true,
          originalKey: kaynakKey,
          blurAreas: alanlar as unknown as Prisma.InputJsonValue,
        },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'katalog_fotograf_duzenlendi',
          entityType: 'catalog_image',
          entityId: id,
          after: { alan: alanlar.length, dosya: img.commonsFile },
          ip,
        },
        tx,
      );
      return updated;
    });
  }

  /** Düzenlemeyi geri al: özgün kopya yeniden gösterilir (düzenlenmiş kopya depoda kalır) */
  async unblur(id: string, staffId: string, ip?: string) {
    const img = await this.db.catalogImage.findUnique({ where: { id } });
    if (img?.status !== 'secildi' || !img.edited || !img.originalKey)
      throw new ConflictException('Düzenlenmiş fotoğraf yok');
    const ozgun = await oku((await this.storage.get(img.originalKey)).body);
    const sha256 = createHash('sha256').update(ozgun).digest('hex');
    return this.db.$transaction(async (tx) => {
      const updated = await tx.catalogImage.update({
        where: { id },
        data: { storageKey: img.originalKey, sha256, edited: false, blurAreas: Prisma.DbNull },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'katalog_fotograf_duzenleme_geri_alindi',
          entityType: 'catalog_image',
          entityId: id,
          after: { dosya: img.commonsFile },
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
    edited?: boolean;
    sha256?: string | null;
  }) {
    return {
      id: i.id,
      // Düzenlenince adres değişir (önbellekteki eski kopya gösterilmesin)
      url: `/catalog/images/${i.id}${i.sha256 ? `?v=${i.sha256.slice(0, 8)}` : ''}`,
      author: i.author,
      license: i.license,
      licenseUrl: i.licenseUrl,
      pageUrl: i.pageUrl,
      caption: photoCaption(i, Boolean(i.edited)),
    };
  }

  async file(id: string) {
    const img = await this.db.catalogImage.findUnique({ where: { id } });
    if (img?.status !== 'secildi' || !img.storageKey) throw new NotFoundException('Fotoğraf bulunamadı');
    return { ...(await this.storage.get(img.storageKey)), sha256: img.sha256 };
  }
}
