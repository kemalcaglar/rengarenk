import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AI_PROVIDER, type FakeAiProvider } from '../src/ai/ai.provider.js';
import { AiGateway } from '../src/ai/ai-gateway.service.js';
import { ENV, type Env } from '../src/config/env.js';
import type { Db } from '../src/database/prisma.js';
import { FeatureFlagService } from '../src/flags/feature-flag.service.js';
import { MessageSafety } from '../src/messages/message-safety.js';
import { OutboxService } from '../src/outbox/outbox.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { SecretBox } from '../src/staff/secret-box.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;
let sahip: string;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
  const bmw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  const s3 = await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: bmw.id, name: '3 Serisi', categories: ['otomobil'] },
  });
  await db.catalogModel.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi/320i', makeId: bmw.id, seriesId: s3.id, name: '320i' },
  });
  const vw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'volkswagen', name: 'Volkswagen' } });
  await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'volkswagen/passat', makeId: vw.id, name: 'Passat', categories: ['otomobil'] },
  });
  sahip = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
});
afterAll(() => app.close());

const sifrele = async (metin: string) => SecretBox.forMessages(app.get<Env>(ENV)).seal(metin);

async function login(phone: string) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  return v.body.accessToken as string;
}

/** x-rr-platform başlığıyla istek */
async function web(method: 'GET' | 'POST', url: string, token: string, body?: object) {
  const res = await app.inject({
    method,
    url,
    payload: body,
    headers: { authorization: `Bearer ${token}`, 'x-rr-platform': 'WEB' },
  });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
}

