import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { DemandService } from '../src/demands/demand.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;
let demands: DemandService;

const DAY = 86_400_000;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
  demands = app.get(DemandService);
  // Küçük bir katalog: BMW 3 Serisi 320i
  const make = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  const series = await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: make.id, name: '3 Serisi', categories: ['otomobil'] },
  });
  await db.catalogModel.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi/320i', makeId: make.id, seriesId: series.id, name: '320i' },
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
  return token;
}

const otomobil = () => ({
  alanlar: {
    model: { make: 'bmw', series: 'bmw/3-serisi', model: 'bmw/3-serisi/320i' },
    konum: { il: 'İstanbul', ilce: 'Kadıköy' },
    aciklama: 'Bakımlı, tercihen M Sport.',
  } as Record<string, unknown>,
  alternatifler: [
    {
      butce: { min: 1_750_000, max: 2_050_000 },
      yil: { min: 2020, max: 2023 },
      km: 60_000,
      vites: ['otomatik'],
    },
    { butce: { min: 1_500_000, max: 1_800_000 }, yil: { min: 2016, max: 2019 } },
  ] as Record<string, unknown>[],
});

async function yayinda(token: string) {
  const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, token);
  await call(app, 'PATCH', `/demands/${d.body.id}`, { data: otomobil(), step: 6 }, token);
  const p = await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, token);
  return { id: d.body.id as string, publish: p };
}

