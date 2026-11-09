import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { trSaat } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;

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

async function login(phone: string) {
  // Aynı numaraya art arda kod: bekleme süresi testte geri alınır
  await db.otpChallenge.updateMany({ where: { phone }, data: { createdAt: new Date(Date.now() - 120_000) } });
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  const t = v.body as { accessToken: string; refreshToken: string };
  await call(app, 'PATCH', '/me', { firstName: 'Ayşe', lastName: 'Yılmaz' }, t.accessToken);
  return t;
}

async function yayinla(token: string) {
  const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, token);
  const detay = await call(app, 'GET', `/demands/${d.body.id}`, undefined, token);
  const data = {
    alanlar: {
      konum: { il: 'İstanbul', ilce: 'Kadıköy' },
      ...detay.body.data.alanlar,
      model: { make: 'bmw', series: 'bmw/3-serisi', model: 'bmw/3-serisi/320i' },
    },
    alternatifler: [{ butce: { min: 1_500_000, max: 2_000_000 }, yil: { min: 2019, max: 2023 } }],
  };
  await call(app, 'PATCH', `/demands/${d.body.id}`, { data, step: 6 }, token);
  const p = await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, token);
  return { id: d.body.id as string, no: p.body.no as number, detay: detay.body, publish: p };
}

