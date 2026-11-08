import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma, uuidv7 } from '@rengarenk/db';
import {
  DISPOSAL_KIND_KEYS,
  DISPOSAL_KINDS,
  type DisposalKind,
  disposalNo,
  nextDisposalDate,
  RETENTION_DAYS,
  RETENTION_RULES,
  VERBIS_THRESHOLDS,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { STORAGE, type Storage } from '../storage/storage.service.js';

const DAY = 86_400_000;
const IMHA = 'imha edildi';
/** Bir imhada kalem başına en çok işlenen kayıt; kalanı sonraki çalıştırmaya kalır */
const PARTI = 50_000;

type Sayim = Record<DisposalKind, number>;

/**
 * Saklama ve periyodik imha (Karar 59; YonetimSistem.dc.html › imha). Ajan (işçi) her gün süresi dolan kayıtları sayar;
 * Sahip listeyi onaylar; işçi dönem gününde (1 Ocak ve 1 Temmuz, 03.00) imha eder ve tutanağı yazar.
 *
 * - Sohbetler: kapanıştan (son mesajdan) 1 yıl sonra mesajlar silinir; talep kapanmış, araç kalkmış ya da bir taraf hesabını
 *   kapatmış olmalı. Şikâyet edilen mesajı olan sohbet ve resmi talebi süren kişinin sohbeti bekletilir.
 * - Hesap artığı: kapatılan hesabın şifreli kimlik ve telefon kaydı 5 yıl sonra silinir (MKTTY m.22).
 * - Erişim kaydı: SMS kodu, oturum ve konsol girişi kayıtları 2 yıl sonra silinir (5651).
 * - Destek talebi 1 yıl, KVKK başvurusu 3 yıl, fatura bilgisi 10 yıl sonra metinleri silinerek anonimleşir (satır kalır).
 * - Yalnızca ekleme yapılan tablolar (işlem kaydı, hak defteri, rıza kayıtları) burada değiştirilmez.
 */
@Injectable()
export class RetentionService {
  private readonly log = new Logger('Imha');

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(STORAGE) private readonly storage: Storage,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /** Bekletilen kişi ve hesaplar: resmi talebi süren (son 2 yıl, reddedilmemiş) */
  private async bekletilen(now: Date) {
    const resmi = await this.db.officialRequest.findMany({
      where: { status: { not: 'reddedildi' }, createdAt: { gte: new Date(now.getTime() - 2 * 365 * DAY) } },
      select: { userId: true, accountId: true },
    });
    return {
      kisiler: new Set(resmi.flatMap((r) => (r.userId ? [r.userId] : []))),
      hesaplar: new Set(resmi.flatMap((r) => (r.accountId ? [r.accountId] : []))),
    };
  }

  /** Kalem başına imha adayları (kimlikler) ve bekletilen sayısı */
  private async adaylar(now: Date) {
    const once = (gun: number) => new Date(now.getTime() - gun * DAY);
    const hold = await this.bekletilen(now);

    // Sohbetler
    const sohbetler = await this.db.conversation.findMany({
      where: {
        lastMessageAt: { lt: once(RETENTION_DAYS.mesaj) },
        messages: { some: {} },
        OR: [
          { demand: { status: { in: ['CLOSED', 'COMPLETED', 'PASSIVE'] } } },
          { origin: 'arac', vehicle: { status: { not: 'PUBLISHED' } } },
          { buyer: { status: 'CLOSED' } },
          { sellerAccount: { status: 'CLOSED' } },
        ],
      },
      select: { id: true, buyerUserId: true, sellerUserId: true, sellerAccountId: true },
      take: PARTI,
    });
    const sikayetli = new Set(
      (
        await this.db.message.findMany({
          where: {
            conversationId: { in: sohbetler.map((c) => c.id) },
            id: {
              in: (
                await this.db.report.findMany({ where: { targetType: 'mesaj' }, select: { targetId: true } })
              ).map((r) => r.targetId),
            },
          },
          select: { conversationId: true },
        })
      ).map((m) => m.conversationId),
    );
    const sohbetBekle = (c: (typeof sohbetler)[number]) =>
      sikayetli.has(c.id) ||
      hold.kisiler.has(c.buyerUserId) ||
      hold.kisiler.has(c.sellerUserId) ||
      hold.hesaplar.has(c.sellerAccountId);

    // Kapatılan hesapların kimlik kaydı
    const hesaplar = await this.db.accountClosure.findMany({
      where: { keepIdentityUntil: { lt: now }, identityPurgedAt: null },
      select: { id: true, userId: true },
      take: PARTI,
    });

    // Erişim kayıtları (2 yıl)
    const erisimSinir = once(RETENTION_DAYS.erisim);
    const [otp, oturum, calisanOturum, calisanGiris] = await Promise.all([
      this.db.otpChallenge.count({ where: { createdAt: { lt: erisimSinir } } }),
      this.db.session.count({
        where: { OR: [{ revokedAt: { lt: erisimSinir } }, { expiresAt: { lt: erisimSinir } }] },
      }),
      this.db.staffSession.count({
        where: { OR: [{ revokedAt: { lt: erisimSinir } }, { expiresAt: { lt: erisimSinir } }] },
      }),
      this.db.staffLoginChallenge.count({ where: { createdAt: { lt: erisimSinir } } }),
    ]);

    // Destek talebi (çözülmüş, 1 yıl), KVKK başvurusu (3 yıl), fatura bilgisi (10 yıl)
    const destek = await this.db.supportTicket.findMany({
      where: { status: 'cozuldu', purgedAt: null, lastMessageAt: { lt: once(RETENTION_DAYS.destek) } },
      select: { id: true, userId: true },
      take: PARTI,
    });
    const kvkk = await this.db.kvkkRequest.findMany({
      where: { status: 'yanitlandi', purgedAt: null, createdAt: { lt: once(RETENTION_DAYS.kvkk) } },
      select: { id: true, userId: true },
      take: PARTI,
    });
    const fatura = await this.db.order.findMany({
      where: {
        paidAt: { lt: once(RETENTION_DAYS.fatura) },
        NOT: { billing: { equals: {} } },
      },
      select: { id: true, userId: true },
      take: PARTI,
    });
    const kisiBekle = (u: string | null) => !!u && hold.kisiler.has(u);

    return {
      sohbet: {
        imha: sohbetler.filter((c) => !sohbetBekle(c)).map((c) => c.id),
        bekle: sohbetler.filter(sohbetBekle).length,
      },
      hesap: {
        imha: hesaplar.filter((h) => !kisiBekle(h.userId)).map((h) => h.id),
        bekle: hesaplar.filter((h) => kisiBekle(h.userId)).length,
      },
      erisim: { sayi: otp + oturum + calisanOturum + calisanGiris, sinir: erisimSinir },
      destek: {
        imha: destek.filter((d) => !kisiBekle(d.userId)).map((d) => d.id),
        bekle: destek.filter((d) => kisiBekle(d.userId)).length,
      },
      kvkk: {
        imha: kvkk.filter((d) => !kisiBekle(d.userId)).map((d) => d.id),
        bekle: kvkk.filter((d) => kisiBekle(d.userId)).length,
      },
      fatura: {
        imha: fatura.filter((d) => !kisiBekle(d.userId)).map((d) => d.id),
        bekle: fatura.filter((d) => kisiBekle(d.userId)).length,
      },
    };
  }

  private async say(now: Date): Promise<Sayim> {
    const a = await this.adaylar(now);
    return {
      sohbet: a.sohbet.imha.length,
      hesap: a.hesap.imha.length,
      erisim: a.erisim.sayi,
      destek: a.destek.imha.length,
      kvkk: a.kvkk.imha.length,
      fatura: a.fatura.imha.length,
    };
  }

  /** Sıradaki dönemin kaydı (yoksa açılır) */
  private async donem(now: Date) {
    const at = nextDisposalDate(now);
    const no = disposalNo(at);
    return (
      (await this.db.disposalRun.findUnique({ where: { no } })) ??
      (await this.db.disposalRun.upsert({
        where: { no },
        update: {},
        create: { id: uuidv7(), no, scheduledFor: at },
      }))
    );
  }

  /**
   * Ajanın günlük sayımı (işçi): sıradaki dönemin listesi güncellenir. Onaylanmış listede sayı değişmez; imha onay
   * anındaki listeyle sınırlı değildir ama tutanak iki sayıyı da yazar.
   */
  async countDue(now = new Date()) {
    const r = await this.donem(now);
    if (r.status !== 'liste') return r;
    const counts = await this.say(now);
    return this.db.disposalRun.update({ where: { id: r.id }, data: { counts, countedAt: now } });
  }

  /** Konsol › Saklama, imha ve VERBİS */
  async overview(now = new Date()) {
    const r = await this.countDue(now);
    const once = await this.db.disposalRun.findFirst({
      where: { status: 'calisti' },
      orderBy: { ranAt: 'desc' },
      select: { id: true, no: true, ranAt: true },
    });
    // Onay bekleyen ya da onaylanmış ama günü gelmemiş eski dönem (işçi henüz çalışmadı)
    const bekleyen = await this.db.disposalRun.findFirst({
      where: { status: 'onaylandi' },
      orderBy: { scheduledFor: 'asc' },
    });
    const goster = bekleyen ?? r;
    const counts = (goster.status === 'liste' ? goster.counts : goster.approvedCounts) as Sayim;
    const onaylayan = goster.approvedBy
      ? await this.db.staffMember.findUnique({ where: { id: goster.approvedBy }, select: { name: true } })
      : null;
    return {
      saklama: RETENTION_RULES,
      donem: {
        id: goster.id,
        no: goster.no,
        tarih: goster.scheduledFor,
        durum: goster.status,
        sayim: goster.countedAt,
        onaylayan: onaylayan?.name ?? null,
        onayTarihi: goster.approvedAt,
        liste: DISPOSAL_KIND_KEYS.map((k) => ({ kalem: k, ad: DISPOSAL_KINDS[k], sayi: counts?.[k] ?? 0 })),
      },
      onceki: once ? { id: once.id, no: once.no, tarih: once.ranAt } : null,
      verbis: await this.verbis(now),
      // Yalnızca ekleme yapılan tablolar imha sürecinin dışındadır (CLAUDE.md kural 4); ayrı sahip kararı gerekir
      disinda: ['Çalışan işlem kaydı', 'Hak defteri', 'Rıza ve İYS kayıtları'],
    };
  }

  /** VERBİS muafiyeti: çalışan sayısı ve son 12 ayın satış toplamı (bilanço için kaba tahmin) */
  async verbis(now = new Date()) {
    const [calisan, ciro, goc] = await Promise.all([
      this.db.staffMember.count({ where: { role: { not: 'AGENT' }, status: 'ACTIVE' } }),
      this.db.order.aggregate({
        where: { status: 'PAID', paidAt: { gte: new Date(now.getTime() - 365 * DAY) } },
        _sum: { totalKurus: true },
      }),
      this.db.$queryRaw<{ t: Date | null }[]>`SELECT max(finished_at) AS t FROM _prisma_migrations`.catch(
        () => [] as { t: Date | null }[],
      ),
    ]);
    const tl = Number(ciro._sum.totalKurus ?? 0n) / 100;
    const milyon = (v: number) =>
      new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(v / 1_000_000);
    const asildi = calisan >= VERBIS_THRESHOLDS.calisan || tl >= VERBIS_THRESHOLDS.bilancoTl;
    return {
      zorunlu: asildi,
      olcutler: [
        {
          ad: 'Çalışan sayısı',
          deger: `${calisan} / ${VERBIS_THRESHOLDS.calisan}`,
          w: Math.min(100, Math.round((calisan / VERBIS_THRESHOLDS.calisan) * 100)),
        },
        {
          ad: 'Yıllık bilanço tahmini',
          deger: `${milyon(tl)} / ${milyon(VERBIS_THRESHOLDS.bilancoTl)} milyon TL`,
          w: Math.min(100, Math.round((tl / VERBIS_THRESHOLDS.bilancoTl) * 100)),
        },
      ],
      // Kişisel veri envanteri: şemadaki `/// @pii` etiketleri; son şema değişikliği
      envanter: goc[0]?.t ?? null,
    };
  }

  /** Sahip listeyi onaylar (Karar 59). Onay işlem kaydına girer; imha dönem gününde işçide çalışır. */
  async approve(staff: { id: string; role: string }, id: string, ip?: string) {
    if (staff.role !== 'OWNER') throw new ForbiddenException('İmha listesini yalnızca sahip onaylar');
    const r = await this.db.disposalRun.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('İmha dönemi bulunamadı');
    if (r.status !== 'liste') throw new ConflictException('Bu liste zaten onaylandı');
    const counts = await this.say(new Date());
    return this.db.$transaction(async (tx) => {
      const u = await tx.disposalRun.updateMany({
        where: { id, status: 'liste' },
        data: {
          status: 'onaylandi',
          approvedBy: staff.id,
          approvedAt: new Date(),
          approvedCounts: counts,
          counts,
        },
      });
      if (u.count !== 1) throw new ConflictException('Bu liste zaten onaylandı');
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staff.id,
          action: 'imha_onaylandi',
          entityType: 'disposal_run',
          entityId: id,
          after: { no: r.no, tarih: r.scheduledFor.toISOString(), liste: counts },
          ip,
        },
        tx,
      );
      return { no: r.no, tarih: r.scheduledFor, liste: counts };
    });
  }

  /** İşçi: günü gelmiş onaylı dönemi imha eder ve tutanağı yazar */
  async runDue(now = new Date()) {
    const r = await this.db.disposalRun.findFirst({
      where: { status: 'onaylandi', scheduledFor: { lte: now } },
      orderBy: { scheduledFor: 'asc' },
    });
    if (!r) return null;
    const a = await this.adaylar(now);
    const imha: Sayim = { sohbet: 0, hesap: 0, erisim: 0, destek: 0, kvkk: 0, fatura: 0 };

    if (a.sohbet.imha.length) {
      imha.sohbet = a.sohbet.imha.length;
      await this.db.message.deleteMany({ where: { conversationId: { in: a.sohbet.imha } } });
    }
    await this.db.accountClosure.updateMany({
      where: { purgeMessagesAt: { lt: now }, messagesPurgedAt: null },
      data: { messagesPurgedAt: now },
    });
    if (a.hesap.imha.length) {
      imha.hesap = (
        await this.db.accountClosure.updateMany({
          where: { id: { in: a.hesap.imha } },
          data: { phoneEnc: null, identityPurgedAt: now },
        })
      ).count;
    }
    const s = a.erisim.sinir;
    const eskiOturum = { OR: [{ revokedAt: { lt: s } }, { expiresAt: { lt: s } }] };
    imha.erisim =
      (await this.db.otpChallenge.deleteMany({ where: { createdAt: { lt: s } } })).count +
      (await this.db.session.deleteMany({ where: eskiOturum })).count +
      (await this.db.staffSession.deleteMany({ where: eskiOturum })).count +
      (await this.db.staffLoginChallenge.deleteMany({ where: { createdAt: { lt: s } } })).count;
    if (a.destek.imha.length) {
      await this.db.supportMessage.updateMany({
        where: { ticketId: { in: a.destek.imha } },
        data: { body: '' },
      });
      imha.destek = await this.db
        .$executeRaw`UPDATE support_tickets SET subject = ${IMHA}, purged_at = ${now},
          email = CASE WHEN user_id IS NULL THEN ${IMHA} ELSE NULL END
          WHERE id = ANY(${a.destek.imha}::uuid[])`;
    }
    if (a.kvkk.imha.length) {
      imha.kvkk = await this.db.$executeRaw`UPDATE kvkk_requests SET text = ${IMHA},
          response = CASE WHEN response IS NULL THEN NULL ELSE ${IMHA} END, applicant_name = NULL,
          applicant_email = CASE WHEN user_id IS NULL THEN ${IMHA} ELSE NULL END, purged_at = ${now}
          WHERE id = ANY(${a.kvkk.imha}::uuid[])`;
    }
    if (a.fatura.imha.length) {
      imha.fatura = (
        await this.db.order.updateMany({
          where: { id: { in: a.fatura.imha } },
          data: { billing: {}, userIp: null },
        })
      ).count;
    }

    const report = {
      no: r.no,
      tarih: now.toISOString(),
      yontem: 'Silme; metin alanlarında anonimleştirme (satır kalır)',
      kalemler: DISPOSAL_KIND_KEYS.map((k) => ({
        kalem: k,
        ad: DISPOSAL_KINDS[k],
        onaylanan: (r.approvedCounts as Sayim | null)?.[k] ?? 0,
        imha: imha[k],
        bekletilen: k === 'erisim' ? 0 : (a[k] as { bekle: number }).bekle,
      })),
      disinda: ['Çalışan işlem kaydı', 'Hak defteri', 'Rıza ve İYS kayıtları'],
    };
    await this.db.$transaction(async (tx) => {
      await tx.disposalRun.update({
        where: { id: r.id },
        data: { status: 'calisti', ranAt: now, report: report as Prisma.InputJsonValue },
      });
      await this.audit.record(
        {
          actorType: 'AGENT',
          actorId: 'ajan',
          action: 'imha_yapildi',
          entityType: 'disposal_run',
          entityId: r.id,
          after: { no: r.no, imha },
        },
        tx,
      );
      await this.outbox.add(tx, 'imha.yapildi', { runId: r.id, no: r.no });
    });
    this.log.log(`imha ${r.no}: ${JSON.stringify(imha)}`);
    return report;
  }

  /** İmha tutanağı (konsoldan indirilir) */
  async report(id: string) {
    const r = await this.db.disposalRun.findUnique({ where: { id } });
    if (!r?.report) throw new NotFoundException('Tutanak bulunamadı');
    const onaylayan = r.approvedBy
      ? await this.db.staffMember.findUnique({ where: { id: r.approvedBy }, select: { name: true } })
      : null;
    return {
      ...(r.report as Record<string, unknown>),
      onaylayan: onaylayan?.name ?? null,
      onayTarihi: r.approvedAt,
    };
  }

  /** Süresi dolan veri kopyası dosyaları her gün silinir (Karar 58) */
  async expireExports(now = new Date()) {
    const eski = await this.db.dataExport.findMany({
      where: { status: 'hazir', expiresAt: { lt: now } },
      select: { id: true, storageKey: true },
      take: 500,
    });
    for (const e of eski) {
      if (e.storageKey) await this.storage.delete(e.storageKey).catch(() => undefined);
      await this.db.dataExport.update({ where: { id: e.id }, data: { status: 'suresi_doldu' } });
    }
    // Hesap kapatmada "süresi doldu" sayılan kopyaların dosyaları da silinir
    const kapali = await this.db.dataExport.findMany({
      where: { status: 'suresi_doldu', storageKey: { not: null } },
      select: { id: true, storageKey: true },
      take: 500,
    });
    for (const e of kapali) {
      await this.storage.delete(e.storageKey as string).catch(() => undefined);
      await this.db.dataExport.update({ where: { id: e.id }, data: { storageKey: null } });
    }
    return eski.length + kapali.length;
  }
}
