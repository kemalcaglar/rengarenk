import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { rolloutBucket } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { FeatureFlagService } from '../src/flags/feature-flag.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;
let sms: MemorySmsSender;
let flags: FeatureFlagService;
let owner: string;

beforeAll(async () => {
  ({ app, db, sms } = await createTestApp());
  flags = app.get(FeatureFlagService);
  owner = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
});
afterAll(() => app.close());

/** Telefonla giriş yapmış bir kullanıcı: erişim jetonu ve kimliği. */
async function user(phone: string) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(`+9${phone.replace(/\s/g, '')}`),
  });
  const me = await call(app, 'GET', '/auth/me', undefined, v.body.accessToken);
  return { token: v.body.accessToken as string, id: me.body.id as string };
}

const clientFlags = (token?: string, platform?: string) =>
  app
    .inject({
      method: 'GET',
      url: '/flags',
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(platform ? { 'x-rr-platform': platform } : {}),
      },
    })
    .then((r) => JSON.parse(r.body));

describe('özellik anahtarları (T13)', () => {
  it('tanımlı anahtarlar varsayılan olarak kapalıdır; liste yalnızca yetkiliye açıktır', async () => {
    const f = await clientFlags();
    expect(f.flags.talep_asistani).toBe(false);
    expect(f.bakim.tum).toBe(false);
    expect(f.duyuru).toBeNull();

    const list = await staffCall(app, 'GET', '/staff/flags', undefined, owner);
    expect(list.status).toBe(200);
    expect(list.body.flags.map((x: { key: string }) => x.key)).toContain('ajan');
    expect(list.body.maintenance).toHaveLength(4);

    const support = await loginAs(app, await createStaff(db, 'SUPPORT'));
    expect((await staffCall(app, 'GET', '/staff/flags', undefined, support.token)).status).toBe(403);
    expect((await staffCall(app, 'PATCH', '/staff/flags/yok', { enabled: true }, owner)).status).toBe(404);
  });

  it('açılır, kapatılır, işlem kaydına girer; platform ve kitle kuralı uygulanır', async () => {
    const r = await staffCall(
      app,
      'PATCH',
      '/staff/flags/web_push',
      { enabled: true, platforms: ['WEB'] },
      owner,
    );
    expect(r.status).toBe(200);
    expect((await clientFlags(undefined, 'WEB')).flags.web_push).toBe(true);
    expect((await clientFlags(undefined, 'IOS')).flags.web_push).toBe(false);
    expect((await clientFlags()).flags.web_push).toBe(false);

    const log = await db.auditLog.findFirstOrThrow({
      where: { action: 'ozellik_degisti', entityId: 'web_push' },
    });
    expect(log.before).toEqual({ acik: false });
    expect(log.after).toMatchObject({ acik: true, platform: ['WEB'] });

    await staffCall(app, 'PATCH', '/staff/flags/web_push', { enabled: false }, owner);
    expect((await clientFlags(undefined, 'WEB')).flags.web_push).toBe(false);
  });

  it('yalnızca deneme kullanıcılarına açılan anahtar, listedeki kullanıcıda açıktır', async () => {
    const a = await user('0532 400 00 01');
    const b = await user('0532 400 00 02');
    await staffCall(app, 'PATCH', '/staff/flags/emlak', { enabled: true, audience: 'TESTERS' }, owner);
    expect(
      (await staffCall(app, 'POST', '/staff/flags/testers', { phone: '0532 400 00 01' }, owner)).status,
    ).toBe(204);
    expect(
      (await staffCall(app, 'POST', '/staff/flags/testers', { phone: '0532 400 00 01' }, owner)).status,
    ).toBe(409);
    expect(
      (await staffCall(app, 'POST', '/staff/flags/testers', { phone: '0532 499 99 99' }, owner)).status,
    ).toBe(404);

    expect((await clientFlags(a.token)).flags.emlak).toBe(true);
    expect((await clientFlags(b.token)).flags.emlak).toBe(false);
    expect((await clientFlags()).flags.emlak).toBe(false);

    const testers = await staffCall(app, 'GET', '/staff/flags/testers', undefined, owner);
    expect(testers.body.map((t: { userId: string }) => t.userId)).toEqual([a.id]);
    expect((await staffCall(app, 'DELETE', `/staff/flags/testers/${a.id}`, undefined, owner)).status).toBe(
      204,
    );
    expect((await clientFlags(a.token)).flags.emlak).toBe(false);
  });

  it('yüzde dilimi kişiye sabittir; kurumsal kitle yalnızca kurumsal hesap üyesine açılır', async () => {
    const u = await user('0532 400 00 03');
    const bucket = rolloutBucket('butce_b', u.id);
    await staffCall(app, 'PATCH', '/staff/flags/butce_b', { enabled: true, percent: bucket + 1 }, owner);
    expect((await clientFlags(u.token)).flags.butce_b).toBe(true);
    await staffCall(app, 'PATCH', '/staff/flags/butce_b', { enabled: true, percent: bucket }, owner);
    expect((await clientFlags(u.token)).flags.butce_b).toBe(false);
    expect((await clientFlags()).flags.butce_b).toBe(false); // girişsiz kullanıcı kısmi açılışa girmez
    expect((await staffCall(app, 'PATCH', '/staff/flags/butce_b', { percent: 101 }, owner)).status).toBe(400);

    await staffCall(
      app,
      'PATCH',
      '/staff/flags/toplu_portfoy',
      { enabled: true, audience: 'BUSINESS' },
      owner,
    );
    expect((await clientFlags(u.token)).flags.toplu_portfoy).toBe(false);
    await db.account.create({
      data: {
        id: uuidv7(),
        kind: 'BUSINESS',
        name: 'Galeri',
        businessKind: 'DEALER',
        members: { create: { userId: u.id, role: 'OWNER' } },
      },
    });
    await flags.invalidate();
    expect((await clientFlags(u.token)).flags.toplu_portfoy).toBe(true);
  });

  it('başka sunucudan yapılan değişiklik, önbellek silinince görülür', async () => {
    await db.featureFlag.upsert({
      where: { key: 'kiralik_kategori' },
      create: { key: 'kiralik_kategori', enabled: true },
      update: { enabled: true },
    });
    await flags.invalidate();
    expect(await flags.isOn('kiralik_kategori')).toBe(true);
  });
});

