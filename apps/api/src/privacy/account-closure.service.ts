import { ConflictException, Inject, Injectable, Optional } from '@nestjs/common';
import { type Prisma, uuidv7 } from '@rengarenk/db';
import { CLOSED_KEEP, type CloseReason, closedPhone, shortName } from '@rengarenk/shared';
import { ajanAktor } from '../approvals/agent-actor.js';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from '../auth/auth.service.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { RefundsService } from '../refunds/refunds.service.js';
import { SecretBox } from '../staff/secret-box.js';

const YIL = 365 * 86_400_000;

/**
 * Hesap kapatma ve anonimleştirme (Karar 31, 39, 59; Ayarlar.dc.html › Hesap). SMS koduyla onaylanır ve tek işlemde:
 *
 * - Yayındaki ve taslak talepler kapanır, araçlar yayından kalkar; sohbetler karşı tarafta "Kapatılmış hesap" görünür.
 * - Ad, e-posta, telefon, cihaz anahtarları, favoriler, kayıtlı aramalar, takipler, engeller ve bildirim metinleri silinir;
 *   telefon alanına yer tutucu yazılır, numara serbest kalır.
 * - Kimlik ve telefon doğrulama kaydı MKTTY m.22 gereği 5 yıl şifreli saklanır (`account_closures`); mesajlar 1 yıl sonra,
 *   fatura ve ödeme kayıtları 10 yıl sonra imha listesine girer. Rıza, işlem ve hak defteri kayıtları değişmez.
 * - Web'den alınıp kullanılmamış hakların iadesi yalnızca öneridir: ajan her sipariş için onay kuyruğunda REFUND açar,
 *   iadeyi yalnızca Sahip onaylar (sahip kararı, 9 Kasım 2026). Para iadesi burada yapılmaz, iade kilidi değişmez.
 */
