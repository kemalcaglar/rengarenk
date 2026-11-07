import 'reflect-metadata';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { beforeAll } from 'vitest';

// Testler ayrı bir veritabanında, her dosyadan önce şema sıfırlanarak çalışır.
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://rengarenk:rengarenk@localhost:5432/rengarenk_test';
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: url,
  JWT_SECRET: 'test-icin-en-az-otuz-iki-karakterlik-gizli-anahtar',
  SMS_PROVIDER: 'test',
});

const migrations = join(dirname(fileURLToPath(import.meta.url)), '../../../packages/db/prisma/migrations');

beforeAll(async () => {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query(
    'DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS pgboss CASCADE; CREATE SCHEMA public;',
  );
  for (const dir of readdirSync(migrations)
    .filter((d) => /^\d+_/.test(d))
    .sort()) {
    await c.query(readFileSync(join(migrations, dir, 'migration.sql'), 'utf8'));
  }
  await c.end();
});
