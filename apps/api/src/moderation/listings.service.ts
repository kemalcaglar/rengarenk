import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { type Prisma, uuidv7 } from '@rengarenk/db';
import {
  DEMAND_ACTIONS,
  type DemandAction,
  hideDemandText,
  type ListingActionInput,
  type ListingRow,
  shortName,
  VEHICLE_ACTIONS,
  type VehicleAction,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { vehicleNames } from '../portfolio/vehicle-names.js';
import { ModerationService, type ModeratorCtx } from './moderation.service.js';

const LIMIT = 100;
const tl = (n: bigint) => `₺${new Intl.NumberFormat('tr-TR').format(Number(n))}`;

/**
 * Konsol › Pazar › Talepler ve portföy (YonetimPazar.dc.html › talep; Karar 53). Talepler ve portföy araçları tek
 * listede; seçilenlere toplu işlem. Gizleme çalışan kaynaklı moderasyon kararıdır (bildirim gerekçeyle gider, itiraz yolu
 * açık, kullanıcı kartındaki geçmişte görünür). Düzeltme ve kategori önerisi talep sahibine, belge isteği ve not galeri
 * ekibine bildirilir. Her işlem işlem kaydına yazılır.
 */
@Injectable()
export class ListingsService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly moderation: ModerationService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async talepler(q?: string): Promise<ListingRow[]> {
    const no = q && /^\d+$/.test(q.trim()) ? BigInt(q.trim()) : null;
    const where: Prisma.DemandWhereInput = q?.trim()
      ? no !== null
        ? { no }
        : {
            OR: [
              { headline: { contains: q.trim(), mode: 'insensitive' } },
              { title: { contains: q.trim(), mode: 'insensitive' } },
            ],
          }
      : {};
    const list = await this.db.demand.findMany({
      where: { ...where, status: { not: 'DRAFT' } },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: {
        id: true,
        no: true,
        title: true,
        headline: true,
        il: true,
        status: true,
        passiveReason: true,
        correctionAt: true,
        suggestedCategoryId: true,
        category: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } },
        _count: { select: { conversations: true } },
      },
    });
    const oneriIds = [
      ...new Set(list.map((d) => d.suggestedCategoryId).filter((x): x is string => Boolean(x))),
    ];
    const oneriler = oneriIds.length
      ? await this.db.category.findMany({ where: { id: { in: oneriIds } }, select: { id: true, name: true } })
      : [];
    const oneriAd = (id: string | null) => oneriler.find((c) => c.id === id)?.name ?? null;
    return list.map((d) => {
      const yayinda = d.status === 'PUBLISHED';
      const durum: Pick<ListingRow, 'durum' | 'ton'> =
        d.status === 'PASSIVE' && d.passiveReason === 'moderasyon'
          ? { durum: 'Gizlendi', ton: 'kirmizi' }
          : yayinda && d.suggestedCategoryId
            ? { durum: 'Kategori öneriliyor', ton: 'mavi' }
            : yayinda && d.correctionAt
              ? { durum: 'Düzeltme istendi', ton: 'sari' }
              : yayinda
                ? { durum: 'Yayında', ton: 'yesil' }
                : d.status === 'PASSIVE' && d.passiveReason === 'sure_doldu'
                  ? { durum: 'Süresi doldu', ton: 'gri' }
                  : d.status === 'PASSIVE'
                    ? { durum: 'Pasif', ton: 'gri' }
                    : { durum: 'Kapandı', ton: 'gri' };
      const n = d._count.conversations;
      const oneri = oneriAd(d.suggestedCategoryId);
      return {
        id: d.id,
        ad: hideDemandText(d.headline) || d.title || d.category.name,
        alt: `No ${d.no} · ${shortName(d.user.firstName, d.user.lastName)} · ${d.il ?? 'Tüm Türkiye'}`,
        b: oneri ? `${d.category.name} → ${oneri}` : d.category.name,
        c: n ? `${n} ilk mesaj` : '0',
        ...durum,
        url: `/talep/${d.no}`,
      };
    });
  }

  async araclar(q?: string): Promise<ListingRow[]> {
    const no = q && /^\d+$/.test(q.trim()) ? BigInt(q.trim()) : null;
    const where: Prisma.PortfolioVehicleWhereInput = q?.trim()
      ? no !== null
        ? { no }
        : { account: { gallery: { displayName: { contains: q.trim(), mode: 'insensitive' } } } }
      : {};
    const list = await this.db.portfolioVehicle.findMany({
      where: { ...where, status: { not: 'DRAFT' } },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      include: {
        account: { select: { status: true, gallery: { select: { displayName: true, il: true } } } },
        eidsChecks: { orderBy: { requestedAt: 'desc' }, take: 1, select: { status: true } },
      },
    });
    const ad = await vehicleNames(this.db, list);
    const kopya = new Set(
      (
        await this.db.report.findMany({
          where: {
            targetType: 'arac',
            targetId: { in: list.map((v) => v.id) },
            reason: 'kopya_foto',
            status: 'acik',
          },
          select: { targetId: true },
        })
      ).map((r) => r.targetId),
    );
    return list.map((v) => {
      const askida = v.account.status === 'SUSPENDED';
      const eids = v.eidsChecks[0]?.status;
      const dogrulama = kopya.has(v.id)
        ? 'Görsel eşleşme (kopya şüphesi)'
        : askida
          ? 'Galeri askıda'
          : eids === 'APPROVED'
            ? 'EİDS doğrulandı'
            : eids === 'PENDING'
              ? 'EİDS bekliyor'
              : eids === 'REJECTED'
                ? 'EİDS reddedildi'
                : 'Doğrulanmadı';
      const durum: Pick<ListingRow, 'durum' | 'ton'> = v.moderatedAt
        ? { durum: 'Gizlendi', ton: 'kirmizi' }
        : askida
          ? { durum: 'Askıda', ton: 'sari' }
          : v.status === 'PUBLISHED'
            ? { durum: 'Yayında', ton: 'yesil' }
            : v.status === 'PENDING_EIDS'
              ? { durum: 'EİDS bekliyor', ton: 'sari' }
              : v.status === 'REJECTED'
                ? { durum: 'Reddedildi', ton: 'kirmizi' }
                : v.status === 'SOLD'
                  ? { durum: 'Satıldı', ton: 'gri' }
                  : { durum: 'Pasif', ton: 'gri' };
      return {
        id: v.id,
        ad: ad(v).ad,
        alt: `${v.account.gallery?.displayName ?? 'Bireysel satıcı'} · ${v.account.gallery?.il ?? ''}`.replace(
          / · $/,
          '',
        ),
        b: dogrulama,
        c: tl(v.priceTl),
        ...durum,
        url: `/arac/${v.no}`,
      };
    });
  }

  /** Taleplere toplu işlem: düzeltme iste, gizle (moderasyon kararı), kategori öner */
  async talepIslem(ctx: ModeratorCtx, b: ListingActionInput, ip?: string) {
    if (!(b.islem in DEMAND_ACTIONS)) throw new BadRequestException('Bilinmeyen işlem');
    const islem = b.islem as DemandAction;
    const list = await this.db.demand.findMany({
      where: { id: { in: b.ids } },
      select: {
        id: true,
        no: true,
        userId: true,
        accountId: true,
        status: true,
        passiveReason: true,
        categoryId: true,
      },
    });
    const hedef = islem === 'kategori' ? await this.kategori(b.kategori) : null;
    let yapilan = 0;
    const atlanan: string[] = [];
    for (const d of list) {
      const gizli = d.status === 'PASSIVE' && d.passiveReason === 'moderasyon';
      if (islem === 'gizle') {
        if (gizli || d.status === 'CLOSED' || d.status === 'COMPLETED') {
          atlanan.push(`No ${d.no}`);
          continue;
        }
        await this.moderasyonla(
          ctx,
          { targetType: 'talep', targetId: d.id, userId: d.userId, accountId: d.accountId },
          b.gerekce,
          ip,
        );
        yapilan++;
        continue;
      }
      if (d.status !== 'PUBLISHED' || (islem === 'kategori' && d.categoryId === hedef?.id)) {
        atlanan.push(`No ${d.no}`);
        continue;
      }
      await this.db.$transaction(async (tx) => {
        if (islem === 'duzeltme') {
          await tx.demand.update({
            where: { id: d.id },
            data: { correctionAt: new Date(), correctionNote: b.gerekce },
          });
          await this.outbox.add(tx, 'talep.calisan_duzeltme', { demandId: d.id });
        } else {
          await tx.demand.update({ where: { id: d.id }, data: { suggestedCategoryId: hedef?.id } });
          await this.outbox.add(tx, 'talep.kategori_onerisi', { demandId: d.id, gerekce: b.gerekce });
        }
        await this.audit.record(
          {
            actorType: 'STAFF',
            actorId: ctx.staff.id,
            action: islem === 'duzeltme' ? 'talep_duzeltme_istendi' : 'talep_kategori_onerildi',
            entityType: 'demand',
            entityId: d.id,
            after: { gerekce: b.gerekce, ...(hedef ? { kategori: hedef.slug } : {}) },
            ip,
          },
          tx,
        );
      });
      yapilan++;
    }
    return { yapilan, atlanan };
  }

  /** Portföy araçlarına toplu işlem: gizle (moderasyon kararı), belge iste, galeriye bildir */
  async aracIslem(ctx: ModeratorCtx, b: ListingActionInput, ip?: string) {
    if (!(b.islem in VEHICLE_ACTIONS)) throw new BadRequestException('Bilinmeyen işlem');
    const islem = b.islem as VehicleAction;
    const list = await this.db.portfolioVehicle.findMany({
      where: { id: { in: b.ids } },
      select: { id: true, no: true, accountId: true, moderatedAt: true },
    });
    let yapilan = 0;
    const atlanan: string[] = [];
    for (const v of list) {
      if (islem === 'gizle') {
        if (v.moderatedAt) {
          atlanan.push(`Araç ${v.no}`);
          continue;
        }
        const sahip = await this.db.accountMember.findFirst({
          where: { accountId: v.accountId, role: 'OWNER' },
          select: { userId: true },
        });
        if (!sahip) {
          atlanan.push(`Araç ${v.no}`);
          continue;
        }
        await this.moderasyonla(
          ctx,
          { targetType: 'arac', targetId: v.id, userId: sahip.userId, accountId: v.accountId },
          b.gerekce,
          ip,
        );
        yapilan++;
        continue;
      }
      await this.db.$transaction(async (tx) => {
        await this.outbox.add(tx, islem === 'belge' ? 'portfoy.belge_istendi' : 'portfoy.calisan_notu', {
          vehicleId: v.id,
          not: b.gerekce,
        });
        await this.audit.record(
          {
            actorType: 'STAFF',
            actorId: ctx.staff.id,
            action: islem === 'belge' ? 'portfoy_belge_istendi' : 'portfoy_galeriye_bildirildi',
            entityType: 'portfolio_vehicle',
            entityId: v.id,
            after: { not: b.gerekce },
            ip,
          },
          tx,
        );
      });
      yapilan++;
    }
    return { yapilan, atlanan };
  }

  private async kategori(slug?: string) {
    if (!slug) throw new BadRequestException('Önerilecek kategoriyi seç');
    const c = await this.db.category.findUnique({
      where: { slug },
      select: { id: true, slug: true, enabled: true },
    });
    if (!c?.enabled) throw new BadRequestException('Kategori bulunamadı');
    return c;
  }

  /** Çalışan kaynaklı moderasyon kaydı açılır ve "gizle" kararıyla kapanır (bildirim, itiraz ve geçmiş aynı) */
  private async moderasyonla(
    ctx: ModeratorCtx,
    h: { targetType: 'talep' | 'arac'; targetId: string; userId: string; accountId: string | null },
    gerekce: string,
    ip?: string,
  ) {
    const id = uuidv7();
    await this.db.report.create({
      data: {
        id,
        source: 'calisan',
        targetType: h.targetType,
        targetId: h.targetId,
        targetUserId: h.userId,
        targetAccountId: h.accountId,
        reason: 'diger',
        priority: 'normal',
        note: gerekce,
        dueAt: new Date(),
      },
    });
    await this.moderation.decide(ctx, id, { karar: 'gizle', not: gerekce }, ip);
  }
}
