import { createHmac } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { firstResponseDue, suggestAnswer } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENV, type Env } from '../src/config/env.js';
import type { Db } from '../src/database/prisma.js';
import { FakePush, MemoryEmail } from '../src/notifications/channels.js';
import { DeliveryService } from '../src/notifications/delivery.service.js';
import { NotificationService } from '../src/notifications/notification.service.js';
import { NotificationEvents } from '../src/notifications/notification-events.js';
import { SwitchService } from '../src/notifications/switches.js';
import { TemplatesService } from '../src/notifications/templates.service.js';
import { DemandSearchService } from '../src/search/demand-search.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { SupportService } from '../src/support/support.service.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

const SIR = 'test-icin-eposta-webhook-anahtari';
let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;
let destek: string;
let destek2: string;
let pazarlama: string;

beforeAll(async () => {
  process.env.EPOSTA_WEBHOOK_SECRET = SIR;
  ({ app, sms, db } = await createTestApp());
  destek = (await loginAs(app, await createStaff(db, 'SUPPORT'))).token;
  destek2 = (await loginAs(app, await createStaff(db, 'ADMIN'))).token;
  pazarlama = (await loginAs(app, await createStaff(db, 'MARKETING'))).token;
});
afterAll(() => app.close());

async function login(phone: string, ad: [string, string]) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  const token = v.body.accessToken as string;
  await call(app, 'PATCH', '/me', { firstName: ad[0], lastName: ad[1] }, token);
  const userId = (await db.user.findUniqueOrThrow({ where: { phone }, select: { id: true } })).id;
  return { token, userId };
}

const olaylar = () =>
  new NotificationEvents(
    db,
    app.get(NotificationService),
    app.get(DemandSearchService),
    app.get(SupportService),
  );

