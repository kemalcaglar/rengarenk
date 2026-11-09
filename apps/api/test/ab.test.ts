import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { armOf } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CampaignService } from '../src/campaigns/campaign.service.js';
import type { Db } from '../src/database/prisma.js';
import { StaffAlertService } from '../src/staff-alerts/staff-alert.service.js';
import { call, createTestApp } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
});
afterAll(() => app.close());

async function kisi(phone: string) {
  const id = uuidv7();
  await db.user.create({ data: { id, phone, firstName: 'Deneme', il: 'İzmir' } });
  await db.account.create({
    data: {
      id: uuidv7(),
      kind: 'INDIVIDUAL',
      name: 'Bireysel',
      members: { create: { userId: id, role: 'OWNER' } },
    },
  });
  await db.consent.create({
    data: { id: uuidv7(), userId: id, kind: 'ticari_ileti', granted: true, channel: 'web' },
  });
  await db.notificationPref.create({ data: { userId: id, konu: 'kampanya', kanal: 'uygulama', acik: true } });
  return id;
}

/** Kolu istenen ziyaretçi kimliği */
const ziyaretci = (bannerId: string, kol: 'A' | 'B') => {
  for (let i = 0; ; i++) if (armOf(`ziyaretci-${i}`, bannerId) === kol) return `ziyaretci-${i}`;
};

