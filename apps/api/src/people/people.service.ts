import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, uuidv7 } from '@rengarenk/db';
import {
  BLOCK_KINDS,
  type BlockKind,
  DECISION_NAMES,
  GRANT_MONTHLY_LIMIT,
  type GrantKind,
  isClosedPhone,
  type ModerationDecision,
  maskEposta,
  normalizeBlockValue,
  type PeopleFilter,
  type PermissionGrants,
  REPORT_REASONS,
  type ReportReasonKey,
  satisfies,
  tlYaz,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { blockHash, karaListede } from '../moderation/blocklist.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { SanctionService } from '../moderation/sanctions.service.js';
import { NotificationService } from '../notifications/notification.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { kalemler } from '../payments/order-item.js';
import { rozetler } from '../trust/badges.js';
import { GalleryCareService } from './gallery-care.service.js';

const DAY = 86_400_000;
const TINTS = ['#FFEEF6', '#FFF6DF', '#EEF3FF', '#E7FAF0', '#F3EFFF', '#FFF0EA'];
const tint = (id: string) =>
  TINTS[Number.parseInt(id.replace(/-/g, '').slice(-2), 16) % TINTS.length] as string;
const bas = (ad: string) =>
  ad
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('') || '?';
const ayYil = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(d);
/** Giriş bağlantısı (Karar 52): geçerlilik ve kişi başına günlük sınır */
const LOGIN_LINK_MINUTES = 15;
const LOGIN_LINK_PER_DAY = 3;
const kisaTarih = (d: Date) => {
  const gun = new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Istanbul',
  });
  const saat = new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  });
  return gun.format(d) === gun.format(new Date()) ? `Bugün ${saat.format(d)}` : gun.format(d);
};
const maskTel = (e164: string) => (isClosedPhone(e164) ? 'Hesap kapatıldı' : `05•• ••• •• ${e164.slice(-2)}`);
const PLAN_AD: Record<string, string> = {
  deneme: 'Deneme',
  baslangic: 'Başlangıç paketi',
  profesyonel: 'Profesyonel paket',
  kurumsal: 'Kurumsal paket',
  pasif: 'Paket yok',
};

export interface StaffCtx {
  staff: { id: string; role: string; status: string };
  grants: PermissionGrants;
}
type Tip = 'kisi' | 'galeri';
interface GecmisSatir {
  zaman: Date;
  olay: string;
  detay: string;
  renk: string;
}

/**
 * Konsol › Kullanıcılar ve galeriler (Karar 40, 43, 52; YonetimPazar.dc.html › kullanici).
 *
 * - Kişisel veri (telefon, e-posta) maskeli gelir; "Göster" gerekçe ister, işlem kaydına girer, istemci 5 dakika sonra
 *   yeniden maskeler. Pazarlama ve izleyici kartı göremez (kisisel_veri.gor yok).
 * - Uyarı, askı ve kalıcı engelleme önerisi moderasyon kaydı olarak açılır (bildirim ve itiraz aynı akıştan).
 * - Hak tanımlama küçük limitlidir; iade bu ekrandan yapılmaz, Ödemeler ekranında önerilir.
 * - Kara liste: telefon, IBAN, IP; değerin kendisi değil anahtarlı özeti saklanır.
 */
