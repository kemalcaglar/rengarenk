import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AgentService } from '../src/agent/agent.service.js';
import { AI_PROVIDER, type FakeAiProvider } from '../src/ai/ai.provider.js';
import { AiGateway } from '../src/ai/ai-gateway.service.js';
import type { Db } from '../src/database/prisma.js';
import { ModerationService } from '../src/moderation/moderation.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;
let sahip: string;
let yonetici: string;
let moderator: string;
let izleyici: string;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
  const bmw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  const s = await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: bmw.id, name: '3 Serisi', categories: ['otomobil'] },
  });
  await db.catalogModel.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi/320i', makeId: bmw.id, seriesId: s.id, name: '320i' },
  });
  sahip = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
  yonetici = (await loginAs(app, await createStaff(db, 'ADMIN'))).token;
  moderator = (await loginAs(app, await createStaff(db, 'MODERATOR'))).token;
  izleyici = (await loginAs(app, await createStaff(db, 'VIEWER'))).token;
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
  return token;
}

async function talep(token: string) {
  const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, token);
  const data = {
    alanlar: {
      model: { make: 'bmw', series: 'bmw/3-serisi', model: 'bmw/3-serisi/320i' },
      konum: { il: 'İstanbul', ilce: 'Kadıköy' },
    },
    alternatifler: [{ butce: { min: 2_000_000, max: 2_500_000 }, yil: { min: 2019, max: 2023 } }],
  };
  await call(app, 'PATCH', `/demands/${d.body.id}`, { data, step: 6 }, token);
  const p = await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, token);
  expect(p.status).toBe(200);
  return p.body.no as number;
}

async function kaporaMesaji(no: number, token: string) {
  const r = await call(
    app,
    'POST',
    `/talepler/${no}/mesaj`,
    { metin: 'Araç elimde. Kapora için IBAN TR33 0006 1005 1978 6457 8413 26, hemen gönderin.' },
    token,
  );
  expect(r.status).toBe(201);
  return db.message.findFirstOrThrow({ where: { conversationId: r.body.id, kind: 'metin' } });
}

