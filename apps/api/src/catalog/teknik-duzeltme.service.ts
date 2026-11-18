import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ozetBirlestir, type TeknikOzet, tipTeknik } from '@rengarenk/catalog';
import { Prisma, uuidv7 } from '@rengarenk/db';
import {
  type DonanimGrubu,
  duzeltmeUygula,
  type EkSatir,
  TEKNIK_ALANLARI,
  TEKNIK_SATIR_ANAHTARLARI,
  type TeknikDuzeltme,
  teknikEksikleri,
} from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { elleKayitlari, kayitlariSec } from './teknik-duzeltme.js';

/** Kullanıcı başına günde en çok bildirim (kötüye kullanım sınırı) */
const GUNLUK_BILDIRIM = 10;

/**
 * Teknik özellik bildirimi ve elle düzeltme (sahip isteği, 17 Kasım 2026). Kullanıcı talep sayfasının teknik
 * sekmesinden "yanlış" bildirir; bildirim konsolda Katalog › Teknik özellikler kuyruğuna düşer ve katalog sorumlusuna
 * uyarı gider. Katalog sorumlusu motor sürümünün (model) değerlerini düzeltir ya da ekler (isteğe bağlı yıl aralığıyla);
 * düzeltme kaynaklardaki değerin yerine geçer, kayıtlar silinmez.
 */
