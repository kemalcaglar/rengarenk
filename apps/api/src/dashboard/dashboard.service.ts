import { Inject, Injectable } from '@nestjs/common';
import { uuidv7 } from '@rengarenk/db';
import {
  APPROVAL_POLICIES,
  type ApprovalKindKey,
  changeText,
  DASH_METRICS,
  DASH_PERIODS,
  type DashMetric,
  type DashPeriod,
  ekle,
  GALLERY_PLANS,
  GOAL_KEYS,
  GOAL_STATES,
  type GoalKey,
  goalStatus,
  MAIN_METRIC_HOURS,
  tlYaz,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const BULDUM = ['rengarenk', 'baska_site', 'tanidik'];
const PLATFORM_AD: Record<string, string> = { WEB: 'Web', IOS: 'iOS', ANDROID: 'Android' };
const KANAL_AD: Record<string, string> = { web: 'Web', ios: 'iOS', android: 'Android' };
const KALEM_AD: Record<string, string> = { urun: 'Bireysel ürünler', abonelik: 'Galeri abonelikleri' };

/** Türkiye saatiyle günün başı (Türkiye UTC+3, yaz saati yok) */
export const trGunBasi = (d: Date) =>
  new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d)}T00:00:00+03:00`);
export const trAy = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit' }).format(
    d,
  );
const ayBasi = (ay: string) => new Date(`${ay}-01T00:00:00+03:00`);
const sonrakiAy = (ay: string) => {
  const [y, m] = ay.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};

interface Satir {
  boyutlar: Record<string, string>;
  deger: number;
}
interface Aralik {
  bas: Date;
  bit: Date;
}

/**
 * Kontrol paneli (Karar 44; YonetimRapor.dc.html › panel): ana ölçü ve eğilimi, altı ölçü (bugün, 7 ve 30 gün; önceki
 * eşit dönemle), ölçüye tıklayınca il, kategori ve platform kırılımı ve ajanın tek cümlelik yorumu, son 30 günün günlük
 * yeni talep grafiği ve notları, bugün bakılacaklar, aylık hedefler. Kanal kırılımı reklam ölçümüyle gelir.
 * Kişisel veri dönmez.
 */
@Injectable()
export class DashboardService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  private araliklar(donem: DashPeriod, now: Date): [Aralik, Aralik] {
    if (donem === 'bugun') {
      const bas = trGunBasi(now);
      return [
        { bas, bit: now },
        { bas: new Date(bas.getTime() - DAY), bit: new Date(now.getTime() - DAY) },
      ];
    }
    const n = donem === 'hafta' ? 7 : 30;
    return [
      { bas: new Date(now.getTime() - n * DAY), bit: now },
      { bas: new Date(now.getTime() - 2 * n * DAY), bit: new Date(now.getTime() - n * DAY) },
    ];
  }

  /** Ölçünün satırları (kırılım boyutlarıyla) */
  private async satirlar(m: DashMetric, a: Aralik): Promise<Satir[]> {
    const kat = new Map(
      (await this.db.category.findMany({ select: { id: true, name: true } })).map((c) => [c.id, c.name]),
    );
    const talepBoyut = (d: { il: string | null; categoryId: string }) => ({
      İl: d.il ?? 'Belirtilmemiş',
      Kategori: kat.get(d.categoryId) ?? 'Diğer',
    });
    if (m === 'talep') {
      const r = await this.db.demand.findMany({
        where: { publishedAt: { gte: a.bas, lt: a.bit } },
        select: { il: true, categoryId: true, platform: true },
      });
      return r.map((d) => ({
        boyutlar: {
          ...talepBoyut(d),
          Platform: d.platform ? (PLATFORM_AD[d.platform] ?? d.platform) : 'Bilinmiyor',
        },
        deger: 1,
      }));
    }
    if (m === 'mesaj' || m === 'sohbet') {
      const r = await this.db.conversation.findMany({
        where: {
          origin: 'talep',
          createdAt: { gte: a.bas, lt: a.bit },
          ...(m === 'sohbet' ? { messages: { some: { side: 'alici' } } } : {}),
        },
        select: { demand: { select: { il: true, categoryId: true } } },
      });
      return r.map((c) => ({
        boyutlar: c.demand ? talepBoyut(c.demand) : { İl: 'Belirtilmemiş', Kategori: 'Diğer' },
        deger: 1,
      }));
    }
    if (m === 'buldum') {
      const r = await this.db.demand.findMany({
        where: { closedAt: { gte: a.bas, lt: a.bit }, foundVia: { in: BULDUM } },
        select: { il: true, categoryId: true },
      });
      return r.map((d) => ({ boyutlar: talepBoyut(d), deger: 1 }));
    }
    if (m === 'gelir') {
      const [siparis, iade] = await Promise.all([
        this.db.order.findMany({
          where: { status: 'PAID', paidAt: { gte: a.bas, lt: a.bit } },
          select: { channel: true, kind: true, totalKurus: true },
        }),
        this.db.refund.findMany({
          where: { status: 'EXECUTED', executedAt: { gte: a.bas, lt: a.bit } },
          select: { amountKurus: true, order: { select: { channel: true, kind: true } } },
        }),
      ]);
      const kalem = (k: string) => KALEM_AD[k === 'urun' ? 'urun' : 'abonelik'] as string;
      return [
        ...siparis.map((o) => ({
          boyutlar: { Platform: KANAL_AD[o.channel] ?? o.channel, Kalem: kalem(o.kind) },
          deger: Number(o.totalKurus) / 100,
        })),
        // Yapılan iadeler gelirden düşülür
        ...iade.map((r) => ({
          boyutlar: {
            Platform: KANAL_AD[r.order?.channel ?? 'web'] ?? 'Web',
            Kalem: kalem(r.order?.kind ?? 'urun'),
          },
          deger: -Number(r.amountKurus) / 100,
        })),
      ];
    }
    // Yeni ücretli galeri: aboneliği bu dönemde başlayan
    const r = await this.db.subscription.findMany({
      where: { createdAt: { gte: a.bas, lt: a.bit } },
      select: { plan: true, account: { select: { gallery: { select: { il: true } } } } },
    });
    return r.map((s) => ({
      boyutlar: {
        İl: s.account.gallery?.il ?? 'Belirtilmemiş',
        Paket: GALLERY_PLANS[s.plan as keyof typeof GALLERY_PLANS]?.ad ?? s.plan,
      },
      deger: 1,
    }));
  }

  private toplam = (r: Satir[]) => r.reduce((t, x) => t + x.deger, 0);

  /** Ana ölçü: [bas, bit) aralığında yayınlanan ve en az 48 saat geçmiş taleplerden 48 saatte ilk mesaj alanların oranı */
  async anaOlcu(bas: Date, bit: Date) {
    const sinir = new Date(Math.min(bit.getTime(), Date.now() - MAIN_METRIC_HOURS * HOUR));
    if (sinir <= bas) return { toplam: 0, oran: null as number | null };
    const [r] = await this.db.$queryRaw<{ toplam: bigint; alan: bigint }[]>`
      SELECT count(*) AS toplam,
             count(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM conversations c
               WHERE c.demand_id = d.id AND c.origin = 'talep'
                 AND c.created_at <= d.published_at + make_interval(hours => ${MAIN_METRIC_HOURS}::int))) AS alan
      FROM demands d
      WHERE d.published_at >= ${bas} AND d.published_at < ${sinir}`;
    const toplam = Number(r?.toplam ?? 0);
    return { toplam, oran: toplam ? Number(r?.alan ?? 0) / toplam : null };
  }

  /** Altı ölçü ve önceki eşit dönemle fark (panel ve haftalık rapor) */
  async olcumler(donem: DashPeriod, now = new Date()) {
    const [simdi, once] = this.araliklar(donem, now);
    const per = DASH_PERIODS.find((p) => p.key === donem) ?? DASH_PERIODS[2];
    const olcumler = [];
    for (const m of DASH_METRICS) {
      const [a, b] = await Promise.all([this.satirlar(m.key, simdi), this.satirlar(m.key, once)]);
      const deger = this.toplam(a);
      const onceki = this.toplam(b);
      olcumler.push({
        key: m.key,
        ad: m.ad,
        deger,
        yazi: m.birim === '₺' ? tlYaz(Math.round(deger * 100)) : new Intl.NumberFormat('tr-TR').format(deger),
        fark: changeText(deger, onceki),
        karsi: per.karsi,
        onceki,
      });
    }
    return olcumler;
  }

  /** Ana ölçü: son 30 gün (48 saat kaydırılmış) ve önceki 30 gün */
  async anaOzet(now = new Date()) {
    const kayik = now.getTime() - MAIN_METRIC_HOURS * HOUR;
    const [ana, anaOnce] = await Promise.all([
      this.anaOlcu(new Date(kayik - 30 * DAY), new Date(kayik)),
      this.anaOlcu(new Date(kayik - 60 * DAY), new Date(kayik - 30 * DAY)),
    ]);
    return { ...ana, once: anaOnce.oran };
  }

  async overview(staff: { id: string }, donem: DashPeriod, now = new Date()) {
    const olcumler = await this.olcumler(donem, now);
    // Ana ölçü: son 30 gün (48 saat kaydırılmış) ve önceki 30 gün; 12 haftalık eğilim
    const kayik = now.getTime() - MAIN_METRIC_HOURS * HOUR;
    const [ana, anaOnce] = await Promise.all([
      this.anaOlcu(new Date(kayik - 30 * DAY), new Date(kayik)),
      this.anaOlcu(new Date(kayik - 60 * DAY), new Date(kayik - 30 * DAY)),
    ]);
    const trend = [];
    for (let i = 11; i >= 0; i--) {
      const bit = new Date(kayik - i * 7 * DAY);
      trend.push({ bitis: bit, ...(await this.anaOlcu(new Date(bit.getTime() - 7 * DAY), bit)) });
    }
    return {
      guncel: now,
      donem,
      ana: {
        oran: ana.oran,
        toplam: ana.toplam,
        once: anaOnce.oran,
        farkPuan:
          ana.oran !== null && anaOnce.oran !== null ? Math.round((ana.oran - anaOnce.oran) * 100) : null,
        trend,
      },
      olcumler,
      grafik: await this.grafik(now),
      bakilacak: await this.bakilacak(staff, now),
      hedefler: await this.hedefler(trAy(now), now),
    };
  }

  /** Neden analizi: ölçünün il, kategori, platform (gelirde kalem) kırılımı ve tek cümlelik yorum */
  async breakdown(m: DashMetric, donem: DashPeriod, now = new Date()) {
    const [simdi, once] = this.araliklar(donem, now);
    const [a, b] = await Promise.all([this.satirlar(m, simdi), this.satirlar(m, once)]);
    const boyutlar = [...new Set([...a, ...b].flatMap((x) => Object.keys(x.boyutlar)))];
    const kirilim = boyutlar.map((boyut) => {
      const top = (rows: Satir[]) => {
        const t = new Map<string, number>();
        for (const r of rows) {
          const k = r.boyutlar[boyut] ?? 'Diğer';
          t.set(k, (t.get(k) ?? 0) + r.deger);
        }
        return t;
      };
      const ts = top(a);
      const to = top(b);
      const toplam = this.toplam(a) || 1;
      const satir = [...new Set([...ts.keys(), ...to.keys()])]
        .map((ad) => {
          const s = ts.get(ad) ?? 0;
          const o = to.get(ad) ?? 0;
          return { ad, deger: s, pay: Math.round((s / toplam) * 100), fark: changeText(s, o), delta: s - o };
        })
        .sort((x, y) => y.deger - x.deger)
        .slice(0, 6);
      return { ad: boyut, satir };
    });
    const ilk = kirilim[0];
    const toplamFark = this.toplam(a) - this.toplam(b);
    const enBuyuk = ilk?.satir
      .slice()
      .sort((x, y) => (toplamFark >= 0 ? y.delta - x.delta : x.delta - y.delta))[0];
    const ikinci = kirilim[1]?.satir[0];
    const yorum =
      !enBuyuk || toplamFark === 0
        ? 'Önceki döneme göre belirgin bir değişim yok.'
        : `${toplamFark > 0 ? 'Artışın' : 'Düşüşün'} en büyük kısmı ${ekle(enBuyuk.ad, 'ayrilma')} (${enBuyuk.delta > 0 ? '+' : ''}${new Intl.NumberFormat('tr-TR').format(Math.round(enBuyuk.delta))})${ikinci ? `; ${kirilim[1]?.ad.toLocaleLowerCase('tr-TR')} olarak ${ikinci.ad} öne çıkıyor (%${ikinci.pay})` : ''}.`;
    const kanalNotu =
      m === 'gelir' ? null : 'Kanal kırılımı (organik, reklam, bildirim) reklam ölçümüyle gelecek.';
    return { metrik: m, donem, yorum, kirilim, kanalNotu };
  }

  /** Son 30 günün günlük yeni talep sayısı ve grafik notları */
  private async grafik(now: Date) {
    const bas = new Date(trGunBasi(now).getTime() - 29 * DAY);
    const r = await this.db.$queryRaw<{ gun: string; n: bigint }[]>`
      SELECT to_char(published_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS gun, count(*) AS n
      FROM demands WHERE published_at >= ${bas} GROUP BY 1`;
    const say = new Map(r.map((x) => [x.gun, Number(x.n)]));
    const gun = (i: number) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
        new Date(bas.getTime() + i * DAY),
      );
    const gunler = Array.from({ length: 30 }, (_, i) => ({ gun: gun(i), adet: say.get(gun(i)) ?? 0 }));
    const notlar = await this.db.chartNote.findMany({
      where: { day: { gte: new Date(`${gun(0)}T00:00:00Z`), lte: new Date(`${gun(29)}T00:00:00Z`) } },
      orderBy: { day: 'asc' },
    });
    return {
      gunler,
      notlar: notlar.map((n) => ({
        id: n.id,
        gun: n.day.toISOString().slice(0, 10),
        metin: n.text,
        kaynak: n.source,
      })),
    };
  }

  /** Bugün bakman gerekenler: yalnızca bekleyen işi olanlar */
  private async bakilacak(staff: { id: string }, now: Date) {
    const [onaylar, odeme, sikayet, sessiz, deneme, uyari] = await Promise.all([
      this.db.approval.groupBy({ by: ['kind'], where: { status: 'PENDING' }, _count: true }),
      this.db.subscription.findMany({
        where: { status: 'PAST_DUE' },
        select: { account: { select: { gallery: { select: { displayName: true } } } } },
        take: 5,
      }),
      this.db.report.count({ where: { status: 'acik', dueAt: { lt: now } } }),
      this.db.$queryRaw<{ il: string | null; n: bigint }[]>`
        SELECT d.il, count(*) AS n FROM demands d
        WHERE d.status = 'PUBLISHED' AND d.published_at < ${new Date(now.getTime() - MAIN_METRIC_HOURS * HOUR)}
          AND NOT EXISTS (SELECT 1 FROM conversations c WHERE c.demand_id = d.id)
        GROUP BY d.il ORDER BY n DESC`,
      this.db.gallery.count({
        where: { plan: 'deneme', trialEndsAt: { gt: now, lte: new Date(now.getTime() + 7 * DAY) } },
      }),
      this.db.staffAlert.count({ where: { staffId: staff.id, readAt: null } }),
    ]);
    const out: { renk: string; baslik: string; detay: string; eylem: string; href: string | null }[] = [];
    const onayToplam = onaylar.reduce((t, o) => t + o._count, 0);
    if (onayToplam)
      out.push({
        renk: '#FFC84A',
        baslik: `${onayToplam} işlem onayını bekliyor`,
        detay: onaylar
          .map(
            (o) =>
              `${o._count} ${APPROVAL_POLICIES[o.kind as ApprovalKindKey]?.ad.toLocaleLowerCase('tr-TR') ?? o.kind}`,
          )
          .join(', '),
        eylem: 'Onay kuyruğuna git',
        href: '/onaylar',
      });
    if (odeme.length)
      out.push({
        renk: '#E5484D',
        baslik: `${odeme.length} galeri ödemesi başarısız`,
        detay: `${odeme.map((o) => o.account.gallery?.displayName ?? 'Galeri').join(', ')} · yeniden denenecek`,
        eylem: 'Ödemeler ve faturalar',
        href: '/odemeler',
      });
    if (sikayet)
      out.push({
        renk: '#E5484D',
        baslik: `${sikayet} şikâyet süresini aştı`,
        detay: 'Kritik 1 saat, yüksek 4 saat, normal 24 saat',
        eylem: 'Moderasyona git',
        href: '/moderasyon',
      });
    const sessizToplam = sessiz.reduce((t, r) => t + Number(r.n), 0);
    if (sessizToplam) {
      const ilk = sessiz[0];
      out.push({
        renk: '#FFC84A',
        baslik: `${sessizToplam} talep 48 saattir mesaj almadı`,
        detay: ilk?.il
          ? `En çok ${ekle(ilk.il, 'bulunma')} (${Number(ilk.n)})`
          : 'İl bilgisi olmayan talepler',
        eylem: 'Talepler ve portföy (yakında)',
        href: null,
      });
    }
    if (deneme)
      out.push({
        renk: '#5B8CFF',
        baslik: `${deneme} galerinin denemesi bu hafta bitiyor`,
        detay: 'Sorumlu çalışanlar aramayla destek olabilir',
        eylem: 'Galeri müşterileri',
        href: '/galeri-musterileri',
      });
    if (uyari)
      out.push({
        renk: '#7C5CFF',
        baslik: `${uyari} okunmamış uyarı`,
        detay: 'Ajan ve sistem uyarıları',
        eylem: 'Uyarılara git',
        href: '/uyarilar',
      });
    return out;
  }

  /** Ayın gerçekleşen değerleri (hedeflerle karşılaştırma için) */
  async gerceklesen(ay: string, now = new Date()) {
    const bas = ayBasi(ay);
    const bit = new Date(Math.min(ayBasi(sonrakiAy(ay)).getTime(), now.getTime()));
    const a = { bas, bit };
    const [talep, buldum, gelir, galeriSimdi, galeriBasta, ana] = await Promise.all([
      this.satirlar('talep', a).then(this.toplam),
      this.satirlar('buldum', a).then(this.toplam),
      this.satirlar('gelir', a).then(this.toplam),
      this.db.subscription.count({ where: { status: { not: 'ENDED' }, createdAt: { lt: bit } } }),
      this.db.subscription.count({
        where: { createdAt: { lt: bas }, OR: [{ endedAt: null }, { endedAt: { gte: bas } }] },
      }),
      this.anaOlcu(new Date(now.getTime() - (30 * 24 + MAIN_METRIC_HOURS) * HOUR), now),
    ]);
    const toplamGun = (ayBasi(sonrakiAy(ay)).getTime() - bas.getTime()) / DAY;
    const gecen = Math.min(1, Math.max(0, (now.getTime() - bas.getTime()) / (toplamGun * DAY)));
    return {
      gecen,
      degerler: {
        talep,
        buldum,
        gelir,
        ucretli_galeri: galeriSimdi,
        ana_olcu: ana.oran === null ? 0 : Math.round(ana.oran * 100),
      } as Record<GoalKey, number>,
      ayBasiGaleri: galeriBasta,
      anaYok: ana.oran === null,
    };
  }

  async hedefler(ay: string, now = new Date()) {
    const [g, kayit] = await Promise.all([
      this.gerceklesen(ay, now),
      this.db.monthlyGoal.findMany({ where: { month: ay } }),
    ]);
    const hedef = new Map(kayit.map((k) => [k.key, k.value]));
    const bicim = (k: GoalKey, v: number) => {
      const b = GOAL_KEYS.find((x) => x.key === k)?.birim;
      return b === '%'
        ? `%${Math.round(v)}`
        : b === '₺'
          ? tlYaz(Math.round(v * 100))
          : new Intl.NumberFormat('tr-TR').format(Math.round(v));
    };
    return {
      ay,
      gecen: g.gecen,
      satirlar: GOAL_KEYS.map((k) => {
        const h = hedef.get(k.key);
        const mevcut = g.degerler[k.key];
        // 48 saati dolan talep yoksa ana ölçü yoktur ("—"); durum hesaplanmaz
        if (k.key === 'ana_olcu' && g.anaYok)
          return {
            key: k.key,
            ad: k.ad,
            mevcut: '—',
            hedef: h === undefined ? null : bicim(k.key, h),
            hedefHam: h ?? null,
          };
        if (h === undefined)
          return { key: k.key, ad: k.ad, mevcut: bicim(k.key, mevcut), hedef: null, hedefHam: null };
        const s = goalStatus(k.key, mevcut, h, g.gecen, g.ayBasiGaleri);
        const tahmin =
          k.key === 'talep' || k.key === 'buldum' || k.key === 'gelir'
            ? g.gecen > 0.05
              ? `Ay sonu tahmini ${bicim(k.key, mevcut / g.gecen)}`
              : 'Ay sonu tahmini için erken'
            : k.key === 'ucretli_galeri'
              ? `Ay başında ${bicim(k.key, g.ayBasiGaleri)}; ${bicim(k.key, Math.max(0, h - mevcut))} kaldı`
              : h > mevcut
                ? `Son 30 gün; ${Math.round(h - mevcut)} puan kaldı`
                : 'Son 30 gün; hedefe ulaşıldı';
        return {
          key: k.key,
          ad: k.ad,
          mevcut: bicim(k.key, mevcut),
          hedef: bicim(k.key, h),
          hedefHam: h,
          ilerleme: s.ilerleme,
          beklenen: k.key === 'ana_olcu' || k.key === 'ucretli_galeri' ? null : s.beklenen,
          durum: s.durum,
          durumAd: GOAL_STATES[s.durum].ad,
          bg: GOAL_STATES[s.durum].bg,
          fg: GOAL_STATES[s.durum].fg,
          not: tahmin,
        };
      }),
    };
  }

  async setGoals(staff: { id: string }, ay: string, hedefler: Partial<Record<GoalKey, number>>, ip?: string) {
    await this.db.$transaction(async (tx) => {
      for (const [key, value] of Object.entries(hedefler)) {
        if (value === undefined) continue;
        await tx.monthlyGoal.upsert({
          where: { month_key: { month: ay, key } },
          create: { month: ay, key, value, updatedBy: staff.id },
          update: { value, updatedBy: staff.id },
        });
      }
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staff.id,
          action: 'hedef_guncellendi',
          entityType: 'monthly_goal',
          entityId: ay,
          after: hedefler,
          ip,
        },
        tx,
      );
    });
    return this.hedefler(ay);
  }

  /** Elle grafik notu */
  async addNote(staff: { id: string }, gun: string, metin: string) {
    await this.db.chartNote.create({
      data: {
        id: uuidv7(),
        day: new Date(`${gun}T00:00:00Z`),
        text: metin,
        source: 'elle',
        createdBy: staff.id,
      },
    });
    return this.grafik(new Date());
  }

  async removeNote(id: string) {
    await this.db.chartNote.deleteMany({ where: { id, source: 'elle' } });
    return this.grafik(new Date());
  }
}

/** Fiyat, kural ve kampanya değişikliklerinin kendiliğinden notu (değişiklikle aynı işlemde) */
export async function grafikNotu(
  tx: Tx,
  gun: Date,
  metin: string,
  kaynak: 'fiyat' | 'kural' | 'kampanya',
  refId: string,
) {
  const g = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(gun);
  await tx.chartNote.create({
    data: { id: uuidv7(), day: new Date(`${g}T00:00:00Z`), text: metin.slice(0, 80), source: kaynak, refId },
  });
}
