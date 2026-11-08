import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { gallerySlug } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { EntitlementService } from '../src/entitlements/entitlement.service.js';
import { RealtimeService } from '../src/messages/realtime.service.js';
import { PortfolioService } from '../src/portfolio/portfolio.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;

const DAY = 86_400_000;
const JPG = (i: number) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, i, 4, 5, 6]);

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
  const bmw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  const s = await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: bmw.id, name: '3 Serisi', categories: ['otomobil'] },
  });
  await db.catalogModel.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi/320i', makeId: bmw.id, seriesId: s.id, name: '320i' },
  });
});
afterAll(() => app.close());

async function login(phone: string, ad?: [string, string]) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  const token = v.body.accessToken as string;
  if (ad) await call(app, 'PATCH', '/me', { firstName: ad[0], lastName: ad[1] }, token);
  const userId = (await db.user.findUniqueOrThrow({ where: { phone }, select: { id: true } })).id;
  return { token, userId };
}

async function galeri(phone: string, ad: string, sahip: [string, string]) {
  const u = await login(phone, sahip);
  const accountId = uuidv7();
  const applicationId = uuidv7();
  await db.account.create({ data: { id: accountId, kind: 'BUSINESS', name: ad, businessKind: 'DEALER' } });
  await db.accountMember.create({ data: { accountId, userId: u.userId, role: 'OWNER' } });
  await db.galleryApplication.create({
    data: {
      id: applicationId,
      userId: u.userId,
      status: 'APPROVED',
      submittedAt: new Date(),
      decidedAt: new Date(),
      accountId,
      data: {},
    },
  });
  await db.gallery.create({
    data: {
      accountId,
      slug: gallerySlug(ad),
      businessKind: 'DEALER',
      displayName: ad,
      legalName: `${ad} Ltd. Şti.`,
      taxNo: '1234567890',
      taxOffice: 'Kadıköy',
      mersisNo: '0123456789000015',
      il: 'İstanbul',
      ilce: 'Kadıköy',
      address: 'Moda Cad. No: 1',
      authorityNo: '34-2021-001',
      plan: 'deneme',
      trialEndsAt: new Date(Date.now() + 30 * DAY),
      applicationId,
      approvedAt: new Date(),
    },
  });
  return { ...u, accountId };
}

async function arac(
  g: { token: string; accountId: string },
  plaka: string,
  hasar: Record<string, unknown> = {},
) {
  const base = `/gallery/${g.accountId}/portfolio`;
  const c = await call(
    app,
    'POST',
    base,
    {
      kategori: 'otomobil',
      marka: 'bmw',
      seri: 'bmw/3-serisi',
      model: 'bmw/3-serisi/320i',
      yil: 2020,
      km: 62_000,
      yakit: 'benzin',
      vites: 'otomatik',
      renk: 'beyaz',
      fiyat: 2_390_000,
      plaka,
      sasiSon6: 'A12345',
      ilkTescil: '2020-03-15',
      fiyatBeyani: true,
      hasar: { parcalar: {}, tramer: 0, ...hasar },
    },
    g.token,
  );
  const id = c.body.id as string;
  for (let i = 0; i < 6; i++) {
    await app.inject({
      method: 'POST',
      url: `${base}/${id}/photos`,
      payload: JPG(i),
      headers: { authorization: `Bearer ${g.token}`, 'content-type': 'image/jpeg' },
    });
  }
  const s = await call(app, 'POST', `${base}/${id}/submit`, undefined, g.token);
  await app.get(PortfolioService).processEids(id);
  return { id, no: s.body.no as number };
}

async function talep(token: string, alanlar: Record<string, unknown> = {}) {
  const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, token);
  const data = {
    alanlar: {
      model: { make: 'bmw', series: 'bmw/3-serisi', model: 'bmw/3-serisi/320i' },
      konum: { il: 'İstanbul', ilce: 'Kadıköy' },
      ...alanlar,
    },
    alternatifler: [{ butce: { min: 2_000_000, max: 2_500_000 }, yil: { min: 2019, max: 2023 } }],
  };
  await call(app, 'PATCH', `/demands/${d.body.id}`, { data, step: 6 }, token);
  const p = await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, token);
  expect(p.status).toBe(200);
  return { id: d.body.id as string, no: p.body.no as number };
}

