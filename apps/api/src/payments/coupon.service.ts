import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Approval, Order, Prisma } from '@rengarenk/db';
import { uuidv7 } from '@rengarenk/db';
import {
  COUPON_AUDIENCES,
  COUPON_MAX_PERCENT,
  COUPON_STATUSES,
  COUPON_TARGETS,
  type CouponAudience,
  type CouponInput,
  type CouponTarget,
  couponDiscount,
  couponNeedsOwner,
  couponStatus,
  couponTargetOf,
  type PermissionGrants,
  tlYaz,
} from '@rengarenk/shared';
import { ApprovalService } from '../approvals/approval.service.js';
import { ApprovalExecutor } from '../approvals/approval-executor.js';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import type { Kalem } from './order-item.js';

const SUBJECT = 'coupon';

interface StaffActor {
  staff: { id: string; role: string; status: string };
  grants: PermissionGrants;
}

const tarih = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' }).format(d);

/**
 * Kuponlar (Karar 40, 51, 56). Hazırlanan kupon dört göz onayı (COUPON) ister; en yüksek indirimin üstü yalnızca
 * sahibe gider. Ödemede kod doğrulanır: geçerli tarih, kitle (bireysel ya da galeri hesabı), ürün grubu, hesap başına
 * bir kez ve toplam sınır. İndirim sipariş kalemine yazılır; kullanım ödeme alınınca aynı işlemde kaydedilir.
 */
