import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type MemberRole, uuidv7 } from '@rengarenk/db';
import {
  BUSINESS_KIND_DEFS,
  type BusinessKindKey,
  canInvite,
  GALLERY_PLANS,
  GALLERY_TRIAL,
  type GalleryPlanKey,
  INVITE_DAYS,
  MEMBER_ROLE_NAMES,
  maskTrMobile,
  memberLimit,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';

const DAY = 86_400_000;

/**
 * Galeri hesabı (Karar 12.5, 17, 20): panel bilgisi, herkese açık profil, çalışanlar ve davetler, deneme süresi.
 * Paketin hakları galerinin ortak havuzudur; kullanıcı sayısı pakete bağlıdır.
 */
@Injectable()
export class GalleryService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /** Kullanıcının üyesi olduğu galeriler (üst bilgide hesap seçici, mobilde galeri paneli) */
  async mine(userId: string) {
    const rows = await this.db.accountMember.findMany({
      where: { userId, account: { kind: 'BUSINESS', gallery: { isNot: null } } },
      include: { account: { include: { gallery: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({
      accountId: m.accountId,
      ad: m.account.name,
      slug: m.account.gallery?.slug,
      rol: m.role,
      durum: m.account.status,
    }));
  }

  /** Üyelik ve rol; üye değilse 404 (başka galerinin varlığı da sızmaz) */
  async membership(userId: string, accountId: string) {
    const m = await this.db.accountMember.findUnique({
      where: { accountId_userId: { accountId, userId } },
      include: { account: { include: { gallery: true } } },
    });
    if (!m?.account.gallery) throw new NotFoundException('Galeri bulunamadı');
    return { role: m.role, account: m.account, gallery: m.account.gallery };
  }

  private planOf(g: { plan: string; trialEndsAt: Date | null }) {
    const plan = g.plan as GalleryPlanKey;
    const kalan = g.trialEndsAt ? Math.ceil((g.trialEndsAt.getTime() - Date.now()) / DAY) : null;
    const ozellik = plan === 'deneme' ? GALLERY_TRIAL : GALLERY_PLANS[plan];
    return {
      key: plan,
      ad: plan === 'deneme' ? 'Deneme' : GALLERY_PLANS[plan].ad,
      denemeBitis: g.trialEndsAt,
      denemeKalanGun: plan === 'deneme' && kalan !== null ? Math.max(0, kalan) : null,
      // Deneme bitti ve paket seçilmediyse galeri yalnızca portföyünü görüntüler (Karar 12.5)
      saltOkunur: plan === 'deneme' && kalan !== null && kalan <= 0,
      portfoy: ozellik.portfoy,
      gunlukMesaj: ozellik.gunlukMesaj,
      calisan: memberLimit(plan),
    };
  }

  /** Galeri paneli özeti (GaleriPanel.dc.html): galeri, paket ve deneme, ekip */
  async panel(userId: string, accountId: string) {
    const { role, account, gallery: g } = await this.membership(userId, accountId);
    const [members, invites] = await Promise.all([
      this.db.accountMember.findMany({
        where: { accountId },
        include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.db.accountInvite.findMany({
        where: { accountId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return {
      accountId,
      durum: account.status,
      rol: role,
      galeri: this.publicView(g),
      // Yalnızca sahip ve yönetici fatura bilgilerini görür
      isletme:
        role === 'SALES'
          ? null
          : {
              unvan: g.legalName,
              vergiNo: g.taxNo,
              vergiDairesi: g.taxOffice,
              mersis: g.mersisNo,
              adres: g.address,
            },
      paket: this.planOf(g),
      ekip: members.map((m) => ({
        userId: m.userId,
        ad: [m.user.firstName, m.user.lastName].filter(Boolean).join(' ') || 'Adsız üye',
        telefon: maskTrMobile(m.user.phone),
        rol: m.role,
        rolAd: MEMBER_ROLE_NAMES[m.role],
        sen: m.userId === userId,
        eklendi: m.createdAt,
      })),
      davetler:
        role === 'SALES'
          ? []
          : invites.map((i) => ({
              id: i.id,
              telefon: maskTrMobile(i.phone),
              rol: i.role,
              rolAd: MEMBER_ROLE_NAMES[i.role],
              bitis: i.expiresAt,
            })),
    };
  }

  private publicView(g: {
    slug: string;
    displayName: string;
    legalName: string;
    businessKind: string;
    il: string;
    ilce: string;
    authorityNo: string | null;
    about: string | null;
    workingHours: string | null;
    approvedAt: Date;
  }) {
    return {
      slug: g.slug,
      ad: g.displayName,
      // Yönetmelik m.21: ilanda işletme adı ve yetki belgesi numarası
      isletmeAdi: g.legalName,
      yetkiNo: g.authorityNo,
      tur: BUSINESS_KIND_DEFS[g.businessKind as BusinessKindKey].kisa,
      alan: BUSINESS_KIND_DEFS[g.businessKind as BusinessKindKey].alan,
      il: g.il,
      ilce: g.ilce,
      hakkinda: g.about,
      calismaSaatleri: g.workingHours,
      uyelik: g.approvedAt,
    };
  }

  /** Herkese açık galeri profili; askıdaki ya da kapalı galeri görünmez */
  async publicProfile(slug: string) {
    const g = await this.db.gallery.findUnique({
      where: { slug },
      include: { account: { select: { status: true } } },
    });
    if (g?.account.status !== 'ACTIVE') throw new NotFoundException('Galeri bulunamadı');
    const satis = await this.db.accountMember.count({ where: { accountId: g.accountId, role: 'SALES' } });
    return {
      ...this.publicView(g),
      // İşletme adresi profilde görünür (GaleriProfil.dc.html); vergi ve MERSİS bilgisi görünmez
      adres: g.address,
      satisTemsilcisi: satis,
      portfoy: { toplam: 0, araclar: [] as unknown[] },
    };
  }

  async updateProfile(
    userId: string,
    accountId: string,
    input: { gorunenAd?: string; hakkinda?: string | null; calismaSaatleri?: string | null },
    ip?: string,
  ) {
    const { role, gallery: g } = await this.membership(userId, accountId);
    if (role === 'SALES') throw new ForbiddenException('Profili sahip ya da yönetici değiştirebilir');
    const data = {
      ...(input.gorunenAd ? { displayName: input.gorunenAd } : {}),
      ...(input.hakkinda !== undefined ? { about: input.hakkinda || null } : {}),
      ...(input.calismaSaatleri !== undefined ? { workingHours: input.calismaSaatleri || null } : {}),
    };
    await this.db.$transaction(async (tx) => {
      await tx.gallery.update({ where: { accountId }, data });
      if (input.gorunenAd)
        await tx.account.update({ where: { id: accountId }, data: { name: input.gorunenAd } });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'galeri_profil_guncellendi',
          entityType: 'gallery',
          entityId: accountId,
          before: { displayName: g.displayName, about: g.about, workingHours: g.workingHours },
          after: data,
          ip,
        },
        tx,
      );
    });
    return this.panel(userId, accountId);
  }

  // ── Çalışanlar (Karar 20) ─────────────────────────────────────

  private async seats(accountId: string) {
    const [uye, davet] = await Promise.all([
      this.db.accountMember.count({ where: { accountId } }),
      this.db.accountInvite.count({
        where: { accountId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      }),
    ]);
    return uye + davet;
  }

  async invite(userId: string, accountId: string, phone: string, role: 'MANAGER' | 'SALES', ip?: string) {
    const { role: by, account, gallery: g } = await this.membership(userId, accountId);
    if (account.status !== 'ACTIVE') throw new ConflictException('Galeri hesabı askıda');
    if (!canInvite(by, role)) throw new ForbiddenException('Bu rolde çalışan ekleme yetkin yok');
    const limit = memberLimit(g.plan as GalleryPlanKey);
    if ((await this.seats(accountId)) >= limit) {
      throw new ConflictException(`Paketinde en çok ${limit} kullanıcı olabilir`);
    }
    const existing = await this.db.accountMember.findFirst({ where: { accountId, user: { phone } } });
    if (existing) throw new ConflictException('Bu numara zaten ekipte');
    const id = uuidv7();
    await this.db.$transaction(async (tx) => {
      // Aynı numaraya açık davet varsa yenisi onun yerine geçer
      await tx.accountInvite.updateMany({
        where: { accountId, phone, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.accountInvite.create({
        data: {
          id,
          accountId,
          phone,
          role,
          invitedBy: userId,
          expiresAt: new Date(Date.now() + INVITE_DAYS * DAY),
        },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'galeri_davet_edildi',
          entityType: 'account_invite',
          entityId: id,
          after: { accountId, role },
          ip,
        },
        tx,
      );
      // Davet edilen numaraya SMS bildirim katmanıyla gider (Aşama 7)
      await this.outbox.add(tx, 'galeri.davet_edildi', { inviteId: id, accountId });
    });
    return this.panel(userId, accountId);
  }

  async revokeInvite(userId: string, accountId: string, inviteId: string, ip?: string) {
    const { role } = await this.membership(userId, accountId);
    const inv = await this.db.accountInvite.findFirst({
      where: { id: inviteId, accountId, acceptedAt: null, revokedAt: null },
    });
    if (!inv) throw new NotFoundException('Davet bulunamadı');
    if (!canInvite(role, inv.role)) throw new ForbiddenException('Bu daveti iptal etme yetkin yok');
    await this.db.$transaction(async (tx) => {
      await tx.accountInvite.update({ where: { id: inv.id }, data: { revokedAt: new Date() } });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'galeri_davet_iptal',
          entityType: 'account_invite',
          entityId: inv.id,
          ip,
        },
        tx,
      );
    });
    return this.panel(userId, accountId);
  }

  /** Rol değiştirme yalnızca sahipte; sahiplik devri ayrı akıştır (kapsam dışı değil, konsoldan) */
  async changeRole(
    userId: string,
    accountId: string,
    memberId: string,
    role: 'MANAGER' | 'SALES',
    ip?: string,
  ) {
    const { role: by } = await this.membership(userId, accountId);
    if (by !== 'OWNER') throw new ForbiddenException('Rolü yalnızca hesap sahibi değiştirebilir');
    const m = await this.db.accountMember.findUnique({
      where: { accountId_userId: { accountId, userId: memberId } },
    });
    if (!m) throw new NotFoundException('Çalışan bulunamadı');
    if (m.role === 'OWNER') throw new ConflictException('Hesap sahibinin rolü değiştirilemez');
    await this.db.$transaction(async (tx) => {
      await tx.accountMember.update({
        where: { accountId_userId: { accountId, userId: memberId } },
        data: { role },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'galeri_rol_degisti',
          entityType: 'account_member',
          entityId: `${accountId}:${memberId}`,
          before: { role: m.role },
          after: { role },
          ip,
        },
        tx,
      );
    });
    return this.panel(userId, accountId);
  }

  /** Çalışanı çıkarır: sahip herkesi, yönetici satış temsilcisini; sahip çıkarılamaz */
  async removeMember(userId: string, accountId: string, memberId: string, ip?: string) {
    const { role: by } = await this.membership(userId, accountId);
    const m = await this.db.accountMember.findUnique({
      where: { accountId_userId: { accountId, userId: memberId } },
    });
    if (!m) throw new NotFoundException('Çalışan bulunamadı');
    if (m.role === 'OWNER') throw new ConflictException('Hesap sahibi çıkarılamaz');
    if (!canInvite(by, m.role) && memberId !== userId)
      throw new ForbiddenException('Bu çalışanı çıkarma yetkin yok');
    await this.db.$transaction(async (tx) => {
      await tx.accountMember.delete({ where: { accountId_userId: { accountId, userId: memberId } } });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'galeri_calisan_cikarildi',
          entityType: 'account_member',
          entityId: `${accountId}:${memberId}`,
          before: { role: m.role },
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'galeri.calisan_cikarildi', { accountId, userId: memberId });
    });
  }

  // ── Davet edilen kullanıcı ────────────────────────────────────

  async myInvites(userId: string) {
    const u = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true } });
    const rows = await this.db.accountInvite.findMany({
      where: {
        phone: u.phone,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        account: { status: 'ACTIVE' },
      },
      include: { account: { include: { gallery: { select: { displayName: true, slug: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((i) => ({
      id: i.id,
      galeri: i.account.gallery?.displayName ?? i.account.name,
      slug: i.account.gallery?.slug,
      rol: i.role,
      rolAd: MEMBER_ROLE_NAMES[i.role],
      bitis: i.expiresAt,
    }));
  }

  async respond(userId: string, inviteId: string, accept: boolean, ip?: string) {
    const u = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true } });
    const inv = await this.db.accountInvite.findFirst({
      where: {
        id: inviteId,
        phone: u.phone,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { account: { include: { gallery: true } } },
    });
    if (!inv?.account.gallery) throw new NotFoundException('Davet bulunamadı ya da süresi doldu');
    if (accept) {
      const already = await this.db.accountMember.findUnique({
        where: { accountId_userId: { accountId: inv.accountId, userId } },
      });
      if (already) throw new ConflictException('Zaten bu galerinin ekibindesin');
      // Davet koltuğu zaten sayılıydı; kabul edince üyeye dönüşür
    }
    await this.db.$transaction(async (tx) => {
      await tx.accountInvite.update({
        where: { id: inv.id },
        data: accept ? { acceptedAt: new Date() } : { revokedAt: new Date() },
      });
      if (accept) {
        await tx.accountMember.create({
          data: { accountId: inv.accountId, userId, role: inv.role as MemberRole },
        });
      }
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: accept ? 'galeri_davet_kabul' : 'galeri_davet_ret',
          entityType: 'account_invite',
          entityId: inv.id,
          ip,
        },
        tx,
      );
      if (accept) await this.outbox.add(tx, 'galeri.calisan_eklendi', { accountId: inv.accountId, userId });
    });
    return accept ? { accountId: inv.accountId, slug: inv.account.gallery.slug } : null;
  }

  // ── Deneme süresi (Karar 12.5) ────────────────────────────────

  /** Bitişe 7, 3 ve 1 gün kala paket seçme hatırlatması; biten deneme için olay. İşçi çalıştırır. */
  async remindTrials() {
    const now = Date.now();
    const rows = await this.db.gallery.findMany({
      where: { plan: 'deneme', trialEndsAt: { not: null }, account: { status: 'ACTIVE' } },
      select: { accountId: true, trialEndsAt: true, trialReminderDays: true },
    });
    let n = 0;
    for (const g of rows) {
      const kalan = Math.ceil(((g.trialEndsAt as Date).getTime() - now) / DAY);
      // Artan sırayla: 2 gün kalan galeriye yalnızca 3 günlük hatırlatma gider, 7 günlük ayrıca gitmez
      const esik = [...GALLERY_TRIAL.hatirlatmaGunleri, 0].sort((a, b) => a - b).find((d) => kalan <= d);
      if (esik === undefined || g.trialReminderDays.includes(esik)) continue;
      await this.db.$transaction(async (tx) => {
        const r = await tx.gallery.updateMany({
          where: { accountId: g.accountId, NOT: { trialReminderDays: { has: esik } } },
          data: { trialReminderDays: { push: esik } },
        });
        if (r.count !== 1) return;
        await this.outbox.add(tx, esik === 0 ? 'galeri.deneme_bitti' : 'galeri.deneme_bitiyor', {
          accountId: g.accountId,
          kalanGun: esik,
        });
        n++;
      });
    }
    return n;
  }
}
