import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type Demand, type PortfolioVehicle, uuidv7 } from '@rengarenk/db';
import {
  type CategoryDefinition,
  demandOwnerName,
  evaluateMatch,
  GALLERY_PLANS,
  GALLERY_TRIAL,
  type GalleryPlanKey,
  MATCH_DAILY_INSTANT,
  MATCH_MIN_SCORE,
  type MatchCriterion,
  type MatchDemand,
  type MatchResult,
  type MatchVehicle,
  matchCountText,
  matchSummary,
} from '@rengarenk/shared';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { vehicleNames } from '../portfolio/vehicle-names.js';
import { demandQuery, MatchIndexService, type VehicleDoc } from './match-index.service.js';

type VehicleRow = PortfolioVehicle & { account: { gallery: { il: string; ilce: string } | null } };
type DemandRow = Pick<
  Demand,
  'id' | 'no' | 'accountId' | 'userId' | 'categoryId' | 'schemaVersion' | 'status' | 'data'
>;
interface Pair {
  demand: DemandRow;
  vehicle: VehicleRow;
  def: CategoryDefinition;
  result: MatchResult;
}

/** Türkiye saatiyle bugünün başlangıcı (UTC+3, yaz saati yok) */
const bugun = () => {
  const tr = new Date(Date.now() + 3 * 3600_000);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()) - 3 * 3600_000);
};

const DEMAND_SELECT = {
  id: true,
  no: true,
  accountId: true,
  userId: true,
  categoryId: true,
  schemaVersion: true,
  status: true,
  data: true,
} as const;

/** Galerinin otomatik eşleşme hakkı: Profesyonel, Kurumsal ve süresi bitmemiş deneme (Karar 12.2, 12.5) */
export function matchingEnabled(
  g: { plan: string; trialEndsAt: Date | null },
  accountStatus: string,
): boolean {
  if (accountStatus !== 'ACTIVE') return false;
  const plan = g.plan as GalleryPlanKey;
  if (plan === 'deneme') return !g.trialEndsAt || g.trialEndsAt > new Date();
  return GALLERY_PLANS[plan]?.eslesme ?? false;
}

/**
 * Eşleştirme motoru (Karar 06.2, 22; Teknik tasarım §6). Talep yayınlanınca ya da değişince sert koşullara uyan araçlar,
 * araç yayınlanınca ya da değişince onu kabul eden talepler OpenSearch'ten bulunur; her çift `evaluateMatch` ile
 * skorlanır, skoru `MATCH_MIN_SCORE` ve üstü olanlar saklanır. Skor, talebin yayına girdiği şema sürümüyle hesaplanır:
 * yeni ağırlıklar yalnızca yeni ve güncellenen taleplere uygulanır. Eşiği geçen yeni eşleşme için galeriye "sana uygun
 * talep" olayı yazılır; galeri başına günde 20 anlık, fazlası günlük özette (bildirim katmanı Aşama 7'de iletir).
 */
