import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma, uuidv7 } from '@rengarenk/db';
import {
  type DemandSearchQuery,
  demandOwnerName,
  demandSearchQuerySchema,
  hideDemandText,
  MAX_SAVED_SEARCHES,
} from '@rengarenk/shared';
import { type Db, PRISMA } from '../database/prisma.js';
import { DemandSearchService } from '../search/demand-search.service.js';

const DAY = 86_400_000;
const tl = (n: number) => `${new Intl.NumberFormat('tr-TR').format(n)} TL`;

/**
 * Favori talepler (Karar 06.4) ve kayıtlı aramalar (Karar 30). Favoriye eklenen talebin güncellenmesi, pasife
 * alınması ya da kapanması talep olaylarından bildirim katmanına gider (Aşama 7); kayıtlı aramanın "N yeni" sayısı
 * son bakıştan sonra yayınlanan uygun taleplerdir.
 */
@Injectable()
export class FavoritesService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly search: DemandSearchService,
  ) {}

  private async demandByNo(no: number) {
    const d = await this.db.demand.findUnique({
      where: { no: BigInt(no) },
      select: { id: true, status: true, userId: true },
    });
    if (!d || d.status === 'DRAFT') throw new NotFoundException('Talep bulunamadı');
    return d;
  }

  async add(userId: string, no: number) {
    const d = await this.demandByNo(no);
    if (d.userId === userId) throw new BadRequestException('Kendi talebini favoriye ekleyemezsin');
    await this.db.favorite.createMany({ data: [{ userId, demandId: d.id }], skipDuplicates: true });
  }

  async remove(userId: string, no: number) {
    const d = await this.demandByNo(no);
    await this.db.favorite.deleteMany({ where: { userId, demandId: d.id } });
  }

  async isFavorite(userId: string, demandId: string) {
    return Boolean(await this.db.favorite.findUnique({ where: { userId_demandId: { userId, demandId } } }));
  }

  /** Favoriler ve durumları: yayinda, son_gunler (son 2 gün), pasif, bulundu, kapandi */
  async list(userId: string) {
    const rows = await this.db.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        demand: {
          include: {
            category: { select: { slug: true, name: true } },
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    const keys = (k: 'makeKey' | 'seriesKey' | 'modelKey') => [
      ...new Set(rows.map((r) => r.demand[k]).filter((x): x is string => Boolean(x))),
    ];
    const [makes, series, models] = await Promise.all([
      this.db.catalogMake.findMany({
        where: { key: { in: keys('makeKey') } },
        select: { key: true, name: true },
      }),
      this.db.catalogSeries.findMany({
        where: { key: { in: keys('seriesKey') } },
        select: { key: true, name: true },
      }),
      this.db.catalogModel.findMany({
        where: { key: { in: keys('modelKey') } },
        select: { key: true, name: true },
      }),
    ]);
    const ad = new Map([...makes, ...series, ...models].map((x) => [x.key, x.name]));
    const now = Date.now();
    return rows.map(({ demand: d, createdAt }) => {
      const alts = ((d.data as { alternatifler?: { km?: unknown }[] } | null)?.alternatifler ?? []).map(
        (a) => a.km,
      );
      const kms = alts.filter((x): x is number => typeof x === 'number');
      const kalan = d.expiresAt ? d.expiresAt.getTime() - now : 0;
      const durum =
        d.status === 'PUBLISHED'
          ? kalan <= 2 * DAY
            ? 'son_gunler'
            : 'yayinda'
          : d.status === 'PASSIVE'
            ? 'pasif'
            : d.status === 'COMPLETED'
              ? 'bulundu'
              : 'kapandi';
      return {
        no: Number(d.no),
        baslik: hideDemandText(d.headline) || d.title || d.category.name,
        category: d.category,
        arac: [d.makeKey, d.seriesKey, d.modelKey]
          .map((k) => (k ? ad.get(k) : undefined))
          .filter(Boolean)
          .join(' '),
        kmMax: kms.length ? Math.max(...kms) : null,
        durum,
        yazilabilir: d.status === 'PUBLISHED',
        sahip: demandOwnerName(d.user.firstName, d.user.lastName, 'kisa'),
        il: d.il,
        ilce: d.ilce,
        yilMin: d.yearMin,
        yilMax: d.yearMax,
        butceMin: d.budgetMin === null ? null : Number(d.budgetMin),
        butceMax: d.budgetMax === null ? null : Number(d.budgetMax),
        yayin: d.publishedAt,
        bitis: d.status === 'PUBLISHED' ? d.expiresAt : null,
        eklendi: createdAt,
      };
    });
  }

  // ── Kayıtlı aramalar ──────────────────────────────────────────

  async searches(userId: string) {
    const rows = await this.db.savedSearch.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return Promise.all(
      rows.map(async (s) => {
        const q = s.query as unknown as DemandSearchQuery;
        const [tum, yeni] = await Promise.all([
          this.search.search({ ...q, boyut: 1 }).catch(() => null),
          this.search.search({ ...q, boyut: 1, yayinSonra: s.lastSeenAt }).catch(() => null),
        ]);
        return {
          id: s.id,
          ad: s.name,
          sorgu: q,
          kriterler: await this.chips(q),
          bildirim: s.notify,
          toplam: tum?.toplam ?? null,
          yeni: yeni?.toplam ?? null,
          olusturuldu: s.createdAt,
        };
      }),
    );
  }

  async createSearch(userId: string, ad: string, sorgu: DemandSearchQuery) {
    const { sayfa: _s, sira: _o, boyut: _b, ...q } = demandSearchQuerySchema.parse(sorgu);
    if ((await this.db.savedSearch.count({ where: { userId } })) >= MAX_SAVED_SEARCHES) {
      throw new ConflictException(
        `En fazla ${MAX_SAVED_SEARCHES} kayıtlı arama tutabilirsin; birini silip yeniden dene`,
      );
    }
    return this.db.savedSearch.create({
      data: { id: uuidv7(), userId, name: ad, query: q as unknown as Prisma.InputJsonValue },
      select: { id: true, name: true, notify: true },
    });
  }

  async updateSearch(userId: string, id: string, input: { ad?: string; bildirim?: string; gordum?: true }) {
    const r = await this.db.savedSearch.updateMany({
      where: { id, userId },
      data: {
        ...(input.ad ? { name: input.ad } : {}),
        ...(input.bildirim ? { notify: input.bildirim } : {}),
        ...(input.gordum ? { lastSeenAt: new Date() } : {}),
      },
    });
    if (r.count !== 1) throw new NotFoundException('Kayıtlı arama bulunamadı');
  }

  async removeSearch(userId: string, id: string) {
    const r = await this.db.savedSearch.deleteMany({ where: { id, userId } });
    if (r.count !== 1) throw new NotFoundException('Kayıtlı arama bulunamadı');
  }

  /** Kriter çipleri: "Otomobil", "BMW", "3 Serisi", "2019 ve sonrası", "İstanbul" … */
  private async chips(q: DemandSearchQuery) {
    const out: string[] = [];
    if (q.kategori) {
      const c = await this.db.category.findUnique({ where: { slug: q.kategori }, select: { name: true } });
      out.push(c?.name ?? q.kategori);
    }
    if (q.marka) {
      const m = await this.db.catalogMake.findUnique({ where: { key: q.marka }, select: { name: true } });
      out.push(m?.name ?? q.marka);
    }
    if (q.seri?.length) {
      const s = await this.db.catalogSeries.findMany({
        where: { key: { in: q.seri } },
        select: { name: true },
      });
      out.push(s.map((x) => x.name).join(', '));
    }
    if (q.makyaj?.length)
      out.push(q.makyaj.map((m) => (m === 'makyajsiz' ? 'Makyajsız' : 'Makyajlı')).join(', '));
    if (q.paket?.length) out.push(q.paket.join(', '));
    if (q.yilMin || q.yilMax) {
      out.push(
        q.yilMin && q.yilMax
          ? `${q.yilMin} – ${q.yilMax}`
          : q.yilMin
            ? `${q.yilMin} ve sonrası`
            : `${q.yilMax} ve öncesi`,
      );
    }
    if (q.butceMin || q.butceMax) {
      out.push(
        q.butceMin && q.butceMax
          ? `${tl(q.butceMin)} – ${tl(q.butceMax)}`
          : q.butceMax
            ? `En çok ${tl(q.butceMax)}`
            : `En az ${tl(q.butceMin as number)}`,
      );
    }
    out.push(q.il ? [q.il, q.ilce].filter(Boolean).join(', ') : 'Tüm Türkiye');
    if (q.telefon) out.push('Telefonla ulaşılabilir');
    if (q.q) out.push(`“${q.q}”`);
    return out.filter(Boolean);
  }
}
