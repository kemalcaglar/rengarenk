import { describe, expect, it } from 'vitest';
import { qualityCheck } from '../snapshot.js';
import { buildYerliSnapshot, YERLI_KLASIKLER } from './index.js';

describe('yerli klasikler: kaynaklı başlangıç listesi', () => {
  it('her model Vikipedi maddesine ve sürümüne bağlı; yıllar tutarlı', () => {
    for (const m of YERLI_KLASIKLER) {
      expect(m.kaynak.url).toMatch(/^https:\/\/tr\.wikipedia\.org\/wiki\//);
      expect(m.kaynak.surum).toBeGreaterThan(0);
      for (const s of m.surumler) {
        expect(s.baslangic).toBeGreaterThanOrEqual(1960);
        expect(s.bitis).toBeGreaterThanOrEqual(s.baslangic);
        expect(s.bitis).toBeLessThanOrEqual(2005);
      }
    }
  });

  it('katalog tiplerine çevrilir; kimlikler tekil, kalite kontrolünü geçer', () => {
    const snap = buildYerliSnapshot();
    expect(snap.source).toBe('yerli');
    const keys = snap.items.map((i) => i.sourceKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(qualityCheck(snap).ok).toBe(true);

    const sahinS = snap.items.find((i) => i.series === 'Şahin' && i.trim === 'S');
    expect(sahinS).toMatchObject({
      make: 'Tofaş',
      model: '1.6',
      body: 'Sedan',
      years: [1995, 1996, 1997, 1998, 1999],
      generation: { name: 'İkinci nesil', startYear: 1988, endYear: 2002 },
    });
    expect(sahinS?.raw).toContain('tr.wikipedia.org');
    expect(snap.items.find((i) => i.series === 'Kartal' && i.trim === 'Kargo')?.body).toBe('Panelvan');
    expect(snap.items.find((i) => i.series === 'Kamyonet')?.categories).toEqual(['ticari']);
    expect(snap.items.filter((i) => i.make === 'Anadol').map((i) => i.years[0])).toContain(1967);
  });

  it('aynı listeden üretilen kimlikler sürümler arasında sabittir', () => {
    expect(buildYerliSnapshot(undefined, { version: 'a' }).items.map((i) => i.sourceKey)).toEqual(
      buildYerliSnapshot(undefined, { version: 'b' }).items.map((i) => i.sourceKey),
    );
  });
});