@Injectable()
export class CouponService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly approvals: ApprovalService,
    private readonly audit: AuditService,
    executor: ApprovalExecutor,
  ) {
    executor.register('COUPON', (a, tx) => this.approved(a, tx));
  }

  // ── Ödeme ──────────────────────────────────────────────────

  /**
   * Kodu doğrular. `kitle`: alımı yapan hesap (bireysel ya da galeri). Uygun değilse kullanıcının anlayacağı bir
   * nedenle reddeder.
   */
  async resolve(
    kod: string,
    hesap: { id: string; kitle: 'bireysel' | 'galeri' },
    urunler: string[],
    now = new Date(),
  ) {
    const c = await this.db.coupon.findUnique({ where: { code: kod } });
    if (!c) throw new BadRequestException('Kupon kodu bulunamadı');
    const [onay, kullanim, kullandi] = await Promise.all([
      c.approvalId
        ? this.db.approval.findUnique({ where: { id: c.approvalId }, select: { status: true } })
        : null,
      this.db.couponRedemption.count({ where: { couponId: c.id } }),
      this.db.couponRedemption.count({ where: { couponId: c.id, accountId: hesap.id } }),
    ]);
    const durum = couponStatus(c, onay?.status ?? null, kullanim, now);
    if (durum === 'zamanlandi')
      throw new BadRequestException(`Kupon ${tarih(c.startsAt)} tarihinde başlıyor`);
    if (durum === 'tukendi') throw new BadRequestException('Kuponun kullanım sınırı doldu');
    if (durum !== 'aktif') throw new BadRequestException('Kupon geçerli değil');
    if (kullandi) throw new BadRequestException('Bu kuponu daha önce kullandın');
    if (c.audience !== 'herkes' && c.audience !== hesap.kitle)
      throw new BadRequestException(
        c.audience === 'galeri' ? 'Kupon yalnızca galeriler için' : 'Kupon yalnızca bireysel üyeler için',
      );
    const uyan = urunler.filter((u) => {
      const t = couponTargetOf(u);
      return t && c.targets.includes(t);
    });
    if (!uyan.length)
      throw new BadRequestException(
        `Kupon bu ürünlerde geçmiyor (${c.targets.map((t) => COUPON_TARGETS[t as CouponTarget]?.ad ?? t).join(', ')})`,
      );
    return c;
  }

  /** Kalemlere indirim: uygun kalemlerin tutarı düşer; toplam indirim döner */
  apply(kalemler: Kalem[], c: { code: string; percent: number; targets: string[] }) {
    let toplam = 0;
    for (const k of kalemler) {
      const t = couponTargetOf(k.urun);
      if (!t || !c.targets.includes(t)) continue;
      const indirim = couponDiscount(k.tutarKurus, c.percent);
      if (indirim <= 0) continue;
      k.tutarKurus -= indirim;
      k.birimKurus = Math.round(k.tutarKurus / k.adet);
      k.indirimKurus = indirim;
      k.kupon = c.code;
      toplam += indirim;
    }
    return toplam;
  }

  /** Ödeme formundaki "Uygula": hangi kaleme ne kadar indirim (fiyatlar istemciden değil, sunucudan) */
  async check(hesap: { id: string; kitle: 'bireysel' | 'galeri' }, kod: string, kalemler: Kalem[]) {
    const c = await this.resolve(
      kod,
      hesap,
      kalemler.map((k) => k.urun),
    );
    const once = kalemler.reduce((t, k) => t + k.tutarKurus, 0);
    const indirim = this.apply(kalemler, c);
    return {
      kod: c.code,
      ad: c.name,
      yuzde: c.percent,
      indirimKurus: indirim,
      toplamKurus: once - indirim,
      kalemler: kalemler.map((k) => ({
        urun: k.urun,
        tutarKurus: k.tutarKurus,
        indirimKurus: k.indirimKurus ?? 0,
      })),
    };
  }

  /** Ödeme alınınca (aynı işlemde): kullanım kaydı; aynı hesap başka siparişle kullandıysa yazılmaz */
  async redeem(tx: Tx, o: Order) {
    if (!o.couponId || o.discountKurus <= 0n) return;
    await tx.$executeRaw`
      INSERT INTO coupon_redemptions (id, coupon_id, account_id, order_id, discount_kurus)
      VALUES (${uuidv7()}::uuid, ${o.couponId}::uuid, ${o.accountId}::uuid, ${o.id}::uuid, ${o.discountKurus})
      ON CONFLICT DO NOTHING`;
  }

  // ── Konsol ─────────────────────────────────────────────────

  async list(now = new Date()) {
    const rows = await this.db.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { _count: { select: { redemptions: true } } },
    });
    const onaylar = new Map(
      (
        await this.db.approval.findMany({
          where: { id: { in: rows.map((r) => r.approvalId).filter((x): x is string => Boolean(x)) } },
          select: { id: true, status: true },
        })
      ).map((a) => [a.id, a.status]),
    );
    const toplamlar = new Map(
      (
        await this.db.couponRedemption.groupBy({
          by: ['couponId'],
          where: { couponId: { in: rows.map((r) => r.id) } },
          _sum: { discountKurus: true },
        })
      ).map((g) => [g.couponId, Number(g._sum.discountKurus ?? 0n)]),
    );
    return rows.map((c) => {
      const durum = couponStatus(
        c,
        c.approvalId ? (onaylar.get(c.approvalId) ?? null) : null,
        c._count.redemptions,
        now,
      );
      return {
        id: c.id,
        kod: c.code,
        ad: c.name,
        yuzde: c.percent,
        ozet: `%${c.percent} · ${c.targets.map((t) => COUPON_TARGETS[t as CouponTarget]?.ad ?? t).join(', ')} · ${
          COUPON_AUDIENCES[c.audience as CouponAudience] ?? c.audience
        }`,
        tarih: `${tarih(c.startsAt)} – ${tarih(new Date(c.endsAt.getTime() - 1))}`,
        kullanim: `${c._count.redemptions}${c.maxUses ? ` / ${c.maxUses}` : ''} kullanım · ${tlYaz(toplamlar.get(c.id) ?? 0)} indirim`,
        durumKey: durum,
        durum: COUPON_STATUSES[durum].ad,
        bg: COUPON_STATUSES[durum].bg,
        fg: COUPON_STATUSES[durum].fg,
        secilebilir: durum === 'aktif' || durum === 'zamanlandi' || durum === 'onay_bekliyor',
      };
    });
  }

  async create(actor: StaffActor, b: CouponInput, ip?: string) {
    if (await this.db.coupon.findUnique({ where: { code: b.kod } }))
      throw new ConflictException('Bu kupon kodu kullanılıyor');
    const id = uuidv7();
    const sahip = couponNeedsOwner(b.yuzde);
    await this.db.$transaction(async (tx) => {
      await tx.coupon.create({
        data: {
          id,
          code: b.kod,
          name: b.ad,
          percent: b.yuzde,
          targets: b.hedefler,
          audience: b.kitle,
          startsAt: new Date(b.baslangic),
          endsAt: new Date(b.bitis),
          maxUses: b.toplamSinir,
          createdBy: actor.staff.id,
        },
      });
      const a = await this.approvals.request(
        actor,
        {
          kind: 'COUPON',
          subjectType: SUBJECT,
          subjectId: id,
          title: `Kupon ${b.kod}: %${b.yuzde} · ${b.ad}`,
          reason: `${b.hedefler.map((t) => COUPON_TARGETS[t].ad).join(', ')} · ${COUPON_AUDIENCES[b.kitle]} · ${tarih(new Date(b.baslangic))} – ${tarih(new Date(new Date(b.bitis).getTime() - 1))}${
            b.toplamSinir ? ` · en çok ${b.toplamSinir} kullanım` : ''
          }${sahip ? ` · %${COUPON_MAX_PERCENT} üstü: yalnızca sahip onaylar` : ''}`,
          payload: { kupon: id, kod: b.kod, yuzde: b.yuzde, ...(sahip ? { yalnizSahip: true } : {}) },
        },
        tx,
        ip,
      );
      await tx.coupon.update({ where: { id }, data: { approvalId: a.id } });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'kupon_hazirlandi',
          entityType: SUBJECT,
          entityId: id,
          after: { kod: b.kod, yuzde: b.yuzde, hedefler: b.hedefler },
          ip,
        },
        tx,
      );
    });
    return this.list();
  }

  async approved(a: Approval, tx: Tx): Promise<Prisma.InputJsonValue> {
    if (a.subjectType !== SUBJECT) throw new Error('Kupon onayı değil');
    const k = await tx.coupon.updateMany({
      where: { id: a.subjectId, approvalId: a.id, status: 'onay_bekliyor' },
      data: { status: 'onaylandi' },
    });
    return { durum: k.count ? 'onaylandi' : 'zaten' };
  }

  async cancel(actor: StaffActor, id: string, ip?: string) {
    const c = await this.db.coupon.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Kupon bulunamadı');
    if (c.status === 'iptal') throw new ConflictException('Kupon zaten iptal');
    await this.db.$transaction(async (tx) => {
      await tx.coupon.update({ where: { id }, data: { status: 'iptal' } });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'kupon_iptal',
          entityType: SUBJECT,
          entityId: id,
          ip,
        },
        tx,
      );
    });
    if (c.status === 'onay_bekliyor' && c.approvalId)
      await this.approvals.cancel(actor, c.approvalId, ip).catch(() => undefined);
    return this.list();
  }

  /** Kampanya gönderimi için: kupon onaylandı ve süresi bitmedi mi */
  async usable(id: string, now = new Date()) {
    const c = await this.db.coupon.findUnique({ where: { id } });
    return Boolean(c && c.status === 'onaylandi' && c.endsAt > now);
  }
}
