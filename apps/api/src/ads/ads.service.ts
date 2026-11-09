import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { type AdEvent, Prisma, uuidv7 } from '@rengarenk/db';
import {
  AD_EVENTS,
  type AdEventName,
  adEventId,
  agAdi,
  izinsizTemas,
  KANAL_ADI,
  type Kanal,
  kampanyaAdi,
  kanalOf,
  type Touch,
  type TouchReport,
  tlYaz,
} from '@rengarenk/shared';
import { ENV, type Env } from '../config/env.js';
import { type Channel, ConsentService } from '../consents/consent.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { type AdNetwork, AdNetworkFactory, type AdOut, type AgAdi } from './ad-networks.js';

const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const DAY = 86_400_000;
const TRY_SAYISI = 5;
const trGun = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d);

/** Olayın tarayıcıda da gerçekleştiği sayfa (Conversions API'de event_source_url) */
const SAYFA: Record<AdEventName, string> = {
  CompleteRegistration: '/giris',
  Lead: '/talep-olustur',
  SubmitApplication: '/kurumsal-basvuru',
  DealerApproved: '/galeri-paneli',
  Subscribe: '/galeri-paneli',
  Purchase: '/haklarim',
};

export type OlayPlatform = 'web' | 'ios' | 'android' | 'sunucu';
export const olayPlatformu = (p?: string | null): OlayPlatform => {
  const k = p?.toLowerCase();
  return k === 'ios' ? 'ios' : k === 'android' ? 'android' : 'web';
};

interface Aralik {
  bas: Date;
  bit: Date;
}

/**
 * Reklam ölçümü (Karar 35, 44). Temas: her kullanıcının ilk ve son teması izin durumuyla; tıklama kimlikleri yalnızca
 * reklam çerezi izniyle. Olay: işlemle aynı veritabanı işleminde, yalnızca "reklam ölçümü" onayı olan kullanıcı için
 * yazılır; işçi Meta'ya (web ve sunucu olayları; mobil olaylar Meta SDK ile gelecek) ve Google'a (galeri onayı ve
 * abonelik, gclid varsa) gönderir. Onay geri alınınca bekleyen olaylar iptal olur, tıklama kimlikleri, IP ve tarayıcı
 * bilgisi silinir. Harcama her gece reklam hesaplarından çekilir (elle giriş yok).
 */