describe('A/B testleri (Karar 44, 46, 51)', () => {
  it('banner: kola göre içerik ve sayım, sonuç, kazananı herkese açma, ajan uyarısı', async () => {
    const pazarlama = await loginAs(app, await createStaff(db, 'MARKETING'));
    await createStaff(db, 'OWNER');
    const govde = {
      baslik: 'Galeriler için 30 gün ücretsiz',
      metin: 'Alıcılar seni bekliyor.',
      dugme: 'Başvur',
      url: '/kurumsal-basvuru',
      yer: 'anasayfa_ust',
      kitle: 'ziyaretci',
      platform: 'hepsi',
      renk: '#9B7BFF',
      baslangic: new Date(Date.now() - 60_000).toISOString(),
      bitis: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      b: { baslik: 'Galerilere ilk ay %50 indirim', metin: 'İlk ayın yarı fiyatına.', dugme: 'Başvur' },
    };
    const c = await staffCall(app, 'POST', '/staff/banners', govde, pazarlama.token);
    const id = c.body.bannerlar[0].id as string;
    expect(c.body.bannerlar[0].sonuc).toContain('A/B testi hazır');
    await staffCall(app, 'POST', `/staff/banners/${id}/publish`, {}, pazarlama.token);

    const gor = (z: string) => call(app, 'GET', `/icerik/banner?yer=anasayfa_ust&platform=web&z=${z}`);
    const a = (await gor(ziyaretci(id, 'A'))).body[0];
    const b = (await gor(ziyaretci(id, 'B'))).body[0];
    expect(a).toMatchObject({ kol: 'A', baslik: 'Galeriler için 30 gün ücretsiz' });
    expect(b).toMatchObject({ kol: 'B', baslik: 'Galerilere ilk ay %50 indirim' });
    // Kimliksiz ziyaretçi A görür
    expect((await call(app, 'GET', '/icerik/banner?yer=anasayfa_ust&platform=web')).body[0].kol).toBe('A');

    // Sayımlar (testte doğrudan): A 300 gösterim 6 tıklama, B 300 gösterim 30 tıklama
    const gun = new Date(
      `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())}T00:00:00Z`,
    );
    await db.bannerStat.createMany({
      data: [
        { bannerId: id, day: gun, arm: 'A', views: 300, clicks: 6 },
        { bannerId: id, day: gun, arm: 'B', views: 300, clicks: 30 },
      ],
    });
    // Olay ucu kolu yazar
    await call(app, 'POST', `/icerik/banner/${id}/olay`, { tur: 'tiklama', kol: 'B' });
    const l = await staffCall(app, 'GET', '/staff/banners', undefined, pazarlama.token);
    expect(l.body.bannerlar[0].sonuc).toBe('A/B · B önde: tıklama %10,3 / A %2 · güven %99');

    const r = await staffCall(app, 'GET', '/staff/reports/deney', undefined, pazarlama.token);
    const d = r.body.deneyler.find((x: { id: string }) => x.id === id);
    expect(d).toMatchObject({
      durum: 'Sonuç hazır',
      kazanan: 'B',
      eylem: { kol: 'B', yazi: 'B’yi herkese aç' },
    });
    expect(d.kollar.map((k: { deger: string }) => k.deger)).toEqual(['%2', '%10,3']);

    // Ajan kazananı bildirir (bir kez)
    const uyari = app.get(StaffAlertService);
    expect(await uyari.deneySonuc()).toBeGreaterThan(0);
    expect(await uyari.deneySonuc()).toBe(0);

    // Kazananı herkese aç: içerik B olur, herkes aynı sürümü görür
    const k = await staffCall(app, 'POST', `/staff/banners/${id}/ab/B`, {}, pazarlama.token);
    expect(k.body.bannerlar[0].ad).toBe('Galerilere ilk ay %50 indirim');
    expect((await gor(ziyaretci(id, 'A'))).body[0]).toMatchObject({
      kol: 'A',
      baslik: 'Galerilere ilk ay %50 indirim',
    });
    const r2 = await staffCall(app, 'GET', '/staff/reports/deney', undefined, pazarlama.token);
    expect(r2.body.deneyler.find((x: { id: string }) => x.id === id)).toMatchObject({
      durum: 'Tamamlandı',
      eylem: null,
    });
    expect((await staffCall(app, 'POST', `/staff/banners/${id}/ab/A`, {}, pazarlama.token)).status).toBe(409);
  });

  it('kampanya: kişiler kola göre farklı sürüm alır; okunma kola göre ölçülür', async () => {
    const pazarlama = await loginAs(app, await createStaff(db, 'MARKETING'));
    const kisiler: string[] = [];
    for (let i = 0; i < 12; i++) kisiler.push(await kisi(`+90534222${String(i).padStart(4, '0')}`));
    const s = await staffCall(
      app,
      'POST',
      '/staff/segments',
      { ad: 'İzmir A/B', kurallar: [{ alan: 'il', deger: ['İzmir'] }] },
      pazarlama.token,
    );
    const segmentId = (s.body.find?.((x: { ad: string }) => x.ad === 'İzmir A/B')?.id ??
      (await db.segment.findFirstOrThrow({ where: { name: 'İzmir A/B' } })).id) as string;
    const k = await staffCall(
      app,
      'POST',
      '/staff/campaigns',
      {
        ad: 'Üst sıra A/B',
        hedef: 'ust_sira',
        segmentId,
        kanallar: ['uygulama'],
        baslik: 'Talebin daha çok satıcıya ulaşsın',
        metin: 'Talebini üst sıraya taşı; daha çok ilk mesaj al.',
        dugme: 'Üst sıraya taşı',
        url: '/haklarim',
        zaman: new Date(Date.now() + 60_000).toISOString(),
        b: {
          baslik: 'Hafta sonu üst sıra',
          metin: 'Hafta sonu talebini öne çıkar, satıcılar seni görsün.',
          dugme: 'Öne çıkar',
        },
      },
      pazarlama.token,
    );
    expect(k.status).toBe(200);
    const id = k.body[0].id as string;
    expect(await app.get(CampaignService).dispatchDue(new Date(Date.now() + 120_000))).toBe(1);
    const bildirimler = await db.notification.findMany({ where: { campaignId: id } });
    expect(bildirimler).toHaveLength(12);
    for (const n of bildirimler)
      expect(n.baslik).toBe(
        armOf(n.userId, id) === 'A' ? 'Talebin daha çok satıcıya ulaşsın' : 'Hafta sonu üst sıra',
      );
    // B'yi alanların hepsi açtı
    await db.notification.updateMany({
      where: { campaignId: id, baslik: 'Hafta sonu üst sıra' },
      data: { readAt: new Date() },
    });
    const l = await staffCall(app, 'GET', '/staff/campaigns', undefined, pazarlama.token);
    expect(l.body.find((x: { id: string }) => x.id === id).sonuc).toMatch(
      /A\/B · B önde: okunma %100 \/ A %0/,
    );
    const r = await staffCall(app, 'GET', '/staff/reports/deney', undefined, pazarlama.token);
    const d = r.body.deneyler.find((x: { id: string }) => x.id === id);
    expect(d).toMatchObject({ tur: 'kampanya', eylem: null });
    expect(d.olcu).toBe('Ölçü: bildirimi uygulamada açanların oranı · 12 kişi');
  });
});