@Injectable()
export class TeknikDuzeltmeService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  // ── Kullanıcı ──────────────────────────────────────────────

  async bildir(
    userId: string,
    b: { no: number; motor: string; alan?: string | null; not: string },
    ip?: string,
  ) {
    const d = await this.db.demand.findUnique({
      where: { no: BigInt(b.no) },
      select: { id: true, status: true, seriesKey: true },
    });
    if (d?.status !== 'PUBLISHED' || !d.seriesKey) throw new NotFoundException('Talep bulunamadı');
    const model = await this.db.catalogModel.findUnique({
      where: { key: b.motor },
      select: { id: true, name: true, series: { select: { key: true } } },
    });
    if (!model || model.series?.key !== d.seriesKey)
      throw new BadRequestException('Bu talepte böyle bir sürüm yok');
    const gun = await this.db.catalogSpecReport.count({
      where: { userId, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    });
    if (gun >= GUNLUK_BILDIRIM)
      throw new HttpException(
        'Bugün için bildirim sınırına ulaştın; yarın yeniden deneyebilirsin',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    try {
      return await this.db.$transaction(async (tx) => {
        const r = await tx.catalogSpecReport.create({
          data: {
            id: uuidv7(),
            demandId: d.id,
            userId,
            modelId: model.id,
            motor: model.name,
            field: b.alan ?? null,
            note: b.not,
          },
          select: { id: true, status: true },
        });
        await this.audit.record(
          {
            actorType: 'USER',
            actorId: userId,
            action: 'teknik_ozellik_bildirildi',
            entityType: 'catalog_spec_report',
            entityId: r.id,
            after: { talep: b.no, motor: model.name, alan: b.alan ?? null },
            ip,
          },
          tx,
        );
        await this.outbox.add(tx, 'katalog.teknik_bildirildi', { reportId: r.id });
        return r;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
        throw new ConflictException('Bu sürüm için bildirimin zaten inceleniyor');
      throw err;
    }
  }

  // ── Konsol ─────────────────────────────────────────────────

  /** Bildirim kuyruğu: açıklar ya da kapananlar, en yeni önce */
  async bildirimler(durum: 'acik' | 'kapali' = 'acik') {
    const rows = await this.db.catalogSpecReport.findMany({
      where: durum === 'acik' ? { status: 'acik' } : { status: { not: 'acik' } },
      select: {
        id: true,
        motor: true,
        field: true,
        note: true,
        status: true,
        createdAt: true,
        decidedAt: true,
        modelId: true,
        demand: { select: { no: true, yearMin: true, yearMax: true } },
        model: {
          select: {
            name: true,
            series: { select: { id: true, name: true, make: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: durum === 'acik' ? 'asc' : 'desc' },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      talep: Number(r.demand.no),
      yillar: [r.demand.yearMin, r.demand.yearMax] as [number | null, number | null],
      arac: r.model?.series ? `${r.model.series.make.name} ${r.model.series.name}` : null,
      seriesId: r.model?.series?.id ?? null,
      modelId: r.modelId,
      motor: r.motor,
      alan: r.field,
      alanAd: TEKNIK_ALANLARI.find((a) => a.key === r.field)?.ad ?? null,
      not: r.note,
      durum: r.status,
      zaman: r.createdAt.toISOString(),
      karar: r.decidedAt?.toISOString() ?? null,
    }));
  }

  async bildirimKarar(id: string, durum: 'duzeltildi' | 'reddedildi', staffId: string, ip?: string) {
    const r = await this.db.catalogSpecReport.findUnique({ where: { id }, select: { status: true } });
    if (!r) throw new NotFoundException('Bildirim bulunamadı');
    if (r.status !== 'acik') throw new ConflictException('Bildirim zaten kapatıldı');
    return this.db.$transaction(async (tx) => {
      const u = await tx.catalogSpecReport.update({
        where: { id },
        data: { status: durum, decidedBy: staffId, decidedAt: new Date() },
        select: { id: true, status: true },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'teknik_bildirim_kapatildi',
          entityType: 'catalog_spec_report',
          entityId: id,
          after: { durum },
          ip,
        },
        tx,
      );
      return u;
    });
  }

  /** Bir modelin (seri) motor sürümleri, Türkiye'de satıldığı yıllar ve etkin düzeltme sayısı */
  async seriModelleri(seriesId: string) {
    const tipler = await this.db.catalogVariant.findMany({
      where: { seriesId, source: { in: ['tsb', 'yerli'] } },
      select: { years: true, model: { select: { id: true, key: true, name: true } } },
    });
    const m = new Map<string, { id: string; key: string; ad: string; yillar: Set<number> }>();
    for (const t of tipler) {
      const g = m.get(t.model.id) ?? {
        id: t.model.id,
        key: t.model.key,
        ad: t.model.name,
        yillar: new Set(),
      };
      for (const y of t.years) g.yillar.add(y);
      m.set(t.model.id, g);
    }
    const sayi = await this.db.catalogSpecOverride.groupBy({
      by: ['modelId'],
      where: { modelId: { in: [...m.keys()] }, status: 'aktif' },
      _count: true,
    });
    return [...m.values()]
      .map((g) => {
        const y = [...g.yillar].sort((a, b) => a - b);
        return {
          id: g.id,
          key: g.key,
          ad: g.ad,
          yillar: y.length ? ([y[0], y.at(-1)] as [number, number]) : null,
          duzeltme: sayi.find((s) => s.modelId === g.id)?._count ?? 0,
        };
      })
      .sort((a, b) => a.ad.localeCompare(b.ad, 'tr', { numeric: true }));
  }

  /** Açık teknik kaynaklar (ADEME, vehicle-makes-models) */
  private async acikKaynaklar() {
    return new Set(
      (
        await this.db.catalogSource.findMany({
          where: { key: { in: ['ademe', 'vmm'] }, active: true },
          select: { key: true },
        })
      ).map((x) => x.key),
    );
  }

  /**
   * Bir motor sürümünün değerleri: kaynaklardan gelen (düzeltmesiz), elle girilenler ve sonuç. `aralik` verilirse
   * yalnızca o yıllarda satılan tipler ve o yıllara uyan kayıtlar; `paketId` ve `vites` verilirse yalnızca o paketin ve
   * vitesin tipleri, kayıtları ve donanımı. `tipler`: kaydın uygulanacağı Türkiye'de satılan tipler (TSB adlarıyla);
   * paket ve vites seçenekleri sürümün tiplerinden.
   */
  async model(
    modelId: string,
    aralik: [number, number] | null,
    paketId?: string | null,
    vites?: string | null,
  ) {
    const model = await this.db.catalogModel.findUnique({
      where: { id: modelId },
      select: {
        id: true,
        name: true,
        series: { select: { id: true, name: true, make: { select: { id: true, name: true } } } },
      },
    });
    if (!model) throw new NotFoundException('Sürüm bulunamadı');
    const acik = await this.acikKaynaklar();
    const yillar = aralik
      ? Array.from({ length: Math.min(aralik[1] - aralik[0] + 1, 80) }, (_, i) => aralik[0] + i)
      : null;
    const tum = await this.db.catalogVariant.findMany({
      where: { modelId, source: { in: ['tsb', 'yerli'] } },
      select: {
        rawName: true,
        gearbox: true,
        powerHp: true,
        years: true,
        trim: { select: { id: true, key: true, name: true } },
        specs: { select: { source: true, summary: true } },
      },
      take: 2000,
    });
    const yildaki = yillar ? tum.filter((t) => t.years.some((y) => yillar.includes(y))) : tum;
    const paketler = new Map<string, { id: string; key: string; ad: string; yillar: Set<number> }>();
    for (const t of tum) {
      if (!t.trim) continue;
      const p = paketler.get(t.trim.id) ?? {
        id: t.trim.id,
        key: t.trim.key,
        ad: t.trim.name,
        yillar: new Set(),
      };
      for (const y of t.years) p.yillar.add(y);
      paketler.set(t.trim.id, p);
    }
    const paket = paketId ? paketler.get(paketId) : undefined;
    if (paketId && !paket) throw new BadRequestException('Bu sürümde böyle bir paket yok');
    const pakettekiler = yildaki.filter((t) => !paket || t.trim?.id === paket.id);
    // Vites seçenekleri: seçilen yıl ve paketteki tiplerin TSB adından bilinen vitesleri
    const vitesler = [...new Set(pakettekiler.map((t) => t.gearbox).filter((g): g is string => !!g))].sort();
    const hedef = pakettekiler.filter((t) => !vites || t.gearbox === vites);
    const ozetler = hedef.flatMap((t) => {
      const o = tipTeknik(t.specs, acik, t);
      return o ? [o] : [];
    });
    const kaynak = ozetler.length ? (ozetBirlestir(ozetler) as TeknikOzet) : null;
    const kayitlar = await this.db.catalogSpecOverride.findMany({
      where: { modelId, status: 'aktif' },
      select: {
        id: true,
        yearFrom: true,
        yearTo: true,
        values: true,
        equipment: true,
        gearbox: true,
        hiddenRows: true,
        extraRows: true,
        note: true,
        createdAt: true,
        trim: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const elle = kayitlariSec(
      await elleKayitlari(this.db, [modelId], aralik, paket ? [paket.key] : []),
      modelId,
      vites ? [vites] : null,
    );
    const yil = (ys: number[]) => {
      const y = [...ys].sort((a, b) => a - b);
      return y.length ? ([y[0], y.at(-1)] as [number, number]) : null;
    };
    return {
      id: model.id,
      ad: model.name,
      arac: model.series ? `${model.series.make.name} ${model.series.name}` : null,
      seriesId: model.series?.id ?? null,
      makeId: model.series?.make.id ?? null,
      paketler: [...paketler.values()]
        .map((p) => ({ id: p.id, ad: p.ad, yillar: yil([...p.yillar]) }))
        .sort((a, b) => a.ad.localeCompare(b.ad, 'tr')),
      vitesler,
      // Kaydın uygulanacağı tipler (yıl aralığı, paket ve vitesle)
      tipler: hedef
        .map((t) => ({
          ad: t.rawName,
          paket: t.trim?.name ?? null,
          vites: t.gearbox,
          yillar: yil(t.years),
        }))
        .sort((a, b) => a.ad.localeCompare(b.ad, 'tr')),
      kaynak,
      sonuc: duzeltmeUygula(kaynak, elle.degerler, elle.duzen),
      // Gösterilen donanım: paketin kendi listesi, yoksa bütün paketlerinki
      donanim:
        (
          elle.donanim.find((d) => paket && d.paket === paket.ad) ??
          elle.donanim.find((d) => d.paket === null)
        )?.gruplar ?? null,
      duzeltmeler: kayitlar.map((d) => ({
        id: d.id,
        yillar: [d.yearFrom, d.yearTo] as [number | null, number | null],
        paket: d.trim?.name ?? null,
        paketId: d.trim?.id ?? null,
        vites: d.gearbox,
        degerler: d.values as TeknikDuzeltme,
        donanim: (d.equipment as DonanimGrubu[] | null) ?? null,
        gizli: d.hiddenRows,
        ekSatirlar: (d.extraRows as EkSatir[] | null) ?? [],
        not: d.note,
        zaman: d.createdAt.toISOString(),
      })),
    };
  }

  /** Türkiye'de satılan tipi olan markalar (konsol › araç seçimi) */
  async markalar() {
    const rows = await this.db.catalogVariant.groupBy({
      by: ['makeId'],
      where: { source: { in: ['tsb', 'yerli'] } },
    });
    const markalar = await this.db.catalogMake.findMany({
      where: { id: { in: rows.map((r) => r.makeId) } },
      select: { id: true, name: true },
    });
    return markalar.map((m) => ({ id: m.id, ad: m.name })).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  }

  /** Markanın Türkiye'de satılan tipi olan modelleri (seri), yıllarıyla */
  async markaSerileri(makeId: string) {
    const tipler = await this.db.catalogVariant.findMany({
      where: { makeId, source: { in: ['tsb', 'yerli'] }, seriesId: { not: null } },
      select: { years: true, series: { select: { id: true, name: true } } },
    });
    const m = new Map<string, { id: string; ad: string; min: number; max: number }>();
    for (const t of tipler) {
      if (!t.series) continue;
      const g = m.get(t.series.id) ?? { id: t.series.id, ad: t.series.name, min: 9999, max: 0 };
      for (const y of t.years) {
        g.min = Math.min(g.min, y);
        g.max = Math.max(g.max, y);
      }
      m.set(t.series.id, g);
    }
    return [...m.values()]
      .map((g) => ({ id: g.id, ad: g.ad, yillar: g.max ? ([g.min, g.max] as [number, number]) : null }))
      .sort((a, b) => a.ad.localeCompare(b.ad, 'tr', { numeric: true }));
  }

  /**
   * Bilgisi eksik araçlar (sahip isteği, 18 Kasım 2026): yayındaki taleplerde geçen motor sürümlerinden temel teknik
   * alanı (`teknikEksikleri`) ya da donanımı eksik olanlar, en çok talepte geçen önce. Motor seçilmemiş talepler model
   * başına ayrı satır olarak gelir (konsolda o modelin sürümleri açılır).
   */
  async eksikler() {
    const talepler = await this.db.demand.findMany({
      where: { status: 'PUBLISHED', seriesKey: { not: null } },
      select: { no: true, seriesKey: true, modelKey: true },
      orderBy: { publishedAt: 'desc' },
      take: 5000,
    });
    const motorTalepleri = new Map<string, number[]>();
    const seriTalepleri = new Map<string, number[]>();
    for (const t of talepler) {
      const [m, k] = t.modelKey ? [motorTalepleri, t.modelKey] : [seriTalepleri, t.seriesKey as string];
      m.set(k, [...(m.get(k) ?? []), Number(t.no)]);
    }
    const [modeller, seriler] = await Promise.all([
      this.db.catalogModel.findMany({
        where: { key: { in: [...motorTalepleri.keys()] } },
        select: {
          id: true,
          key: true,
          name: true,
          series: { select: { id: true, name: true, make: { select: { id: true, name: true } } } },
        },
      }),
      this.db.catalogSeries.findMany({
        where: { key: { in: [...seriTalepleri.keys()] } },
        select: { id: true, key: true, name: true, make: { select: { id: true, name: true } } },
      }),
    ]);
    const ids = modeller.map((m) => m.id);
    const acik = await this.acikKaynaklar();
    const [tipler, kayitlar] = await Promise.all([
      this.db.catalogVariant.findMany({
        where: { modelId: { in: ids }, source: { in: ['tsb', 'yerli'] } },
        select: {
          modelId: true,
          gearbox: true,
          powerHp: true,
          specs: { select: { source: true, summary: true } },
        },
      }),
      this.db.catalogSpecOverride.findMany({
        where: { modelId: { in: ids }, status: 'aktif' },
        select: { modelId: true, values: true, equipment: true, hiddenRows: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const satirlar = modeller.map((m) => {
      const ozetler = tipler
        .filter((t) => t.modelId === m.id)
        .flatMap((t) => {
          const o = tipTeknik(t.specs, acik, t);
          return o ? [o] : [];
        });
      const kendi = kayitlar.filter((k) => k.modelId === m.id);
      const sonuc = duzeltmeUygula(
        ozetler.length ? (ozetBirlestir(ozetler) as TeknikOzet) : null,
        kendi.map((k) => k.values as TeknikDuzeltme).filter((v) => Object.keys(v).length),
        kendi.map((k) => ({ gizli: k.hiddenRows })),
      );
      const no = motorTalepleri.get(m.key) ?? [];
      return {
        modelId: m.id as string | null,
        seriesId: m.series?.id ?? null,
        makeId: m.series?.make.id ?? null,
        arac: m.series ? `${m.series.make.name} ${m.series.name}` : null,
        motor: m.name as string | null,
        talepSayisi: no.length,
        talepler: no.slice(0, 5),
        eksik: teknikEksikleri(sonuc),
        donanimVar: kendi.some((k) => (k.equipment as DonanimGrubu[] | null)?.length),
      };
    });
    const motorsuz = seriler.map((s) => {
      const no = seriTalepleri.get(s.key) ?? [];
      return {
        modelId: null,
        seriesId: s.id as string | null,
        makeId: s.make.id as string | null,
        arac: `${s.make.name} ${s.name}`,
        motor: null,
        talepSayisi: no.length,
        talepler: no.slice(0, 5),
        eksik: [] as string[],
        donanimVar: false,
      };
    });
    return [...satirlar.filter((r) => r.eksik.length || !r.donanimVar), ...motorsuz].sort(
      (a, b) => b.talepSayisi - a.talepSayisi || (a.arac ?? '').localeCompare(b.arac ?? '', 'tr'),
    );
  }

  async ekle(
    modelId: string,
    b: {
      yilBas?: number | null;
      yilSon?: number | null;
      paket?: string | null;
      vites?: string | null;
      degerler: TeknikDuzeltme;
      donanim?: DonanimGrubu[] | null;
      /** Bu araçta gösterilmeyecek satırlar (TEKNIK_SATIRLAR anahtarı) */
      gizli?: string[] | null;
      /** Serbest ek satırlar */
      ekSatirlar?: EkSatir[] | null;
      not?: string | null;
      bildirim?: string | null;
      /** Düzenlenen kayıt: yeni kayıt aynı işlemde onun yerine geçer (eski kayıt kaldırılır, silinmez) */
      yerine?: string | null;
    },
    staffId: string,
    ip?: string,
  ) {
    if (!(await this.db.catalogModel.findUnique({ where: { id: modelId }, select: { id: true } })))
      throw new NotFoundException('Sürüm bulunamadı');
    if (
      b.paket &&
      !(await this.db.catalogVariant.findFirst({
        where: { modelId, trimId: b.paket, source: { in: ['tsb', 'yerli'] } },
        select: { id: true },
      }))
    )
      throw new BadRequestException('Bu sürümde böyle bir paket yok');
    if (
      b.vites &&
      !(await this.db.catalogVariant.findFirst({
        where: {
          modelId,
          gearbox: b.vites,
          source: { in: ['tsb', 'yerli'] },
          ...(b.paket ? { trimId: b.paket } : {}),
        },
        select: { id: true },
      }))
    )
      throw new BadRequestException('Bu sürümde (ve pakette) bu vitesle satılan tip yok');
    if (b.yerine) {
      const eski = await this.db.catalogSpecOverride.findUnique({
        where: { id: b.yerine },
        select: { modelId: true, status: true },
      });
      if (eski?.modelId !== modelId || eski.status !== 'aktif')
        throw new ConflictException('Düzenlenen kayıt artık etkin değil; sayfayı yenile');
    }
    const degerler = dogrula(b.degerler);
    const donanim = b.donanim?.length ? donanimDogrula(b.donanim) : null;
    const gizli = [...new Set(b.gizli ?? [])];
    const bilinmeyen = gizli.find((g) => !TEKNIK_SATIR_ANAHTARLARI.has(g));
    if (bilinmeyen) throw new BadRequestException(`Bilinmeyen satır: ${bilinmeyen}`);
    const ekSatirlar = ekSatirDogrula(b.ekSatirlar ?? []);
    if (!Object.keys(degerler).length && !donanim && !gizli.length && !ekSatirlar.length)
      throw new BadRequestException('En az bir değer, donanım, gizlenen ya da eklenen satır yaz');
    return this.db.$transaction(async (tx) => {
      const d = await tx.catalogSpecOverride.create({
        data: {
          id: uuidv7(),
          modelId,
          trimId: b.paket ?? null,
          gearbox: b.vites ?? null,
          yearFrom: b.yilBas ?? null,
          yearTo: b.yilSon ?? null,
          values: degerler as Prisma.InputJsonValue,
          equipment: donanim ? (donanim as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
          hiddenRows: gizli,
          extraRows: ekSatirlar.length ? (ekSatirlar as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
          note: b.not ?? null,
          createdBy: staffId,
        },
        select: { id: true },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: b.yerine ? 'teknik_duzeltme_degistirildi' : 'teknik_ozellik_duzeltildi',
          entityType: 'catalog_spec_override',
          entityId: d.id,
          after: {
            model: modelId,
            ...(b.yerine ? { yerine: b.yerine } : {}),
            paket: b.paket ?? null,
            vites: b.vites ?? null,
            yillar: [b.yilBas ?? null, b.yilSon ?? null],
            degerler,
            donanim: donanim ? donanim.reduce((n, g) => n + g.ogeler.length, 0) : 0,
            ...(gizli.length ? { gizli } : {}),
            ...(ekSatirlar.length ? { ekSatirlar } : {}),
          } as unknown as Prisma.InputJsonValue,
          ip,
        },
        tx,
      );
      // Düzenlenen kayıt aynı işlemde kaldırılır (yarışta iki kişi aynı kaydı düzenlerse biri reddedilir)
      if (b.yerine) {
        const u = await tx.catalogSpecOverride.updateMany({
          where: { id: b.yerine, status: 'aktif' },
          data: { status: 'kaldirildi', removedBy: staffId, removedAt: new Date(), replacedBy: d.id },
        });
        if (u.count !== 1) throw new ConflictException('Düzenlenen kayıt artık etkin değil; sayfayı yenile');
      }
      // Bildirimden gelindiyse bildirim aynı işlemde kapanır
      if (b.bildirim)
        await tx.catalogSpecReport.updateMany({
          where: { id: b.bildirim, status: 'acik' },
          data: { status: 'duzeltildi', decidedBy: staffId, decidedAt: new Date() },
        });
      return d;
    });
  }

  async kaldir(id: string, staffId: string, ip?: string) {
    const d = await this.db.catalogSpecOverride.findUnique({
      where: { id },
      select: { status: true, modelId: true },
    });
    if (d?.status !== 'aktif') throw new NotFoundException('Etkin düzeltme bulunamadı');
    return this.db.$transaction(async (tx) => {
      const u = await tx.catalogSpecOverride.update({
        where: { id },
        data: { status: 'kaldirildi', removedBy: staffId, removedAt: new Date() },
        select: { id: true, status: true },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'teknik_duzeltme_kaldirildi',
          entityType: 'catalog_spec_override',
          entityId: id,
          after: { model: d.modelId },
          ip,
        },
        tx,
      );
      return u;
    });
  }
}

/** Düzeltme değerlerini alan tanımına göre denetler: aralık iki sayı, liste en çok 10 kısa metin, seçim listeden */
export function dogrula(v: Record<string, unknown>): TeknikDuzeltme {
  const out: Record<string, [number, number] | string[]> = {};
  for (const [k, deger] of Object.entries(v ?? {})) {
    const a = TEKNIK_ALANLARI.find((x) => x.key === k);
    if (!a) throw new BadRequestException(`Bilinmeyen alan: ${k}`);
    if (a.tur === 'aralik') {
      if (
        !Array.isArray(deger) ||
        deger.length !== 2 ||
        !deger.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n < 1_000_000) ||
        (deger[0] as number) > (deger[1] as number)
      )
        throw new BadRequestException(`${a.ad}: sayı ya da "en az–en çok" yaz`);
      out[k] = [deger[0] as number, deger[1] as number];
    } else {
      if (
        !Array.isArray(deger) ||
        !deger.length ||
        deger.length > 10 ||
        !deger.every((x) => typeof x === 'string' && x.trim().length > 0 && x.length <= 80)
      )
        throw new BadRequestException(`${a.ad}: en az bir, en çok on değer yaz`);
      const l = (deger as string[]).map((x) => x.trim());
      if (k === 'vitesler' && !l.every((x) => /^(manuel|otomatik|yari_otomatik):\d{0,2}$/.test(x)))
        throw new BadRequestException(
          'Vites: "manuel:6", "otomatik:8" ya da "yari_otomatik:6" biçiminde yaz',
        );
      if (a.tur === 'secim' && !l.every((x) => a.secenekler?.some(([s]) => s === x)))
        throw new BadRequestException(`${a.ad}: listeden seç`);
      out[k] = l;
    }
  }
  return out as TeknikDuzeltme;
}

/** Donanım listesini denetler: en çok 30 grup, grupta en çok 150 öğe, kısa metinler; boş grup düşer */
export function donanimDogrula(gruplar: readonly DonanimGrubu[]): DonanimGrubu[] {
  const out: DonanimGrubu[] = [];
  for (const g of gruplar) {
    const ad = g.ad.trim();
    const ogeler = [...new Set(g.ogeler.map((x) => x.trim()).filter(Boolean))];
    if (!ogeler.length) continue;
    if (!ad || ad.length > 60) throw new BadRequestException('Donanım grubunun adı 1–60 karakter olmalı');
    if (ogeler.length > 150 || ogeler.some((x) => x.length > 160))
      throw new BadRequestException(`${ad}: en çok 150 öğe, her biri en çok 160 karakter`);
    out.push({ ad, ogeler });
  }
  if (out.length > 30) throw new BadRequestException('En çok 30 donanım grubu');
  return out;
}

/** Ek satırlar: bölüm, etiket ve değer dolu ve kısa; aynı bölüm ve etikette sonuncusu kalır */
export function ekSatirDogrula(satirlar: readonly EkSatir[]): EkSatir[] {
  const m = new Map<string, EkSatir>();
  for (const e of satirlar) {
    const r = { bolum: e.bolum.trim(), etiket: e.etiket.trim(), deger: e.deger.trim() };
    if (!r.bolum || !r.etiket || !r.deger)
      throw new BadRequestException('Ek satırda bölüm, etiket ve değer dolu olmalı');
    if (r.bolum.length > 60 || r.etiket.length > 80 || r.deger.length > 200)
      throw new BadRequestException(`${r.etiket}: bölüm en çok 60, etiket 80, değer 200 karakter`);
    m.set(`${r.bolum.toLocaleLowerCase('tr-TR')}|${r.etiket.toLocaleLowerCase('tr-TR')}`, r);
  }
  if (m.size > 60) throw new BadRequestException('En çok 60 ek satır');
  return [...m.values()];
}
