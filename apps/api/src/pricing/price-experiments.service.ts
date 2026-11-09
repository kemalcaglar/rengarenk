import {
  BadRequestException,
  ConflictException,
  Global,
  Inject,
  Injectable,
  Module,
  NotFoundException,
} from '@nestjs/common';
import { type Approval, type PriceExperiment, type Prisma, uuidv7 } from '@rengarenk/db';
import {
  type MeanResult,
  meanTest,
  type PermissionGrants,
  PRICE_EXP_STATUS_NAMES,
  type PriceBook,
  type PriceExperimentInput,
  type PriceExperimentStatus,
  priceExperimentCheck,
  productByKey,
  productPrice,
  tlYaz,
} from '@rengarenk/shared';
import { ApprovalService } from '../approvals/approval.service.js';
import { ApprovalExecutor } from '../approvals/approval-executor.js';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { AuditService } from '../audit/audit.service.js';
import { grafikNotu } from '../dashboard/dashboard.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { PricingService } from './pricing.service.js';

export const PRICE_EXP_SUBJECT = 'price_experiment';
const DAY = 86_400_000;

interface StaffActor {
  staff: { id: string; role: string; status: string };
  grants: PermissionGrants;
}

/** Saklanan durum + onay ve zamandan çıkan durum */
export function priceExpStatus(
  r: Pick<PriceExperiment, 'status' | 'endsAt'>,
  onay: string | null | undefined,
  now: Date,
): PriceExperimentStatus {
  if (r.status === 'onay_bekliyor')
    return onay && ['REJECTED', 'EXPIRED', 'CANCELLED'].includes(onay) ? 'reddedildi' : 'onay_bekliyor';
  if (r.status === 'durduruldu') return 'durduruldu';
  return r.endsAt && r.endsAt <= now ? 'bitti' : 'suruyor';
}

/**
 * Kol başına kullanıcı başı web geliri: deneyde fiyatı gören bireysel kullanıcıların, gördükleri andan deney bitene
 * (ya da şimdiye) kadar ödenen web ürün siparişleri. Kişisel veri dışarı verilmez, yalnızca toplamlar.
 */
export async function priceExpResult(
  db: Db,
  r: Pick<PriceExperiment, 'id' | 'endsAt'>,
  now: Date,
): Promise<MeanResult> {
  const son = r.endsAt && r.endsAt < now ? r.endsAt : now;
  const rows = await db.$queryRaw<{ arm: string; n: number; toplam: number; kare: number }[]>`
    SELECT e.arm, COUNT(*)::int AS n,
           COALESCE(SUM(t.toplam), 0)::float8 AS toplam,
           COALESCE(SUM(t.toplam * t.toplam), 0)::float8 AS kare
      FROM price_experiment_exposures e
      LEFT JOIN LATERAL (
        SELECT SUM(o.total_kurus)::float8 AS toplam
          FROM orders o JOIN accounts ac ON ac.id = o.account_id AND ac.kind = 'INDIVIDUAL'
         WHERE o.user_id = e.user_id AND o.status = 'PAID' AND o.kind = 'urun' AND o.channel = 'web'
           AND o.paid_at >= e.seen_at AND o.paid_at < ${son}
      ) t ON true
     WHERE e.experiment_id = ${r.id}::uuid
     GROUP BY e.arm`;
  const kol = (k: string) => {
    const x = rows.find((y) => y.arm === k);
    return { n: x?.n ?? 0, toplam: x?.toplam ?? 0, kare: x?.kare ?? 0 };
  };
  return meanTest(kol('A'), kol('B'));
}

/**
 * Fiyat deneyleri (Karar 44, 56): Kurallar ve fiyatlar'dan önerilir, yalnızca Sahip onaylar (PRICE_CHANGE onayı,
 * konu `price_experiment`); onaylanınca başlar ve süresi dolunca kendiliğinden biter. Kazanan B ise fiyat listesine
 * öneri olarak gider (yine Sahip onayı). Aynı ürün için aynı anda tek deney açık olabilir.
 */