@Injectable()
export class PeopleService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly moderation: ModerationService,
    private readonly sanctions: SanctionService,
    private readonly notifications: NotificationService,
    private readonly care: GalleryCareService,
  ) {}

  // ── Arama ─────────────────────────────────────────────────────

  async search(q: string, tur: PeopleFilter) {
    const t = q.trim();
    const no = /^\d{6,12}$/.test(t) ? BigInt(t) : null;
    const askida = tur === 'askida';
    const simdi = new Date();
    const askidakiler = askida
      ? (
          await this.db.userSanction.findMany({
            where: {
              kind: 'aski',
              liftedAt: null,
              OR: [{ until: { gt: simdi } }, { approvalId: { not: null } }],
            },
            select: { userId: true },
          })
        ).map((s) => s.userId)
      : [];
    const talepSahibi = no
      ? await this.db.demand.findUnique({ where: { no }, select: { userId: true } })
      : null;

    const kisiler =
      tur === 'galeri'
        ? []
        : await this.db.user.findMany({
            where: {
              ...(askida ? { OR: [{ id: { in: askidakiler } }, { status: 'SUSPENDED' }] } : {}),
              ...(t
                ? talepSahibi
                  ? { id: talepSahibi.userId }
                  : {
                      AND: [
                        {
                          OR: [
                            { firstName: { contains: t, mode: 'insensitive' } },
                            { lastName: { contains: t, mode: 'insensitive' } },
                            { email: { startsWith: t.toLocaleLowerCase('tr-TR'), mode: 'insensitive' } },
                            ...(/^\+?\d{4,}$/.test(t.replace(/\s/g, ''))
                              ? [{ phone: { endsWith: t.replace(/\D/g, '').slice(-7) } }]
                              : []),
                          ],
                        },
                      ],
                    }
                : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 25,
            select: {
              id: true,
              firstName: true,
              lastName: true,
              status: true,
              memberships: { select: { account: { select: { kind: true } } } },
            },
          });
    const galeriler =
      tur === 'bireysel'
        ? []
        : await this.db.gallery.findMany({
            where: {
              ...(askida ? { account: { status: 'SUSPENDED' } } : {}),
              ...(t && !talepSahibi ? { displayName: { contains: t, mode: 'insensitive' } } : {}),
              ...(talepSahibi ? { account: { members: { some: { userId: talepSahibi.userId } } } } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 15,
            select: {
              accountId: true,
              displayName: true,
              il: true,
              plan: true,
              account: { select: { status: true } },
            },
          });
    // Listedeki kişilerin etkin askısı (durum rozeti için; süzgeçten bağımsız)
    const aski = new Set(
      askida
        ? askidakiler
        : (
            await this.db.userSanction.findMany({
              where: {
                userId: { in: kisiler.map((u) => u.id) },
                kind: 'aski',
                liftedAt: null,
                OR: [{ until: { gt: simdi } }, { approvalId: { not: null } }],
              },
              select: { userId: true },
            })
          ).map((x) => x.userId),
    );
    return [
      ...galeriler.map((g) => ({
        tip: 'galeri' as Tip,
        id: g.accountId,
        ad: g.displayName,
        bas: bas(g.displayName),
        renk: tint(g.accountId),
        alt: `Galeri · ${PLAN_AD[g.plan] ?? g.plan}`,
        durum:
          g.account.status === 'SUSPENDED' ? 'Askıda' : g.account.status === 'CLOSED' ? 'Kapalı' : 'Aktif',
      })),
      ...kisiler.map((u) => {
        const ad =
          u.status === 'CLOSED'
            ? 'Kapatılmış hesap'
            : [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Adsız kullanıcı';
        const galeriUyesi = u.memberships.some((m) => m.account.kind === 'BUSINESS');
        return {
          tip: 'kisi' as Tip,
          id: u.id,
          ad,
          bas: bas(ad),
          renk: tint(u.id),
          alt: galeriUyesi ? 'Bireysel · galeri çalışanı' : 'Bireysel',
          durum:
            u.status === 'SUSPENDED'
              ? 'Engelli'
              : u.status === 'CLOSED'
                ? 'Kapalı'
                : aski.has(u.id)
                  ? 'Askıda'
                  : 'Aktif',
        };
      }),
    ];
  }

  // ── Kart ──────────────────────────────────────────────────────

  private async kisiOf(id: string) {
    const u = await this.db.user.findUnique({
      where: { id },
      include: {
        memberships: { include: { account: { select: { kind: true, id: true } } } },
        devices: { orderBy: { lastSeenAt: 'desc' }, take: 1, select: { platform: true, lastSeenAt: true } },
      },
    });
    if (!u) throw new NotFoundException('Kullanıcı bulunamadı');
    return u;
  }

  /** Galeri kartının kişisi: hesabın sahibi */
  private async galeriOf(accountId: string) {
    const g = await this.db.gallery.findUnique({
      where: { accountId },
      include: { account: { include: { members: true } } },
    });
    if (!g) throw new NotFoundException('Galeri bulunamadı');
    const sahip = g.account.members.find((m) => m.role === 'OWNER');
    if (!sahip) throw new NotFoundException('Galerinin sahibi bulunamadı');
    return { g, sahipId: sahip.userId };
  }

  /** Kartın kararlarda kullandığı kişi ve hesap */
  private async hedef(tip: Tip, id: string) {
    if (tip === 'galeri') {
      const { sahipId } = await this.galeriOf(id);
      return { userId: sahipId, accountId: id };
    }
    const u = await this.kisiOf(id);
    const kisisel = u.memberships.find((m) => m.account.kind === 'INDIVIDUAL');
    return { userId: u.id, accountId: null as string | null, kisiselHesap: kisisel?.accountId ?? null };
  }

  async card(tip: Tip, id: string) {
    return tip === 'galeri' ? this.galeriKarti(id) : this.kisiKarti(id);
  }

  private async kisiKarti(id: string) {
    const u = await this.kisiOf(id);
    const ad =
      u.status === 'CLOSED'
        ? 'Kapatılmış hesap'
        : [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Adsız kullanıcı';
    const hesaplar = u.memberships.map((m) => m.accountId);
    const [talepler, aktifTalep, ilkMesaj, odeme, sikayetAldi, sikayetYapti, yildiz, reklam, aski, sonTalep] =
      await Promise.all([
        this.db.demand.count({ where: { userId: id, status: { not: 'DRAFT' } } }),
        this.db.demand.count({ where: { userId: id, status: 'PUBLISHED' } }),
        this.db.conversation.count({ where: { buyerUserId: id, origin: 'talep' } }),
        this.db.order.aggregate({ where: { userId: id, status: 'PAID' }, _sum: { totalKurus: true } }),
        this.db.report.count({ where: { targetUserId: id } }),
        this.db.report.count({ where: { reporterUserId: id } }),
        this.db.rating.count({ where: { buyerUserId: id } }),
        this.db.consent.findFirst({
          where: { userId: id, kind: 'reklam_olcum' },
          orderBy: { createdAt: 'desc' },
          select: { granted: true },
        }),
        this.sanctions.aktifAski(id),
        this.db.demand.findFirst({
          where: { userId: id, il: { not: null } },
          orderBy: { createdAt: 'desc' },
          select: { il: true, ilce: true },
        }),
      ]);
    const cihaz = u.devices[0];
    const rozet = [
      ...(u.status === 'SUSPENDED' ? [{ t: 'Kalıcı engelli', bg: '#FDECEC', fg: '#A3271F' }] : []),
      ...(u.status === 'CLOSED' ? [{ t: 'Hesap kapatıldı', bg: '#F3F5FA', fg: '#3A4052' }] : []),
      ...(aski
        ? [{ t: aski.until ? 'Askıda · 24 saat' : 'Askıda · onay bekliyor', bg: '#FDECEC', fg: '#A3271F' }]
        : []),
      ...(u.emailVerifiedAt ? [{ t: 'E-posta doğrulandı', bg: '#EEF3FF', fg: '#2450C8' }] : []),
      ...(u.phoneVerifiedAt ? [{ t: 'Telefon doğrulandı', bg: '#EEF3FF', fg: '#2450C8' }] : []),
      ...(reklam?.granted ? [{ t: 'Reklam ölçümüne izin verdi', bg: '#F3F5FA', fg: '#3A4052' }] : []),
      ...(hesaplar.length > 1 ? [{ t: 'Galeri çalışanı', bg: '#FFF6DF', fg: '#7A5300' }] : []),
    ];
    return {
      tip: 'kisi' as Tip,
      id,
      ad,
      bas: bas(ad),
      renk: tint(id),
      alt: [
        'Bireysel üye',
        sonTalep ? [sonTalep.il, sonTalep.ilce].filter(Boolean).join(', ') : null,
        `${ayYil(u.createdAt)}’dan beri`,
        cihaz ? `son giriş ${kisaTarih(cihaz.lastSeenAt)}` : null,
        cihaz ? { IOS: 'iOS', ANDROID: 'Android', WEB: 'Web' }[cihaz.platform] : null,
        aski?.until
          ? `askı ${new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }).format(aski.until)}’a kadar`
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
      rozetler: rozet,
      // Kapatılan hesapta karar ve hak işlemleri yapılmaz; not ve iade önerisi kalır (Karar 31)
      kapali: u.status === 'CLOSED',
      telefon: maskTel(u.phone),
      eposta: u.email ? maskEposta(u.email) : '—',
      sayilar: [
        { ad: 'Talep', deger: `${talepler} · ${aktifTalep} aktif` },
        { ad: 'Aldığı ilk mesaj', deger: String(ilkMesaj) },
        { ad: 'Ödeme', deger: tlYaz(Number(odeme._sum.totalKurus ?? 0n)) },
        { ad: 'Şikâyet', deger: `${sikayetAldi} aldı · ${sikayetYapti} yaptı` },
        { ad: 'Verdiği yıldız', deger: String(yildiz) },
      ],
      gecmis: await this.gecmis({ userId: id, accountIds: hesaplar, uyelik: u.createdAt }),
      cihazlar: await this.cihazlar(id),
      durum: u.status,
    };
  }

  private async galeriKarti(accountId: string) {
    const { g, sahipId } = await this.galeriOf(accountId);
    const otuz = new Date(Date.now() - 30 * DAY);
    const [portfoy, ilkMesaj, odeme, sikayet, stats, rz, temsilci, aski] = await Promise.all([
      this.db.portfolioVehicle.count({ where: { accountId, status: 'PUBLISHED' } }),
      this.db.conversation.count({
        where: { sellerAccountId: accountId, origin: 'talep', createdAt: { gte: otuz } },
      }),
      this.db.order.aggregate({
        where: { accountId, status: 'PAID', paidAt: { gte: otuz } },
        _sum: { totalKurus: true },
      }),
      this.db.report.count({ where: { targetAccountId: accountId } }),
      this.db.sellerStats.findUnique({ where: { accountId } }),
      rozetler(this.db, [accountId]),
      this.db.accountMember.count({ where: { accountId, role: 'SALES' } }),
      this.sanctions.aktifAski(sahipId, accountId),
    ]);
    const sahip = await this.db.user.findUniqueOrThrow({
      where: { id: sahipId },
      select: { phone: true, email: true },
    });
    return {
      tip: 'galeri' as Tip,
      id: accountId,
      ad: g.displayName,
      bas: bas(g.displayName),
      renk: tint(accountId),
      alt: [
        'Galeri',
        `${g.il}, ${g.ilce}`,
        PLAN_AD[g.plan] ?? g.plan,
        temsilci ? `${temsilci} satış temsilcisi` : null,
        `${ayYil(g.approvedAt)}’dan beri`,
      ]
        .filter(Boolean)
        .join(' · '),
      rozetler: [
        ...(g.account.status === 'SUSPENDED' ? [{ t: 'Galeri askıda', bg: '#FDECEC', fg: '#A3271F' }] : []),
        ...(aski
          ? [
              {
                t: aski.until ? 'Mesaj askısı · 24 saat' : 'Askıda · onay bekliyor',
                bg: '#FDECEC',
                fg: '#A3271F',
              },
            ]
          : []),
        ...(rz.get(accountId) ?? []).map((r) => ({ t: r.ad, bg: r.bg, fg: r.renk })),
      ],
      telefon: maskTel(sahip.phone),
      eposta: sahip.email ? maskEposta(sahip.email) : '—',
      sayilar: [
        { ad: 'Portföy', deger: `${portfoy} araç` },
        { ad: 'İlk mesaj (30 gün)', deger: String(ilkMesaj) },
        { ad: 'Ödeme (30 gün)', deger: tlYaz(Number(odeme._sum.totalKurus ?? 0n)) },
        { ad: 'Şikâyet', deger: `${sikayet} aldı` },
        {
          ad: 'Yıldız',
          deger: stats?.ratingCount
            ? `${(stats.ratingAvg ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} · ${stats.ratingCount} adet`
            : '—',
        },
      ],
      gecmis: await this.gecmis({
        userId: sahipId,
        accountIds: [accountId],
        uyelik: g.approvedAt,
        galeri: true,
      }),
      /** Müşteri yönetimi (Karar 43): sorumlu çalışan, yenileme, ayrılma riski */
      musteri: await this.care.section(accountId),
      durum: g.account.status,
    };
  }

  /** Kartın geçmişi: talepler, ödemeler, şikâyetler ve kararlar, yıldızlar, notlar, çalışan işlemleri (en yeni 25) */
  private async gecmis(p: { userId: string; accountIds: string[]; uyelik: Date; galeri?: boolean }) {
    const [talepler, odemeler, sikayetler, yapilan, yildizlar, notlar, islemler] = await Promise.all([
      p.galeri
        ? Promise.resolve([])
        : this.db.demand.findMany({
            where: { userId: p.userId, status: { not: 'DRAFT' } },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { no: true, title: true, headline: true, il: true, publishedAt: true, createdAt: true },
          }),
      this.db.order.findMany({
        where: {
          accountId: { in: p.accountIds.length ? p.accountIds : ['00000000-0000-0000-0000-000000000000'] },
          status: 'PAID',
          ...(p.galeri ? {} : { userId: p.userId }),
        },
        orderBy: { paidAt: 'desc' },
        take: 10,
        select: { no: true, items: true, totalKurus: true, channel: true, paidAt: true },
      }),
      this.db.report.findMany({
        where: p.galeri ? { targetAccountId: { in: p.accountIds } } : { targetUserId: p.userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      p.galeri
        ? Promise.resolve([])
        : this.db.report.findMany({
            where: { reporterUserId: p.userId },
            orderBy: { createdAt: 'desc' },
            take: 5,
          }),
      p.galeri
        ? this.db.rating.findMany({
            where: { sellerAccountId: { in: p.accountIds } },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { stars: true, createdAt: true, counted: true },
          })
        : this.db.rating.findMany({
            where: { buyerUserId: p.userId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              stars: true,
              createdAt: true,
              counted: true,
              sellerAccount: { select: { gallery: { select: { displayName: true } } } },
            },
          }),
      this.db.staffNote.findMany({
        where: p.galeri ? { accountId: { in: p.accountIds } } : { userId: p.userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.db.auditLog.findMany({
        where: {
          entityType: p.galeri ? 'account' : 'user',
          entityId: p.galeri ? (p.accountIds[0] as string) : p.userId,
          actorType: { in: ['STAFF', 'AGENT'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    const staffIds = [
      ...new Set([...notlar.map((n) => n.staffId), ...islemler.map((i) => i.actorId).filter(Boolean)]),
    ] as string[];
    const calisan = new Map(
      (
        await this.db.staffMember.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, name: true },
        })
      ).map((s) => [s.id, s.name]),
    );
    const sat: GecmisSatir[] = [
      { zaman: p.uyelik, olay: p.galeri ? 'Başvuru onaylandı' : 'Üye oldu', detay: '', renk: '#AEB5C4' },
      ...talepler.map((d) => ({
        zaman: d.publishedAt ?? d.createdAt,
        olay: `Talep oluşturdu · No ${d.no}`,
        detay: [d.headline ?? d.title, d.il].filter(Boolean).join(' · '),
        renk: '#FFC84A',
      })),
      ...odemeler.map((o) => ({
        zaman: o.paidAt as Date,
        olay: `Ödeme · ${kalemler(o.items)
          .map((k) => k.ad)
          .join(', ')}`,
        detay: `${tlYaz(Number(o.totalKurus))} · ${o.channel === 'ios' ? 'App Store' : o.channel === 'android' ? 'Google Play' : 'Web'}`,
        renk: '#3DD68C',
      })),
      ...sikayetler.map((r) => ({
        zaman: r.decidedAt ?? r.createdAt,
        olay: r.decision
          ? `${r.source === 'calisan' ? 'Çalışan kararı' : r.decidedByAgent ? 'Ajan kararı' : 'Moderasyon kararı'} · ${DECISION_NAMES[r.decision as ModerationDecision]}${r.reversedAt ? ' (itirazla geri alındı)' : ''}`
          : r.source === 'ajan'
            ? `Ajan: ${r.agentAction ?? 'şikâyet açtı'}`
            : `Şikâyet aldı · S-${r.no}`,
        detay: r.decisionNote ?? REPORT_REASONS[r.reason as ReportReasonKey]?.ad ?? r.reason,
        renk: r.decision === 'red' ? '#AEB5C4' : '#E5484D',
      })),
      ...yapilan.map((r) => ({
        zaman: r.createdAt,
        olay: `Şikâyet etti · S-${r.no}`,
        detay: REPORT_REASONS[r.reason as ReportReasonKey]?.ad ?? r.reason,
        renk: '#5B8CFF',
      })),
      ...yildizlar.map((y) => ({
        zaman: y.createdAt,
        olay: p.galeri
          ? `Yıldız aldı · ${y.stars}`
          : `Yıldız verdi${galeriAdi(y) ? ` · ${galeriAdi(y)}` : ''}`,
        detay: `${y.stars} yıldız${y.counted ? '' : ' · hesaba katılmadı'}`,
        renk: '#FFC84A',
      })),
      ...notlar.map((n) => ({
        zaman: n.createdAt,
        olay: `Not · ${calisan.get(n.staffId) ?? 'Çalışan'}`,
        detay: n.text,
        renk: '#5B8CFF',
      })),
      ...islemler
        .filter((i) => ISLEM_AD[i.action])
        .map((i) => ({
          zaman: i.createdAt,
          olay: `${ISLEM_AD[i.action]} · ${i.actorType === 'AGENT' ? 'Ajan' : (calisan.get(i.actorId ?? '') ?? 'Çalışan')}`,
          detay: String((i.after as { gerekce?: string } | null)?.gerekce ?? ''),
          renk: '#7A5300',
        })),
    ];
    return sat
      .sort((a, b) => b.zaman.getTime() - a.zaman.getTime())
      .slice(0, 25)
      .map((x) => ({ ...x, zamanYazi: kisaTarih(x.zaman) }));
  }

  // ── İşlemler ──────────────────────────────────────────────────

  /** Kişisel veriyi açar (Karar 40): gerekçe işlem kaydına yazılır */
  async reveal(ctx: StaffCtx, tip: Tip, id: string, gerekce: string, ip?: string) {
    const h = await this.hedef(tip, id);
    const u = await this.db.user.findUniqueOrThrow({
      where: { id: h.userId },
      select: { phone: true, email: true },
    });
    await this.audit.record({
      actorType: 'STAFF',
      actorId: ctx.staff.id,
      action: 'kisisel_veri_acildi',
      entityType: tip === 'galeri' ? 'account' : 'user',
      entityId: id,
      after: { gerekce, alanlar: ['telefon', 'eposta'] },
      ip,
    });
    // Kapatılan hesabın kimlik kaydı yalnızca resmi talep sürecinde açılır (Karar 59)
    return { telefon: isClosedPhone(u.phone) ? 'Hesap kapatıldı' : u.phone, eposta: u.email ?? '—' };
  }

  async action(
    ctx: StaffCtx,
    tip: Tip,
    id: string,
    b: { karar: 'uyari' | 'aski' | 'engel'; gerekce: string },
    ip?: string,
  ) {
    const h = await this.hedef(tip, id);
    await this.moderation.cardAction(ctx, { userId: h.userId, accountId: h.accountId }, b, ip);
    return this.card(tip, id);
  }

  /**
   * Hak tanımlama (Karar 40, 52): Sahip ve Yönetici dışındaki çalışan bir hesaba ayda en çok 10 hak tanımlar; üstü
   * yönetici işidir. Hak defterine "tanimlama" olarak yazılır, kişiye uygulama içi bildirim gider.
   */
  async grant(
    ctx: StaffCtx,
    tip: Tip,
    id: string,
    b: { tur: GrantKind; adet: number; gerekce: string },
    ip?: string,
  ) {
    const h = await this.hedef(tip, id);
    const accountId = tip === 'galeri' ? id : (h as { kisiselHesap: string | null }).kisiselHesap;
    if (!accountId) throw new BadRequestException('Kişinin bireysel hesabı yok');
    if (
      (await this.db.account.findUnique({ where: { id: accountId }, select: { status: true } }))?.status ===
      'CLOSED'
    ) {
      throw new ConflictException('Kapatılan hesaba hak tanımlanamaz');
    }
    const yonetici = ctx.staff.role === 'OWNER' || ctx.staff.role === 'ADMIN';
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`hak-tanimla:${accountId}`}))`;
      if (!yonetici) {
        const ay = new Date(Date.now() - 30 * DAY);
        const verilen = await tx.entitlementLedger.aggregate({
          where: { accountId, reason: 'tanimlama', sourceType: 'staff_grant', createdAt: { gte: ay } },
          _sum: { delta: true },
        });
        if ((verilen._sum.delta ?? 0) + b.adet > GRANT_MONTHLY_LIMIT) {
          throw new ForbiddenException(
            `Bu hesaba son 30 günde ${verilen._sum.delta ?? 0} hak tanımlandı; ${GRANT_MONTHLY_LIMIT} üstü için yönetici gerekir`,
          );
        }
      }
      const kaynak = uuidv7();
      await tx.entitlementLedger.create({
        data: {
          accountId,
          kind: b.tur,
          delta: b.adet,
          reason: 'tanimlama',
          sourceType: 'staff_grant',
          sourceId: kaynak,
          createdBy: ctx.staff.id,
        },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: ctx.staff.id,
          action: 'hak_tanimlandi',
          entityType: tip === 'galeri' ? 'account' : 'user',
          entityId: id,
          after: { tur: b.tur, adet: b.adet, gerekce: b.gerekce, hesap: accountId },
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'hak.tanimlandi', { accountId, userId: h.userId, tur: b.tur, adet: b.adet });
    });
    return this.card(tip, id);
  }

  /** Bütün cihazlardaki oturumları kapatır (hesap güvenliği) */
  async revokeSessions(ctx: StaffCtx, tip: Tip, id: string, ip?: string) {
    const h = await this.hedef(tip, id);
    await this.db.$transaction(async (tx) => {
      const r = await tx.session.updateMany({
        where: { userId: h.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: ctx.staff.id,
          action: 'oturumlar_kapatildi',
          entityType: tip === 'galeri' ? 'account' : 'user',
          entityId: id,
          after: { oturum: r.count },
          ip,
        },
        tx,
      );
    });
    return this.card(tip, id);
  }

  async addNote(ctx: StaffCtx, tip: Tip, id: string, metin: string) {
    const h = await this.hedef(tip, id);
    await this.db.staffNote.create({
      data: {
        id: uuidv7(),
        userId: tip === 'kisi' ? h.userId : null,
        accountId: tip === 'galeri' ? id : null,
        staffId: ctx.staff.id,
        text: metin,
      },
    });
    return this.card(tip, id);
  }

  // ── Kara liste ────────────────────────────────────────────────

  async blocklist() {
    const rows = await this.db.blocklist.findMany({
      where: { removedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const ad = new Map(
      (
        await this.db.staffMember.findMany({
          where: { id: { in: [...new Set(rows.map((r) => r.createdBy))] } },
          select: { id: true, name: true },
        })
      ).map((s) => [s.id, s.name]),
    );
    return rows.map((r) => ({
      id: r.id,
      tur: r.kind,
      turAd: BLOCK_KINDS[r.kind as BlockKind],
      deger: r.masked,
      not: r.note,
      kim: ad.get(r.createdBy) ?? 'Çalışan',
      zaman: r.createdAt,
    }));
  }

  async blockAdd(
    ctx: StaffCtx,
    b: { tur: Exclude<BlockKind, 'cihaz'>; deger: string; not?: string },
    ip?: string,
  ) {
    const v = normalizeBlockValue(b.tur, b.deger);
    if (!v) throw new BadRequestException(`${BLOCK_KINDS[b.tur]} biçimi geçersiz`);
    const masked =
      b.tur === 'telefon'
        ? maskTel(v)
        : b.tur === 'iban'
          ? `TR•• •••• •••• •••• •••• ${v.slice(-4)}`
          : v.includes(':')
            ? `${v.split(':').slice(0, 2).join(':')}:…`
            : `${v.split('.').slice(0, 2).join('.')}.•.•`;
    const id = uuidv7();
    try {
      await this.db.$transaction(async (tx) => {
        await tx.blocklist.create({
          data: {
            id,
            kind: b.tur,
            valueHash: blockHash(this.env.JWT_SECRET, b.tur, v),
            masked,
            note: b.not || null,
            createdBy: ctx.staff.id,
          },
        });
        await this.audit.record(
          {
            actorType: 'STAFF',
            actorId: ctx.staff.id,
            action: 'kara_listeye_eklendi',
            entityType: 'blocklist',
            entityId: id,
            after: { tur: b.tur, deger: masked },
            ip,
          },
          tx,
        );
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Bu değer zaten kara listede');
      }
      throw e;
    }
    return this.blocklist();
  }

  /**
   * Giriş bağlantısı gönder (Karar 52; YonetimPazar.dc.html › "Giriş bağlantısı kişinin doğrulanmış e-postasına
   * gönderildi."): telefonuna ulaşamayan kişi web'den girer. Yalnızca doğrulanmış e-postaya; 15 dakika, tek kullanım;
   * yenisi eskileri geçersiz kılar; kişi başına günde en çok 3. Bağlantının kendisi saklanmaz, işlem kaydına girer.
   */
  async sendLoginLink(ctx: StaffCtx, tip: Tip, id: string, ip?: string) {
    const userId = tip === 'kisi' ? id : (await this.galeriOf(id)).sahipId;
    const u = await this.db.user.findUnique({
      where: { id: userId },
      select: { status: true, email: true, emailVerifiedAt: true, phone: true },
    });
    if (!u) throw new NotFoundException('Kullanıcı bulunamadı');
    if (u.status !== 'ACTIVE') throw new ConflictException('Hesap etkin değil');
    if (!u.email || !u.emailVerifiedAt) throw new ConflictException('Kişinin doğrulanmış e-postası yok');
    if (await karaListede(this.db, this.env.JWT_SECRET, 'telefon', [u.phone]))
      throw new ConflictException('Kişinin numarası kara listede');
    const gun = await this.db.loginLink.count({
      where: { userId, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    });
    if (gun >= LOGIN_LINK_PER_DAY)
      throw new ConflictException('Bu kişiye bugün en çok 3 giriş bağlantısı gönderilir');
    const kod = randomBytes(32).toString('base64url');
    await this.db.$transaction(async (tx) => {
      await tx.loginLink.updateMany({
        where: { userId, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.loginLink.create({
        data: {
          id: uuidv7(),
          userId,
          tokenHash: createHash('sha256').update(kod).digest('hex'),
          staffId: ctx.staff.id,
          expiresAt: new Date(Date.now() + LOGIN_LINK_MINUTES * 60_000),
        },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: ctx.staff.id,
          action: 'giris_baglantisi_gonderildi',
          entityType: 'user',
          entityId: userId,
          ip,
        },
        tx,
      );
    });
    await this.notifications.girisBaglantisi(userId, kod);
    return this.card(tip, id);
  }

  /** Kişinin cihazları (kişi kartı): platform, son giriş, kara listede mi; kurulum kimliği gösterilmez */
  private async cihazlar(userId: string) {
    const rows = await this.db.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      take: 10,
      select: { id: true, platform: true, lastSeenAt: true, createdAt: true, installHash: true },
    });
    const engelli = new Set(
      (
        await this.db.blocklist.findMany({
          where: {
            kind: 'cihaz',
            removedAt: null,
            valueHash: { in: rows.flatMap((d) => (d.installHash ? [d.installHash] : [])) },
          },
          select: { valueHash: true },
        })
      ).map((b) => b.valueHash),
    );
    return rows.map((d) => ({
      id: d.id,
      ad: { IOS: 'iPhone · uygulama', ANDROID: 'Android · uygulama', WEB: 'Tarayıcı' }[d.platform],
      sonGiris: d.lastSeenAt,
      ilkGiris: d.createdAt,
      // Kurulum kimliği yalnızca mobil uygulamadan gelir; tarayıcı cihazı kara listeye alınamaz
      engellenebilir: Boolean(d.installHash),
      karaListede: Boolean(d.installHash && engelli.has(d.installHash)),
    }));
  }

  /**
   * Cihaz kara listesi (Karar 43): kişinin kartındaki bir cihazın kurulum kimliği (özeti) kara listeye girer; o cihazdan
   * kod istenemez ve giriş yapılamaz, cihazdaki açık oturumlar kapanır. Çıkarma kara liste ekranından.
   */
  async blockDevice(ctx: StaffCtx, userId: string, deviceId: string, not: string | undefined, ip?: string) {
    const d = await this.db.device.findFirst({ where: { id: deviceId, userId } });
    if (!d) throw new NotFoundException('Cihaz bulunamadı');
    if (!d.installHash) throw new BadRequestException('Bu cihazın kurulum kimliği yok (tarayıcı)');
    const hash = d.installHash;
    const zaten = await this.db.blocklist.findFirst({
      where: { kind: 'cihaz', valueHash: hash, removedAt: null },
    });
    if (zaten) throw new ConflictException('Bu cihaz zaten kara listede');
    const id = uuidv7();
    const ad = { IOS: 'iPhone', ANDROID: 'Android', WEB: 'Tarayıcı' }[d.platform];
    await this.db.$transaction(async (tx) => {
      await tx.blocklist.create({
        data: {
          id,
          kind: 'cihaz',
          valueHash: hash,
          masked: `${ad} · ${kisaTarih(d.createdAt)} kurulumu`,
          note: not || null,
          createdBy: ctx.staff.id,
        },
      });
      // Aynı kurulumla açılmış bütün oturumlar (başka hesaplar dahil) kapanır
      const cihazlar = await tx.device.findMany({ where: { installHash: hash }, select: { id: true } });
      await tx.session.updateMany({
        where: { deviceId: { in: cihazlar.map((c) => c.id) }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: ctx.staff.id,
          action: 'kara_listeye_eklendi',
          entityType: 'blocklist',
          entityId: id,
          after: { tur: 'cihaz', kullanici: userId, cihaz: deviceId },
          ip,
        },
        tx,
      );
    });
    return this.cihazlar(userId);
  }

  async blockRemove(ctx: StaffCtx, id: string, ip?: string) {
    await this.db.$transaction(async (tx) => {
      const r = await tx.blocklist.updateMany({
        where: { id, removedAt: null },
        data: { removedAt: new Date(), removedBy: ctx.staff.id },
      });
      if (!r.count) throw new NotFoundException('Kayıt bulunamadı');
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: ctx.staff.id,
          action: 'kara_listeden_cikarildi',
          entityType: 'blocklist',
          entityId: id,
          ip,
        },
        tx,
      );
    });
    return this.blocklist();
  }

  /** Kart işlemlerinin yetkisi (konsol düğmeleri de buna göre açılır) */
  static izin(grants: PermissionGrants) {
    return {
      goster: satisfies(grants['kisisel_veri.gor'], 'maskeli'),
      uyari: satisfies(grants['sikayet.coz'], 'tam'),
      aski: satisfies(grants['hesap.askiya_al'], 'tam'),
      engel: ['tam', 'oneri'].includes(grants['hesap.kalici_engelle'] ?? ''),
      hak: satisfies(grants['hak.tanimla'], 'tam'),
      oturum: satisfies(grants['destek.yanitla'], 'tam') || satisfies(grants['hesap.askiya_al'], 'tam'),
      cihaz: satisfies(grants['sikayet.coz'], 'tam'),
      baglanti: satisfies(grants['destek.yanitla'], 'tam') || satisfies(grants['hesap.askiya_al'], 'tam'),
      sorumlu: satisfies(grants['galeri_basvuru.onayla'], 'tam'),
    };
  }
}

const galeriAdi = (y: object) =>
  (y as { sellerAccount?: { gallery: { displayName: string } | null } }).sellerAccount?.gallery
    ?.displayName ?? null;

/** Kart geçmişinde gösterilen çalışan işlemleri */
const ISLEM_AD: Record<string, string> = {
  kisisel_veri_acildi: 'Kişisel veri açıldı',
  hak_tanimlandi: 'Hak tanımlandı',
  oturumlar_kapatildi: 'Oturumlar kapatıldı',
};
