import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { TSB_ESKI, tsbEskiDosyaAdi } from '@rengarenk/catalog';
import { CatalogPipelineModule } from '../catalog/catalog.module.js';
import { CatalogAliasService } from '../catalog/catalog-alias.service.js';
import { CatalogPipelineService } from '../catalog/catalog-pipeline.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { StorageModule } from '../storage/storage.service.js';

/**
 * TSB dosyasını komut satırından kataloğa yükler (konsoldaki yüklemeyle aynı hat: imza, kalite kontrolü, kayıt).
 * Dosya verilmezse TSB'deki en son dosyayı indirir.
 *
 *   pnpm --filter @rengarenk/api katalog:yukle C:\yol\202610R2.xlsx
 *   pnpm --filter @rengarenk/api katalog:yukle            (TSB'den en son dosya)
 *   pnpm --filter @rengarenk/api katalog:yukle --arsiv    (TSB arşivi: 2020'den beri TSB'den, 2006–2019 İnternet Arşivi'nden)
 *   pnpm --filter @rengarenk/api katalog:yukle --arsiv C:\klasor   (2006–2019 listeleri önceden indirilmişse:
 *                                                         klasörde TSB-2006-11.xls gibi adlarla; olmayan indirilir)
 *   pnpm --filter @rengarenk/api katalog:yukle --vmm      (vehicle-makes-models: 1985–2005 yılları)
 *   pnpm --filter @rengarenk/api katalog:yukle --yerli    (Türkiye'ye özgü eski modeller, kaynaklı liste)
 *   pnpm --filter @rengarenk/api katalog:yukle --wikidata (nesil kodları ve yılları: Wikidata, Vikipedi)
 *   pnpm --filter @rengarenk/api katalog:yukle --oneri    (ad eşleme önerilerini yeniden üret)
 *   pnpm --filter @rengarenk/api katalog:yukle --vehiclesdb (motosiklet, kamyon, otobüs, van: VehiclesDB)
 *   pnpm --filter @rengarenk/api katalog:yukle --commons  (nesil fotoğrafı adayları: Wikimedia Commons)
 *   pnpm --filter @rengarenk/api katalog:yukle --ana      (Rengarenk ana listesi: otomobil ve SUV seri ve yılları)
 *   pnpm --filter @rengarenk/api katalog:yukle --ademe    (teknik özellikler: ADEME onay verisi ve eşleştirme)
 */
@Module({ imports: [DatabaseModule, StorageModule, CatalogPipelineModule] })
class CliModule {}

const arg = process.argv[2];
const archive = arg === '--arsiv';
const vmm = arg === '--vmm';
const yerli = arg === '--yerli';
const wikidata = arg === '--wikidata';
const oneri = arg === '--oneri';
const vehiclesdb = arg === '--vehiclesdb';
const commons = arg === '--commons';
const ana = arg === '--ana';
const ademe = arg === '--ademe';
const file =
  archive || vmm || yerli || wikidata || oneri || vehiclesdb || commons || ana || ademe ? undefined : arg;
const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn'] });
try {
  const pipeline = app.get(CatalogPipelineService);
  const started = Date.now();
  if (commons || ademe) {
    const r = await pipeline.checkSource(ademe ? 'ademe' : 'commons', { force: true });
    console.log(JSON.stringify(r));
    await app.close();
    process.exit(0);
  }
  if (oneri) {
    const aliases = app.get(CatalogAliasService);
    for (const source of ['tsb', 'vmm', 'yerli'])
      console.log(`${source}: ${await aliases.suggest(source)} yeni öneri`);
    await app.close();
    process.exit(0);
  }
  if (archive) {
    const klasor = process.argv[3];
    if (klasor) {
      for (const d of TSB_ESKI) {
        const yol = join(klasor, tsbEskiDosyaAdi(d));
        if (!existsSync(yol)) continue;
        const out = await pipeline.runTsbEski(d, new Uint8Array(readFileSync(yol)));
        console.log(`${tsbEskiDosyaAdi(d)}: ${out.status.toLowerCase()} · ${out.stats.added ?? 0} yeni tip`);
      }
    }
    const r = await pipeline.backfillTsbArchive();
    for (const d of r.dosyalar)
      console.log(`${d.dosya}: ${d.durum}${d.yeniTip !== undefined ? ` · ${d.yeniTip} yeni tip` : ''}`);
    console.log(`Arşiv tamam · ${((Date.now() - started) / 1000).toFixed(1)} sn`);
    await app.close();
    process.exit(0);
  }
  const result = ana
    ? (await pipeline.checkAna({ force: true })).outcome
    : vehiclesdb
      ? (await pipeline.checkVehiclesDb({ force: true })).outcome
      : wikidata
        ? (await pipeline.checkWikidata({ force: true })).outcome
        : yerli
          ? (await pipeline.checkYerli({ force: true })).outcome
          : vmm
            ? (await pipeline.checkVmm({ force: true })).outcome
            : file
              ? await pipeline.runTsbFile(new Uint8Array(readFileSync(file)), {
                  fileName: basename(file),
                  trigger: 'elle',
                })
              : (await pipeline.checkTsb({ force: true })).outcome;
  const sure = ((Date.now() - started) / 1000).toFixed(1);
  if (!result) {
    console.log(
      'TSB’de yeni dosya yok ya da indirilemedi; ayrıntı için konsoldaki Katalog kaynakları ekranına bak.',
    );
  } else {
    console.log(`Durum: ${result.status} · sürüm ${result.version ?? '-'} · ${sure} sn`);
    console.log(
      JSON.stringify({ istatistik: result.stats, kalite: result.quality, hata: result.error }, null, 2),
    );
  }
} finally {
  await app.close();
}
