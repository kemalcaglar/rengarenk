import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { NotificationService } from '../src/notifications/notification.service.js';
import { NotificationEvents } from '../src/notifications/notification-events.js';
import { DemandSearchService } from '../src/search/demand-search.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

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

async function login(phone: string, ad: [string, string]) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  const token = v.body.accessToken as string;
  await call(app, 'PATCH', '/me', { firstName: ad[0], lastName: ad[1] }, token);
  const userId = (await db.user.findUniqueOrThrow({ where: { phone }, select: { id: true } })).id;
  return { token, userId };
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
  expect(p.status).toBe(200);
  return { id: d.body.id as string, no: p.body.no as number };
}

const olaylar = () => new NotificationEvents(db, app.get(NotificationService), app.get(DemandSearchService));

describe('Talepler ve portföy (YonetimPazar.dc.html › talep; Karar 53)', () => {
  it('talepte düzeltme iste, kategori öner, gizle; araçta belge iste, gizle; sahibine gerekçeyle bildirilir', async () => {
    const alici = await login('+905339990011', ['Ayşe', 'Yılmaz']);
    const t1 = await talep(alici.token);
    const t2 = await talep((await login('+905339990013', ['Deniz', 'Ak'])).token);
    const t3 = await talep((await login('+905339990014', ['Selin', 'Kara'])).token);
    const mod = (await loginAs(app, await createStaff(db, 'MODERATOR'))).token;
    const finans = (await loginAs(app, await createStaff(db, 'FINANCE'))).token;
    expect((await staffCall(app, 'GET', '/staff/listings/talep', undefined, finans)).status).toBe(403);

    const liste = (await staffCall(app, 'GET', '/staff/listings/talep', undefined, mod)).body;
    expect(liste.find((r: { id: string }) => r.id === t1.id)).toMatchObject({
      alt: `No ${t1.no} · Ayşe Y. · İstanbul`,
      b: 'Otomobil',
      c: '0',
      durum: 'Yayında',
      ton: 'yesil',
      url: `/talep/${t1.no}`,
    });

    // Düzeltme iste: talep yayında kalır, not sahibinin Taleplerim'inde ve bildiriminde
    const gerekce = 'Başlık aradığın aracı anlatmıyor; marka ve modeli yazar mısın?';
    const d = await staffCall(
      app,
      'POST',
      '/staff/listings/talep/islem',
      { ids: [t1.id], islem: 'duzeltme', gerekce },
      mod,
    );
    expect(d.body).toEqual({ yapilan: 1, atlanan: [] });
    expect(await olaylar().handle('talep.calisan_duzeltme', { demandId: t1.id })).toBe(1);
    const bildirim = await db.notification.findFirstOrThrow({
      where: { userId: alici.userId, sablon: 'talep.calisan_duzeltme' },
    });
    expect(bildirim.metin).toContain(gerekce);
    const mine = (await call(app, 'GET', '/demands/mine', undefined, alici.token)).body;
    expect(mine.items.find((x: { id: string }) => x.id === t1.id).duzeltme).toMatchObject({
      alanlar: [],
      not: gerekce,
    });

    // Kategori öner: talep yerinde kalır, "Kategori öneriliyor"
    const kat = (await call(app, 'GET', '/categories')).body.find(
      (c: { slug: string }) => c.slug !== 'otomobil',
    );
    expect(
      (
        await staffCall(
          app,
          'POST',
          '/staff/listings/talep/islem',
          {
            ids: [t2.id],
            islem: 'kategori',
            gerekce: 'Talebin bu kategoride daha çok satıcıya ulaşır.',
            kategori: kat.slug,
          },
          mod,
        )
      ).body,
    ).toEqual({ yapilan: 1, atlanan: [] });
    expect(await olaylar().handle('talep.kategori_onerisi', { demandId: t2.id, gerekce: 'x' })).toBe(1);

    // Gizle: çalışan kaynaklı moderasyon kararı, gerekçe karar notunda; ikinci kez gizlenmez
    const g = await staffCall(
      app,
      'POST',
      '/staff/listings/talep/islem',
      { ids: [t3.id], islem: 'gizle', gerekce: 'Talep, satış ilanı gibi yazılmış.' },
      mod,
    );
    expect(g.body).toEqual({ yapilan: 1, atlanan: [] });
    expect(await db.demand.findUniqueOrThrow({ where: { id: t3.id } })).toMatchObject({
      status: 'PASSIVE',
      passiveReason: 'moderasyon',
    });
    expect(await db.report.findFirstOrThrow({ where: { targetId: t3.id, source: 'calisan' } })).toMatchObject(
      { decision: 'gizle', decisionNote: 'Talep, satış ilanı gibi yazılmış.', status: 'kapali' },
    );
    expect(
      (
        await staffCall(
          app,
          'POST',
          '/staff/listings/talep/islem',
          { ids: [t3.id], islem: 'gizle', gerekce: 'Talep, satış ilanı gibi yazılmış.' },
          mod,
        )
      ).body,
    ).toEqual({ yapilan: 0, atlanan: [`No ${t3.no}`] });

    const sonra = (await staffCall(app, 'GET', '/staff/listings/talep', undefined, mod)).body;
    const durum = (id: string) => sonra.find((r: { id: string }) => r.id === id);
    expect(durum(t1.id)).toMatchObject({ durum: 'Düzeltme istendi', ton: 'sari' });
    expect(durum(t2.id)).toMatchObject({ durum: 'Kategori öneriliyor', b: `Otomobil → ${kat.name}` });
    expect(durum(t3.id)).toMatchObject({ durum: 'Gizlendi', ton: 'kirmizi' });

    // Portföy: galeri ve araç
    const galerici = await login('+905339990012', ['Okan', 'Bulut']);
    const accountId = uuidv7();
    await db.account.create({
      data: { id: accountId, kind: 'BUSINESS', name: 'Liste Oto', businessKind: 'DEALER' },
    });
    await db.accountMember.create({ data: { accountId, userId: galerici.userId, role: 'OWNER' } });
    const applicationId = uuidv7();
    await db.galleryApplication.create({
      data: {
        id: applicationId,
        userId: galerici.userId,
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
        slug: 'liste-oto',
        businessKind: 'DEALER',
        displayName: 'Liste Oto',
        legalName: 'Liste Otomotiv Ltd. Şti.',
        taxNo: '1234567892',
        taxOffice: 'Kadıköy',
        mersisNo: '0123456789000017',
        il: 'İstanbul',
        ilce: 'Kadıköy',
        address: 'Moda Cad. No: 3',
        plan: 'profesyonel',
        applicationId,
        approvedAt: new Date(),
      },
    });
    const kategori = await db.category.findFirstOrThrow({ where: { slug: 'otomobil' } });
    const arac = await db.portfolioVehicle.create({
      data: {
        id: uuidv7(),
        accountId,
        categoryId: kategori.id,
        makeKey: 'bmw',
        seriesKey: 'bmw/3-serisi',
        modelKey: 'bmw/3-serisi/320i',
        year: 2020,
        km: 40_000,
        priceTl: 1_920_000n,
        damage: { parcalar: {} },
        status: 'PUBLISHED',
        publishedAt: new Date(),
        createdBy: galerici.userId,
      },
    });
    const araclar = (await staffCall(app, 'GET', '/staff/listings/arac', undefined, mod)).body;
    expect(araclar[0]).toMatchObject({
      ad: '2020 BMW 3 Serisi 320i',
      alt: 'Liste Oto · İstanbul',
      b: 'Doğrulanmadı',
      c: '₺1.920.000',
      durum: 'Yayında',
    });
    const not = 'Araç için güncel ekspertiz raporunu yükler misin?';
    await staffCall(
      app,
      'POST',
      '/staff/listings/arac/islem',
      { ids: [arac.id], islem: 'belge', gerekce: not },
      mod,
    );
    const olay = await db.outboxEvent.findFirstOrThrow({ where: { type: 'portfoy.belge_istendi' } });
    expect(olay.payload).toEqual({ vehicleId: arac.id, not });
    expect(await olaylar().handle('portfoy.belge_istendi', olay.payload as Record<string, unknown>)).toBe(1);
    await staffCall(
      app,
      'POST',
      '/staff/listings/arac/islem',
      {
        ids: [arac.id],
        islem: 'gizle',
        gerekce: 'Araç fotoğrafları başka bir ilandan kopyalanmış görünüyor.',
      },
      mod,
    );
    expect(
      (await db.portfolioVehicle.findUniqueOrThrow({ where: { id: arac.id } })).moderatedAt,
    ).not.toBeNull();
    expect((await staffCall(app, 'GET', '/staff/listings/arac', undefined, mod)).body[0]).toMatchObject({
      durum: 'Gizlendi',
    });
  });
});
