import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CARE_LEVELS,
  CARE_SIGNALS,
  type CareFigures,
  type CareFilter,
  churnRisk,
  galleryAccess,
  renewalOf,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA } from '../database/prisma.js';

const DAY = 86_400_000;

interface Ctx {
  staff: { id: string };
}

/**
 * Galeri müşteri yönetimi (Karar 43): sorumlu çalışan, yenileme takibi ve ayrılma riski. Notlar kullanıcı kartındaki
 * çalışan notlarıdır. Risk kurallarla hesaplanır (`churnRisk`); gerekçeler konsolda görünür. Sorumlu ataması işlem
 * kaydına girer.
 */
@Injectable()
export class GalleryCareService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  /** Galerilerin göstergeleri (toplu) */
  private async figures(accountIds: string[], now = new Date()) {
    if (!accountIds.length) return new Map<string, CareFigures>();
    const otuz = new Date(now.getTime() - 30 * DAY);
    const altmis = new Date(now.getTime() - 60 * DAY);
    const [galeriler, abonelikler, son30, once30, portfoy, uyeler] = await Promise.all([
      this.db.gallery.findMany({
        where: { accountId: { in: accountIds } },
        select: { accountId: true, plan: true, trialEndsAt: true },
      }),
      this.db.subscription.findMany({
        where: { accountId: { in: accountIds } },
        select: { accountId: true, status: true, cancelAtPeriodEnd: true, currentPeriodEnd: true },
      }),
      this.db.conversation.groupBy({
        by: ['sellerAccountId'],
        where: { sellerAccountId: { in: accountIds }, origin: 'talep', createdAt: { gte: otuz } },
        _count: true,
      }),
      this.db.conversation.groupBy({
        by: ['sellerAccountId'],
        where: { sellerAccountId: { in: accountIds }, origin: 'talep', createdAt: { gte: altmis, lt: otuz } },
        _count: true,
      }),
      this.db.portfolioVehicle.groupBy({
        by: ['accountId'],
        where: { accountId: { in: accountIds }, status: 'PUBLISHED' },
        _count: true,
      }),
      this.db.accountMember.findMany({
        where: { accountId: { in: accountIds } },
        select: {
          accountId: true,
          user: {
            select: { devices: { orderBy: { lastSeenAt: 'desc' }, take: 1, select: { lastSeenAt: true } } },
          },
        },
      }),
    ]);
    const say = (rows: { sellerAccountId: string; _count: number }[]) =>
      new Map(rows.map((r) => [r.sellerAccountId, r._count]));
    const m30 = say(son30);
    const mOnce = say(once30);
    const pf = new Map(portfoy.map((r) => [r.accountId, r._count]));
    const ab = new Map(abonelikler.map((a) => [a.accountId, a]));
    const giris = new Map<string, Date>();
    for (const u of uyeler) {
      const d = u.user.devices[0]?.lastSeenAt;
      const once = giris.get(u.accountId);
      if (d && (!once || d > once)) giris.set(u.accountId, d);
    }
    return new Map(
      galeriler.map((g) => {
        const a = ab.get(g.accountId);
        const f: CareFigures = {
          plan: galleryAccess(g, now).plan,
          trialEndsAt: g.trialEndsAt,
          abonelik: a
            ? { status: a.status, cancelAtPeriodEnd: a.cancelAtPeriodEnd, periodEnd: a.currentPeriodEnd }
            : null,
          ilkMesaj30: m30.get(g.accountId) ?? 0,
          ilkMesajOnceki30: mOnce.get(g.accountId) ?? 0,
          sonGiris: giris.get(g.accountId) ?? null,
          portfoy: pf.get(g.accountId) ?? 0,
        };
        return [g.accountId, f];
      }),
    );
  }

  private ozet(f: CareFigures, now = new Date()) {
    const r = churnRisk(f, now);
    const y = renewalOf(f);
    return {
      risk: {
        puan: r.puan,
        duzey: r.duzey,
        ...CARE_LEVELS[r.duzey],
        gerekceler: r.sinyaller.map((s) => CARE_SIGNALS[s].ad),
      },
      yenileme: y
        ? { tarih: y.tarih, ne: y.ne, kalanGun: Math.ceil((y.tarih.getTime() - now.getTime()) / DAY) }
        : null,
      ilkMesaj30: f.ilkMesaj30,
      sonGiris: f.sonGiris,
    };
  }

  private async calisanlar() {
    return this.db.staffMember.findMany({
      where: { status: 'ACTIVE', role: { not: 'AGENT' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  /** Konsol › Pazar › Galeri müşterileri: risk, yenileme, sorumlu; süzgeç ve arama */
  async list(ctx: Ctx, filtre: CareFilter, q = '') {
    const now = new Date();
    const t = q.trim();
    const galeriler = await this.db.gallery.findMany({
      where: {
        ...(t ? { displayName: { contains: t, mode: 'insensitive' } } : {}),
        ...(filtre === 'benim' ? { managerStaffId: ctx.staff.id } : {}),
        ...(filtre === 'sorumsuz' ? { managerStaffId: null } : {}),
      },
      select: { accountId: true, displayName: true, il: true, ilce: true, plan: true, managerStaffId: true },
      orderBy: { approvedAt: 'desc' },
      take: 300,
    });
    const [f, kisiler] = await Promise.all([
      this.figures(
        galeriler.map((g) => g.accountId),
        now,
      ),
      this.calisanlar(),
    ]);
    const ad = new Map(kisiler.map((k) => [k.id, k.name]));
    const satirlar = galeriler
      .map((g) => {
        const fig = f.get(g.accountId) as CareFigures;
        const o = this.ozet(fig, now);
        return {
          accountId: g.accountId,
          ad: g.displayName,
          yer: `${g.il}, ${g.ilce}`,
          paket: galleryAccess({ plan: g.plan, trialEndsAt: fig.trialEndsAt }, now).ad,
          sorumlu: g.managerStaffId
            ? { id: g.managerStaffId, ad: ad.get(g.managerStaffId) ?? 'Ayrılmış çalışan' }
            : null,
          ...o,
        };
      })
      .filter((s) =>
        filtre === 'riskli'
          ? s.risk.duzey === 'yuksek'
          : filtre === 'yenileme'
            ? s.yenileme !== null && s.yenileme.kalanGun >= 0 && s.yenileme.kalanGun <= 30
            : true,
      )
      .sort(
        (a, b) =>
          b.risk.puan - a.risk.puan ||
          (a.yenileme?.tarih.getTime() ?? Number.MAX_SAFE_INTEGER) -
            (b.yenileme?.tarih.getTime() ?? Number.MAX_SAFE_INTEGER),
      );
    const sayilar = {
      toplam: satirlar.length,
      yuksek: satirlar.filter((s) => s.risk.duzey === 'yuksek').length,
      yenileme30: satirlar.filter((s) => s.yenileme && s.yenileme.kalanGun >= 0 && s.yenileme.kalanGun <= 30)
        .length,
      sorumsuz: satirlar.filter((s) => !s.sorumlu).length,
    };
    return { sayilar, satirlar, calisanlar: kisiler };
  }

  /** Galeri kartındaki "Müşteri yönetimi" bölümü */
  async section(accountId: string) {
    const g = await this.db.gallery.findUnique({
      where: { accountId },
      select: { managerStaffId: true, managerSetAt: true },
    });
    if (!g) throw new NotFoundException('Galeri bulunamadı');
    const [f, kisiler] = await Promise.all([this.figures([accountId]), this.calisanlar()]);
    const ad = new Map(kisiler.map((k) => [k.id, k.name]));
    return {
      sorumlu: g.managerStaffId
        ? { id: g.managerStaffId, ad: ad.get(g.managerStaffId) ?? 'Ayrılmış çalışan', zaman: g.managerSetAt }
        : null,
      ...this.ozet(f.get(accountId) as CareFigures),
      calisanlar: kisiler,
    };
  }

  /** Sorumlu çalışanı atar ya da kaldırır (işlem kaydına girer) */
  async assign(ctx: Ctx, accountId: string, staffId: string | null, ip?: string) {
    if (staffId) {
      const s = await this.db.staffMember.findUnique({
        where: { id: staffId },
        select: { status: true, role: true },
      });
      if (s?.status !== 'ACTIVE' || s.role === 'AGENT')
        throw new BadRequestException('Çalışan bulunamadı ya da etkin değil');
    }
    await this.db.$transaction(async (tx) => {
      const once = await tx.gallery.findUnique({ where: { accountId }, select: { managerStaffId: true } });
      if (!once) throw new NotFoundException('Galeri bulunamadı');
      await tx.gallery.update({
        where: { accountId },
        data: { managerStaffId: staffId, managerSetAt: staffId ? new Date() : null },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: ctx.staff.id,
          action: 'galeri_sorumlusu',
          entityType: 'gallery',
          entityId: accountId,
          before: { sorumlu: once.managerStaffId },
          after: { sorumlu: staffId },
          ip,
        },
        tx,
      );
    });
    return this.section(accountId);
  }
}
