import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApprovalExecutor } from '../src/approvals/approval-executor.js';
import { CampaignService } from '../src/campaigns/campaign.service.js';
import type { Db } from '../src/database/prisma.js';
import { createTestApp } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
});
afterAll(() => app.close());

/** Bireysel kişi: il, ticari onay ve kampanya bildirimi tercihi isteğe göre */
async function kisi(phone: string, o: { il?: string; onay?: boolean; uygulama?: boolean; eposta?: boolean }) {
  const id = uuidv7();
  await db.user.create({
    data: {
      id,
      phone,
      firstName: 'Deneme',
      il: o.il ?? null,
      ...(o.eposta ? { email: `${phone.slice(-4)}@ornek.com`, emailVerifiedAt: new Date() } : {}),
    },
  });
  await db.account.create({
    data: {
      id: uuidv7(),
      kind: 'INDIVIDUAL',
      name: 'Bireysel',
      members: { create: { userId: id, role: 'OWNER' } },
    },
  });
  if (o.onay !== undefined)
    await db.consent.create({
      data: { id: uuidv7(), userId: id, kind: 'ticari_ileti', granted: o.onay, channel: 'web' },
    });
  for (const kanal of ['uygulama', 'eposta'] as const)
    if (o[kanal])
      await db.notificationPref.create({ data: { userId: id, konu: 'kampanya', kanal, acik: true } });
  return id;
}

