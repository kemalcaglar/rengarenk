import { Inject, Injectable, Logger } from '@nestjs/common';
import { type Order, type Prisma, type Subscription, uuidv7 } from '@rengarenk/db';
import { addMonths, type PaidPlan, planRank, SUB_PERIODS, SUB_RETRY_DAYS } from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import type { Tx } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { SecretBox } from '../staff/secret-box.js';
import { kalemler } from './order-item.js';
import type { Notification } from './providers.js';

const DAY = 86_400_000;
/** Paket hakları: aylık talep ve 7 günlük üst sıra (Karar 12.2) */
const PAKET_HAKLARI = [
  ['talep', 'aylikTalep'],
  ['ust_sira', 'oneCikarma'],
] as const;

/**
 * Abonelik siparişinin sonuçları (Karar 12.2, 12.3, 12.7; Teknik tasarım §7). Ödeme bildirimiyle aynı veritabanı işleminde
 * çalışır: abonelik dönemi, galerinin paketi, aylık paket hakları, işlem kaydı ve olaylar birlikte yazılır. Aylık haklar
 * döngü sonunda devretmez: döngüde verilen haklardan kullanılmayanı "sure_dolumu" satırıyla düşülür; satın alınan ek
 * haklar etkilenmez (kullanım sırası: önce paket hakkı).
 */
@Injectable()
export class SubscriptionBilling {
  private readonly log = new Logger(SubscriptionBilling.name);
  readonly box: SecretBox;

  constructor(
    @Inject(ENV) env: Env,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly pricing: PricingService,
  ) {
    this.box = SecretBox.forPayments(env);
  }

