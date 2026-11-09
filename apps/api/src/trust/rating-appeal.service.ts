import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, uuidv7 } from '@rengarenk/db';
import {
  maskEvidence,
  RATING_APPEAL_DAYS,
  RATING_APPEAL_REVIEW_DAYS,
  type RatingFlag,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { SecretBox } from '../staff/secret-box.js';
import { TrustService } from './trust.service.js';

const DAY = 86_400_000;
const sure = (dk: number) =>
  dk < 60
    ? `${Math.max(1, Math.round(dk))} dk`
    : dk < 48 * 60
      ? `${Math.round(dk / 60)} saat`
      : `${Math.round(dk / 1440)} gün`;

interface StaffCtx {
  staff: { id: string };
}

/**
 * Galerinin 1 yıldıza itirazı (Karar 55; YonetimPazar.dc.html › İtirazlar "Hızlı Oto · 1 yıldıza itiraz"). Galerinin
 * sahibi ya da yöneticisi yıldızdan sonraki 30 gün içinde bir kez itiraz eder; yıldızı verenin kimliği galeriye
 * gösterilmez. Moderatör sohbetin kanıtını (zamanlama, mesaj sayıları, maskeli son mesajlar) görür; kabulde yıldız
 * `itiraz` işaretiyle hesaptan çıkar ve göstergeler yenilenir, redde yıldız kalır. Sonuç galeriye bildirilir.
 */
@Injectable()
export class RatingAppealService {
  private readonly box: SecretBox;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) env: Env,
    private readonly trust: TrustService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {
    this.box = SecretBox.forMessages(env);
  }

  private async yonetici(userId: string, accountId: string) {
    const m = await this.db.accountMember.findUnique({
      where: { accountId_userId: { accountId, userId } },
      include: { account: { select: { gallery: { select: { accountId: true } } } } },
    });
    if (!m?.account.gallery) throw new NotFoundException('Galeri bulunamadı');
    return m;
  }

  /** Galeri paneli: son 30 günün 1 yıldızları ve itiraz durumu (kimin verdiği gösterilmez) */
  async list(userId: string, accountId: string) {
    const m = await this.yonetici(userId, accountId);
    const sinir = new Date(Date.now() - RATING_APPEAL_DAYS * DAY);
    const rows = await this.db.rating.findMany({
      where: {
        sellerAccountId: accountId,
        stars: 1,
        OR: [{ createdAt: { gte: sinir } }, { appeal: { isNot: null } }],
      },
      include: { appeal: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const yetkili = m.role === 'OWNER' || m.role === 'MANAGER';
    return {
      yetkili,
      gun: RATING_APPEAL_DAYS,
      yildizlar: rows
        .filter((r) => r.appeal || r.counted)
        .map((r) => {
          const son = new Date(r.createdAt.getTime() + RATING_APPEAL_DAYS * DAY);
          return {
            id: r.id,
            tarih: r.createdAt,
            sayiliyor: r.counted,
            itirazSonu: son,
            itirazEdebilir: yetkili && !r.appeal && r.counted && son > new Date(),
            itiraz: r.appeal
              ? {
                  durum: r.appeal.status,
                  metin: r.appeal.text,
                  sonuc: r.appeal.decisionNote,
                  zaman: r.appeal.createdAt,
                  karar: r.appeal.decidedAt,
                }
              : null,
          };
        }),
    };
  }

  async appeal(userId: string, accountId: string, ratingId: string, metin: string, ip?: string) {
    const m = await this.yonetici(userId, accountId);
    if (m.role !== 'OWNER' && m.role !== 'MANAGER')
      throw new ForbiddenException('İtirazı galerinin sahibi ya da yöneticisi yapar');
    const r = await this.db.rating.findUnique({ where: { id: ratingId }, include: { appeal: true } });
    if (!r || r.sellerAccountId !== accountId || r.stars !== 1)
      throw new NotFoundException('Yıldız bulunamadı');
    if (r.appeal) throw new ConflictException('Bu yıldıza zaten itiraz ettin');
    if (!r.counted) throw new ConflictException('Bu yıldız zaten hesaba katılmıyor');
    if (r.createdAt.getTime() + RATING_APPEAL_DAYS * DAY < Date.now())
      throw new ConflictException(`İtiraz yıldızdan sonraki ${RATING_APPEAL_DAYS} gün içinde yapılır`);
    const id = uuidv7();
    try {
      await this.db.$transaction(async (tx) => {
        await tx.ratingAppeal.create({
          data: {
            id,
            ratingId,
            accountId,
            userId,
            text: metin,
            dueAt: new Date(Date.now() + RATING_APPEAL_REVIEW_DAYS * DAY),
          },
        });
        await this.audit.record(
          {
            actorType: 'USER',
            actorId: userId,
            action: 'yildiz_itiraz_acildi',
            entityType: 'rating',
            entityId: ratingId,
            ip,
          },
          tx,
        );
        await this.outbox.add(tx, 'yildiz.itiraz_acildi', { appealId: id, accountId });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
        throw new ConflictException('Bu yıldıza zaten itiraz ettin');
      throw err;
    }
    return this.list(userId, accountId);
  }

  /** Sohbetin kanıtı: zamanlama ve mesaj sayıları, maskeli son mesajlar */
  private async kanit(conversationId: string, yildizZamani: Date) {
    const mesajlar = await this.db.message.findMany({
      where: { conversationId, kind: { not: 'sistem' } },
      orderBy: { createdAt: 'asc' },
      select: { side: true, kind: true, body: true, createdAt: true },
    });
    const alici = mesajlar.filter((x) => x.side === 'alici');
    const satici = mesajlar.filter((x) => x.side === 'satici');
    const son = mesajlar.at(-1);
    const ozet = [
      `Sohbette alıcı ${alici.length}, galeri ${satici.length} mesaj yazdı`,
      son
        ? `yıldız son mesajdan ${sure((yildizZamani.getTime() - son.createdAt.getTime()) / 60_000)} sonra verildi`
        : '',
    ]
      .filter(Boolean)
      .join('; ');
    const acik = (b: string) => {
      try {
        return maskEvidence(this.box.open(b));
      } catch {
        return '(okunamadı)';
      }
    };
    return {
      ozet,
      mesajlar: mesajlar.slice(-6).map((x) => ({
        taraf: x.side === 'alici' ? 'Alıcı' : 'Galeri',
        metin: x.kind === 'kart' ? 'Araç kartı' : acik(x.body),
        zaman: x.createdAt,
      })),
    };
  }

  /** Konsol › Moderasyon › İtirazlar: açıklar ve son 30 günün sonuçlananları */
  async staffList() {
    const rows = await this.db.ratingAppeal.findMany({
      where: { OR: [{ status: 'acik' }, { decidedAt: { gte: new Date(Date.now() - 30 * DAY) } }] },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      include: { rating: { include: { buyer: { select: { createdAt: true } } } } },
      take: 100,
    });
    const [galeriler, kisiler] = await Promise.all([
      this.db.gallery.findMany({
        where: { accountId: { in: rows.map((a) => a.accountId) } },
        select: { accountId: true, displayName: true },
      }),
      this.db.staffMember.findMany({
        where: { id: { in: rows.flatMap((a) => (a.decidedByStaffId ? [a.decidedByStaffId] : [])) } },
        select: { id: true, name: true },
      }),
    ]);
    const galeri = new Map(galeriler.map((g) => [g.accountId, g.displayName]));
    const kisi = new Map(kisiler.map((k) => [k.id, k.name]));
    return Promise.all(
      rows.map(async (a) => {
        const k = await this.kanit(a.rating.conversationId, a.rating.createdAt);
        const hesapGun = Math.max(
          0,
          Math.floor((a.rating.createdAt.getTime() - a.rating.buyer.createdAt.getTime()) / DAY),
        );
        return {
          id: a.id,
          ad: `${galeri.get(a.accountId) ?? 'Galeri'} · 1 yıldıza itiraz`,
          metin: maskEvidence(a.text),
          kanit: `${k.ozet}; yıldız verildiğinde alıcının hesabı ${hesapGun ? `${hesapGun} günlüktü` : 'o gün açılmıştı'}`,
          mesajlar: k.mesajlar,
          durum: a.status,
          sonuc: a.decisionNote,
          inceleyen: a.decidedByStaffId ? (kisi.get(a.decidedByStaffId) ?? 'Çalışan') : null,
          sonGun: a.dueAt,
          zaman: a.createdAt,
        };
      }),
    );
  }

  async decide(ctx: StaffCtx, id: string, b: { kabul: boolean; not?: string }, ip?: string) {
    const a = await this.db.ratingAppeal.findUnique({ where: { id }, include: { rating: true } });
    if (!a) throw new NotFoundException('İtiraz bulunamadı');
    if (a.status !== 'acik') throw new ConflictException('İtiraz zaten sonuçlandı');
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      const k = await tx.ratingAppeal.updateMany({
        where: { id, status: 'acik' },
        data: {
          status: b.kabul ? 'kabul' : 'red',
          decidedByStaffId: ctx.staff.id,
          decisionNote: b.not || null,
          decidedAt: now,
        },
      });
      if (!k.count) throw new ConflictException('İtiraz zaten sonuçlandı');
      if (b.kabul) {
        await tx.rating.update({
          where: { id: a.ratingId },
          data: { counted: false, flag: 'itiraz' satisfies RatingFlag },
        });
      }
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: ctx.staff.id,
          action: b.kabul ? 'yildiz_itiraz_kabul' : 'yildiz_itiraz_red',
          entityType: 'rating',
          entityId: a.ratingId,
          ip,
        },
        tx,
      );
      await this.outbox.add(tx, 'yildiz.itiraz_sonuc', { appealId: id, accountId: a.accountId });
    });
    if (b.kabul) await this.trust.recompute(a.accountId);
    return this.staffList();
  }
}
