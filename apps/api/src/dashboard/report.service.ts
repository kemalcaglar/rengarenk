import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type Prisma, uuidv7 } from '@rengarenk/db';
import {
  changeText,
  ekle,
  HEAT_RAMP,
  heatStep,
  MAIN_METRIC_HOURS,
  PRODUCTS,
  type ReportFilter,
  type ReportTab,
  SUPPLY_STATES,
  supplyState,
  tlYaz,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { trGunBasi } from './dashboard.service.js';
import { type ReportTable, reportCsv } from './report-pdf.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const BULDUM = ['rengarenk', 'baska_site', 'tanidik'];
const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const AY = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];
const sayi = (n: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n);
const yuzde = (x: number, basamak = 0) =>
  `%${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: basamak }).format(x * 100)}`;
const tl = (kurus: number) => tlYaz(Math.round(kurus));

interface Aralik {
  bas: Date;
  bit: Date;
}
const ayBasiOf = (d: Date) => {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
  }).format(d);
  return new Date(`${s}-01T00:00:00+03:00`);
};
const ayEkle = (d: Date, n: number) => {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
  }).format(d);
  const [y, m] = s.split('-').map(Number) as [number, number];
  const t = y * 12 + (m - 1) + n;
  return new Date(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01T00:00:00+03:00`);
};
const ayAdi = (d: Date, kisa = false) => {
  const m = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', month: 'numeric' }).format(d),
  );
  return (kisa ? AY_KISA : AY)[m - 1] as string;
};

/**
 * Raporlar (Karar 44; YonetimRapor.dc.html › rapor): huni, arz-talep haritası, gelir, en çok talep edilenler, birim
 * ekonomisi ve kohort gerçek veriyle; reklam ve edinim Meta ve Google hesapları bağlanınca, deneyler A/B altyapısıyla
 * gelir. Ziyaretçi sayısı web analitiği gelene kadar yoktur. Dışa aktarma kişisel veri içermez ve işlem kaydına girer.
 */
@Injectable()
export class ReportService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  araliklar(f: ReportFilter, now = new Date()): { simdi: Aralik; once: Aralik | null; ad: string } {
    let simdi: Aralik;
    let ad: string;
    if (f.tarih === 'bu_ay') {
      simdi = { bas: ayBasiOf(now), bit: now };
      ad = `${ayAdi(now)} (bu ay)`;
    } else if (f.tarih === 'gecen_ay') {
      const bas = ayEkle(ayBasiOf(now), -1);
      simdi = { bas, bit: ayBasiOf(now) };
      ad = ayAdi(bas);
    } else {
      const n = f.tarih === '7' ? 7 : 30;
      simdi = { bas: new Date(trGunBasi(now).getTime() - (n - 1) * DAY), bit: now };
      ad = `son ${n} gün`;
    }
    const uzun = simdi.bit.getTime() - simdi.bas.getTime();
    const once =
      f.karsilastir === 'yok' ? null : { bas: new Date(simdi.bas.getTime() - uzun), bit: simdi.bas };
    return { simdi, once, ad };
  }

  private async kategoriId(slug?: string) {
    if (!slug) return null;
    const c = await this.db.category.findUnique({ where: { slug }, select: { id: true } });
    if (!c) return null;
    // Üst kategori seçildiyse alt kategorileri de kapsar
    const alt = await this.db.category.findMany({ where: { parentId: c.id }, select: { id: true } });
    return [c.id, ...alt.map((a) => a.id)];
  }

  /** Süzgeçlere uyan yayınlanmış talepler */
  private async talepler(a: Aralik, f: ReportFilter) {
    const kat = await this.kategoriId(f.kategori);
    return this.db.demand.findMany({
      where: {
        publishedAt: { gte: a.bas, lt: a.bit },
        ...(f.il ? { il: f.il } : {}),
        ...(kat ? { categoryId: { in: kat } } : {}),
        ...(f.platform ? { platform: f.platform } : {}),
      },
      select: {
        id: true,
        il: true,
        categoryId: true,
        publishedAt: true,
        closedAt: true,
        foundVia: true,
        data: true,
        conversations: {
          where: { origin: 'talep' },
          select: { createdAt: true, messages: { where: { side: 'alici' }, take: 1, select: { id: true } } },
        },
      },
    });
  }

  async report(tab: ReportTab, f: ReportFilter, now = new Date()) {
    const r = this.araliklar(f, now);
    const filtreNotu =
      tab === 'gelir' || tab === 'birim'
        ? f.il || f.kategori || f.platform
          ? 'Gelir ve birim ekonomisi il, kategori ve platform süzgecine bağlı değildir.'
          : null
        : null;
    const ortak = { sekme: tab, donem: r.ad, filtreNotu };
    switch (tab) {
      case 'huni':
        return { ...ortak, ...(await this.huni(r.simdi, r.once, f)) };
      case 'harita':
        return { ...ortak, ...(await this.harita(r.simdi, f)) };
      case 'gelir':
        return { ...ortak, ...(await this.gelir(r.simdi, r.once, now)) };
      case 'model':
        return { ...ortak, ...(await this.modeller(r.simdi, f)) };
      case 'birim':
        return { ...ortak, ...(await this.birim(now)) };
      case 'reklam':
        return {
          ...ortak,
          bos: 'Meta ve Google reklam hesapları bağlanınca harcama, üyelik, talep, yeni galeri, üye başı maliyet ve getiri her gece kendiliğinden çekilir (Karar 44). Hesaplar sahipte.',
        };
      default:
        return {
          ...ortak,
          bos: 'A/B ve fiyat deneyleri, deney altyapısı (özellik anahtarlarıyla yüzde dağıtım ve ölçüm) kurulunca burada görünür. Fiyat deneyleri sahip onayıyla açılır.',
        };
    }
  }

  private async huni(a: Aralik, o: Aralik | null, f: ReportFilter) {
    const hesap = async (x: Aralik) => {
      const [uye, t] = await Promise.all([
        f.il || f.kategori || f.platform
          ? Promise.resolve(null)
          : this.db.user.count({ where: { createdAt: { gte: x.bas, lt: x.bit } } }),
        this.talepler(x, f),
      ]);
      const pencere = MAIN_METRIC_HOURS * HOUR;
      const olgun = t.filter((d) => (d.publishedAt as Date).getTime() <= now.getTime() - pencere);
      const ilk = olgun.filter((d) =>
        d.conversations.some((c) => c.createdAt.getTime() <= (d.publishedAt as Date).getTime() + pencere),
      );
      const sohbet = t.filter((d) => d.conversations.some((c) => c.messages.length > 0));
      const buldum = t.filter((d) => d.foundVia && BULDUM.includes(d.foundVia));
      return {
        uye,
        talep: t.length,
        olgun: olgun.length,
        ilk: ilk.length,
        sohbet: sohbet.length,
        buldum: buldum.length,
      };
    };
    const now = new Date();
    const s = await hesap(a);
    const p = o ? await hesap(o) : null;
    const taban = s.uye ?? s.talep;
    const oran = (x: number, y: number) => (y ? yuzde(x / y) : '—');
    const satirlar = [
      ...(s.uye !== null ? [{ ad: 'Üyelik', sayi: s.uye, not: '', once: p?.uye ?? null }] : []),
      {
        ad: 'Talep oluşturan',
        sayi: s.talep,
        not: s.uye !== null ? `${oran(s.talep, s.uye)} · üyelikten` : 'Süzgece uyan talepler',
        once: p?.talep ?? null,
      },
      {
        ad: 'İlk mesaj alan talep',
        sayi: s.ilk,
        not: `${oran(s.ilk, s.olgun)} · 48 saat içinde (48 saati dolan ${sayi(s.olgun)} talepten)`,
        once: p?.ilk ?? null,
      },
      {
        ad: 'Sohbet açılan talep',
        sayi: s.sohbet,
        not: `${oran(s.sohbet, s.ilk || s.talep)} · ilk mesaj alanlardan`,
        once: p?.sohbet ?? null,
      },
      {
        ad: 'Aracı buldum',
        sayi: s.buldum,
        not: `${oran(s.buldum, s.sohbet)} · sohbet açılanlardan`,
        once: p?.buldum ?? null,
      },
    ].map((x) => ({
      ...x,
      w: taban ? Math.min(100, (x.sayi / taban) * 100) : 0,
      fark: x.once === null ? null : changeText(x.sayi, x.once),
    }));
    // En büyük kayıp adımı
    let kayip = { ad: '', oran: 0 };
    for (let i = 1; i < satirlar.length; i++) {
      const once = satirlar[i - 1]?.sayi ?? 0;
      const k = once ? 1 - (satirlar[i]?.sayi ?? 0) / once : 0;
      if (k > kayip.oran)
        kayip = {
          ad: `${satirlar[i - 1]?.ad.toLocaleLowerCase('tr-TR')} → ${satirlar[i]?.ad.toLocaleLowerCase('tr-TR')}`,
          oran: k,
        };
    }
    return {
      ust:
        s.uye !== null
          ? `${sayi(s.uye)} yeni üye. Çubuk uzunluğu üyeliğe göre oran.`
          : 'Süzgeç seçildiği için üyelik gösterilmez; çubuklar talebe göre.',
      ziyaretNotu: 'Ziyaretçi sayısı web analitiği bağlanınca huninin başına eklenecek.',
      huni: satirlar,
      yorum: kayip.oran
        ? `En büyük kayıp ${kayip.ad} adımında (${yuzde(kayip.oran)}).`
        : 'Bu dönemde huni boyunca kayıp ölçülecek kadar veri yok.',
    };
  }

  private async harita(a: Aralik, f: ReportFilter) {
    const t = await this.talepler(a, f);
    const kat = new Map(
      (await this.db.category.findMany({ select: { id: true, name: true } })).map((c) => [c.id, c.name]),
    );
    const pencere = MAIN_METRIC_HOURS * HOUR;
    const now = Date.now();
    const hucre = new Map<string, { n: number; olgun: number; bos: number }>();
    const ilSay = new Map<string, number>();
    const katSay = new Map<string, number>();
    for (const d of t) {
      const il = d.il ?? 'Belirtilmemiş';
      const k = kat.get(d.categoryId) ?? 'Diğer';
      ilSay.set(il, (ilSay.get(il) ?? 0) + 1);
      katSay.set(k, (katSay.get(k) ?? 0) + 1);
      const h = hucre.get(`${il}|${k}`) ?? { n: 0, olgun: 0, bos: 0 };
      h.n++;
      if ((d.publishedAt as Date).getTime() <= now - pencere) {
        h.olgun++;
        if (
          !d.conversations.some((c) => c.createdAt.getTime() <= (d.publishedAt as Date).getTime() + pencere)
        )
          h.bos++;
      }
      hucre.set(`${il}|${k}`, h);
    }
    const iller = [...ilSay.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 8)
      .map(([il]) => il);
    const kategoriler = [...katSay.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 5)
      .map(([k]) => k);
    const galeriler = await this.db.gallery.groupBy({
      by: ['il'],
      where: { il: { in: iller } },
      _count: true,
    });
    const galeriSay = new Map(galeriler.map((g) => [g.il, g._count]));
    const satirlar = iller.map((il) => ({
      il,
      hucre: kategoriler.map((k) => {
        const h = hucre.get(`${il}|${k}`) ?? { n: 0, olgun: 0, bos: 0 };
        const bos = h.olgun ? h.bos / h.olgun : null;
        return {
          kategori: k,
          sayi: h.n,
          bos,
          sayiAdim: heatStep(h.n, [30, 60, 120, 300]),
          bosAdim: bos === null ? -1 : heatStep(bos * 100, [12, 18, 25, 40]),
          ipucu: `${il} · ${k}: ${h.n} talep${bos === null ? '' : `, ${yuzde(bos)}’i 48 saatte mesaj almadı`}`,
        };
      }),
    }));
    const aciklar = [...hucre.entries()]
      .filter(([, h]) => h.olgun >= 3 && h.bos > 0)
      .map(([key, h]) => ({ key, h, oran: h.bos / h.olgun }))
      .sort((x, y) => y.oran - x.oran)
      .slice(0, 4)
      .map(({ key, h, oran }) => {
        const [il, k] = key.split('|') as [string, string];
        return {
          yer: `${il} · ${k}`,
          oran: yuzde(oran),
          not: `${sayi(h.n)} talep · ${ekle(il, 'bulunma')} ${sayi(galeriSay.get(il) ?? 0)} galeri`,
        };
      });
    return {
      kategoriler,
      satirlar,
      ramp: HEAT_RAMP,
      lejant: {
        bos: ['%12 altı', '%12–17', '%18–24', '%25–39', '%40 ve üstü'],
        sayi: ['30 altı', '30–59', '60–119', '120–299', '300 ve üstü'],
      },
      aciklar,
      yorum: aciklar[0]
        ? `En büyük arz açığı ${aciklar[0].yer} (${aciklar[0].oran}). Bu bölgedeki galerilere duyuru ve deneme önerisi kampanyalarla gönderilebilir.`
        : 'Bu dönemde belirgin bir arz açığı yok (en az 3 olgun talep olan hücreler).',
    };
  }

  /** Abonelik dönem fiyatı aylığa çevrilmiş (KDV hariç, kuruş) */
  private aylik(s: { period: string; priceKurus: bigint }) {
    return s.period === 'yillik' ? Number(s.priceKurus) / 12 : Number(s.priceKurus);
  }

  private async gelir(a: Aralik, o: Aralik | null, now: Date) {
    const siparis = (x: Aralik) =>
      this.db.order.findMany({
        where: { status: 'PAID', paidAt: { gte: x.bas, lt: x.bit } },
        select: {
          kind: true,
          channel: true,
          items: true,
          totalKurus: true,
          account: { select: { kind: true } },
        },
      });
    const iade = (x: Aralik) =>
      this.db.refund.findMany({
        where: { status: 'EXECUTED', executedAt: { gte: x.bas, lt: x.bit } },
        select: { amountKurus: true },
      });
    const [s, sOnce, i] = await Promise.all([siparis(a), o ? siparis(o) : Promise.resolve([]), iade(a)]);
    const toplam = (rows: { totalKurus: bigint }[]) => rows.reduce((t, r) => t + Number(r.totalKurus), 0);
    const iadeToplam = i.reduce((t, r) => t + Number(r.amountKurus), 0);
    const brut = toplam(s);
    const net = brut - iadeToplam;

    // Kalemler: galeri abonelikleri ve ürünler (galeri/bireysel)
    const kalem = new Map<string, number>();
    for (const r of s) {
      if (r.kind !== 'urun') {
        kalem.set('Galeri abonelikleri', (kalem.get('Galeri abonelikleri') ?? 0) + Number(r.totalKurus));
        continue;
      }
      const galeri = r.account.kind === 'BUSINESS';
      for (const k of (r.items as { urun?: string; tutarKurus?: number }[]) ?? []) {
        const p = PRODUCTS.find((x) => x.key === k.urun);
        const ad = `${p?.ad.split(' · ')[0] ?? 'Diğer'} · ${galeri ? 'galeri' : 'bireysel'}`;
        kalem.set(ad, (kalem.get(ad) ?? 0) + Number(k.tutarKurus ?? 0));
      }
    }
    const kalemler = [...kalem.entries()].sort((x, y) => y[1] - x[1]);
    const enCok = Math.max(1, ...kalemler.map(([, v]) => v));

    // Aylık tekrarlayan gelir: son 6 ay sonu (bu ay için bugün)
    const subs = await this.db.subscription.findMany({
      select: { period: true, priceKurus: true, createdAt: true, endedAt: true, status: true },
    });
    const mrrAt = (t: Date) =>
      subs
        .filter((x) => x.createdAt <= t && (!x.endedAt || x.endedAt > t))
        .reduce((tt, x) => tt + this.aylik(x), 0);
    const mrr = Array.from({ length: 6 }, (_, k) => {
      const ay = ayEkle(ayBasiOf(now), k - 5);
      const son = k === 5 ? now : ayEkle(ay, 1);
      return { ay: ayAdi(ay, true), kurus: mrrAt(son) };
    });
    const mrrSimdi = mrr.at(-1)?.kurus ?? 0;

    // Galeri kayıp oranı (son 30 gün): dönem başında aktif olanlardan ayrılan
    const otuz = new Date(now.getTime() - 30 * DAY);
    const bastaAktif = subs.filter((x) => x.createdAt <= otuz && (!x.endedAt || x.endedAt > otuz)).length;
    const ayrilan = subs.filter((x) => x.endedAt && x.endedAt > otuz && x.endedAt <= now).length;
    // Denemeden ücretliye (son 90 günde denemesi biten galeriler)
    const doksan = new Date(now.getTime() - 90 * DAY);
    const denemeBiten = await this.db.gallery.findMany({
      where: {
        approvedAt: { gte: new Date(doksan.getTime() - 30 * DAY) },
        trialEndsAt: { gte: doksan, lte: now },
      },
      select: { accountId: true },
    });
    const gecen = denemeBiten.length
      ? await this.db.subscription.count({
          where: { accountId: { in: denemeBiten.map((g) => g.accountId) } },
        })
      : 0;
    const kanal = new Map<string, number>();
    for (const r of s) kanal.set(r.channel, (kanal.get(r.channel) ?? 0) + Number(r.totalKurus));
    const KANAL: Record<string, string> = { web: 'web', ios: 'iOS', android: 'Android' };
    return {
      sayilar: [
        {
          ad: 'Toplam gelir',
          deger: tl(net),
          not: `KDV dahil, iadeler düşülmüş${o ? ` · ${changeText(net, toplam(sOnce)).metin}` : ''}`,
        },
        { ad: 'Aylık tekrarlayan', deger: tl(mrrSimdi), not: 'Galeri abonelikleri · KDV hariç' },
        {
          ad: 'Galeri kayıp oranı',
          deger: bastaAktif ? yuzde(ayrilan / bastaAktif, 1) : '—',
          not: `Son 30 gün · ${sayi(ayrilan)} galeri ayrıldı`,
        },
        {
          ad: 'Denemeden ücretliye',
          deger: denemeBiten.length ? yuzde(gecen / denemeBiten.length) : '—',
          not: `Son 90 günde denemesi biten ${sayi(denemeBiten.length)} galeri`,
        },
        {
          ad: 'İade oranı',
          deger: brut ? yuzde(iadeToplam / brut, 1) : '—',
          not: `${sayi(i.length)} iade · hepsi Sahip onayıyla`,
        },
      ],
      kalemler: kalemler.map(([ad, v]) => ({
        ad,
        tutar: tl(v),
        w: (v / enCok) * 100,
        ipucu: `${ad}: ${tl(v)}${brut ? ` (${yuzde(v / brut)})` : ''}`,
      })),
      mrr: mrr.map((m) => ({ ...m, tutar: tl(m.kurus) })),
      platformPayi: brut
        ? `Platform payı: ${[...kanal.entries()].map(([k, v]) => `${KANAL[k] ?? k} ${yuzde(v / brut)}`).join(' · ')}. Mobil satışlarda mağaza komisyonu düşülmeden gösterilir.`
        : 'Bu dönemde ödeme yok.',
    };
  }

  private async modeller(a: Aralik, f: ReportFilter) {
    const t = await this.talepler(a, f);
    const say = new Map<string, number>();
    for (const d of t) {
      const m = (d.data as { alanlar?: { model?: { make?: string; series?: string; model?: string } } })
        ?.alanlar?.model;
      const key = m?.series ?? m?.make;
      if (key) say.set(key, (say.get(key) ?? 0) + 1);
    }
    const ilk = [...say.entries()].sort((x, y) => y[1] - x[1]).slice(0, 12);
    const keys = ilk.map(([k]) => k);
    const [seriler, markalar, araclar] = await Promise.all([
      this.db.catalogSeries.findMany({
        where: { key: { in: keys } },
        select: { key: true, name: true, make: { select: { name: true } } },
      }),
      this.db.catalogMake.findMany({ where: { key: { in: keys } }, select: { key: true, name: true } }),
      this.db.portfolioVehicle.groupBy({
        by: ['seriesKey'],
        where: { status: 'PUBLISHED', seriesKey: { in: keys } },
        _count: true,
      }),
    ]);
    const ad = new Map([
      ...seriler.map((x) => [x.key, `${x.make.name} ${x.name}`] as [string, string]),
      ...markalar.map((x) => [x.key, `${x.name} (seri seçilmedi)`] as [string, string]),
    ]);
    const arac = new Map(araclar.map((x) => [x.seriesKey as string, x._count]));
    const satirlar = ilk.map(([key, n], i) => {
      const u = arac.get(key) ?? 0;
      const durum = supplyState(u, n);
      return {
        sira: i + 1,
        ad: ad.get(key) ?? key,
        talep: n,
        arama: null,
        arac: u,
        durum: SUPPLY_STATES[durum].ad,
        bg: SUPPLY_STATES[durum].bg,
        fg: SUPPLY_STATES[durum].fg,
      };
    });
    const acik = satirlar.filter((s) => s.durum === 'Büyük açık').slice(0, 2);
    return {
      modeller: satirlar,
      aramaNotu: 'Arama sayısı arama günlüğü tutulmaya başlayınca eklenecek.',
      yorum: acik.length
        ? `${acik.map((s) => s.ad).join(' ve ')} için uygun araç talebin altında. Bu modelleri satan galerilere "talep var" bildirimi kampanyalarla gönderilebilir.`
        : 'Bu dönemde talebin çok altında arz kalan model yok.',
    };
  }

  private async birim(now: Date) {
    const otuz = new Date(now.getTime() - 30 * DAY);
    const [subs, galeriOdeme, aktifBireysel, odeyenBireysel] = await Promise.all([
      this.db.subscription.findMany({
        select: { accountId: true, period: true, priceKurus: true, createdAt: true, endedAt: true },
      }),
      this.db.order.groupBy({
        by: ['accountId'],
        where: { status: 'PAID', account: { kind: 'BUSINESS' } },
        _sum: { totalKurus: true },
      }),
      this.db.user.count({
        where: {
          status: 'ACTIVE',
          devices: { some: { lastSeenAt: { gte: otuz } } },
          memberships: { some: { account: { kind: 'INDIVIDUAL' } } },
        },
      }),
      this.db.order.groupBy({
        by: ['accountId'],
        where: { status: 'PAID', paidAt: { gte: otuz }, account: { kind: 'INDIVIDUAL' } },
        _sum: { totalKurus: true },
      }),
    ]);
    // Ortalama abonelik süresi (ay) ve aylık gelir
    const sure = subs.map((s) => ((s.endedAt ?? now).getTime() - s.createdAt.getTime()) / (30 * DAY));
    const ortAy = sure.length ? sure.reduce((t, x) => t + x, 0) / sure.length : 0;
    const ortAylik = subs.length ? subs.reduce((t, s) => t + this.aylik(s), 0) / subs.length : 0;
    const galeriToplam = galeriOdeme.reduce((t, g) => t + Number(g._sum.totalKurus ?? 0), 0);
    const odeyen = odeyenBireysel.length;
    const odeyenToplam = odeyenBireysel.reduce((t, g) => t + Number(g._sum.totalKurus ?? 0), 0);

    // Kohort: son 5 ayın her birinde ücretliye geçen galerilerin sonraki aylarda hâlâ ödeyenleri
    const kohort = Array.from({ length: 5 }, (_, k) => {
      const ay = ayEkle(ayBasiOf(now), k - 4);
      const sonraki = ayEkle(ay, 1);
      const grup = subs.filter((s) => s.createdAt >= ay && s.createdAt < sonraki);
      const hucre = Array.from({ length: 5 }, (_, i) => {
        const t = ayEkle(ay, i + 1);
        if (i > 0 && ayEkle(ay, i) > now) return null;
        if (!grup.length) return null;
        const kalan = grup.filter((s) => !s.endedAt || s.endedAt > (t > now ? now : t)).length;
        return Math.round((kalan / grup.length) * 100);
      });
      return {
        ay: `${ayAdi(ay)} ${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric' }).format(ay)}`,
        adet: grup.length,
        hucre: hucre.map((v, i) => ({
          v,
          adim: v === null ? -1 : v >= 100 ? 4 : v >= 92 ? 3 : v >= 88 ? 2 : v >= 84 ? 1 : 0,
          ipucu: v === null ? 'Henüz veri yok' : `${i}. ay: %${v} hâlâ ücretli (${grup.length} galeri)`,
        })),
      };
    });
    return {
      sayilar: [
        {
          ad: 'Galeri başına ömür boyu gelir',
          deger: subs.length ? tl(ortAy * ortAylik) : '—',
          not: subs.length
            ? `Ort. ${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(ortAy)} ay × ${tl(ortAylik)} (KDV hariç)`
            : 'Henüz abonelik yok',
        },
        { ad: 'Galeri edinme maliyeti', deger: '—', not: 'Reklam hesapları bağlanınca' },
        { ad: 'Ömür boyu gelir ÷ edinme', deger: '—', not: 'Edinme maliyetiyle hesaplanır' },
        {
          ad: 'Galerilerin toplam ödemesi',
          deger: tl(galeriToplam),
          not: `${sayi(galeriOdeme.length)} galeri · KDV dahil`,
        },
        {
          ad: 'Ödeme yapan bireysel',
          deger: aktifBireysel ? yuzde(odeyen / aktifBireysel, 1) : '—',
          not: `Son 30 günde aktif ${sayi(aktifBireysel)} bireysel kullanıcının`,
        },
        {
          ad: 'Ödeme yapan bireysel başına',
          deger: odeyen ? tl(odeyenToplam / odeyen) : '—',
          not: 'Son 30 gün',
        },
      ],
      kohortBaslik: ['Başlangıç', '1. ay', '2. ay', '3. ay', '4. ay'],
      kohort,
      ramp: HEAT_RAMP,
    };
  }

  /**
   * Raporun tabloları (PDF ve Excel aynı satırları kullanır). Reklam ve deneyler bağlantı kurulunca dolar; o
   * sekmelerde tablo yoktur. Kişisel veri içermez.
   */
  tablolar(tab: ReportTab, r: Record<string, unknown>): ReportTable[] {
    const yorum = (r.yorum as string | undefined) ?? null;
    switch (tab) {
      case 'huni':
        return [
          {
            baslik: 'Huni',
            kolonlar: ['Adım', 'Sayı', 'Önceki dönem', 'Not'],
            satirlar: (
              r.huni as {
                ad: string;
                sayi: number;
                once: number | null;
                not: string;
                fark: { metin: string } | null;
              }[]
            ).map((x) => [x.ad, x.sayi, x.once, x.not]),
            not: yorum,
          },
        ];
      case 'harita': {
        const k = r.kategoriler as string[];
        return [
          {
            baslik: 'İl × kategori: talep ve 48 saatte mesaj almayan oran',
            kolonlar: ['İl', ...k],
            satirlar: (r.satirlar as { il: string; hucre: { sayi: number; bos: number | null }[] }[]).map(
              (s) => [
                s.il,
                ...s.hucre.map((h) =>
                  h.bos === null ? `${h.sayi}` : `${h.sayi} · %${Math.round(h.bos * 100)}`,
                ),
              ],
            ),
          },
          {
            baslik: 'En büyük arz açıkları',
            kolonlar: ['Yer', 'Mesaj almayan', 'Not'],
            satirlar: (r.aciklar as { yer: string; oran: string; not: string }[]).map((a) => [
              a.yer,
              a.oran,
              a.not,
            ]),
            not: yorum,
          },
        ];
      }
      case 'gelir':
        return [
          {
            baslik: 'Gelir',
            kolonlar: ['Ölçü', 'Değer', 'Not'],
            satirlar: (r.sayilar as { ad: string; deger: string; not: string }[]).map((x) => [
              x.ad,
              x.deger,
              x.not,
            ]),
          },
          {
            baslik: 'Gelir kalemleri',
            kolonlar: ['Kalem', 'Tutar'],
            satirlar: (r.kalemler as { ad: string; tutar: string }[]).map((x) => [x.ad, x.tutar]),
            not: (r.platformPayi as string | undefined) ?? null,
          },
          {
            baslik: 'Aylık tekrarlayan gelir (son 6 ay)',
            kolonlar: ['Ay', 'Tutar'],
            satirlar: (r.mrr as { ay: string; tutar: string }[]).map((x) => [x.ay, x.tutar]),
          },
        ];
      case 'model':
        return [
          {
            baslik: 'En çok talep edilen modeller',
            kolonlar: ['Sıra', 'Model', 'Talep', 'Uygun araç', 'Durum'],
            satirlar: (
              r.modeller as { sira: number; ad: string; talep: number; arac: number; durum: string }[]
            ).map((x) => [x.sira, x.ad, x.talep, x.arac, x.durum]),
            not: yorum,
          },
        ];
      case 'birim': {
        const baslik = r.kohortBaslik as string[];
        return [
          {
            baslik: 'Birim ekonomisi',
            kolonlar: ['Ölçü', 'Değer', 'Not'],
            satirlar: (r.sayilar as { ad: string; deger: string; not: string }[]).map((x) => [
              x.ad,
              x.deger,
              x.not,
            ]),
          },
          {
            baslik: 'Ücretli galeri kohortu (hâlâ ücretli olanların payı)',
            kolonlar: ['Ay', 'Galeri', ...baslik.slice(1)],
            satirlar: (r.kohort as { ay: string; adet: number; hucre: { v: number | null }[] }[]).map((k) => [
              k.ay,
              k.adet,
              ...k.hucre.slice(1).map((h) => (h.v === null ? null : `%${h.v}`)),
            ]),
          },
        ];
      }
      default:
        return [];
    }
  }

  /** CSV (Excel açar): kişisel veri içermez; dışa aktarma işlem kaydına girer */
  async export(staffId: string, tab: ReportTab, f: ReportFilter, ip?: string) {
    const r = (await this.report(tab, f)) as Record<string, unknown>;
    const t = this.tablolar(tab, r);
    if (!t.length) throw new NotFoundException('Bu sekmede dışa aktarılacak veri yok');
    const csv = reportCsv(t);
    await this.audit.record({
      actorType: 'STAFF',
      actorId: staffId,
      action: 'rapor_disa_aktarildi',
      entityType: 'report',
      entityId: tab,
      after: f as unknown as Prisma.InputJsonValue,
      ip,
    });
    const gun = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
    return { dosya: `rengarenk-rapor-${tab}-${gun}.csv`, csv };
  }

  // ── Kişisel panolar ───────────────────────────────────────────

  views(staffId: string) {
    return this.db.reportView.findMany({ where: { staffId }, orderBy: { createdAt: 'desc' }, take: 30 });
  }

  async saveView(staffId: string, v: { ad: string; sekme: ReportTab; filtre: ReportFilter }) {
    await this.db.reportView.create({
      data: {
        id: uuidv7(),
        staffId,
        name: v.ad,
        tab: v.sekme,
        filter: v.filtre as unknown as Prisma.InputJsonValue,
      },
    });
    return this.views(staffId);
  }

  async view(id: string) {
    const v = await this.db.reportView.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Kayıtlı pano bulunamadı');
    return v;
  }

  async removeView(staffId: string, id: string) {
    await this.db.reportView.deleteMany({ where: { id, staffId } });
    return this.views(staffId);
  }
}