@Injectable()
export class AdsService {
  private readonly log = new Logger('AdsService');
  readonly aglar: Record<AgAdi, AdNetwork>;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly consents: ConsentService,
    factory: AdNetworkFactory,
  ) {
    this.aglar = factory.create();
  }

  /** Kullanıcının son "reklam ölçümü" kararı */
  async onayli(userId: string, db: Db | Tx = this.db) {
    const c = await db.consent.findFirst({
      where: { userId, kind: 'reklam_olcum' },
      orderBy: { createdAt: 'desc' },
      select: { granted: true },
    });
    return Boolean(c?.granted);
  }

  /**
   * Tarayıcının bildirdiği temaslar. İlk temas bir kez yazılır, son temas daha yeniyse değişir. Reklam çerezi izni
   * yoksa tıklama kimlikleri saklanmaz (önceden saklananlar da silinir); IP ve tarayıcı bilgisi yalnızca iki izin
   * birlikteyse (çerez ve reklam ölçümü onayı) tutulur.
   */
  async temas(userId: string, r: TouchReport, ip: string | undefined, ua: string | undefined) {
    const temizle = (t: Touch | null) => (t && !r.reklam ? izinsizTemas(t) : t);
    const onay = r.reklam && (await this.onayli(userId));
    const mevcut = await this.db.userAttribution.findUnique({ where: { userId } });
    const eskiIlk = temizle((mevcut?.first as Touch | null) ?? null);
    const eskiSon = temizle((mevcut?.last as Touch | null) ?? null);
    const yeniIlk = temizle(r.ilk) ?? temizle(r.son);
    const ilk = eskiIlk ?? yeniIlk;
    const yeniSon = temizle(r.son) ?? temizle(r.ilk);
    const son = yeniSon && (!eskiSon || yeniSon.at > eskiSon.at) ? yeniSon : eskiSon;
    const kanal = kanalOf(ilk);
    const veri = {
      first: (ilk ?? Prisma.DbNull) as Prisma.InputJsonValue,
      last: (son ?? Prisma.DbNull) as Prisma.InputJsonValue,
      cookieOk: r.reklam,
      ip: onay ? (ip ?? null) : null,
      userAgent: onay ? (ua?.slice(0, 400) ?? null) : null,
    };
    const rapor = mevcut?.first
      ? {}
      : { channel: kanal, network: agAdi(ilk), campaign: ilk ? kampanyaAdi(ilk, kanal).slice(0, 150) : null };
    await this.db.userAttribution.upsert({
      where: { userId },
      create: { userId, ...veri, ...rapor },
      update: { ...veri, ...rapor },
    });
  }

  /**
   * Ölçüm olayı: işlemle aynı veritabanı işleminde çağrılır. Onay yoksa hiçbir şey yazılmaz. Kimlik tarayıcıdaki
   * Pixel olayıyla aynıdır (`adEventId`); aynı kayıt için ikinci çağrı yok sayılır.
   */
  async olay(
    tx: Tx,
    userId: string,
    name: AdEventName,
    o: { ref: string; platform: OlayPlatform; degerKurus?: number | null; kategori?: string | null },
  ) {
    if (!(await this.onayli(userId, tx))) return null;
    const id = adEventId(name, o.ref);
    const meta = o.platform === 'web' || o.platform === 'sunucu' ? 'bekliyor' : 'yok';
    await tx.adEvent.createMany({
      data: [
        {
          id,
          userId,
          name,
          platform: o.platform,
          valueKurus: o.degerKurus ?? null,
          category: o.kategori?.slice(0, 80) ?? null,
          metaStatus: meta,
          googleStatus: AD_EVENTS[name].google ? 'bekliyor' : 'yok',
        },
      ],
      skipDuplicates: true,
    });
    return id;
  }

  /** Ayarlar › Gizlilik: reklam ölçümü onayı ya da geri alınması (Karar 35, 59) */
  async onayDegistir(userId: string, acik: boolean, channel: Channel, ip?: string) {
    await this.db.$transaction(async (tx) => {
      const text = await this.consents.current('reklam_olcum', tx);
      await tx.consent.create({
        data: {
          id: uuidv7(),
          userId,
          kind: 'reklam_olcum',
          granted: acik,
          textKey: 'reklam_olcum',
          textVersion: text?.version ?? null,
          channel,
          ip: ip ?? null,
        },
      });
      if (!acik) await this.unut(tx, userId);
    });
    return { acik };
  }

  /** Onay geri alındı ya da hesap kapandı: bekleyen olaylar iptal, tıklama kimlikleri, IP ve tarayıcı silinir */
  async unut(tx: Tx, userId: string) {
    await tx.adEvent.updateMany({ where: { userId, metaStatus: 'bekliyor' }, data: { metaStatus: 'iptal' } });
    await tx.adEvent.updateMany({
      where: { userId, googleStatus: 'bekliyor' },
      data: { googleStatus: 'iptal' },
    });
    const a = await tx.userAttribution.findUnique({ where: { userId } });
    if (!a) return;
    const t = (x: unknown) => (x ? (izinsizTemas(x as Touch) as Prisma.InputJsonValue) : Prisma.DbNull);
    await tx.userAttribution.update({
      where: { userId },
      data: { first: t(a.first), last: t(a.last), ip: null, userAgent: null, cookieOk: false },
    });
  }

  async ayarlar(userId: string) {
    return { acik: await this.onayli(userId) };
  }

  /** İşçi: bekleyen olayları ağlara gönderir (dakikada bir) */
  async gonder(now = new Date()) {
    let n = 0;
    for (const ag of ['meta', 'google'] as const) n += await this.agaGonder(ag, now);
    return n;
  }

  private async agaGonder(ag: AgAdi, now: Date) {
    const network = this.aglar[ag];
    const alan = ag === 'meta' ? 'metaStatus' : 'googleStatus';
    // Kabul süresini geçenler düşer (Meta 7 gün, Google 90 gün)
    await this.db.adEvent.updateMany({
      where: { [alan]: 'bekliyor', createdAt: { lt: new Date(now.getTime() - network.sureGun * DAY) } },
      data: { [alan]: 'hata', lastError: 'Kabul süresi doldu' },
    });
    if (!network.acik) return 0;
    const rows = await this.db.adEvent.findMany({
      where: { [alan]: 'bekliyor', tries: { lt: TRY_SAYISI } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    if (!rows.length) return 0;
    const gidecek: { row: AdEvent; out: AdOut }[] = [];
    for (const row of rows) {
      // Gönderimden önce onay yeniden okunur
      if (!(await this.onayli(row.userId))) {
        await this.db.adEvent.update({ where: { id: row.id }, data: { [alan]: 'iptal' } });
        continue;
      }
      const out = await this.hazirla(row);
      if (ag === 'google' && !out.user.gclid) {
        await this.db.adEvent.update({ where: { id: row.id }, data: { [alan]: 'yok' } });
        continue;
      }
      gidecek.push({ row, out });
    }
    if (!gidecek.length) return 0;
    try {
      await network.gonder(gidecek.map((g) => g.out));
      await this.db.adEvent.updateMany({
        where: { id: { in: gidecek.map((g) => g.row.id) } },
        data: { [alan]: 'gonderildi', sentAt: now, lastError: null },
      });
      await this.db.adNetworkStatus.upsert({
        where: { network: ag },
        create: { network: ag, lastSentAt: now },
        update: { lastSentAt: now },
      });
      return gidecek.length;
    } catch (err) {
      const mesaj = (err as Error).message.slice(0, 300);
      this.log.warn(`${ag} gönderimi: ${mesaj}`);
      for (const g of gidecek)
        await this.db.adEvent.update({
          where: { id: g.row.id },
          data: {
            tries: { increment: 1 },
            lastError: mesaj,
            ...(g.row.tries + 1 >= TRY_SAYISI ? { [alan]: 'hata' } : {}),
          },
        });
      await this.db.adNetworkStatus.upsert({
        where: { network: ag },
        create: { network: ag, lastError: mesaj, lastErrorAt: now },
        update: { lastError: mesaj, lastErrorAt: now },
      });
      return 0;
    }
  }

  /** Olayın gidecek hâli: kişisel bilgiler yalnızca özet; Meta çerezleri ve gclid son (yoksa ilk) temastan */
  private async hazirla(row: AdEvent): Promise<AdOut> {
    const [u, a] = await Promise.all([
      this.db.user.findUnique({ where: { id: row.userId }, select: { phone: true, status: true } }),
      this.db.userAttribution.findUnique({ where: { userId: row.userId } }),
    ]);
    const son = (a?.last as Touch | null) ?? null;
    const ilk = (a?.first as Touch | null) ?? null;
    const al = (k: 'fbp' | 'fbc' | 'gclid') => son?.[k] ?? ilk?.[k];
    const tel = u?.phone?.startsWith('+') ? u.phone.slice(1).replace(/\D/g, '') : null;
    const sunucu = row.platform === 'sunucu';
    return {
      id: row.id,
      name: row.name as AdEventName,
      time: Math.floor(row.createdAt.getTime() / 1000),
      kaynak: sunucu ? 'sunucu' : 'web',
      url: `${this.env.WEB_ORIGIN}${SAYFA[row.name as AdEventName]}`,
      valueKurus: row.valueKurus,
      category: row.category,
      user: {
        externalId: sha(row.userId),
        ...(tel ? { ph: sha(tel) } : {}),
        ...(al('fbp') ? { fbp: al('fbp') } : {}),
        ...(al('fbc') ? { fbc: al('fbc') } : {}),
        ...(al('gclid') ? { gclid: al('gclid') } : {}),
        ...(a?.ip && !sunucu ? { ip: a.ip } : {}),
        ...(a?.userAgent && !sunucu ? { ua: a.userAgent } : {}),
      },
    };
  }

  /**
   * İşçi: her gece dünün ve önceki günün harcaması (ağlar son günü sonradan düzeltir). Ağ bağlı değilse atlanır.
   */
  async harcamaCek(now = new Date()) {
    let n = 0;
    for (const ag of ['meta', 'google'] as const) {
      const network = this.aglar[ag];
      for (const geri of [1, 2]) {
        const gun = trGun(new Date(now.getTime() - geri * DAY));
        try {
          const rows = await network.harcama(gun);
          if (rows === null) break;
          await this.db.$transaction(async (tx) => {
            await tx.adSpend.deleteMany({ where: { network: ag, day: new Date(`${gun}T00:00:00Z`) } });
            if (rows.length)
              await tx.adSpend.createMany({
                data: rows.map((r) => ({
                  network: ag,
                  campaign: r.campaign.slice(0, 150),
                  day: new Date(`${gun}T00:00:00Z`),
                  spendKurus: Math.max(0, r.spendKurus),
                  impressions: Math.max(0, r.impressions),
                  clicks: Math.max(0, r.clicks),
                })),
              });
            await tx.adNetworkStatus.upsert({
              where: { network: ag },
              create: { network: ag, lastSpendAt: now },
              update: { lastSpendAt: now },
            });
          });
          n += rows.length;
        } catch (err) {
          const mesaj = (err as Error).message.slice(0, 300);
          this.log.warn(`${ag} harcama: ${mesaj}`);
          await this.db.adNetworkStatus.upsert({
            where: { network: ag },
            create: { network: ag, lastError: mesaj, lastErrorAt: now },
            update: { lastError: mesaj, lastErrorAt: now },
          });
          break;
        }
      }
    }
    // Gönderilmiş ya da düşmüş olaylar 180 gün sonra silinir (kişisel veri taşımaz ama gerek kalmaz)
    await this.db.adEvent.deleteMany({
      where: {
        createdAt: { lt: new Date(now.getTime() - 180 * DAY) },
        metaStatus: { not: 'bekliyor' },
        googleStatus: { not: 'bekliyor' },
      },
    });
    return n;
  }

  /** Entegrasyonlar kartı: sağlayıcı, son gönderim ve harcama çekimi, bekleyen, son hata */
  async durum() {
    const st = await this.db.adNetworkStatus.findMany();
    const out: Record<
      AgAdi,
      {
        saglayici: string;
        acik: boolean;
        sonGonderim: Date | null;
        sonHarcama: Date | null;
        bekleyen: number;
        hata: string | null;
        hataAt: Date | null;
      }
    > = {} as never;
    for (const ag of ['meta', 'google'] as const) {
      const s = st.find((x) => x.network === ag);
      const alan = ag === 'meta' ? 'metaStatus' : 'googleStatus';
      out[ag] = {
        saglayici: this.aglar[ag].saglayici,
        acik: this.aglar[ag].acik,
        sonGonderim: s?.lastSentAt ?? null,
        sonHarcama: s?.lastSpendAt ?? null,
        bekleyen: await this.db.adEvent.count({ where: { [alan]: 'bekliyor' } }),
        // Hata, son başarılı işten sonraysa gösterilir
        hata:
          s?.lastError &&
          s.lastErrorAt &&
          s.lastErrorAt > (s.lastSentAt ?? new Date(0)) &&
          s.lastErrorAt > (s.lastSpendAt ?? new Date(0))
            ? s.lastError
            : null,
        hataAt: s?.lastErrorAt ?? null,
      };
    }
    return out;
  }

  /**
   * Raporlar › Reklam ve edinim (YonetimRapor.dc.html › reklam). Dönemde üye olanlar ilk temaslarının kampanyasına
   * bağlanır; talep ve yeni galeri bu üyelerin, getiri üyelikten sonraki 30 günün ödemesi ÷ harcama. Harcama reklam
   * hesaplarından çekilen günlük tutardır; kampanya adı UTM kampanyasıyla eşleşir. Kişisel veri içermez.
   */
  async rapor(a: Aralik, now = new Date()) {
    const uyeler = await this.db.user.findMany({
      where: { createdAt: { gte: a.bas, lt: a.bit } },
      select: {
        id: true,
        createdAt: true,
        attribution: { select: { channel: true, network: true, campaign: true } },
        _count: { select: { demands: { where: { publishedAt: { not: null } } } } },
        galleryApplications: { where: { status: 'APPROVED' }, select: { id: true }, take: 1 },
      },
    });
    const odemeler = uyeler.length
      ? await this.db.$queryRaw<{ user_id: string; toplam: bigint }[]>`
          SELECT o.user_id, SUM(o.total_kurus)::bigint AS toplam
            FROM orders o JOIN users u ON u.id = o.user_id
           WHERE o.status = 'PAID' AND o.paid_at < u.created_at + interval '30 days'
             AND u.created_at >= ${a.bas} AND u.created_at < ${a.bit}
           GROUP BY o.user_id`
      : [];
    const odeme = new Map(odemeler.map((o) => [o.user_id, Number(o.toplam)]));
    const harcamalar = await this.db.adSpend.groupBy({
      by: ['network', 'campaign'],
      where: {
        day: { gte: new Date(`${trGun(a.bas)}T00:00:00Z`), lte: new Date(`${trGun(a.bit)}T00:00:00Z`) },
      },
      _sum: { spendKurus: true },
    });

    interface Satir {
      anahtar: string;
      ad: string;
      kanal: Kanal;
      ag: string | null;
      harcama: number;
      uye: number;
      talep: number;
      galeri: number;
      odeme: number;
    }
    const satirlar = new Map<string, Satir>();
    const al = (kanal: Kanal, ag: string | null, ad: string) => {
      const anahtar = kanal === 'reklam' ? `${ag ?? ''}|${ad}` : `${kanal}|${ad}`;
      let s = satirlar.get(anahtar);
      if (!s) {
        s = { anahtar, ad, kanal, ag, harcama: 0, uye: 0, talep: 0, galeri: 0, odeme: 0 };
        satirlar.set(anahtar, s);
      }
      return s;
    };
    for (const u of uyeler) {
      const k = (u.attribution?.channel as Kanal | undefined) ?? 'organik';
      const s = al(
        k,
        k === 'reklam' ? (u.attribution?.network ?? null) : null,
        k === 'reklam' ? (u.attribution?.campaign ?? 'Kampanyasız') : KANAL_ADI[k],
      );
      s.uye++;
      s.talep += u._count.demands;
      s.galeri += u.galleryApplications.length;
      s.odeme += odeme.get(u.id) ?? 0;
    }
    for (const h of harcamalar) {
      const ag = h.network === 'meta' ? 'Meta' : 'Google';
      al('reklam', ag, h.campaign).harcama += h._sum.spendKurus ?? 0;
    }
    const liste = [...satirlar.values()].sort(
      (x, y) =>
        (x.kanal === 'reklam' ? 0 : 1) - (y.kanal === 'reklam' ? 0 : 1) ||
        y.harcama - x.harcama ||
        y.uye - x.uye,
    );
    const say = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
    const kat = (x: number) =>
      `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(x)}×`;
    const reklam = liste.filter((s) => s.kanal === 'reklam');
    const top = (f: (s: Satir) => number, l = reklam) => l.reduce((t, s) => t + f(s), 0);
    const harcama = top((s) => s.harcama);
    const galeriHedefli = reklam.filter((s) => s.galeri > 0);
    const galeriHarcama = top((s) => s.harcama, galeriHedefli);
    const galeriSayisi = top((s) => s.galeri, galeriHedefli);
    const reklamUye = top((s) => s.uye);
    const reklamOdeme = top((s) => s.odeme);

    const st = await this.db.adNetworkStatus.findMany({ where: { lastSpendAt: { not: null } } });
    const sonCekim = st.map((s) => s.lastSpendAt as Date).sort((x, y) => y.getTime() - x.getTime())[0];
    const saat = (d: Date) =>
      new Intl.DateTimeFormat('tr-TR', {
        timeZone: 'Europe/Istanbul',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    const cekimNotu = sonCekim
      ? `Meta ve Google reklam hesaplarından her gece kendiliğinden çekilir · son çekim ${
          trGun(sonCekim) === trGun(now)
            ? `bugün ${saat(sonCekim)}`
            : new Intl.DateTimeFormat('tr-TR', {
                timeZone: 'Europe/Istanbul',
                day: 'numeric',
                month: 'short',
              }).format(sonCekim)
        }`
      : 'Harcama, reklam hesapları bağlanınca her gece kendiliğinden çekilir · henüz çekim yok';

    return {
      reklamSayilar: [
        { ad: 'Toplam harcama', deger: tlYaz(harcama), not: 'Dönem · Meta ve Google' },
        {
          ad: 'Galeri başına edinme',
          deger: galeriSayisi && galeriHarcama ? tlYaz(Math.round(galeriHarcama / galeriSayisi)) : '—',
          not: 'Galeri getiren kampanyalar',
        },
        {
          ad: 'Üye başına maliyet',
          deger: reklamUye && harcama ? tlYaz(Math.round(harcama / reklamUye)) : '—',
          not: 'Tüm kampanyalar',
        },
        {
          ad: 'Reklam getirisi',
          deger: harcama ? kat(reklamOdeme / harcama) : '—',
          not: '30 günlük ödeme ÷ harcama',
        },
      ],
      cekimNotu,
      kampanyalar: liste.map((s) => ({
        ad: s.ad,
        kanal: s.kanal === 'reklam' ? `${s.ag ?? 'Diğer ağ'} · reklam` : 'Kanal',
        harcama: s.kanal === 'reklam' ? tlYaz(s.harcama) : '—',
        uye: say(s.uye),
        talep: say(s.talep),
        galeri: say(s.galeri),
        uyeBasi: s.harcama && s.uye ? tlYaz(Math.round(s.harcama / s.uye)) : '—',
        getiri: s.harcama ? kat(s.odeme / s.harcama) : '—',
      })),
      kanallar: (['reklam', 'bildirim', 'organik'] as const).map((k) => {
        const l = liste.filter((s) => s.kanal === k);
        return {
          kanal: k,
          ad: KANAL_ADI[k],
          uye: top((s) => s.uye, l),
          talep: top((s) => s.talep, l),
          galeri: top((s) => s.galeri, l),
          odeme: tlYaz(top((s) => s.odeme, l)),
        };
      }),
      yorum: this.yorum(reklam, harcama),
    };
  }

  /** Ajanın kural tabanlı yorumu: talebe dönüşmeyen ucuz üye ve en yüksek getiri (bütçe değişikliği sahibin onayıyla) */
  private yorum(
    reklam: { ad: string; harcama: number; uye: number; talep: number; odeme: number }[],
    harcama: number,
  ) {
    if (!harcama)
      return reklam.length
        ? 'Reklamla gelen üyeler var ama harcama henüz çekilmedi; getiri reklam hesapları bağlanınca hesaplanır.'
        : null;
    const yeterli = reklam.filter((s) => s.uye >= 20 && s.harcama > 0);
    if (yeterli.length < 2) return null;
    const oran = (s: (typeof yeterli)[number]) => s.talep / s.uye;
    const zayif = [...yeterli].sort((x, y) => oran(x) - oran(y))[0] as (typeof yeterli)[number];
    const iyi = [...yeterli].sort(
      (x, y) => y.odeme / y.harcama - x.odeme / x.harcama,
    )[0] as (typeof yeterli)[number];
    if (zayif.ad === iyi.ad || oran(zayif) >= 0.6) return null;
    return `"${zayif.ad}" kampanyasının üyelerinin yalnızca %${Math.round(oran(zayif) * 100)}'i talep açıyor. Bütçenin bir kısmını en yüksek getirili "${iyi.ad}" kampanyasına kaydırmayı öneriyorum; harcama değişikliği senin onayınla yapılır.`;
  }
}
