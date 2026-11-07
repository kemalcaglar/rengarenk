import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPrismaClient, uuidv7 } from '@rengarenk/db';
import { parseLegalDrafts } from '../consents/legal-drafts.js';

/**
 * Yasal metin taslaklarını (docs/kapsam/06-yasal-metin-taslaklari.md) sürümlü olarak yükler (Karar 46). Metin
 * değiştiyse yeni taslak sürüm açılır; yayınlanmış sürüm değişmez. Yayın konsoldan, sahip onayıyla yapılır.
 *
 *   pnpm --filter @rengarenk/api yasal:yukle            (depodaki taslak dosya)
 *   pnpm --filter @rengarenk/api yasal:yukle <dosya.md>
 */
const file = resolve(process.argv[2] ?? '../../docs/kapsam/06-yasal-metin-taslaklari.md');
const drafts = parseLegalDrafts(readFileSync(file, 'utf8'));

const db = createPrismaClient();
try {
  for (const d of drafts) {
    const last = await db.consentText.findFirst({ where: { key: d.key }, orderBy: { version: 'desc' } });
    if (last && last.body === d.body && last.title === d.title) {
      console.log(`${d.key}: değişmedi (s.${last.version})`);
      continue;
    }
    const version = (last?.version ?? 0) + 1;
    await db.consentText.create({
      data: { id: uuidv7(), key: d.key, version, title: d.title, body: d.body, status: 'taslak' },
    });
    console.log(`${d.key}: s.${version} taslak eklendi`);
  }
} finally {
  await db.$disconnect();
}
