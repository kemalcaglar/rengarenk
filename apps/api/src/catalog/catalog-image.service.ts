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
import { GORSEL_EN_AZ_GENISLIK, hideDemandText } from '@rengarenk/shared';
import sharp from 'sharp';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { STORAGE, type Storage } from '../storage/storage.service.js';
import { COMMONS_CLIENT, type CommonsClient } from './commons-client.js';
import { galeriFotoGeriCek } from './galeri-foto.js';
import type { FotoHedef } from './photo-pick.js';
import { type FotoVerisi, fotoVerisi, talepFotolari } from './talep-foto.js';

/** Fotoğrafın yeri: nesil/kuşak ya da seri (yıl aralığıyla) */
interface Yer {
  generationId: string | null;
  seriesId: string | null;
  yearFrom: number | null;
  yearTo: number | null;
}

export interface SecimSecenegi {
  /** Aynı yerde seçili fotoğraf varsa kaldırıp bununla değiştir */
  degistir?: boolean;
  /** Seri fotoğrafında yıl aralığı (boşsa model geneli) */
  yil?: [number, number] | null;
}

/** Konsoldaki fotoğraf kartının alanları */
const GORSEL_ALANLARI = {
  id: true,
  status: true,
  origin: true,
  facelift: true,
  yearFrom: true,
  yearTo: true,
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
} as const;

/** Konsol önizlemesi: Commons'un küçük kopyası, galeri fotoğrafı API'den, seçilende depodaki kopya */
const onizle = (i: Prisma.CatalogImageGetPayload<{ select: typeof GORSEL_ALANLARI }>) => ({
  ...i,
  preview:
    i.origin === 'commons'
      ? i.sourceUrl.replace(/\/1600px-/, '/400px-')
      : i.origin === 'yukleme'
        ? `/catalog/images/${i.id}`
        : i.sourceUrl,
  kopya: i.status === 'secildi' ? `/catalog/images/${i.id}?v=${i.edited ? 'd' : 'o'}` : null,
  makyajAd:
    i.status === 'secildi'
      ? i.yearFrom || i.yearTo
        ? `${i.yearFrom ?? '…'}–${i.yearTo ?? '…'}`
        : MAKYAJ_ADI(i.facelift)
      : null,
});

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

/** Galeri fotoğrafının lisans alanı (galerinin izni; Kullanım koşulları, galeri sözleşmesi madde 10) */
export const GALERI_IZNI = 'Galeri izniyle';

/** Kamuya açık galeri fotoğrafı atfı (Karar 34: galeri adıyla) */
export function galeriCaption(galeri: string, edited = false): string {
  return `Fotoğraf: ${galeri} · galeri portföyü · temsilî görsel${edited ? ' · düzenlendi' : ''}`;
}

/** Plaka alanlarını pikselleştirip bulanıklaştırır (Karar 34); yön bilgisi uygulanır */
async function bulaniklastir(girdi: Buffer, png: boolean, alanlar: BlurArea[]): Promise<Buffer> {
  const taban = await sharp(girdi).rotate().toBuffer();
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
  return (
    png ? sharp(taban).composite(parcalar).png() : sharp(taban).composite(parcalar).jpeg({ quality: 88 })
  ).toBuffer();
}

/** Depodaki klasör: nesil/kuşak fotoğrafı ya da model geneli (seri) fotoğrafı */
const klasor = (img: { generationId: string | null; seriesId: string | null }) =>
  img.generationId ? `katalog/nesil/${img.generationId}` : `katalog/seri/${img.seriesId}`;

