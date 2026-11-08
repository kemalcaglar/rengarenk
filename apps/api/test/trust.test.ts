import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { gallerySlug } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { TrustService } from '../src/trust/trust.service.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;

const DAY = 86_400_000;

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

async function login(phone: string, ad?: [string, string], eski = true) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  const token = v.body.accessToken as string;
  if (ad) await call(app, 'PATCH', '/me', { firstName: ad[0], lastName: ad[1] }, token);
  // Yeni hesabın yıldızı sayılmaz; testte çoğu hesap eski sayılır
  const u = await db.user.update({
    where: { phone },
    data: eski ? { createdAt: new Date(Date.now() - 30 * DAY) } : {},
    select: { id: true },
  });
  return { token, userId: u.id };
}

async function galeri(phone: string, ad: string) {
  const u = await login(phone, ['Mert', 'Kaya']);
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
  return p.body.no as number;
}

const ua = (token: string, ajan: string) => ({ authorization: `Bearer ${token}`, 'user-agent': ajan });
const puanVer = (id: string, token: string, yildiz: number, ajan: string) =>
  app
    .inject({
      method: 'POST',
      url: `/conversations/${id}/rating`,
      payload: { yildiz },
      headers: ua(token, ajan),
    })
    .then((r) => ({ status: r.statusCode, body: JSON.parse(r.body) }));

/** Galeri ilk mesajı atar, alıcı yanıtlar, galeri yeniden yazar: yıldıza uygun sohbet */
async function sohbet(g: { token: string; accountId: string }, alici: { token: string }) {
  const no = await talep(alici.token);
  const ilk = await call(
    app,
    'POST',
    `/talepler/${no}/mesaj`,
    { metin: 'Merhaba', hesap: g.accountId },
    g.token,
  );
  const id = ilk.body.id as string;
  return {
    id,
    no,
    yanitla: async () => {
      await call(app, 'POST', `/conversations/${id}/messages`, { metin: 'Görebilir miyim?' }, alici.token);
    },
    saticiYazsin: async () => {
      await call(app, 'POST', `/conversations/${id}/messages`, { metin: 'Tabii, cumartesi uygun' }, g.token);
    },
  };
}

