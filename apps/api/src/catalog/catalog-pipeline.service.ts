import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { buildTsbSnapshot, revisionFromFileName, signSnapshot } from '@rengarenk/catalog';
import { type Db, PRISMA } from '../database/prisma.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { CatalogImportService, type ImportMeta, type ImportOutcome } from './catalog-import.service.js';
import { CATALOG_KEYS, type CatalogKeys } from './catalog-keys.js';
import { TSB_CLIENT, type TsbClient } from './tsb-client.js';

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
    private readonly importer: CatalogImportService,
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
      if (latest.fileName === source.lastFileName) {
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
          where: { sourceKey: 'tsb', status: { in: ['APPLIED', 'SKIPPED'] }, fileName: { not: null } },
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

  private failRead(meta: ImportMeta, fileSha256: string, message: string) {
    return this.importer.recordReadFailure('tsb', { ...meta, fileSha256 }, message);
  }
}
