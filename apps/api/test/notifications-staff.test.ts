import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENV, type Env } from '../src/config/env.js';
import { ConsentService } from '../src/consents/consent.service.js';
import type { Db } from '../src/database/prisma.js';
import { AutomationService } from '../src/notifications/automations.js';
import { FakePush, MemoryEmail } from '../src/notifications/channels.js';
import { DeliveryService } from '../src/notifications/delivery.service.js';
import { NotificationService } from '../src/notifications/notification.service.js';
import { NotificationEvents } from '../src/notifications/notification-events.js';
import { ReputationService } from '../src/notifications/reputation.js';
import { SwitchService } from '../src/notifications/switches.js';
import { TemplatesService } from '../src/notifications/templates.service.js';
import { DemandSearchService } from '../src/search/demand-search.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;
let eposta: MemoryEmail;
let teslim: DeliveryService;
let sahip: string;
let destek: string;
let sahipEposta: string;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
  eposta = new MemoryEmail();
  teslim = new DeliveryService(
    db,
    app.get<Env>(ENV),
    eposta,
    new FakePush(),
    sms,
    app.get(TemplatesService),
    app.get(SwitchService),
  );
  const s = await createStaff(db, 'OWNER');
  sahipEposta = s.email;
  sahip = (await loginAs(app, s)).token;
  destek = (await loginAs(app, await createStaff(db, 'SUPPORT'))).token;
});
afterAll(() => app.close());

async function login(phone: string) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  const userId = (await db.user.findUniqueOrThrow({ where: { phone } })).id;
  return { token: v.body.accessToken as string, userId };
}

