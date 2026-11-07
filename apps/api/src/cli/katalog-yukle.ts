import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CatalogPipelineModule } from '../catalog/catalog.module.js';
import { CatalogAliasService } from '../catalog/catalog-alias.service.js';
import { CatalogPipelineService } from '../catalog/catalog-pipeline.service.js';
import { DatabaseModule } from '../database/database.module.js';

/**
 * TSB dosyasını komut satırından kataloğa yükler (konsoldaki yüklemeyle aynı hat: imza, kalite kontrolü, kayıt).
 * Dosya verilmezse TSB'deki en son dosyayı indirir.
 *
 *   pnpm --filter @rengarenk/api katalog:yukle C:\yol\202610R2.xlsx
 *   pnpm --filter @rengarenk/api katalog:yukle            (TSB'den en son dosya)
 *   pnpm --filter @rengarenk/api katalog:yukle --arsiv    (TSB arşivi: eski model yılları, 2020'den beri)
 *   pnpm --filter @rengarenk/api katalog:yukle --vmm      (vehicle-makes-models: 1985–2005 yılları)
 *   pnpm --filter @rengarenk/api katalog:yukle --yerli    (Türkiye'ye özgü eski modeller, kaynaklı liste)
 *   pnpm --filter @rengarenk/api katalog:yukle --wikidata (nesil kodları ve yılları: Wikidata, Vikipedi)
 *   pnpm --filter @rengarenk/api katalog:yukle --oneri    (ad eşleme önerilerini yeniden üret)
 */
@Module({ imports: [DatabaseModule, CatalogPipelineModule] })
class CliModule {}

const arg = process.argv[2];
const archive = arg === '--arsiv';
const vmm = arg === '--vmm';
const yerli = arg === '--yerli';
const wikidata = arg === '--wikidata';
const oneri = arg === '--oneri';
const file = archive || vmm || yerli || wikidata || oneri ? undefined : arg;
const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn'] });
try {
  const pipeline = app.get(CatalogPipelineService);
  const started = Date.now();
  if (oneri) {
    const aliases = app.get(CatalogAliasService);
    for (const source of ['tsb', 'vmm', 'yerli'])
      console.log(`${source}: ${await aliases.suggest(source)} yeni öneri`);
    await app.close();
    process.exit(0);
  }
  if (archive) {
    const r = await pipeline.backfillTsbArchive();
    for (const d of r.dosyalar)
      console.log(`${d.dosya}: ${d.durum}${d.yeniTip !== undefined ? ` · ${d.yeniTip} yeni tip` : ''}`);
    console.log(`Arşiv tamam · ${((Date.now() - started) / 1000).toFixed(1)} sn`);
    await app.close();
    process.exit(0);
  }
  const result = wikidata
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