  private async lock(tx: Tx, accountId: string) {
    const [s] = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM subscriptions WHERE account_id = ${accountId}::uuid FOR UPDATE`;
    return s ? tx.subscription.findUniqueOrThrow({ where: { id: s.id } }) : null;
  }

  /** Döngünün paket hakları; kaynak no tekil olduğundan iki kez yazılmaz */
  async grantCycle(
    tx: Tx,
    sub: { id: string; accountId: string },
    plan: PaidPlan,
    cycleNo: number,
    by: string,
  ) {
    const plans = await this.pricing.plans();
    const p = plans[plan];
    for (const [kind, alan] of PAKET_HAKLARI) {
      if (p[alan] <= 0) continue;
      await tx.entitlementLedger.createMany({
        data: [
          {
            accountId: sub.accountId,
            kind,
            delta: p[alan],
            reason: 'paket',
            sourceType: 'package_cycle',
            sourceId: `${sub.id}:${cycleNo}`,
            createdBy: by,
          },
        ],
        skipDuplicates: true,
      });
    }
  }

  /** Döngüde verilip kullanılmayan paket haklarını düşer (Karar 12.3: devretmez) */
  async expireCycle(tx: Tx, sub: Subscription) {
    const n = sub.quotaCycleNo;
    for (const [kind] of PAKET_HAKLARI) {
      const verilen = await tx.entitlementLedger.aggregate({
        where: {
          accountId: sub.accountId,
          kind,
          sourceType: 'package_cycle',
          OR: [{ sourceId: `${sub.id}:${n}` }, { sourceId: { startsWith: `${sub.id}:${n}:` } }],
        },
        _sum: { delta: true },
      });
      const kullanilan = await tx.entitlementLedger.aggregate({
        where: {
          accountId: sub.accountId,
          kind,
          reason: 'kullanim',
          createdAt: { gte: sub.quotaCycleStart },
        },
        _sum: { delta: true },
      });
      const bakiye = await tx.entitlementLedger.aggregate({
        where: { accountId: sub.accountId, kind },
        _sum: { delta: true },
      });
      const kalan = Math.min(
        bakiye._sum.delta ?? 0,
        Math.max(0, (verilen._sum.delta ?? 0) + (kullanilan._sum.delta ?? 0)),
      );
      if (kalan <= 0) continue;
      await tx.entitlementLedger.createMany({
        data: [
          {
            accountId: sub.accountId,
            kind,
            delta: -kalan,
            reason: 'sure_dolumu',
            sourceType: 'package_cycle_end',
            sourceId: `${sub.id}:${n}`,
            createdBy: 'sistem',
          },
        ],
        skipDuplicates: true,
      });
    }
  }

  /** Paket başlayınca denemenin kullanılmayan talep hakkı düşer (deneme biter, paketin hakları başlar) */
  private async expireTrial(tx: Tx, accountId: string) {
    const toplam = async (where: Prisma.EntitlementLedgerWhereInput) =>
      (
        await tx.entitlementLedger.aggregate({
          where: { accountId, kind: 'talep', ...where },
          _sum: { delta: true },
        })
      )._sum.delta ?? 0;
    const verilen = await toplam({ sourceType: 'galeri_deneme' });
    const kullanilan = await toplam({ reason: 'kullanim' });
    const kalan = Math.min(await toplam({}), Math.max(0, verilen + kullanilan));
    if (kalan <= 0) return;
    await tx.entitlementLedger.createMany({
      data: [
        {
          accountId,
          kind: 'talep',
          delta: -kalan,
          reason: 'sure_dolumu',
          sourceType: 'galeri_deneme_bitti',
          sourceId: accountId,
          createdBy: 'sistem',
        },
      ],
      skipDuplicates: true,
    });
  }

  /** Yeni hak döngüsü: öncekinin kalanı düşülür, sıra bir artar, haklar verilir */
  async nextCycle(tx: Tx, sub: Subscription, start: Date, plan: PaidPlan, by: string) {
    await this.expireCycle(tx, sub);
    const no = sub.quotaCycleNo + 1;
    await tx.subscription.update({
      where: { id: sub.id },
      data: { quotaCycleNo: no, quotaCycleStart: start },
    });
    await this.grantCycle(tx, sub, plan, no, by);
  }

  /** Abonelik sona erer: iptal dönem sonunda ya da ödeme alınamadığı için askıya alınır; galeri salt okunur olur */
  async end(tx: Tx, sub: Subscription, neden: 'iptal' | 'odeme_alinamadi' | 'iade') {
    await this.expireCycle(tx, sub);
    await tx.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
        endReason: neden,
        cancelAtPeriodEnd: false,
        nextRetryAt: null,
      },
    });
    await tx.gallery.update({ where: { accountId: sub.accountId }, data: { plan: 'pasif' } });
    await this.audit.record(
      {
        actorType: 'SYSTEM',
        actorId: 'abonelik',
        action: 'abonelik_bitti',
        entityType: 'subscription',
        entityId: sub.id,
        before: { plan: sub.plan, durum: sub.status },
        after: { neden },
      },
      tx,
    );
    await this.outbox.add(tx, 'abonelik.bitti', { accountId: sub.accountId, neden });
  }

  /** Otomatik yenileme ödemesi alınamadı: 3 gün günde bir yeniden denenir, sonra askıya alınır */
  async onRenewalFailed(tx: Tx, o: Order, neden: string) {
    if (!o.subscriptionId) return;
    const sub = await this.lock(tx, o.accountId);
    if (!sub || sub.status === 'ENDED') return;
    const deneme = sub.failCount + 1;
    const son = deneme > SUB_RETRY_DAYS;
    const s = await tx.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'PAST_DUE',
        failCount: deneme,
        nextRetryAt: son ? null : new Date(Date.now() + DAY),
      },
    });
    await this.outbox.add(tx, 'abonelik.odeme_basarisiz', {
      accountId: sub.accountId,
      orderId: o.id,
      deneme,
      neden: neden.slice(0, 200),
      askiyaAlindi: son,
    });
    if (son) await this.end(tx, s, 'odeme_alinamadi');
  }

  /**
   * Ödeme alındı. Yeni abonelik hemen başlar; üst pakete geçişte paket hemen değişir ve aradaki hak farkı verilir;
   * yenilemede yeni dönem öncekinin bitişinden başlar (askıdan sonra ödemede bugünden).
   */
  async fulfill(tx: Tx, o: Order, n: Notification) {
    const plans = await this.pricing.plans();
    const k = kalemler(o.items)[0];
    if (!k?.plan || !k.donem) throw new Error(`abonelik kalemi eksik: ${o.id}`);
    const plan = k.plan;
    const donem = k.donem;
    const net = BigInt(k.netKurus ?? 0);
    const now = new Date();
    const kart = n.cardToken ? { cardToken: this.box.seal(n.cardToken), cardLabel: null } : {};
    const sub = await this.lock(tx, o.accountId);
    const billing = o.billing as { eposta: string };
    const uyusmazlik = async (neden: string) => {
      // Para alındı ama uygulanamıyor: hak verilmez, sahip inceler (iade yalnızca sahibin onayıyla)
      this.log.warn(`abonelik siparişi uygulanamadı ${o.no}: ${neden}`);
      await this.outbox.add(tx, 'odeme.uyusmazlik', { orderId: o.id, neden });
    };

    // Kartın gösterim adı (VISA •••• 4242) işlemden sonra ödeme kuruluşundan alınır
    if (n.cardToken) await this.outbox.add(tx, 'abonelik.kart_kaydedildi', { accountId: o.accountId });

    if (o.kind === 'abonelik') {
      if (sub && sub.status !== 'ENDED') return uyusmazlik('abonelik zaten etkin');
      const end = addMonths(now, SUB_PERIODS[donem].ay);
      const ortak = {
        userId: o.userId,
        plan,
        period: donem,
        status: 'ACTIVE' as const,
        priceKurus: net,
        currentPeriodStart: now,
        currentPeriodEnd: end,
        quotaCycleStart: now,
        billingEmail: billing.eposta,
        cancelAtPeriodEnd: false,
        cancelRequestedAt: null,
        nextPlan: null,
        nextPeriod: null,
        failCount: 0,
        nextRetryAt: null,
        remindedFor: null,
        endedAt: null,
        endReason: null,
        ...kart,
      };
      const s = sub
        ? await tx.subscription.update({
            where: { id: sub.id },
            data: { ...ortak, quotaCycleNo: sub.quotaCycleNo + 1 },
          })
        : await tx.subscription.create({
            data: { id: o.subscriptionId ?? uuidv7(), accountId: o.accountId, ...ortak },
          });
      if (o.subscriptionId !== s.id) {
        await tx.order.update({ where: { id: o.id }, data: { subscriptionId: s.id } });
      }
      const g = await tx.gallery.findUniqueOrThrow({
        where: { accountId: o.accountId },
        select: { plan: true },
      });
      if (g.plan === 'deneme') await this.expireTrial(tx, o.accountId);
      await tx.gallery.update({ where: { accountId: o.accountId }, data: { plan } });
      await this.grantCycle(tx, s, plan, s.quotaCycleNo, o.userId);
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: o.userId,
          action: 'abonelik_basladi',
          entityType: 'subscription',
          entityId: s.id,
          after: { plan, donem, bitis: end.toISOString(), siparis: o.no },
        },
        tx,
      );
      await this.outbox.add(tx, 'abonelik.basladi', { accountId: o.accountId, subscriptionId: s.id });
      return;
    }

    if (!sub) return uyusmazlik('abonelik bulunamadı');

    if (o.kind === 'yukseltme') {
      if (sub.status === 'ENDED' || planRank(plan) <= planRank(sub.plan)) {
        return uyusmazlik('üst pakete geçiş uygulanamadı');
      }
      const eski = plans[sub.plan as PaidPlan];
      const yeni = plans[plan];
      const s = await tx.subscription.update({
        where: { id: sub.id },
        data: {
          plan,
          priceKurus: BigInt(plans[plan][sub.period === 'aylik' ? 'aylik' : 'yillik'] * 100),
          // Sonraki dönem için seçilen alt paket artık geçersiz; ödeme dönemi seçimi kalır
          nextPlan: null,
          ...kart,
        },
      });
      await tx.gallery.update({ where: { accountId: o.accountId }, data: { plan } });
      // Bu ayın hak farkı
      for (const [kind, alan] of PAKET_HAKLARI) {
        const fark = yeni[alan] - eski[alan];
        if (fark <= 0) continue;
        await tx.entitlementLedger.createMany({
          data: [
            {
              accountId: o.accountId,
              kind,
              delta: fark,
              reason: 'paket',
              sourceType: 'package_cycle',
              sourceId: `${s.id}:${s.quotaCycleNo}:${o.id}`,
              createdBy: o.userId,
            },
          ],
          skipDuplicates: true,
        });
      }
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: o.userId,
          action: 'abonelik_yukseltildi',
          entityType: 'subscription',
          entityId: s.id,
          before: { plan: sub.plan },
          after: { plan, siparis: o.no },
        },
        tx,
      );
      await this.outbox.add(tx, 'abonelik.degisti', { accountId: o.accountId, plan });
      return;
    }

    if (o.kind === 'yenileme') {
      const start = sub.status === 'ENDED' ? now : sub.currentPeriodEnd;
      const end = addMonths(start, SUB_PERIODS[donem].ay);
      const s = await tx.subscription.update({
        where: { id: sub.id },
        data: {
          plan,
          period: donem,
          status: 'ACTIVE',
          priceKurus: net,
          currentPeriodStart: start,
          currentPeriodEnd: end,
          nextPlan: null,
          nextPeriod: null,
          failCount: 0,
          nextRetryAt: null,
          remindedFor: null,
          endedAt: null,
          endReason: null,
          ...kart,
        },
      });
      await tx.gallery.update({ where: { accountId: o.accountId }, data: { plan } });
      await this.nextCycle(tx, s, start, plan, o.userId);
      await this.audit.record(
        {
          actorType: 'SYSTEM',
          actorId: 'abonelik',
          action: 'abonelik_yenilendi',
          entityType: 'subscription',
          entityId: s.id,
          after: { plan, donem, bitis: end.toISOString(), siparis: o.no },
        },
        tx,
      );
      await this.outbox.add(tx, 'abonelik.yenilendi', { accountId: o.accountId, subscriptionId: s.id });
    }
  }
}
