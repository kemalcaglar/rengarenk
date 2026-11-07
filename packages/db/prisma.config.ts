import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Kök dizindeki .env dosyası (yerel geliştirme). Canlıda değişkenler ortamdan gelir.
if (existsSync('../../.env')) process.loadEnvFile('../../.env');

// `prisma generate` veritabanına bağlanmaz; Docker imaj derlemesinde DATABASE_URL yoktur. Yer tutucu
// yalnızca bu adım içindir: göç (`migrate deploy`) gerçek adres olmadan "derleme-yer-tutucu" sunucusuna
// bağlanamaz ve durur.
const url = process.env.DATABASE_URL ?? 'postgresql://derleme-yer-tutucu:5432/yok';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node dist/seed.js' },
  datasource: { url },
});
