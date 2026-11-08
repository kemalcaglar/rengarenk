import { Inject, Injectable, Logger } from '@nestjs/common';
import { type Order, uuidv7 } from '@rengarenk/db';
import { tlYaz } from '@rengarenk/shared';
import { AuditService } from '../../audit/audit.service.js';
import { type Db, PRISMA, type Tx } from '../../database/prisma.js';
import { OutboxService } from '../../outbox/outbox.service.js';
import { revokeOrder } from '../../payments/order-revoke.js';
import { SubscriptionBilling } from '../../payments/subscription-billing.js';
import type { RefundGateway } from './refund-gateway.js';

export const REFUND_GATEWAY = Symbol('REFUND_GATEWAY');
const ONAY_SURESI_MS = 72 * 3600_000;

/**
 * İade yürütücü (Teknik tasarım §7, "bana sorulmadan sistemde hiçbir zaman iade yapılmasın"). Ayrı süreçte çalışır;
 * ödeme kuruluşunun iade ucu yalnızca burada kurulur (kilit 2). İadeden hemen önce onayı yeniden doğrular: Sahip
 * rolündeki etkin çalışan onaylamış, onay 72 saatten eski değil, tutar ödemeyi (önceki iadelerle birlikte) aşmıyor;
 * iade kaydı işlem kaydıyla aynı işlemde yazılır (kilit 3). Veritabanı iade kilidi aynı koşulları ayrıca denetler
 * (kilit 1). Aynı onay bir kez yürütülür (onay başına tek iade kaydı). Sonucu belirsiz iade yeniden denenmez.
 */
