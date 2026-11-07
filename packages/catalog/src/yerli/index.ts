import { createHash } from 'node:crypto';
import type { CatalogSnapshot } from '../snapshot.js';
import type { ParsedVariant } from '../tsb/parse.js';
import { YERLI_KLASIKLER, YERLI_SURUM, type YerliModel } from './klasikler.js';

export type { YerliKaynak, YerliModel, YerliNesil, YerliSurum } from './klasikler.js';
export { YERLI_KLASIKLER, YERLI_SURUM };

/** Kaynaklı başlangıç listesinden (Türkiye'ye özgü eski modeller) katalog anlık görüntüsü. */
export function buildYerliSnapshot(
  list: YerliModel[] = YERLI_KLASIKLER,
  opts: { version?: string; now?: Date } = {},
): CatalogSnapshot {
  const items: ParsedVariant[] = [];
  for (const m of list) {
    for (const s of m.surumler) {
      const nesil = m.nesiller?.find((n) => s.baslangic >= n.baslangic && s.baslangic <= n.bitis);
      const sourceKey = createHash('sha1')
        .update([m.marka, m.seri, s.model, s.paket ?? '', s.kasa ?? '', s.baslangic].join('|'))
        .digest('hex')
        .slice(0, 20);
      items.push({
        source: 'yerli',
        sourceKey,
        make: m.marka,
        series: m.seri,
        model: s.model,
        categories: [m.kategori],
        body: s.kasa ?? null,
        engineL: s.motorL ?? null,
        powerHp: null,
        powerKw: null,
        fuel: s.yakit ?? null,
        gearbox: null,
        drive: null,
        facelift: false,
        trim: s.paket ?? null,
        years: Array.from({ length: s.bitis - s.baslangic + 1 }, (_, i) => s.baslangic + i),
        raw: `${m.marka} ${m.seri}${s.paket ? ` ${s.paket}` : ''} · kaynak: ${m.kaynak.url} (sürüm ${m.kaynak.surum})`,
        confidence: s.motorL ? 'yuksek' : 'orta',
        ...(nesil
          ? { generation: { name: nesil.ad, startYear: nesil.baslangic, endYear: nesil.bitis } }
          : {}),
      });
    }
  }
  const confidence = { yuksek: 0, orta: 0, dusuk: 0 };
  for (const i of items) confidence[i.confidence]++;
  return {
    format: 1,
    source: 'yerli',
    version: opts.version ?? YERLI_SURUM,
    periodLabel: `Yerli klasikler ${opts.version ?? YERLI_SURUM}`,
    generatedAt: (opts.now ?? new Date()).toISOString(),
    items,
    stats: {
      rows: items.length,
      items: items.length,
      outOfScope: 0,
      confidence,
      makes: new Set(items.map((i) => i.make)).size,
    },
  };
}
