import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Order } from '@rengarenk/db';
import {
  productByKey,
  REFUND_STATUS_NAMES,
  REFUND_WINDOW_DAYS,
  type RefundRequest,
  tlYaz,
} from '@rengarenk/shared';
import { type Actor, ApprovalService } from '../approvals/approval.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { kalemler } from '../payments/order-item.js';

const DAY = 86_400_000;

export interface QuoteLine {
  ad: string;
  tutarKurus: number;
  /** Sistemin önerdiği iade */
  onerilenKurus: number;
  not: string;
}

/**
 * İade önerisi ve isteği (Karar 39, 40; Teknik tasarım §7). Bu servis para iadesi yapmaz ve iade kaydı açmaz: yalnızca
 * tutarı hesaplar ve onay motorunda REFUND isteği açar. İadeyi yalnızca Sahip onaylar; onaylanan iadeyi ayrı "iade
 * yürütücü" süreci yapar. Mağaza satışlarının iadesi App Store ve Google Play üzerinden yapılır.
 */
@Injectable()
export class RefundsService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly approvals: ApprovalService,
  ) {}

  private async bakiye(accountId: string, kind: string) {
    const r = await this.db.entitlementLedger.aggregate({
      where: { accountId, kind },
      _sum: { delta: true },
    });
    return r._sum.delta ?? 0;
  }

  /** Abonelik siparişinden sonra paketin hakkı kullanıldı mı (talep, öne çıkarma, paketle ilk mesaj) */
  private async paketKullanildi(o: Order, since: Date) {
    const [hak, mesaj] = await Promise.all([
      this.db.entitlementLedger.count({
        where: {
          accountId: o.accountId,
          kind: { in: ['talep', 'ust_sira'] },
          reason: 'kullanim',
          createdAt: { gte: since },
        },
      }),
      this.db.conversation.count({
        where: { sellerAccountId: o.accountId, entitlement: 'paket', createdAt: { gte: since } },
      }),
    ]);
    return hak + mesaj > 0;
  }

  /** Siparişin iade edilebilir durumu ve sistemin önerdiği tutar */
  async quote(orderId: string) {
    const o = await this.db.order.findUnique({
      where: { id: orderId },
      include: {
        payments: { where: { status: 'success' }, orderBy: { createdAt: 'asc' }, take: 1 },
        refunds: { select: { amountKurus: true, status: true } },
        user: { select: { firstName: true, lastName: true } },
        account: { select: { gallery: { select: { displayName: true } } } },
      },
    });
    if (!o) throw new NotFoundException('Sipariş bulunamadı');
    const odeme = o.payments[0];
    const toplam = Number(o.totalKurus);
    const iadeEdilen = o.refunds
      .filter((r) => r.status !== 'FAILED')
      .reduce((t, r) => t + Number(r.amountKurus), 0);
    const musteri =
      o.account.gallery?.displayName ??
      ([o.user.firstName, o.user.lastName?.slice(0, 1)].filter(Boolean).join(' ') +
        (o.user.lastName ? '.' : '') ||
        'Adsız üye');
    const gun = o.paidAt ? Math.floor((Date.now() - o.paidAt.getTime()) / DAY) : 0;
    const temel = {
      siparis: { id: o.id, no: o.no, tarih: o.paidAt, tutarKurus: toplam, kanal: o.channel, musteri },
      iadeEdilenKurus: iadeEdilen,
      enFazlaKurus: Math.max(0, toplam - iadeEdilen),
      gun,
      sure: REFUND_WINDOW_DAYS,
    };
    if (o.status !== 'PAID' || !odeme) {
      return { ...temel, iadeEdilemez: 'Ödenmemiş sipariş iade edilemez', kalemler: [], onerilenKurus: 0 };
    }
    if (o.channel === 'ios' || o.channel === 'android') {
      return {
        ...temel,
        iadeEdilemez: `Uygulama içi satışın iadesi ${o.channel === 'ios' ? 'Apple' : 'Google Play'} üzerinden yapılır`,
        kalemler: [],
        onerilenKurus: 0,
      };
    }
    const bekleyen = await this.db.approval.count({
      where: {
        kind: 'REFUND',
        subjectType: 'payment',
        subjectId: odeme.id,
        OR: [{ status: 'PENDING' }, { status: 'APPROVED', refunds: { none: {} } }],
      },
    });
    const sureIcinde = gun <= REFUND_WINDOW_DAYS;
    const satirlar: QuoteLine[] = [];

    if (o.kind === 'urun') {
      for (const k of kalemler(o.items)) {
        const p = productByKey(k.urun);
        const hak = p?.hak
          ? { kind: p.hak.kind as string, adet: p.hak.adet }
          : p?.oneCikarma && !k.talepId
            ? { kind: p.oneCikarma.tur as string, adet: 1 }
            : null;
        if (!hak) {
          satirlar.push({
            ad: k.talepBaslik ? `${k.ad} · ${k.talepBaslik}` : k.ad,
            tutarKurus: k.tutarKurus,
            onerilenKurus: 0,
            not: 'Öne çıkarma başladı; hizmet başladıktan sonra cayma hakkı yok (m.15/1-h)',
          });
          continue;
        }
        const kalan = Math.min(hak.adet, Math.max(0, await this.bakiye(o.accountId, hak.kind)));
        const oranli = Math.round((k.tutarKurus * kalan) / hak.adet);
        satirlar.push({
          ad: k.ad,
          tutarKurus: k.tutarKurus,
          onerilenKurus: sureIcinde ? oranli : 0,
          not: !sureIcinde
            ? `${REFUND_WINDOW_DAYS} gün geçti; yalnızca hesap kapatmada kullanılmamış kısım (${tlYaz(oranli)}) iade edilir`
            : kalan === hak.adet
              ? 'Kullanılmadı: tam iade'
              : kalan === 0
                ? 'Tamamı kullanıldı'
                : `${hak.adet - kalan} / ${hak.adet} kullanıldı: kalan kısım oranlı`,
        });
      }
    } else {
      const k = kalemler(o.items)[0];
      const yillik = k?.donem === 'yillik' && o.kind !== 'yukseltme';
      const kullanildi = o.paidAt ? await this.paketKullanildi(o, o.paidAt) : true;
      const tam = yillik && sureIcinde && !kullanildi;
      satirlar.push({
        ad: k?.ad ?? 'Galeri paketi',
        tutarKurus: toplam,
        onerilenKurus: tam ? toplam : 0,
        not: tam
          ? `Yıllık paket ${REFUND_WINDOW_DAYS} gün içinde ve kullanılmadı: tam iade; iade yürütülünce abonelik biter`
          : yillik && kullanildi
            ? 'Yıllık paket kullanıldı: kısmi iade yapılmaz (Karar 39)'
            : yillik
              ? `${REFUND_WINDOW_DAYS} gün geçti: iade yapılmaz (Karar 39)`
              : 'Aylık pakette ve paket geçişinde kısmi iade yapılmaz; iptal dönem sonunda geçerli (Karar 39)',
      });
    }
    const onerilen = Math.min(
      temel.enFazlaKurus,
      satirlar.reduce((t, s) => t + s.onerilenKurus, 0),
    );
    return {
      ...temel,
      iadeEdilemez: bekleyen ? 'Bu ödeme için bekleyen bir iade isteği var' : null,
      odemeId: odeme.id,
      kalemler: satirlar,
      onerilenKurus: onerilen,
    };
  }

  /** İade isteği: onay motorunda REFUND (yalnızca Sahip onaylar). Para iadesi burada yapılmaz. */
  async request(actor: Actor, input: RefundRequest, ip?: string) {
    const q = await this.quote(input.siparis);
    if (q.iadeEdilemez || !('odemeId' in q) || !q.odemeId) {
      throw new ConflictException(q.iadeEdilemez ?? 'Bu sipariş iade edilemez');
    }
    if (input.tutarKurus > q.enFazlaKurus) {
      throw new BadRequestException(`İade tutarı en çok ${tlYaz(q.enFazlaKurus)} olabilir`);
    }
    const a = await this.approvals.request(
      actor,
      {
        kind: 'REFUND',
        subjectType: 'payment',
        subjectId: q.odemeId,
        amountKurus: BigInt(input.tutarKurus),
        title: `İade · ${q.siparis.musteri} · ${q.siparis.no}`,
        reason: input.neden,
        payload: {
          orderId: q.siparis.id,
          no: q.siparis.no,
          odenenKurus: q.siparis.tutarKurus,
          onerilenKurus: q.onerilenKurus,
          kalemler: q.kalemler.map((k) => `${k.ad}: ${k.not}`),
        },
      },
      undefined,
      ip,
    );
    return { onayId: a.id, durum: a.status };
  }

  /** Konsol › Ödemeler › İadeler */
  async list() {
    const rows = await this.db.refund.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        order: { select: { no: true, id: true } },
        approval: { select: { reason: true, decider: { select: { name: true } }, decidedAt: true } },
        invoice: { select: { status: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      siparis: r.order?.no ?? null,
      tutarKurus: Number(r.amountKurus),
      durum: r.status,
      durumAd: REFUND_STATUS_NAMES[r.status],
      neden: r.approval.reason,
      onaylayan: r.approval.decider?.name ?? null,
      onayTarihi: r.approval.decidedAt,
      yurutulme: r.executedAt,
      not: r.failReason,
      fatura:
        r.status !== 'EXECUTED'
          ? '—'
          : r.invoice?.status === 'ISSUED'
            ? 'İade faturası kesildi'
            : 'İade faturası kuyrukta',
    }));
  }
}
