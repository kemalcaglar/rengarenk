import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, uuidv7 } from '@rengarenk/db';
import { ruleText, type SegmentRule } from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA } from '../database/prisma.js';

const DAY = 86_400_000;
/** Ticari ileti haftalık sınırı (bildirim katmanıyla aynı, Karar 49) */
const TICARI_HAFTALIK = 2;

export interface Reach {
  toplam: number;
  onayli: number;
  uygulama: number;
  push: number;
  eposta: number;
  sinirda: number;
}

/**
 * Segmentler (Karar 51; YonetimKampanya.dc.html › segment): kurallar "ve" ile birleşir; her kural eklendikçe kişi sayısı
 * görünür. Kanal ulaşımı ticari ileti onayı, kişinin kampanya bildirimi tercihi, push cihazı ve doğrulanmış e-postayla
 * hesaplanır. Yalnızca etkin hesaplar sayılır. Kişisel veri dönmez, yalnızca sayılar.
 */
@Injectable()
export class SegmentService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  private async kategoriler(slugs: string[]) {
    const ana = await this.db.category.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
    const alt = await this.db.category.findMany({
      where: { parentId: { in: ana.map((a) => a.id) } },
      select: { id: true },
    });
    return [...ana, ...alt].map((c) => c.id);
  }

  /** Kuralın Prisma koşulu */
  private async kosul(r: SegmentRule, now: Date): Promise<Prisma.UserWhereInput> {
    const galeri = { account: { gallery: { isNot: null } } };
    switch (r.alan) {
      case 'rol':
        return r.deger === 'bireysel'
          ? { memberships: { none: galeri } }
          : r.deger === 'galeri'
            ? { memberships: { some: galeri } }
            : { memberships: { some: { account: { businessKind: 'RENTAL', gallery: { isNot: null } } } } };
      case 'aktif_talep':
        return r.deger === 'evet'
          ? { demands: { some: { status: 'PUBLISHED' } } }
          : { demands: { none: { status: 'PUBLISHED' } } };
      case 'son_giris': {
        const t = new Date(now.getTime() - r.gun * DAY);
        return r.yon === 'icinde'
          ? { devices: { some: { lastSeenAt: { gte: t } } } }
          : { devices: { none: { lastSeenAt: { gte: t } } } };
      }
      case 'il':
        return { OR: [{ il: { in: r.deger } }, { demands: { some: { il: { in: r.deger } } } }] };
      case 'kategori':
        return { demands: { some: { categoryId: { in: await this.kategoriler(r.deger) } } } };
      case 'odeme':
        return r.deger === 'var'
          ? { orders: { some: { status: 'PAID' } } }
          : { orders: { none: { status: 'PAID' } } };
      case 'platform':
        return { devices: { some: { platform: { in: r.deger } } } };
      case 'acik_sohbet':
        return r.deger === 'evet'
          ? { buyerConversations: { some: { status: 'OPEN' } } }
          : { buyerConversations: { none: { status: 'OPEN' } } };
      default:
        return { memberships: { some: { account: { gallery: { plan: { in: r.deger } } } } } };
    }
  }

  async where(kurallar: SegmentRule[], now = new Date()): Promise<Prisma.UserWhereInput> {
    const ve: Prisma.UserWhereInput[] = [{ status: 'ACTIVE' }];
    for (const r of kurallar) ve.push(await this.kosul(r, now));
    return { AND: ve };
  }

  /** Segmentteki kişilerin kimlikleri (gönderim ve ulaşım hesabı) */
  async userIds(kurallar: SegmentRule[], now = new Date()) {
    const r = await this.db.user.findMany({ where: await this.where(kurallar, now), select: { id: true } });
    return r.map((u) => u.id);
  }

  /** Kanal ulaşımı: ticari onay, kampanya tercihi, push cihazı, doğrulanmış e-posta; haftalık sınıra takılanlar */
  async reach(ids: string[]): Promise<Reach> {
    if (!ids.length) return { toplam: 0, onayli: 0, uygulama: 0, push: 0, eposta: 0, sinirda: 0 };
    const [r] = await this.db.$queryRaw<
      { onayli: bigint; uygulama: bigint; push: bigint; eposta: bigint; sinirda: bigint }[]
    >`
      WITH s AS (SELECT unnest(${ids}::uuid[]) AS id),
      onay AS (
        SELECT DISTINCT ON (user_id) user_id, granted FROM consents
        WHERE kind = 'ticari_ileti' AND user_id = ANY(${ids}::uuid[])
        ORDER BY user_id, created_at DESC
      ),
      k AS (
        SELECT s.id,
          coalesce(o.granted, false) AS onay,
          EXISTS (SELECT 1 FROM notification_prefs p WHERE p.user_id = s.id AND p.konu = 'kampanya'
                  AND p.kanal = 'uygulama' AND p.acik) AS uyg,
          EXISTS (SELECT 1 FROM notification_prefs p WHERE p.user_id = s.id AND p.konu = 'kampanya'
                  AND p.kanal = 'eposta' AND p.acik) AS ep,
          EXISTS (SELECT 1 FROM push_tokens t WHERE t.user_id = s.id AND t.disabled_at IS NULL) AS cihaz,
          (u.email IS NOT NULL AND u.email_verified_at IS NOT NULL) AS dogrulandi,
          (SELECT count(*) FROM notifications n WHERE n.user_id = s.id AND n.ticari
             AND n.created_at >= now() - interval '7 days') AS hafta
        FROM s JOIN users u ON u.id = s.id
        LEFT JOIN onay o ON o.user_id = s.id
      )
      SELECT
        count(*) FILTER (WHERE onay) AS onayli,
        count(*) FILTER (WHERE onay AND uyg) AS uygulama,
        count(*) FILTER (WHERE onay AND uyg AND cihaz) AS push,
        count(*) FILTER (WHERE onay AND ep AND dogrulandi) AS eposta,
        count(*) FILTER (WHERE onay AND (uyg OR (ep AND dogrulandi)) AND hafta >= ${TICARI_HAFTALIK}) AS sinirda
      FROM k`;
    return {
      toplam: ids.length,
      onayli: Number(r?.onayli ?? 0),
      uygulama: Number(r?.uygulama ?? 0),
      push: Number(r?.push ?? 0),
      eposta: Number(r?.eposta ?? 0),
      sinirda: Number(r?.sinirda ?? 0),
    };
  }

  private async kategoriAdi() {
    const k = await this.db.category.findMany({ select: { slug: true, name: true } });
    const m = new Map(k.map((x) => [x.slug, x.name]));
    return (s: string) => m.get(s) ?? s;
  }

  /** Canlı hesap: kurallar sırayla eklendikçe kişi sayısı ve son kümenin kanal ulaşımı */
  async preview(kurallar: SegmentRule[], now = new Date()) {
    const ad = await this.kategoriAdi();
    const adimlar = [];
    for (let i = 0; i < kurallar.length; i++) {
      const n = await this.db.user.count({ where: await this.where(kurallar.slice(0, i + 1), now) });
      const [alan, op, deger] = ruleText(kurallar[i] as SegmentRule, ad);
      adimlar.push({ alan, op, deger, sayi: n });
    }
    const ulasim = await this.reach(await this.userIds(kurallar, now));
    return { adimlar, ulasim };
  }

  async list() {
    const rows = await this.db.segment.findMany({ orderBy: { updatedAt: 'desc' }, take: 50 });
    const kisi = new Map(
      (
        await this.db.staffMember.findMany({
          where: { id: { in: [...new Set(rows.map((r) => r.createdBy))] } },
          select: { id: true, name: true },
        })
      ).map((s) => [s.id, s.name]),
    );
    const ad = await this.kategoriAdi();
    return rows.map((r) => ({
      id: r.id,
      ad: r.name,
      kurallar: r.rules as unknown as SegmentRule[],
      ozet: (r.rules as unknown as SegmentRule[])
        .map((x) => ruleText(x, ad).slice(0, 3).join(' '))
        .join(' · '),
      sayi: r.lastCount,
      sayildi: r.countedAt,
      kim: kisi.get(r.createdBy) ?? 'Çalışan',
    }));
  }

  async save(staffId: string, b: { ad: string; kurallar: SegmentRule[] }, id?: string) {
    const sayi = await this.db.user.count({ where: await this.where(b.kurallar) });
    if (id) {
      const r = await this.db.segment.updateMany({
        where: { id },
        data: {
          name: b.ad,
          rules: b.kurallar as unknown as Prisma.InputJsonValue,
          lastCount: sayi,
          countedAt: new Date(),
        },
      });
      if (!r.count) throw new NotFoundException('Segment bulunamadı');
    } else {
      await this.db.segment.create({
        data: {
          id: uuidv7(),
          name: b.ad,
          rules: b.kurallar as unknown as Prisma.InputJsonValue,
          lastCount: sayi,
          countedAt: new Date(),
          createdBy: staffId,
        },
      });
    }
    await this.audit.record({
      actorType: 'STAFF',
      actorId: staffId,
      action: id ? 'segment_guncellendi' : 'segment_olusturuldu',
      entityType: 'segment',
      entityId: id ?? b.ad,
    });
    return this.list();
  }
}
