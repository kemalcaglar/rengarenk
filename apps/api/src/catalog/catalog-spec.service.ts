import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ADEME_DOSYALAR,
  ADEME_PARSER,
  type AdemeSurum,
  ademeBirlestir,
  ademeGuncelSatir,
  ademeKimlik,
  anaKural,
  readAdemeYil,
  type TeknikOzet,
  teknikAnahtar,
  teknikEslestir,
} from '@rengarenk/catalog';
import { Prisma, uuidv7 } from '@rengarenk/db';
import { AuditService } from '../audit/audit.service.js';
import { type Db, PRISMA, type Tx } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { ADEME_CLIENT, type AdemeClient } from './ademe-client.js';

const KAYNAK = 'ademe';
const chunks = <T>(xs: T[], n = 500) =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/**
 * Teknik özellikler (Karar 33, sahip isteği 16 Kasım 2026: "paketlere göre teknik özellikler, Türkiye'ye göre").
 * Türkiye'de satılan tipi TSB belirler; ADEME onay verisinde aynı marka, seri, yakıt, güç (ya da hacim), yıl ve vites
 * türündeki sürümler tipe bağlanır ve tipin teknik özeti (vites, güç, tüketim, CO2, ağırlık, Euro normu) yazılır.
 * Sürümler farklı değer veriyorsa aralık ya da seçenek olarak kalır; eşleşme yoksa tipte teknik özet olmaz (tahmin yok).
 */
