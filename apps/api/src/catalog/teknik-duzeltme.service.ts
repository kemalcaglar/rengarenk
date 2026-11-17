import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ozetBirlestir, type TeknikOzet, teknikOku } from '@rengarenk/catalog';
import { Prisma, uuidv7 } from '@rengarenk/db';
import { duzeltmeUygula, TEKNIK_ALANLARI, type TeknikDuzeltme } from '@rengarenk/shared';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { duzeltmeleri } from './teknik-duzeltme.js';

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

  /**
   * Bir motor sürümünün değerleri: kaynaklardan gelen (düzeltmesiz), düzeltmeler ve sonuç. `aralik` verilirse yalnızca
   * o yıllarda satılan tipler ve o yıllara uyan düzeltmeler.
   */
  async model(modelId: string, aralik: [number, number] | null) {
    const model = await this.db.catalogModel.findUnique({
      where: { id: modelId },
      select: {
        id: true,
        name: true,
        series: { select: { id: true, name: true, make: { select: { name: true } } } },
      },
    });
    if (!model) throw new NotFoundException('Sürüm bulunamadı');
    const acik = new Set(
      (
        await this.db.catalogSource.findMany({
          where: { key: { in: ['ademe', 'vmm'] }, active: true },
          select: { key: true },
        })
      ).map((x) => x.key),
    );
    const yillar = aralik
      ? Array.from({ length: Math.min(aralik[1] - aralik[0] + 1, 80) }, (_, i) => aralik[0] + i)
      : null;
    const tipler = await this.db.catalogVariant.findMany({
      where: { modelId, source: { in: ['tsb', 'yerli'] }, ...(yillar ? { years: { hasSome: yillar } } : {}) },
      select: { specs: { select: { source: true, summary: true } } },
      take: 2000,
    });
    const ozetler = tipler.flatMap((t) => {
      const o = acik.size ? teknikOku(t.specs, acik) : null;
      return o?.kaynaklar?.length ? [o] : [];
    });
    const kaynak = ozetler.length ? (ozetBirlestir(ozetler) as TeknikOzet) : null;
    const tum = await this.db.catalogSpecOverride.findMany({
      where: { modelId, status: 'aktif' },
      select: { id: true, yearFrom: true, yearTo: true, values: true, note: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const uyan = (await duzeltmeleri(this.db, [modelId], aralik)).get(modelId) ?? [];
    return {
      id: model.id,
      ad: model.name,
      arac: model.series ? `${model.series.make.name} ${model.series.name}` : null,
      seriesId: model.series?.id ?? null,
      kaynak,
      sonuc: duzeltmeUygula(kaynak, uyan),
      duzeltmeler: tum.map((d) => ({
        id: d.id,
        yillar: [d.yearFrom, d.yearTo] as [number | null, number | null],
        degerler: d.values as TeknikDuzeltme,
        not: d.note,
        zaman: d.createdAt.toISOString(),
      })),
    };
  }

  async ekle(
    modelId: string,
    b: {
      yilBas?: number | null;
      yilSon?: number | null;
      degerler: TeknikDuzeltme;
      not?: string | null;
      bildirim?: string | null;
    },
    staffId: string,
    ip?: string,
  ) {
    if (!(await this.db.catalogModel.findUnique({ where: { id: modelId }, select: { id: true } })))
      throw new NotFoundException('Sürüm bulunamadı');
    const degerler = dogrula(b.degerler);
    if (!Object.keys(degerler).length) throw new BadRequestException('En az bir değer yaz');
    return this.db.$transaction(async (tx) => {
      const d = await tx.catalogSpecOverride.create({
        data: {
          id: uuidv7(),
          modelId,
          yearFrom: b.yilBas ?? null,
          yearTo: b.yilSon ?? null,
          values: degerler as Prisma.InputJsonValue,
          note: b.not ?? null,
          createdBy: staffId,
        },
        select: { id: true },
      });
      await this.audit.record(
        {
          actorType: 'STAFF',
          actorId: staffId,
          action: 'teknik_ozellik_duzeltildi',
          entityType: 'catalog_spec_override',
          entityId: d.id,
          after: {
            model: modelId,
            yillar: [b.yilBas ?? null, b.yilSon ?? null],
            degerler,
          } as Prisma.InputJsonValue,
          ip,
        },
        tx,
      );
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