describe('ilk mesaj ve sohbet (Karar 08, 11, 25)', () => {
  it('bireysel satıcı tek ilk mesaj atar; alıcı yanıtlayınca sohbet açılır; uyarı bandı yalnızca alıcıya', async () => {
    const alici = await login('+905337770001', ['Ayşe', 'Yılmaz']);
    const t = await talep(alici.token);
    const satici = await login('+905337770002', ['Mehmet', 'Demir']);

    const st = await call(app, 'GET', `/talepler/${t.no}/mesaj`, undefined, satici.token);
    expect(st.body).toMatchObject({
      kendi: false,
      yazildi: null,
      gunluk: { toplam: 5, kalan: 5 },
      ek: 0,
      engel: null,
    });
    expect((await call(app, 'GET', `/talepler/${t.no}/mesaj`, undefined, alici.token)).body.kendi).toBe(true);
    expect(
      (await call(app, 'POST', `/talepler/${t.no}/mesaj`, { metin: 'Merhaba' }, alici.token)).status,
    ).toBe(403);

    const ilk = await call(
      app,
      'POST',
      `/talepler/${t.no}/mesaj`,
      { metin: 'Merhaba, elimde 2019 model 320i var. Kapora gönderirseniz ayırırım.' },
      satici.token,
    );
    expect(ilk.status).toBe(201);
    const id = ilk.body.id as string;
    // Gövde şifreli saklanır
    const row = await db.message.findFirstOrThrow({ where: { conversationId: id } });
    expect(row.body).not.toContain('Merhaba');
    expect(row.flags).toEqual(['kapora']);
    expect((await call(app, 'GET', `/talepler/${t.no}/mesaj`, undefined, satici.token)).body).toMatchObject({
      yazildi: id,
      gunluk: { kalan: 4 },
    });
    // Aynı talebe ikinci ilk mesaj yok; yanıt gelmeden ikinci mesaj yok; bireysel satıcı araç kartı ekleyemez
    expect(
      (await call(app, 'POST', `/talepler/${t.no}/mesaj`, { metin: 'Tekrar' }, satici.token)).status,
    ).toBe(409);
    expect(
      (await call(app, 'POST', `/conversations/${id}/messages`, { metin: 'Ek' }, satici.token)).status,
    ).toBe(409);

    const liste = await call(app, 'GET', '/conversations', undefined, alici.token);
    expect(liste.body[0]).toMatchObject({
      id,
      taraf: 'alici',
      ad: 'Mehmet D.',
      bekliyor: true,
      uyari: true,
      okunmamis: 1,
      talep: { no: t.no },
    });
    const d = await call(app, 'GET', `/conversations/${id}`, undefined, alici.token);
    expect(d.body).toMatchObject({ ilkMesajBekliyor: true, yazabilir: true, karsi: { ad: 'Mehmet D.' } });
    expect(d.body.mesajlar[0]).toMatchObject({
      yon: 'gelen',
      metin: 'Merhaba, elimde 2019 model 320i var. Kapora gönderirseniz ayırırım.',
      uyari: { baslik: 'Dikkat: bu mesajda kapora isteği var.' },
    });
    expect((await call(app, 'GET', '/conversations/unread', undefined, alici.token)).body.okunmamis).toBe(0);
    // Satıcı kendi mesajında bant görmez
    const sd = await call(app, 'GET', `/conversations/${id}`, undefined, satici.token);
    expect(sd.body.mesajlar[0]).toMatchObject({ yon: 'giden', uyari: null });
    expect(sd.body.karsi).toMatchObject({ ad: 'Ayşe Yılmaz', telefon: null });

    // Yanıt sohbeti açar; artık iki taraf yazar ve hak düşmez
    const y = await call(
      app,
      'POST',
      `/conversations/${id}/messages`,
      { metin: 'Merhaba, görebilir miyim?' },
      alici.token,
    );
    expect(y.body.durum).toBe('OPEN');
    expect(y.body.mesajlar.map((m: { yon: string }) => m.yon)).toEqual(['gelen', 'sistem', 'giden']);
    expect(
      (await call(app, 'POST', `/conversations/${id}/messages`, { metin: 'Tabii' }, satici.token)).status,
    ).toBe(201);
    expect(
      (
        await call(
          app,
          'POST',
          `/conversations/${id}/messages`,
          { metin: 'Kart', aracId: uuidv7() },
          satici.token,
        )
      ).status,
    ).toBe(403);

    // Numara paylaşımı: satıcı numarayı ancak şimdi görür
    await call(app, 'POST', `/conversations/${id}/share-phone`, undefined, alici.token);
    expect((await call(app, 'GET', `/conversations/${id}`, undefined, satici.token)).body.karsi.telefon).toBe(
      '0533 777 00 01',
    );
    // Engel: satıcı artık yazamaz, talebe de yazamaz
    await call(app, 'POST', `/conversations/${id}/block`, undefined, alici.token);
    expect(
      (await call(app, 'POST', `/conversations/${id}/messages`, { metin: 'Selam' }, satici.token)).status,
    ).toBe(403);
    expect((await call(app, 'GET', `/talepler/${t.no}/mesaj`, undefined, satici.token)).body.engel).toBe(
      'Talep sahibi bu hesaptan mesaj almak istemiyor',
    );
    const ev = await db.outboxEvent.findMany({ where: { type: { startsWith: 'mesaj.' } } });
    expect(ev.map((e) => e.type)).toContain('mesaj.uyari');
  });

  it('günlük ücretsiz hak biter, ek hak kullanılır; galeri araç kartı ekler; "İlgilenmiyorum" sonrası yazılamaz', async () => {
    const satici = await login('+905337771002', ['Serkan', 'Tekin']);
    const alicilar = [];
    for (let i = 0; i < 6; i++) {
      const a = await login(`+90533777200${i}`, ['Alıcı', `No${i}`]);
      alicilar.push({ ...a, t: await talep(a.token) });
    }
    for (let i = 0; i < 5; i++) {
      const r = await call(
        app,
        'POST',
        `/talepler/${alicilar[i]?.t.no}/mesaj`,
        { metin: 'Merhaba' },
        satici.token,
      );
      expect(r.status).toBe(201);
    }
    const yok = await call(
      app,
      'POST',
      `/talepler/${alicilar[5]?.t.no}/mesaj`,
      { metin: 'Merhaba' },
      satici.token,
    );
    expect(yok.status).toBe(409);
    expect(yok.body.code).toBe('hak_yetersiz');
    const kisisel = (await db.accountMember.findFirstOrThrow({ where: { userId: satici.userId } })).accountId;
    await app.get(EntitlementService).grant(kisisel, 'ilk_mesaj', 10, 'satin_alma', {
      sourceType: 'test',
      sourceId: 'ek-mesaj-1',
      createdBy: 'test',
    });
    const ek = await call(
      app,
      'POST',
      `/talepler/${alicilar[5]?.t.no}/mesaj`,
      { metin: 'Merhaba' },
      satici.token,
    );
    expect(ek.body).toMatchObject({ id: expect.any(String) });
    expect((await db.conversation.findUniqueOrThrow({ where: { id: ek.body.id } })).entitlement).toBe('ek');
    expect(await app.get(EntitlementService).balance(kisisel, 'ilk_mesaj')).toBe(9);

    // Galeri: araç kartı; alıcının kabul etmediği işlem varsa kartla yazamaz
    const g = await galeri('+905337773001', 'Yıldız Otomotiv', ['Mert', 'Kaya']);
    const v = await arac(g, '34 ABC 301');
    const sasili = await arac(g, '34 ABC 302', { sasiIslem: true });
    const alici = alicilar[0] as { token: string; t: { no: number } };
    expect(
      (
        await call(
          app,
          'POST',
          `/talepler/${alici.t.no}/mesaj`,
          { metin: 'Merhaba', hesap: g.accountId, aracId: sasili.id },
          g.token,
        )
      ).status,
    ).toBe(422);
    const gk = await call(
      app,
      'POST',
      `/talepler/${alici.t.no}/mesaj`,
      { metin: 'Merhaba Ayşe Hanım, aradığınız araç portföyümüzde.', hesap: g.accountId, aracId: v.id },
      g.token,
    );
    expect(gk.status).toBe(201);
    const gd = await call(app, 'GET', `/conversations/${gk.body.id}`, undefined, alici.token);
    expect(gd.body.karsi).toMatchObject({ ad: 'Yıldız Otomotiv', galeri: { slug: 'yildiz-otomotiv' } });
    expect(gd.body.karsi.alt).toBe('Galeri · Mert Kaya, sahip · Yetki belgesi no: 34-2021-001');
    expect(gd.body.mesajlar[1]).toMatchObject({
      tip: 'kart',
      kart: { no: v.no, ad: '2020 BMW 3 Serisi 320i', fiyat: 2_390_000, satista: true },
    });
    // Galeri paneli eşleşmeleri ve Kimden: yalnızca sahibinden
    const yalnizSahibinden = await login('+905337774001', ['Deniz', 'Ak']);
    const ts = await talep(yalnizSahibinden.token, { kimden: ['sahibinden'] });
    expect(
      (await call(app, 'POST', `/talepler/${ts.no}/mesaj`, { metin: 'Merhaba', hesap: g.accountId }, g.token))
        .status,
    ).toBe(403);

    // İlgilenmiyorum: satıcı yeniden yazamaz
    expect(
      (await call(app, 'POST', `/conversations/${gk.body.id}/decline`, undefined, alici.token)).body.durum,
    ).toBe('DECLINED');
    expect(
      (await call(app, 'POST', `/conversations/${gk.body.id}/messages`, { metin: 'Bakar mısınız?' }, g.token))
        .status,
    ).toBe(409);
    expect(
      (
        await call(
          app,
          'POST',
          `/talepler/${alici.t.no}/mesaj`,
          { metin: 'Merhaba', hesap: g.accountId },
          g.token,
        )
      ).status,
    ).toBe(409);

    // Satılan araç kartı: "Bu araç artık satışta değil"
    await call(app, 'POST', `/gallery/${g.accountId}/portfolio/${v.id}/sold`, undefined, g.token);
    const sat = await call(app, 'GET', `/conversations/${gk.body.id}`, undefined, alici.token);
    expect(sat.body.mesajlar[1].kart.satista).toBe(false);
  });

  it('alıcı portföy aracı için galeriye yazar (Karar 27); anlık iletim WebSocket ile', async () => {
    const g = await galeri('+905337775001', 'Kaya Motors', ['Ali', 'Kaya']);
    const v = await arac(g, '34 ABC 501');
    const alici = await login('+905337775009', ['Ece', 'Kara']);

    await app.listen(0, '127.0.0.1');
    const port = (app.getHttpServer().address() as { port: number }).port;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const gelen: unknown[] = [];
    await new Promise<void>((res, rej) => {
      ws.onopen = () => ws.send(JSON.stringify({ tip: 'giris', jeton: g.token }));
      ws.onmessage = (e) => {
        const m = JSON.parse(String(e.data));
        gelen.push(m);
        if (m.tip === 'hazir') res();
      };
      ws.onerror = () => rej(new Error('ws'));
    });

    const r = await call(
      app,
      'POST',
      `/araclar/${v.no}/mesaj`,
      { metin: 'Merhaba, araç duruyor mu?' },
      alici.token,
    );
    expect(r.status).toBe(201);
    const d = await call(app, 'GET', `/conversations/${r.body.id}`, undefined, g.token);
    expect(d.body).toMatchObject({
      durum: 'OPEN',
      taraf: 'satici',
      karsi: { ad: 'Ece K.' },
      arac: { no: v.no },
    });
    expect(d.body.mesajlar.map((m: { tip: string }) => m.tip)).toEqual(['kart', 'metin']);
    // Galerinin yanıtı hak tüketmez
    expect(
      (await call(app, 'POST', `/conversations/${r.body.id}/messages`, { metin: 'Duruyor' }, g.token)).status,
    ).toBe(201);
    expect(await db.entitlementLedger.count({ where: { accountId: g.accountId, kind: 'ilk_mesaj' } })).toBe(
      0,
    );
    // Aynı araç için ikinci yazış aynı sohbete gider
    const r2 = await call(app, 'POST', `/araclar/${v.no}/mesaj`, { metin: 'Yarın gelirim' }, alici.token);
    expect(r2.body.id).toBe(r.body.id);
    expect((await call(app, 'POST', `/araclar/${v.no}/mesaj`, { metin: 'x' }, g.token)).status).toBe(403);

    await new Promise((res) => setTimeout(res, 300));
    expect(gelen).toContainEqual({ tip: 'sohbet', id: r.body.id });
    ws.close();
    // Giriş iletisi olmadan bağlantı açık kalmaz; bozuk jeton kapanır
    const kotu = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const kod = await new Promise<number>((res) => {
      kotu.onopen = () => kotu.send(JSON.stringify({ tip: 'giris', jeton: 'bozuk' }));
      kotu.onclose = (e) => res(e.code);
    });
    expect(kod).toBe(4001);
    expect(app.get(RealtimeService)).toBeDefined();
  });
});