describe('kullanıcı tarafı yapay zekâ (Karar 42)', () => {
  it('talep asistanı: anahtar kapalıyken kullanılamaz; açıkken metinden taslağı doldurur, yayınlamaz', async () => {
    const t = await login('+905339982001');
    const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, t);
    expect((await web('GET', `/demands/${d.body.id}`, t)).body.asistan).toBe(false);
    const kapali = await web('POST', `/demands/${d.body.id}/asistan`, t, { metin: '2019 sonrası BMW 320i' });
    expect(kapali.status).toBe(403);

    expect(
      (await staffCall(app, 'PATCH', '/staff/flags/talep_asistani', { enabled: true, percent: 100 }, sahip))
        .status,
    ).toBe(200);
    expect((await web('GET', `/demands/${d.body.id}`, t)).body.asistan).toBe(true);

    const r = await web('POST', `/demands/${d.body.id}/asistan`, t, {
      metin:
        'BMW 320i arıyorum, 2019 sonrası, otomatik, dizel, 1,5 milyon bütçe, 100 bin km altı, İstanbul Kadıköy, hasarsız',
    });
    expect(r.status).toBe(200);
    const harita = Object.fromEntries(
      r.body.doldurulan.map((x: { alan: string; deger: string }) => [x.alan, x.deger]),
    );
    expect(harita['Marka, seri, model']).toBe('BMW 3 Serisi 320i');
    expect(harita['Model yılı']).toBe('en az 2019');
    expect(harita['Bütçe (en az – en çok)']).toBe('en çok 1.500.000 TL');
    expect(harita.Yakıt).toBe('Dizel');
    expect(harita.Vites).toBe('Otomatik');
    expect(harita['Konum (il, ilçe)']).toBe('İstanbul, Kadıköy');

    const taslak = await call(app, 'GET', `/demands/${d.body.id}`, undefined, t);
    expect(taslak.body.status).toBe('DRAFT');
    expect(taslak.body.data.alanlar.model).toEqual({
      make: 'bmw',
      series: 'bmw/3-serisi',
      model: 'bmw/3-serisi/320i',
    });
    expect(taslak.body.data.alternatifler[0]).toMatchObject({
      yil: { min: 2019 },
      butce: { max: 1_500_000 },
      km: 100_000,
      yakit: ['dizel'],
      vites: ['otomatik'],
    });

    // Markasız seri adı (tek markada) ve yayındaki talepte kullanılamaz
    const d2 = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, t);
    const r2 = await web('POST', `/demands/${d2.body.id}/asistan`, t, {
      metin: 'Passat, 2016-2018, benzinli',
    });
    expect(r2.body.doldurulan).toContainEqual({ alan: 'Marka, seri, model', deger: 'Volkswagen Passat' });
    expect(r2.body.doldurulan).toContainEqual({ alan: 'Model yılı', deger: '2016 – 2018' });
    expect(r2.body.eksik).toContain('Bütçe (en az – en çok)');
  });

  it('ilk mesaj taslağı: talebe göre yazılır, yeniden yaz başka metin getirir; kurala aykırı yapay zekâ yanıtı kullanılmaz', async () => {
    const alici = await login('+905339982002');
    const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, alici);
    const data = {
      alanlar: {
        model: { make: 'bmw', series: 'bmw/3-serisi', model: 'bmw/3-serisi/320i' },
        konum: { il: 'İstanbul', ilce: 'Kadıköy' },
      },
      alternatifler: [{ butce: { min: 2_000_000, max: 2_500_000 }, yil: { min: 2019, max: 2023 } }],
    };
    await call(
      app,
      'PATCH',
      `/demands/${d.body.id}`,
      { data, headline: 'Temiz 320i arıyorum', step: 6 },
      alici,
    );
    const p = await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, alici);
    const no = p.body.no as number;

    expect((await call(app, 'POST', `/talepler/${no}/mesaj/taslak`, {}, alici)).status).toBe(403);
    const satici = await login('+905339982003');
    const t0 = await call(app, 'POST', `/talepler/${no}/mesaj/taslak`, {}, satici);
    expect(t0.status).toBe(200);
    expect(t0.body.metin).toBe(
      'Merhaba, “Temiz 320i arıyorum” talebinizi gördüm; aradığınız özelliklere uyan bir aracım var. Ayrıntıları paylaşmamı ister misiniz?',
    );
    expect(t0.body.arac).toBeNull();
    const t1 = await call(app, 'POST', `/talepler/${no}/mesaj/taslak`, { sira: 1 }, satici);
    expect(t1.body.metin).not.toBe(t0.body.metin);

    const yz = app.get<FakeAiProvider>(AI_PROVIDER);
    yz.yanit = 'Merhaba, beni 0532 418 22 41 numarasından arayın, kapora ile ayırırım.';
    const t2 = await call(app, 'POST', `/talepler/${no}/mesaj/taslak`, {}, satici);
    yz.yanit = null;
    expect(t2.body.kaynak).toBe('kural');
    expect(t2.body.metin).toBe(t0.body.metin);
  });

  it('mesaj güvenliği: şüpheli teslim ve ödeme kalıbı uyarı bandı açar; anahtar kapalıyken çalışmaz', async () => {
    const alici = await login('+905339982004');
    const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, alici);
    const data = {
      alanlar: {
        model: { make: 'bmw', series: 'bmw/3-serisi', model: 'bmw/3-serisi/320i' },
        konum: { il: 'İstanbul', ilce: 'Kadıköy' },
      },
      alternatifler: [{ butce: { min: 2_000_000, max: 2_500_000 }, yil: { min: 2019, max: 2023 } }],
    };
    await call(app, 'PATCH', `/demands/${d.body.id}`, { data, step: 6 }, alici);
    const no = (await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, alici)).body.no as number;
    const satici = await login('+905339982005');
    const m = await call(
      app,
      'POST',
      `/talepler/${no}/mesaj`,
      { metin: 'Araç hazır ama yurt dışındayım, kargo ile gönderirim; önce avans yeterli.' },
      satici,
    );
    expect(m.status).toBe(201);
    const mesaj = await db.message.findFirstOrThrow({ where: { conversationId: m.body.id, kind: 'metin' } });
    expect(mesaj.flags).toEqual([]);

    const guvenlik = new MessageSafety(
      db,
      app.get<Env>(ENV),
      app.get(FeatureFlagService),
      app.get(AiGateway),
      app.get(OutboxService),
    );
    expect(await guvenlik.kontrol(mesaj.id)).toBe('kapali');
    await staffCall(app, 'PATCH', '/staff/flags/mesaj_guvenligi', { enabled: true, percent: 100 }, sahip);
    expect(await guvenlik.kontrol(mesaj.id)).toBe('supheli');
    expect(await guvenlik.kontrol(mesaj.id)).toBe('islem_yok');

    const sohbet = await call(app, 'GET', `/conversations/${m.body.id}`, undefined, alici);
    const gelen = sohbet.body.mesajlar.find(
      (x: { tip: string; yon: string }) => x.tip === 'metin' && x.yon === 'gelen',
    );
    expect(gelen.uyari.baslik).toBe('Dikkat: bu mesajda şüpheli bir ödeme ya da teslim yöntemi var.');
    // Satıcı kendi mesajında bandı görmez
    const kendi = await call(app, 'GET', `/conversations/${m.body.id}`, undefined, satici);
    expect(kendi.body.mesajlar.every((x: { uyari: unknown }) => x.uyari === null)).toBe(true);

    // Para ya da teslimle ilgisi olmayan mesaj sağlayıcıya hiç gitmez
    const yz = app.get<FakeAiProvider>(AI_PROVIDER);
    const once = yz.calls.length;
    const m2 = await db.message.create({
      data: {
        id: uuidv7(),
        conversationId: m.body.id,
        side: 'satici',
        senderUserId: mesaj.senderUserId,
        kind: 'metin',
        body: await sifrele('Aracın bakımları yetkili serviste yapıldı.'),
      },
    });
    expect(await guvenlik.kontrol(m2.id)).toBe('temiz');
    expect(yz.calls.length).toBe(once);
  });
});