@Injectable()
export class CatalogSpecService {
  private readonly log = new Logger('teknik');

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(ADEME_CLIENT) private readonly ademe: AdemeClient,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * Yüklenmemiş ADEME dosyalarını (ayrıştırıcı ya da ana liste sürümü değişince hepsini) ve ayda bir güncel listeyi
   * yükler; katalog ya da onay verisi değiştiyse tipleri yeniden eşleştirir.
   */
  async check(
    opts: { force?: boolean; staffId?: string; ip?: string; now?: Date } = {},
  ): Promise<{ durum: string; eslesen?: number }> {
    const source = await this.db.catalogSource.findUniqueOrThrow({ where: { key: KAYNAK } });
    if (!source.autoFetch && !opts.force) return { durum: 'kapali' };
    const parser = anaKural(ADEME_PARSER);
    const done = new Set(
      (
        await this.db.catalogImport.findMany({
          where: { sourceKey: KAYNAK, status: 'APPLIED', stats: { path: ['parser'], equals: parser } },
          select: { fileName: true },
        })
      ).map((i) => i.fileName),
    );
    let yuklenen = 0;
    try {
      for (const d of ADEME_DOSYALAR) {
        const fileName = `ademe-${d.yil}.zip`;
        if (done.has(fileName)) continue;
        const surumler = readAdemeYil(await this.ademe.dosya(d.adres), d);
        await this.yaz(surumler, { fileName, version: String(d.yil), parser, ...opts });
        yuklenen++;
      }
      const now = opts.now ?? new Date();
      const ay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const guncelAdi = `ademe-guncel-${ay}`;
      if (!done.has(guncelAdi)) {
        const satirlar = await this.ademe.guncel();
        const surumler = ademeBirlestir(
          satirlar
            .map((r) => ademeGuncelSatir(r, now.getFullYear()))
            .filter((x): x is AdemeSurum => x !== null),
        );
        await this.yaz(surumler, { fileName: guncelAdi, version: ay, parser, ...opts });
        yuklenen++;
      }
    } catch (err) {
      const message = (err as Error).message;
      this.log.warn(`ADEME: ${message}`);
      await this.db.catalogSource.update({
        where: { key: KAYNAK },
        data: { lastCheckedAt: new Date(), lastError: message },
      });
      return { durum: 'hata' };
    }

    // Eşleştirme imzası: ayrıştırıcı sürümü ve katalogdaki son içe aktarma (TSB, yerli, ana liste, ADEME)
    const son = await this.db.catalogImport.findFirst({
      where: { sourceKey: { in: ['tsb', 'yerli', 'ana', KAYNAK] }, status: 'APPLIED' },
      // uuidv7 zamana göre sıralı; aynı milisaniyedeki kayıtlarda da kararlı
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    const imza = `${parser}|${son?.id ?? ''}`;
    if (!yuklenen && source.lastVersion === imza) {
      await this.db.catalogSource.update({
        where: { key: KAYNAK },
        data: { lastCheckedAt: new Date(), lastError: null },
      });
      return { durum: 'yeni_dosya_yok' };
    }
    const eslesen = await this.eslestir(imza);
    await this.db.catalogSource.update({
      where: { key: KAYNAK },
      data: { lastVersion: imza, lastCheckedAt: new Date(), lastSuccessAt: new Date(), lastError: null },
    });
    return { durum: 'uygulandi', eslesen };
  }

  /** Onay sürümlerini yazar (kayıt, işlem kaydı ve olay aynı veritabanı işleminde; kural 5) */
  private async yaz(
    surumler: AdemeSurum[],
    meta: { fileName: string; version: string; parser: string; staffId?: string; ip?: string },
  ) {
    const id = uuidv7();
    await this.db.$transaction(
      async (tx: Tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`katalog:${KAYNAK}`}))`;
        for (const part of chunks(surumler)) {
          await tx.$executeRaw`
            INSERT INTO catalog_specs (id, source, source_key, year, make_name, series_name, match_key, description, fuel,
              power_kw, power_hp, engine_l, gearbox, gears, consumption_min, consumption_max, co2_min, co2_max,
              weight_min, weight_max, euro, row_count, version, updated_at)
            VALUES ${Prisma.join(
              part.map(
                (
                  s,
                ) => Prisma.sql`(${uuidv7()}::uuid, ${KAYNAK}, ${ademeKimlik(s)}, ${s.yil}, ${s.marka}, ${s.seri},
                  ${teknikAnahtar(s.marka, s.seri)}, ${s.aciklama}, ${s.yakit}, ${s.kw}::int, ${s.hp}::int,
                  ${s.hacim}::float8, ${s.vites}, ${s.vitesSayisi}::int, ${s.tuketimMin}::float8,
                  ${s.tuketimMax}::float8, ${s.co2Min === null ? null : Math.round(s.co2Min)}::int,
                  ${s.co2Max === null ? null : Math.round(s.co2Max)}::int,
                  ${s.agirlikMin === null ? null : Math.round(s.agirlikMin)}::int,
                  ${s.agirlikMax === null ? null : Math.round(s.agirlikMax)}::int, ${s.euro}, ${s.adet}::int,
                  ${meta.version}, now())`,
              ),
            )}
            ON CONFLICT (source, source_key) DO UPDATE SET
              make_name = EXCLUDED.make_name, series_name = EXCLUDED.series_name, match_key = EXCLUDED.match_key,
              description = EXCLUDED.description, consumption_min = EXCLUDED.consumption_min,
              consumption_max = EXCLUDED.consumption_max, co2_min = EXCLUDED.co2_min, co2_max = EXCLUDED.co2_max,
              weight_min = EXCLUDED.weight_min, weight_max = EXCLUDED.weight_max, row_count = EXCLUDED.row_count,
              version = EXCLUDED.version, updated_at = now()`;
        }
        const stats = { parser: meta.parser, kayit: surumler.length };
        await tx.catalogImport.create({
          data: {
            id,
            sourceKey: KAYNAK,
            version: meta.version,
            fileName: meta.fileName,
            sha256: createHash('sha256').update(JSON.stringify(surumler)).digest('hex'),
            trigger: meta.staffId ? 'elle' : 'otomatik',
            status: 'APPLIED',
            stats,
            createdBy: meta.staffId ?? null,
          },
        });
        await this.audit.record(
          {
            actorType: meta.staffId ? 'STAFF' : 'SYSTEM',
            actorId: meta.staffId ?? null,
            action: 'katalog_ice_aktarildi',
            entityType: 'catalog_import',
            entityId: id,
            after: { kaynak: KAYNAK, surum: meta.version, kayit: surumler.length },
            ip: meta.ip,
          },
          tx,
        );
        await this.outbox.add(tx, 'katalog.guncellendi', {
          importId: id,
          source: KAYNAK,
          version: meta.version,
          added: surumler.length,
          missing: 0,
        });
      },
      { timeout: 180_000, maxWait: 60_000 },
    );
  }

  /** Türkiye'de satılan tiplerin (TSB, yerli liste; motosiklet hariç) teknik özetini yeniden yazar */
  async eslestir(imza: string): Promise<number> {
    const specs = await this.db.catalogSpec.findMany({ where: { source: KAYNAK } });
    const dizin = new Map<string, AdemeSurum[]>();
    for (const s of specs) {
      const x: AdemeSurum = {
        yil: s.year,
        marka: s.makeName,
        seri: s.seriesName,
        aciklama: s.description,
        yakit: s.fuel as AdemeSurum['yakit'],
        kw: s.powerKw,
        hp: s.powerHp,
        hacim: s.engineL,
        vites: s.gearbox as AdemeSurum['vites'],
        vitesSayisi: s.gears,
        tuketimMin: s.consumptionMin,
        tuketimMax: s.consumptionMax,
        co2Min: s.co2Min,
        co2Max: s.co2Max,
        agirlikMin: s.weightMin,
        agirlikMax: s.weightMax,
        euro: s.euro,
        adet: s.rowCount,
      };
      dizin.set(s.matchKey, [...(dizin.get(s.matchKey) ?? []), x]);
    }
    const tipler = await this.db.catalogVariant.findMany({
      where: { source: { in: ['tsb', 'yerli'] }, NOT: { categories: { has: 'motosiklet' } } },
      select: {
        id: true,
        fuel: true,
        powerHp: true,
        powerKw: true,
        engineL: true,
        gearbox: true,
        years: true,
        make: { select: { name: true } },
        series: { select: { name: true } },
      },
    });
    const ozetler: { id: string; ozet: TeknikOzet }[] = [];
    for (const t of tipler) {
      const ozet = teknikEslestir(
        {
          marka: t.make.name,
          seri: t.series?.name ?? null,
          yakit: t.fuel,
          hp: t.powerHp ?? (t.powerKw ? Math.round(t.powerKw * 1.35962) : null),
          hacim: t.engineL,
          vites: t.gearbox,
          yillar: t.years,
        },
        dizin.get(teknikAnahtar(t.make.name, t.series?.name ?? null)) ?? [],
      );
      if (ozet) ozetler.push({ id: t.id, ozet });
    }
    // Türetilmiş tablo: her eşleştirmede baştan yazılır (kaynak kayıtlar catalog_specs'te kalır)
    await this.db.$transaction(
      async (tx: Tx) => {
        await tx.$executeRaw`DELETE FROM catalog_variant_specs WHERE source = ${KAYNAK}`;
        for (const part of chunks(ozetler)) {
          await tx.$executeRaw`
            INSERT INTO catalog_variant_specs (variant_id, source, summary, signature, updated_at)
            VALUES ${Prisma.join(
              part.map(
                (o) =>
                  Prisma.sql`(${o.id}::uuid, ${KAYNAK}, ${JSON.stringify(o.ozet)}::jsonb, ${imza}, now())`,
              ),
            )}`;
        }
      },
      { timeout: 180_000, maxWait: 60_000 },
    );
    this.log.log(`teknik özet: ${ozetler.length} / ${tipler.length} tip`);
    return ozetler.length;
  }
}
