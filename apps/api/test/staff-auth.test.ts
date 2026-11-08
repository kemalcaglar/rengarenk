import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { loadEnv } from '../src/config/env.js';
import type { Db } from '../src/database/prisma.js';
import { STAFF_ACCESS, type StaffAccess } from '../src/staff/permissions.js';
import { StaffGuard } from '../src/staff/staff.guard.js';
import { base32Decode, base32Encode, currentStep, totpAt, verifyTotp } from '../src/staff/totp.js';
import { createTestApp } from './helpers.js';
import { createStaff, googleStep, loginAs, nextIp, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
});
afterAll(() => app.close());

describe('doğrulama uygulaması kodu (TOTP)', () => {
  it('RFC 6238 test vektörüyle aynı kodu üretir', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    expect(base32Decode(secret).toString()).toBe('12345678901234567890');
    // T = 59 sn → adım 1 → 8 haneli 94287082
    expect(totpAt(secret, 1, 8)).toBe('94287082');
    expect(totpAt(secret, Math.floor(1111111109 / 30), 8)).toBe('07081804');
  });

  it('bir adım kaymayı kabul eder, kullanılmış adımı ve daha eskisini reddeder', () => {
    const secret = base32Encode(Buffer.from('rengarenk-test-sirri!'));
    const now = Date.now();
    const step = currentStep(now);
    expect(verifyTotp(secret, totpAt(secret, step - 1), null, now)).toBe(step - 1);
    expect(verifyTotp(secret, totpAt(secret, step - 2), null, now)).toBeNull();
    expect(verifyTotp(secret, totpAt(secret, step), BigInt(step), now)).toBeNull();
    expect(verifyTotp(secret, '12345', null, now)).toBeNull();
  });
});