describe('konsol: şablonlar, bildirim merkezi, teslim raporu, otomatik akışlar (Karar 48–51)', () => {
  it('şablonun yeni sürümü: bilinmeyen değişken reddedilir; önizleme; kendime test; yalnızca yetkili kaydeder', async () => {
    const l = await staffCall(app, 'GET', '/staff/notifications/templates', undefined, sahip);
    expect(l.body.find((t: { key: string }) => t.key === 'talep.suresi_doluyor')).toMatchObject({
      tur: 'İşlemsel',
      surum: 0,
      kanallar: ['uygulama içi', 'push', 'e-posta', 'SMS'],
    });
    const t = await staffCall(
      app,
      'GET',
      '/staff/notifications/templates/talep.suresi_doluyor',
      undefined,
      sahip,
    );
    expect(t.body.degiskenler).toEqual(expect.arrayContaining(['gun', 'talep', 'yazan']));

    const icerik = {
      ...t.body.icerik,
      baslik: 'Talebinin bitmesine {{gun}} gün var',
    };
    const yanlis = await staffCall(
      app,
      'POST',
      '/staff/notifications/templates/talep.suresi_doluyor/preview',
      { icerik: { ...icerik, metin: '{{tutar}} öde' } },
      sahip,
    );
    expect(yanlis.status).toBe(400);
    const o = await staffCall(
      app,
      'POST',
      '/staff/notifications/templates/talep.suresi_doluyor/preview',
      { icerik },
      sahip,
    );
    expect(o.body.uygulama.baslik).toBe('Talebinin bitmesine 3 gün var');
    expect(o.body.eposta.html).toContain('Taleplerime git');
    expect(o.body.sms.metin).toContain('yarin doluyor');

    expect(
      (await staffCall(app, 'POST', '/staff/notifications/templates/talep.suresi_doluyor', icerik, destek))
        .status,
    ).toBe(403);
    const k = await staffCall(
      app,
      'POST',
      '/staff/notifications/templates/talep.suresi_doluyor',
      icerik,
      sahip,
    );
    expect(k.body.surum).toBe(1);
    expect((await app.get(TemplatesService).get('talep.suresi_doluyor')).sablon.baslik).toBe(
      'Talebinin bitmesine {{gun}} gün var',
    );

    await staffCall(app, 'POST', '/staff/notifications/templates/talep.suresi_doluyor/test', {}, sahip);
    await teslim.dispatchDue();
    expect(eposta.sent.at(-1)).toMatchObject({
      to: sahipEposta,
      subject: '[Test] Talebin 3 gün sonra doluyor',
    });
  });

  it('bildirim merkezi ve ticari gönderimi durdurma; teslim raporu', async () => {
    const c = await staffCall(app, 'GET', '/staff/notifications/center', undefined, sahip);
    expect(c.body.ticariAcik).toBe(true);
    expect(c.body.saglik.map((x: { ad: string }) => x.ad)).toContain('E-posta · ticari');
    expect(
      (await staffCall(app, 'POST', '/staff/notifications/commercial', { acik: false }, destek)).status,
    ).toBe(403);
    const d = await staffCall(app, 'POST', '/staff/notifications/commercial', { acik: false }, sahip);
    expect(d.body.ticariAcik).toBe(false);

    // Durdurulunca ticari teslim bekletilir
    const u = await login('+905330001001');
    await db.user.update({
      where: { id: u.userId },
      data: { email: 'k@ornek.com', emailVerifiedAt: new Date() },
    });
    await db.$transaction((tx) => app.get(ConsentService).recordCommercial(tx, u.userId, true, 'web'));
    await call(
      app,
      'PUT',
      '/me/notification-preferences',
      { tercihler: [{ konu: 'kampanya', kanal: 'eposta', acik: true }] },
      u.token,
    );
    await app.get(NotificationService).notify({
      userIds: [u.userId],
      sablon: 'kampanya.duyuru',
      veri: { baslik: 'Duyuru', metin: 'Yeni özellik', url: '/', dugme: 'Bak' },
    });
    await db.delivery.updateMany({
      where: { userId: u.userId },
      data: { dueAt: new Date(Date.now() - 1000) },
    });
    await teslim.dispatchDue();
    const bekleyen = await db.delivery.findFirstOrThrow({ where: { userId: u.userId, ticari: true } });
    expect(bekleyen).toMatchObject({ durum: 'bekliyor', neden: 'Ticari gönderim durduruldu; bekletiliyor' });
    await staffCall(app, 'POST', '/staff/notifications/commercial', { acik: true }, sahip);

    const r = await staffCall(app, 'GET', '/staff/notifications/report', undefined, sahip);
    expect(r.body.kanallar).toHaveLength(5);
    expect(Array.isArray(r.body.sablonlar)).toBe(true);
  });

  it('itibar: şikâyet oranı sınırı aşınca ajan ticari e-postayı durdurur; az gönderimde karar vermez', async () => {
    const itibar = app.get(ReputationService);
    const { userId } = await login('+905330003001');
    const gonder = (n: number) =>
      db.delivery.createMany({
        data: Array.from({ length: n }, () => ({
          id: uuidv7(),
          userId,
          kanal: 'eposta',
          sablon: 'kampanya.duyuru',
          sablonSurum: 0,
          ticari: true,
          durum: 'gonderildi',
          sentAt: new Date(),
        })),
      });
    await db.emailSuppression.create({
      data: { email: 'sikayet@ornek.com', reason: 'sikayet', onlyCommercial: true },
    });
    await gonder(50);
    expect(await itibar.denetle()).toBeNull(); // 200'den az ticari gönderim
    await gonder(200);
    expect(await itibar.denetle()).toMatch(/Spam şikâyeti/);
    const c = await staffCall(app, 'GET', '/staff/notifications/center', undefined, sahip);
    expect(c.body.ticariAcik).toBe(false);
    expect(c.body.itibar.sikayet).toBeGreaterThan(0.001);
    expect(await db.auditLog.count({ where: { action: 'ticari_gonderim_durdu', actorType: 'AGENT' } })).toBe(
      1,
    );
    expect(await db.outboxEvent.count({ where: { type: 'bildirim.ticari_durduruldu' } })).toBe(1);
    await staffCall(app, 'POST', '/staff/notifications/commercial', { acik: true }, sahip);
    await db.emailSuppression.delete({ where: { email: 'sikayet@ornek.com' } });
  });

  it('otomatik akışlar: kapalı akışın iletisi gitmez; hoş geldin ve ilk talep akışı', async () => {
    const a = await staffCall(app, 'GET', '/staff/notifications/automations', undefined, sahip);
    expect(a.body.map((x: { key: string }) => x.key)).toEqual([
      'hosgeldin',
      'ilk_talep',
      'doluyor',
      'okumadin',
      'galeri7',
      'deneme',
      'odeme',
    ]);
    expect(a.body.find((x: { key: string }) => x.key === 'okumadin').acik).toBe(false);

    const ns = app.get(NotificationService);
    const u = await login('+905330002001');
    await staffCall(app, 'POST', '/staff/notifications/automations/doluyor', { acik: false }, sahip);
    expect(
      await ns.notify({
        userIds: [u.userId],
        sablon: 'talep.suresi_doluyor',
        veri: { talep: 'X', gun: 3, yazan: 0 },
      }),
    ).toBe(0);
    await staffCall(app, 'POST', '/staff/notifications/automations/doluyor', { acik: true }, sahip);
    expect(
      await ns.notify({
        userIds: [u.userId],
        sablon: 'talep.suresi_doluyor',
        veri: { talep: 'X', gun: 3, yazan: 0 },
      }),
    ).toBe(1);

    // Hoş geldin: kayıt olayıyla
    const olaylar = new NotificationEvents(db, ns, app.get(DemandSearchService));
    await olaylar.handle('kullanici.kaydoldu', { userId: u.userId });
    const l = await call(app, 'GET', '/notifications', undefined, u.token);
    expect(l.body.bildirimler.map((b: { baslik: string }) => b.baslik)).toContain('Rengarenk’e hoş geldin');

    // İlk talebini oluştur: üyeliğin 3. günü, talep yok, ticari onay var
    const yeni = await login('+905330002002');
    await db.user.update({
      where: { id: yeni.userId },
      data: { createdAt: new Date(Date.now() - 3.5 * 86_400_000) },
    });
    await db.$transaction((tx) => app.get(ConsentService).recordCommercial(tx, yeni.userId, true, 'web'));
    await call(
      app,
      'PUT',
      '/me/notification-preferences',
      { tercihler: [{ konu: 'kampanya', kanal: 'uygulama', acik: true }] },
      yeni.token,
    );
    const akis = new AutomationService(db, ns, app.get(SwitchService));
    const r = await akis.runDaily();
    expect(r.ilk_talep).toBe(1);
    expect(await akis.runDaily()).toMatchObject({ ilk_talep: 0 }); // bir kez
    expect(await db.notification.count({ where: { userId: yeni.userId, sablon: 'akis.ilk_talep' } })).toBe(1);
  });
});
