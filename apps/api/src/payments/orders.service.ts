import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { type Order, type Prisma, uuidv7 } from '@rengarenk/db';
import {
  type Billing,
  CONTRACT_CONSENT,
  galleryAccess,
  ORDER_STATUS_NAMES,
  type OrderCreate,
  PRODUCT_GROUP_NAMES,
  PRODUCTS,
  PROMOTION_NAMES,
  type PromotionKind,
  productByKey,
  tlYaz,
  vatOfGross,
  WAIVER_CONSENT,
  withVat,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { ENV, type Env } from '../config/env.js';
import { ConsentService } from '../consents/consent.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { EntitlementService } from '../entitlements/entitlement.service.js';
import { FeatureFlagService } from '../flags/feature-flag.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { STORAGE, type Storage } from '../storage/storage.service.js';
import { type Kalem, kalemler as kalemlerOf } from './order-item.js';
import {
  EArsivFactory,
  type EArsivProvider,
  FakePayment,
  type Notification,
  PaymentProviderFactory,
} from './providers.js';
import { SubscriptionBilling } from './subscription-billing.js';

const DAY = 86_400_000;
/** Ödenmeyen sipariş bu süre sonra iptal sayılır (PayTR çerçevesi 30 dakika açık kalır) */
const PENDING_MINUTES = 45;

/** Galeri hesabının satın alabildiği ek paketler (GaleriPanel.dc.html "Ek paket al"; Karar 12.4) */
export const GALLERY_EXTRAS = ['mesaj_30', 'mesaj_10'] as const;

/** Sipariş no: PayTR'nin istediği harf ve rakamdan; "RG" + zaman + rastgele */
const siparisNo = () =>
  `RG${Date.now().toString(36).toUpperCase()}${randomInt(36 ** 4)
    .toString(36)
    .toUpperCase()}`;

export { siparisNo };

const bugun = () => {
  const tr = new Date(Date.now() + 3 * 3600_000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()) - 3 * 3600_000);
};

/**
 * Web ödemeleri (Karar 12, 31, 38, 39; Teknik tasarım §7). Sipariş, onaylar ve doldurulmuş ön bilgilendirme formu aynı
 * işlemde yazılır; ödeme kuruluşunun çerçevesi açılır. Bildirim imzasıyla doğrulanır ve aynı bildirim iki kez gelse de
 * sipariş bir kez işlenir (satır kilidi). Ödeme onaylanınca haklar hak defterine yazılır, öne çıkarmalar hemen başlar;
 * fatura işçide e-Arşiv entegratörüne gider. İade bu serviste yoktur: iade yalnızca sahibin onayıyla, ayrı süreçte.
 */
