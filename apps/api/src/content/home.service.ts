import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, uuidv7 } from '@rengarenk/db';
import {
  completeHomeLayout,
  defaultHomeLayout,
  galleryAccess,
  HOME_SECTIONS,
  type HomeAudience,
  type HomeLayout,
  type HomePlatform,
  type HomeResponse,
  homeLayoutChanges,
  homeLayoutSchema,
  visibleSections,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { arananModeller } from '../dashboard/aranan-modeller.js';
import { trGunBasi } from '../dashboard/dashboard.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { PricingService } from '../pricing/pricing.service.js';
import { BannerService } from './banner.service.js';

const DAY = 86_400_000;
const tarih = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(d);
const kisaAd = (name: string) => {
  // Yalnızca harfle başlayan sözcükler: "Sahip (geliştirme)" → "Sahip"
  const p = name
    .trim()
    .split(/\s+/)
    .filter((x) => /^\p{L}/u.test(x));
  return p.length > 1 ? `${p.slice(0, -1).join(' ')} ${p.at(-1)?.slice(0, 1)}.` : (p[0] ?? 'Bir çalışan');
};

/**
 * Ana sayfa düzeni (Karar 46; YonetimIcerik.dc.html › anasayfa). Düzen sürümlüdür: yayındaki, zamanı gelmiş en yüksek
 * sürümdür; ileri tarihli sürüm zamanı gelince kendiliğinden yayına girer. Herkese açık uç görüntüleyenin kitlesini
 * (ziyaretçi, bireysel, galeri) bulur, görünen bölümleri ve kişiye özel bölümlerin verisini tek yanıtta verir.
 */
@Injectable()
export class HomeService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly banners: BannerService,
    private readonly pricing: PricingService,
  ) {}

  /** Yayındaki düzen ve sürümü (hiç yayın yoksa varsayılan, sürüm 0) */
  async aktif(now = new Date()): Promise<{ surum: number; duzen: HomeLayout }> {
    const v = await this.db.homeLayoutVersion.findFirst({
      where: { publishAt: { lte: now } },
      orderBy: { version: 'desc' },
    });
    if (!v) return { surum: 0, duzen: defaultHomeLayout() };
    const p = homeLayoutSchema.safeParse(completeHomeLayout(v.layout));
    return { surum: v.version, duzen: p.success ? (p.data as HomeLayout) : defaultHomeLayout() };
  }

  // ── Herkese açık ───────────────────────────────────────────

  async home(platform: HomePlatform, userId?: string, now = new Date()): Promise<HomeResponse> {
    const [{ duzen }, v] = await Promise.all([this.aktif(now), this.banners.viewer(userId)]);
    const kitle: HomeAudience = v.kitle;
    const sira = visibleSections(duzen[kitle][platform]);
    const out: HomeResponse = { kitle, sira };
    if (!userId) return out;
    if (kitle === 'bireysel') {
      if (sira.includes('taleplerim')) out.taleplerim = await this.taleplerim(userId, now);
      if (sira.includes('mesaj')) out.mesajlar = await this.mesajlar(userId);
      return out;
    }
    // Galeri: karşılama her zaman açık (ad, paket, bugünkü hak)
    const uye = await this.db.accountMember.findFirst({
      where: { userId, account: { kind: 'BUSINESS', status: 'ACTIVE' } },
      orderBy: { createdAt: 'asc' },
      include: { account: { include: { gallery: true } } },
    });
    const g = uye?.account.gallery;
    if (!uye || !g) return out;
    const erisim = galleryAccess(g, now, await this.pricing.plans());
    const [portfoy, okunmamis, kullanilan, ek] = await Promise.all([
      this.db.portfolioVehicle.count({ where: { accountId: g.accountId, status: 'PUBLISHED' } }),
      // Okunmamış sohbet: alıcının yazdığı ve galerinin henüz okumadığı (Mesajlarım ile aynı kural)
      this.db.$queryRaw<{ n: number }[]>`
        SELECT count(DISTINCT c.id)::int AS n
        FROM conversations c JOIN messages m ON m.conversation_id = c.id
        WHERE c.seller_account_id = ${g.accountId}::uuid AND m.side <> 'satici'
          AND (c.seller_read_at IS NULL OR m.created_at > c.seller_read_at)`.then((r) => r[0]?.n ?? 0),
      this.db.conversation.count({
        where: {
          sellerAccountId: g.accountId,
          origin: 'talep',
          entitlement: 'paket',
          createdAt: { gte: trGunBasi(now) },
        },
      }),
      this.db.entitlementLedger.aggregate({
        where: { accountId: g.accountId, kind: 'ilk_mesaj' },
        _sum: { delta: true },
      }),
    ]);
    out.galeri = {
      accountId: g.accountId,
      ad: g.displayName,
      paket: erisim.ad,
      il: g.il,
      portfoy,
      okunmamis,
      gunluk: erisim.saltOkunur
        ? null
        : { toplam: erisim.ozellik.gunlukMesaj, kalan: Math.max(0, erisim.ozellik.gunlukMesaj - kullanilan) },
      ek: ek._sum.delta ?? 0,
    };
    if (sira.includes('aranan')) {
      const [r] = await arananModeller(
        this.db,
        [{ accountId: g.accountId, displayName: g.displayName, il: g.il }],
        now,
      );
      out.aranan = r ? { bolge: r.bolge, modeller: r.modeller, oneri: r.oneri } : null;
    }
    return out;
  }

  /** Bireysel: yayındaki talepler (süresi en yakın önce), kalan gün ve yazan satıcı sayısı */
  private async taleplerim(userId: string, now: Date) {
    const d = await this.db.demand.findMany({
      where: { userId, status: 'PUBLISHED' },
      orderBy: { expiresAt: 'asc' },
      take: 3,
      select: {
        no: true,
        title: true,
        headline: true,
        expiresAt: true,
        _count: { select: { conversations: { where: { origin: 'talep' } } } },
      },
    });
    return d.map((x) => ({
      no: Number(x.no),
      baslik: x.headline || x.title || `Talep ${x.no}`,
      kalanGun: x.expiresAt ? Math.max(0, Math.ceil((x.expiresAt.getTime() - now.getTime()) / DAY)) : 0,
      yazan: x._count.conversations,
    }));
  }

  /** Bireysel: talebine gelen ilk mesajlar, okunmamışlar önce */
  private async mesajlar(userId: string) {
    const c = await this.db.conversation.findMany({
      where: { buyerUserId: userId, origin: 'talep' },
      orderBy: [{ buyerReadAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
      take: 3,
      include: {
        demand: { select: { title: true, headline: true } },
        sellerAccount: { select: { gallery: { select: { displayName: true } } } },
      },
    });
    return c.map((x) => ({
      id: x.id,
      satici: x.sellerAccount.gallery?.displayName ?? 'Bireysel satıcı',
      talep: x.demand?.headline || x.demand?.title || 'Talebin',
      okunmadi: x.buyerReadAt === null,
      zaman: x.createdAt.toISOString(),
    }));
  }

  // ── Konsol ─────────────────────────────────────────────────

  async staffView(now = new Date()) {
    const [aktif, satirlar, staff] = await Promise.all([
      this.aktif(now),
      this.db.homeLayoutVersion.findMany({ orderBy: { version: 'desc' }, take: 12 }),
      this.db.staffMember.findMany({ select: { id: true, name: true } }),
    ]);
    const kim = new Map(staff.map((s) => [s.id, s.name]));
    const zamanli = satirlar.find((s) => s.publishAt > now);
    return {
      bolumler: HOME_SECTIONS,
      yayinda: aktif,
      zamanli: zamanli
        ? {
            surum: zamanli.version,
            zaman: tarih(zamanli.publishAt),
            duzen: completeHomeLayout(zamanli.layout) as HomeLayout,
          }
        : null,
      surumler: satirlar.map((s) => ({
        no: `s.${s.version}`,
        surum: s.version,
        not: s.note,
        kim: `${s.createdBy ? kisaAd(kim.get(s.createdBy) ?? 'Bir çalışan') : 'Sistem'} · ${tarih(s.createdAt)}`,
        durum:
          s.publishAt > now
            ? `Zamanlandı · ${tarih(s.publishAt)}`
            : s.version === aktif.surum
              ? 'Yayında'
              : '',
        don: s.publishAt <= now && s.version !== aktif.surum,
      })),
    };
  }

  /** Yeni sürüm: hemen ya da ileri tarihte. Bekleyen zamanlanmış sürüm varsa yerine geçer. */
  async publish(staffId: string, duzen: HomeLayout, zaman: string | null, ip?: string, not?: string) {
    const now = new Date();
    const publishAt = zaman ? new Date(zaman) : now;
    if (zaman && publishAt.getTime() <= now.getTime())
      throw new BadRequestException('Zamanlanan tarih ileride olmalı');
    const { duzen: once } = await this.aktif(now);
    const degisim = homeLayoutChanges(once, duzen);
    if (!degisim.length && !not) throw new BadRequestException('Yayındaki düzende değişiklik yok');
    await this.db.$transaction(async (tx) => {
      // Zamanı gelmemiş eski plan düşer
      await tx.homeLayoutVersion.deleteMany({ where: { publishAt: { gt: now } } });
      const son = await tx.homeLayoutVersion.findFirst({
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const version = (son?.version ?? 0) + 1;
      await tx.homeLayoutVersion.create({
        data: {
          id: uuidv7(),
          version,
          layout: duzen as unknown as Prisma.InputJsonValue,
          note: (not ?? degisim.join('; ')).slice(0, 1000),
          publishAt,
          createdBy: staffId,
        },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: zaman ? 'ana_sayfa_zamanlandi' : 'ana_sayfa_yayinlandi',
          entityType: 'home_layout',
          entityId: String(version),
          after: { degisim, zaman: publishAt.toISOString() },
          ip,
        },
        tx,
      );
    });
    return this.staffView();
  }

  async rollback(staffId: string, surum: number, ip?: string) {
    const v = await this.db.homeLayoutVersion.findUnique({ where: { version: surum } });
    if (!v || v.publishAt > new Date()) throw new NotFoundException('Sürüm bulunamadı');
    const p = homeLayoutSchema.safeParse(completeHomeLayout(v.layout));
    if (!p.success) throw new BadRequestException('Sürüm okunamadı');
    return this.publish(staffId, p.data as HomeLayout, null, ip, `s.${surum} sürümüne dönüldü`);
  }
}