describe('yönetim girişi: Google Workspace + zorunlu 2FA (T10, Karar 40)', () => {
  it('ilk girişte doğrulama uygulaması kurulur, kurtarma kodları verilir, oturum açılır', async () => {
    const owner = await createStaff(db, 'OWNER');
    const { cb, ip } = await googleStep(app, { email: owner.email, name: 'Kemal' });
    expect(cb.status).toBe(200);
    expect(cb.body.needsSetup).toBe(true);

    // Kurulum yapılmadan kodla girilemez.
    const early = await staffCall(
      app,
      'POST',
      '/staff/auth/2fa/verify',
      { ticket: cb.body.ticket, code: '123456' },
      undefined,
      ip,
    );
    expect(early.status).toBe(400);

    const setup = await staffCall(
      app,
      'POST',
      '/staff/auth/2fa/setup',
      { ticket: cb.body.ticket },
      undefined,
      ip,
    );
    expect(setup.status).toBe(200);
    expect(setup.body.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    expect(setup.body.qrSvg).toContain('<svg');

    const v = await staffCall(
      app,
      'POST',
      '/staff/auth/2fa/verify',
      {
        ticket: cb.body.ticket,
        code: totpAt(setup.body.secret, currentStep()),
        deviceId: 'cihaz-ilk-0000000001',
      },
      undefined,
      ip,
    );
    expect(v.status).toBe(200);
    expect(v.body.sessionToken).toMatch(/^rrs_/);
    expect(v.body.recoveryCodes).toHaveLength(10);

    const me = await staffCall(app, 'GET', '/staff/me', undefined, v.body.sessionToken);
    expect(me.status).toBe(200);
    expect(me.body.roleName).toBe('Sahip');
    expect(me.body.permissions['ekip.yonet']).toBe('tam');

    const saved = await db.staffMember.findUniqueOrThrow({ where: { id: owner.id } });
    expect(saved.twoFactorEnabled).toBe(true);
    expect(saved.totpSecretEnc).not.toContain(setup.body.secret);
    expect(saved.googleSub).toBe(`fake-${owner.email}`);
    expect(await db.auditLog.count({ where: { action: 'yonetim_giris', actorId: owner.id } })).toBe(1);
    expect(await db.outboxEvent.count({ where: { type: 'calisan.yeni_cihaz' } })).toBeGreaterThan(0);

    // Bilet ikinci kez kullanılamaz.
    const again = await staffCall(
      app,
      'POST',
      '/staff/auth/2fa/verify',
      { ticket: cb.body.ticket, code: '123456' },
      undefined,
      ip,
    );
    expect(again.status).toBe(401);

    const out = await staffCall(app, 'POST', '/staff/auth/logout', undefined, v.body.sessionToken);
    expect(out.status).toBe(204);
    expect((await staffCall(app, 'GET', '/staff/me', undefined, v.body.sessionToken)).status).toBe(401);
  });

  it('2FA işareti açık ama sırrı olmayan eski hesap kuruluma yönlendirilir', async () => {
    const s = await createStaff(db, 'OWNER');
    await db.staffMember.update({ where: { id: s.id }, data: { twoFactorEnabled: true } });
    expect((await googleStep(app, { email: s.email })).cb.body.needsSetup).toBe(true);
    const { token } = await loginAs(app, s);
    expect((await staffCall(app, 'GET', '/staff/me', undefined, token)).status).toBe(200);
  });

  it('aynı kod ikinci girişte kullanılamaz; kurtarma kodu bir kez işe yarar', async () => {
    const s = await createStaff(db, 'ADMIN');
    const first = await loginAs(app, s);

    const g1 = await googleStep(app, { email: s.email });
    expect(g1.cb.body.needsSetup).toBe(false);
    const used = (await db.staffMember.findUniqueOrThrow({ where: { id: s.id } })).totpLastStep;
    const replay = await staffCall(
      app,
      'POST',
      '/staff/auth/2fa/verify',
      { ticket: g1.cb.body.ticket, code: totpAt(first.secret, Number(used)) },
      undefined,
      g1.ip,
    );
    expect(replay.status).toBe(401);

    const code = first.recoveryCodes[0] as string;
    const rc = await staffCall(
      app,
      'POST',
      '/staff/auth/2fa/verify',
      { ticket: g1.cb.body.ticket, code },
      undefined,
      g1.ip,
    );
    expect(rc.status).toBe(200);

    const g2 = await googleStep(app, { email: s.email });
    const reuse = await staffCall(
      app,
      'POST',
      '/staff/auth/2fa/verify',
      { ticket: g2.cb.body.ticket, code },
      undefined,
      g2.ip,
    );
    expect(reuse.status).toBe(401);
  });

  it('şirket dışı hesap, Workspace olmayan hesap, tanımsız ve kapalı çalışan giremez', async () => {
    expect((await googleStep(app, { email: 'biri@gmail.com' })).cb.status).toBe(403);
    expect((await googleStep(app, { email: 'yok@rengarenk.com.tr', hd: null })).cb.status).toBe(403);
    expect((await googleStep(app, { email: 'kayitsiz@rengarenk.com.tr' })).cb.status).toBe(403);
    expect(
      (await googleStep(app, { email: 'dogrulanmamis@rengarenk.com.tr', email_verified: false })).cb.status,
    ).toBe(403);
    const off = await createStaff(db, 'SUPPORT', { status: 'DISABLED' });
    expect((await googleStep(app, { email: off.email })).cb.status).toBe(403);
    const agent = await createStaff(db, 'AGENT');
    expect((await googleStep(app, { email: agent.email })).cb.status).toBe(403);
    expect(await db.auditLog.count({ where: { action: 'yonetim_giris_reddedildi' } })).toBeGreaterThanOrEqual(
      6,
    );
  });

  it('Google dönüşü tek kullanımlıktır ve bilinmeyen state reddedilir', async () => {
    const s = await createStaff(db, 'VIEWER');
    const ip = nextIp();
    const start = await staffCall(app, 'POST', '/staff/auth/google/start', undefined, undefined, ip);
    const { FakeIdentityProvider } = await import('../src/staff/identity.js');
    const body = { state: start.body.state, code: FakeIdentityProvider.code({ email: s.email }) };
    expect((await staffCall(app, 'POST', '/staff/auth/google/callback', body, undefined, ip)).status).toBe(
      200,
    );
    expect((await staffCall(app, 'POST', '/staff/auth/google/callback', body, undefined, ip)).status).toBe(
      401,
    );
    const bogus = { state: 'x'.repeat(43), code: body.code };
    expect((await staffCall(app, 'POST', '/staff/auth/google/callback', bogus, undefined, ip)).status).toBe(
      401,
    );
  });

  it('5 hatalı koddan sonra giriş adımı kilitlenir', async () => {
    const s = await createStaff(db, 'FINANCE');
    const first = await loginAs(app, s);
    const g = await googleStep(app, { email: s.email });
    for (let i = 0; i < 5; i++) {
      const r = await staffCall(
        app,
        'POST',
        '/staff/auth/2fa/verify',
        { ticket: g.cb.body.ticket, code: '000000' },
        undefined,
        g.ip,
      );
      expect(r.status).toBe(401);
    }
    const ok = await staffCall(
      app,
      'POST',
      '/staff/auth/2fa/verify',
      { ticket: g.cb.body.ticket, code: totpAt(first.secret, currentStep() + 1) },
      undefined,
      g.ip,
    );
    expect(ok.status).toBe(401);
  });

  it('30 dakika işlem yapılmazsa oturum kapanır', async () => {
    const s = await createStaff(db, 'MODERATOR');
    const { token } = await loginAs(app, s);
    expect((await staffCall(app, 'GET', '/staff/me', undefined, token)).status).toBe(200);
    await db.staffSession.updateMany({
      where: { staffId: s.id },
      data: { lastActiveAt: new Date(Date.now() - 31 * 60_000) },
    });
    const r = await staffCall(app, 'GET', '/staff/me', undefined, token);
    expect(r.status).toBe(401);
    expect(r.body.message).toContain('30 dakika');
    const session = await db.staffSession.findFirstOrThrow({ where: { staffId: s.id } });
    expect(session.revokedAt).not.toBeNull();
  });

  it('kullanıcı jetonu yönetim uçlarında geçmez', async () => {
    expect((await staffCall(app, 'GET', '/staff/me', undefined, 'eyJhbGciOiJIUzI1NiJ9.e30.x')).status).toBe(
      401,
    );
    expect((await staffCall(app, 'GET', '/staff/me')).status).toBe(401);
  });

  it('bilinen cihazdan girişte yeni cihaz bildirimi gitmez', async () => {
    const s = await createStaff(db, 'MARKETING');
    const first = await loginAs(app, s, { deviceId: 'ayni-cihaz-000000000001' });
    const count = () =>
      db.outboxEvent.count({
        where: { type: 'calisan.yeni_cihaz', payload: { path: ['staffId'], equals: s.id } },
      });
    expect(await count()).toBe(1);
    await loginAs(app, s, { secret: first.secret, stepOffset: 1, deviceId: 'ayni-cihaz-000000000001' });
    expect(await count()).toBe(1);
  });
});

describe('yönetim girişi ayarları', () => {
  const base = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'x'.repeat(32) };
  const prod = {
    ...base,
    NODE_ENV: 'production',
    SMS_PROVIDER: 'iletimerkezi',
    ILETIMERKEZI_KEY: 'k',
    ILETIMERKEZI_HASH: 'h',
    METRICS_TOKEN: 't',
    STAFF_AUTH_PROVIDER: 'google',
    GOOGLE_CLIENT_ID: 'id',
    GOOGLE_CLIENT_SECRET: 's',
    STAFF_SECRET_KEY: 'y'.repeat(32),
    MESSAGE_SECRET_KEY: 'm'.repeat(32),
    CATALOG_SIGNING_KEY: 'imza',
    CATALOG_VERIFY_KEY: 'dogrulama',
    S3_ACCESS_KEY: 'canli-erisim',
    S3_SECRET_KEY: 'z'.repeat(40),
  };

  it('canlıda sahte Google, eksik anahtar ve kapalı Workspace şartı reddedilir', () => {
    expect(() => loadEnv(prod)).not.toThrow();
    expect(() => loadEnv({ ...prod, STAFF_AUTH_PROVIDER: 'fake' })).toThrow('Google Workspace');
    expect(() => loadEnv({ ...prod, STAFF_SECRET_KEY: '' })).toThrow('STAFF_SECRET_KEY');
    expect(() => loadEnv({ ...prod, MESSAGE_SECRET_KEY: '' })).toThrow('MESSAGE_SECRET_KEY');
    expect(() => loadEnv({ ...prod, STAFF_REQUIRE_WORKSPACE: 'false' })).toThrow('Workspace şartı');
    expect(() => loadEnv({ ...prod, CATALOG_VERIFY_KEY: '' })).toThrow('CATALOG_');
    expect(() => loadEnv({ ...prod, S3_SECRET_KEY: '' })).toThrow('S3_SECRET_KEY');
  });

  it('geliştirmede birden çok alan ve kapalı Workspace şartı kabul edilir', () => {
    const e = loadEnv({
      ...base,
      STAFF_EMAIL_DOMAINS: 'rengarenk.com.tr, KGteknoloji.com.tr',
      STAFF_REQUIRE_WORKSPACE: 'false',
    });
    expect(e.STAFF_EMAIL_DOMAINS).toEqual(['rengarenk.com.tr', 'kgteknoloji.com.tr']);
    expect(e.STAFF_REQUIRE_WORKSPACE).toBe(false);
  });
});

