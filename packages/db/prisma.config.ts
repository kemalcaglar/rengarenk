import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

// Kök dizindeki .env dosyası (yerel geliştirme). Canlıda değişkenler ortamdan gelir.
if (existsSync('../../.env')) process.loadEnvFile('../../.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node dist/seed.js' },
  datasource: { url: env('DATABASE_URL') },
});
