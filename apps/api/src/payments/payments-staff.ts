import { Controller, Get, Inject, Injectable, Query, Req, UseGuards } from '@nestjs/common';
import type { Prisma } from '@rengarenk/db';
import {
  GALLERY_PLANS,
  ORDER_STATUS_NAMES,
  type PaidPlan,
  planNetKurus,
  SUB_PERIODS,
  SUB_STATUS_NAMES,
  type SubPeriod,
  withVat,
} from '@rengarenk/shared';
import { type Db, PRISMA } from '../database/prisma.js';
import { RequirePermission } from '../staff/permissions.js';
import { StaffGuard, type StaffRequest } from '../staff/staff.guard.js';
import { kalemler } from './order-item.js';

const DAY = 86_400_000;
const FILTRELER = ['tum', 'odendi', 'basarisiz', 'bekliyor'] as const;
type Filtre = (typeof FILTRELER)[number];
const TURLER = ['tum', 'bireysel', 'galeri', 'magaza'] as const;
type Tur = (typeof TURLER)[number];

const tarihKisa = (d: Date) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' }).format(d);

/** "Ayşe Yılmaz" → "Ayşe Y." (kişisel veriyi açık görme yetkisi yoksa) */
const kisalt = (ad: string | null, soyad: string | null) =>
  [ad, soyad ? `${soyad.slice(0, 1)}.` : null].filter(Boolean).join(' ') || 'Adsız üye';

/** İstanbul saatiyle bu ayın ilk anı */
const ayBasi = () => {
  const tr = new Date(Date.now() + 3 * 3600_000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), 1) - 3 * 3600_000);
};

/**
 * Konsol › Ödemeler ve faturalar (Yonetim.dc.html › Ödemeler; Karar 13.4). Siparişler, durum ve fatura; galeri
 * abonelikleri ve başarısız yenilemeler; incelenecek mağaza bildirimleri. Yalnızca görüntüleme: hak tanımlama ve iade
 * buradan yapılmaz (iade yalnızca sahibin onayıyla, ayrı süreçte).
 */
@Injectable()
export class PaymentsStaffService {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  async overview(acikAd: boolean, filtre: Filtre, tur: Tur) {
    const now = new Date();
    const where: Prisma.OrderWhereInput = {
      ...(filtre === 'odendi'
        ? { status: 'PAID' }
        : filtre === 'basarisiz'
          ? { status: 'FAILED' }
          : filtre === 'bekliyor'
            ? { status: 'PENDING' }
            : { status: { in: ['PAID', 'FAILED', 'PENDING'] } }),
      ...(tur === 'bireysel'
        ? { account: { kind: 'INDIVIDUAL' }, channel: 'web' }
        : tur === 'galeri'
          ? { account: { kind: { not: 'INDIVIDUAL' } } }
          : tur === 'magaza'
            ? { channel: { in: ['ios', 'android'] } }
            : {}),
      // Uygulamada açılıp mağazada tamamlanmayan niyetler listeyi doldurmasın
      NOT: { provider: 'magaza', status: 'PENDING' },
    };
    const [siparisler, ay, bugun, basarisiz30, bekleyenFatura, abonelikler, inceleme, uyusmazlik] =
      await Promise.all([
        this.db.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            invoice: { select: { status: true, attempts: true, lastError: true } },
            account: { select: { kind: true, gallery: { select: { displayName: true } } } },
            user: { select: { firstName: true, lastName: true } },
            subscription: { select: { status: true, nextRetryAt: true, failCount: true } },
          },
        }),
        this.db.order.aggregate({
          where: { status: 'PAID', paidAt: { gte: ayBasi() } },
          _sum: { totalKurus: true },
          _count: true,
        }),
        this.db.order.aggregate({
          where: { status: 'PAID', paidAt: { gte: new Date(now.getTime() - DAY) } },
          _sum: { totalKurus: true },
        }),
        this.db.order.count({
          where: { status: 'FAILED', createdAt: { gte: new Date(now.getTime() - 30 * DAY) } },
        }),
        this.db.invoice.count({ where: { status: 'PENDING' } }),
        this.db.subscription.findMany({
          orderBy: [{ status: 'asc' }, { currentPeriodEnd: 'asc' }],
          take: 100,
          include: { account: { select: { gallery: { select: { displayName: true } } } } },
        }),
        this.db.storeEvent.findMany({
          where: { result: 'inceleme' },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.db.outboxEvent.count({
          where: { type: { in: ['odeme.uyusmazlik', 'abonelik.bildirim_gelmedi'] } },
        }),
      ]);