describe('çalışanlar ve izin matrisi (Karar 40)', () => {
  it('her /staff uç noktası izin işareti taşır; açık olanlar yalnızca giriş adımlarıdır', async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule, DiscoveryModule] }).compile();
    const discovery = mod.get(DiscoveryService);
    const reflector = mod.get(Reflector);
    const scanner = mod.get(MetadataScanner);
    const routes: { route: string; access?: StaffAccess; guarded: boolean }[] = [];
    for (const wrapper of discovery.getControllers()) {
      const cls = wrapper.metatype as (new (...a: never[]) => object) | undefined;
      if (!cls) continue;
      const base = String(Reflect.getMetadata('path', cls) ?? '');
      if (!base.startsWith('staff')) continue;
      const guards = (Reflect.getMetadata('__guards__', cls) ?? []) as unknown[];
      for (const name of scanner.getAllMethodNames(cls.prototype)) {
        const handler = (cls.prototype as Record<string, unknown>)[name] as object;
        if (Reflect.getMetadata('path', handler) === undefined) continue;
        routes.push({
          route: `${base}/${Reflect.getMetadata('path', handler)}`,
          access: reflector.getAllAndOverride(STAFF_ACCESS, [handler as never, cls]),
          guarded: guards.includes(StaffGuard),
        });
      }
    }
    await mod.close();
    expect(routes.length).toBeGreaterThan(15);
    expect(routes.filter((r) => !r.access || !r.guarded)).toEqual([]);
    expect(
      routes
        .filter((r) => r.access?.kind === 'public')
        .map((r) => r.route)
        .sort(),
    ).toEqual([
      'staff/auth/2fa/setup',
      'staff/auth/2fa/verify',
      'staff/auth/google/callback',
      'staff/auth/google/start',
    ]);
  });

  it('İzleyici işlem kaydını görür ama çalışanları göremez; Yönetici çalışan yönetemez', async () => {
    const viewer = await loginAs(app, await createStaff(db, 'VIEWER'));
    expect((await staffCall(app, 'GET', '/staff/audit', undefined, viewer.token)).status).toBe(200);
    expect((await staffCall(app, 'GET', '/staff/members', undefined, viewer.token)).status).toBe(403);
    const admin = await loginAs(app, await createStaff(db, 'ADMIN'));
    expect((await staffCall(app, 'GET', '/staff/members', undefined, admin.token)).status).toBe(403);
    const audit = await staffCall(app, 'GET', '/staff/audit?filtre=yetki', undefined, admin.token);
    expect(audit.status).toBe(200);
    // Yönetici kişisel veriyi açık görür; izleyici IP adresini maskeli görür.
    const masked = await staffCall(app, 'GET', '/staff/audit', undefined, viewer.token);
    const withIp = masked.body.items.find((i: { ip: string | null }) => i.ip);
    expect(withIp.ip).toContain('•');
  });

  it('Sahip davet eder, davetli ilk girişte etkinleşir; hesabı kapatılınca oturumu düşer', async () => {
    const owner = await loginAs(app, await createStaff(db, 'OWNER'));
    const bad = await staffCall(
      app,
      'POST',
      '/staff/members',
      { email: 'x@gmail.com', name: 'Dış', role: 'SUPPORT' },
      owner.token,
    );
    expect(bad.status).toBe(400);
    const own = await staffCall(
      app,
      'POST',
      '/staff/members',
      { email: 'y@rengarenk.com.tr', name: 'İkinci', role: 'OWNER' },
      owner.token,
    );
    expect(own.status).toBe(400);

    const inv = await staffCall(
      app,
      'POST',
      '/staff/members',
      { email: 'Selin.Demir@rengarenk.com.tr', name: 'Selin Demir', role: 'SUPPORT' },
      owner.token,
    );
    expect(inv.status).toBe(201);
    expect(inv.body.status).toBe('INVITED');
    expect(inv.body.email).toBe('selin.demir@rengarenk.com.tr');

    const selin = await loginAs(app, { email: 'selin.demir@rengarenk.com.tr' });
    const me = await staffCall(app, 'GET', '/staff/me', undefined, selin.token);
    expect(me.body.roleName).toBe('Destek');
    expect((await db.staffMember.findUniqueOrThrow({ where: { id: inv.body.id } })).status).toBe('ACTIVE');

    const role = await staffCall(
      app,
      'PATCH',
      `/staff/members/${inv.body.id}/role`,
      { role: 'MODERATOR' },
      owner.token,
    );
    expect(role.status).toBe(200);
    expect((await staffCall(app, 'GET', '/staff/me', undefined, selin.token)).body.roleName).toBe(
      'Moderatör',
    );

    // Tasarımdaki davet yalnızca e-posta ve rol: ad ilk Google girişinde hesaptan gelir
    const adsiz = await staffCall(
      app,
      'POST',
      '/staff/members',
      { email: 'mert.aydin@rengarenk.com.tr', role: 'MODERATOR' },
      owner.token,
    );
    expect(adsiz.status).toBe(201);
    expect(adsiz.body.name).toBe('mert.aydin@rengarenk.com.tr');
    const g = await googleStep(app, { email: 'mert.aydin@rengarenk.com.tr', name: 'Mert Aydın' });
    expect(g.cb.body.name).toBe('Mert Aydın');
    expect((await db.staffMember.findUniqueOrThrow({ where: { id: adsiz.body.id } })).name).toBe(
      'Mert Aydın',
    );

    const off = await staffCall(app, 'POST', `/staff/members/${inv.body.id}/disable`, undefined, owner.token);
    expect(off.status).toBe(200);
    expect((await staffCall(app, 'GET', '/staff/me', undefined, selin.token)).status).toBe(401);
    expect(await db.auditLog.count({ where: { action: 'calisan_kapatildi', entityId: inv.body.id } })).toBe(
      1,
    );

    const meOwner = await staffCall(app, 'GET', '/staff/me', undefined, owner.token);
    const self = await staffCall(
      app,
      'POST',
      `/staff/members/${meOwner.body.id}/disable`,
      undefined,
      owner.token,
    );
    expect(self.status).toBe(403);
  });

  it('süresi dolan davetle girilemez', async () => {
    const s = await createStaff(db, 'SUPPORT', { status: 'INVITED' });
    await db.staffMember.update({
      where: { id: s.id },
      data: { inviteExpiresAt: new Date(Date.now() - 1000) },
    });
    expect((await googleStep(app, { email: s.email })).cb.status).toBe(403);
  });

  it('özel rol: sahibe ait yetkiler verilemez; özel rol yetkileri uç noktalarda geçerlidir', async () => {
    const owner = await loginAs(app, await createStaff(db, 'OWNER'));
    const forbidden = await staffCall(
      app,
      'POST',
      '/staff/roles',
      { name: 'Ekip lideri', permissions: { 'ekip.yonet': 'oneri' } },
      owner.token,
    );
    expect(forbidden.status).toBe(400);
    const refund = await staffCall(
      app,
      'POST',
      '/staff/roles',
      { name: 'İadeci', permissions: { iade: 'tam' } },
      owner.token,
    );
    expect(refund.status).toBe(400);

    const ok = await staffCall(
      app,
      'POST',
      '/staff/roles',
      { name: 'Katalog sorumlusu', permissions: { 'kategori.ayarla': 'tam', 'islem_kaydi.gor': 'tam' } },
      owner.token,
    );
    expect(ok.status).toBe(201);
    const dup = await staffCall(
      app,
      'POST',
      '/staff/roles',
      { name: 'Katalog sorumlusu', permissions: {} },
      owner.token,
    );
    expect(dup.status).toBe(409);

    const inv = await staffCall(
      app,
      'POST',
      '/staff/members',
      { email: 'katalog@rengarenk.com.tr', name: 'Katalog', role: 'CUSTOM', customRoleId: ok.body.id },
      owner.token,
    );
    expect(inv.status).toBe(201);
    const k = await loginAs(app, { email: 'katalog@rengarenk.com.tr' });
    const me = await staffCall(app, 'GET', '/staff/me', undefined, k.token);
    expect(me.body.roleName).toBe('Katalog sorumlusu');
    expect((await staffCall(app, 'GET', '/staff/audit', undefined, k.token)).status).toBe(200);
    expect((await staffCall(app, 'GET', '/staff/members', undefined, k.token)).status).toBe(403);

    const roles = await staffCall(app, 'GET', '/staff/roles', undefined, owner.token);
    expect(roles.body.builtin).toHaveLength(9);
    expect(roles.body.custom.find((r: { id: string }) => r.id === ok.body.id).members).toBe(1);
  });

  it('CATALOG eski rolü veritabanında atanamaz', async () => {
    await expect(createStaff(db, 'CATALOG')).rejects.toThrow();
  });
});