@Injectable()
export class RefundExecutorService {
  private readonly log = new Logger('iade-yurutucu');

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(REFUND_GATEWAY) private readonly gateway: RefundGateway,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly billing: SubscriptionBilling,
  ) {}

  /** Onaylanmış, yürütülmemiş ve daha önce reddedilmemiş iadeler */
  async runOnce(now = new Date()) {
    const due = await this.db.approval.findMany({
      where: {
        kind: 'REFUND',
        status: 'APPROVED',
        refunds: { none: {} },
        results: { none: {} },
        decidedAt: { gt: new Date(now.getTime() - ONAY_SURESI_MS) },
      },
      orderBy: { decidedAt: 'asc' },
      select: { id: true },
      take: 20,
    });
    let n = 0;
    for (const { id } of due) {
      const r = await this.execute(id).catch((e: Error) => {
        this.log.error(`iade ${id}: ${e.message}`);
        return null;
      });
      if (r) n++;
    }
    return n;
  }

  private async reddet(approvalId: string, neden: string) {
    await this.db.$transaction(async (tx) => {
      await tx.approvalResult.create({ data: { approvalId, outcome: 'FAILED', detail: { neden } } });
      await this.audit.record(
        {
          actorType: 'SYSTEM',
          actorId: 'iade_yurutucu',
          action: 'iade_basarisiz',
          entityType: 'approval',
          entityId: approvalId,
          after: { neden },
        },
        tx,
      );
      await this.outbox.add(tx, 'iade.basarisiz', { approvalId, neden });
    });
    this.log.warn(`iade yürütülmedi ${approvalId}: ${neden}`);
    return { sonuc: 'reddedildi' as const, neden };
  }

  async execute(approvalId: string) {
    const now = new Date();
    // Kilit 3: onay satırı kilitlenir, her koşul yeniden doğrulanır, iade kaydı aynı işlemde yazılır
    const hazir = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM approvals WHERE id = ${approvalId}::uuid FOR UPDATE`;
      const a = await tx.approval.findUnique({
        where: { id: approvalId },
        include: { decider: { select: { role: true, status: true } }, refunds: { select: { id: true } } },
      });
      if (a?.kind !== 'REFUND' || a.status !== 'APPROVED' || a.refunds.length) return { atla: true as const };
      if (a.decider?.role !== 'OWNER' || a.decider.status !== 'ACTIVE') {
        return { neden: 'İadeyi yalnızca etkin Sahip onaylayabilir' };
      }
      if (!a.decidedAt || a.decidedAt.getTime() < now.getTime() - ONAY_SURESI_MS) {
        return { neden: 'Onay 72 saatten eski; yeniden onay gerekli' };
      }
      if (a.subjectType !== 'payment' || !a.amountKurus || a.amountKurus <= 0n) {
        return { neden: 'Onay bir ödemeye ve tutara bağlı değil' };
      }
      const odeme = await tx.payment.findUnique({
        where: { id: a.subjectId },
        include: { order: { include: { refunds: { select: { amountKurus: true, status: true } } } } },
      });
      if (odeme?.status !== 'success') return { neden: 'Başarılı ödeme bulunamadı' };
      const o = odeme.order;
      if (o.status !== 'PAID' || (o.channel !== 'web' && o.channel !== 'otomatik')) {
        return { neden: 'Bu sipariş buradan iade edilemez' };
      }
      const once = o.refunds.filter((r) => r.status !== 'FAILED').reduce((t, r) => t + r.amountKurus, 0n);
      if (once + a.amountKurus > o.totalKurus) {
        return { neden: `İade toplamı ödenen tutarı (${tlYaz(Number(o.totalKurus))}) aşar` };
      }
      const id = uuidv7();
      const refund = await tx.refund.create({
        data: {
          id,
          paymentId: odeme.id,
          amountKurus: a.amountKurus,
          approvalId,
          orderId: o.id,
          provider: this.gateway.ad,
          referenceNo: `IADE${id.replaceAll('-', '')}`.slice(0, 64),
        },
      });
      await this.audit.record(
        {
          actorType: 'SYSTEM',
          actorId: 'iade_yurutucu',
          action: 'iade_yurutuluyor',
          entityType: 'refund',
          entityId: id,
          after: { siparis: o.no, tutarKurus: a.amountKurus.toString(), onay: approvalId },
        },
        tx,
      );
      return { refund, order: o };
    });
    if ('atla' in hazir) return null;
    if ('neden' in hazir) return this.reddet(approvalId, hazir.neden as string);

    const { refund, order } = hazir;
    const sonuc = await this.gateway.refund({
      oid: order.no,
      amountKurus: Number(refund.amountKurus),
      referenceNo: refund.referenceNo as string,
    });

    if (sonuc.status === 'unknown') {
      await this.db.$transaction(async (tx) => {
        await tx.refund.update({
          where: { id: refund.id },
          data: {
            failReason: `Sonuç belirsiz: ${sonuc.message ?? ''}; PayTR panelinden kontrol edilmeli`.slice(
              0,
              300,
            ),
          },
        });
        await this.outbox.add(tx, 'iade.belirsiz', { refundId: refund.id, orderId: order.id });
      });
      this.log.error(`iade sonucu belirsiz ${refund.id}`);
      return { sonuc: 'belirsiz' as const, refundId: refund.id };
    }

    if (sonuc.status === 'failed') {
      await this.db.$transaction(async (tx) => {
        await tx.refund.update({
          where: { id: refund.id },
          data: { status: 'FAILED', failReason: (sonuc.message ?? 'İade yapılamadı').slice(0, 300) },
        });
        await tx.approvalResult.create({
          data: { approvalId, outcome: 'FAILED', detail: { refundId: refund.id, neden: sonuc.message } },
        });
        await this.audit.record(
          {
            actorType: 'SYSTEM',
            actorId: 'iade_yurutucu',
            action: 'iade_basarisiz',
            entityType: 'refund',
            entityId: refund.id,
            after: { neden: sonuc.message },
          },
          tx,
        );
        await this.outbox.add(tx, 'iade.basarisiz', {
          refundId: refund.id,
          approvalId,
          neden: sonuc.message,
        });
      });
      return { sonuc: 'basarisiz' as const, refundId: refund.id };
    }

    await this.db.$transaction(async (tx) => {
      // Veritabanı kilidi yürütme anında da Sahip onayını ve 72 saati denetler
      await tx.refund.update({
        where: { id: refund.id },
        data: { status: 'EXECUTED', executedAt: new Date() },
      });
      const yapilan = await this.etkiler(tx, order, Number(refund.amountKurus));
      await tx.refundInvoice.create({ data: { id: uuidv7(), refundId: refund.id, provider: 'kuyruk' } });
      await tx.approvalResult.create({
        data: { approvalId, outcome: 'SUCCEEDED', detail: { refundId: refund.id, yapilan } },
      });
      await this.audit.record(
        {
          actorType: 'SYSTEM',
          actorId: 'iade_yurutucu',
          action: 'iade_yurutuldu',
          entityType: 'refund',
          entityId: refund.id,
          after: {
            siparis: order.no,
            tutarKurus: refund.amountKurus.toString(),
            testMode: sonuc.testMode,
            yapilan,
          },
        },
        tx,
      );
      await this.outbox.add(tx, 'iade.yurutuldu', { refundId: refund.id, orderId: order.id });
    });
    this.log.log(`iade yürütüldü ${order.no} ${tlYaz(Number(refund.amountKurus))}`);
    return { sonuc: 'yurutuldu' as const, refundId: refund.id };
  }

  /**
   * İadenin etkisi (sahip kararı, 8 Kasım 2026): siparişten kalan kullanılmamış hak düşer, süren öne çıkarma biter;
   * aboneliğin güncel dönemi tamamen iade edildiyse abonelik biter ve galeri "paket yok" durumuna düşer.
   */
  private async etkiler(tx: Tx, o: Order, tutar: number) {
    const yapilan = await revokeOrder(tx, o, this.outbox, {
      reason: 'iade',
      sourceType: 'refund',
      createdBy: 'iade_yurutucu',
    });
    if (
      (o.kind === 'abonelik' || o.kind === 'yenileme') &&
      o.subscriptionId &&
      tutar >= Number(o.totalKurus)
    ) {
      const sub = await tx.subscription.findUnique({ where: { id: o.subscriptionId } });
      const son = await tx.order.findFirst({
        where: { subscriptionId: o.subscriptionId, status: 'PAID', kind: { in: ['abonelik', 'yenileme'] } },
        orderBy: { paidAt: 'desc' },
        select: { id: true },
      });
      if (sub && sub.status !== 'ENDED' && son?.id === o.id) {
        await this.billing.end(tx, sub, 'iade');
        yapilan.push('Abonelik bitti, galeri paketsiz');
      }
    }
    return yapilan;
  }
}
