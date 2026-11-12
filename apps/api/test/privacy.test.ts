import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { NotificationService } from '../src/notifications/notification.service.js';
import { NotificationEvents } from '../src/notifications/notification-events.js';
import { PrivacyService } from '../src/privacy/privacy.service.js';
import { DemandSearchService } from '../src/search/demand-search.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, uyeOl } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;
let sahip: string;
let destek: string;
let pazarlama: string;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
  sahip = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
  destek = (await loginAs(app, await createStaff(db, 'SUPPORT'))).token;
  pazarlama = (await loginAs(app, await createStaff(db, 'MARKETING'))).token;
});
afterAll(() => app.close());

async function login(phone: string, ad: [string, string]) {
  const v = { body: await uyeOl(app, phone, { consents: { reklamOlcum: true } }) };
  const token = v.body.accessToken as string;
  await call(app, 'PATCH', '/me', { firstName: ad[0], lastName: ad[1] }, token);
  const userId = (await db.user.findUniqueOrThrow({ where: { phone }, select: { id: true } })).id;
  return { token, userId };
}

/** Kendi numarasına yeni kod (bekleme süresini aşmak için önceki kodun zamanı geriye alınır) */
async function kod(phone: string, token: string) {
  await db.otpChallenge.updateMany({ where: { phone }, data: { createdAt: new Date(Date.now() - 120_000) } });
  // Hassas işlem onayı (Karar 58): kod kişinin kendi numarasına, oturumla istenir
  const r = await call(app, 'POST', '/auth/code', {}, token);
  return { challengeId: r.body?.challengeId as string, code: sms.lastCode(phone) as string };
}

const olaylar = () => new NotificationEvents(db, app.get(NotificationService), app.get(DemandSearchService));

