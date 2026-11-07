import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  buildTsbSnapshot,
  buildVehiclesDbSnapshot,
  buildVmmSnapshot,
  buildWikidataSnapshot,
  buildYerliSnapshot,
  revisionFromFileName,
  signSnapshot,
  TSB_PARSER,
  VEHICLESDB_PARSER,
  VMM_PARSER,
  WIKIDATA_PARSER,
  YERLI_KLASIKLER,
  YERLI_SURUM,
} from '@rengarenk/catalog';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { CatalogImageService } from './catalog-image.service.js';
import { CatalogImportService, type ImportMeta, type ImportOutcome } from './catalog-import.service.js';
import { CATALOG_KEYS, type CatalogKeys } from './catalog-keys.js';
import { TSB_CLIENT, type TsbClient } from './tsb-client.js';
import { VEHICLESDB_CLIENT, type VehiclesDbClient } from './vehiclesdb-client.js';
import { VMM_CLIENT, type VmmClient } from './vmm-client.js';
import { WIKIDATA_CLIENT, type WikidataClient } from './wikidata-client.js';

/** Wikidata haftada bir çekilir (Teknik tasarım §5); işçi 6 saatte bir sorar. */
export const WIKIDATA_EVERY_HOURS = 24 * 7;

/** Otomatik kaynak bu kadar süre başarıyla güncellenmezse uyarı gider (Karar 33). */
export const STALE_HOURS = 48;

/**
 * Katalog hattı (Teknik tasarım §5). Şimdilik işçide ve API'de çalışır; GCP erişimi gelince Cloud Run'a taşınır
 * ve yalnızca imzalı paket Radore'ye gelir. TSB dosyası iki yoldan girer: konsoldan yükleme ve otomatik çekme.
 */