describe('yıldız, rozetler, galeri takibi, çalışan sınırı (Karar 20, 28, 55)', () => {
  it('yıldız yalnızca satıcı yanıtladıktan sonra, bir kez; şüpheli yıldız hesaba katılmaz', async () => {
    const g = await galeri('+905336660001', 'Yıldız Otomotiv');
    const a1 = await login('+905336660011', ['Ayşe', 'Yılmaz']);
    const s1 = await sohbet(g, a1);
    expect((await call(app, 'GET', `/conversations/${s1.id}/rating`, undefined, a1.token)).body.uygun).toBe(
      false,
    );
    await s1.yanitla();
    // Alıcının mesajından sonra satıcı yanıtı yok
    expect((await puanVer(s1.id, a1.token, 5, 'tarayici-1')).status).toBe(422);
    await s1.saticiYazsin();
    expect((await call(app, 'GET', '/ratings/pending', undefined, a1.token)).body).toMatchObject({
      sohbet: s1.id,
      ad: 'Yıldız Otomotiv',
      temsilci: 'Mert Kaya',
    });
    expect((await call(app, 'GET', `/conversations/${s1.id}`, undefined, a1.token)).body.puan).toEqual({
      uygun: true,
      verilen: null,
    });
    expect((await puanVer(s1.id, g.token, 5, 'tarayici-1')).status).toBe(422); // satıcı kendine veremez
    expect((await puanVer(s1.id, a1.token, 5, 'tarayici-1')).body).toEqual({ verilen: 5 });
    expect((await puanVer(s1.id, a1.token, 4, 'tarayici-1')).status).toBe(409);
    expect(await call(app, 'GET', '/ratings/pending', undefined, a1.token).then((r) => r.body)).toBeNull();

    // Yeni açılmış hesap
    const yeni = await login('+905336660012', ['Can', 'Tekin'], false);
    const s2 = await sohbet(g, yeni);
    await s2.yanitla();
    await s2.saticiYazsin();
    await puanVer(s2.id, yeni.token, 1, 'tarayici-2');
    expect(await db.rating.findUniqueOrThrow({ where: { conversationId: s2.id } })).toMatchObject({
      counted: false,
      flag: 'yeni_hesap',
    });

    // Aynı cihaz ve ağdan ikinci hesap: ikisi de hesaptan çıkar
    const a3 = await login('+905336660013', ['Deniz', 'Ak']);
    const s3 = await sohbet(g, a3);
    await s3.yanitla();
    await s3.saticiYazsin();
    await puanVer(s3.id, a3.token, 5, 'tarayici-1');
    expect((await db.rating.findMany({ where: { flag: 'ayni_cihaz' } })).length).toBe(2);

    // Galeri paneli: yalnızca sayılan yıldızlar; rozete ne kadar kaldığı; kimin verdiği görünmez
    const v = await call(app, 'GET', `/gallery/${g.accountId}/trust`, undefined, g.token);
    expect(v.body).toMatchObject({
      yildizSayisi: 0,
      yildizOrtalama: null,
      dagilim: [0, 0, 0, 0, 0],
      takipci: 0,
    });
    expect(v.body.rozetler.map((r: { rozet: string; var: boolean }) => [r.rozet, r.var])).toEqual([
      ['onay', true],
      ['hizli', false],
      ['guven', false],
    ]);
    expect(JSON.stringify(v.body)).not.toContain('Ayşe');
    expect((await call(app, 'GET', `/gallery/${g.accountId}/trust`, undefined, a1.token)).status).toBe(404);

    // Alıcı rozetleri görür (profil ve sohbet listesi); sayı görmez
    const profil = await call(app, 'GET', '/galeriler/yildiz-otomotiv');
    expect(profil.body.rozetler.map((r: { key: string }) => r.key)).toEqual(['onay']);
    expect(profil.body.ortalamaYanitDakika).toEqual(expect.any(Number));
    const liste = await call(app, 'GET', '/conversations', undefined, a1.token);
    expect(liste.body[0].rozetler[0]).toMatchObject({ key: 'onay', ad: '✓ Onaylı galeri' });

    const ozet = await app.get(TrustService).staffOverview();
    expect(ozet.yildiz.katilmayan).toBe(3);
    expect(ozet.isaretli.length).toBeGreaterThan(0);
  });

  it('galeri takibi ve çalışan başına günlük ilk mesaj sınırı', async () => {
    const g = await galeri('+905336661001', 'Kaya Motors');
    const alici = await login('+905336661011', ['Ece', 'Kara']);
    expect((await call(app, 'PUT', '/galeriler/kaya-motors/takip', undefined, alici.token)).body).toEqual({
      takip: true,
    });
    expect((await call(app, 'GET', '/galeriler/kaya-motors/takip', undefined, alici.token)).body.takip).toBe(
      true,
    );
    expect((await call(app, 'PUT', '/galeriler/kaya-motors/takip', undefined, g.token)).status).toBe(403);
    expect((await call(app, 'GET', `/gallery/${g.accountId}/trust`, undefined, g.token)).body.takipci).toBe(
      1,
    );
    expect(await app.get(TrustService).followDigest()).toBe(0);
    expect(
      (await call(app, 'DELETE', '/galeriler/kaya-motors/takip', undefined, alici.token)).body.takip,
    ).toBe(false);

    // Sahip kendine günde 1 ilk mesaj sınırı koyar
    const p = await call(
      app,
      'PATCH',
      `/gallery/${g.accountId}/members/${g.userId}/limit`,
      { gunlukSinir: 1 },
      g.token,
    );
    expect(p.body.ekip[0].gunlukSinir).toBe(1);
    const t1 = await talep(alici.token);
    const diger = await login('+905336661012', ['Ali', 'Veli']);
    const t2 = await talep(diger.token);
    expect(
      (await call(app, 'POST', `/talepler/${t1}/mesaj`, { metin: 'Merhaba', hesap: g.accountId }, g.token))
        .status,
    ).toBe(201);
    const ikinci = await call(
      app,
      'POST',
      `/talepler/${t2}/mesaj`,
      { metin: 'Merhaba', hesap: g.accountId },
      g.token,
    );
    expect(ikinci.status).toBe(403);
    expect(ikinci.body.message).toContain('kişisel ilk mesaj sınırın (1)');
    expect(
      (await call(app, 'GET', `/talepler/${t2}/mesaj?hesap=${g.accountId}`, undefined, g.token)).body.engel,
    ).toContain('kişisel');
    expect(await db.auditLog.count({ where: { action: 'galeri_mesaj_siniri' } })).toBe(1);
  });
});