@Injectable()
export class PriceExperimentService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly approvals: ApprovalService,
    private readonly audit: AuditService,
    private readonly pricing: PricingService,
    executor: ApprovalExecutor,
  ) {
    executor.register('PRICE_CHANGE', (a, tx) => this.baslat(a, tx), PRICE_EXP_SUBJECT);
  }

  async list(now = new Date()) {
    const rows = await this.db.priceExperiment.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
    const onaylar = await this.db.approval.findMany({
      where: { id: { in: rows.flatMap((r) => (r.approvalId ? [r.approvalId] : [])) } },
      select: { id: true, status: true },
    });
    const onay = new Map(onaylar.map((a) => [a.id, a.status as string]));
    const out = [];
    for (const r of rows) {
      const durum = priceExpStatus(r, r.approvalId ? onay.get(r.approvalId) : null, now);
      const p = productByKey(r.productKey);
      out.push({
        id: r.id,
        ad: r.name,
        urun: r.productKey,
        urunAd: p?.ad ?? r.productKey,
        fiyatA: tlYaz(r.priceAKurus),
        fiyatB: tlYaz(r.priceBKurus),
        gun: r.days,
        durum,
        durumAd: PRICE_EXP_STATUS_NAMES[durum],
        baslangic: r.startsAt,
        bitis: r.endsAt,
        oneriVar: Boolean(r.proposedBook),
        sonuc:
          durum === 'suruyor' || durum === 'bitti' || durum === 'durduruldu'
            ? await priceExpResult(this.db, r, now)
            : null,
      });
    }
    return out;
  }

  async create(actor: StaffActor, b: PriceExperimentInput, ip?: string) {
    const p = productByKey(b.urun);
    if (!p) throw new BadRequestException('Ürün bulunamadı');
    const liste = productPrice(await this.pricing.current(), p.key) ?? p.tl;
    const hata = priceExperimentCheck(liste, b.fiyatB);
    if (hata) throw new BadRequestException(hata);
    const now = new Date();
    const acik = await this.db.priceExperiment.findMany({
      where: {
        productKey: p.key,
        OR: [{ status: 'onay_bekliyor' }, { status: 'suruyor', endsAt: { gt: now } }],
      },
      select: { status: true, endsAt: true, approvalId: true },
    });
    for (const r of acik) {
      const o = r.approvalId
        ? (await this.db.approval.findUnique({ where: { id: r.approvalId }, select: { status: true } }))
            ?.status
        : null;
      const d = priceExpStatus(r, o, now);
      if (d === 'onay_bekliyor' || d === 'suruyor')
        throw new ConflictException('Bu ürün için açık bir fiyat deneyi var');
    }
    const id = uuidv7();
    const a = Math.round(liste * 100);
    const bk = Math.round(b.fiyatB * 100);
    await this.db.$transaction(async (tx) => {
      const onay = await this.approvals.request(
        actor,
        {
          kind: 'PRICE_CHANGE',
          subjectType: PRICE_EXP_SUBJECT,
          subjectId: id,
          title: `Fiyat deneyi · ${p.ad}: ${tlYaz(a)} / ${tlYaz(bk)}`,
          reason:
            `${b.ad} · ${b.gun} gün · yalnızca web ve bireysel kullanıcılar; kullanıcıların yarısı ${tlYaz(bk)} görür, ölçü kullanıcı başına gelir`.slice(
              0,
              1000,
            ),
          payload: {
            yalnizSahip: true,
            urun: p.key,
            fiyatA: a,
            fiyatB: bk,
            gun: b.gun,
          } as Prisma.InputJsonValue,
        },
        tx,
        ip,
      );
      await tx.priceExperiment.create({
        data: {
          id,
          name: b.ad,
          productKey: p.key,
          priceAKurus: a,
          priceBKurus: bk,
          days: b.gun,
          approvalId: onay.id,
          createdBy: actor.staff.id,
        },
      });
    });
    return this.list();
  }

  /** Onaylanan deney başlar (işçideki onay yürütücüsü) */
  async baslat(a: Approval, tx: Tx): Promise<Prisma.InputJsonValue> {
    const r = await tx.priceExperiment.findUnique({ where: { id: a.subjectId } });
    if (!r || r.approvalId !== a.id) throw new Error('Fiyat deneyi bu onayı beklemiyor');
    if (r.status === 'suruyor') return { durum: 'zaten_basladi' };
    if (r.status !== 'onay_bekliyor') throw new Error('Fiyat deneyi başlatılamaz');
    const now = new Date();
    const endsAt = new Date(now.getTime() + r.days * DAY);
    await tx.priceExperiment.update({
      where: { id: r.id },
      data: { status: 'suruyor', startsAt: now, endsAt },
    });
    await this.audit.record(
      {
        actorType: 'SYSTEM',
        action: 'fiyat_deneyi_basladi',
        entityType: 'price_experiment',
        entityId: r.id,
        after: {
          urun: r.productKey,
          fiyatA: r.priceAKurus,
          fiyatB: r.priceBKurus,
          bitis: endsAt.toISOString(),
        },
      },
      tx,
    );
    await grafikNotu(tx, now, `Fiyat deneyi başladı: ${r.name}`.slice(0, 120), 'fiyat', r.id);
    this.pricing.forget();
    return { baslangic: now.toISOString(), bitis: endsAt.toISOString() };
  }

  /** Süren deneyi erken bitirir (o andan sonra herkes liste fiyatını görür) */
  async durdur(actor: StaffActor, id: string, ip?: string) {
    const r = await this.db.priceExperiment.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Deney bulunamadı');
    const now = new Date();
    if (priceExpStatus(r, null, now) !== 'suruyor')
      throw new ConflictException('Yalnızca süren deney durdurulur');
    await this.db.$transaction(async (tx) => {
      await tx.priceExperiment.update({
        where: { id },
        data: { status: 'durduruldu', endsAt: now, stoppedBy: actor.staff.id },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: actor.staff.id,
          action: 'fiyat_deneyi_durduruldu',
          entityType: 'price_experiment',
          entityId: id,
          ip,
        },
        tx,
      );
    });
    this.pricing.forget();
    return this.list();
  }

  /**
   * Biten deneyde kazanan B ise fiyat listesine öneri (iki gün sonra geçerli; PRICE_CHANGE, yalnızca Sahip onaylar). Öneri
   * fiyatı doğrudan değiştirmez.
   */
  async oner(actor: StaffActor, id: string, ip?: string) {
    const r = await this.db.priceExperiment.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Deney bulunamadı');
    const now = new Date();
    const d = priceExpStatus(r, null, now);
    if (d !== 'bitti' && d !== 'durduruldu') throw new ConflictException('Deney henüz bitmedi');
    if (r.proposedBook) throw new ConflictException('Kazanan fiyat zaten önerildi');
    const sonuc = await priceExpResult(this.db, r, now);
    if (sonuc.kazanan !== 'B') throw new ConflictException('B fiyatı kazanmadı; liste fiyatı kalır');
    const kitap = await this.pricing.current();
    const yeni: PriceBook = { ...kitap, urunler: { ...kitap.urunler, [r.productKey]: r.priceBKurus / 100 } };
    // Fiyat değişikliği en erken 24 saat sonra yürürlüğe girer: iki gün sonrasının başı
    const gun = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
      new Date(now.getTime() + 2 * DAY),
    );
    await this.pricing.propose(actor, yeni, gun, `Fiyat deneyi sonucu: ${r.name}`.slice(0, 300), ip);
    const book = await this.db.priceBook.findFirst({
      where: { createdBy: actor.staff.id, status: 'onay_bekliyor' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    await this.db.priceExperiment.update({ where: { id }, data: { proposedBook: book?.id ?? null } });
    return this.list();
  }
}

/** API ve işçide: onaylanan deneyi işçideki yürütücü başlatır (PricingCoreModule genel) */
@Global()
@Module({
  imports: [ApprovalsModule],
  providers: [PriceExperimentService, AuditService],
  exports: [PriceExperimentService],
})
export class PriceExperimentsModule {}