describe('Rengarenk Ajanı (Karar 41)', () => {
  it('kapora mesajını gizler ve akışa yazar; yetkili geri alır; durdurulunca otomatik işlem yapmaz', async () => {
    const alici = await login('+905339990001', ['Ayşe', 'Yıldız']);
    const satici = await login('+905339990002', ['Okan', 'Bulut']);
    const satici2 = await login('+905339990003', ['Kaan', 'Er']);
    const no = await talep(alici);
    const m = await kaporaMesaji(no, satici);
    const ms = app.get(ModerationService);
    expect(await ms.ajanMesajKontrolu(m.id)).toBe('askiya_alindi');

    // İzleyici akışı görür ama geri alamaz; moderatör (şikâyet çözme tam) geri alabilir
    const g = await staffCall(app, 'GET', '/staff/agent', undefined, izleyici);
    expect(g.status).toBe(200);
    expect(g.body.calisiyor).toBe(true);
    const islem = g.body.akis.find((a: { islem: string }) => a.islem.startsWith('Mesaj gizlendi'));
    expect(islem).toMatchObject({
      islem: expect.stringContaining('Okan B.'),
      guven: 'Kural',
      geriAlinabilir: false,
    });
    expect(islem.neden).toContain('alıcı Ayşe Y.');
    expect(g.body.durum).toMatchObject({ aski: 1, askiSinir: 50 });
    const gm = await staffCall(app, 'GET', '/staff/agent', undefined, moderator);
    expect(gm.body.akis.find((a: { id: string }) => a.id === islem.id).geriAlinabilir).toBe(true);

    expect((await staffCall(app, 'POST', `/staff/agent/actions/${islem.id}/undo`, {}, izleyici)).status).toBe(
      403,
    );
    expect(
      (await staffCall(app, 'POST', `/staff/agent/actions/${islem.id}/undo`, {}, moderator)).status,
    ).toBe(204);
    expect(
      (await staffCall(app, 'POST', `/staff/agent/actions/${islem.id}/undo`, {}, moderator)).status,
    ).toBe(409);
    expect((await db.message.findUniqueOrThrow({ where: { id: m.id } })).hiddenAt).toBeNull();
    const aski = await db.userSanction.findFirstOrThrow({ where: { byAgent: true, kind: 'aski' } });
    expect(aski.liftedAt).not.toBeNull();
    expect(await db.auditLog.count({ where: { action: 'ajan_islemi_geri_alindi' } })).toBe(1);
    const sonra = await staffCall(app, 'GET', '/staff/agent', undefined, moderator);
    expect(sonra.body.akis.find((a: { id: string }) => a.id === islem.id).geriAlindi).toBe(true);
    expect(sonra.body.sayilar.geri7).toBe(1);

    // Tamamen durdurma: yalnızca sistem ayarı yetkisiyle; durunca kapora mesajı otomatik gizlenmez
    expect((await staffCall(app, 'POST', '/staff/agent/run', { calisiyor: false }, moderator)).status).toBe(
      403,
    );
    expect((await staffCall(app, 'POST', '/staff/agent/run', { calisiyor: false }, sahip)).status).toBe(200);
    const m2 = await kaporaMesaji(no, satici2);
    expect(await ms.ajanMesajKontrolu(m2.id)).toBe('islem_yok');
    expect((await staffCall(app, 'GET', '/staff/agent', undefined, izleyici)).body.calisiyor).toBe(false);
    expect(await db.auditLog.count({ where: { action: 'ozellik_degisti', entityId: 'ajan' } })).toBe(1);
    expect((await staffCall(app, 'POST', '/staff/agent/run', { calisiyor: true }, sahip)).status).toBe(200);
    expect(await ms.ajanMesajKontrolu(m2.id)).toBe('askiya_alindi');
  });

  it('günlük özet 09.00’dan sonra günde bir kez yazılır; sayılar kuraldan, yapay zekâ cümleyi kurar', async () => {
    const ajan = app.get(AgentService);
    const sabah = new Date();
    sabah.setUTCHours(5, 0, 0, 0); // 08.00 TR
    expect(await ajan.ozet(sabah)).toBeNull();
    sabah.setUTCHours(7, 0, 0, 0); // 10.00 TR
    const a = await ajan.ozet(sabah);
    expect(a?.title).toBe('Günlük özet yazıldı');
    expect(a?.reason).toMatch(/^Dün \d+ yeni talep, \d+ ilk mesaj/);
    expect(await ajan.ozet(sabah)).toBeNull();
    expect(await db.outboxEvent.count({ where: { type: 'ajan.ozet' } })).toBe(1);
  });

  it('ajana sor: sayılar kurallarla, kişisel veri olmadan; anlaşılmayan soruya yol gösterir', async () => {
    const r = await staffCall(
      app,
      'POST',
      '/staff/agent/ask',
      { soru: 'Bu ay İstanbul’da kaç talep açıldı?' },
      izleyici,
    );
    expect(r.status).toBe(200);
    expect(r.body.cevap).toMatch(/İstanbul’da \d+ talep yayına girdi/);
    expect(r.body.kaynak).toContain('kişisel veri kullanılmadı');
    expect(r.body.yz).toBe(true);
    expect(await db.aiCall.count({ where: { task: 'rapor', promptVersion: 'ajana-sor-v1' } })).toBe(1);
    const i = await staffCall(
      app,
      'POST',
      '/staff/agent/ask',
      { soru: 'Geçen ay İstanbul’da kaç galeri ilk mesaj gönderdi?' },
      izleyici,
    );
    expect(i.body.cevap).toMatch(/İstanbul’da(ki \d+ galeriden| onaylı galeri yoktu)/);
    const b = await staffCall(app, 'POST', '/staff/agent/ask', { soru: 'Hava nasıl?' }, izleyici);
    expect(b.body.cevap).toContain('henüz yanıtlayamıyorum');
  });
});