describe('Kampanyalar ve segmentler (Karar 49, 51)', () => {
  it('segment canlı sayılır; kampanya yalnızca onaylı ve izinli kişilere gider; sonuç ve grafik notu', async () => {
    const pazarlama = await loginAs(app, await createStaff(db, 'MARKETING'));
    const destek = await loginAs(app, await createStaff(db, 'SUPPORT'));
    const a = await kisi('+905341110001', { il: 'İzmir', onay: true, uygulama: true, eposta: true });
    const b = await kisi('+905341110002', { il: 'İzmir', onay: false, uygulama: true });
    const c = await kisi('+905341110003', { il: 'İzmir', onay: true });
    await kisi('+905341110004', { il: 'Ankara', onay: true, uygulama: true });

    const kurallar = [
      { alan: 'rol', deger: 'bireysel' },
      { alan: 'il', deger: ['İzmir'] },
    ];
    expect((await staffCall(app, 'POST', '/staff/segments/preview', { kurallar }, destek.token)).status).toBe(
      403,
    );
    const p = await staffCall(app, 'POST', '/staff/segments/preview', { kurallar }, pazarlama.token);
    expect(p.status).toBe(200);
    expect(p.body.adimlar.map((x: { sayi: number }) => x.sayi).at(-1)).toBe(3);
    expect(p.body.adimlar[1]).toMatchObject({ alan: 'İl', op: 'şunlardan biri', deger: 'İzmir' });
    // Ticari onaylı 2 kişi; kampanya bildirimini açan onaylı 1, e-postası doğrulanmış ve izinli 1
    expect(p.body.ulasim).toMatchObject({ toplam: 3, onayli: 2, uygulama: 1, eposta: 1, sinirda: 0 });

    const s = await staffCall(
      app,
      'POST',
      '/staff/segments',
      { ad: 'İzmir bireyselleri', kurallar },
      pazarlama.token,
    );
    const segmentId = s.body[0].id as string;
    expect(s.body[0]).toMatchObject({ ad: 'İzmir bireyselleri', sayi: 3 });

    const t = await staffCall(
      app,
      'POST',
      '/staff/campaigns/estimate',
      { segmentId, kanallar: ['uygulama', 'eposta'] },
      pazarlama.token,
    );
    expect(t.body).toMatchObject({ toplam: 3, ulasilan: 1, onayGerek: false, maliyet: 0 });

    const govde = {
      ad: 'Hafta sonu: talebini öne çıkar',
      hedef: 'ust_sira',
      segmentId,
      kanallar: ['uygulama', 'eposta'],
      baslik: 'Talebin daha çok satıcıya ulaşsın',
      metin: 'Talebini hafta sonu üst sıraya taşı; üst sıradaki talepler daha çok ilk mesaj alıyor.',
      dugme: 'Üst sıraya taşı',
      url: '/haklarim',
      zaman: new Date(Date.now() + 60_000).toISOString(),
    };
    expect(
      (
        await staffCall(
          app,
          'POST',
          '/staff/campaigns',
          { ...govde, url: 'https://kotu.example' },
          pazarlama.token,
        )
      ).status,
    ).toBe(400);
    const k = await staffCall(app, 'POST', '/staff/campaigns', govde, pazarlama.token);
    expect(k.status).toBe(200);
    expect(k.body[0]).toMatchObject({ durum: 'zamanlandi', kanal: 'Uygulama içi ve push ve E-posta' });

    // Zamanı gelince işçi gönderir: yalnızca onaylı ve izinli kişi
    const kampanya = app.get(CampaignService);
    expect(await kampanya.dispatchDue(new Date(Date.now() + 120_000))).toBe(1);
    const id = k.body[0].id as string;
    expect(await db.notification.count({ where: { campaignId: id } })).toBe(1);
    expect(await db.notification.count({ where: { campaignId: id, userId: a } })).toBe(1);
    expect(await db.notification.count({ where: { userId: { in: [b, c] }, campaignId: id } })).toBe(0);
    expect(await db.delivery.count({ where: { campaignId: id, kanal: 'eposta', userId: a } })).toBe(1);
    const liste = await staffCall(app, 'GET', '/staff/campaigns', undefined, pazarlama.token);
    expect(liste.body[0]).toMatchObject({ durum: 'gonderildi' });
    expect(liste.body[0].sonuc).toContain('1 kişiye gitti');
    expect(await db.chartNote.count({ where: { source: 'kampanya', refId: id } })).toBe(1);
    // Bir kez gönderilir
    expect(await kampanya.dispatchDue(new Date(Date.now() + 120_000))).toBe(0);
  });

  it('1.000 kişiyi aşan gönderim toplu gönderim onayı ister; onaylanınca zamanlanır', async () => {
    const sahip = await createStaff(db, 'OWNER');
    const owner = await loginAs(app, sahip);
    const pazarlama = await loginAs(app, await createStaff(db, 'MARKETING'));
    const segment = await db.segment.create({
      data: {
        id: uuidv7(),
        name: 'Herkes',
        rules: [{ alan: 'rol', deger: 'bireysel' }],
        createdBy: sahip.id,
      },
    });
    const kampanya = app.get(CampaignService);
    // Sınırı test için düşürmek yerine tahmini 1.000'in üstüne çıkarırız
    const asil = kampanya.estimate.bind(kampanya);
    kampanya.estimate = async (s, k) => ({ ...(await asil(s, k)), ulasilan: 1500, onayGerek: true });
    const k = await staffCall(
      app,
      'POST',
      '/staff/campaigns',
      {
        ad: 'Kasım bülteni',
        hedef: 'duyuru',
        segmentId: segment.id,
        kanallar: ['eposta'],
        baslik: 'Kasım’da Rengarenk',
        metin: 'Bu ay en çok aranan modeller ve güvenli alışveriş ipuçları.',
        dugme: 'Bülteni oku',
        url: '/',
        zaman: new Date(Date.now() + 3600_000).toISOString(),
      },
      pazarlama.token,
    );
    kampanya.estimate = asil;
    expect(k.status).toBe(200);
    const c = await db.campaign.findFirstOrThrow({ where: { name: 'Kasım bülteni' } });
    expect(c.status).toBe('onay_bekliyor');
    const approvalId = c.approvalId as string;
    expect(
      (await staffCall(app, 'POST', `/staff/approvals/${approvalId}/approve`, {}, owner.token)).status,
    ).toBe(200);
    expect(await app.get(ApprovalExecutor).execute(approvalId)).toBe('yurutuldu');
    expect((await db.campaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('zamanlandi');
    // İptal
    const i = await staffCall(app, 'POST', `/staff/campaigns/${c.id}/cancel`, {}, pazarlama.token);
    expect(i.body.find((x: { id: string }) => x.id === c.id).durum).toBe('iptal');
  });
});