@Injectable()
export class CatalogPipelineService {
  private readonly log = new Logger(CatalogPipelineService.name);

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(CATALOG_KEYS) private readonly keys: CatalogKeys,
    @Inject(TSB_CLIENT) private readonly tsb: TsbClient,
    @Inject(VMM_CLIENT) private readonly vmm: VmmClient,
    @Inject(WIKIDATA_CLIENT) private readonly wikidata: WikidataClient,
    @Inject(VEHICLESDB_CLIENT) private readonly vehiclesdb: VehiclesDbClient,
    private readonly importer: CatalogImportService,
    private readonly images: CatalogImageService,
    private readonly outbox: OutboxService,
  ) {}

  /** TSB dosyasını işler: okuma → normalize → imzalı paket → kalite kontrolü → kataloğa yazma. */
  async runTsbFile(file: Uint8Array, meta: ImportMeta): Promise<ImportOutcome> {
    const fileSha256 = createHash('sha256').update(file).digest('hex');
    let pkg: ReturnType<typeof signSnapshot>;
    try {
      const snap = buildTsbSnapshot(file, {
        revision: meta.fileName ? revisionFromFileName(meta.fileName) : undefined,
      });
      pkg = signSnapshot(snap, this.keys.privatePem);
    } catch (err) {
      return this.failRead(meta, fileSha256, (err as Error).message);
    }
    return this.importer.apply(pkg, { ...meta, fileSha256 });
  }

  /** vehicle-makes-models sürüm dosyasını işler (1990–2005 yılları; Teknik tasarım §5). */
  async runVmmFile(file: Uint8Array, meta: ImportMeta & { version: string }): Promise<ImportOutcome> {
    const fileSha256 = createHash('sha256').update(file).digest('hex');
    let pkg: ReturnType<typeof signSnapshot>;
    try {
      pkg = signSnapshot(buildVmmSnapshot(file, { version: meta.version }), this.keys.privatePem);
    } catch (err) {
      return this.importer.recordReadFailure('vmm', { ...meta, fileSha256 }, (err as Error).message);
    }
    return this.importer.apply(pkg, { ...meta, fileSha256 });
  }

  /** GitHub'da yeni sürüm varsa indirip işler. Aynı sürüm ikinci kez indirilmez. */
  async checkVmm(
    opts: { force?: boolean; staffId?: string; ip?: string } = {},
  ): Promise<{ durum: string; outcome?: ImportOutcome }> {
    const source = await this.db.catalogSource.findUniqueOrThrow({ where: { key: 'vmm' } });
    if (!source.autoFetch && !opts.force) return { durum: 'kapali' };
    try {
      const rel = await this.vmm.latest();
      if (rel.tag === source.lastVersion && (await this.appliedWith('vmm', VMM_PARSER))) {
        await this.db.catalogSource.update({
          where: { key: 'vmm' },
          data: { lastCheckedAt: new Date(), lastError: null },
        });
        return { durum: 'yeni_dosya_yok' };
      }
      const outcome = await this.runVmmFile(await this.vmm.download(rel.url), {
        fileName: rel.fileName,
        version: rel.tag,
        trigger: opts.staffId ? 'elle' : 'otomatik',
        staffId: opts.staffId,
        ip: opts.ip,
      });
      return { durum: outcome.status === 'APPLIED' ? 'uygulandi' : outcome.status.toLowerCase(), outcome };
    } catch (err) {
      const message = (err as Error).message;
      this.log.warn(`vehicle-makes-models kontrolü başarısız: ${message}`);
      await this.db.catalogSource.update({
        where: { key: 'vmm' },
        data: { lastCheckedAt: new Date(), lastError: message },
      });
      return { durum: 'hata' };
    }
  }

  /**
   * Türkiye'ye özgü eski modeller: depodaki kaynaklı liste (sahip kararı). Liste sürümü değiştiyse işlenir;
   * ağ gerekmez.
   */
  async checkYerli(
    opts: { force?: boolean; staffId?: string; ip?: string } = {},
  ): Promise<{ durum: string; outcome?: ImportOutcome }> {
    const source = await this.db.catalogSource.findUniqueOrThrow({ where: { key: 'yerli' } });
    if (!source.autoFetch && !opts.force) return { durum: 'kapali' };
    if (source.lastVersion === YERLI_SURUM) return { durum: 'yeni_dosya_yok' };
    const fileSha256 = createHash('sha256').update(JSON.stringify(YERLI_KLASIKLER)).digest('hex');
    const pkg = signSnapshot(buildYerliSnapshot(), this.keys.privatePem);
    const outcome = await this.importer.apply(pkg, {
      fileName: `yerli-klasikler-${YERLI_SURUM}`,
      fileSha256,
      trigger: opts.staffId ? 'elle' : 'otomatik',
      staffId: opts.staffId,
      ip: opts.ip,
    });
    return { durum: outcome.status === 'APPLIED' ? 'uygulandi' : outcome.status.toLowerCase(), outcome };
  }

  /**
   * Wikidata nesil kodları: haftada bir (elle her zaman). Yalnızca katalogda var olan serilere kod ekler;
   * eşleşmeyen seriler ad eşleme önerisine düşer. Kodlar kasa kuşaklarına yazılır (makyaj sırası).
   */
  async checkWikidata(
    opts: { force?: boolean; staffId?: string; ip?: string; now?: Date } = {},
  ): Promise<{ durum: string; outcome?: ImportOutcome }> {
    const source = await this.db.catalogSource.findUniqueOrThrow({ where: { key: 'wikidata' } });
    if (!source.autoFetch && !opts.force) return { durum: 'kapali' };
    const now = opts.now ?? new Date();
    if (
      !opts.force &&
      source.lastSuccessAt &&
      now.getTime() - source.lastSuccessAt.getTime() < WIKIDATA_EVERY_HOURS * 3600_000 &&
      (await this.appliedWith('wikidata', WIKIDATA_PARSER))
    ) {
      return { durum: 'yeni_dosya_yok' };
    }
    try {
      const rows = await this.wikidata.generations();
      const titles = rows.map((r) => r.enTitle).filter((t): t is string => Boolean(t));
      const enwiki = await this.wikidata.productions(titles);
      const makes = (await this.db.catalogMake.findMany({ select: { name: true } })).map((m) => m.name);
      const version = now.toISOString().slice(0, 10);
      const snap = buildWikidataSnapshot(rows, enwiki, { makes, version, now });
      const payload = JSON.stringify(snap.generations);
      const outcome = await this.importer.apply(signSnapshot(snap, this.keys.privatePem), {
        fileName: `wikidata-${version}`,
        fileSha256: createHash('sha256').update(payload).digest('hex'),
        trigger: opts.staffId ? 'elle' : 'otomatik',
        staffId: opts.staffId,
        ip: opts.ip,
      });
      return { durum: outcome.status === 'APPLIED' ? 'uygulandi' : outcome.status.toLowerCase(), outcome };
    } catch (err) {
      const message = (err as Error).message;
      this.log.warn(`Wikidata kontrolü başarısız: ${message}`);
      await this.db.catalogSource.update({
        where: { key: 'wikidata' },
        data: { lastCheckedAt: new Date(), lastError: message },
      });
      return { durum: 'hata' };
    }
  }

  /**
   * VehiclesDB: motosiklet, moped, kamyon, otobüs, van (CC BY 4.0). Yeni sürüm varsa indirip işler; sürümün atıf
   * metni (ATTRIBUTION.md) kaynağa yazılır ve sitedeki "Veri kaynakları" sayfasında gösterilir.
   */
  async checkVehiclesDb(
    opts: { force?: boolean; staffId?: string; ip?: string } = {},
  ): Promise<{ durum: string; outcome?: ImportOutcome }> {
    const source = await this.db.catalogSource.findUniqueOrThrow({ where: { key: 'vehiclesdb' } });
    if (!source.autoFetch && !opts.force) return { durum: 'kapali' };
    try {
      const rel = await this.vehiclesdb.latest();
      if (rel.tag === source.lastVersion && (await this.appliedWith('vehiclesdb', VEHICLESDB_PARSER))) {
        await this.db.catalogSource.update({
          where: { key: 'vehiclesdb' },
          data: { lastCheckedAt: new Date(), lastError: null },
        });
        return { durum: 'yeni_dosya_yok' };
      }
      const file = await this.vehiclesdb.download(rel.csvUrl);
      const meta = {
        fileName: `${rel.tag}/vehicles.csv`,
        fileSha256: createHash('sha256').update(file).digest('hex'),
        trigger: opts.staffId ? ('elle' as const) : ('otomatik' as const),
        staffId: opts.staffId,
        ip: opts.ip,
      };
      let pkg: ReturnType<typeof signSnapshot>;
      try {
        pkg = signSnapshot(buildVehiclesDbSnapshot(file, { version: rel.tag }), this.keys.privatePem);
      } catch (err) {
        const outcome = await this.importer.recordReadFailure('vehiclesdb', meta, (err as Error).message);
        return { durum: 'failed', outcome };
      }
      const outcome = await this.importer.apply(pkg, meta);
      // Atıf metni lisans koşuludur: sürümle gelen metin olduğu gibi saklanır (en çok 200 KB).
      if (outcome.status === 'APPLIED' && rel.attributionUrl) {
        const notice = new TextDecoder().decode(
          await this.vehiclesdb.download(rel.attributionUrl, 200 * 1024),
        );
        await this.db.catalogSource.update({ where: { key: 'vehiclesdb' }, data: { notice } });
      }
      return { durum: outcome.status === 'APPLIED' ? 'uygulandi' : outcome.status.toLowerCase(), outcome };
    } catch (err) {
      const message = (err as Error).message;
      this.log.warn(`VehiclesDB kontrolü başarısız: ${message}`);
      await this.db.catalogSource.update({
        where: { key: 'vehiclesdb' },
        data: { lastCheckedAt: new Date(), lastError: message },
      });
      return { durum: 'hata' };
    }
  }

  /** Konsoldaki "Şimdi kontrol et": kaynağa göre doğru hat. */
  checkSource(key: string, opts: { force?: boolean; staffId?: string; ip?: string }) {
    if (key === 'tsb') return this.checkTsb(opts);
    if (key === 'vmm') return this.checkVmm(opts);
    if (key === 'yerli') return this.checkYerli(opts);
    if (key === 'wikidata') return this.checkWikidata(opts);
    if (key === 'vehiclesdb') return this.checkVehiclesDb(opts);
    if (key === 'commons') return this.images.findCandidates({ force: opts.force });
    throw new NotFoundException('Kaynak bulunamadı');
  }

  /**
   * TSB'de yeni dosya var mı bakar; varsa indirip işler. `force`: kaynakta otomatik çekme kapalı olsa da çalışır
   * (konsoldaki "Şimdi kontrol et"). Aynı dosya adı ikinci kez indirilmez.
   */
  async checkTsb(
    opts: { force?: boolean; staffId?: string; ip?: string } = {},
  ): Promise<{ durum: string; outcome?: ImportOutcome }> {
    const source = await this.db.catalogSource.findUniqueOrThrow({ where: { key: 'tsb' } });
    if (!source.autoFetch && !opts.force) return { durum: 'kapali' };
    try {
      const latest = await this.tsb.latest();
      if (
        latest.fileName === source.lastFileName &&
        (await this.appliedWith('tsb', TSB_PARSER, latest.fileName))
      ) {
        await this.db.catalogSource.update({
          where: { key: 'tsb' },
          data: { lastCheckedAt: new Date(), lastError: null },
        });
        return { durum: 'yeni_dosya_yok' };
      }
      const file = await this.tsb.download(latest.url);
      const outcome = await this.runTsbFile(file, {
        fileName: latest.fileName,
        trigger: opts.staffId ? 'elle' : 'otomatik',
        staffId: opts.staffId,
        ip: opts.ip,
      });
      return { durum: outcome.status === 'APPLIED' ? 'uygulandi' : outcome.status.toLowerCase(), outcome };
    } catch (err) {
      const message = (err as Error).message;
      this.log.warn(`TSB kontrolü başarısız: ${message}`);
      await this.db.catalogSource.update({
        where: { key: 'tsb' },
        data: { lastCheckedAt: new Date(), lastError: message },
      });
      return { durum: 'hata' };
    }
  }

  /**
   * TSB arşivinden eski model yıllarını tamamlar (Karar 33: eski araçlar TSB arşivleriyle korunur). Her dosya
   * kendi döneminin 15 model yılını taşır; arşivin her yılından ilk ay alınır (2020 dosyası 2006–2020'yi getirir).
   * Daha önce yüklenen dosya yeniden indirilmez. Arşiv, güncel listenin alanlarını değiştirmez.
   */
  async backfillTsbArchive(
    opts: { fromYear?: number; toYear?: number; staffId?: string; ip?: string } = {},
  ): Promise<{ dosyalar: { dosya: string; durum: string; yeniTip?: number }[] }> {
    const now = new Date();
    const to = opts.toYear ?? now.getFullYear();
    const from = opts.fromYear ?? 2020;
    const done = new Set(
      (
        await this.db.catalogImport.findMany({
          where: {
            sourceKey: 'tsb',
            status: 'APPLIED',
            fileName: { not: null },
            stats: { path: ['parser'], equals: TSB_PARSER },
          },
          select: { fileName: true },
        })
      ).map((i) => i.fileName as string),
    );
    const dosyalar: { dosya: string; durum: string; yeniTip?: number }[] = [];
    for (let year = from; year <= to; year++) {
      let info = null;
      for (let month = 1; month <= 12 && !info; month++) {
        if (year === now.getFullYear() && month > now.getMonth() + 1) break;
        info = await this.tsb.archive(year, month);
      }
      if (!info) continue;
      if (done.has(info.fileName)) {
        dosyalar.push({ dosya: info.fileName, durum: 'daha_once_yuklendi' });
        continue;
      }
      const out = await this.runTsbFile(await this.tsb.download(info.url), {
        fileName: info.fileName,
        trigger: 'elle',
        archive: true,
        staffId: opts.staffId,
        ip: opts.ip,
      });
      dosyalar.push({
        dosya: info.fileName,
        durum: out.status.toLowerCase(),
        yeniTip: out.stats.added as number | undefined,
      });
    }
    return { dosyalar };
  }

  /** Otomatik kaynaklardan 48 saattir başarıyla güncellenemeyen var mı (işçi günde bir sorar, olay yazar). */
  async reportStaleSources(now = new Date()): Promise<string[]> {
    const limit = new Date(now.getTime() - STALE_HOURS * 3600_000);
    const stale = await this.db.catalogSource.findMany({
      where: {
        autoFetch: true,
        lastError: { not: null },
        OR: [{ lastSuccessAt: null }, { lastSuccessAt: { lt: limit } }],
      },
    });
    if (stale.length) {
      await this.db.$transaction(async (tx) => {
        for (const s of stale)
          await this.outbox.add(tx, 'katalog.kaynak_gecikti', { source: s.key, lastError: s.lastError });
      });
    }
    return stale.map((s) => s.key);
  }

  /** Kaynağın son dosyası bu ayrıştırıcı sürümüyle uygulanmış mı (kurallar değiştiyse yeniden işlenir) */
  private async appliedWith(source: string, parser: string, fileName?: string) {
    const hit = await this.db.catalogImport.findFirst({
      where: {
        sourceKey: source,
        status: 'APPLIED',
        ...(fileName ? { fileName } : {}),
        stats: { path: ['parser'], equals: parser },
      },
      select: { id: true },
    });
    return hit !== null;
  }

  private failRead(meta: ImportMeta, fileSha256: string, message: string) {
    return this.importer.recordReadFailure('tsb', { ...meta, fileSha256 }, message);
  }
}