@Injectable()
export class OrdersService {
  private readonly log = new Logger(OrdersService.name);
  private readonly earsiv: EArsivProvider;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(STORAGE) private readonly storage: Storage,
    private readonly providers: PaymentProviderFactory,
    private readonly entitlements: EntitlementService,
    private readonly flags: FeatureFlagService,
    private readonly consents: ConsentService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly subs: SubscriptionBilling,
    earsiv: EArsivFactory,
  ) {
    this.earsiv = earsiv.create();
  }

  async personal(userId: string) {
    const m = await this.db.accountMember.findFirst({
      where: { userId, role: 'OWNER', account: { kind: 'INDIVIDUAL', status: 'ACTIVE' } },
      select: { accountId: true },
    });
    if (!m) throw new ForbiddenException('Bireysel hesap bulunamadı');
    return m.accountId;
  }

  // ── Haklarım ve ödemeler (Haklarim.dc.html) ───────────────────

  async overview(userId: string) {
    const accountId = await this.personal(userId);
    const [ekMesaj, gunlukKullanilan, uzatmaHakki, ucretsizUzatma, talepler, aktif, gecmis, odeme] =
      await Promise.all([
        this.entitlements.balance(accountId, 'ilk_mesaj'),
        this.db.conversation.count({
          where: {
            sellerAccountId: accountId,
            origin: 'talep',
            entitlement: 'gunluk',
            createdAt: { gte: bugun() },
          },
        }),
        this.entitlements.balance(accountId, 'uzatma'),
        this.db.demand.count({
          where: { userId, status: { in: ['PUBLISHED', 'PASSIVE'] }, freeExtensionUsed: false },
        }),
        this.db.demand.findMany({
          where: { userId, status: 'PUBLISHED' },
          orderBy: { publishedAt: 'desc' },
          select: { no: true, title: true, headline: true },
        }),
        this.db.demandPromotion.findMany({
          where: { demand: { userId }, endsAt: { gt: new Date() } },
          orderBy: { endsAt: 'asc' },
          include: { demand: { select: { no: true, title: true, headline: true } } },
        }),
        this.db.order.findMany({
          where: { accountId, status: 'PAID' },
          orderBy: { paidAt: 'desc' },
          take: 50,
          include: { invoice: { select: { status: true } } },
        }),
        this.flags.maintenance('odeme'),
      ]);
    const saglayici = this.providers.get().ad;
    const magaza = this.env.STORE_PROVIDER;
    return {
      talepHakki: await this.entitlements.balance(accountId, 'talep'),
      ekMesaj,
      gunlukMesaj: { toplam: 5, kalan: Math.max(0, 5 - gunlukKullanilan) },
      uzatmaHakki,
      ucretsizUzatma,
      // Ödeme açık mı: sağlayıcı bağlı ve ödeme bakımda değil
      odeme: {
        acik: saglayici !== 'none' && !odeme.on,
        not: odeme.on ? odeme.note : saglayici === 'none' ? 'Ödemeler yakında açılacak' : null,
      },
      // Uygulama içi satın alma (Karar 38)
      magaza: {
        acik: magaza !== 'none' && !odeme.on,
        not: odeme.on ? odeme.note : magaza === 'none' ? 'Uygulama içi satın alma yakında açılacak' : null,
      },
      urunler: PRODUCTS.map((p) => ({
        key: p.key,
        grup: p.grup,
        grupAd: PRODUCT_GROUP_NAMES[p.grup],
        ad: p.ad,
        not: p.not,
        kurus: Math.round(p.tl * 100),
        mobilKurus: Math.round(p.mobil * 100),
        oneCikarma: !!p.oneCikarma,
        hemenBaslar: p.hemenBaslar,
      })),
      talepler: talepler.map((t) => ({ no: Number(t.no), baslik: t.headline ?? t.title })),
      aktifOneCikarma: aktif.map((a) => ({
        tur: a.kind,
        ad: PROMOTION_NAMES[a.kind as PromotionKind],
        talep: { no: Number(a.demand.no), baslik: a.demand.headline ?? a.demand.title },
        bitis: a.endsAt,
      })),
      gecmis: gecmis.map((o) => ({
        id: o.id,
        no: o.no,
        tarih: o.paidAt,
        kalem: (o.items as unknown as Kalem[])
          .map((k) => (k.talepBaslik ? `${k.ad} · ${k.talepBaslik}` : k.ad))
          .join(', '),
        tutarKurus: Number(o.totalKurus),
        fatura: o.invoice?.status === 'ISSUED',
      })),
    };
  }

  // ── Sipariş ───────────────────────────────────────────────────

  /** Doldurulmuş ön bilgilendirme formu (06-yasal-metin-taslaklari.md §6): sepet ve tutarla */
  private async preInfo(kalemler: Kalem[], toplam: number, tx: Tx) {
    const t = await this.consents.current('on_bilgilendirme', tx);
    const satirlar = kalemler
      .map(
        (k) =>
          `- ${k.ad}${k.talepBaslik ? ` · ${k.talepBaslik}` : ''} · ${k.adet} adet · ${tlYaz(k.tutarKurus)}`,
      )
      .join('\n');
    return [
      `# ${t?.title ?? 'Ön bilgilendirme formu'}${t ? ` (sürüm ${t.version})` : ''}`,
      '',
      '## Sipariş',
      satirlar,
      '',
      `Toplam: ${tlYaz(toplam)}, tüm vergiler dahil.`,
      '',
      t?.body ?? '',
    ].join('\n');
  }

  async create(userId: string, input: OrderCreate, meta: { ip?: string }) {
    await this.flags.assertAvailable('odeme');
    const provider = this.providers.get();
    if (provider.ad === 'none') throw new ServiceUnavailableException('Ödemeler yakında açılacak');
    const galeri = input.hesap ? await this.galleryBuyer(userId, input.hesap) : null;
    if (galeri && galleryAccess(galeri.gallery).saltOkunur) {
      throw new ForbiddenException('Ek paket almak için önce bir paket seç');
    }
    const accountId = galeri?.accountId ?? (await this.personal(userId));
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true } });
    // Galeriye aynı tutarlar KDV hariç faturalanır (Karar 12.8); fatura galerinin ticari bilgileriyle
    const fatura: Billing = galeri ? { ...galeri.fatura, eposta: input.fatura.eposta } : input.fatura;

    // Kalemler: öne çıkarmada talep kullanıcının yayındaki talebi olmalı
    const kalemler: Kalem[] = [];
    for (const k of input.kalemler) {
      const p = productByKey(k.urun);
      if (!p) throw new BadRequestException('Ürün bulunamadı');
      if (galeri && !(GALLERY_EXTRAS as readonly string[]).includes(p.key)) {
        throw new BadRequestException('Bu ürün galeri hesabıyla alınamaz');
      }
      const net = Math.round(p.tl * 100);
      const brut = galeri ? withVat(net) : net;
      const kalem: Kalem = {
        urun: p.key,
        ad: p.ad,
        adet: 1,
        birimKurus: brut,
        tutarKurus: brut,
        ...(galeri ? { netKurus: net } : {}),
      };
      if (p.oneCikarma) {
        const d = await this.db.demand.findFirst({
          where: { no: BigInt(k.talepNo as number), userId, status: 'PUBLISHED' },
          select: { id: true, no: true, title: true, headline: true },
        });
        if (!d) throw new BadRequestException('Öne çıkarılacak talep yayında değil');
        Object.assign(kalem, { talepId: d.id, talepNo: Number(d.no), talepBaslik: d.headline ?? d.title });
      }
      kalemler.push(kalem);
    }
    const toplam = kalemler.reduce((t, k) => t + k.tutarKurus, 0);
    const hemen = kalemler.some((k) => productByKey(k.urun)?.hemenBaslar);
    const no = siparisNo();
    const id = uuidv7();

    await this.db.$transaction(async (tx) => {
      const surumler = await this.consents.recordPayment(tx, userId, hemen, 'web', meta.ip);
      await tx.order.create({
        data: {
          id,
          no,
          accountId,
          userId,
          channel: 'web',
          items: kalemler as unknown as Prisma.InputJsonValue,
          totalKurus: BigInt(toplam),
          vatKurus: BigInt(vatOfGross(toplam)),
          billing: fatura as unknown as Prisma.InputJsonValue,
          consents: {
            sozlesme: CONTRACT_CONSENT,
            cayma: hemen ? WAIVER_CONSENT : null,
            surumler,
            zaman: new Date().toISOString(),
          },
          preInfo: await this.preInfo(kalemler, toplam, tx),
          provider: provider.ad,
          userIp: meta.ip ?? null,
        },
      });
    });

    let odemeAdresi: string;
    try {
      odemeAdresi = await provider.checkout({
        oid: no,
        amountKurus: toplam,
        email: fatura.eposta,
        userIp: meta.ip ?? '127.0.0.1',
        basket: kalemler.map((k) => [k.ad, (k.birimKurus / 100).toFixed(2), k.adet]),
        userName: fatura.ad,
        userAddress: `${fatura.ilce} / ${fatura.il}`,
        userPhone: user.phone,
        ...this.returnUrls(no, !!galeri),
      });
    } catch (e) {
      await this.db.order.update({
        where: { id },
        data: { status: 'FAILED', failReason: `Ödeme başlatılamadı: ${(e as Error).message}`.slice(0, 300) },
      });
      throw new ServiceUnavailableException('Ödeme şu an başlatılamadı; birazdan yeniden dene');
    }
    return { no, odemeAdresi, toplamKurus: toplam };
  }

  /** Ödeme kuruluşunun dönüş adresleri: galeri siparişinde galeri paneline döner */
  returnUrls(no: string, galeri: boolean) {
    const g = galeri ? '&galeri=1' : '';
    return {
      okUrl: `${this.env.WEB_ORIGIN}/haklarim/odeme-sonucu?siparis=${no}${g}`,
      failUrl: `${this.env.WEB_ORIGIN}/haklarim/odeme-sonucu?siparis=${no}${g}&hata=1`,
    };
  }

  /** Galeri adına ödeme: yalnızca sahip, hesap etkin ve paketi açık (Karar 20: paket, ödeme, fatura sahipte) */
  async galleryBuyer(userId: string, accountId: string) {
    const m = await this.db.accountMember.findUnique({
      where: { accountId_userId: { accountId, userId } },
      include: { account: { include: { gallery: true } } },
    });
    const g = m?.account.gallery;
    if (!m || !g) throw new NotFoundException('Galeri bulunamadı');
    if (m.role !== 'OWNER') throw new ForbiddenException('Paket ve ödemeleri yalnızca galeri sahibi yönetir');
    if (m.account.status !== 'ACTIVE') throw new ForbiddenException('Galeri hesabı askıda');
    const fatura: Billing = {
      ad: g.legalName.slice(0, 120),
      eposta: '',
      il: g.il,
      ilce: g.ilce,
      kurumsal: { unvan: g.legalName.slice(0, 200), vergiNo: g.taxNo, vergiDairesi: g.taxOffice },
    };
    return { accountId, gallery: g, fatura };
  }

  /** Siparişi görebilen: siparişi veren ya da hesabın sahibi/yöneticisi (galeri faturaları) */
  private async canSee(userId: string, o: { userId: string; accountId: string }) {
    if (o.userId === userId) return true;
    const m = await this.db.accountMember.findUnique({
      where: { accountId_userId: { accountId: o.accountId, userId } },
      select: { role: true },
    });
    return m?.role === 'OWNER' || m?.role === 'MANAGER';
  }

  async status(userId: string, no: string) {
    const o = await this.db.order.findUnique({ where: { no } });
    if (!o || !(await this.canSee(userId, o))) throw new NotFoundException('Sipariş bulunamadı');
    return {
      no: o.no,
      durum: o.status,
      durumAd: ORDER_STATUS_NAMES[o.status],
      toplamKurus: Number(o.totalKurus),
      neden: o.failReason,
    };
  }

  // ── Bildirim ──────────────────────────────────────────────────

  /**
   * Ödeme kuruluşunun bildirimi. İmza doğrulanmazsa reddedilir. Sipariş satırı kilitlenir; yalnızca ilk bildirim
   * işlenir, sonrakiler yalnızca "OK" alır. Tutar siparişle uyuşmazsa hak tanımlanmaz ve inceleme olayı yazılır.
   */
  async notify(body: Record<string, string>): Promise<boolean> {
    const n = this.providers.get().verify(body);
    if (!n) return false;
    await this.db.$transaction(async (tx) => {
      const [o] = await tx.$queryRaw<Order[]>`SELECT * FROM orders WHERE no = ${n.oid} FOR UPDATE`;
      if (!o) {
        this.log.warn(`bildirim: sipariş bulunamadı ${n.oid}`);
        return;
      }
      const siparis = await tx.order.findUniqueOrThrow({ where: { id: o.id } });
      await tx.payment.create({
        data: {
          id: uuidv7(),
          orderId: siparis.id,
          provider: this.providers.get().ad,
          status: n.status,
          amountKurus: BigInt(n.amountKurus),
          totalKurus: BigInt(n.totalKurus),
          method: n.method,
          failCode: n.failCode,
          failMessage: n.failMessage?.slice(0, 300) ?? null,
          testMode: n.testMode,
        },
      });
      if (siparis.status !== 'PENDING' && siparis.status !== 'CANCELLED') return; // zaten işlendi
      if (n.status === 'failed') {
        if (siparis.status === 'PENDING') {
          await tx.order.update({
            where: { id: siparis.id },
            data: { status: 'FAILED', failReason: n.failMessage ?? 'Ödeme onaylanmadı' },
          });
          if (siparis.kind === 'yenileme' && siparis.channel === 'otomatik') {
            await this.subs.onRenewalFailed(tx, siparis, n.failMessage ?? 'Ödeme onaylanmadı');
          }
        }
        return;
      }
      if (n.amountKurus !== Number(siparis.totalKurus)) {
        await tx.order.update({
          where: { id: siparis.id },
          data: { status: 'FAILED', failReason: 'Ödenen tutar siparişle uyuşmuyor; inceleniyor' },
        });
        await this.outbox.add(tx, 'odeme.uyusmazlik', { orderId: siparis.id, odenen: n.amountKurus });
        return;
      }
      await this.fulfill(tx, siparis, n);
    });
    return true;
  }

  /** Haklar ve öne çıkarmalar; aynı işlemde işlem kaydı ve olaylar */
  /** Ödeme onaylandı (web bildirimi ya da mağaza bildirimi): haklar, öne çıkarma, fatura kaydı; aynı işlemde */
  async fulfill(tx: Tx, o: Order, n: Notification) {
    const now = new Date();
    const kalemler = o.kind === 'urun' ? kalemlerOf(o.items) : [];
    const yenidenIndeks = new Set<string>();
    if (o.kind !== 'urun') await this.subs.fulfill(tx, o, n);
    for (const [i, k] of kalemler.entries()) {
      const p = productByKey(k.urun);
      if (!p) continue;
      const kaynak = { sourceType: 'order', sourceId: `${o.id}:${i}`, createdBy: o.userId };
      if (p.hak) {
        await tx.entitlementLedger.create({
          data: {
            accountId: o.accountId,
            kind: p.hak.kind,
            delta: p.hak.adet,
            reason: 'satin_alma',
            ...kaynak,
          },
        });
      }
      if (p.oneCikarma && k.talepId) {
        // Aynı türden süren öne çıkarma varsa yeni süre onun bitişinden başlar
        const son = await tx.demandPromotion.findFirst({
          where: { demandId: k.talepId, kind: p.oneCikarma.tur, endsAt: { gt: now } },
          orderBy: { endsAt: 'desc' },
        });
        const baslangic = son ? son.endsAt : now;
        const pid = uuidv7();
        await tx.demandPromotion.create({
          data: {
            id: pid,
            demandId: k.talepId,
            kind: p.oneCikarma.tur,
            startsAt: baslangic,
            endsAt: new Date(baslangic.getTime() + p.oneCikarma.gun * DAY),
            orderId: o.id,
          },
        });
        // Hak defteri: satın alınan öne çıkarma hakkı ve hemen kullanımı
        await tx.entitlementLedger.create({
          data: { accountId: o.accountId, kind: p.oneCikarma.tur, delta: 1, reason: 'satin_alma', ...kaynak },
        });
        await tx.entitlementLedger.create({
          data: {
            accountId: o.accountId,
            kind: p.oneCikarma.tur,
            delta: -1,
            reason: 'kullanim',
            sourceType: 'promotion',
            sourceId: pid,
            createdBy: o.userId,
          },
        });
        yenidenIndeks.add(k.talepId);
      }
    }
    await tx.order.update({ where: { id: o.id }, data: { status: 'PAID', paidAt: now, failReason: null } });
    // Mağaza satışının faturasını mağaza keser (Karar 38); web ve abonelik satışında e-Arşiv
    if (o.channel === 'web' || o.channel === 'otomatik') {
      await tx.invoice.create({ data: { id: uuidv7(), orderId: o.id, provider: this.earsiv.ad } });
    }
    await this.audit.record(
      {
        actorType: 'SYSTEM',
        actorId: 'odeme',
        action: 'odeme_alindi',
        entityType: 'order',
        entityId: o.id,
        after: { no: o.no, tutarKurus: n.amountKurus, testMode: n.testMode },
      },
      tx,
    );
    await this.outbox.add(tx, 'odeme.alindi', { orderId: o.id, userId: o.userId });
    for (const demandId of yenidenIndeks) await this.outbox.add(tx, 'talep.guncellendi', { demandId });
  }

  // ── Sahte ödeme sayfası (geliştirme ve test) ──────────────────

  private fake(): FakePayment {
    const p = this.providers.get();
    if (!(p instanceof FakePayment)) throw new NotFoundException();
    return p;
  }

  async fakePage(no: string) {
    this.fake();
    const o = await this.db.order.findUnique({ where: { no } });
    if (!o) throw new NotFoundException('Sipariş bulunamadı');
    const tutar = tlYaz(Number(o.totalKurus));
    const dugme = (durum: string, yazi: string, renk: string) =>
      `<form method="post" action="/odeme/sahte/${encodeURIComponent(no)}"><input type="hidden" name="durum" value="${durum}"><button style="width:100%;border:0;border-radius:12px;padding:14px;font:800 15px system-ui;background:${renk};color:#1E2333;cursor:pointer;margin-top:10px">${yazi}</button></form>`;
    return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sahte ödeme</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#F6F8FD;color:#1E2333"><div style="max-width:420px;margin:0 auto;padding:20px">
<p style="margin:0;font-size:12px;font-weight:800;color:#A3271F">GELİŞTİRME ORTAMI · SAHTE ÖDEME · KART BİLGİSİ İSTENMEZ</p>
<h1 style="font-size:20px;margin:8px 0 4px">Sipariş ${no}</h1><p style="margin:0 0 6px;font-size:15px">Tutar: <strong>${tutar}</strong></p>
${
  o.status !== 'PENDING'
    ? `<p>Bu sipariş artık beklemede değil: ${ORDER_STATUS_NAMES[o.status]}</p>`
    : o.kind === 'urun'
      ? dugme('success', 'Ödemeyi onayla (başarılı)', '#3DD68C') +
        dugme('failed', 'Ödemeyi reddet (başarısız)', '#FFD7D2')
      : `<p style="font-size:13px;margin:6px 0 0">Kart ödeme kuruluşunda saklanır; sonraki dönemler bu karttan çekilir.</p>${dugme('success', 'Kartı kaydet ve öde (başarılı)', '#3DD68C')}${dugme('success-red', 'Kaydet ve öde · yenilemede reddedilecek kart', '#FFE7A8')}${dugme('failed', 'Ödemeyi reddet (başarısız)', '#FFD7D2')}`
}
</div></body></html>`;
  }

  /** Sahte sayfadaki düğme: PayTR'nin bildirim biçimiyle kendi bildirim ucumuzu çağırır, sonuç sayfasına yönlendirir */
  async fakeSubmit(no: string, durum: string) {
    const fake = this.fake();
    const o = await this.db.order.findUnique({ where: { no } });
    if (!o) throw new NotFoundException('Sipariş bulunamadı');
    const status = durum.startsWith('success') ? 'success' : 'failed';
    // Kart saklayan siparişte sahte kullanıcı anahtarı; "red" kartı yenilemede reddedilir
    const utoken =
      o.kind === 'urun'
        ? undefined
        : `${durum === 'success-red' ? 'sahte-red-' : 'sahte-u-'}${randomInt(1e9)}`;
    await this.notify(fake.notification(no, status, Number(o.totalKurus), utoken));
    const hesap = await this.db.account.findUniqueOrThrow({
      where: { id: o.accountId },
      select: { kind: true },
    });
    const u = this.returnUrls(no, hesap.kind !== 'INDIVIDUAL');
    return status === 'failed' ? u.failUrl : u.okUrl;
  }

  // ── Fatura ────────────────────────────────────────────────────

  /** İşçi: bekleyen faturayı entegratöre gönderir; başarısızsa sonra yeniden denenir */
  async issueInvoice(orderId: string) {
    const inv = await this.db.invoice.findUnique({ where: { orderId }, include: { order: true } });
    if (!inv || inv.status === 'ISSUED') return null;
    const o = inv.order;
    try {
      const r = await this.earsiv.issue({
        orderNo: o.no,
        date: o.paidAt ?? new Date(),
        billing: o.billing as unknown as Billing,
        lines: kalemlerOf(o.items).map((k) => ({
          ad: k.talepBaslik ? `${k.ad} · ${k.talepBaslik}` : k.ad,
          adet: k.adet,
          tutarKurus: k.tutarKurus,
        })),
        totalKurus: Number(o.totalKurus),
        vatKurus: Number(o.vatKurus),
      });
      const key = `faturalar/${o.id}.pdf`;
      await this.storage.put(key, r.pdf, 'application/pdf');
      await this.db.invoice.update({
        where: { id: inv.id },
        data: {
          status: 'ISSUED',
          no: r.no,
          pdfKey: key,
          issuedAt: new Date(),
          attempts: { increment: 1 },
          lastError: null,
        },
      });
      return r.no;
    } catch (e) {
      await this.db.invoice.update({
        where: { id: inv.id },
        data: { attempts: { increment: 1 }, lastError: (e as Error).message.slice(0, 300) },
      });
      return null;
    }
  }

  /** İşçi: bekleyen faturalar (entegratör gelince sırayla kesilir) ve süresi geçen ödenmemiş siparişler */
  async housekeeping() {
    const bekleyen = await this.db.invoice.findMany({
      where: { status: 'PENDING', attempts: { lt: 50 } },
      select: { orderId: true },
      take: 100,
    });
    for (const b of bekleyen) await this.issueInvoice(b.orderId);
    const iptal = await this.db.order.updateMany({
      where: {
        status: 'PENDING',
        NOT: { channel: 'otomatik' },
        createdAt: { lt: new Date(Date.now() - PENDING_MINUTES * 60_000) },
      },
      data: { status: 'CANCELLED', failReason: 'Ödeme süresi doldu' },
    });
    // Saklı karttan çekim yapıldı ama bildirim bir günde gelmedi: yeniden çekilmez (çift tahsilat olmasın), sahip inceler
    const sessiz = await this.db.order.findMany({
      where: {
        status: 'PENDING',
        channel: 'otomatik',
        failReason: null,
        createdAt: { lt: new Date(Date.now() - DAY) },
      },
      select: { id: true, accountId: true },
    });
    for (const s of sessiz) {
      await this.db.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: s.id },
          data: { failReason: 'Ödeme kuruluşunun bildirimi gelmedi; inceleniyor' },
        });
        await this.outbox.add(tx, 'abonelik.bildirim_gelmedi', { orderId: s.id, accountId: s.accountId });
      });
    }
    return { fatura: bekleyen.length, iptal: iptal.count, sessiz: sessiz.length };
  }

  async invoicePdf(userId: string, orderId: string) {
    const inv = await this.db.invoice.findUnique({
      where: { orderId },
      include: { order: { select: { userId: true, accountId: true, no: true } } },
    });
    if (!inv || !(await this.canSee(userId, inv.order))) throw new NotFoundException('Fatura bulunamadı');
    if (inv.status !== 'ISSUED' || !inv.pdfKey) throw new NotFoundException('Fatura henüz kesilmedi');
    const f = await this.storage.get(inv.pdfKey);
    return { ...f, ad: `fatura-${inv.no ?? inv.order.no}.pdf` };
  }

  /** Doldurulmuş ön bilgilendirme formu ve sözleşme onayı (Haklarım › Ödeme geçmişi) */
  async contract(userId: string, orderId: string) {
    const o = await this.db.order.findUnique({ where: { id: orderId } });
    if (!o || !(await this.canSee(userId, o))) throw new NotFoundException('Sipariş bulunamadı');
    return { no: o.no, onBilgilendirme: o.preInfo, onaylar: o.consents };
  }
}