describe('destek (Karar 54)', () => {
  it('ilk yanıt süresi: mesai içinde 2 saat, mesai dışında ertesi iş günü 11.00', () => {
    // Çarşamba 10.00 İstanbul → 12.00
    expect(firstResponseDue(new Date('2026-11-11T07:00:00Z')).toISOString()).toBe('2026-11-11T09:00:00.000Z');
    // Çarşamba 17.00 → Perşembe 11.00
    expect(firstResponseDue(new Date('2026-11-11T14:00:00Z')).toISOString()).toBe('2026-11-12T08:00:00.000Z');
    // Cuma 20.00 → Pazartesi 11.00
    expect(firstResponseDue(new Date('2026-11-13T17:00:00Z')).toISOString()).toBe('2026-11-16T08:00:00.000Z');
    // Salı 07.30 → aynı gün 11.00
    expect(firstResponseDue(new Date('2026-11-10T04:30:00Z')).toISOString()).toBe('2026-11-10T08:00:00.000Z');
    expect(suggestAnswer('Talebim ne kadar süre yayında kalır? Uzatmak istiyorum')?.soru).toBe(
      'Talebim ne kadar süre yayında kalır?',
    );
  });

  it('talep açılır, destek yanıtlar ve çözer; kullanıcı bildirim alır, puan verir; telefon maskeli', async () => {
    const ayse = await login('+905331110001', ['Ayşe', 'Yılmaz']);
    const t = await call(
      app,
      'POST',
      '/support/tickets',
      {
        konu: 'odeme',
        referans: '1051877',
        metin: 'Acil etiketi aldım ama görünmüyor. Bana 0532 111 22 33 ten ulaşın.',
      },
      ayse.token,
    );
    expect(t.status).toBe(201);
    expect(t.body.numara).toMatch(/^D-2\d{4}$/);
    expect((await staffCall(app, 'GET', '/staff/support/tickets', undefined, pazarlama)).status).toBe(403);
    const q = await staffCall(app, 'GET', '/staff/support/tickets', undefined, destek);
    const s = q.body.acik.find((x: { no: string }) => x.no === t.body.numara);
    expect(s).toMatchObject({ kanal: 'Sohbet', kim: 'Ayşe Y.', etiket: 'Ödeme', oncelikli: true });
    const d = await staffCall(app, 'GET', `/staff/support/tickets/${s.id}`, undefined, destek);
    expect(d.body.mesajlar[0].metin).toContain('[numara gizlendi]');
    expect(d.body.kisi.userId).toBe(ayse.userId);
    expect(d.body.makrolar.length).toBe(4);
    // Kullanıcı kendi yazdığını açık görür
    expect(
      (await call(app, 'GET', `/support/tickets/${t.body.no}`, undefined, ayse.token)).body.mesajlar[0].metin,
    ).toContain('0532');

    // Puan çözümden önce verilemez
    expect(
      (await call(app, 'POST', `/support/tickets/${t.body.no}/rating`, { puan: 5 }, ayse.token)).status,
    ).toBe(409);
    const y = await staffCall(
      app,
      'POST',
      `/staff/support/tickets/${s.id}/reply`,
      { metin: 'Etiket önbelleğini yeniledik, şimdi görünüyor.', coz: true },
      destek,
    );
    expect(y.body.durum).toBe('cozuldu');
    const tk = await db.supportTicket.findUniqueOrThrow({ where: { id: s.id } });
    expect(tk.firstResponseAt).not.toBeNull();

    const olay = await db.outboxEvent.findFirstOrThrow({ where: { type: 'destek.yanitlandi' } });
    expect(await olaylar().handle('destek.yanitlandi', olay.payload as Record<string, unknown>)).toBe(1);
    const b = await call(app, 'GET', '/notifications', undefined, ayse.token);
    expect(b.body.bildirimler[0]).toMatchObject({ baslik: 'Rengarenk Destek yanıtladı' });
    expect((await call(app, 'GET', '/support/tickets', undefined, ayse.token)).body[0].okunmamis).toBe(true);
    const th = await call(app, 'GET', `/support/tickets/${t.body.no}`, undefined, ayse.token);
    expect(th.body).toMatchObject({ durum: 'cozuldu', puanVerebilir: true });
    expect(th.body.mesajlar[1]).toMatchObject({ taraf: 'destek', kim: 'Rengarenk Destek' });

    // Memnuniyet sorusu 24 saat sonra
    const ss = app.get(SupportService);
    expect(await ss.askRatings()).toBe(0);
    expect(await ss.askRatings(new Date(Date.now() + 25 * 3_600_000))).toBe(1);
    expect(await db.outboxEvent.count({ where: { type: 'destek.memnuniyet' } })).toBe(1);
    expect(
      (await call(app, 'POST', `/support/tickets/${t.body.no}/rating`, { puan: 5 }, ayse.token)).body.puan,
    ).toBe(5);

    // Kullanıcı yeniden yazınca talep açılır; başkası göremez
    const yeni = await call(
      app,
      'POST',
      `/support/tickets/${t.body.no}/messages`,
      { metin: 'Bir sorum daha var.' },
      ayse.token,
    );
    expect(yeni.body.durum).toBe('acik');
    const baska = await login('+905331110002', ['Can', 'Ak']);
    expect((await call(app, 'GET', `/support/tickets/${t.body.no}`, undefined, baska.token)).status).toBe(
      404,
    );
    expect(
      (await staffCall(app, 'POST', `/staff/support/tickets/${s.id}/resolve`, {}, destek2)).body.durum,
    ).toBe('cozuldu');
  });

  it('destek e-postası: imzasız reddedilir; eşleşmeyen adres için talep açılır, yanıt doğrudan e-postayla gider', async () => {
    const govde = {
      kimden: 'yabanci@ornek.com',
      konu: 'Fatura bilgisi değişikliği',
      metin: 'Faturamdaki unvanı nasıl değiştiririm?',
    };
    expect((await call(app, 'POST', '/destek/eposta', govde)).status).toBe(401);
    const imza = createHmac('sha256', SIR).update(JSON.stringify(govde)).digest('hex');
    const r = await app.inject({
      method: 'POST',
      url: '/destek/eposta',
      payload: govde,
      headers: { 'x-rr-eposta-imza': imza },
    });
    expect(r.statusCode).toBe(200);
    const no = JSON.parse(r.body).no as number;
    const t = await db.supportTicket.findUniqueOrThrow({ where: { no } });
    expect(t).toMatchObject({ channel: 'eposta', email: 'yabanci@ornek.com', userId: null });

    await staffCall(
      app,
      'POST',
      `/staff/support/tickets/${t.id}/reply`,
      { metin: 'Galeri panelinden güncelleyebilirsin.' },
      destek,
    );
    const olay = (await db.outboxEvent.findMany({ where: { type: 'destek.yanitlandi' } })).find(
      (o) => (o.payload as { ticketId: string }).ticketId === t.id,
    );
    const eposta = new MemoryEmail();
    const teslim = new DeliveryService(
      db,
      app.get<Env>(ENV),
      eposta,
      new FakePush(),
      sms,
      app.get(TemplatesService),
      app.get(SwitchService),
    );
    const once = eposta.sent.length;
    const ol = new NotificationEvents(
      db,
      app.get(NotificationService),
      app.get(DemandSearchService),
      app.get(SupportService),
      teslim,
    );
    expect(await ol.handle('destek.yanitlandi', olay?.payload as Record<string, unknown>)).toBe(1);
    expect(eposta.sent.slice(once)[0]).toMatchObject({
      to: 'yabanci@ornek.com',
      subject: `Destek talebin yanıtlandı · D-${no}`,
    });
  });
});
