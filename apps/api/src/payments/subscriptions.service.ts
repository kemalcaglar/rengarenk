import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { type Prisma, type Subscription, uuidv7 } from '@rengarenk/db';
import {
  addMonths,
  type Billing,
  GALLERY_PLANS,
  galleryAccess,
  PAID_PLANS,
  type PaidPlan,
  PRODUCTS,
  planChangeKind,
  planNetKurus,
  prorateKurus,
  RENEWAL_CONSENT,
  SUB_PERIODS,
  SUB_REMINDER_DAYS,
  SUB_STATUS_NAMES,
  SUBSCRIPTION_CONSENT,
  type SubPeriod,
  type SubscriptionCheckout,
  tlYaz,
  vatOfGross,
  withVat,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { ConsentService } from '../consents/consent.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { EntitlementService } from '../entitlements/entitlement.service.js';
import { FeatureFlagService } from '../flags/feature-flag.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { type Kalem, kalemler } from './order-item.js';
import { GALLERY_EXTRAS, OrdersService, siparisNo } from './orders.service.js';
import { FakePayment, PaymentProviderFactory } from './providers.js';
import { SubscriptionBilling } from './subscription-billing.js';

const DAY = 86_400_000;

const tarih = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(d);

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

/**
 * Galeri abonelikleri (Karar 12.2, 12.3, 12.5, 12.7, 38, 39; Teknik tasarım §7). Yalnızca web'den ve yalnızca galeri
 * sahibi satın alır. İlk ödemede kart ödeme kuruluşunda saklanır (PayTR Kart Saklama API), sonraki dönemler işçide
 * saklı karttan tahsil edilir. Başarısız yenileme 3 gün günde bir yeniden denenir, olmazsa abonelik askıya alınır.
 * İptal dönem sonunda geçerli olur; kalan süre için iade yapılmaz. Bu serviste iade yoktur.
 */
@Injectable()
export class SubscriptionsService {
  private readonly log = new Logger(SubscriptionsService.name);

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly providers: PaymentProviderFactory,
    private readonly orders: OrdersService,
    private readonly billing: SubscriptionBilling,
    private readonly entitlements: EntitlementService,
    private readonly flags: FeatureFlagService,
    private readonly consents: ConsentService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  private async member(userId: string, accountId: string) {
    const m = await this.db.accountMember.findUnique({
      where: { accountId_userId: { accountId, userId } },
      include: { account: { include: { gallery: true, subscription: true } } },
    });
    const g = m?.account.gallery;
    if (!m || !g) throw new NotFoundException('Galeri bulunamadı');
    return { role: m.role, account: m.account, gallery: g, sub: m.account.subscription };
  }

  private async owner(userId: string, accountId: string) {
    const r = await this.member(userId, accountId);
    if (r.role !== 'OWNER') throw new ForbiddenException('Paket ve ödemeleri yalnızca galeri sahibi yönetir');
    if (r.account.status !== 'ACTIVE') throw new ForbiddenException('Galeri hesabı askıda');
    return r;
  }

  private etkin(sub: Subscription | null) {
    return sub && sub.status !== 'ENDED'
      ? { plan: sub.plan, donem: sub.period as SubPeriod, etkin: true }
      : null;
  }

  /** Galeri paneli › Paket ve faturalar (GaleriPanel.dc.html) */
  async overview(userId: string, accountId: string) {
    const { role, gallery: g, sub } = await this.member(userId, accountId);
    if (role === 'SALES') throw new ForbiddenException('Paket ve faturaları sahip ve yönetici görür');
    const now = new Date();
    const cur = this.etkin(sub);
    const [faturalar, talep, ustSira, ekMesaj, basvuru, odeme] = await Promise.all([
      this.db.order.findMany({
        where: { accountId, status: 'PAID' },
        orderBy: { paidAt: 'desc' },
        take: 50,
        include: { invoice: { select: { status: true } } },
      }),
      this.entitlements.balance(accountId, 'talep'),
      this.entitlements.balance(accountId, 'ust_sira'),
      this.entitlements.balance(accountId, 'ilk_mesaj'),
      this.db.galleryApplication.findUnique({ where: { id: g.applicationId }, select: { data: true } }),
      this.flags.maintenance('odeme'),
    ]);
    const [calisan, arac] = await Promise.all([
      this.db.accountMember.count({ where: { accountId } }),
      this.db.portfolioVehicle.count({
        where: { accountId, status: { in: ['DRAFT', 'PENDING_EIDS', 'PUBLISHED', 'PASSIVE'] } },
      }),
    ]);
    const saglayici = this.providers.get().ad;
    const erisim = galleryAccess(g, now);
    return {
      rol: role,
      paket: {
        key: erisim.plan,
        ad: erisim.ad,
        saltOkunur: erisim.saltOkunur,
        denemeBitis: g.plan === 'deneme' ? g.trialEndsAt : null,
      },
      abonelik: sub
        ? {
            plan: sub.plan,
            planAd: GALLERY_PLANS[sub.plan as PaidPlan].ad,
            donem: sub.period,
            donemAd: SUB_PERIODS[sub.period as SubPeriod].ad,
            durum: sub.status,
            durumAd: SUB_STATUS_NAMES[sub.status],
            netKurus: Number(sub.priceKurus),
            brutKurus: withVat(Number(sub.priceKurus)),
            baslangic: sub.currentPeriodStart,
            bitis: sub.currentPeriodEnd,
            iptal: sub.cancelAtPeriodEnd,
            sonraki:
              sub.nextPlan || sub.nextPeriod
                ? {
                    plan: sub.nextPlan ?? sub.plan,
                    planAd: GALLERY_PLANS[(sub.nextPlan ?? sub.plan) as PaidPlan].ad,
                    donem: sub.nextPeriod ?? sub.period,
                    donemAd: SUB_PERIODS[(sub.nextPeriod ?? sub.period) as SubPeriod].ad,
                  }
                : null,
            yenilemeKurus: withVat(
              planNetKurus(
                (sub.nextPlan ?? sub.plan) as PaidPlan,
                (sub.nextPeriod ?? sub.period) as SubPeriod,
              ),
            ),
            kart: sub.cardLabel ?? (sub.cardToken ? 'Kayıtlı kart' : null),
            basarisizDeneme: sub.failCount,
            sonrakiDeneme: sub.nextRetryAt,
            bitisNedeni: sub.endReason,
          }
        : null,
      paketler: PAID_PLANS.map((key) => {
        const p = GALLERY_PLANS[key];
        const degisim = planChangeKind(cur, { plan: key, donem: cur?.donem ?? 'aylik' });
        const fark =
          degisim === 'yukseltme' && sub
            ? withVat(
                prorateKurus(
                  Number(sub.priceKurus),
                  planNetKurus(key, sub.period as SubPeriod),
                  sub.currentPeriodStart,
                  sub.currentPeriodEnd,
                  now,
                ),
              )
            : null;
        return {
          key,
          ad: p.ad,
          aylikKurus: p.aylik * 100,
          yillikKurus: p.yillik * 100,
          portfoy: p.portfoy,
          gunlukMesaj: p.gunlukMesaj,
          aylikTalep: p.aylikTalep,
          oneCikarma: p.oneCikarma,
          toplu: p.toplu,
          eslesme: p.eslesme,
          api: p.api,
          calisan: p.calisan,
          degisim,
          yukseltmeFarkiKurus: fark,
        };
      }),
      haklar: { talep, ustSira, ekMesaj },
      // Seçilen paketin sınırını aşan ekip ya da portföy uyarısı için (fazlası silinmez; yenisi eklenemez)
      kullanim: { calisan, arac },
      ekPaketler: GALLERY_EXTRAS.map((k) => {
        const p = PRODUCTS.find((x) => x.key === k);
        const net = Math.round((p?.tl ?? 0) * 100);
        return { key: k, ad: p?.ad ?? k, netKurus: net, brutKurus: withVat(net) };
      }),
      faturalar: faturalar.map((o) => ({
        id: o.id,
        no: o.no,
        ad: kalemler(o.items)
          .map((k) => k.ad)
          .join(', '),
        tarih: o.paidAt,
        tutarKurus: Number(o.totalKurus),
        fatura: o.invoice?.status === 'ISSUED',
      })),
      eposta:
        sub?.billingEmail ??
        ((basvuru?.data as { sahip?: { eposta?: string } } | null)?.sahip?.eposta || null),
      odeme: {
        acik: saglayici !== 'none' && !odeme.on,
        not: odeme.on ? odeme.note : saglayici === 'none' ? 'Ödemeler yakında açılacak' : null,
      },
    };
  }

  private fatura(
    g: { legalName: string; il: string; ilce: string; taxNo: string; taxOffice: string },
    eposta: string,
  ): Billing {
    return {
      ad: g.legalName.slice(0, 120),
      eposta,
      il: g.il,
      ilce: g.ilce,
      kurumsal: { unvan: g.legalName.slice(0, 200), vergiNo: g.taxNo, vergiDairesi: g.taxOffice },
    };
  }

  /** Doldurulmuş ön bilgilendirme (abonelik): paket, dönem, tutar, yenileme ve iptal koşulları */
  private async preInfo(k: Kalem, yenileme: string, tx: Tx) {
    const t = await this.consents.current('galeri_sozlesmesi', tx);
    return [
      `# Galeri aboneliği ön bilgilendirmesi${t ? ` (Galeri Hizmet Sözleşmesi sürüm ${t.version})` : ''}`,
      '',
      `- ${k.ad}: ${tlYaz(k.netKurus ?? 0)} + KDV = ${tlYaz(k.tutarKurus)}`,
      `- ${yenileme}`,
      '- İptal istendiğinde dönem sonunda geçerli olur; dönem sonuna kadar paket kullanılır, kalan süre için iade yapılmaz.',
      '- Başarısız yenileme 3 gün içinde yeniden denenir; ödeme alınamazsa abonelik askıya alınır.',
      '- Fiyat artışı en az 30 gün önce bildirilir ve sonraki yenilemede uygulanır.',
      '',
      t?.body ?? '',
    ].join('\n');
  }

  /**
   * Paket satın alma, üst pakete geçiş ya da bekleyen yenilemenin ödenmesi: sipariş ve onaylar aynı işlemde yazılır,
   * kart sayfası açılır (kart ödeme kuruluşunda saklanır).
   */
  async checkout(
    userId: string,
    accountId: string,
    input: SubscriptionCheckout | { yenile: true; eposta: string; onay: { sozlesme: true; yenileme: true } },
    meta: { ip?: string },
  ) {
    await this.flags.assertAvailable('odeme');
    if (this.providers.get().ad === 'none')
      throw new ServiceUnavailableException('Ödemeler yakında açılacak');
    const { gallery: g, sub } = await this.owner(userId, accountId);
    const now = new Date();
    let kind: 'abonelik' | 'yukseltme' | 'yenileme';
    let plan: PaidPlan;
    let donem: SubPeriod;
    let net: number;
    let ad: string;
    let yenilemeNotu: string;

    if ('yenile' in input) {
      if (sub?.status !== 'PAST_DUE') throw new BadRequestException('Bekleyen bir yenileme ödemesi yok');
      kind = 'yenileme';
      plan = (sub.nextPlan ?? sub.plan) as PaidPlan;
      donem = (sub.nextPeriod ?? sub.period) as SubPeriod;
      net = planNetKurus(plan, donem);
      const bitis = addMonths(sub.currentPeriodEnd, SUB_PERIODS[donem].ay);
      ad = `${GALLERY_PLANS[plan].ad} paket · ${SUB_PERIODS[donem].ad} (${tarih(sub.currentPeriodEnd)} – ${tarih(bitis)})`;
      yenilemeNotu = `Dönem ${tarih(bitis)} tarihinde kayıtlı karttan aynı tutarla kendiliğinden yenilenir.`;
    } else {
      plan = input.plan;
      const degisim = planChangeKind(this.etkin(sub), { plan: input.plan, donem: input.donem });
      if (degisim === 'ayni') throw new ConflictException('Zaten bu paketi kullanıyorsun');
      if (degisim === 'sonraki_donem') {
        throw new BadRequestException('Alt pakete ve ödeme dönemi değişikliğine sonraki dönemde geçilir');
      }
      if (degisim === 'yukseltme') {
        if (sub?.status !== 'ACTIVE') throw new BadRequestException('Önce bekleyen ödemeyi tamamla');
        kind = 'yukseltme';
        donem = sub.period as SubPeriod;
        net = prorateKurus(
          Number(sub.priceKurus),
          planNetKurus(plan, donem),
          sub.currentPeriodStart,
          sub.currentPeriodEnd,
          now,
        );
        if (net < 100) throw new BadRequestException('Dönem bitmek üzere; yeni pakete yenilemede geç');
        ad = `${GALLERY_PLANS[plan].ad} pakete geçiş · ${tarih(sub.currentPeriodEnd)} tarihine kadar fark`;
        yenilemeNotu = `${tarih(sub.currentPeriodEnd)} tarihinde ${GALLERY_PLANS[plan].ad} paket ${tlYaz(withVat(planNetKurus(plan, donem)))} ile yenilenir.`;
      } else {
        kind = 'abonelik';
        donem = input.donem;
        net = planNetKurus(plan, donem);
        const bitis = addMonths(now, SUB_PERIODS[donem].ay);
        ad = `${GALLERY_PLANS[plan].ad} paket · ${SUB_PERIODS[donem].ad} (${tarih(now)} – ${tarih(bitis)})`;
        yenilemeNotu = `Dönem ${tarih(bitis)} tarihinde kayıtlı karttan aynı tutarla kendiliğinden yenilenir.`;
      }
    }

    const brut = withVat(net);
    const kalem: Kalem = {
      urun: 'abonelik',
      ad,
      adet: 1,
      birimKurus: brut,
      tutarKurus: brut,
      netKurus: net,
      plan,
      donem,
    };
    const fatura = this.fatura(g, input.eposta);
    const no = siparisNo();
    const id = uuidv7();
    await this.db.$transaction(async (tx) => {
      const bekleyen = await tx.order.count({
        where: { accountId, kind: { not: 'urun' }, status: 'PENDING', channel: 'otomatik' },
      });
      if (bekleyen) throw new ConflictException('Yenileme ödemesi işleniyor; birazdan yeniden dene');
      const surumler = await this.consents.recordSubscription(tx, userId, meta.ip);
      await tx.order.create({
        data: {
          id,
          no,
          accountId,
          userId,
          channel: 'web',
          kind,
          subscriptionId: sub?.id ?? null,
          items: [kalem] as unknown as Prisma.InputJsonValue,
          totalKurus: BigInt(brut),
          vatKurus: BigInt(vatOfGross(brut)),
          billing: fatura as unknown as Prisma.InputJsonValue,
          consents: {
            sozlesme: SUBSCRIPTION_CONSENT,
            yenileme: RENEWAL_CONSENT,
            surumler,
            zaman: now.toISOString(),
          },
          preInfo: await this.preInfo(kalem, yenilemeNotu, tx),
          provider: this.providers.get().ad,
          userIp: meta.ip ?? null,
        },
      });
    });
    return { no, odemeAdresi: `${this.env.API_PUBLIC_URL}/odeme/kart/${no}`, toplamKurus: brut };
  }

  /** Kart sayfası: PayTR'de kart formu doğrudan PayTR'ye gönderilir; sahte sağlayıcıda sahte sayfaya yönlenir */
  async cardPage(no: string): Promise<{ yonlendir?: string; html?: string }> {
    const o = await this.db.order.findUnique({
      where: { no },
      include: { user: { select: { phone: true } }, subscription: true },
    });
    if (!o || o.kind === 'urun') throw new NotFoundException('Sipariş bulunamadı');
    const provider = this.providers.get();
    if (provider instanceof FakePayment) return { yonlendir: `/odeme/sahte/${encodeURIComponent(no)}` };
    if (o.status !== 'PENDING') return { html: sayfa('<p>Bu sipariş artık beklemede değil.</p>') };
    const b = o.billing as Billing;
    const form = provider.cardForm({
      oid: o.no,
      amountKurus: Number(o.totalKurus),
      email: b.eposta,
      userIp: o.userIp ?? '127.0.0.1',
      basket: kalemler(o.items).map((k) => [k.ad, (k.birimKurus / 100).toFixed(2), k.adet]),
      userName: b.ad,
      userAddress: `${b.ilce} / ${b.il}`,
      userPhone: o.user.phone,
      ...this.orders.returnUrls(o.no, true),
      utoken: o.subscription?.cardToken ? this.billing.box.open(o.subscription.cardToken) : null,
    });
    const gizli = Object.entries(form.fields)
      .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
      .join('');
    const alan = (ad: string, name: string, attrs: string) =>
      `<label style="display:block;margin-top:12px;font-size:13px;font-weight:700">${ad}<input name="${name}" ${attrs} required style="display:block;width:100%;box-sizing:border-box;margin-top:6px;border:1px solid #E3E6EF;border-radius:12px;padding:12px;font:500 15px system-ui"></label>`;
    return {
      html: sayfa(`<form method="post" action="${esc(form.action)}">${gizli}
<p style="margin:0 0 4px;font-size:15px">Tutar: <strong>${tlYaz(Number(o.totalKurus))}</strong> (KDV dahil)</p>
${alan('Kart üzerindeki isim', 'cc_owner', 'maxlength="50" autocomplete="cc-name"')}
${alan('Kart numarası', 'card_number', 'inputmode="numeric" maxlength="16" autocomplete="cc-number"')}
<div style="display:flex;gap:10px">${alan('Ay', 'expiry_month', 'inputmode="numeric" maxlength="2" placeholder="AA" autocomplete="cc-exp-month"')}${alan('Yıl', 'expiry_year', 'inputmode="numeric" maxlength="2" placeholder="YY" autocomplete="cc-exp-year"')}${alan('CVV', 'cvv', 'inputmode="numeric" maxlength="4" autocomplete="cc-csc"')}</div>
<p style="font-size:12.5px;color:#5A6073;margin:12px 0 0">Kart bilgilerin doğrudan PayTR'ye gönderilir; Rengarenk sunucularına gelmez. Kart PayTR'de saklanır ve sonraki dönemler bu karttan çekilir.</p>
<button style="width:100%;border:0;border-radius:12px;padding:14px;margin-top:14px;font:800 15px system-ui;background:#1E2333;color:#fff;cursor:pointer">Öde ve kartı kaydet</button></form>`),
    };
  }

  /** Sonraki dönem: alt paket ya da ödeme dönemi değişikliği; aynı paketi seçmek değişikliği geri alır */
  async schedule(userId: string, accountId: string, next: { plan: PaidPlan; donem: SubPeriod }) {
    const { sub } = await this.owner(userId, accountId);
    if (!sub || sub.status === 'ENDED') throw new BadRequestException('Etkin bir abonelik yok');
    const degisim = planChangeKind(this.etkin(sub), next);
    if (degisim === 'yukseltme')
      throw new BadRequestException('Üst pakete hemen geçilir; ödeme ekranından devam et');
    const ayni = degisim === 'ayni';
    await this.db.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          nextPlan: ayni || next.plan === sub.plan ? null : next.plan,
          nextPeriod: ayni || next.donem === sub.period ? null : next.donem,
        },
      });
      await this.audit.record(
        {
          actorType: 'USER',
          actorId: userId,
          action: 'abonelik_degisti',
          entityType: 'subscription',
          entityId: sub.id,
          before: { plan: sub.nextPlan ?? sub.plan, donem: sub.nextPeriod ?? sub.period },
          after: { plan: next.plan, donem: next.donem },
        },
        tx,
      );
      await this.outbox.add(tx, 'abonelik.degisti', { accountId, plan: next.plan, donem: next.donem });
    });
    return this.overview(userId, accountId);
  }

  /** İptal (Karar 39): dönem sonunda geçerli; dönem bitene kadar geri alınabilir */
  async cancel(userId: string, accountId: string, iptal: boolean) {
    const { sub } = await this.owner(userId, accountId);
    if (!sub || sub.status === 'ENDED') throw new BadRequestException('Etkin bir abonelik yok');
    if (sub.cancelAtPeriodEnd !== iptal) {
      await this.db.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { cancelAtPeriodEnd: iptal, cancelRequestedAt: iptal ? new Date() : null },
        });
        await this.audit.record(
          {
            actorType: 'USER',
            actorId: userId,
            action: iptal ? 'abonelik_iptal' : 'abonelik_iptal_geri',
            entityType: 'subscription',
            entityId: sub.id,
            after: { bitis: sub.currentPeriodEnd.toISOString() },
          },
          tx,
        );
        if (iptal) {
          await this.outbox.add(tx, 'abonelik.iptal_edildi', {
            accountId,
            bitis: sub.currentPeriodEnd.toISOString(),
          });
        }
      });
    }
    return this.overview(userId, accountId);
  }

  // ── İşçi ──────────────────────────────────────────────────────

  /** Kart kaydedildikten sonra gösterim adı ("VISA •••• 4242") ödeme kuruluşundan alınır */
  async refreshCard(accountId: string) {
    const sub = await this.db.subscription.findUnique({ where: { accountId } });
    if (!sub?.cardToken) return null;
    const [kart] = await this.providers.get().cards(this.billing.box.open(sub.cardToken));
    if (!kart) return null;
    const label = `${kart.schema} •••• ${kart.last4}`;
    await this.db.subscription.update({ where: { id: sub.id }, data: { cardLabel: label } });
    return label;
  }

  /** Yenileme hatırlatması: aylıkta 7, yıllıkta 30 gün önce (Karar 39) */
  async remindDue(now = new Date()) {
    const subs = await this.db.subscription.findMany({
      where: { status: 'ACTIVE', cancelAtPeriodEnd: false, currentPeriodEnd: { gt: now } },
    });
    let n = 0;
    for (const s of subs) {
      const donem = (s.nextPeriod ?? s.period) as SubPeriod;
      if (s.currentPeriodEnd.getTime() - now.getTime() > SUB_REMINDER_DAYS[donem] * DAY) continue;
      if (s.remindedFor?.getTime() === s.currentPeriodEnd.getTime()) continue;
      await this.db.$transaction(async (tx) => {
        const r = await tx.subscription.updateMany({
          where: { id: s.id, OR: [{ remindedFor: null }, { remindedFor: { not: s.currentPeriodEnd } }] },
          data: { remindedFor: s.currentPeriodEnd },
        });
        if (r.count !== 1) return;
        await this.outbox.add(tx, 'abonelik.yenileme_yaklasti', {
          accountId: s.accountId,
          tarih: s.currentPeriodEnd.toISOString(),
          tutarKurus: withVat(planNetKurus((s.nextPlan ?? s.plan) as PaidPlan, donem)),
        });
        n++;
      });
    }
    return n;
  }

  /** Yıllık ödemede aylık hak döngüsü: her ay kullanılmayan paket hakları düşer, yenileri verilir (Karar 12.3) */
  async cycleDue(now = new Date()) {
    const subs = await this.db.subscription.findMany({ where: { status: { in: ['ACTIVE', 'PAST_DUE'] } } });
    let n = 0;
    for (const s of subs) {
      const sonraki = addMonths(s.quotaCycleStart, 1);
      if (sonraki > now || sonraki >= s.currentPeriodEnd) continue;
      await this.db.$transaction(async (tx) => {
        const [k] = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM subscriptions WHERE id = ${s.id}::uuid AND quota_cycle_no = ${s.quotaCycleNo}
          FOR UPDATE SKIP LOCKED`;
        if (!k) return;
        await this.billing.nextCycle(tx, s, sonraki, s.plan as PaidPlan, 'sistem');
        n++;
      });
    }
    return n;
  }

  /**
   * Dönem sonu: iptal edilmişse abonelik biter; değilse saklı karttan yenileme ödemesi alınır. Başarısız ödeme günde bir,
   * 3 gün yeniden denenir. Aynı abonelik için bekleyen bir çekim varsa yenisi başlatılmaz (çift tahsilat olmaz).
   */
  async renewDue(now = new Date()) {
    const subs = await this.db.subscription.findMany({
      where: {
        OR: [
          { status: 'ACTIVE', currentPeriodEnd: { lte: now } },
          { status: 'PAST_DUE', nextRetryAt: { lte: now } },
        ],
      },
      include: {
        account: { include: { gallery: true } },
        orders: { where: { status: 'PENDING', channel: 'otomatik' }, select: { id: true } },
      },
    });
    let yenilenen = 0;
    let biten = 0;
    let basarisiz = 0;
    for (const s of subs) {
      if (s.orders.length) continue;
      const g = s.account.gallery;
      if (!g) continue;
      if (s.status === 'ACTIVE' && s.cancelAtPeriodEnd) {
        await this.db.$transaction((tx) => this.billing.end(tx, s, 'iptal'));
        biten++;
        continue;
      }
      const plan = (s.nextPlan ?? s.plan) as PaidPlan;
      const donem = (s.nextPeriod ?? s.period) as SubPeriod;
      const net = planNetKurus(plan, donem);
      const brut = withVat(net);
      const bitis = addMonths(s.currentPeriodEnd, SUB_PERIODS[donem].ay);
      const kalem: Kalem = {
        urun: 'abonelik',
        ad: `${GALLERY_PLANS[plan].ad} paket · ${SUB_PERIODS[donem].ad} (${tarih(s.currentPeriodEnd)} – ${tarih(bitis)})`,
        adet: 1,
        birimKurus: brut,
        tutarKurus: brut,
        netKurus: net,
        plan,
        donem,
      };
      const no = siparisNo();
      const id = uuidv7();
      const fatura = this.fatura(g, s.billingEmail);
      const olustu = await this.db.$transaction(async (tx) => {
        const [k] = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM subscriptions WHERE id = ${s.id}::uuid AND updated_at = ${s.updatedAt} FOR UPDATE SKIP LOCKED`;
        if (!k) return false;
        const ilk = await tx.order.findFirst({
          where: { subscriptionId: s.id, status: 'PAID', channel: 'web' },
          orderBy: { paidAt: 'desc' },
          select: { no: true, userIp: true },
        });
        await tx.order.create({
          data: {
            id,
            no,
            accountId: s.accountId,
            userId: s.userId,
            channel: 'otomatik',
            kind: 'yenileme',
            subscriptionId: s.id,
            items: [kalem] as unknown as Prisma.InputJsonValue,
            totalKurus: BigInt(brut),
            vatKurus: BigInt(vatOfGross(brut)),
            billing: fatura as unknown as Prisma.InputJsonValue,
            consents: { otomatikYenileme: RENEWAL_CONSENT, ilkSiparis: ilk?.no ?? null },
            preInfo: `# Otomatik yenileme\n\n- ${kalem.ad}: ${tlYaz(net)} + KDV = ${tlYaz(brut)}`,
            provider: this.providers.get().ad,
            userIp: ilk?.userIp ?? null,
          },
        });
        // Satır değişti: aynı anda çalışan ikinci işçi bu aboneliği atlar
        await tx.subscription.update({ where: { id: s.id }, data: { updatedAt: new Date() } });
        return true;
      });
      if (!olustu) continue;
      const sonuc = await this.charge(id);
      if (sonuc === 'failed') basarisiz++;
      else yenilenen++;
    }
    return { yenilenen, biten, basarisiz };
  }

  /** Saklı karttan çekim; senkron ret hemen işlenir, kesin sonuç bildirimle gelir */
  private async charge(orderId: string): Promise<'success' | 'failed' | 'wait_callback'> {
    const o = await this.db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { subscription: true, user: { select: { phone: true } } },
    });
    const provider = this.providers.get();
    const fail = async (neden: string) => {
      await this.db.$transaction(async (tx) => {
        const r = await tx.order.updateMany({
          where: { id: o.id, status: 'PENDING' },
          data: { status: 'FAILED', failReason: neden.slice(0, 300) },
        });
        if (r.count === 1) await this.billing.onRenewalFailed(tx, o, neden);
      });
      return 'failed' as const;
    };
    if (provider.ad === 'none') return fail('Ödeme altyapısı kapalı');
    const token = o.subscription?.cardToken;
    if (!token) return fail('Kayıtlı kart yok');
    try {
      const utoken = this.billing.box.open(token);
      const [kart] = await provider.cards(utoken);
      if (!kart) return fail('Kayıtlı kart bulunamadı');
      const b = o.billing as Billing;
      const r = await provider.chargeStored({
        oid: o.no,
        amountKurus: Number(o.totalKurus),
        email: b.eposta,
        userIp: o.userIp ?? '127.0.0.1',
        basket: kalemler(o.items).map((k) => [k.ad, (k.birimKurus / 100).toFixed(2), k.adet]),
        userName: b.ad,
        userAddress: `${b.ilce} / ${b.il}`,
        userPhone: o.user.phone,
        ...this.orders.returnUrls(o.no, true),
        utoken,
        ctoken: kart.ctoken,
      });
      if (r.status === 'failed') return fail(r.message ?? 'Kart reddedildi');
      // Sahte sağlayıcı bildirimi kendisi gönderir (gerçekte PayTR bildirim adresine yollar)
      if (provider instanceof FakePayment) {
        await this.orders.notify(provider.notification(o.no, 'success', Number(o.totalKurus)));
      }
      return r.status;
    } catch (e) {
      // Bağlantı hatasında çekimin yapılıp yapılmadığı bilinmez: sipariş beklemede kalır, bildirim beklenir
      this.log.error(`yenileme çekimi ${o.no}: ${(e as Error).message}`);
      return 'wait_callback';
    }
  }
}

function sayfa(govde: string) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kart bilgileri</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#F6F8FD;color:#1E2333"><div style="max-width:440px;margin:0 auto;padding:20px">
<h1 style="font-size:19px;margin:0 0 10px">Kart bilgileri</h1>${govde}</div></body></html>`;
}
