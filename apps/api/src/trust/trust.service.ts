import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, uuidv7 } from '@rengarenk/db';
import {
  BADGE_RULES,
  BADGES,
  type BadgeKey,
  badgeProgress,
  badgesOf,
  median,
  RATING_FLAGS,
  RATING_NEW_ACCOUNT_DAYS,
  RATING_WINDOW_DAYS,
  type RatingFlag,
  SCORE_NAMES,
  SCORE_WEIGHTS,
  type SellerFigures,
  sellerScore,
} from '@rengarenk/shared';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { SecretBox } from '../staff/secret-box.js';

const DAY = 86_400_000;

/**
 * Satıcı puanı, rozetler ve galeri takibi (Karar 28, 55). Alıcı yalnızca yıldız verir; yıldızı satıcıyla sohbeti açılmış
 * ve satıcının en az bir yanıt verdiği alıcı, sohbet başına bir kez, sohbetten sonraki 30 gün içinde verebilir.
 * Yeni açılmış, aynı cihaz ve ağdan birden çok hesaptan ya da satıcıyla bağlantılı hesaptan gelen yıldız işaretlenir
 * ve hesaba katılmaz (ajan gelene kadar kural; Karar 41). Göstergeler yeni yıldızda ve her gece yenilenir.
 * Şikâyet oranı moderasyon modülüyle (Aşama 8) gelir; o zamana kadar 0 sayılır.
 */
