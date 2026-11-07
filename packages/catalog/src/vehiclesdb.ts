import type { VehicleCategorySlug } from '@rengarenk/shared';
import { strFromU8 } from 'fflate';
import { parseCsv } from './csv.js';
import type { CatalogSnapshot } from './snapshot.js';
import type { ParsedVariant } from './tsb/parse.js';

/**
 * VehiclesDB (github.com/vehiclesdb/vehiclesdb, CC BY 4.0): 14 ülkenin resmî tescil kayıtlarından uzlaştırılmış marka
 * ve model listesi. TSB'nin kapsamadığı ya da az kapsadığı türleri tamamlar: motosiklet, moped, kamyon, otobüs, van
 * (Teknik tasarım §5). Otomobil alınmaz (TSB ve vehicle-makes-models yıllarıyla kapsıyor). Kaynakta model yılı
 * yoktur; kayıtlar yılsız girer. Atıf zorunludur: sitedeki "Veri kaynakları" sayfası kaynak notlarını gösterir.
 */
export const VEHICLESDB_PARSER = '2026-11-08';

/** Kaynağın türü → katalog kategorisi (Karar 19 sözlüğü) */
const KIND: Record<string, VehicleCategorySlug> = {
  motorcycle: 'motosiklet',
  moped: 'motosiklet',
  truck: 'ticari',
  bus: 'ticari',
  van: 'minivan-panelvan',
};

/** Ticari türlerde model adı seri olarak da kullanılır (TSB'de Actros, Sprinter seri katmanındadır). */
const WITH_SERIES = new Set(['truck', 'bus', 'van']);

const BODY: Record<string, string> = { truck: 'Kamyon', bus: 'Otobüs', van: 'Van' };

export function buildVehiclesDbSnapshot(
  file: Uint8Array,
  opts: { version: string; now?: Date },
): CatalogSnapshot {
  const rows = parseCsv(strFromU8(file));
  if (!rows[0] || !('kind' in rows[0]) || !('model_name' in rows[0]) || !('make_name' in rows[0])) {
    throw new Error('vehicles.csv biçimi tanınmadı (kind, make_name, model_name sütunları yok)');
  }
  const items: ParsedVariant[] = [];
  let outOfScope = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    const category = KIND[r.kind ?? ''];
    const make = (r.make_name ?? '').trim();
    const model = (r.model_name ?? '').trim();
    if (!category || !make || !model) {
      outOfScope++;
      continue;
    }
    // Kaynağın kalıcı kimliği: tür + marka + model kısaltması
    const sourceKey = `${r.kind}/${r.make_slug}/${r.model_slug}`;
    if (seen.has(sourceKey)) continue;
    seen.add(sourceKey);
    const trike = (r.body_types ?? '').split('|').includes('trike');
    items.push({
      source: 'vehiclesdb',
      sourceKey,
      make,
      series: WITH_SERIES.has(r.kind as string) ? model : null,
      model,
      categories: [category],
      body: trike ? 'Üç tekerlekli' : (BODY[r.kind as string] ?? null),
      engineL: null,
      powerHp: null,
      powerKw: null,
      fuel: null,
      gearbox: null,
      drive: null,
      facelift: false,
      trim: null,
      years: [],
      raw: `${r.make_name} ${r.model_name} · ${r.kind} · ${r.countries}`,
      confidence: 'orta',
    });
  }
  return {
    format: 1,
    source: 'vehiclesdb',
    version: opts.version,
    parser: VEHICLESDB_PARSER,
    periodLabel: `VehiclesDB ${opts.version}`,
    generatedAt: (opts.now ?? new Date()).toISOString(),
    items,
    stats: {
      rows: rows.length,
      items: items.length,
      outOfScope,
      confidence: { yuksek: 0, orta: items.length, dusuk: 0 },
      makes: new Set(items.map((i) => i.make)).size,
    },
  };
}