describe('talepler (Karar 04, 05, 09, 10, 12, 21)', () => {
  it('taslak yarım kaydedilir; yayında şema doğrulanır; ilk talep ücretsiz, ikincisi hak ister', async () => {
    const t = await login('+905327771001', ['Ayşe', 'Yılmaz']);
    expect((await call(app, 'POST', '/demands', { kategori: 'ticari' }, t)).body.message).toBe(
      'Alt kategori seç',
    );

    const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, t);
    expect(d.status).toBe(201);
    expect(d.body).toMatchObject({ status: 'DRAFT', step: 2, category: { slug: 'otomobil' } });
    const half = await call(
      app,
      'PATCH',
      `/demands/${d.body.id}`,
      { data: { alanlar: { konum: { il: 'İstanbul' } } }, step: 3 },
      t,
    );
    expect(half.status).toBe(200);
    const early = await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, t);
    expect(early.status).toBe(400);
    expect(early.body.issues.map((i: { path: string }) => i.path)).toEqual(
      expect.arrayContaining(['alanlar.model', 'alternatifler.0.butce', 'alternatifler.0.yil']),
    );

    await call(
      app,
      'PATCH',
      `/demands/${d.body.id}`,
      { data: otomobil(), contact: { phoneVisible: true, whatsappVisible: true, nameMode: 'kisa' } },
      t,
    );
    const before = await call(app, 'GET', '/demands/rights', undefined, t);
    expect(before.body).toEqual({
      ucretsizTalep: true,
      talep: 1,
      uzatma: 0,
      telefonMaske: '0 (5XX) XXX XX 01',
      galeri: null,
    });
    expect((await call(app, 'PATCH', `/demands/${d.body.id}`, { headline: 'Kısa' }, t)).status).toBe(400);
    await call(
      app,
      'PATCH',
      `/demands/${d.body.id}`,
      { headline: 'BMW 320i arıyorum: 2019 sonrası, otomatik' },
      t,
    );
    const pub = await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, t);
    expect(pub.status).toBe(200);
    expect(pub.body.baslik).toBe('BMW 320i arıyorum: 2019 sonrası, otomatik');
    expect((await call(app, 'GET', '/demands/rights', undefined, t)).body).toMatchObject({
      ucretsizTalep: false,
      talep: 0,
    });
    expect(pub.body).toMatchObject({
      status: 'PUBLISHED',
      title: 'BMW 3 Serisi 320i',
      il: 'İstanbul',
      ilce: 'Kadıköy',
      budgetMin: 1_500_000,
      budgetMax: 2_050_000,
      yearMin: 2016,
      yearMax: 2023,
      alternatives: 2,
    });
    expect(pub.body.no).toBeGreaterThan(1_000_000);
    expect((new Date(pub.body.expiresAt).getTime() - Date.now()) / DAY).toBeGreaterThan(29.9);
    const row = await db.demand.findUniqueOrThrow({ where: { id: d.body.id } });
    expect(row).toMatchObject({ entitlement: 'ucretsiz', schemaVersion: 1 });

    // İkinci talep: ücretsiz hak bitti, ek talep ödeme modülüyle satın alınır
    const second = await yayinda(t);
    expect(second.publish.status).toBe(409);
    expect(second.publish.body).toMatchObject({
      code: 'hak_yetersiz',
      kind: 'talep',
      message: 'Kullanılabilir talep hakkın yok',
    });

    // Herkese açık sayfa: telefon yalnızca girişli kullanıcıya; ad "Ayşe Y."
    const anon = await call(app, 'GET', `/talepler/${pub.body.no}`);
    expect(anon.body.owner).toMatchObject({
      name: 'Ayşe Y.',
      isYou: false,
      phone: null,
      phoneHidden: true,
      whatsapp: false,
    });
    expect(anon.body.gorunum.katalog).toEqual({ marka: 'BMW', seri: '3 Serisi', model: '320i' });
    // Aranabilir saatler (varsayılan 09–21) dışında numara gizlidir; test saatten bağımsız olsun
    await db.user.update({ where: { phone: '+905327771001' }, data: { callFrom: 0, callTo: 24 } });
    const other = await login('+905327771002');
    const seen = await call(app, 'GET', `/talepler/${pub.body.no}`, undefined, other);
    expect(seen.body.owner).toMatchObject({ phone: '+905327771001', whatsapp: true });
    expect(seen.body.schema.fields.map((f: { key: string }) => f.key)).toContain('model');

    const mine = await call(app, 'GET', '/demands/mine', undefined, t);
    expect(mine.body.counts).toMatchObject({ PUBLISHED: 1, DRAFT: 1 });
    expect((await call(app, 'GET', `/demands/${d.body.id}`, undefined, other)).status).toBe(403);
  });

  it('düzenle, pasife al, yeniden aç, aracı buldum', async () => {
    const t = await login('+905327771003');
    const { id } = await yayinda(t);
    const edit = otomobil();
    edit.alternatifler[0] = { ...edit.alternatifler[0], butce: { min: 1_800_000, max: 2_200_000 } };
    const e = await call(app, 'PATCH', `/demands/${id}`, { data: edit }, t);
    expect(e.body).toMatchObject({ status: 'PUBLISHED', budgetMax: 2_200_000 });
    const bad = otomobil();
    delete bad.alanlar.konum;
    expect((await call(app, 'PATCH', `/demands/${id}`, { data: bad }, t)).status).toBe(400);

    expect((await call(app, 'POST', `/demands/${id}/passivate`, {}, t)).body.status).toBe('PASSIVE');
    const owner = await call(app, 'GET', `/demands/${id}`, undefined, t);
    expect(owner.body.actions).toMatchObject({
      activate: true,
      extend: false,
      complete: true,
      passivate: false,
    });
    expect((await call(app, 'POST', `/demands/${id}/activate`, {}, t)).body.status).toBe('PUBLISHED');
    expect((await call(app, 'POST', `/demands/${id}/complete`, { foundVia: 'kim' }, t)).status).toBe(400);
    const done = await call(app, 'POST', `/demands/${id}/complete`, { foundVia: 'rengarenk' }, t);
    expect(done.body.status).toBe('COMPLETED');
    expect((await call(app, 'PATCH', `/demands/${id}`, { data: otomobil() }, t)).status).toBe(409);
    expect((await call(app, 'POST', `/demands/${id}/passivate`, {}, t)).status).toBe(409);

    const events = await db.demandEvent.findMany({ where: { demandId: id }, orderBy: { id: 'asc' } });
    expect(events.map((x) => x.type)).toEqual([
      'olusturuldu',
      'yayinlandi',
      'duzenlendi',
      'pasife_alindi',
      'aktif_edildi',
      'tamamlandi',
    ]);
    const evt = await db.outboxEvent.findFirst({ where: { type: 'arac.bulundu' }, orderBy: { id: 'desc' } });
    expect(evt?.payload).toMatchObject({ demandId: id });
  });

  it('süre dolunca pasife düşer; ilk uzatma ücretsiz, ikincisi hak ister; hatırlatma en yakın eşikte', async () => {
    const t = await login('+905327771004');
    const { id } = await yayinda(t);

    await db.demand.update({ where: { id }, data: { expiresAt: new Date(Date.now() + 2.5 * DAY) } });
    expect(await demands.remindDue()).toBeGreaterThanOrEqual(1);
    expect((await db.demand.findUniqueOrThrow({ where: { id } })).reminderDays).toBe(3);
    await demands.remindDue();
    const reminders = await db.demandEvent.findMany({ where: { demandId: id, type: 'hatirlatma' } });
    expect(reminders.map((r) => r.data)).toEqual([{ gun: 3 }]);

    await db.demand.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await demands.expireDue()).toBeGreaterThanOrEqual(1);
    const p = await db.demand.findUniqueOrThrow({ where: { id } });
    expect(p).toMatchObject({ status: 'PASSIVE', passiveReason: 'sure_doldu' });
    expect((await call(app, 'POST', `/demands/${id}/activate`, {}, t)).status).toBe(409);

    const ext = await call(app, 'POST', `/demands/${id}/extend`, {}, t);
    expect(ext.status).toBe(200);
    expect(ext.body).toMatchObject({ status: 'PUBLISHED', freeExtensionUsed: true });
    expect((new Date(ext.body.expiresAt).getTime() - Date.now()) / DAY).toBeGreaterThan(29.9);
    // Bitişe çok varken uzatılamaz
    expect((await call(app, 'POST', `/demands/${id}/extend`, {}, t)).status).toBe(409);
    await db.demand.update({ where: { id }, data: { expiresAt: new Date(Date.now() + 2 * DAY) } });
    const paid = await call(app, 'POST', `/demands/${id}/extend`, {}, t);
    expect(paid.status).toBe(409);
    expect(paid.body).toMatchObject({ code: 'hak_yetersiz', kind: 'uzatma' });
  });

  it('kiralık talep alış tarihinde biter; taslak kapatılabilir; talep silinmez', async () => {
    const t = await login('+905327771005');
    const d = await call(app, 'POST', '/demands', { kategori: 'kiralik' }, t);
    const from = new Date(Date.now() + 5 * DAY).toISOString();
    const to = new Date(Date.now() + 9 * DAY).toISOString();
    await call(
      app,
      'PATCH',
      `/demands/${d.body.id}`,
      {
        data: {
          alanlar: {
            tarih: { from, to },
            alisYeri: 'havalimani',
            surucuYas: 34,
            ehliyetYil: 12,
            konum: { il: 'Antalya' },
          },
          alternatifler: [{ butce: { max: 2_500 }, segment: ['suv'] }],
        },
      },
      t,
    );
    const pub = await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, t);
    expect(pub.status).toBe(200);
    expect(Math.abs(new Date(pub.body.expiresAt).getTime() - new Date(from).getTime())).toBeLessThan(1000);

    const draft = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, t);
    expect((await call(app, 'POST', `/demands/${draft.body.id}/close`, {}, t)).body.status).toBe('CLOSED');
    await expect(db.demand.delete({ where: { id: draft.body.id } })).rejects.toThrow(/RR001/);
  });

  it('Taleplerim istatistiği: görüntülenme sahibi ve botlar hariç kişi başına 24 saatte bir; favori sayısı', async () => {
    const sahip = await login('+905327771090');
    const diger = await login('+905327771091');
    const { id } = await yayinda(sahip);
    const { no, updatedAt } = await db.demand.findUniqueOrThrow({ where: { id } });
    const gor = (ip: string, token?: string, ua = 'Mozilla/5.0') =>
      app.inject({
        method: 'POST',
        url: `/talepler/${no}/goruntu`,
        remoteAddress: ip,
        headers: { 'user-agent': ua, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      });
    expect((await gor('10.1.0.1', sahip)).statusCode).toBe(204);
    await gor('10.1.0.2');
    await gor('10.1.0.2');
    await gor('10.1.0.3');
    await gor('10.1.0.4', undefined, 'Googlebot/2.1');
    await gor('10.1.0.5', diger);
    await gor('10.1.0.6', diger);
    expect((await call(app, 'PUT', `/favorites/${no}`, undefined, diger)).status).toBe(204);
    const d = await db.demand.findUniqueOrThrow({ where: { id } });
    expect(d.viewCount).toBe(3);
    expect(d.updatedAt).toEqual(updatedAt);
    const mine = await call(app, 'GET', '/demands/mine', undefined, sahip);
    expect(mine.body.items.find((x: { id: string }) => x.id === id).istatistik).toEqual({
      goruntu: 3,
      favori: 1,
      mesaj: 0,
      eslesen: 0,
    });
    expect((await call(app, 'POST', '/talepler/99999999/goruntu', {})).status).toBe(204);
  });
});
