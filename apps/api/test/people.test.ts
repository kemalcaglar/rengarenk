import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;
let sahip: string;
let destek: string;
let mod: string;
let pazarlama: string;

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
  destek = (await loginAs(app, await createStaff(db, 'SUPPORT'))).token;
  mod = (await loginAs(app, await createStaff(db, 'MODERATOR'))).token;
  pazarlama = (await loginAs(app, await createStaff(db, 'MARKETING'))).token;
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
  return { token, userId, refresh: v.body.refreshToken as string };
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
  return { id: d.body.id as string, no: p.body.no as number };
}

describe('kullanıcı ve galeri kartı, kara liste (Karar 40, 43, 52)', () => {
  it('kart maskeli gelir; göstermek gerekçe ister ve kayda geçer; pazarlama göremez', async () => {
    const ayse = await login('+905339990001', ['Ayşe', 'Yılmaz']);
    await talep(ayse.token);
    const ara = await staffCall(app, 'GET', '/staff/people?q=Ayşe', undefined, destek);
    expect(ara.body.find((x: { id: string }) => x.id === ayse.userId)).toMatchObject({
      ad: 'Ayşe Yılmaz',
      durum: 'Aktif',
    });
    expect((await staffCall(app, 'GET', '/staff/people?q=Ayşe', undefined, pazarlama)).status).toBe(403);

    const k = await staffCall(app, 'GET', `/staff/people/kisi/${ayse.userId}`, undefined, destek);
    expect(k.body.telefon).toBe('05•• ••• •• 01');
    expect(k.body.sayilar[0]).toEqual({ ad: 'Talep', deger: '1 · 1 aktif' });
    expect(k.body.gecmis.map((g: { olay: string }) => g.olay)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Talep oluşturdu/), 'Üye oldu']),
    );
    expect(
      (await staffCall(app, 'POST', `/staff/people/kisi/${ayse.userId}/reveal`, { gerekce: 'x' }, destek))
        .status,
    ).toBe(400);
    const g = await staffCall(
      app,
      'POST',
      `/staff/people/kisi/${ayse.userId}/reveal`,
      { gerekce: 'Destek talebi, geri dönüş' },
      destek,
    );
    expect(g.body.telefon).toBe('+905339990001');
    const kayit = await db.auditLog.findFirstOrThrow({
      where: { action: 'kisisel_veri_acildi', entityId: ayse.userId },
    });
    expect(kayit.after).toMatchObject({ gerekce: 'Destek talebi, geri dönüş' });

    // Not ve oturumları kapatma
    await staffCall(
      app,
      'POST',
      `/staff/people/kisi/${ayse.userId}/notes`,
      { metin: 'Telefonla değil e-postayla dönülsün.' },
      destek,
    );
    const o = await staffCall(app, 'POST', `/staff/people/kisi/${ayse.userId}/sessions/revoke`, {}, destek);
    expect(o.body.gecmis.map((x: { olay: string }) => x.olay)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Not · /),
        expect.stringMatching(/^Oturumlar kapatıldı/),
      ]),
    );
    expect((await call(app, 'POST', '/auth/refresh', { refreshToken: ayse.refresh })).status).toBe(401);
  });

  it('karttan karar moderasyon kaydı olarak açılır; destek askıya alamaz; hak tanımlamada aylık sınır', async () => {
    const okan = await login('+905339990011', ['Okan', 'Bulut']);
    expect(
      (
        await staffCall(
          app,
          'POST',
          `/staff/people/kisi/${okan.userId}/action`,
          { karar: 'aski', gerekce: 'Spam mesajlar' },
          destek,
        )
      ).status,
    ).toBe(403);
    const a = await staffCall(
      app,
      'POST',
      `/staff/people/kisi/${okan.userId}/action`,
      { karar: 'aski', gerekce: 'Çok sayıda alıcıya aynı spam mesaj' },
      mod,
    );
    expect(a.status).toBe(200);
    expect(a.body.durum).toBe('ACTIVE');
    expect(a.body.rozetler.map((r: { t: string }) => r.t)).toContain('Askıda · 24 saat');
    const r = await db.report.findFirstOrThrow({ where: { targetUserId: okan.userId, source: 'calisan' } });
    expect(r).toMatchObject({ targetType: 'kullanici', status: 'kapali', decision: 'aski' });
    // Kararın ayrıntısı kişiye açık ve itiraz edilebilir
    const kd = await call(app, 'GET', `/moderation/decisions/${r.id}`, undefined, okan.token);
    expect(kd.body).toMatchObject({
      hedef: 'Hesap',
      itirazEdebilir: true,
      gerekce: 'Çok sayıda alıcıya aynı spam mesaj',
    });
    const ara = await staffCall(app, 'GET', '/staff/people?tur=askida', undefined, mod);
    expect(ara.body.find((x: { id: string }) => x.id === okan.userId)?.durum).toBe('Askıda');

    // Hak tanımlama: destek ayda 10, üstü yönetici
    const h1 = await staffCall(
      app,
      'POST',
      `/staff/people/kisi/${okan.userId}/grant`,
      { tur: 'ilk_mesaj', adet: 6, gerekce: 'Hata nedeniyle gönül alma' },
      destek,
    );
    expect(h1.status).toBe(200);
    expect(
      (
        await staffCall(
          app,
          'POST',
          `/staff/people/kisi/${okan.userId}/grant`,
          { tur: 'ilk_mesaj', adet: 5, gerekce: 'Yeniden gönül alma' },
          destek,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await staffCall(
          app,
          'POST',
          `/staff/people/kisi/${okan.userId}/grant`,
          { tur: 'ilk_mesaj', adet: 5, gerekce: 'Sahip onayıyla' },
          sahip,
        )
      ).status,
    ).toBe(200);
    const hesap = await db.accountMember.findFirstOrThrow({ where: { userId: okan.userId } });
    const toplam = await db.entitlementLedger.aggregate({
      where: { accountId: hesap.accountId, kind: 'ilk_mesaj', sourceType: 'staff_grant' },
      _sum: { delta: true },
    });
    expect(toplam._sum.delta).toBe(11);
    expect(await db.outboxEvent.count({ where: { type: 'hak.tanimlandi' } })).toBe(2);
  });

  it('kara liste: numara ve IP koda kapanır; IBAN içeren mesaj gizlenir ve kritik şikâyet açılır', async () => {
    expect(
      (await staffCall(app, 'POST', '/staff/blocklist', { tur: 'telefon', deger: '0533 999 00 21' }, mod))
        .body[0],
    ).toMatchObject({ tur: 'telefon', deger: '05•• ••• •• 21' });
    expect(
      (await staffCall(app, 'POST', '/staff/blocklist', { tur: 'telefon', deger: '+905339990021' }, mod))
        .status,
    ).toBe(409);
    expect(
      (await staffCall(app, 'POST', '/staff/blocklist', { tur: 'iban', deger: 'TR12' }, mod)).status,
    ).toBe(400);
    expect((await call(app, 'POST', '/auth/otp/request', { phone: '+905339990021' })).status).toBe(403);
    // Değerin kendisi saklanmaz
    expect(await db.blocklist.count({ where: { valueHash: { contains: '9990021' } } })).toBe(0);

    await staffCall(
      app,
      'POST',
      '/staff/blocklist',
      { tur: 'iban', deger: 'TR33 0006 1005 1978 6457 8413 26', not: 'Dolandırıcılık' },
      mod,
    );
    const alici = await login('+905339990022', ['Selin', 'Ak']);
    const t = await talep(alici.token);
    const satici = await login('+905339990023', ['Can', 'Er']);
    const ilk = await call(
      app,
      'POST',
      `/talepler/${t.no}/mesaj`,
      { metin: 'Aracım hazır, bilgi için TR330006100519786457841326' },
      satici.token,
    );
    const m = await db.message.findFirstOrThrow({ where: { conversationId: ilk.body.id, kind: 'metin' } });
    expect(m.hiddenAt).not.toBeNull();
    const r = await db.report.findFirstOrThrow({ where: { targetId: m.id } });
    expect(r).toMatchObject({ priority: 'kritik', signals: ['kara_liste_iban'] });

    // Kara listeden çıkarılınca numara yeniden kod alır
    const kayit = (await staffCall(app, 'GET', '/staff/blocklist', undefined, mod)).body.find(
      (x: { tur: string }) => x.tur === 'telefon',
    );
    await staffCall(app, 'DELETE', `/staff/blocklist/${kayit.id}`, undefined, mod);
    expect((await call(app, 'POST', '/auth/otp/request', { phone: '+905339990021' })).status).toBe(200);
  });

  it('galeri kartı: sahibin maskeli iletişimi, portföy ve yıldız sayıları', async () => {
    const sahibi = await login('+905339990031', ['Mert', 'Yıldız']);
    const accountId = uuidv7();
    const applicationId = uuidv7();
    await db.account.create({
      data: { id: accountId, kind: 'BUSINESS', name: 'Yıldız Otomotiv', businessKind: 'DEALER' },
    });
    await db.accountMember.create({ data: { accountId, userId: sahibi.userId, role: 'OWNER' } });
    await db.galleryApplication.create({
      data: {
        id: applicationId,
        userId: sahibi.userId,
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
        slug: 'yildiz-otomotiv',
        businessKind: 'DEALER',
        displayName: 'Yıldız Otomotiv',
        legalName: 'Yıldız Otomotiv Ltd. Şti.',
        taxNo: '1234567890',
        taxOffice: 'Kadıköy',
        mersisNo: '0123456789000015',
        il: 'İstanbul',
        ilce: 'Kadıköy',
        address: 'Moda Cad. No: 1',
        plan: 'profesyonel',
        applicationId,
        approvedAt: new Date(),
      },
    });
    const ara = await staffCall(app, 'GET', '/staff/people?q=Yıldız&tur=galeri', undefined, destek);
    expect(ara.body[0]).toMatchObject({
      tip: 'galeri',
      ad: 'Yıldız Otomotiv',
      alt: 'Galeri · Profesyonel paket',
    });
    const k = await staffCall(app, 'GET', `/staff/people/galeri/${accountId}`, undefined, destek);
    expect(k.body).toMatchObject({ telefon: '05•• ••• •• 31', ad: 'Yıldız Otomotiv' });
    expect(k.body.rozetler.map((r: { t: string }) => r.t)).toContain('✓ Onaylı galeri');
    expect(k.body.sayilar.map((s: { ad: string }) => s.ad)).toEqual([
      'Portföy',
      'İlk mesaj (30 gün)',
      'Ödeme (30 gün)',
      'Şikâyet',
      'Yıldız',
    ]);
  });
});
