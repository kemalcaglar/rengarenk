import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AgentService } from '../src/agent/agent.service.js';
import { ApprovalExecutor } from '../src/approvals/approval-executor.js';
import type { Db } from '../src/database/prisma.js';
import { NotificationService } from '../src/notifications/notification.service.js';
import { NotificationEvents } from '../src/notifications/notification-events.js';
import { DemandSearchService } from '../src/search/demand-search.service.js';
import { call, createTestApp, uyeOl } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
});
afterAll(() => app.close());

const pgCode = (e: unknown) => String((e as Error)?.message).match(/Code: `(RR0\d\d)`/)?.[1];

async function uye(phone: string) {
  const v = { body: await uyeOl(app, phone) };
  return v.body.accessToken as string;
}

const METIN =
  '## 1. Taraflar\n\nPlatform Rengarenk’tir.\n\n## 7. Ödemeler\n\nSatın alınan haklar iade edilmez.';

describe('yasal metinler: taslak, karşılaştırma, sahip onayıyla yayın, yeniden onay (Karar 46, 59)', () => {
  it('onaylanmış taslak değişmez; düzenleme yeni sürüm açar, yayın sahip onayıyla, esaslı değişiklik girişte onaylatılır', async () => {
    for (const key of ['kullanim_kosullari', 'kvkk_aydinlatma']) {
      await db.consentText.create({
        data: { id: uuidv7(), key, version: 1, title: 'Metin', body: METIN, status: 'taslak' },
      });
    }
    // Yayın öncesi dönem: üye en yeni taslağı onaylar
    const kisi = await uye('+905336660001');
    const v1 = await db.consentText.findFirstOrThrow({ where: { key: 'kullanim_kosullari', version: 1 } });
    await expect(
      db.consentText.update({ where: { id: v1.id }, data: { body: 'değişti' } }),
    ).rejects.toSatisfy((e) => pgCode(e) === 'RR042');

    const owner = await createStaff(db, 'OWNER');
    const admin = await createStaff(db, 'ADMIN');
    const ot = (await loginAs(app, owner)).token;
    const at = (await loginAs(app, admin)).token;
    const yeni = METIN.replace(
      'Satın alınan haklar iade edilmez.',
      'Kullanılmamış haklar satın almadan itibaren 14 gün içinde iade edilebilir.',
    );
    const kayit = await staffCall(
      app,
      'PUT',
      '/staff/legal/kullanim_kosullari/draft',
      { title: 'Kullanım koşulları', body: yeni, material: true, not: 'madde 7 iade koşulu' },
      at,
    );
    expect(kayit.body).toEqual({ version: 2 });
    const d = (await staffCall(app, 'GET', '/staff/legal/kullanim_kosullari', undefined, at)).body;
    expect(d.taslak).toMatchObject({ version: 2, material: true, kilitli: false, onayda: false });
    expect(d.fark).toMatchObject({
      eski: 1,
      yeni: 2,
      ozet: '1 paragraf eklendi, 1 paragraf çıkarıldı · bölüm: 7. Ödemeler',
    });
    expect(d.fark.satirlar[0]).toMatchObject({ tip: 'sil', bolum: '7. Ödemeler' });

    // Yönetici gönderir, yalnızca sahip onaylar; onaydaki taslak düzenlenince yeni sürüm açılır
    const g = await staffCall(app, 'POST', '/staff/legal/kullanim_kosullari/submit', {}, at);
    expect(g.status).toBe(201);
    const approvalId = g.body.approvalId as string;
    expect((await staffCall(app, 'POST', `/staff/approvals/${approvalId}/approve`, {}, at)).status).toBe(403);
    const liste = (await staffCall(app, 'GET', '/staff/legal', undefined, at)).body;
    expect(liste.find((x: { key: string }) => x.key === 'kullanim_kosullari')).toMatchObject({
      ad: 'Kullanım koşulları',
      yayinda: null,
      taslak: { version: 2, onayda: true },
    });
    expect((await staffCall(app, 'POST', `/staff/approvals/${approvalId}/approve`, {}, ot)).status).toBe(200);
    expect(await app.get(ApprovalExecutor).execute(approvalId)).toBe('yurutuldu');
    const yayinda = await db.consentText.findFirstOrThrow({
      where: { key: 'kullanim_kosullari', status: 'yayinda' },
    });
    expect(yayinda).toMatchObject({ version: 2, material: true, publishedBy: owner.id });
    await expect(db.consentText.update({ where: { id: yayinda.id }, data: { body: 'x' } })).rejects.toSatisfy(
      (e) => pgCode(e) === 'RR041',
    );
    const olay = await db.outboxEvent.findFirstOrThrow({ where: { type: 'yasal.guncellendi' } });
    expect(olay.payload).toEqual({ key: 'kullanim_kosullari', version: 2 });
    expect(
      await new NotificationEvents(db, app.get(NotificationService), app.get(DemandSearchService)).handle(
        'yasal.guncellendi',
        { key: 'kullanim_kosullari', version: 2 },
      ),
    ).toBeGreaterThanOrEqual(1);

    // Kişi v1'i onaylamıştı: bir sonraki girişte v2 onaylatılır; zorunlu metin reddedilemez
    const bekleyen = await call(app, 'GET', '/me/legal/pending', undefined, kisi);
    expect(bekleyen.body).toEqual([
      expect.objectContaining({
        key: 'kullanim_kosullari',
        version: 2,
        zorunlu: true,
        ad: 'Kullanım koşulları',
      }),
    ]);
    const red = await call(
      app,
      'POST',
      '/me/legal/accept',
      { onaylar: [{ key: 'kullanim_kosullari', version: 2, granted: false }] },
      kisi,
    );
    expect(red.status).toBe(400);
    const kabul = await call(
      app,
      'POST',
      '/me/legal/accept',
      { onaylar: [{ key: 'kullanim_kosullari', version: 2, granted: true }] },
      kisi,
    );
    expect(kabul.status).toBe(201);
    expect(kabul.body).toEqual([]);

    // Esaslı olmayan sürüm yeniden onay istemez
    await staffCall(
      app,
      'PUT',
      '/staff/legal/kullanim_kosullari/draft',
      { title: 'Kullanım koşulları', body: `${yeni}\n\nYazım düzeltmesi.`, material: false },
      ot,
    );
    const g3 = await staffCall(app, 'POST', '/staff/legal/kullanim_kosullari/submit', {}, ot);
    await staffCall(app, 'POST', `/staff/approvals/${g3.body.approvalId}/approve`, {}, ot);
    expect(await app.get(ApprovalExecutor).execute(g3.body.approvalId)).toBe('yurutuldu');
    expect((await call(app, 'GET', '/me/legal/pending', undefined, kisi)).body).toEqual([]);
    expect(await db.consentText.count({ where: { key: 'kullanim_kosullari', status: 'yayinda' } })).toBe(1);
  });
});

