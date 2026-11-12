import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { defaultHomeLayout, gallerySlug } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HomeService } from '../src/content/home.service.js';
import type { Db } from '../src/database/prisma.js';
import { call, createTestApp, uyeOl } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
  const bmw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: bmw.id, name: '3 Serisi', categories: ['otomobil'] },
  });
});
afterAll(() => app.close());

async function login(phone: string) {
  const v = { body: await uyeOl(app, phone) };
  const userId = (await db.user.findUniqueOrThrow({ where: { phone } })).id;
  return { token: v.body.accessToken as string, userId };
}

async function talep(token: string) {
  const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, token);
  await call(
    app,
    'PATCH',
    `/demands/${d.body.id}`,
    {
      data: {
        alanlar: { model: { make: 'bmw', series: 'bmw/3-serisi' }, konum: { il: 'İzmir', ilce: 'Konak' } },
        alternatifler: [{ butce: { min: 1_500_000, max: 2_000_000 }, yil: { min: 2019, max: 2023 } }],
      },
      step: 6,
    },
    token,
  );
  expect((await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, token)).status).toBe(200);
}

const anasayfa = (token?: string, platform = 'web') =>
  call(app, 'GET', `/icerik/anasayfa?platform=${platform}`, undefined, token);

describe('Ana sayfa düzeni (Karar 46)', () => {
  it('sürümlü yayın, zamanlama, geri dönüş; kitleye göre bölümler ve kişiye özel veriler', async () => {
    const pazarlama = await loginAs(app, await createStaff(db, 'MARKETING'));
    const destek = await loginAs(app, await createStaff(db, 'SUPPORT'));

    // Yayın yokken varsayılan düzen (tasarımdaki bölümler)
    expect((await anasayfa()).body).toEqual({ kitle: 'ziyaretci', sira: ['karsi', 'kat', 'vitrin', 'son'] });
    expect((await anasayfa(undefined, 'mobil')).body.sira).toEqual(['karsi', 'vitrin', 'son', 'nasil']);

    const d = defaultHomeLayout();
    d.ziyaretci.web.gizli = d.ziyaretci.web.gizli.filter((x) => x !== 'sss');
    d.bireysel.web.gizli = [];
    d.bireysel.web.sira = ['karsi', 'mesaj', 'taleplerim', 'duyuru', 'arama', 'kat', 'vitrin', 'son'];
    d.galeri.web.gizli = [];
    const yayinla = (duzen: object, token = pazarlama.token, zaman: string | null = null) =>
      staffCall(app, 'POST', '/staff/home-layout', { duzen, zaman }, token);
    expect((await yayinla(d, destek.token)).status).toBe(403);
    // Karşılama kapatılamaz
    const kotu = defaultHomeLayout();
    kotu.galeri.web.gizli.push('karsi');
    expect((await yayinla(kotu)).status).toBe(400);

    const y = await yayinla(d);
    expect(y.status).toBe(200);
    expect(y.body.yayinda.surum).toBe(1);
    expect(y.body.surumler[0]).toMatchObject({ no: 's.1', durum: 'Yayında', don: false });
    expect(y.body.surumler[0].not).toContain('Ziyaretçi · web: “Sık sorulanlar” açıldı');
    expect(y.body.surumler[0].not).toContain('Bireysel üye · web: “Gelen ilk mesajlar” yukarı taşındı');
    expect((await anasayfa()).body.sira).toEqual(['karsi', 'kat', 'vitrin', 'son', 'sss']);
    // Aynı düzen ikinci kez yayınlanmaz
    expect((await yayinla(d)).status).toBe(400);

    // İleri tarihe zamanlama: şimdilik yayındaki değişmez, zamanı gelince geçer
    const z = defaultHomeLayout();
    const ileri = new Date(Date.now() + 3_600_000);
    const zl = await yayinla(z, pazarlama.token, ileri.toISOString());
    expect(zl.body.zamanli.surum).toBe(2);
    expect(zl.body.yayinda.surum).toBe(1);
    expect((await app.get(HomeService).aktif(new Date(ileri.getTime() + 60_000))).surum).toBe(2);

    // Bireysel üye: taleplerim ve gelen ilk mesajlar
    const alici = await login('+905321260001');
    await talep(alici.token);
    const b = await anasayfa(alici.token);
    expect(b.body.kitle).toBe('bireysel');
    expect(b.body.sira).toEqual(['karsi', 'mesaj', 'taleplerim', 'duyuru', 'arama', 'kat', 'vitrin', 'son']);
    expect(b.body.taleplerim).toHaveLength(1);
    expect(b.body.taleplerim[0]).toMatchObject({ yazan: 0 });
    expect(b.body.taleplerim[0].kalanGun).toBeGreaterThan(0);
    expect(b.body.mesajlar).toEqual([]);

    // Galeri: karşılama (paket, bugünkü hak), aranan modeller
    const sahip = await login('+905321260002');
    const accountId = uuidv7();
    const applicationId = uuidv7();
    await db.account.create({
      data: { id: accountId, kind: 'BUSINESS', name: 'Ege Oto', businessKind: 'DEALER' },
    });
    await db.accountMember.create({ data: { accountId, userId: sahip.userId, role: 'OWNER' } });
    await db.galleryApplication.create({
      data: {
        id: applicationId,
        userId: sahip.userId,
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
        slug: gallerySlug('Ege Oto'),
        businessKind: 'DEALER',
        displayName: 'Ege Oto',
        legalName: 'Ege Oto Ltd. Şti.',
        taxNo: '1234567890',
        taxOffice: 'Konak',
        mersisNo: '0123456789000015',
        il: 'İzmir',
        ilce: 'Konak',
        address: 'Cumhuriyet Blv. No: 1',
        authorityNo: '35-2021-001',
        plan: 'deneme',
        trialEndsAt: new Date(Date.now() + 30 * 86_400_000),
        applicationId,
        approvedAt: new Date(),
      },
    });
    const g = await anasayfa(sahip.token);
    expect(g.body.kitle).toBe('galeri');
    expect(g.body.sira).toEqual(['karsi', 'eslesme', 'hak', 'aranan', 'duyuru', 'vitrin', 'son']);
    expect(g.body.galeri).toMatchObject({
      ad: 'Ege Oto',
      paket: 'Deneme',
      il: 'İzmir',
      portfoy: 0,
      okunmamis: 0,
      ek: 0,
    });
    expect(g.body.galeri.gunluk.kalan).toBe(g.body.galeri.gunluk.toplam);
    expect(g.body.aranan).toMatchObject({
      bolge: 'Türkiye genelinde',
      modeller: [{ sira: 1, ad: 'BMW 3 Serisi', talep: 1, arac: 0 }],
    });

    // Geri dönüş: s.1 yeni sürüm olarak yayınlanır, bekleyen zamanlama düşer
    const g1 = await staffCall(app, 'POST', '/staff/home-layout/rollback/1', {}, pazarlama.token);
    expect(g1.body.yayinda.surum).toBe(2);
    expect(g1.body.zamanli).toBeNull();
    expect(g1.body.surumler[0].not).toBe('s.1 sürümüne dönüldü');
    for (const action of ['ana_sayfa_yayinlandi', 'ana_sayfa_zamanlandi'])
      expect(await db.auditLog.count({ where: { action } })).toBeGreaterThan(0);
  });
});
