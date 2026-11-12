import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { gallerySlug } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { call, createTestApp, uyeOl } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
});
afterAll(() => app.close());

async function login(phone: string) {
  const v = { body: await uyeOl(app, phone) };
  const userId = (await db.user.findUniqueOrThrow({ where: { phone } })).id;
  return { token: v.body.accessToken as string, userId };
}

async function galeriUyesi(phone: string, ad: string, il: string, no: string) {
  const u = await login(phone);
  const accountId = uuidv7();
  const applicationId = uuidv7();
  await db.account.create({ data: { id: accountId, kind: 'BUSINESS', name: ad, businessKind: 'RENTAL' } });
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
      businessKind: 'RENTAL',
      displayName: ad,
      legalName: `${ad} Ltd. Şti.`,
      taxNo: `123456789${no}`,
      taxOffice: 'Muratpaşa',
      mersisNo: `012345678900001${no}`,
      il,
      ilce: 'Merkez',
      address: 'Cumhuriyet Cad. No: 1',
      authorityNo: '07-2021-001',
      plan: 'deneme',
      trialEndsAt: new Date(Date.now() + 30 * 86_400_000),
      applicationId,
      approvedAt: new Date(),
    },
  });
  return u;
}

const banner = (ek: object = {}) => ({
  baslik: 'Kiralama firmalarına 30 gün ücretsiz',
  metin: 'Bölgende kiralık araç arayan alıcılar var.',
  dugme: 'Paketleri gör',
  url: '/galeri-paneli?bolum=paket',
  yer: 'galeri_paneli',
  kitle: 'galeri',
  il: 'Antalya',
  platform: 'hepsi',
  renk: '#3DD68C',
  ...ek,
});

describe('Banner, duyuru ve vitrin (Karar 46)', () => {
  it('taslak, yayın, kitle ve il, sayımlar, durdurma, kopya ve vitrin ayarı', async () => {
    const pazarlama = await loginAs(app, await createStaff(db, 'MARKETING'));
    const destek = await loginAs(app, await createStaff(db, 'SUPPORT'));
    expect((await staffCall(app, 'POST', '/staff/banners', banner(), destek.token)).status).toBe(403);

    const c = await staffCall(app, 'POST', '/staff/banners', banner(), pazarlama.token);
    expect(c.status).toBe(200);
    const b0 = c.body.bannerlar[0];
    expect(b0).toMatchObject({
      ad: 'Kiralama firmalarına 30 gün ücretsiz',
      yer: 'Galeri paneli üstü',
      kitle: 'Galeri · Antalya',
      platform: 'Web ve mobil',
      tarih: 'Tarih seçilmedi',
      durum: 'Taslak',
    });
    // Tarihsiz yayınlanmaz
    expect(
      (await staffCall(app, 'POST', `/staff/banners/${b0.id}/publish`, {}, pazarlama.token)).status,
    ).toBe(400);
    const tarih = {
      baslangic: new Date(Date.now() - 60_000).toISOString(),
      bitis: new Date(Date.now() + 10 * 86_400_000).toISOString(),
    };
    await staffCall(app, 'PUT', `/staff/banners/${b0.id}`, banner(tarih), pazarlama.token);
    const y = await staffCall(app, 'POST', `/staff/banners/${b0.id}/publish`, {}, pazarlama.token);
    expect(y.body.bannerlar[0].durum).toBe('Yayında');
    // Yayındaki banner değişmez
    expect(
      (await staffCall(app, 'PUT', `/staff/banners/${b0.id}`, banner(tarih), pazarlama.token)).status,
    ).toBe(409);

    // Kitle: ziyaretçi ve İzmir'deki galeri görmez; Antalya'daki galeri görür (web ve mobil)
    const gor = (token?: string, platform = 'web') =>
      call(app, 'GET', `/icerik/banner?yer=galeri_paneli&platform=${platform}`, undefined, token);
    expect((await gor()).body).toEqual([]);
    const izmir = await galeriUyesi('+905321250001', 'Ege Kiralama', 'İzmir', '1');
    const antalya = await galeriUyesi('+905321250002', 'Akdeniz Kiralama', 'Antalya', '2');
    expect((await gor(izmir.token)).body).toEqual([]);
    const g = await gor(antalya.token, 'mobil');
    expect(g.body).toEqual([
      expect.objectContaining({
        baslik: 'Kiralama firmalarına 30 gün ücretsiz',
        dugme: 'Paketleri gör',
        url: '/galeri-paneli?bolum=paket',
        renk: '#3DD68C',
        zemin: '#E7FAF0',
      }),
    ]);
    expect((await call(app, 'GET', '/icerik/banner?yer=yok&platform=web')).status).toBe(400);

    // Sayımlar (kişisel veri yok)
    for (const tur of ['gosterim', 'gosterim', 'tiklama'])
      await call(app, 'POST', `/icerik/banner/${b0.id}/olay`, { tur });
    const l = await staffCall(app, 'GET', '/staff/banners', undefined, pazarlama.token);
    expect(l.body.bannerlar[0].sonuc).toBe('2 gösterim · tıklama %50');

    // Durdurulan banner kalkar; kopyası taslak olarak açılır; yalnızca taslak silinir
    const d = await staffCall(app, 'POST', `/staff/banners/${b0.id}/stop`, {}, pazarlama.token);
    expect(d.body.bannerlar.find((x: { id: string }) => x.id === b0.id).durum).toBe('Durduruldu');
    expect((await gor(antalya.token)).body).toEqual([]);
    expect(
      (await staffCall(app, 'DELETE', `/staff/banners/${b0.id}`, undefined, pazarlama.token)).status,
    ).toBe(409);
    const k = await staffCall(app, 'POST', `/staff/banners/${b0.id}/copy`, {}, pazarlama.token);
    const kopya = k.body.bannerlar.find((x: { durum: string }) => x.durum === 'Taslak');
    expect(kopya.tarih).toBe('Tarih seçilmedi');
    const s = await staffCall(app, 'DELETE', `/staff/banners/${kopya.id}`, undefined, pazarlama.token);
    expect(s.body.bannerlar).toHaveLength(1);

    // Vitrin: boş yerlere editör seçimi varsayılan açık; kapatmak işlem kaydına girer
    expect(l.body.vitrin).toMatchObject({ yer: 17, ucretli: 0, editor: true });
    const v = await staffCall(app, 'PUT', '/staff/banners/vitrin/editor', { acik: false }, pazarlama.token);
    expect(v.body.vitrin.editor).toBe(false);
    for (const action of [
      'banner_eklendi',
      'banner_yayinlandi',
      'banner_durduruldu',
      'vitrin_editor_degisti',
    ])
      expect(await db.auditLog.count({ where: { action } })).toBeGreaterThan(0);
  });
});