describe('Ayarlar › Profil ve İletişim (Karar 29)', () => {
  it('il, ilçe ve görünen ad; iletişim tercihleri yeni talebe geçer, saat dışında numara gizlenir', async () => {
    const a = await login('+905328880001');
    const p = await call(
      app,
      'PATCH',
      '/me',
      { il: 'İzmir', ilce: 'Karşıyaka', nameMode: 'kisa' },
      a.accessToken,
    );
    expect(p.status).toBe(200);
    expect(p.body).toMatchObject({ il: 'İzmir', ilce: 'Karşıyaka', nameMode: 'kisa' });
    // İlçe ilin ilçelerinden olmalı
    expect((await call(app, 'PATCH', '/me', { il: 'İzmir', ilce: 'Kadıköy' }, a.accessToken)).status).toBe(
      400,
    );
    expect((await call(app, 'PATCH', '/me', { il: 'Atlantis' }, a.accessToken)).status).toBe(400);

    // WhatsApp telefon izni ister; bitiş başlangıçtan sonra olmalı
    const yol = '/me/contact';
    const tamam = { phoneVisible: true, whatsappVisible: true, callFrom: 0, callTo: 24 };
    expect((await call(app, 'PUT', yol, { ...tamam, phoneVisible: false }, a.accessToken)).status).toBe(400);
    expect((await call(app, 'PUT', yol, { ...tamam, callFrom: 21, callTo: 9 }, a.accessToken)).status).toBe(
      400,
    );
    expect((await call(app, 'PUT', yol, tamam, a.accessToken)).body).toEqual(tamam);
    const me = await call(app, 'GET', '/me', undefined, a.accessToken);
    expect(me.body).toMatchObject({ ...tamam, il: 'İzmir', ilce: 'Karşıyaka', nameMode: 'kisa' });

    // Yeni talep tercihlerle ve profildeki konumla açılır
    const t = await yayinla(a.accessToken);
    expect(t.detay.data.alanlar.konum).toEqual({ il: 'İzmir', ilce: 'Karşıyaka' });
    expect(t.detay.contact).toEqual({ phoneVisible: true, whatsappVisible: true, nameMode: 'kisa' });
    expect(t.publish.status).toBe(200);

    const b = await login('+905328880002');
    const acik = await call(app, 'GET', `/talepler/${t.no}`, undefined, b.accessToken);
    expect(acik.body.owner).toMatchObject({ name: 'Ayşe Y.', phone: '+905328880001', whatsapp: true });
    expect(acik.body.owner.aramaSaati).toEqual({ bas: 0, bit: 24, simdiGizli: false });

    // Şu anki saati dışarıda bırakan aralık: numara ve WhatsApp gizlenir, sahibi kendi numarasını görür
    const h = trSaat();
    const disari = h <= 22 ? { callFrom: h + 1, callTo: 24 } : { callFrom: 0, callTo: 23 };
    await call(app, 'PUT', yol, { ...tamam, ...disari }, a.accessToken);
    const gizli = await call(app, 'GET', `/talepler/${t.no}`, undefined, b.accessToken);
    expect(gizli.body.owner).toMatchObject({ phone: null, whatsapp: false });
    expect(gizli.body.owner.aramaSaati).toEqual({
      bas: disari.callFrom,
      bit: disari.callTo,
      simdiGizli: true,
    });
    const kendi = await call(app, 'GET', `/talepler/${t.no}`, undefined, a.accessToken);
    expect(kendi.body.owner.phone).toBe('+905328880001');
    expect(await db.auditLog.count({ where: { action: 'iletisim_tercihi' } })).toBe(2);
  });

  it('numara yeni numaraya gelen kodla değişir; diğer oturumlar kapanır, ücretsiz talep yenilenmez', async () => {
    const eski = '+905328880011';
    const yeni = '+905328880012';
    const a = await login(eski);
    const ikinci = await login(eski);
    await login('+905328880013');
    await yayinla(a.accessToken);
    expect((await call(app, 'GET', '/demands/rights', undefined, a.accessToken)).body.ucretsizTalep).toBe(
      false,
    );

    expect((await call(app, 'POST', '/me/phone/request', { phone: eski }, a.accessToken)).status).toBe(409);
    const dolu = await call(app, 'POST', '/me/phone/request', { phone: '+905328880013' }, a.accessToken);
    expect(dolu.status).toBe(409);
    expect(dolu.body.message).toContain('başka bir hesapta');
    const r = await call(app, 'POST', '/me/phone/request', { phone: yeni }, a.accessToken);
    expect(r.status).toBe(200);
    expect(
      (
        await call(
          app,
          'POST',
          '/me/phone/verify',
          { challengeId: r.body.challengeId, code: '000000' },
          a.accessToken,
        )
      ).status,
    ).toBe(401);
    const v = await call(
      app,
      'POST',
      '/me/phone/verify',
      { challengeId: r.body.challengeId, code: sms.lastCode(yeni) },
      a.accessToken,
    );
    expect(v.status).toBe(200);
    expect(v.body).toEqual({ degisti: true, kapananOturum: 1 });
    expect((await call(app, 'GET', '/me', undefined, a.accessToken)).body.phone).toBe(yeni);
    // Diğer cihazdaki oturum kapandı; bu oturum sürer
    expect((await call(app, 'POST', '/auth/refresh', { refreshToken: ikinci.refreshToken })).status).toBe(
      401,
    );
    expect((await call(app, 'POST', '/auth/refresh', { refreshToken: a.refreshToken })).status).toBe(200);
    // Kod bir kez kullanılır
    expect(
      (
        await call(
          app,
          'POST',
          '/me/phone/verify',
          { challengeId: r.body.challengeId, code: sms.lastCode(yeni) },
          a.accessToken,
        )
      ).status,
    ).toBe(401);
    const u = await db.user.findUniqueOrThrow({ where: { phone: yeni }, select: { id: true } });
    const kayit = await db.auditLog.findFirstOrThrow({
      where: { action: 'telefon_degisti', entityId: u.id },
    });
    expect(JSON.stringify(kayit, (_k, x) => (typeof x === 'bigint' ? String(x) : x))).not.toContain(
      '905328880012',
    );
    expect(await db.outboxEvent.count({ where: { type: 'hesap.telefon_degisti' } })).toBe(1);

    // Yeni numara ücretsiz ilk talebi yenilemez (hesap başına bir kez)
    const hak = await call(app, 'GET', '/demands/rights', undefined, a.accessToken);
    expect(hak.body.ucretsizTalep).toBe(false);
    const ikinciTalep = await yayinla(a.accessToken);
    expect(ikinciTalep.publish.status).toBe(409);
    // Eski numarayla açılan yeni hesap da ücretsiz talep alamaz (numara başına bir kez)
    const yeniHesap = await login(eski);
    expect(
      (await call(app, 'GET', '/demands/rights', undefined, yeniHesap.accessToken)).body.ucretsizTalep,
    ).toBe(false);
  });
});
