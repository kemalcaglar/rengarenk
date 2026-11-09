import 'reflect-metadata';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';
import pg from 'pg';
import { beforeAll } from 'vitest';

// Testler ayrı bir veritabanında, her dosyadan önce şema sıfırlanarak çalışır.
const url = process.env.TEST_DATABASE_URL ?? 'postgresql://rengarenk:rengarenk@localhost:5433/rengarenk_test';
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: url,
  JWT_SECRET: 'test-icin-en-az-otuz-iki-karakterlik-gizli-anahtar',
  SMS_PROVIDER: 'test',
  STAFF_AUTH_PROVIDER: 'fake',
  STAFF_EMAIL_DOMAINS: 'rengarenk.com.tr',
  STAFF_SECRET_KEY: 'test-icin-yonetim-sirlarini-sifreleyen-anahtar',
  REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15',
  OPENSEARCH_URL: process.env.TEST_OPENSEARCH_URL ?? 'http://localhost:9200',
  OPENSEARCH_PREFIX: 'rrtest',
  GALLERY_VERIFY_PROVIDER: 'fake',
  EIDS_PROVIDER: 'fake',
  PAYMENT_PROVIDER: 'fake',
  EARSIV_PROVIDER: 'fake',
  STORE_PROVIDER: 'fake',
  EMAIL_PROVIDER: 'memory',
  PUSH_PROVIDER: 'fake',
  AI_PROVIDER: 'fake',
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
  const r = new Redis(process.env.REDIS_URL as string);
  await r.flushdb();
  r.disconnect();
  // Test indeksleri her dosyadan önce silinir (canlı ve geliştirme indekslerine dokunulmaz)
  await fetch(`${process.env.OPENSEARCH_URL}/rrtest_*`, { method: 'DELETE' }).catch(() => undefined);
});