@Injectable()
export class AccountClosureService {
  private readonly box: SecretBox;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) env: Env,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly refunds: RefundsService,
    @Optional() private readonly auth?: AuthService,
  ) {
    this.box = SecretBox.fromEnv(env);
  }

  private async bireysel(userId: string) {
    const m = await this.db.accountMember.findFirst({
      where: { userId, role: 'OWNER', account: { kind: 'INDIVIDUAL' } },
      select: { accountId: true },
    });
    return m?.accountId ?? null;
  }

  /** Kapatmayı engelleyen durum: galeri sahipliği ya da süren askı */
  private async engel(userId: string): Promise<string | null> {
    const galeri = await this.db.accountMember.count({
      where: { userId, role: 'OWNER', account: { kind: 'BUSINESS', status: { not: 'CLOSED' } } },
    });
    if (galeri) {
      return 'Galeri hesabının sahibi olduğun için hesabını buradan kapatamazsın. Galerinin kapatılması ya da devri için destek talebi aç.';
    }
    // Süren askı (moderasyondaki kuralla aynı): süresi bitmemiş ya da kalıcı engel onayı süren
    const now = new Date();
    const askilar = await this.db.userSanction.findMany({
      where: { userId, kind: 'aski', liftedAt: null },
      select: { until: true, approvalId: true },
    });
    const onaylar = askilar.flatMap((a) => (a.approvalId ? [a.approvalId] : []));
    const suren =
      askilar.some((a) => a.until && a.until > now) ||
      (onaylar.length > 0 &&
        (await this.db.approval.count({
          where: { id: { in: onaylar }, status: { in: ['PENDING', 'APPROVED'] } },
        })) > 0);
    if (suren) return 'Hesabın askıdayken kapatılamaz. Askı bittikten sonra yeniden dene.';
    return null;
  }

  /** Ayarlar › Hesap: kapatınca ne olacağı ve iade önerisi */
  async preview(userId: string) {
    const hesap = await this.bireysel(userId);
    const q = hesap
      ? await this.refunds.closureQuote(hesap)
      : { satirlar: [], toplamKurus: 0, magaza: false, iadeler: [] };
    return {
      engel: await this.engel(userId),
      iade: { satirlar: q.satirlar, toplamKurus: q.toplamKurus },
      magaza: q.magaza,
    };
  }

  async close(userId: string, b: { challengeId: string; code: string; neden?: CloseReason }, ip?: string) {
    const engel = await this.engel(userId);
    if (engel) throw new ConflictException(engel);
    if (!this.auth) throw new Error('Kimlik doğrulama bu süreçte yok');
    await this.auth.confirmCode(userId, b.challengeId, b.code);

    const u = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    if (u.status === 'CLOSED') throw new ConflictException('Hesap zaten kapatıldı');
    const hesap = await this.bireysel(userId);
    const q = hesap ? await this.refunds.closureQuote(hesap) : null;
    const ajan = q?.iadeler.length ? await ajanAktor(this.db) : null;
    const now = new Date();
    const musteri = shortName(u.firstName, u.lastName);

    const sonuc = await this.db.$transaction(async (tx) => {
      // Yarışta ikinci kapatma: satır kilitlenir
      const r = await tx.user.updateMany({
        where: { id: userId, status: { not: 'CLOSED' } },
        data: {
          status: 'CLOSED',
          phone: closedPhone(userId),
          firstName: null,
          lastName: null,
          displayName: null,
          email: null,
          emailVerifiedAt: null,
        },
      });
      if (r.count !== 1) throw new ConflictException('Hesap zaten kapatıldı');

      const iadeler = q && ajan ? await this.refunds.requestForClosure(tx, ajan, musteri, q.iadeler, ip) : [];
      await tx.accountClosure.create({
        data: {
          id: uuidv7(),
          userId,
          reason: b.neden ?? null,
          phoneEnc: this.box.seal(u.phone),
          phoneHash: this.box.digest(u.phone),
          phoneVerifiedAt: u.phoneVerifiedAt,
          refundKurus: BigInt(iadeler.reduce((t, i) => t + i.kurus, 0)),
          refunds: iadeler,
          keepIdentityUntil: new Date(now.getTime() + CLOSED_KEEP.kimlikYil * YIL),
          purgeMessagesAt: new Date(now.getTime() + CLOSED_KEEP.mesajYil * YIL),
          closedAt: now,
        },
      });

      // Talepler kapanır, aramadan ve eşleşmeden kalkar
      const talepler = await tx.demand.findMany({
        where: { userId, status: { in: ['DRAFT', 'PUBLISHED', 'PASSIVE'] } },
        select: { id: true, no: true, status: true, data: true },
      });
      for (const d of talepler) {
        const data = (d.data ?? {}) as { alanlar?: Record<string, unknown> };
        const { aciklama: _a, ...alanlar } = data.alanlar ?? {};
        await tx.demand.update({
          where: { id: d.id },
          data: {
            status: 'CLOSED',
            closedAt: now,
            headline: null,
            data: { ...data, alanlar } as Prisma.InputJsonValue,
          },
        });
        await tx.demandEvent.create({
          data: { demandId: d.id, type: 'kapatildi', userId, data: { neden: 'hesap_kapatildi' } },
        });
        await this.outbox.add(tx, 'talep.kapandi', { demandId: d.id, no: Number(d.no), userId });
      }
      // Kapanmış taleplerdeki serbest metin de silinir
      await tx.demand.updateMany({ where: { userId, headline: { not: null } }, data: { headline: null } });

      // Bireysel satıcı araçları yayından kalkar
      if (hesap) {
        const araclar = await tx.portfolioVehicle.findMany({
          where: { accountId: hesap, status: { in: ['PUBLISHED', 'PENDING_EIDS', 'DRAFT'] } },
          select: { id: true },
        });
        for (const v of araclar) {
          await tx.portfolioVehicle.update({
            where: { id: v.id },
            data: { status: 'PASSIVE', passiveAt: now },
          });
          await this.outbox.add(tx, 'portfoy.kalkti', { vehicleId: v.id });
        }
        await tx.account.update({ where: { id: hesap }, data: { status: 'CLOSED' } });
      }
      // Galeri ekibinden çıkar (sahiplik engelde denetlendi)
      await tx.accountMember.deleteMany({ where: { userId, role: { not: 'OWNER' } } });

      // Oturumlar, cihazlar, tercihler ve kişisel listeler
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
      await tx.device.updateMany({ where: { userId }, data: { pushToken: null } });
      await tx.pushToken.deleteMany({ where: { userId } });
      await tx.favorite.deleteMany({ where: { userId } });
      await tx.savedSearch.deleteMany({ where: { userId } });
      await tx.galleryFollow.deleteMany({ where: { userId } });
      await tx.userBlock.deleteMany({ where: { userId } });
      await tx.notificationPref.deleteMany({ where: { userId } });
      await tx.notification.updateMany({ where: { userId }, data: { baslik: '', metin: '' } });
      await tx.delivery.updateMany({ where: { userId }, data: { hedef: null, veri: {} } });
      await tx.rating.updateMany({ where: { buyerUserId: userId }, data: { fingerprint: null } });
      await tx.supportTicket.updateMany({ where: { userId }, data: { email: null } });
      await tx.dataExport.updateMany({
        where: { userId, status: { in: ['hazirlaniyor', 'hazir'] } },
        data: { status: 'suresi_doldu' },
      });

      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'hesap_kapatildi',
          entityType: 'user',
          entityId: userId,
          after: {
            neden: b.neden ?? null,
            talep: talepler.length,
            iadeOnerisiKurus: iadeler.reduce((t, i) => t + i.kurus, 0),
            iadeIstegi: iadeler.length,
          },
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'hesap.kapatildi', {
        userId,
        iadeKurus: iadeler.reduce((t, i) => t + i.kurus, 0),
      });
      return { iadeKurus: iadeler.reduce((t, i) => t + i.kurus, 0), iadeIstegi: iadeler.length };
    });
    return { kapandi: true, ...sonuc };
  }
}