@Injectable()
export class MatchingService {
  private readonly defs = new Map<string, CategoryDefinition>();

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly index: MatchIndexService,
    private readonly outbox: OutboxService,
  ) {}

  private async def(categoryId: string, version: number): Promise<CategoryDefinition | null> {
    const k = `${categoryId}:${version}`;
    const cached = this.defs.get(k);
    if (cached) return cached;
    const v = await this.db.categorySchemaVersion.findUnique({
      where: { categoryId_version: { categoryId, version } },
      select: { definition: true },
    });
    if (!v) return null;
    const def = v.definition as unknown as CategoryDefinition;
    this.defs.set(k, def);
    return def;
  }

  private vehicleOf(v: VehicleRow): MatchVehicle | null {
    const g = v.account.gallery;
    if (!g) return null;
    return {
      make: v.makeKey,
      series: v.seriesKey,
      model: v.modelKey,
      generation: v.generationKey,
      trim: v.trimKey,
      year: v.year,
      km: v.km,
      fuel: v.fuel,
      gearbox: v.gearbox,
      color: v.color,
      price: Number(v.priceTl),
      tradeIn: v.tradeIn,
      damage: v.damage as MatchVehicle['damage'],
      il: g.il,
      ilce: g.ilce,
    };
  }

  private docOf(v: VehicleRow, m: MatchVehicle): VehicleDoc {
    return {
      hesap: v.accountId,
      kategori: v.categoryId,
      marka: v.makeKey,
      il: m.il,
      ilce: m.ilce ?? null,
      fiyat: Number(v.priceTl),
      sasi: Boolean(m.damage.sasiIslem),
      podye: Boolean(m.damage.podyeIslem),
      airbag: Boolean(m.damage.airbagAcildi),
      agir: Boolean(m.damage.agirHasar),
    };
  }

  private vehicles(where: { id: string } | { id: { in: string[] } }) {
    return this.db.portfolioVehicle.findMany({
      where: { ...where, status: 'PUBLISHED' },
      include: { account: { select: { gallery: { select: { il: true, ilce: true } } } } },
    });
  }

  /** Talep sahibi aracın galerisinde çalışıyorsa ya da aynı hesapsa eşleşme olmaz */
  private async ownPairs(pairs: { demand: DemandRow; vehicle: VehicleRow }[]) {
    const accounts = [...new Set(pairs.map((p) => p.vehicle.accountId))];
    const users = [...new Set(pairs.map((p) => p.demand.userId))];
    if (!accounts.length) return new Set<string>();
    const ms = await this.db.accountMember.findMany({
      where: { accountId: { in: accounts }, userId: { in: users } },
      select: { accountId: true, userId: true },
    });
    return new Set(ms.map((m) => `${m.accountId}:${m.userId}`));
  }

  private async score(pairs: { demand: DemandRow; vehicle: VehicleRow }[]): Promise<Pair[]> {
    const own = await this.ownPairs(pairs);
    const out: Pair[] = [];
    for (const p of pairs) {
      const { demand: d, vehicle: v } = p;
      if (d.categoryId !== v.categoryId || !d.schemaVersion) continue;
      if (d.accountId === v.accountId || own.has(`${v.accountId}:${d.userId}`)) continue;
      const def = await this.def(d.categoryId, d.schemaVersion);
      const m = this.vehicleOf(v);
      if (!def || !m) continue;
      out.push({ ...p, def, result: evaluateMatch(def, d.data as unknown as MatchDemand, m) });
    }
    return out;
  }

  /** Talep olayı: yayındaysa kayıtlı sorgusunu yazar ve uyan araçları skorlar; değilse eşleşmelerini kapatır */
  async onDemand(demandId: string): Promise<number> {
    const d = await this.db.demand.findUnique({ where: { id: demandId }, select: DEMAND_SELECT });
    const def =
      d?.status === 'PUBLISHED' && d.schemaVersion ? await this.def(d.categoryId, d.schemaVersion) : null;
    const q = d && def ? demandQuery(def, d.categoryId, d.data as unknown as MatchDemand) : null;
    if (!d || !q) {
      await this.index.removeDemand(demandId);
      await this.apply([], { demandId });
      return 0;
    }
    await this.index.putDemand(d.id, q);
    const ids = await this.index.searchVehicles(q);
    const vs = ids.length ? await this.vehicles({ id: { in: ids } }) : [];
    const pairs = await this.score(vs.map((vehicle) => ({ demand: d, vehicle })));
    return this.apply(pairs, { demandId });
  }

  /** Araç olayı: yayındaysa indekse yazar ve kabul eden talepleri skorlar; değilse eşleşmelerini kapatır */
  async onVehicle(vehicleId: string): Promise<number> {
    const [v] = await this.vehicles({ id: vehicleId });
    const m = v ? this.vehicleOf(v) : null;
    if (!v || !m) {
      await this.index.removeVehicle(vehicleId);
      await this.apply([], { vehicleId });
      return 0;
    }
    const doc = this.docOf(v, m);
    await this.index.putVehicle(v.id, doc);
    const ids = await this.index.percolate(doc);
    const ds = ids.length
      ? await this.db.demand.findMany({
          where: { id: { in: ids }, status: 'PUBLISHED' },
          select: DEMAND_SELECT,
        })
      : [];
    const pairs = await this.score(ds.map((demand) => ({ demand, vehicle: v })));
    return this.apply(pairs, { vehicleId });
  }

  /**
   * Skorları yazar: eşikteki çiftler açılır ya da güncellenir, kapsamdaki diğer açık eşleşmeler kapanır. Eşleşme
   * satırı ve bildirim olayı aynı veritabanı işlemindedir.
   */
  private async apply(pairs: Pair[], scope: { demandId: string } | { vehicleId: string }): Promise<number> {
    const keep = pairs.filter(
      (p): p is Pair & { result: Extract<MatchResult, { ok: true }> } =>
        p.result.ok && p.result.score >= MATCH_MIN_SCORE,
    );
    const accounts = [...new Set(keep.map((p) => p.vehicle.accountId))];
    const galleries = accounts.length
      ? await this.db.gallery.findMany({
          where: { accountId: { in: accounts } },
          select: { accountId: true, plan: true, trialEndsAt: true, account: { select: { status: true } } },
        })
      : [];
    const enabled = new Set(
      galleries.filter((g) => matchingEnabled(g, g.account.status)).map((g) => g.accountId),
    );
    await this.db.$transaction(async (tx) => {
      const existing = await tx.match.findMany({ where: scope });
      const byPair = new Map(existing.map((e) => [`${e.demandId}:${e.vehicleId}`, e]));
      const kept = new Set<string>();
      // Günlük anlık bildirim sayacı galeri başına kilitle sayılır
      for (const a of [...enabled].sort()) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`eslesme:${a}`}))`;
      }
      const anlik = new Map<string, number>();
      for (const p of keep) {
        const key = `${p.demand.id}:${p.vehicle.id}`;
        kept.add(key);
        const prev = byPair.get(key);
        const data = {
          score: p.result.score,
          alternative: p.result.alternative,
          criteria: p.result.criteria as unknown as object,
          schemaVersion: p.demand.schemaVersion as number,
          active: true,
          endedAt: null,
        };
        const id = prev?.id ?? uuidv7();
        if (prev) {
          await tx.match.update({
            where: { id },
            // Kapanıp yeniden açılan eşleşme galeriye yeniden "yeni" görünür
            data: prev.active ? data : { ...data, seenAt: null },
          });
        } else {
          await tx.match.create({
            data: {
              id,
              demandId: p.demand.id,
              vehicleId: p.vehicle.id,
              accountId: p.vehicle.accountId,
              ...data,
            },
          });
        }
        const esik = p.def.rules.matchThreshold;
        if (!prev?.notified && p.result.score >= esik && enabled.has(p.vehicle.accountId)) {
          await this.notify(tx, id, p, anlik);
        }
      }
      const kapat = existing.filter((e) => e.active && !kept.has(`${e.demandId}:${e.vehicleId}`));
      if (kapat.length) {
        await tx.match.updateMany({
          where: { id: { in: kapat.map((e) => e.id) } },
          data: { active: false, endedAt: new Date() },
        });
      }
    });
    return keep.length;
  }

  private async notify(tx: Tx, id: string, p: Pair, anlik: Map<string, number>) {
    const a = p.vehicle.accountId;
    let n = anlik.get(a);
    if (n === undefined) {
      n = await tx.match.count({ where: { accountId: a, notified: 'anlik', notifiedAt: { gte: bugun() } } });
    }
    const hemen = n < MATCH_DAILY_INSTANT;
    anlik.set(a, hemen ? n + 1 : n);
    await tx.match.update({
      where: { id },
      data: { notified: hemen ? 'anlik' : 'ozet', notifiedAt: new Date() },
    });
    await this.outbox.add(tx, 'eslesme.bulundu', {
      matchId: id,
      accountId: a,
      demandId: p.demand.id,
      vehicleId: p.vehicle.id,
      score: (p.result as { score: number }).score,
      anlik: hemen,
    });
  }

  /** Gecelik: indeksleri yeniden kurar, bütün yayındaki talepleri yeniden skorlar, artakalanları kapatır */
  async rebuildAll(): Promise<{ arac: number; talep: number }> {
    await this.index.reset();
    const vs = await this.db.portfolioVehicle.findMany({
      where: { status: 'PUBLISHED' },
      include: { account: { select: { gallery: { select: { il: true, ilce: true } } } } },
    });
    for (const v of vs) {
      const m = this.vehicleOf(v);
      if (m) await this.index.putVehicle(v.id, this.docOf(v, m));
    }
    const ds = await this.db.demand.findMany({ where: { status: 'PUBLISHED' }, select: { id: true } });
    for (const d of ds) await this.onDemand(d.id);
    await this.db.match.updateMany({
      where: {
        active: true,
        OR: [{ demand: { status: { not: 'PUBLISHED' } } }, { vehicle: { status: { not: 'PUBLISHED' } } }],
      },
      data: { active: false, endedAt: new Date() },
    });
    return { arac: vs.length, talep: ds.length };
  }

  // ── Görünümler ────────────────────────────────────────────────

  private async member(userId: string, accountId: string) {
    const m = await this.db.accountMember.findUnique({
      where: { accountId_userId: { accountId, userId } },
      include: { account: { select: { status: true, gallery: true } } },
    });
    if (!m?.account.gallery) throw new NotFoundException('Galeri bulunamadı');
    return { role: m.role, gallery: m.account.gallery, status: m.account.status };
  }

  private async demandCards(ids: string[]) {
    const ds = await this.db.demand.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        no: true,
        title: true,
        headline: true,
        il: true,
        ilce: true,
        budgetMin: true,
        budgetMax: true,
        publishedAt: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    return new Map(
      ds.map((d) => [
        d.id,
        {
          no: Number(d.no),
          baslik: d.headline ?? d.title,
          // Eşleşme listesinde ad kısaltılmış görünür (GaleriPanel.dc.html: "Ayşe Y.")
          sahip: demandOwnerName(d.user.firstName, d.user.lastName, 'kisa'),
          il: d.il,
          ilce: d.ilce,
          butceMin: d.budgetMin === null ? null : Number(d.budgetMin),
          butceMax: d.budgetMax === null ? null : Number(d.budgetMax),
          yayin: d.publishedAt,
        },
      ]),
    );
  }

  /** Galeri paneli › Eşleşmeler (GaleriPanel.dc.html, GaleriMobil.dc.html) */
  async listForGallery(userId: string, accountId: string, aracId?: string) {
    const { gallery: g, status } = await this.member(userId, accountId);
    const plan = g.plan as GalleryPlanKey;
    const ozellik = plan === 'deneme' ? GALLERY_TRIAL : GALLERY_PLANS[plan];
    const acik = matchingEnabled(g, status);
    if (!acik) {
      return {
        eslesme: false,
        gunlukMesaj: ozellik.gunlukMesaj,
        yeni: 0,
        toplam: 0,
        araclar: [],
        eslesmeler: [],
      };
    }
    const where = {
      accountId,
      active: true,
      demand: { status: 'PUBLISHED' as const },
      vehicle: { status: 'PUBLISHED' as const },
    };
    const [rows, sayilar, yeni] = await Promise.all([
      this.db.match.findMany({
        where: aracId ? { ...where, vehicleId: aracId } : where,
        orderBy: [{ createdAt: 'desc' }],
        take: 200,
        include: {
          vehicle: { include: { photos: { orderBy: { sort: 'asc' }, take: 1, select: { id: true } } } },
        },
      }),
      this.db.match.groupBy({ by: ['vehicleId'], where, _count: { _all: true } }),
      this.db.match.count({ where: { ...where, seenAt: null } }),
    ]);
    const araclar = sayilar.length
      ? await this.db.portfolioVehicle.findMany({ where: { id: { in: sayilar.map((s) => s.vehicleId) } } })
      : [];
    const n = await vehicleNames(this.db, [...araclar, ...rows.map((r) => r.vehicle)]);
    const talepler = await this.demandCards([...new Set(rows.map((r) => r.demandId))]);
    const sayi = new Map(sayilar.map((s) => [s.vehicleId, s._count._all]));
    return {
      eslesme: true,
      gunlukMesaj: ozellik.gunlukMesaj,
      yeni,
      toplam: sayilar.reduce((t, s) => t + s._count._all, 0),
      araclar: araclar
        .map((v) => ({ id: v.id, ad: n(v).ad, sayi: sayi.get(v.id) ?? 0 }))
        .sort((a, b) => b.sayi - a.sayi),
      eslesmeler: rows.flatMap((r) => {
        const t = talepler.get(r.demandId);
        if (!t) return [];
        const criteria = r.criteria as unknown as MatchCriterion[];
        return [
          {
            id: r.id,
            skor: r.score,
            uyum: matchSummary(criteria),
            yeni: r.seenAt === null,
            zaman: r.createdAt,
            arac: {
              id: r.vehicleId,
              no: Number(r.vehicle.no),
              ad: n(r.vehicle).ad,
              foto: r.vehicle.photos[0] ? `/portfoy/fotolar/${r.vehicle.photos[0].id}` : null,
            },
            talep: t,
          },
        ];
      }),
    };
  }

  /** Galeri eşleşmeler ekranını açınca "yeni" sayacı sıfırlanır */
  async markSeen(userId: string, accountId: string) {
    await this.member(userId, accountId);
    const r = await this.db.match.updateMany({
      where: { accountId, active: true, seenAt: null },
      data: { seenAt: new Date() },
    });
    return { okundu: r.count };
  }

  /** Ana sayfa › "Portföyünüze uyan talepler" (Karar 22, Anasayfa.dc.html): üyesi olunan galerilerin son eşleşmeleri */
  async home(userId: string) {
    const ms = await this.db.accountMember.findMany({
      where: { userId, account: { gallery: { isNot: null } } },
      select: { accountId: true, account: { select: { status: true, gallery: true } } },
    });
    const accounts = ms
      .filter((m) => m.account.gallery && matchingEnabled(m.account.gallery, m.account.status))
      .map((m) => m.accountId);
    if (!accounts.length) return { galeri: ms.length > 0, eslesmeler: [] };
    const rows = await this.db.match.findMany({
      where: {
        accountId: { in: accounts },
        active: true,
        demand: { status: 'PUBLISHED' },
        vehicle: { status: 'PUBLISHED' },
      },
      orderBy: [{ createdAt: 'desc' }, { score: 'desc' }],
      take: 30,
      include: { vehicle: true },
    });
    const ilk = new Map<string, (typeof rows)[number]>();
    for (const r of rows) if (!ilk.has(r.demandId)) ilk.set(r.demandId, r);
    const secilen = [...ilk.values()].slice(0, 3);
    const n = await vehicleNames(
      this.db,
      secilen.map((r) => r.vehicle),
    );
    const talepler = await this.demandCards(secilen.map((r) => r.demandId));
    return {
      galeri: true,
      eslesmeler: secilen.flatMap((r) => {
        const t = talepler.get(r.demandId);
        const ad = n(r.vehicle);
        return t
          ? [{ ...t, arac: [r.vehicle.year, ad.marka, ad.model ?? ad.seri].filter(Boolean).join(' ') }]
          : [];
      }),
    };
  }

  /** Araç sayfasındaki "talebine uyuyor" bandı (PortfoyArac.dc.html): girişli alıcının yayındaki talepleriyle */
  async fitForViewer(no: number, userId: string) {
    const [v] = await this.db.portfolioVehicle.findMany({
      where: { no: BigInt(no), status: 'PUBLISHED' },
      include: { account: { select: { gallery: { select: { il: true, ilce: true } } } } },
    });
    if (!v) throw new NotFoundException('Araç bulunamadı');
    const ds = await this.db.demand.findMany({
      where: { userId, status: 'PUBLISHED', categoryId: v.categoryId },
      select: { ...DEMAND_SELECT, title: true, headline: true },
    });
    const pairs = await this.score(ds.map((demand) => ({ demand, vehicle: v })));
    let best: { pair: Pair; score: number; criteria: MatchCriterion[] } | null = null;
    for (const p of pairs) {
      if (p.result.ok && p.result.score >= MATCH_MIN_SCORE && (!best || p.result.score > best.score)) {
        best = { pair: p, score: p.result.score, criteria: p.result.criteria };
      }
    }
    if (!best) return { uyan: null };
    const d = ds.find((x) => x.id === best.pair.demand.id);
    return {
      uyan: {
        talepNo: Number(best.pair.demand.no),
        baslik: d?.title || d?.headline || '',
        metin: matchCountText(best.criteria),
      },
    };
  }

  /**
   * Konsol › Eşleştirme ayarı › Deneme alanı (YonetimIcerik.dc.html): gerçek bir talebi, sert koşullara uyan yayındaki
   * araçlarla taslak ve yayındaki ayarla skorlar. Motorla aynı işlevi (`evaluateMatch`) kullanır; hiçbir şey yazmaz.
   */
  async simulate(categoryId: string, draft: CategoryDefinition, talepNo?: number) {
    const cat = await this.db.category.findUnique({
      where: { id: categoryId },
      select: { id: true, publishedVersion: true },
    });
    if (!cat) throw new NotFoundException('Kategori bulunamadı');
    const yayinda = cat.publishedVersion ? await this.def(cat.id, cat.publishedVersion) : null;
    const d = await this.db.demand.findFirst({
      where: { categoryId, status: 'PUBLISHED', ...(talepNo ? { no: BigInt(talepNo) } : {}) },
      orderBy: { publishedAt: 'desc' },
      select: {
        ...DEMAND_SELECT,
        title: true,
        headline: true,
        il: true,
        budgetMin: true,
        budgetMax: true,
        yearMin: true,
        yearMax: true,
      },
    });
    if (!d)
      return { talep: null, adaylar: [], esik: draft.rules.matchThreshold, bildirim: { yeni: 0, eski: 0 } };
    const data = d.data as unknown as MatchDemand;
    const ids = new Set<string>();
    for (const def of [draft, yayinda]) {
      const q = def ? demandQuery(def, categoryId, data) : null;
      if (q) for (const id of await this.index.searchVehicles(q, 200)) ids.add(id);
    }
    const vs = ids.size ? await this.vehicles({ id: { in: [...ids] } }) : [];
    const n = await vehicleNames(this.db, vs);
    const satir = vs.flatMap((v) => {
      const m = this.vehicleOf(v);
      if (!m || v.accountId === d.accountId) return [];
      const yeni = evaluateMatch(draft, data, m);
      const eski = yayinda ? evaluateMatch(yayinda, data, m) : yeni;
      if (!yeni.ok && !eski.ok) return [];
      return [
        {
          id: v.id,
          hesap: v.accountId,
          ad: n(v).ad,
          detay: `${new Intl.NumberFormat('tr-TR').format(v.km)} km · ${new Intl.NumberFormat('tr-TR').format(Number(v.priceTl))} TL`,
          skor: yeni.ok ? yeni.score : 0,
          eski: eski.ok ? eski.score : 0,
        },
      ];
    });
    const sira = (key: 'skor' | 'eski') => {
      const s = [...satir].sort((a, b) => b[key] - a[key]);
      return new Map(s.map((x, i) => [x.id, i + 1]));
    };
    const yeniSira = sira('skor');
    const eskiSira = sira('eski');
    const galeri = (key: 'skor' | 'eski', esik: number) =>
      new Set(satir.filter((x) => x[key] >= esik).map((x) => x.hesap)).size;
    return {
      talep: {
        no: Number(d.no),
        baslik: d.headline ?? d.title,
        il: d.il,
        butceMin: d.budgetMin === null ? null : Number(d.budgetMin),
        butceMax: d.budgetMax === null ? null : Number(d.budgetMax),
        yilMin: d.yearMin,
        yilMax: d.yearMax,
      },
      esik: draft.rules.matchThreshold,
      bildirim: {
        yeni: galeri('skor', draft.rules.matchThreshold),
        eski: galeri('eski', yayinda?.rules.matchThreshold ?? draft.rules.matchThreshold),
      },
      adaylar: satir
        .sort((a, b) => b.skor - a.skor)
        .slice(0, 20)
        .map(({ hesap: _h, ...x }) => ({ ...x, sira: yeniSira.get(x.id), eskiSira: eskiSira.get(x.id) })),
    };
  }

  /** Portföy listesindeki "Eşleşme" sütunu: araç başına açık eşleşme sayısı */
  async countsByVehicle(accountId: string): Promise<Map<string, number>> {
    const rows = await this.db.match.groupBy({
      by: ['vehicleId'],
      where: { accountId, active: true, demand: { status: 'PUBLISHED' } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.vehicleId, r._count._all]));
  }
}