@Injectable()
export class TrustService {
  private readonly box: SecretBox;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) env: Env,
    private readonly outbox: OutboxService,
  ) {
    this.box = SecretBox.forMessages(env);
  }

  // ── Yıldız ───────────────────────────────────────────────────

  /** Sohbet yıldıza uygun mu: alıcı, açık sohbet, alıcının mesajından sonra satıcı yanıtı, pencere içinde */
  async eligibility(userId: string, conversationId: string) {
    const c = await this.db.conversation.findUnique({
      where: { id: conversationId },
      include: { rating: { select: { stars: true } } },
    });
    if (!c || c.buyerUserId !== userId) return { uygun: false, verilen: null as number | null };
    if (c.rating) return { uygun: false, verilen: c.rating.stars };
    if (c.status !== 'OPEN') return { uygun: false, verilen: null };
    if (c.lastMessageAt.getTime() + RATING_WINDOW_DAYS * DAY < Date.now())
      return { uygun: false, verilen: null };
    const ilkAlici = await this.db.message.findFirst({
      where: { conversationId, side: 'alici' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    if (!ilkAlici) return { uygun: false, verilen: null };
    const yanit = await this.db.message.count({
      where: { conversationId, side: 'satici', createdAt: { gt: ilkAlici.createdAt } },
    });
    return { uygun: yanit > 0, verilen: null };
  }

  async rate(userId: string, conversationId: string, stars: number, meta: { ip?: string; ua?: string }) {
    const e = await this.eligibility(userId, conversationId);
    if (e.verilen !== null) throw new ConflictException('Bu sohbet için zaten yıldız verdin');
    if (!e.uygun) {
      throw new UnprocessableEntityException(
        'Yıldızı, satıcının yanıt verdiği açık sohbetten sonraki 30 gün içinde verebilirsin',
      );
    }
    const c = await this.db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    const parmak = meta.ip ? this.box.digest(`puan:${meta.ip}|${meta.ua ?? ''}`) : null;
    const flag = await this.flagOf(userId, c.sellerAccountId, parmak);
    try {
      await this.db.$transaction(async (tx) => {
        await tx.rating.create({
          data: {
            id: uuidv7(),
            conversationId,
            buyerUserId: userId,
            sellerAccountId: c.sellerAccountId,
            stars,
            flag,
            counted: flag === null,
            fingerprint: parmak,
          },
        });
        // Aynı cihazdan önceki yıldızlar da hesaptan çıkar
        if (flag === 'ayni_cihaz' && parmak) {
          await tx.rating.updateMany({
            where: { sellerAccountId: c.sellerAccountId, fingerprint: parmak, buyerUserId: { not: userId } },
            data: { counted: false, flag: 'ayni_cihaz' },
          });
        }
        await this.outbox.add(tx, 'puan.verildi', {
          conversationId,
          sellerAccountId: c.sellerAccountId,
          sayildi: flag === null,
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Bu sohbet için zaten yıldız verdin');
      }
      throw err;
    }
    await this.recompute(c.sellerAccountId);
    return { verilen: stars };
  }

  private async flagOf(
    userId: string,
    sellerAccountId: string,
    parmak: string | null,
  ): Promise<RatingFlag | null> {
    const u = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } });
    if (u.createdAt.getTime() > Date.now() - RATING_NEW_ACCOUNT_DAYS * DAY) return 'yeni_hesap';
    const saticilar = (
      await this.db.accountMember.findMany({
        where: { accountId: sellerAccountId },
        select: { userId: true },
      })
    ).map((m) => m.userId);
    const bagli = await this.db.accountMember.findFirst({
      where: {
        userId,
        account: { kind: 'BUSINESS', members: { some: { userId: { in: saticilar } } } },
      },
    });
    if (bagli) return 'bagli_hesap';
    if (parmak) {
      const ayni = await this.db.rating.findFirst({
        where: { sellerAccountId, fingerprint: parmak, buyerUserId: { not: userId } },
      });
      if (ayni) return 'ayni_cihaz';
    }
    return null;
  }

  /** Mesajlarım'daki "… puan ver" kartı: yıldızı verilmemiş, uygun ilk sohbet */
  async pending(userId: string) {
    const cs = await this.db.conversation.findMany({
      where: {
        buyerUserId: userId,
        status: 'OPEN',
        rating: null,
        lastMessageAt: { gte: new Date(Date.now() - RATING_WINDOW_DAYS * DAY) },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 20,
      include: {
        demand: { select: { title: true, headline: true } },
        sellerAccount: { select: { gallery: { select: { displayName: true } } } },
      },
    });
    for (const c of cs) {
      if (!(await this.eligibility(userId, c.id)).uygun) continue;
      const kisi = await this.db.user.findUnique({
        where: { id: c.sellerUserId },
        select: { firstName: true, lastName: true },
      });
      return {
        sohbet: c.id,
        ad:
          c.sellerAccount.gallery?.displayName ??
          ([kisi?.firstName, kisi?.lastName ? `${kisi.lastName.charAt(0)}.` : null]
            .filter(Boolean)
            .join(' ') ||
            'Satıcı'),
        talep: c.demand ? (c.demand.headline ?? c.demand.title) : null,
        temsilci:
          c.sellerAccount.gallery && kisi ? [kisi.firstName, kisi.lastName].filter(Boolean).join(' ') : null,
      };
    }
    return null;
  }

  // ── Göstergeler ───────────────────────────────────────────────

  /** Satıcının göstergelerini hesaplar ve saklar */
  async recompute(accountId: string) {
    const [yildizlar, acc, yanitlar] = await Promise.all([
      this.db.rating.findMany({
        where: { sellerAccountId: accountId, counted: true },
        select: { stars: true },
      }),
      this.db.account.findUnique({
        where: { id: accountId },
        select: { status: true, gallery: { select: { accountId: true } } },
      }),
      this.db.$queryRaw<{ alici: Date; yanit: Date | null }[]>`
        WITH ilk AS (
          SELECT c.id, min(m.created_at) AS alici
          FROM conversations c JOIN messages m ON m.conversation_id = c.id AND m.side = 'alici'
          WHERE c.seller_account_id = ${accountId}::uuid
          GROUP BY c.id
        )
        SELECT i.alici,
          (SELECT min(m2.created_at) FROM messages m2
            WHERE m2.conversation_id = i.id AND m2.side = 'satici' AND m2.created_at > i.alici) AS yanit
        FROM ilk i
        WHERE i.alici >= now() - make_interval(days => ${BADGE_RULES.hizli.gun}::int)`,
    ]);
    if (!acc) return null;
    const dagilim = [0, 0, 0, 0, 0];
    for (const r of yildizlar) dagilim[r.stars - 1] = (dagilim[r.stars - 1] ?? 0) + 1;
    const toplam = yildizlar.reduce((t, r) => t + r.stars, 0);
    // Son bir saat içinde gelen ve henüz yanıtlanmamış mesaj ölçüme katılmaz
    const olculen = yanitlar.filter((y) => y.yanit || y.alici.getTime() < Date.now() - 3600_000);
    const dakikalar = olculen.map((y) =>
      y.yanit ? (y.yanit.getTime() - y.alici.getTime()) / 60_000 : Number.POSITIVE_INFINITY,
    );
    const ortanca = median(dakikalar);
    const yanitlanan = dakikalar.filter((d) => Number.isFinite(d));
    const f: SellerFigures = {
      yildizSayisi: yildizlar.length,
      yildizOrtalama: yildizlar.length ? toplam / yildizlar.length : null,
      yanitSohbet: olculen.length,
      ortancaDakika: ortanca === null ? null : Number.isFinite(ortanca) ? ortanca : 24 * 60 * 30,
      sikayetOrani: 0,
      onayliGaleri: !!acc.gallery && acc.status === 'ACTIVE',
    };
    const veri = {
      ratingCount: f.yildizSayisi,
      ratingAvg: f.yildizOrtalama,
      ratingDist: dagilim,
      responseConvs: f.yanitSohbet,
      responseMedian: f.ortancaDakika === null ? null : Math.round(f.ortancaDakika),
      responseAvg: yanitlanan.length
        ? Math.round(yanitlanan.reduce((t, d) => t + d, 0) / yanitlanan.length)
        : null,
      complaintRate: f.sikayetOrani,
      score: sellerScore(f),
      badges: badgesOf(f),
      computedAt: new Date(),
    };
    await this.db.sellerStats.upsert({ where: { accountId }, create: { accountId, ...veri }, update: veri });
    return { ...veri, figures: f };
  }

  /** Gecelik: satıcı olarak sohbeti ya da yıldızı olan bütün hesaplar ve bütün galeriler */
  async recomputeAll() {
    const [a, b, g] = await Promise.all([
      this.db.conversation.findMany({ distinct: ['sellerAccountId'], select: { sellerAccountId: true } }),
      this.db.rating.findMany({ distinct: ['sellerAccountId'], select: { sellerAccountId: true } }),
      this.db.gallery.findMany({ select: { accountId: true } }),
    ]);
    const ids = new Set([
      ...a.map((x) => x.sellerAccountId),
      ...b.map((x) => x.sellerAccountId),
      ...g.map((x) => x.accountId),
    ]);
    for (const id of ids) await this.recompute(id);
    return ids.size;
  }

  private async member(userId: string, accountId: string) {
    const m = await this.db.accountMember.findUnique({
      where: { accountId_userId: { accountId, userId } },
      include: { account: { select: { gallery: { select: { accountId: true } } } } },
    });
    if (!m?.account.gallery) throw new NotFoundException('Galeri bulunamadı');
    return m;
  }

  /** Galeri paneli: yıldız ortalaması, dağılımı, rozete ne kadar kaldığı (Karar 55); takipçi sayısı (Karar 28) */
  async galleryView(userId: string, accountId: string) {
    await this.member(userId, accountId);
    const s = await this.recompute(accountId);
    if (!s) throw new NotFoundException('Galeri bulunamadı');
    const takipci = await this.db.galleryFollow.count({ where: { accountId } });
    return {
      yildizSayisi: s.ratingCount,
      yildizOrtalama: s.ratingAvg === null ? null : Math.round(s.ratingAvg * 10) / 10,
      dagilim: s.ratingDist,
      yanitSohbet: s.responseConvs,
      ortalamaYanitDakika: s.responseAvg,
      ortancaYanitDakika: s.responseMedian,
      puan: s.score,
      rozetler: badgeProgress(s.figures).map((p) => ({ ...p, ...BADGES[p.rozet] })),
      takipci,
    };
  }

  /** Konsol › Satıcı puanı ve rozetler (YonetimPazar.dc.html) */
  async staffOverview() {
    const ucretli = await this.db.gallery.findMany({
      where: { plan: { in: ['baslangic', 'profesyonel', 'kurumsal'] }, account: { status: 'ACTIVE' } },
      select: { accountId: true },
    });
    const ids = ucretli.map((g) => g.accountId);
    const stats = await this.db.sellerStats.findMany({
      where: { accountId: { in: ids } },
      select: { badges: true },
    });
    const sayi = (k: BadgeKey) => stats.filter((s) => s.badges.includes(k)).length;
    const son90 = new Date(Date.now() - BADGE_RULES.guven.gun * DAY);
    const [dagilim, katilmayan, isaretli] = await Promise.all([
      this.db.rating.groupBy({
        by: ['stars'],
        where: { createdAt: { gte: son90 }, counted: true },
        _count: { _all: true },
      }),
      this.db.rating.count({ where: { createdAt: { gte: son90 }, counted: false } }),
      this.db.rating.groupBy({
        by: ['sellerAccountId', 'flag', 'stars'],
        where: { flag: { not: null }, createdAt: { gte: son90 } },
        _count: { _all: true },
        orderBy: { _count: { sellerAccountId: 'desc' } },
        take: 20,
      }),
    ]);
    const toplam = dagilim.reduce((t, d) => t + d._count._all, 0);
    const ortalama = toplam ? dagilim.reduce((t, d) => t + d.stars * d._count._all, 0) / toplam : null;
    const adlar = new Map(
      (
        await this.db.account.findMany({
          where: { id: { in: isaretli.map((i) => i.sellerAccountId) } },
          select: { id: true, name: true, gallery: { select: { displayName: true } } },
        })
      ).map((a) => [a.id, a.gallery?.displayName ?? a.name]),
    );
    return {
      ucretliGaleri: ids.length,
      rozetler: [
        {
          ...BADGES.onay,
          key: 'onay',
          sayi: ids.length,
          kosul: [['Yetki belgesi, vergi levhası, MERSİS', 'Doğrulandı']],
        },
        {
          ...BADGES.hizli,
          key: 'hizli',
          sayi: sayi('hizli'),
          kosul: [
            ['Ortanca ilk yanıt', '1 saatin altında'],
            ['En az sohbet', `${BADGE_RULES.hizli.enAzSohbet} · son ${BADGE_RULES.hizli.gun} gün`],
          ],
        },
        {
          ...BADGES.guven,
          key: 'guven',
          sayi: sayi('guven'),
          kosul: [
            ['Yıldız ortalaması', `4,5 ve üstü · en az ${BADGE_RULES.guven.enAzYildiz}`],
            ['Şikâyet oranı', `%1 altı · son ${BADGE_RULES.guven.gun} gün`],
            ['Onaylı galeri', 'Şart'],
          ],
        },
      ],
      yildiz: {
        toplam,
        ortalama: ortalama === null ? null : Math.round(ortalama * 10) / 10,
        katilmayan,
        dagilim: [5, 4, 3, 2, 1].map((n) => {
          const adet = dagilim.find((d) => d.stars === n)?._count._all ?? 0;
          return { yildiz: n, adet, oran: toplam ? Math.round((adet / toplam) * 100) : 0 };
        }),
      },
      bilesen: (Object.keys(SCORE_WEIGHTS) as (keyof typeof SCORE_WEIGHTS)[]).map((k) => ({
        ad: SCORE_NAMES[k],
        agirlik: SCORE_WEIGHTS[k],
      })),
      isaretli: isaretli.map((i) => ({
        satici: adlar.get(i.sellerAccountId) ?? 'Satıcı',
        adet: i._count._all,
        yildiz: i.stars,
        neden: RATING_FLAGS[i.flag as RatingFlag] ?? i.flag,
      })),
    };
  }

  // ── Galeri takibi (Karar 28) ──────────────────────────────────

  private async gallerySlug(slug: string) {
    const g = await this.db.gallery.findUnique({
      where: { slug },
      select: { accountId: true, account: { select: { status: true } } },
    });
    if (g?.account.status !== 'ACTIVE') throw new NotFoundException('Galeri bulunamadı');
    return g.accountId;
  }

  async followState(userId: string, slug: string) {
    const accountId = await this.gallerySlug(slug);
    const f = await this.db.galleryFollow.findUnique({ where: { userId_accountId: { userId, accountId } } });
    return { takip: !!f };
  }

  async follow(userId: string, slug: string, takip: boolean) {
    const accountId = await this.gallerySlug(slug);
    const uye = await this.db.accountMember.findUnique({
      where: { accountId_userId: { accountId, userId } },
    });
    if (uye) throw new ForbiddenException('Kendi galerini takip edemezsin');
    if (takip) {
      await this.db.galleryFollow.upsert({
        where: { userId_accountId: { userId, accountId } },
        create: { userId, accountId, digestAt: new Date() },
        update: {},
      });
    } else await this.db.galleryFollow.deleteMany({ where: { userId, accountId } });
    return { takip };
  }

  /**
   * Günlük özet (Karar 28): takip edilen galerinin portföyüne eklenen ve kullanıcının yayındaki taleplerine uyan
   * araçlar. Olay bildirim katmanına (Aşama 7) yazılır.
   */
  async followDigest() {
    const fs = await this.db.galleryFollow.findMany();
    let n = 0;
    for (const f of fs) {
      const since = f.digestAt ?? f.createdAt;
      const ms = await this.db.match.findMany({
        where: {
          accountId: f.accountId,
          active: true,
          createdAt: { gt: since },
          demand: { userId: f.userId, status: 'PUBLISHED' },
          vehicle: { status: 'PUBLISHED' },
        },
        select: { vehicleId: true, demandId: true, score: true },
      });
      await this.db.$transaction(async (tx) => {
        if (ms.length) {
          await this.outbox.add(tx, 'takip.ozet', {
            userId: f.userId,
            accountId: f.accountId,
            araclar: [...new Set(ms.map((m) => m.vehicleId))],
          });
          n++;
        }
        await tx.galleryFollow.update({
          where: { userId_accountId: { userId: f.userId, accountId: f.accountId } },
          data: { digestAt: new Date() },
        });
      });
    }
    return n;
  }
}