describe('KVKK: verilerimi indir, başvurular, rıza kayıtları (Karar 58, 59)', () => {
  it('veri kopyası SMS koduyla istenir, işçi hazırlar, yalnızca sahibi indirir; 7 gün sonra geçersiz', async () => {
    const ayse = await login('+905332220001', ['Ayşe', 'Yılmaz']);
    expect(
      (
        await call(
          app,
          'POST',
          '/me/data-exports',
          { challengeId: '01a1bcbc-0000-7000-8000-000000000000', code: '123456' },
          ayse.token,
        )
      ).status,
    ).toBe(401);
    const k = await kod('+905332220001', ayse.token);
    const r = await call(app, 'POST', '/me/data-exports', k, ayse.token);
    expect(r.status).toBe(200);
    expect(r.body[0].durum).toBe('hazirlaniyor');
    // Aynı kodla ikinci istek olmaz (kod harcandı)
    expect((await call(app, 'POST', '/me/data-exports', k, ayse.token)).status).toBe(401);
    const id = r.body[0].id as string;
    expect(await app.get(PrivacyService).buildExport(id)).toBe('hazir');
    const ev = await db.outboxEvent.findFirstOrThrow({ where: { type: 'veri.hazir' } });
    expect(await olaylar().handle('veri.hazir', ev.payload as Record<string, unknown>)).toBe(1);

    const baska = await login('+905332220002', ['Can', 'Ak']);
    expect((await call(app, 'GET', `/me/data-exports/${id}/download`, undefined, baska.token)).status).toBe(
      404,
    );
    const d = await app.inject({
      method: 'GET',
      url: `/me/data-exports/${id}/download`,
      headers: { authorization: `Bearer ${ayse.token}` },
    });
    expect(d.statusCode).toBe(200);
    expect(d.headers['content-disposition']).toContain('attachment');
    const json = JSON.parse(d.body);
    expect(json.profil).toMatchObject({ telefon: '+905332220001', ad: 'Ayşe' });
    expect(json.rizalar.map((x: { kind: string }) => x.kind)).toContain('reklam_olcum');
    expect(await db.auditLog.count({ where: { action: 'veri_indirildi', actorId: ayse.userId } })).toBe(1);

    await db.dataExport.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await call(app, 'GET', `/me/data-exports/${id}/download`, undefined, ayse.token)).status).toBe(
      410,
    );
    expect((await call(app, 'GET', '/me/data-exports', undefined, ayse.token)).body[0].durum).toBe(
      'suresi_doldu',
    );
  });

  it('KVKK başvurusu: koduyla açılır, ajan verileri sayar ve taslak yazar, yanıtı tam yetkili çalışan gönderir', async () => {
    const mehmet = await login('+905332220011', ['Mehmet', 'Aksoy']);
    const k = await kod('+905332220011', mehmet.token);
    const b = await call(
      app,
      'POST',
      '/me/kvkk',
      { ...k, tur: 'bilgi', metin: 'Hakkımda hangi verileri tuttuğunuzu öğrenmek istiyorum.' },
      mehmet.token,
    );
    expect(b.status).toBe(201);
    expect(b.body.numara).toMatch(/^K-1\d{3}$/);

    expect((await staffCall(app, 'GET', '/staff/kvkk', undefined, pazarlama)).status).toBe(403);
    const l = await staffCall(app, 'GET', '/staff/kvkk', undefined, destek);
    const s = l.body.acik.find((x: { numara: string }) => x.numara === b.body.numara);
    expect(s).toMatchObject({
      tur: 'Bilgi alma',
      kim: 'Mehmet A.',
      alt: 'Hesaptan · doğrulama koduyla',
      kalanGun: 30,
    });
    const d = await staffCall(app, 'GET', `/staff/kvkk/${s.id}`, undefined, destek);
    expect(d.body.veriler).toEqual(expect.arrayContaining(['Profil', 'Rıza geçmişi']));
    expect(d.body.taslak).toContain('Merhaba Mehmet Aksoy');

    // Destek (öneri) gönderemez; okudum onayı olmadan gönderilmez
    expect(
      (
        await staffCall(
          app,
          'POST',
          `/staff/kvkk/${s.id}/reply`,
          { metin: d.body.taslak, okudum: true },
          destek,
        )
      ).status,
    ).toBe(403);
    expect(
      (await staffCall(app, 'POST', `/staff/kvkk/${s.id}/reply`, { metin: d.body.taslak }, sahip)).status,
    ).toBe(400);
    const y = await staffCall(
      app,
      'POST',
      `/staff/kvkk/${s.id}/reply`,
      { metin: d.body.taslak, okudum: true },
      sahip,
    );
    expect(y.body.durum).toBe('yanitlandi');
    const ev = await db.outboxEvent.findFirstOrThrow({ where: { type: 'kvkk.yanitlandi' } });
    expect(await olaylar().handle('kvkk.yanitlandi', ev.payload as Record<string, unknown>)).toBe(1);
    expect((await call(app, 'GET', '/me/kvkk', undefined, mehmet.token)).body[0]).toMatchObject({
      durum: 'yanitlandi',
      tur: 'Bilgi alma',
    });

    // Dışarıdan gelen başvuru (kimliği çalışan doğrular)
    const dis = await staffCall(
      app,
      'POST',
      '/staff/kvkk',
      {
        ad: 'Selin Kaya',
        eposta: 'selin@ornek.com',
        tur: 'duzeltme',
        metin: 'Faturalarımda soyadım yanlış yazılmış, düzeltilmesini istiyorum.',
        kanal: 'eposta',
        kimlikDogrulandi: true,
      },
      destek,
    );
    expect(dis.body).toMatchObject({ baslik: 'Düzeltme başvurusu · Selin Kaya', eposta: 'se***@ornek.com' });
  });

  it('rıza ve çerez kayıtları: oranlar ve kişinin rıza geçmişi', async () => {
    await login('+905332220021', ['Zeynep', 'Toprak']);
    const o = await staffCall(app, 'GET', '/staff/consents/overview', undefined, destek);
    expect(o.body[0]).toMatchObject({ ad: 'Reklam ölçümü rızası' });
    expect(o.body[0].deger).toMatch(/^%\d+$/);
    const h = await staffCall(app, 'GET', '/staff/consents?q=Zeynep', undefined, destek);
    expect(h.body.kisi.ad).toBe('Zeynep Toprak');
    expect(h.body.gecmis.map((g: { ad: string }) => g.ad)).toEqual(
      expect.arrayContaining(['Kullanım koşulları', 'KVKK aydınlatma metni', 'Reklam ölçümü']),
    );
  });
});
