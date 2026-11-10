import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { SystemHealthService } from '../src/health/system-health.service.js';
import { istekKaydet, istekOzeti, redisHazir } from '../src/observability/request-stats.js';
import { REDIS } from '../src/redis/redis.module.js';
import { createTestApp } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
});
afterAll(() => app.close());

describe('Sistem sağlığı ve yedek (YonetimSistem.dc.html › saglik; Karar 56)', () => {
  it('istek özeti: sayı, 5xx oranı ve p95 dilimi', async () => {
    const redis = app.get<Redis>(REDIS);
    const t = new Date('2026-11-10T08:00:00Z');
    await redisHazir(redis);
    await redis.del(`saglik:istek:${t.toISOString().slice(0, 16).replace(/[-:T]/g, '')}`);
    for (let i = 0; i < 18; i++) await istekKaydet(redis, 200, 40, t);
    await istekKaydet(redis, 500, 30, t);
    await istekKaydet(redis, 200, 900, t);
    const o = await istekOzeti(redis, new Date(t.getTime() + 30_000), 1);
    expect(o).toMatchObject({ istek: 20, hata: 1, oran: 0.05, p95: 50 });
  });

  it('yoklama kaydedilir; konsolda ölçüler, servisler ve yedek; geri yükleme testi bir kez istenir', async () => {
    const h = app.get(SystemHealthService);
    const r = await h.yokla();
    expect(r.veritabani.ok).toBe(true);
    expect(r.onbellek.ok).toBe(true);
    // Test veritabanında pg-boss kurulu değil (işçi yok): yoklama bunu açıkça söyler
    expect(r.kuyruk.not).toMatch(/iş bekliyor$|pg-boss kurulmamış/);
    expect(await db.healthSample.count()).toBe(1);

    const sahip = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
    const finans = (await loginAs(app, await createStaff(db, 'FINANCE'))).token;
    expect((await staffCall(app, 'GET', '/staff/system-health', undefined, finans)).status).toBe(403);
    const o = (await staffCall(app, 'GET', '/staff/system-health', undefined, sahip)).body;
    expect(o.olcu.map((x: { ad: string }) => x.ad)).toEqual([
      'Çalışma süresi',
      'Hata oranı',
      'Yanıt süresi (p95)',
      'Kuyruk',
    ]);
    expect(o.servisler).toHaveLength(8);
    expect(o.servisler.find((s: { key: string }) => s.key === 'veritabani')).toMatchObject({
      ad: 'Veritabanı (PostgreSQL)',
      durum: 'iyi',
    });
    expect(o.yedekler[0]).toMatchObject({
      ad: 'Son tam yedek',
      deger: expect.stringContaining('Sunucu kurulunca'),
    });

    // Sunucudaki yedekleme betiği yazar; konsol gösterir
    await db.backupRun.create({
      data: {
        id: '01900000-0000-7000-8000-0000000000b1',
        kind: 'tam',
        status: 'basarili',
        sizeBytes: 28n * 1024n ** 3n,
        location: 'İkinci veri merkezi · Türkiye',
        finishedAt: new Date(),
      },
    });
    const y = (await staffCall(app, 'GET', '/staff/system-health', undefined, sahip)).body.yedekler;
    expect(y[0].deger).toContain('28 GB');
    expect(y[2].deger).toBe('İkinci veri merkezi · Türkiye');

    expect((await staffCall(app, 'POST', '/staff/system-health/restore-test', {}, sahip)).status).toBe(201);
    expect((await staffCall(app, 'POST', '/staff/system-health/restore-test', {}, sahip)).status).toBe(409);
    const son = (await staffCall(app, 'GET', '/staff/system-health', undefined, sahip)).body;
    expect(son.testBekliyor).toBe(true);
    expect(son.yedekler[4].deger).toContain('İstendi');
  });
});