describe('yardım makaleleri (Karar 46, 54)', () => {
  it('kurulumda sık sorulanlar aktarılır; okunma ve faydalı sayılır; konsoldan eklenir; ajan eksik konuya taslak hazırlar', async () => {
    const konular = (await call(app, 'GET', '/yardim/makaleler')).body;
    expect(konular[0]).toMatchObject({ key: 'talep', ad: 'Talep oluşturma' });
    const ilk = konular[0].makaleler[0];
    expect(ilk.soru).toBe('Talebim ne kadar süre yayında kalır?');
    // Aynı ziyaretçinin tekrarı sayılmaz
    for (let i = 0; i < 2; i++) await call(app, 'POST', `/yardim/makaleler/${ilk.id}/okundu`);
    await call(app, 'POST', `/yardim/makaleler/${ilk.id}/faydali`, { evet: true });
    await call(app, 'POST', `/yardim/makaleler/${ilk.id}/faydali`, { evet: false });

    const owner = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
    const liste = (await staffCall(app, 'GET', '/staff/help', undefined, owner)).body;
    expect(liste.makaleler.find((m: { id: string }) => m.id === ilk.id)).toMatchObject({
      okunma: 1,
      faydali: 100,
      oy: 1,
      konu: 'Talep oluşturma',
    });

    const yeni = await staffCall(
      app,
      'POST',
      '/staff/help',
      {
        topic: 'hak',
        title: 'İlk mesaj hakkım neden azaldı?',
        body: 'Günlük ücretsiz ilk mesaj hakkın her gece 00.00’da yenilenir.',
        status: 'taslak',
      },
      owner,
    );
    const yayinMi = async () =>
      (await call(app, 'GET', '/yardim/makaleler')).body
        .flatMap((t: { makaleler: { id: string }[] }) => t.makaleler)
        .some((m: { id: string }) => m.id === yeni.body.id);
    expect(await yayinMi()).toBe(false);
    await staffCall(
      app,
      'PUT',
      `/staff/help/${yeni.body.id}`,
      {
        topic: 'hak',
        title: 'İlk mesaj hakkım neden azaldı?',
        body: 'Günlük ücretsiz ilk mesaj hakkın her gece 00.00’da yenilenir.',
        status: 'yayinda',
      },
      owner,
    );
    expect(await yayinMi()).toBe(true);

    // Son 30 günün destek taleplerinden makalelerde karşılığı olmayanlar: ajan notu ve taslağı
    for (let i = 0; i < 6; i++) {
      await db.supportTicket.create({
        data: {
          id: uuidv7(),
          channel: 'uygulama',
          topic: 'diger',
          email: `kisi${i}@ornek.com`,
          subject: `Qwrtz blorpu fnargle zibber ${i}`,
          dueAt: new Date(),
          lastMessageAt: new Date(),
        },
      });
    }
    const ajan = (await staffCall(app, 'GET', '/staff/help', undefined, owner)).body.ajan;
    expect(ajan).toMatchObject({ konuAd: 'Diğer', sayi: 6, toplam: 6, oran: 100 });
    await db.featureFlag.updateMany({ where: { key: 'ajan' }, data: { enabled: true } });
    AgentService.unut();
    const t = await staffCall(app, 'POST', '/staff/help/ajan-taslak', {}, owner);
    expect(t.status).toBe(201);
    expect(await db.helpArticle.findUniqueOrThrow({ where: { id: t.body.id } })).toMatchObject({
      status: 'taslak',
      source: 'ajan',
    });
  });
});