/** Aynı yerde (nesil ve makyaj ya da seri ve yıl aralığı) seçili fotoğraf */
const yeri = (img: {
  generationId: string | null;
  seriesId: string | null;
  facelift: number | null;
  yearFrom: number | null;
  yearTo: number | null;
}) =>
  img.generationId
    ? { generationId: img.generationId, facelift: img.facelift }
    : { seriesId: img.seriesId, yearFrom: img.yearFrom, yearTo: img.yearTo };

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
    private readonly outbox: OutboxService,
  ) {}

  /**
   * Fotoğrafı seçilmemiş ve adayı olmayan nesiller için Commons'tan aday toplar. `limit`: bir çalıştırmada en çok
   * kaç kategori sorulur (Wikimedia'ya yük bindirmemek için).
   */
  async findCandidates(opts: { limit?: number; force?: boolean } = {}) {
    const source = await this.db.catalogSource.findUniqueOrThrow({ where: { key: 'commons' } });
    if (!source.autoFetch && !opts.force) {
      const galeri = await this.galleryCandidates();
      return { durum: 'kapali', nesil: 0, aday: 0, galeri };
    }
    const gens = await this.db.catalogGeneration.findMany({
      where: {
        source: 'wikidata',
        commonsCategory: { not: null },
        images: { none: { origin: 'commons' } },
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
    // Commons'ta fotoğrafı olmayan nesillere galerilerin izin verdiği portföy fotoğrafları (Karar 34)
    const galeri = await this.galleryCandidates();
    // Görsel bekleyen taleplerin modelleri: Commons'ta "Marka Seri" kategorisi (sahip isteği, 17 Kasım 2026)
    const model = await this.seriAdaylari();
    return { durum: 'uygulandi', nesil: gens.length, aday: added, galeri, model: model.aday };
  }

  /**
   * Galeri adayları (Karar 34: "Commons'ta fotoğraf yoksa"): yayındaki, fotoğraflarının katalogda kullanılmasına izin
   * verilmiş ve kasası nesil koduyla seçilmiş portföy araçlarının ilk fotoğrafları, Commons adayı ya da seçili Commons
   * fotoğrafı olmayan nesle aday olur. Katalog sorumlusu plakayı bulanıklaştırarak seçer; atıfta galeri adı yazar.
   * İzin yeniden açılırsa geri çekilen aday geri gelir.
   */
  async galleryCandidates(opts: { limit?: number } = {}) {
    const araclar = await this.db.portfolioVehicle.findMany({
      where: {
        status: 'PUBLISHED',
        photoCatalogOk: true,
        moderatedAt: null,
        seriesKey: { not: null },
        generationKey: { contains: ':' },
        photos: { some: {} },
        account: { status: 'ACTIVE', gallery: { isNot: null } },
      },
      select: {
        id: true,
        accountId: true,
        seriesKey: true,
        generationKey: true,
        account: { select: { gallery: { select: { displayName: true, slug: true } } } },
        photos: { orderBy: { sort: 'asc' }, take: 2, select: { id: true, storageKey: true, mime: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: opts.limit ?? 300,
    });
    let eklendi = 0;
    const nesiller = new Map<string, { id: string; uygun: boolean; sayi: number } | null>();
    for (const v of araclar) {
      const m = /^([^:/]+):(\d+)$/.exec(v.generationKey ?? '');
      const galeri = v.account.gallery;
      if (!m || !galeri) continue;
      const anahtar = `${v.seriesKey}|${m[1]}`;
      if (!nesiller.has(anahtar)) {
        const g = await this.db.catalogGeneration.findFirst({
          where: { source: 'wikidata', code: m[1], series: { key: v.seriesKey as string } },
          select: {
            id: true,
            images: { where: { status: { in: ['aday', 'secildi'] } }, select: { origin: true } },
          },
        });
        nesiller.set(
          anahtar,
          g
            ? {
                id: g.id,
                uygun: !g.images.some((i) => i.origin === 'commons'),
                sayi: g.images.length,
              }
            : null,
        );
      }
      const n = nesiller.get(anahtar);
      if (!n?.uygun) continue;
      for (const f of v.photos) {
        const dosya = `galeri:${f.id}`;
        const var_ = await this.db.catalogImage.findUnique({
          where: { generationId_commonsFile: { generationId: n.id, commonsFile: dosya } },
          select: { id: true, status: true },
        });
        if (var_) {
          // İzin yeniden açıldı: geri çekilen aday geri gelir
          if (var_.status === 'geri_alindi') {
            await this.db.catalogImage.update({ where: { id: var_.id }, data: { status: 'aday' } });
            eklendi++;
          }
          continue;
        }
        if (n.sayi >= MAX_CANDIDATES) break;
        let width = 0;
        let height = 0;
        try {
          const meta = await sharp(await oku((await this.storage.get(f.storageKey)).body)).metadata();
          width = meta.width ?? 0;
          height = meta.height ?? 0;
        } catch (err) {
          this.log.warn(`Galeri fotoğrafı okunamadı (${f.id}): ${(err as Error).message}`);
          continue;
        }
        await this.db.catalogImage.create({
          data: {
            id: uuidv7(),
            generationId: n.id,
            origin: 'galeri',
            commonsFile: dosya,
            pageUrl: `/galeri/${galeri.slug}`,
            sourceUrl: `/portfoy/fotolar/${f.id}`,
            width,
            height,
            mime: f.mime,
            author: galeri.displayName,
            license: GALERI_IZNI,
            facelift: Number(m[2]),
            portfolioPhotoId: f.id,
            portfolioVehicleId: v.id,
            galleryAccountId: v.accountId,
          },
        });
        n.sayi++;
        eklendi++;
      }
    }
    return eklendi;
  }

  /**
   * Konsol: seçim bekleyen yerler (adayı olan, seçili fotoğrafı olmayan nesil, kuşak ve modeller) ya da seçilmiş
   * fotoğrafı olan yerler. Model adına göre sıralı, en çok 200.
   */
  async review(opts: { durum?: 'bekleyen' | 'secili' } = {}) {
    const secili = opts.durum === 'secili';
    const kosul = secili
      ? { images: { some: { status: 'secildi' } } }
      : { images: { some: { status: 'aday' } }, NOT: { images: { some: { status: 'secildi' } } } };
    const [gens, seriler] = await Promise.all([
      this.db.catalogGeneration.findMany({
        where: kosul,
        select: {
          id: true,
          source: true,
          series: { select: { name: true, make: { select: { name: true } } } },
          startYear: true,
        },
        orderBy: [{ series: { name: 'asc' } }, { startYear: 'asc' }],
        take: 200,
      }),
      this.db.catalogSeries.findMany({
        where: kosul,
        select: { id: true, name: true, make: { select: { name: true } } },
        orderBy: { name: 'asc' },
        take: 200,
      }),
    ]);
    const yerler = [
      ...seriler.map((x) => ({
        ad: `${x.make.name} ${x.name}`,
        yil: 0,
        h: { tur: 'seri' as const, id: x.id, makyaj: null },
      })),
      ...gens.map((g) => ({
        ad: `${g.series.make.name} ${g.series.name}`,
        yil: g.startYear,
        h: { tur: g.source === 'wikidata' ? ('nesil' as const) : ('kusak' as const), id: g.id, makyaj: null },
      })),
    ]
      .sort((a, b) => a.ad.localeCompare(b.ad, 'tr') || a.yil - b.yil)
      .slice(0, 200);
    return Promise.all(yerler.map(async (y) => ({ hedef: y.h, ...(await this.yerBilgisi(y.h)) })));
  }

  /**
   * Seçim: dosya Commons'tan indirilir, depoya yazılır, nesil ve makyaj için kalıcı olur (Karar 34). `makyaj`: 0
   * makyaj öncesi, 1+ makyajlı, boş nesil geneli.
   */
  async select(
    id: string,
    staffId: string,
    ip?: string,
    makyaj: number | null = null,
    plaka: { alanlar?: BlurArea[]; plakaYok?: boolean } = {},
    secenek: SecimSecenegi = {},
  ) {
    const bulunan = await this.db.catalogImage.findUnique({ where: { id } });
    if (!bulunan) throw new NotFoundException('Fotoğraf bulunamadı');
    if (bulunan.status !== 'aday') throw new ConflictException('Yalnızca aday fotoğraf seçilir');
    // Seri fotoğrafında makyaj yok; yıl aralığı seçimle belirlenir
    const img = bulunan.seriesId
      ? { ...bulunan, yearFrom: secenek.yil?.[0] ?? null, yearTo: secenek.yil?.[1] ?? null }
      : bulunan;
    if (img.seriesId) makyaj = null;
    if (img.origin === 'galeri') return this.selectGallery(img, staffId, ip, makyaj, plaka, secenek);
    await this.yerBos(img, makyaj, secenek.degistir);

    const file = await this.commons.download(img.sourceUrl);
    const sha256 = createHash('sha256').update(file.body).digest('hex');
    const ext = file.contentType === 'image/png' ? 'png' : 'jpg';
    const storageKey = `${klasor(img)}/${sha256}.${ext}`;
    await this.storage.put(storageKey, file.body, file.contentType);

    return this.db.$transaction(async (tx) => {
      await this.yerAc(tx, img, makyaj, staffId, ip);
      const updated = await tx.catalogImage.update({
        where: { id },
        data: {
          status: 'secildi',
          storageKey,
          sha256,
          facelift: makyaj,
          yearFrom: img.yearFrom,
          yearTo: img.yearTo,
          decidedBy: staffId,
          decidedAt: new Date(),
        },
      });
      await this.degisti(tx, img);
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'katalog_fotograf_secildi',
          entityType: 'catalog_image',
          entityId: id,
          after: {
            nesil: img.generationId,
            seri: img.seriesId,
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

  /**
   * Galeri fotoğrafını seçme (Karar 34: "plaka bulanık, galeri adı atfıyla"): plaka işaretlenir ve seçimle birlikte
   * bulanıklaştırılır ya da plakanın görünmediği onaylanır; plakalı kopya hiç yayına çıkmaz. İzin seçim anında yeniden
   * denetlenir.
   */
  private async selectGallery(
    img: Prisma.CatalogImageGetPayload<object>,
    staffId: string,
    ip: string | undefined,
    makyaj: number | null,
    plaka: { alanlar?: BlurArea[]; plakaYok?: boolean },
    secenek: SecimSecenegi,
  ) {
    const alanlar = plaka.alanlar ?? [];
    if (!alanlar.length && !plaka.plakaYok)
      throw new BadRequestException(
        'Galeri fotoğrafında plakayı işaretle ya da plakanın görünmediğini onayla',
      );
    const foto = img.portfolioPhotoId
      ? await this.db.portfolioPhoto.findUnique({
          where: { id: img.portfolioPhotoId },
          include: { vehicle: { select: { status: true, photoCatalogOk: true, moderatedAt: true } } },
        })
      : null;
    if (!foto?.vehicle.photoCatalogOk || foto.vehicle.moderatedAt || foto.vehicle.status !== 'PUBLISHED') {
      await galeriFotoGeriCek(this.db, { photoId: img.portfolioPhotoId ?? undefined });
      throw new ConflictException('Galerinin izni ya da fotoğraf artık yok; aday geri çekildi');
    }
    await this.yerBos(img, makyaj, secenek.degistir);
    const png = foto.mime === 'image/png';
    const ext = png ? 'png' : 'jpg';
    const ozgun = await oku((await this.storage.get(foto.storageKey)).body);
    const ozgunSha = createHash('sha256').update(ozgun).digest('hex');
    const ozgunKey = `${klasor(img)}/${ozgunSha}.${ext}`;
    await this.storage.put(ozgunKey, ozgun, png ? 'image/png' : 'image/jpeg');
    let storageKey = ozgunKey;
    let sha256 = ozgunSha;
    if (alanlar.length) {
      const cikti = await bulaniklastir(ozgun, png, alanlar);
      sha256 = createHash('sha256').update(cikti).digest('hex');
      storageKey = `${klasor(img)}/${sha256}-duzenlendi.${ext}`;
      await this.storage.put(storageKey, cikti, png ? 'image/png' : 'image/jpeg');
    }
    return this.db.$transaction(async (tx) => {
      await this.yerAc(tx, img, makyaj, staffId, ip);
      await this.degisti(tx, img);
      const updated = await tx.catalogImage.update({
        where: { id: img.id },
        data: {
          status: 'secildi',
          storageKey,
          sha256,
          facelift: makyaj,
          yearFrom: img.yearFrom,
          yearTo: img.yearTo,
          ...(alanlar.length
            ? {
                edited: true,
                originalKey: ozgunKey,
                blurAreas: alanlar as unknown as Prisma.InputJsonValue,
              }
            : {}),
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
          entityId: img.id,
          after: {
            nesil: img.generationId,
            seri: img.seriesId,
            makyaj,
            kaynak: 'galeri',
            galeri: img.galleryAccountId,
            arac: img.portfolioVehicleId,
            plaka: alanlar.length ? 'bulanik' : 'gorunmuyor',
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
          after: { nesil: img.generationId, seri: img.seriesId, dosya: img.commonsFile },
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
    const png = kaynak.contentType === 'image/png';
    // Yön bilgisi uygulanır: konsoldaki görüntüyle aynı koordinatlar
    const cikti = await bulaniklastir(await oku(kaynak.body), png, alanlar);
    const sha256 = createHash('sha256').update(cikti).digest('hex');
    const storageKey = `${klasor(img)}/${sha256}-duzenlendi.${png ? 'png' : 'jpg'}`;
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
    if (img.origin === 'galeri')
      throw new ConflictException(
        'Galeri fotoğrafı plakası bulanık gösterilir; alanları düzenleyebilirsin (Karar 34)',
      );
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

  // ── Talep görseli (sahip isteği, 17 Kasım 2026) ───────────────────

  /** Seçilecek yer boş mu; değilse `degistir` ile eskisi kaldırılır (işlem içinde, `yerAc`) */
  private async yerBos(img: Yer, makyaj: number | null, degistir?: boolean) {
    const taken = await this.db.catalogImage.findFirst({
      where: { ...yeri({ ...img, facelift: makyaj }), status: 'secildi' },
      select: { id: true },
    });
    if (taken && !degistir)
      throw new ConflictException(
        img.generationId
          ? `Bu nesil için ${MAKYAJ_ADI(makyaj).toLocaleLowerCase('tr-TR')} fotoğrafı zaten seçili; değiştirmek için “Bununla değiştir”i kullan`
          : 'Bu model için bu yıllarda fotoğraf zaten seçili; değiştirmek için “Bununla değiştir”i kullan',
      );
  }

  /** Aynı yerdeki seçili fotoğrafı kaldırır (kayıt silinmez, durum "kaldirildi") */
  private async yerAc(tx: Tx, img: Yer, makyaj: number | null, staffId: string, ip?: string) {
    const eski = await tx.catalogImage.findFirst({
      where: { ...yeri({ ...img, facelift: makyaj }), status: 'secildi' },
      select: { id: true, commonsFile: true },
    });
    if (!eski) return;
    await tx.catalogImage.update({
      where: { id: eski.id },
      data: { status: 'kaldirildi', decidedBy: staffId, decidedAt: new Date() },
    });
    await this.audit.record(
      {
        actorType: 'STAFF',
        actorId: staffId,
        action: 'katalog_fotograf_kaldirildi',
        entityType: 'catalog_image',
        entityId: eski.id,
        after: { dosya: eski.commonsFile, neden: 'degistirildi' },
        ip,
      },
      tx,
    );
  }

  /** Görsel değişti: serinin yayındaki talepleri arama dizininde yenilenir (işçi; aynı işlemde outbox) */
  private async degisti(tx: Tx, img: { generationId: string | null; seriesId: string | null }) {
    const seriesId =
      img.seriesId ??
      (img.generationId
        ? (
            await tx.catalogGeneration.findUnique({
              where: { id: img.generationId },
              select: { seriesId: true },
            })
          )?.seriesId
        : null);
    if (seriesId) await this.outbox.add(tx, 'katalog.fotograf_degisti', { seriesId });
  }

  /** Seçili fotoğrafı kaldırır: yerine başka fotoğraf seçilebilir; kalmazsa talep kapakla görünür */
  async remove(id: string, staffId: string, ip?: string) {
    const img = await this.db.catalogImage.findUnique({ where: { id } });
    if (img?.status !== 'secildi') throw new NotFoundException('Seçili fotoğraf bulunamadı');
    return this.db.$transaction(async (tx) => {
      const updated = await tx.catalogImage.update({
        where: { id },
        data: { status: 'kaldirildi', decidedBy: staffId, decidedAt: new Date() },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'katalog_fotograf_kaldirildi',
          entityType: 'catalog_image',
          entityId: id,
          after: { nesil: img.generationId, seri: img.seriesId, dosya: img.commonsFile },
          ip,
        },
        tx,
      );
      await this.degisti(tx, img);
      return updated;
    });
  }

  /**
   * Elle yükleme (sahip isteği): katalog sorumlusu bulduğu fotoğrafı nesle, kasa kuşağına ya da modele (seri) ekler.
   * Kaynak sayfası, yazar ve ticari kullanıma izin veren lisans zorunludur (Karar 34); fotoğraf hemen seçili olur,
   * aynı yerdeki eski fotoğraf kaldırılır. JPEG ve PNG olduğu gibi, WEBP JPEG'e çevrilerek saklanır.
   */
  async upload(
    hedef: { tur: 'nesil' | 'kusak' | 'seri'; id: string },
    dosya: Uint8Array,
    bilgi: {
      kaynak: string;
      yazar: string;
      lisans: string;
      makyaj?: number | null;
      /** Model geneli fotoğrafın yılları; uçlardan biri boş olabilir */
      yil?: [number | null, number | null] | null;
    },
    staffId: string,
    ip?: string,
  ) {
    if (hedef.tur === 'seri') {
      if (!(await this.db.catalogSeries.findUnique({ where: { id: hedef.id }, select: { id: true } })))
        throw new NotFoundException('Model bulunamadı');
    } else if (
      !(await this.db.catalogGeneration.findUnique({ where: { id: hedef.id }, select: { id: true } }))
    )
      throw new NotFoundException('Nesil ya da kasa bulunamadı');
    let meta: sharp.Metadata;
    try {
      meta = await sharp(dosya).metadata();
    } catch {
      throw new BadRequestException('Dosya okunamadı: JPEG, PNG ya da WEBP fotoğraf yükle');
    }
    if (!['jpeg', 'png', 'webp'].includes(meta.format ?? ''))
      throw new BadRequestException('Yalnızca JPEG, PNG ya da WEBP fotoğraf');
    const genislik = meta.autoOrient?.width ?? meta.width ?? 0;
    const yukseklik = meta.autoOrient?.height ?? meta.height ?? 0;
    if (genislik < GORSEL_EN_AZ_GENISLIK)
      throw new BadRequestException(`Fotoğraf en az ${GORSEL_EN_AZ_GENISLIK} piksel genişlikte olmalı`);
    const png = meta.format === 'png';
    // Yön bilgisi uygulanır, konum gibi meta veriler atılır
    const govde = png
      ? await sharp(dosya).rotate().png().toBuffer()
      : await sharp(dosya).rotate().jpeg({ quality: 88 }).toBuffer();
    const mime = png ? 'image/png' : 'image/jpeg';
    const sha256 = createHash('sha256').update(govde).digest('hex');
    const img = {
      generationId: hedef.tur === 'seri' ? null : hedef.id,
      seriesId: hedef.tur === 'seri' ? hedef.id : null,
      yearFrom: hedef.tur === 'seri' ? (bilgi.yil?.[0] ?? null) : null,
      yearTo: hedef.tur === 'seri' ? (bilgi.yil?.[1] ?? null) : null,
    };
    const makyaj = hedef.tur === 'nesil' ? (bilgi.makyaj ?? null) : null;
    const storageKey = `${klasor(img)}/${sha256}.${png ? 'png' : 'jpg'}`;
    await this.storage.put(storageKey, govde, mime);
    const id = uuidv7();
    return this.db.$transaction(async (tx) => {
      await this.yerAc(tx, img, makyaj, staffId, ip);
      const created = await tx.catalogImage.create({
        data: {
          id,
          ...img,
          origin: 'yukleme',
          commonsFile: `yukleme:${sha256.slice(0, 16)}`,
          pageUrl: bilgi.kaynak,
          sourceUrl: bilgi.kaynak,
          width: genislik,
          height: yukseklik,
          mime,
          author: bilgi.yazar,
          license: bilgi.lisans,
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
          action: 'katalog_fotograf_yuklendi',
          entityType: 'catalog_image',
          entityId: id,
          after: { ...img, makyaj, kaynak: bilgi.kaynak, yazar: bilgi.yazar, lisans: bilgi.lisans },
          ip,
        },
        tx,
      );
      await this.degisti(tx, img);
      return created;
    });
  }

  /**
   * Bir yer için Commons'tan aday arar (konsol: kategori adı katalog sorumlusundan; seride kendiliğinden
   * "Marka Seri" denenir). Bulunan kategori nesle ya da seriye yazılır.
   */
  async adayAra(hedef: { tur: 'nesil' | 'kusak' | 'seri'; id: string }, kategori: string) {
    const kat = kategori.replace(/^Category:/i, '').trim();
    const list = (await this.commons.candidates(kat)).slice(0, MAX_CANDIDATES);
    const yer = hedef.tur === 'seri' ? { seriesId: hedef.id } : { generationId: hedef.id };
    const r = list.length
      ? await this.db.catalogImage.createMany({
          data: list.map((c) => ({ id: uuidv7(), ...yer, ...c })),
          skipDuplicates: true,
        })
      : { count: 0 };
    if (hedef.tur === 'seri')
      await this.db.catalogSeries.update({
        where: { id: hedef.id },
        data: { commonsCheckedAt: new Date(), ...(list.length ? { commonsCategory: kat } : {}) },
      });
    else if (list.length)
      await this.db.catalogGeneration.updateMany({
        where: { id: hedef.id, commonsCategory: null },
        data: { commonsCategory: kat },
      });
    return { bulunan: list.length, eklenen: r.count };
  }

  /**
   * Görsel bekleyen yayındaki taleplerin modelleri için Commons'ta "Marka Seri" kategorisine bir kez bakar
   * (`findCandidates` içinden; Wikimedia'ya yük bindirmemek için çalıştırma başına sınırlı).
   */
  async seriAdaylari(limit = 20) {
    const bekleyen = await this.bekleyenTalepler();
    let bakilan = 0;
    let aday = 0;
    for (const h of bekleyen.hedefler) {
      if (bakilan >= limit) break;
      const seri = await this.db.catalogSeries.findUnique({
        where: { id: h.seriesId },
        select: {
          id: true,
          name: true,
          commonsCheckedAt: true,
          make: { select: { name: true } },
          images: { where: { status: 'aday' }, select: { id: true }, take: 1 },
        },
      });
      if (!seri || seri.commonsCheckedAt || seri.images.length || h.adaylar.length) continue;
      bakilan++;
      try {
        aday += (await this.adayAra({ tur: 'seri', id: seri.id }, `${seri.make.name} ${seri.name}`)).eklenen;
      } catch (err) {
        this.log.warn(
          `Commons model adayı alınamadı (${seri.make.name} ${seri.name}): ${(err as Error).message}`,
        );
      }
    }
    return { bakilan, aday };
  }

  /**
   * Görsel bekleyen talepler (sahip isteği): yayındaki talepler içinde katalogda fotoğrafı bulunmayanlar, fotoğrafın
   * gideceği yere (nesil, kasa kuşağı ya da model) göre gruplanmış; her yerin Commons adaylarıyla.
   */
  async bekleyenTalepler(limit = 500) {
    const talepler = await this.db.demand.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        no: true,
        seriesKey: true,
        yearMin: true,
        yearMax: true,
        data: true,
        headline: true,
        title: true,
        publishedAt: true,
        category: { select: { name: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
    const veriler = new Map<string, FotoVerisi | null>();
    const gruplar = new Map<
      string,
      { hedef: FotoHedef; seriesId: string; talepler: { no: number; baslik: string; yayin: string | null }[] }
    >();
    let katalogsuz = 0;
    for (const d of talepler) {
      if (!d.seriesKey) {
        katalogsuz++;
        continue;
      }
      if (!veriler.has(d.seriesKey)) veriler.set(d.seriesKey, await fotoVerisi(this.db, d.seriesKey));
      const v = veriler.get(d.seriesKey);
      if (!v) {
        katalogsuz++;
        continue;
      }
      const alts = (d.data as { alternatifler?: Record<string, unknown>[] } | null)?.alternatifler ?? [];
      const r = talepFotolari(v, d, alts).ana;
      if (r.foto) continue;
      const k = `${r.hedef.tur}:${r.hedef.id}:${r.hedef.makyaj ?? ''}`;
      const g = gruplar.get(k) ?? { hedef: r.hedef, seriesId: v.seriesId, talepler: [] };
      g.talepler.push({
        no: Number(d.no),
        baslik: hideDemandText(d.headline) || d.title || d.category.name,
        yayin: d.publishedAt?.toISOString() ?? null,
      });
      gruplar.set(k, g);
    }
    const hedefler = await Promise.all(
      [...gruplar.values()].map(async (g) => ({ ...(await this.yerBilgisi(g.hedef)), ...g })),
    );
    hedefler.sort((a, b) => b.talepler.length - a.talepler.length || a.baslik.localeCompare(b.baslik, 'tr'));
    return { hedefler, katalogsuz, toplam: hedefler.reduce((n, h) => n + h.talepler.length, 0) };
  }

  /** Yerin konsoldaki adı, Commons kategorisi (ya da öneri), adayları ve seçili fotoğrafları */
  private async yerBilgisi(hedef: FotoHedef) {
    const gorsel = { status: { in: ['aday', 'secildi'] } };
    const resimSec = {
      where: gorsel,
      orderBy: [{ status: 'desc' as const }, { score: 'desc' as const }],
      select: GORSEL_ALANLARI,
    };
    if (hedef.tur === 'seri') {
      const s = await this.db.catalogSeries.findUniqueOrThrow({
        where: { id: hedef.id },
        select: { name: true, commonsCategory: true, make: { select: { name: true } }, images: resimSec },
      });
      return {
        baslik: `${s.make.name} ${s.name} · model geneli`,
        yillar: null,
        kategori: s.commonsCategory,
        oneri: s.commonsCategory ?? `${s.make.name} ${s.name}`,
        adaylar: s.images.map(onizle),
      };
    }
    const g = await this.db.catalogGeneration.findUniqueOrThrow({
      where: { id: hedef.id },
      select: {
        name: true,
        code: true,
        body: true,
        startYear: true,
        endYear: true,
        commonsCategory: true,
        series: { select: { name: true, make: { select: { name: true } } } },
        images: resimSec,
      },
    });
    const ad = `${g.series.make.name} ${g.series.name}`;
    // Kuşak adı çoğu zaman seri adıyla başlar ("Clio 5 Doors (2025)"): seri adı iki kez yazılmaz
    const kusakAd = g.name.toLocaleLowerCase('tr-TR').startsWith(g.series.name.toLocaleLowerCase('tr-TR'))
      ? `${g.series.make.name} ${g.name}`
      : `${ad} ${g.name}`;
    return {
      baslik: g.code ? `${ad} ${g.code}` : `${kusakAd}${g.body ? ` · ${g.body}` : ''}`,
      yillar: `${g.startYear}–${g.endYear ?? '…'}`,
      kategori: g.commonsCategory,
      oneri: g.commonsCategory ?? (g.code ? `${ad} (${g.code})` : ad),
      adaylar: g.images.map(onizle),
    };
  }

  /** Konsol › Araç ara: seri adına göre (en çok 20) */
  async seriAra(q: string) {
    const t = q.trim();
    if (t.length < 2) return [];
    const kelimeler = t.split(/\s+/).slice(0, 3);
    const list = await this.db.catalogSeries.findMany({
      where: {
        AND: kelimeler.map((k) => ({
          OR: [
            { name: { contains: k, mode: 'insensitive' as const } },
            { make: { name: { contains: k, mode: 'insensitive' as const } } },
          ],
        })),
      },
      select: {
        id: true,
        name: true,
        make: { select: { name: true } },
        lineup: { select: { seriesId: true } },
      },
      take: 40,
    });
    return list
      .map((s) => ({ id: s.id, ad: `${s.make.name} ${s.name}`, anaListe: Boolean(s.lineup) }))
      .sort((a, b) => Number(b.anaListe) - Number(a.anaListe) || a.ad.localeCompare(b.ad, 'tr'))
      .slice(0, 20);
  }

  /**
   * Konsol › bir modelin bütün görsel yerleri: model geneli, nesil kodları ve kasa kuşakları (yıllarıyla), seçili
   * fotoğrafları ve adaylarıyla. Katalog sorumlusu her birine fotoğraf seçer, değiştirir ya da yükler.
   */
  async seriYerleri(seriesId: string) {
    const s = await this.db.catalogSeries.findUnique({ where: { id: seriesId }, select: { id: true } });
    if (!s) throw new NotFoundException('Model bulunamadı');
    const sources = (
      await this.db.catalogSource.findMany({ where: { active: true }, select: { key: true } })
    ).map((x) => x.key);
    const gens = await this.db.catalogGeneration.findMany({
      where: { seriesId, source: { in: sources } },
      select: { id: true, source: true, code: true, name: true, body: true, startYear: true },
      orderBy: [{ startYear: 'desc' }, { name: 'asc' }],
    });
    // Kodlu kuşak satırları fotoğrafı nesil koduyla paylaşır: yalnızca kodsuz kuşaklar ayrı yerdir
    const kodlar = new Set(gens.filter((g) => g.source === 'wikidata').map((g) => g.code));
    const yerler: FotoHedef[] = [
      { tur: 'seri', id: seriesId, makyaj: null },
      ...gens
        .filter((g) => g.source === 'wikidata' || !g.code || !kodlar.has(g.code))
        .map((g) => ({
          tur: g.source === 'wikidata' ? ('nesil' as const) : ('kusak' as const),
          id: g.id,
          makyaj: null,
        })),
    ];
    return Promise.all(yerler.map(async (h) => ({ hedef: h, ...(await this.yerBilgisi(h)) })));
  }

  /**
   * Seçili fotoğrafın kamuya açık bilgisi ve atfı. `yakin`: nesilde fotoğraf yoksa en yakın neslin fotoğrafı
   * gösterilir ve atıfta "önceki nesil" (ya da "sonraki nesil") yazar (Karar 34); "seri": model geneli fotoğraf.
   */
  static publicPhoto(
    i: {
      id: string;
      author: string;
      license: string;
      licenseUrl: string | null;
      pageUrl: string;
      width: number;
      height: number;
      edited?: boolean;
      sha256?: string | null;
      origin?: string;
    },
    yakin: 'onceki' | 'sonraki' | 'seri' | null = null,
  ) {
    const galeri = i.origin === 'galeri';
    const yukleme = i.origin === 'yukleme';
    const atif = galeri
      ? galeriCaption(i.author, Boolean(i.edited))
      : yukleme
        ? `Fotoğraf: ${i.author} · ${i.license} · temsilî görsel${i.edited ? ' · düzenlendi' : ''}`
        : photoCaption(i, Boolean(i.edited));
    const nesil = yakin === 'onceki' || yakin === 'sonraki' ? yakin : null;
    return {
      id: i.id,
      // Düzenlenince adres değişir (önbellekteki eski kopya gösterilmesin)
      url: `/catalog/images/${i.id}${i.sha256 ? `?v=${i.sha256.slice(0, 8)}` : ''}`,
      author: i.author,
      license: i.license,
      licenseUrl: i.licenseUrl,
      pageUrl: i.pageUrl,
      kaynak: galeri ? ('galeri' as const) : yukleme ? ('yukleme' as const) : ('commons' as const),
      nesil,
      /** Model geneli fotoğraf (nesil ya da kasa bilinmiyor) */
      genel: yakin === 'seri',
      caption: `${atif}${nesil ? ` · ${nesil === 'onceki' ? 'önceki' : 'sonraki'} nesil` : ''}`,
    };
  }

  async file(id: string) {
    const img = await this.db.catalogImage.findUnique({ where: { id } });
    if (img?.status !== 'secildi' || !img.storageKey) throw new NotFoundException('Fotoğraf bulunamadı');
    return { ...(await this.storage.get(img.storageKey)), sha256: img.sha256 };
  }
}
