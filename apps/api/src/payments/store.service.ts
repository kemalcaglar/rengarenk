import { randomUUID, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { type Order, type Prisma, uuidv7 } from '@rengarenk/db';
import {
  type Product,
  productByKey,
  productByStoreId,
  type StoreIntent,
  storeProductId,
  vatOfGross,
} from '@rengarenk/shared';
import { ENV, type Env } from '../config/env.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { FeatureFlagService } from '../flags/feature-flag.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { type Kalem, kalemler } from './order-item.js';
import { OrdersService, siparisNo } from './orders.service.js';

/** RevenueCat bildirimindeki olay (yalnızca kullanılan alanlar) */
export interface StoreEventBody {
  id: string;
  type: string;
  app_user_id?: string;
  product_id?: string;
  transaction_id?: string;
  store?: string;
  environment?: string;
  cancel_reason?: string;
  price_in_purchased_currency?: number;
  currency?: string;
  purchased_at_ms?: number;
}

type Sonuc = 'islendi' | 'yok_sayildi' | 'inceleme';

const SATIN_ALMA = new Set(['NON_RENEWING_PURCHASE', 'INITIAL_PURCHASE']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86_400_000;

const esit = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const magazaAdi = (kanal: string) => (kanal === 'ios' ? 'App Store' : 'Google Play');

/**
 * Mağaza ödemeleri (Karar 38; Teknik tasarım §7). Uygulama satın almadan önce bir niyet kaydı açar (ürün, öne çıkarmada
 * talep); App Store ya da Google Play satışı RevenueCat bildirimiyle gelir, niyete bağlanır ve hak defterine düşer. Haklar
 * tek sunucu hesabında tutulur, web ve uygulamada geçerlidir. Aynı satış (işlem no) ve aynı bildirim bir kez işlenir.
 * Mağaza iadeleri yalnızca kaydedilir ve sahibe iletilir; bu serviste hak düşülmez (iade akışı sahibin kararıyla).
 */
@Injectable()
export class StoreService {
  private readonly log = new Logger(StoreService.name);

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly orders: OrdersService,
    private readonly flags: FeatureFlagService,
    private readonly outbox: OutboxService,
  ) {}

  private kalem(p: Product): Kalem {
    const kurus = Math.round(p.mobil * 100);
    return { urun: p.key, ad: p.ad, adet: 1, birimKurus: kurus, tutarKurus: kurus };
  }

  private siparisVerisi(p: { accountId: string; userId: string; kanal: string; kalem: Kalem }) {
    const { kalem } = p;
    return {
      id: uuidv7(),
      no: siparisNo(),
      accountId: p.accountId,
      userId: p.userId,
      channel: p.kanal,
      items: [kalem] as unknown as Prisma.InputJsonValue,
      totalKurus: BigInt(kalem.tutarKurus),
      vatKurus: BigInt(vatOfGross(kalem.tutarKurus)),
      // Mağaza satışında fatura, ödeme ve iade koşulları mağazanın (Karar 38)
      billing: { magaza: magazaAdi(p.kanal) },
      consents: {},
      preInfo: `# Uygulama içi satın alma\n\n- ${kalem.ad}${kalem.talepBaslik ? ` · ${kalem.talepBaslik}` : ''}\n\nÖdeme, iade ve fatura ${magazaAdi(p.kanal)} üzerinden.`,
      provider: 'magaza',
    };
  }

  /** Satın alma niyeti: uygulama bu kaydı açtıktan sonra mağaza ekranını açar */
  async intent(userId: string, input: StoreIntent) {
    await this.flags.assertAvailable('odeme');
    if (this.env.STORE_PROVIDER === 'none') {
      throw new ServiceUnavailableException('Uygulama içi satın alma yakında açılacak');
    }
    const accountId = await this.orders.personal(userId);
    const p = productByKey(input.urun);
    if (!p) throw new BadRequestException('Ürün bulunamadı');
    const kalem = this.kalem(p);
    if (p.oneCikarma) {
      const d = await this.db.demand.findFirst({
        where: { no: BigInt(input.talepNo as number), userId, status: 'PUBLISHED' },
        select: { id: true, no: true, title: true, headline: true },
      });
      if (!d) throw new BadRequestException('Öne çıkarılacak talep yayında değil');
      Object.assign(kalem, { talepId: d.id, talepNo: Number(d.no), talepBaslik: d.headline ?? d.title });
    }
    const o = await this.db.order.create({
      data: this.siparisVerisi({ accountId, userId, kanal: input.platform, kalem }),
    });
    return { no: o.no, urunKimligi: storeProductId(p.key), saglayici: this.env.STORE_PROVIDER };
  }

  /** RevenueCat bildirimi: Authorization başlığı panelde tanımlanan değerle aynı olmalı */
  async webhook(authorization: string | undefined, body: { event?: StoreEventBody } | undefined) {
    const beklenen = this.env.REVENUECAT_WEBHOOK_AUTH;
    if (this.env.STORE_PROVIDER !== 'revenuecat' || !beklenen) throw new NotFoundException();
    const gelen = (authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!esit(gelen, beklenen)) throw new UnauthorizedException();
    if (!body?.event?.id || !body.event.type) throw new BadRequestException('Olay eksik');
    return this.handle('revenuecat', body.event);
  }

  /** Geliştirme ve test: mağaza ekranı yerine, RevenueCat bildirimiyle aynı biçimde satış olayı */
  async fakePurchase(userId: string, no: string) {
    if (this.env.STORE_PROVIDER !== 'fake') throw new NotFoundException();
    const o = await this.db.order.findUnique({ where: { no } });
    if (!o || o.userId !== userId || o.provider !== 'magaza')
      throw new NotFoundException('Sipariş bulunamadı');
    const k = kalemler(o.items)[0];
    const r = await this.handle('fake', {
      id: randomUUID(),
      type: 'NON_RENEWING_PURCHASE',
      app_user_id: userId,
      product_id: storeProductId(k?.urun ?? ''),
      transaction_id: `sahte-${randomUUID()}`,
      store: o.channel === 'ios' ? 'APP_STORE' : 'PLAY_STORE',
      environment: 'SANDBOX',
      price_in_purchased_currency: Number(o.totalKurus) / 100,
      currency: 'TRY',
      purchased_at_ms: Date.now(),
    });
    return { durum: r.result, no: r.no };
  }

  /** Bildirimi işler; aynı olay ikinci kez gelirse önceki sonucu döner */
  async handle(
    provider: 'revenuecat' | 'fake',
    ev: StoreEventBody,
  ): Promise<{ result: Sonuc; no: string | null }> {
    const once = await this.db.storeEvent.findUnique({ where: { eventId: ev.id } });
    if (once) return { result: once.result as Sonuc, no: null };
    const userId = ev.app_user_id && UUID.test(ev.app_user_id) ? ev.app_user_id : null;

    return this.db.$transaction(async (tx) => {
      const kaydet = (result: Sonuc, note: string | null, orderId?: string) =>
        tx.storeEvent.create({
          data: {
            id: uuidv7(),
            provider,
            eventId: ev.id,
            type: ev.type,
            userId,
            productId: ev.product_id ?? null,
            transactionId: ev.transaction_id ?? null,
            store: ev.store ?? null,
            environment: ev.environment ?? null,
            result,
            note,
            orderId: orderId ?? null,
            payload: ev as unknown as Prisma.InputJsonValue,
          },
        });

      // Mağaza iadesi: kayda geçer ve sahibe iletilir; hak düşme kararı sahibin (Karar 38, değişmez kural 1)
      if (ev.type === 'REFUND' || (ev.type === 'CANCELLATION' && ev.cancel_reason === 'CUSTOMER_SUPPORT')) {
        const satis = ev.transaction_id
          ? await tx.order.findUnique({ where: { externalId: ev.transaction_id }, select: { id: true } })
          : null;
        await kaydet('inceleme', 'Mağaza iadesi bildirildi; sahibin kararı bekleniyor', satis?.id);
        await this.outbox.add(tx, 'magaza.iade_bildirimi', {
          eventId: ev.id,
          orderId: satis?.id ?? null,
          store: ev.store ?? null,
        });
        return { result: 'inceleme', no: null };
      }
      if (!SATIN_ALMA.has(ev.type)) {
        await kaydet('yok_sayildi', null);
        return { result: 'yok_sayildi', no: null };
      }

      const p = ev.product_id ? productByStoreId(ev.product_id) : undefined;
      const hesap = userId
        ? await tx.accountMember.findFirst({
            where: { userId, role: 'OWNER', account: { kind: 'INDIVIDUAL' } },
            select: { accountId: true },
          })
        : null;
      if (!p || !userId || !hesap || !ev.transaction_id) {
        await kaydet('inceleme', !p ? 'Ürün tanınmadı' : 'Kullanıcı ya da işlem no eksik');
        await this.outbox.add(tx, 'magaza.inceleme', { eventId: ev.id });
        return { result: 'inceleme', no: null };
      }
      if (await tx.order.findUnique({ where: { externalId: ev.transaction_id }, select: { id: true } })) {
        await kaydet('yok_sayildi', 'Bu satış daha önce işlendi');
        return { result: 'yok_sayildi', no: null };
      }

      // Niyet kaydı: aynı kullanıcı ve ürün, son bir gün, en yenisi; yoksa yeni sipariş (öne çıkarmada talep seçilmemiş)
      const kanal = ev.store === 'PLAY_STORE' ? 'android' : 'ios';
      const adaylar = await tx.order.findMany({
        where: {
          userId,
          provider: 'magaza',
          status: { in: ['PENDING', 'CANCELLED'] },
          externalId: null,
          createdAt: { gt: new Date(Date.now() - DAY) },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      const aday = adaylar.find((a) => kalemler(a.items)[0]?.urun === p.key);
      let o: Order;
      if (aday) {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${aday.id}::uuid FOR UPDATE`;
        o = aday;
      } else {
        o = await tx.order.create({
          data: this.siparisVerisi({ accountId: hesap.accountId, userId, kanal, kalem: this.kalem(p) }),
        });
      }
      const fiyat =
        ev.currency === 'TRY' && typeof ev.price_in_purchased_currency === 'number'
          ? Math.round(ev.price_in_purchased_currency * 100)
          : Number(o.totalKurus);
      const testMode = ev.environment === 'SANDBOX';
      o = await tx.order.update({ where: { id: o.id }, data: { externalId: ev.transaction_id } });
      await tx.payment.create({
        data: {
          id: uuidv7(),
          orderId: o.id,
          provider: provider === 'fake' ? 'fake_magaza' : ev.store === 'PLAY_STORE' ? 'google' : 'apple',
          status: 'success',
          amountKurus: BigInt(fiyat),
          totalKurus: BigInt(fiyat),
          method: 'magaza',
          failCode: null,
          failMessage: null,
          testMode,
        },
      });
      await this.orders.fulfill(tx, o, {
        oid: o.no,
        status: 'success',
        amountKurus: fiyat,
        totalKurus: fiyat,
        method: 'magaza',
        failCode: null,
        failMessage: null,
        testMode,
        cardToken: null,
      });
      // Talep seçilmemiş öne çıkarma: kullanılmamış hak olarak tanımlanır, destek inceler
      let not: string | null = null;
      if (p.oneCikarma && !kalemler(o.items)[0]?.talepId) {
        not = 'Öne çıkarılacak talep seçilmemişti; hak hesaba tanımlandı';
        await tx.entitlementLedger.create({
          data: {
            accountId: o.accountId,
            kind: p.oneCikarma.tur,
            delta: 1,
            reason: 'satin_alma',
            sourceType: 'order',
            sourceId: `${o.id}:0`,
            createdBy: userId,
          },
        });
        await this.outbox.add(tx, 'magaza.inceleme', { eventId: ev.id, orderId: o.id });
      }
      await kaydet(not ? 'inceleme' : 'islendi', not, o.id);
      this.log.log(`mağaza satışı işlendi ${o.no} (${p.key})`);
      return { result: not ? 'inceleme' : 'islendi', no: o.no };
    });
  }
}