describe('bakım modu', () => {
  it('tüm site bakımdayken kullanıcı uçları 503 ve duyuru döner; konsol ve sağlık açık kalır', async () => {
    const on = await staffCall(
      app,
      'PUT',
      '/staff/flags/bakim/tum',
      { enabled: true, note: 'Saat 03.00’e kadar bakımdayız.' },
      owner,
    );
    expect(on.status).toBe(200);

    const r = await call(app, 'POST', '/auth/otp/request', { phone: '0532 400 00 09' });
    expect(r.status).toBe(503);
    expect(r.body.message).toBe('Saat 03.00’e kadar bakımdayız.');
    expect((await call(app, 'GET', '/health')).status).toBe(200);
    expect((await staffCall(app, 'GET', '/staff/me', undefined, owner)).status).toBe(200);
    const f = await clientFlags();
    expect(f.bakim.tum).toBe(true);
    expect(f.duyuru).toBe('Saat 03.00’e kadar bakımdayız.');

    await staffCall(app, 'PUT', '/staff/flags/bakim/tum', { enabled: false }, owner);
    expect((await call(app, 'POST', '/auth/otp/request', { phone: '0532 400 00 09' })).status).toBe(200);
    expect(await db.auditLog.count({ where: { action: 'bakim_degisti', entityId: 'bakim.tum' } })).toBe(2);
  });

  it('alan bakımı yalnızca o alanı kapatır; duyurusuz bakım varsayılan metni kullanır', async () => {
    await staffCall(app, 'PUT', '/staff/flags/bakim/odeme', { enabled: true, note: '' }, owner);
    await expect(flags.assertAvailable('odeme')).rejects.toThrow('kısa bir bakımda');
    await expect(flags.assertAvailable('mesaj')).resolves.toBeUndefined();
    expect((await call(app, 'GET', '/health')).status).toBe(200);
    expect((await staffCall(app, 'PUT', '/staff/flags/bakim/yok', { enabled: true }, owner)).status).toBe(
      404,
    );
    await staffCall(app, 'PUT', '/staff/flags/bakim/odeme', { enabled: false }, owner);
  });
});