    const etkin = abonelikler.filter((s) => s.status !== 'ENDED');
    // Aylık tekrarlayan gelir (KDV hariç): yıllık abonelik 12'ye bölünür
    const mrr = etkin.reduce(
      (t, s) => t + Math.round(Number(s.priceKurus) / SUB_PERIODS[s.period as SubPeriod].ay),
      0,
    );

    return {
      ozet: {
        ayTahsilatKurus: Number(ay._sum.totalKurus ?? 0n),
        ayAdet: ay._count,
        bugunKurus: Number(bugun._sum.totalKurus ?? 0n),
        basarisiz30,
        gecikenAbonelik: etkin.filter((s) => s.status === 'PAST_DUE').length,
        etkinAbonelik: etkin.length,
        mrrKurus: mrr,
        bekleyenFatura,
        inceleme: inceleme.length + uyusmazlik,
      },
      siparisler: siparisler.map((o) => {
        const galeri = o.account.gallery?.displayName ?? null;
        const k = kalemler(o.items);
        const magaza = o.channel === 'ios' || o.channel === 'android';
        let fatura: string;
        if (o.status !== 'PAID') {
          if (o.kind === 'yenileme' && o.status === 'FAILED' && o.subscription) {
            fatura =
              o.subscription.status === 'ENDED'
                ? 'Abonelik askıya alındı'
                : o.subscription.nextRetryAt
                  ? `${o.failReason ?? 'Ödeme alınamadı'} · ${o.subscription.failCount + 1}. deneme ${tarihKisa(o.subscription.nextRetryAt)}`
                  : (o.failReason ?? 'Ödeme alınamadı');
          } else fatura = o.failReason ?? '—';
        } else if (magaza) fatura = `Faturayı ${o.channel === 'ios' ? 'Apple' : 'Google Play'} keser`;
        else if (o.invoice?.status === 'ISSUED') fatura = 'E-arşiv kesildi';
        else fatura = o.invoice?.lastError ? 'Fatura kuyrukta · entegratör bekleniyor' : 'Fatura kuyrukta';
        return {
          id: o.id,
          no: o.no,
          musteri:
            galeri ??
            (acikAd
              ? [o.user.firstName, o.user.lastName].filter(Boolean).join(' ') || 'Adsız üye'
              : kisalt(o.user.firstName, o.user.lastName)),
          galeri: !!galeri,
          kanal: o.channel,
          kalem: k.map((x) => (x.talepBaslik ? `${x.ad} · ${x.talepBaslik}` : x.ad)).join(', '),
          tarih: o.paidAt ?? o.createdAt,
          tutarKurus: Number(o.totalKurus),
          durum: o.status,
          durumAd: ORDER_STATUS_NAMES[o.status],
          fatura,
        };
      }),
      abonelikler: abonelikler.map((s) => ({
        id: s.id,
        galeri: s.account.gallery?.displayName ?? '—',
        plan: GALLERY_PLANS[s.plan as PaidPlan].ad,
        donem: SUB_PERIODS[s.period as SubPeriod].ad,
        durum: s.status,
        durumAd:
          s.cancelAtPeriodEnd && s.status === 'ACTIVE'
            ? 'İptal edildi (dönem sonunda biter)'
            : SUB_STATUS_NAMES[s.status],
        bitis: s.currentPeriodEnd,
        yenilemeKurus: withVat(
          planNetKurus((s.nextPlan ?? s.plan) as PaidPlan, (s.nextPeriod ?? s.period) as SubPeriod),
        ),
        kart: s.cardLabel,
        basarisizDeneme: s.failCount,
        sonrakiDeneme: s.nextRetryAt,
        bitisNedeni: s.endReason,
      })),
      magaza: inceleme.map((e) => ({
        id: e.id,
        tarih: e.createdAt,
        tur: e.type,
        urun: e.productId,
        magaza:
          e.store === 'PLAY_STORE' ? 'Google Play' : e.store === 'APP_STORE' ? 'App Store' : (e.store ?? '—'),
        not: e.note,
      })),
    };
  }
}

@Controller('staff/payments')
@UseGuards(StaffGuard)
export class PaymentsStaffController {
  constructor(private readonly payments: PaymentsStaffService) {}

  /** Raporu görebilen herkes; müşteri adı kişisel veriyi açık görme yetkisiyle tam, değilse kısaltılmış */
  @Get()
  @RequirePermission('rapor.gor', 'maskeli')
  overview(@Req() req: StaffRequest, @Query('durum') durum?: string, @Query('tur') tur?: string) {
    return this.payments.overview(
      req.staff.grants['kisisel_veri.gor'] === 'tam',
      (FILTRELER as readonly string[]).includes(durum ?? '') ? (durum as Filtre) : 'tum',
      (TURLER as readonly string[]).includes(tur ?? '') ? (tur as Tur) : 'tum',
    );
  }
}