describe('yapay zekâ bütçesi ve ayarları (Karar 57)', () => {
  it('maskeler, görevi kapatır, sınırı yalnızca sahip değiştirir; %80 uyarısı, sınırda yalnızca kritik görevler', async () => {
    const ai = app.get(AiGateway);
    const fake = app.get<FakeAiProvider>(AI_PROVIDER);
    const istek = {
      task: 'destek' as const,
      promptVersion: 'test-v1',
      size: 'kucuk' as const,
      system: 'Destek yanıtı taslağı yaz.',
      prompt: 'Müşteri Ayşe Yılmaz 0532 418 22 41 numarasından aradı, ayse@ornek.com',
      taslak: 'Sayın Ayşe Yılmaz, 0532 418 22 41 numaranıza dönüş yapacağız.',
      names: ['Ayşe Yılmaz'],
    };
    const r = await ai.run(istek);
    expect(r).toMatchObject({ kaynak: 'yz', durum: 'tamam', text: istek.taslak });
    const son = fake.calls.at(-1);
    expect(`${son?.prompt} ${son?.taslak}`).not.toMatch(/0532|Ayşe|ayse@/);
    const kayit = await db.aiCall.findFirstOrThrow({ where: { promptVersion: 'test-v1' } });
    expect(kayit.inputMasked).not.toMatch(/0532|Ayşe|ayse@/);
    expect(kayit.costMicroUsd).toBeGreaterThan(0);
    await expect(db.aiCall.delete({ where: { id: kayit.id } })).rejects.toThrow();

    // Görev anahtarı ve sınır: yalnızca sahip
    expect((await staffCall(app, 'GET', '/staff/ai', undefined, moderator)).status).toBe(403);
    expect(
      (await staffCall(app, 'POST', '/staff/ai/tasks/destek', { enabled: false }, yonetici)).status,
    ).toBe(403);
    expect((await staffCall(app, 'POST', '/staff/ai/tasks/destek', { enabled: false }, sahip)).status).toBe(
      204,
    );
    expect((await ai.run(istek)).durum).toBe('kapali');
    await staffCall(app, 'POST', '/staff/ai/tasks/destek', { enabled: true }, sahip);
    expect((await staffCall(app, 'POST', '/staff/ai/limit', { limitUsd: 30 }, yonetici)).status).toBe(403);
    expect((await staffCall(app, 'POST', '/staff/ai/limit', { limitUsd: 10 }, sahip)).status).toBe(400);
    expect((await staffCall(app, 'POST', '/staff/ai/limit', { limitUsd: 30 }, sahip)).status).toBe(200);
    const o = await staffCall(app, 'GET', '/staff/ai', undefined, yonetici);
    expect(o.status).toBe(200);
    expect(o.body.sinirUsd).toBe(30);
    expect(o.body.gecmis[0]).toMatchObject({ once: 150, sonra: 30 });
    expect(o.body.gorevler).toHaveLength(7);
    expect(o.body.maskeler.map((m: { ad: string }) => m.ad)).toContain('Plaka');

    // %80 (24 USD) aşılınca bir kez uyarı; sınır dolunca kritik olmayan görev durur, kritik görev çalışır
    const harcama = (usd: number) =>
      db.aiCall.create({
        data: {
          id: uuidv7(),
          task: 'rapor',
          promptVersion: 'test-harcama',
          provider: 'fake',
          model: 'gemini-2.5-flash',
          status: 'tamam',
          costMicroUsd: usd * 1_000_000,
        },
      });
    await harcama(24);
    expect((await ai.run(istek)).durum).toBe('tamam');
    expect((await ai.run(istek)).durum).toBe('tamam');
    expect(await db.outboxEvent.count({ where: { type: 'yz.butce_uyari' } })).toBe(1);
    await harcama(10);
    expect((await ai.run(istek)).durum).toBe('butce');
    expect((await ai.run({ ...istek, task: 'moderasyon' })).durum).toBe('tamam');
    expect(await db.outboxEvent.count({ where: { type: 'yz.butce_doldu' } })).toBe(1);
    const t = (await staffCall(app, 'GET', '/staff/ai', undefined, sahip)).body;
    expect(t.sinirda).toBe(true);
    expect(t.gorevler.find((g: { key: string }) => g.key === 'rapor').tutarUsd).toBeGreaterThanOrEqual(34);

    // Sağlayıcı hatasında kural metni döner ve çağrı hata olarak kaydedilir
    fake.fail = true;
    expect(await ai.run({ ...istek, task: 'moderasyon' })).toMatchObject({ durum: 'hata', kaynak: 'kural' });
    fake.fail = false;
    expect(await db.aiCall.count({ where: { status: 'hata' } })).toBe(1);
  });
});
