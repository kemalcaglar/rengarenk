import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Canlı imaj `pnpm deploy --prod` ile yalnızca `dependencies`'i taşır. Kaynak kodun içe aktardığı bir paket
 * yalnızca `devDependencies`'teyse yerelde ve testte çalışır, canlıda açılmaz (12 Kasım 2026, fflate).
 */
const kok = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pkg = JSON.parse(readFileSync(join(kok, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
};

function dosyalar(dizin: string): string[] {
  return readdirSync(dizin).flatMap((ad) => {
    const yol = join(dizin, ad);
    if (statSync(yol).isDirectory()) return dosyalar(yol);
    return ad.endsWith('.ts') && !ad.endsWith('.test.ts') ? [yol] : [];
  });
}

const paketAdi = (s: string) => (s.startsWith('@') ? s.split('/').slice(0, 2).join('/') : s.split('/')[0]);

describe('çalışma zamanı bağımlılıkları', () => {
  it('src altında içe aktarılan her paket dependencies içinde', () => {
    const eksik = new Set<string>();
    const ice =
      /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"]([^.'"][^'"]*)['"]|import\(\s*['"]([^.'"][^'"]*)['"]\s*\)/g;
    for (const dosya of dosyalar(join(kok, 'src'))) {
      const metin = readFileSync(dosya, 'utf8');
      for (const m of metin.matchAll(ice)) {
        const ad = m[1] ?? m[2];
        if (!ad || ad.startsWith('node:')) continue;
        if (/^import\s+type\s/.test(m[0].trim())) continue;
        const p = paketAdi(ad);
        if (p && !(p in pkg.dependencies)) eksik.add(p);
      }
    }
    expect([...eksik]).toEqual([]);
  });
});
