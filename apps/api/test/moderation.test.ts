import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApprovalExecutor } from '../src/approvals/approval-executor.js';
import type { Db } from '../src/database/prisma.js';
import { ModerationService } from '../src/moderation/moderation.service.js';
import { NotificationService } from '../src/notifications/notification.service.js';
import { NotificationEvents } from '../src/notifications/notification-events.js';
import { DemandSearchService } from '../src/search/demand-search.service.js';
import { call, createTestApp, uyeOl } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;
let mod: string;
let mod2: string;
let sahip: string;
let finans: string;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
  const bmw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  const s = await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: bmw.id, name: '3 Serisi', categories: ['otomobil'] },
  });
  await db.catalogModel.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi/320i', makeId: bmw.id, seriesId: s.id, name: '320i' },
  });
  mod = (await loginAs(app, await createStaff(db, 'MODERATOR'))).token;
  mod2 = (await loginAs(app, await createStaff(db, 'ADMIN'))).token;
  sahip = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
  finans = (await loginAs(app, await createStaff(db, 'FINANCE'))).token;
});
afterAll(() => app.close());

async function login(phone: string, ad?: [string, string]) {
  const v = { body: await uyeOl(app, phone) };
  const token = v.body.accessToken as string;
  if (ad) await call(app, 'PATCH', '/me', { firstName: ad[0], lastName: ad[1] }, token);
  const userId = (await db.user.findUniqueOrThrow({ where: { phone }, select: { id: true } })).id;
  return { token, userId, refresh: v.body.refreshToken as string };
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

const olaylar = () => new NotificationEvents(db, app.get(NotificationService), app.get(DemandSearchService));

describe('şikâyet ve moderasyon (Karar 41, 53)', () => {
  it('ajan kapora ve IBAN içeren mesajı gizler ve 24 saat askıya alır; moderatör karar verir, itiraz başka moderatöre', async () => {
    const alici = await login('+905338880001', ['Emre', 'Kaya']);
    const satici = await login('+905338880002', ['Okan', 'Bulut']);
    const t = await talep(alici.token);
    const ilk = await call(
      app,
      'POST',
      `/talepler/${t.no}/mesaj`,
      { metin: 'Araç elimde. Kapora için IBAN TR33 0006 1005 1978 6457 8413 26, hemen gönderin.' },
      satici.token,
    );
    expect(ilk.status).toBe(201);
    const cid = ilk.body.id as string;
    const m = await db.message.findFirstOrThrow({ where: { conversationId: cid, kind: 'metin' } });
    expect(m.flags).toEqual(expect.arrayContaining(['kapora', 'iban']));

    const ms = app.get(ModerationService);
    expect(await ms.ajanMesajKontrolu(m.id)).toBe('askiya_alindi');
    expect(await ms.ajanMesajKontrolu(m.id)).toBe('islem_yok'); // bir kez
    const ajanOlay = await db.outboxEvent.findFirstOrThrow({ where: { type: 'moderasyon.ajan_aski' } });
    expect(await olaylar().handle('moderasyon.ajan_aski', ajanOlay.payload as Record<string, unknown>)).toBe(
      1,
    );

    // Alıcı gizlenen mesajı görmez; satıcı askıdayken yazamaz
    const d = await call(app, 'GET', `/conversations/${cid}`, undefined, alici.token);
    expect(d.body.mesajlar[0]).toMatchObject({ gizli: true, metin: '', uyari: null });
    await call(
      app,
      'POST',
      `/conversations/${cid}/messages`,
      { metin: 'Merhaba, görmek isterim' },
      alici.token,
    );
    const yaz = await call(app, 'POST', `/conversations/${cid}/messages`, { metin: 'Buyurun' }, satici.token);
    expect(yaz.status).toBe(403);
    expect(yaz.body.message).toContain('mesaj gönderemezsin');

    // Alıcı da şikâyet eder; aynı hedefe ikinci şikâyet yenisini açmaz; kendi mesajını şikâyet edemez
    const sk = await call(
      app,
      'POST',
      '/reports',
      { hedef: 'mesaj', id: m.id, neden: 'kapora' },
      alici.token,
    );
    expect(sk.status).toBe(201);
    expect(sk.body.yeni).toBe(true);
    expect(
      (await call(app, 'POST', '/reports', { hedef: 'mesaj', id: m.id, neden: 'kapora' }, alici.token)).body
        .yeni,
    ).toBe(false);
    expect(
      (await call(app, 'POST', '/reports', { hedef: 'mesaj', id: m.id, neden: 'kapora' }, satici.token))
        .status,
    ).toBe(400);
    // Nedene göre hedef: "yanlış kategori" mesaj için seçilemez
    expect(
      (
        await call(
          app,
          'POST',
          '/reports',
          { hedef: 'mesaj', id: m.id, neden: 'yanlis_kategori' },
          alici.token,
        )
      ).status,
    ).toBe(400);

    // Kuyruk: ajan (kritik), kullanıcı (kritik) ve yasaklı kelime kuralı (normal)
    expect((await staffCall(app, 'GET', '/staff/moderation/reports', undefined, finans)).status).toBe(403);
    const q = await staffCall(app, 'GET', '/staff/moderation/reports', undefined, mod);
    const bu = q.body.acik.filter((x: { taraf: string }) => x.taraf.includes('Okan B.'));
    expect(bu.map((x: { oncelik: string }) => x.oncelik).sort()).toEqual(['kritik', 'kritik', 'normal']);
    const ajanSk = bu.find((x: { ajan: string | null }) => x.ajan);
    const det = await staffCall(app, 'GET', `/staff/moderation/reports/${ajanSk.id}`, undefined, mod);
    const hedef = det.body.kanit.satirlar.find((x: { hedef: boolean }) => x.hedef);
    expect(hedef.metin).toContain('TR•• •••• •••• •••• •••• ');
    expect(hedef.metin).not.toContain('0006');
    expect(det.body.oneri.karar).toBe('aski');
    expect(det.body.aski.until).toBeTruthy();

    // Karar: 24 saat askı; aynı içeriğin diğer şikâyetleri de kapanır; ikinci karar yok
    const k = await staffCall(
      app,
      'POST',
      `/staff/moderation/reports/${ajanSk.id}/decide`,
      { karar: 'aski', not: 'Kapora istendi.' },
      mod,
    );
    expect(k.status).toBe(200);
    expect(k.body.karar).toMatchObject({ karar: 'aski', kim: 'MODERATOR Test' });
    expect(
      (await staffCall(app, 'POST', `/staff/moderation/reports/${ajanSk.id}/decide`, { karar: 'red' }, mod))
        .status,
    ).toBe(409);
    expect(await db.report.count({ where: { targetId: m.id, status: 'acik' } })).toBe(0);
    expect(
      await db.userSanction.count({ where: { reportId: ajanSk.id, byAgent: true, liftedAt: null } }),
    ).toBe(0);
    expect(
      (await call(app, 'POST', `/conversations/${cid}/messages`, { metin: 'Buyurun' }, satici.token)).status,
    ).toBe(403);

    // Bildirimler: şikâyet edene sonuç, şikâyet edilene karar (tek)
    const ol = olaylar();
    for (const e of await db.outboxEvent.findMany({ where: { type: 'moderasyon.karar' } }))
      await ol.handle('moderasyon.karar', e.payload as Record<string, unknown>);
    const sb = await call(app, 'GET', '/notifications', undefined, satici.token);
    expect(
      sb.body.bildirimler.filter(
        (b: { baslik: string }) => b.baslik === 'Hesabınla ilgili moderasyon kararı',
      ),
    ).toHaveLength(1);
    const ab = await call(app, 'GET', '/notifications', undefined, alici.token);
    expect(ab.body.bildirimler.map((b: { baslik: string }) => b.baslik)).toContain('Şikâyetin sonuçlandı');

    // İtiraz: şikâyet eden göremez; şikâyet edilen 7 gün içinde bir kez; ilk kararı veren inceleyemez
    expect(
      (await call(app, 'GET', `/moderation/decisions/${ajanSk.id}`, undefined, alici.token)).status,
    ).toBe(404);
    const kd = await call(app, 'GET', `/moderation/decisions/${ajanSk.id}`, undefined, satici.token);
    expect(kd.body).toMatchObject({
      karar: 'aski',
      kararAd: '24 saat askı',
      itirazEdebilir: true,
      gerekce: 'Kapora istendi.',
    });
    const it = await call(
      app,
      'POST',
      `/moderation/decisions/${ajanSk.id}/appeal`,
      { metin: 'Kapora istemedim, alıcının sorusunu yanıtladım.' },
      satici.token,
    );
    expect(it.body.itiraz.durum).toBe('acik');
    expect(
      (
        await call(
          app,
          'POST',
          `/moderation/decisions/${ajanSk.id}/appeal`,
          { metin: 'İkinci kez itiraz ediyorum.' },
          satici.token,
        )
      ).status,
    ).toBe(409);
    const ap = (await staffCall(app, 'GET', '/staff/moderation/appeals', undefined, mod)).body.find(
      (a: { raporId: string }) => a.raporId === ajanSk.id,
    );
    expect(
      (await staffCall(app, 'POST', `/staff/moderation/appeals/${ap.id}/decide`, { kabul: true }, mod))
        .status,
    ).toBe(403);
    expect(
      (
        await staffCall(
          app,
          'POST',
          `/staff/moderation/appeals/${ap.id}/decide`,
          { kabul: true, not: 'Haklı.' },
          mod2,
        )
      ).status,
    ).toBe(200);
    expect(
      (await call(app, 'POST', `/conversations/${cid}/messages`, { metin: 'Buyurun' }, satici.token)).status,
    ).toBe(201);
    expect(
      (await call(app, 'GET', `/moderation/decisions/${ajanSk.id}`, undefined, satici.token)).body,
    ).toMatchObject({
      itiraz: { durum: 'kabul' },
      itirazEdebilir: false,
    });
  });

  it('talep gizlenir (sahibi yeniden yayına alamaz); kalıcı engelleme onayla hesabı kapatır', async () => {
    const sahte = await login('+905338880011', ['Can', 'Tan']);
    const sikayetci = await login('+905338880012', ['Deniz', 'Ak']);
    const t = await talep(sahte.token);
    const sk = await call(
      app,
      'POST',
      '/reports',
      { hedef: 'talep', id: String(t.no), neden: 'sahte', aciklama: 'Bu bir ilan, talep değil.' },
      sikayetci.token,
    );
    expect(sk.status).toBe(201);
    const r = await db.report.findFirstOrThrow({ where: { targetId: t.id } });
    expect(r.priority).toBe('yuksek');
    await staffCall(app, 'POST', `/staff/moderation/reports/${r.id}/decide`, { karar: 'gizle' }, mod);
    const d = await db.demand.findUniqueOrThrow({ where: { id: t.id } });
    expect(d).toMatchObject({ status: 'PASSIVE', passiveReason: 'moderasyon' });
    expect((await call(app, 'POST', `/demands/${t.id}/activate`, {}, sahte.token)).status).toBe(409);
    expect(
      await db.outboxEvent.count({
        where: { type: 'talep.pasife_alindi', payload: { path: ['demandId'], equals: t.id } },
      }),
    ).toBe(1);

    // Kalıcı engelleme: öneri onay kuyruğuna; onaya kadar askı; onaylanınca hesap kapanır, oturum düşer
    const hesap = await db.accountMember.findFirstOrThrow({ where: { userId: sahte.userId } });
    await db.entitlementLedger.create({
      data: {
        accountId: hesap.accountId,
        kind: 'talep',
        delta: 1,
        reason: 'tanimlama',
        sourceType: 'staff_grant',
        sourceId: uuidv7(),
        createdBy: sahte.userId,
      },
    });
    const t2 = await talep(sahte.token);
    await call(
      app,
      'POST',
      '/reports',
      { hedef: 'talep', id: String(t2.no), neden: 'dolandiricilik' },
      sikayetci.token,
    );
    const r2 = await db.report.findFirstOrThrow({ where: { targetId: t2.id } });
    const e = await staffCall(
      app,
      'POST',
      `/staff/moderation/reports/${r2.id}/decide`,
      { karar: 'engel', not: 'Tekrarlayan sahte talep.' },
      mod,
    );
    expect(e.body.karar.onay).toBe('PENDING');
    const onay = await db.approval.findFirstOrThrow({
      where: { kind: 'PERMANENT_BAN', subjectId: sahte.userId },
    });
    expect((await staffCall(app, 'POST', `/staff/approvals/${onay.id}/approve`, {}, mod)).status).toBe(403); // isteyen onaylayamaz
    expect((await staffCall(app, 'POST', `/staff/approvals/${onay.id}/approve`, {}, sahip)).status).toBe(200);
    expect(await app.get(ApprovalExecutor).execute(onay.id)).toBe('yurutuldu');
    expect((await db.user.findUniqueOrThrow({ where: { id: sahte.userId } })).status).toBe('SUSPENDED');
    expect((await db.demand.findUniqueOrThrow({ where: { id: t2.id } })).passiveReason).toBe('moderasyon');
    expect((await call(app, 'POST', '/auth/refresh', { refreshToken: sahte.refresh })).status).toBe(401);
  });

  it('uyarı 30 gün içinde ikinci kez otomatik askı; filtreler ve yasaklı kelimeler; numara gizleme', async () => {
    const alici = await login('+905338880021', ['Selin', 'Kurt']);
    const satici = await login('+905338880022', ['Burak', 'Oz']);
    const t = await talep(alici.token);
    const ilk = await call(
      app,
      'POST',
      `/talepler/${t.no}/mesaj`,
      { metin: 'Aracım var, numaram 0532 111 22 33' },
      satici.token,
    );
    const cid = ilk.body.id as string;
    // Telefon izni kapalı alıcıda numara gizlenir
    const d = await call(app, 'GET', `/conversations/${cid}`, undefined, alici.token);
    expect(d.body.mesajlar[0].metin).toBe('Aracım var, numaram [numara gizlendi]');
    await call(app, 'PUT', '/staff/moderation/filters/tel', { acik: false }, undefined);
    expect(
      (await staffCall(app, 'PUT', '/staff/moderation/filters/tel', { acik: false }, mod)).body.filtreler[0]
        .acik,
    ).toBe(false);
    expect(
      (await call(app, 'GET', `/conversations/${cid}`, undefined, alici.token)).body.mesajlar[0].metin,
    ).toContain('0532');
    await staffCall(app, 'PUT', '/staff/moderation/filters/tel', { acik: true }, mod);

    // Yasaklı kelime: konsoldan eklenir, mesajda kural şikâyeti açılır
    const w = await staffCall(app, 'POST', '/staff/moderation/words', { kelime: 'noterde göstermem' }, mod);
    expect(w.body.kelimeler).toContain('noterde göstermem');
    await call(app, 'POST', `/conversations/${cid}/messages`, { metin: 'Görüşelim' }, alici.token);
    await call(
      app,
      'POST',
      `/conversations/${cid}/messages`,
      { metin: 'Aracı noterde göstermem, kusura bakmayın' },
      satici.token,
    );
    const kural = await db.report.findFirstOrThrow({
      where: { source: 'kural', targetUserId: satici.userId },
    });
    expect(kural.signals).toEqual(['noterde göstermem']);
    await staffCall(
      app,
      'DELETE',
      `/staff/moderation/words/${encodeURIComponent('noterde göstermem')}`,
      undefined,
      mod,
    );

    // İki uyarı: ikincisi otomatik 24 saat askı
    await staffCall(app, 'POST', `/staff/moderation/reports/${kural.id}/decide`, { karar: 'uyari' }, mod);
    expect(
      (await call(app, 'POST', `/conversations/${cid}/messages`, { metin: 'Yine de yazayım' }, satici.token))
        .status,
    ).toBe(201);
    const son = await db.message.findFirstOrThrow({
      where: { conversationId: cid, side: 'satici' },
      orderBy: { createdAt: 'desc' },
    });
    await call(app, 'POST', '/reports', { hedef: 'mesaj', id: son.id, neden: 'spam' }, alici.token);
    const r2 = await db.report.findFirstOrThrow({ where: { targetId: son.id } });
    await staffCall(app, 'POST', `/staff/moderation/reports/${r2.id}/decide`, { karar: 'uyari' }, mod);
    expect(
      (await call(app, 'POST', `/conversations/${cid}/messages`, { metin: 'Deneme' }, satici.token)).status,
    ).toBe(403);

    // Satıcı göstergesinde şikâyet oranı
    const acc = await db.accountMember.findFirstOrThrow({ where: { userId: satici.userId } });
    const { TrustService } = await import('../src/trust/trust.service.js');
    await app.get(TrustService).recompute(acc.accountId);
    const st = await db.sellerStats.findUniqueOrThrow({ where: { accountId: acc.accountId } });
    expect(st.complaintRate).toBeGreaterThan(0);
  });
});
