import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
});
afterAll(() => app.close());

async function login(phone: string) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  const u = await db.user.findUniqueOrThrow({ where: { phone } });
  return { token: v.body.accessToken as string, id: u.id };
}

describe('favori araçlar (PortfoyArac.dc.html › Favorilere ekle)', () => {
  it('ekle, durum, liste, satıştan kalkınca "Satışta değil", kendi galerisinin aracı eklenmez, çıkar', async () => {
    const alici = await login('+905338880001');
    const galerici = await login('+905338880002');
    const accountId = uuidv7();
    await db.account.create({
      data: { id: accountId, kind: 'BUSINESS', name: 'Favori Oto', businessKind: 'DEALER' },
    });
    await db.accountMember.create({ data: { accountId, userId: galerici.id, role: 'OWNER' } });
    const applicationId = uuidv7();
    await db.galleryApplication.create({
      data: {
        id: applicationId,
        userId: galerici.id,
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
        slug: 'favori-oto',
        businessKind: 'DEALER',
        displayName: 'Favori Oto',
        legalName: 'Favori Otomotiv Ltd. Şti.',
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
    const kategori = await db.category.findFirstOrThrow({ where: { slug: 'otomobil' } });
    const arac = await db.portfolioVehicle.create({
      data: {
        id: uuidv7(),
        accountId,
        categoryId: kategori.id,
        makeName: 'BMW',
        modelName: '320i',
        year: 2021,
        km: 40_000,
        priceTl: 2_100_000n,
        damage: { parcalar: {} },
        status: 'PUBLISHED',
        publishedAt: new Date(),
        createdBy: galerici.id,
      },
    });
    const no = Number(arac.no);

    expect((await call(app, 'PUT', `/araclar/${no}/favori`, undefined)).status).toBe(401);
    expect((await call(app, 'PUT', `/araclar/${no}/favori`, undefined, galerici.token)).status).toBe(400);
    expect((await call(app, 'PUT', `/araclar/${no}/favori`, undefined, alici.token)).status).toBe(204);
    expect((await call(app, 'PUT', `/araclar/${no}/favori`, undefined, alici.token)).status).toBe(204);
    expect((await call(app, 'GET', `/araclar/${no}/favori`, undefined, alici.token)).body).toEqual({
      favori: true,
    });
    const l = await call(app, 'GET', '/favoriler/araclar', undefined, alici.token);
    expect(l.body).toHaveLength(1);
    expect(l.body[0]).toMatchObject({ no, satista: true, fiyat: 2_100_000, galeri: { slug: 'favori-oto' } });

    // Satıştan kalkınca listede kalır, fiyat gösterilmez; yeni ekleme yapılamaz
    await db.portfolioVehicle.update({
      where: { id: arac.id },
      data: { status: 'SOLD', soldAt: new Date() },
    });
    expect((await call(app, 'GET', '/favoriler/araclar', undefined, alici.token)).body[0]).toMatchObject({
      satista: false,
      fiyat: null,
    });
    const baska = await login('+905338880003');
    expect((await call(app, 'PUT', `/araclar/${no}/favori`, undefined, baska.token)).status).toBe(404);

    expect((await call(app, 'DELETE', `/araclar/${no}/favori`, undefined, alici.token)).status).toBe(204);
    expect((await call(app, 'GET', '/favoriler/araclar', undefined, alici.token)).body).toEqual([]);
  });
});
