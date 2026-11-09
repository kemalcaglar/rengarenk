import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { rolloutBucket } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { StaffAlertService } from '../src/staff-alerts/staff-alert.service.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
});
afterAll(() => app.close());

async function login(phone: string) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  const u = await db.user.findUniqueOrThrow({ where: { phone } });
  return { token: v.body.accessToken as string, id: u.id };
}

const olay = (token: string, tur: 'gorus' | 'gecis', platform = 'WEB') =>
  app.inject({
    method: 'POST',
    url: '/flags/deney/butce_b',
    payload: { tur },
    headers: { authorization: `Bearer ${token}`, 'x-rr-platform': platform },
  });
const bayraklar = async (token: string) =>
  (
    await app.inject({
      method: 'GET',
      url: '/flags',
      headers: { authorization: `Bearer ${token}`, 'x-rr-platform': 'WEB' },
    })
  ).json() as { flags: Record<string, boolean> };

describe('arayüz deneyleri (Karar 44)', () => {
  it('anahtar yüzdesiyle dönem açılır; kola göre görüş ve geçiş; kazanan herkese açılınca dönem biter', async () => {
    const sahip = await loginAs(app, await createStaff(db, 'OWNER'));
    // Başlangıçta iki kutu (B) herkese açık; deney yok
    const f0 = await db.featureFlag.findUniqueOrThrow({ where: { key: 'butce_b' } });
    expect(f0).toMatchObject({ enabled: true, percent: 100 });
    expect(await db.uiExperimentRun.count()).toBe(0);

    await staffCall(app, 'PATCH', '/staff/flags/butce_b', { percent: 50 }, sahip.token);
    const run = await db.uiExperimentRun.findFirstOrThrow({ where: { flagKey: 'butce_b', endedAt: null } });
    expect(run.percent).toBe(50);

    // Her koldan bir üye: B anahtarı açık görür
    const kollar: Record<'A' | 'B', { token: string; id: string } | null> = { A: null, B: null };
    for (let i = 0; !(kollar.A && kollar.B); i++) {
      const u = await login(`+90537200${String(i).padStart(4, '0')}`);
      kollar[rolloutBucket('butce_b', u.id) < 50 ? 'B' : 'A'] ??= u;
    }
    const a = kollar.A as { token: string; id: string };
    const b = kollar.B as { token: string; id: string };
    expect((await bayraklar(b.token)).flags.butce_b).toBe(true);
    expect((await bayraklar(a.token)).flags.butce_b).toBe(false);

    // Olaylar: yalnızca web; görüş bir kez, geçiş işaretlenir; girişsiz 401
    expect((await olay(a.token, 'gorus')).statusCode).toBe(204);
    expect((await olay(a.token, 'gorus')).statusCode).toBe(204);
    expect((await olay(b.token, 'gorus', 'IOS')).statusCode).toBe(204);
    expect(
      (await app.inject({ method: 'POST', url: '/flags/deney/butce_b', payload: { tur: 'gorus' } }))
        .statusCode,
    ).toBe(401);
    await olay(b.token, 'gecis');
    const satirlar = await db.uiExperimentEvent.findMany({ where: { runId: run.id } });
    expect(satirlar).toHaveLength(2);
    expect(satirlar.find((s) => s.userId === a.id)).toMatchObject({ arm: 'A', passedAt: null });
    expect(satirlar.find((s) => s.userId === b.id)?.arm).toBe('B');
    expect(satirlar.find((s) => s.userId === b.id)?.passedAt).not.toBeNull();

    // Sentetik görenler: A'da %50, B'de %70 geçiyor
    const users = Array.from({ length: 300 }, (_, i) => ({
      id: uuidv7(),
      phone: `+90536${String(i).padStart(7, '0')}`,
    }));
    await db.user.createMany({ data: users });
    const say = { A: 0, B: 0 };
    await db.uiExperimentEvent.createMany({
      data: users.map((u) => {
        const arm = rolloutBucket('butce_b', u.id) < 50 ? 'B' : 'A';
        say[arm]++;
        const gecti = arm === 'A' ? say[arm] % 2 === 0 : say[arm] % 10 < 7;
        return { runId: run.id, userId: u.id, arm, passedAt: gecti ? new Date() : null };
      }),
    });
    const kart = async () =>
      (await staffCall(app, 'GET', '/staff/reports/deney', undefined, sahip.token)).body.deneyler.find(
        (d: { id: string }) => d.id === run.id,
      );
    const k = await kart();
    expect(k).toMatchObject({
      tur: 'arayuz',
      anahtar: 'butce_b',
      ad: 'Sihirbaz bütçe adımı: kaydırıcı mı, iki kutu mu?',
      durum: 'Sonuç hazır',
      kazanan: 'B',
      eylem: { kol: 'B', yazi: 'B’yi herkese aç' },
    });
    expect(k.kollar.map((x: { ad: string }) => x.ad)).toEqual([
      'A · kaydırıcı (şu anki)',
      'B · en az / en çok iki kutu',
    ]);
    expect(k.olcu).toMatch(/^Ölçü: bütçe adımını geçen kullanıcı oranı · 1 gün · \d+ kişi$/);
    expect(await app.get(StaffAlertService).deneySonuc()).toBeGreaterThan(0);

    // Kaybeden kol seçilemez; B herkese açılır, dönem kazananla biter
    expect((await staffCall(app, 'POST', '/staff/flags/butce_b/deney/A', {}, sahip.token)).status).toBe(409);
    expect((await staffCall(app, 'POST', '/staff/flags/butce_b/deney/B', {}, sahip.token)).status).toBe(200);
    expect(await db.featureFlag.findUniqueOrThrow({ where: { key: 'butce_b' } })).toMatchObject({
      percent: 100,
    });
    expect(await db.uiExperimentRun.findUniqueOrThrow({ where: { id: run.id } })).toMatchObject({
      winner: 'B',
    });
    const son = await kart();
    expect(son).toMatchObject({ durum: 'Tamamlandı', eylem: null });
    expect(son.sonuc).toContain('B herkese açıldı');
    expect((await bayraklar(a.token)).flags.butce_b).toBe(true);
    // Deney bitince olay yok sayılır
    await olay(a.token, 'gecis');
    expect(
      (
        await db.uiExperimentEvent.findUniqueOrThrow({
          where: { runId_userId: { runId: run.id, userId: a.id } },
        })
      ).passedAt,
    ).toBeNull();

    // Anahtar kapanırsa açık dönem A ile biter
    await staffCall(app, 'PATCH', '/staff/flags/butce_b', { percent: 30 }, sahip.token);
    await staffCall(app, 'PATCH', '/staff/flags/butce_b', { enabled: false }, sahip.token);
    const ikinci = await db.uiExperimentRun.findFirstOrThrow({ where: { percent: 30 } });
    expect(ikinci.winner).toBe('A');
    expect(ikinci.endedAt).not.toBeNull();
  });
});
