import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseModule } from '../src/database/database.module.js';
import type { Db } from '../src/database/prisma.js';
import { GalleriesWorkerModule } from '../src/galleries/galleries.module.js';
import { GalleryService } from '../src/galleries/gallery.service.js';
import { GalleryApplicationService } from '../src/galleries/gallery-application.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { StorageModule } from '../src/storage/storage.service.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;
let apps: GalleryApplicationService;
let galleries: GalleryService;
let staffToken: string;

const PDF = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\n%%EOF\n');
const DAY = 86_400_000;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
  apps = app.get(GalleryApplicationService);
  galleries = app.get(GalleryService);
  const owner = await createStaff(db, 'OWNER');
  staffToken = (await loginAs(app, owner)).token;
});
afterAll(() => app.close());

async function login(phone: string) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  return v.body.accessToken as string;
}

const form = (yetkiNo: string, gorunenAd: string) => ({
  tur: 'DEALER',
  unvan: `${gorunenAd} Ltd. Şti.`,
  gorunenAd,
  vergiNo: '1234567890',
  vergiDairesi: 'Kadıköy',
  mersis: '0123456789000015',
  il: 'İstanbul',
  ilce: 'Kadıköy',
  adres: 'Caferağa Mah. Moda Cad. No: 1',
  yetkiNo,
  sahip: { ad: 'Selin', soyad: 'Yıldız', gorev: 'Kurucu', eposta: 'selin@ornek.com.tr' },
});

const upload = (token: string, kind: string, body: Buffer = PDF, type = 'application/pdf') =>
  app
    .inject({
      method: 'POST',
      url: `/gallery-applications/me/documents/${kind}`,
      payload: body,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': type,
        'x-file-name': encodeURIComponent('vergi levhası.pdf'),
      },
    })
    .then((r) => ({ status: r.statusCode, body: JSON.parse(r.body) }));

async function basvur(token: string, yetkiNo: string, ad: string) {
  expect((await call(app, 'PATCH', '/gallery-applications/me', form(yetkiNo, ad), token)).status).toBe(200);
  for (const k of ['vergi_levhasi', 'sicil_gazetesi', 'oda_kayit'])
    expect((await upload(token, k)).status).toBe(201);
  const s = await call(
    app,
    'POST',
    '/gallery-applications/me/submit',
    { sozlesme: true, ticariIleti: true },
    token,
  );
  expect(s.status).toBe(200);
  expect(s.body.durum).toBe('SUBMITTED');
  return s.body.id as string;
}

describe('kurumsal hesap başvurusu (Karar 03, 12.5, 17)', () => {
  it('taslak, belge, bakanlık doğrulaması, gönderim; kontrollerin hepsi geçince ajan onaylar ve deneme başlar', async () => {
    const t = await login('+905328880001');
    expect((await call(app, 'GET', '/gallery-applications/me', undefined, t)).body).toBeNull();

    // Taslak adım adım kaydedilir
    await call(app, 'PATCH', '/gallery-applications/me', { tur: 'DEALER' }, t);
    const d = await call(
      app,
      'PATCH',
      '/gallery-applications/me',
      { gorunenAd: 'Yıldız Otomotiv', sahip: { ad: 'Selin' } },
      t,
    );
    expect(d.body.veri).toMatchObject({
      tur: 'DEALER',
      gorunenAd: 'Yıldız Otomotiv',
      sahip: { ad: 'Selin' },
    });

    // Belge: gerçek tür baytlardan; istenmeyen tür ve sahte PDF reddedilir
    expect((await upload(t, 'turizm_belgesi')).status).toBe(400);
    expect((await upload(t, 'vergi_levhasi', Buffer.from('merhaba'))).status).toBe(400);
    const u = await upload(t, 'vergi_levhasi');
    expect(u.body.belgeler).toEqual([
      expect.objectContaining({ kind: 'vergi_levhasi', ad: 'vergi levhası.pdf' }),
    ]);

    // Sözleşme onayı olmadan gönderilemez
    expect((await call(app, 'POST', '/gallery-applications/me/submit', {}, t)).status).toBe(400);

    await call(app, 'PATCH', '/gallery-applications/me', form('34-2021-001', 'Yıldız Otomotiv'), t);

    // "Bakanlık sisteminden doğrula"
    const v = await call(app, 'POST', '/gallery-applications/me/verify-authority', undefined, t);
    expect(v.body.sonuc).toBe('gecti');

    const id = await basvur(t, '34-2021-001', 'Yıldız Otomotiv');
    // Gönderilen başvuru değiştirilemez; ikinci açık başvuru da açılamaz
    expect((await call(app, 'PATCH', '/gallery-applications/me', { gorunenAd: 'X' }, t)).status).toBe(409);

    // Sözleşme onayı ve ticari ileti onayı rıza kaydında, metin sürümüyle
    const rizalar = await db.consent.findMany({
      where: { kind: { in: ['galeri_sozlesmesi', 'ticari_ileti'] }, granted: true, textKey: { not: null } },
    });
    expect(rizalar.map((r) => r.kind)).toEqual(expect.arrayContaining(['galeri_sozlesmesi', 'ticari_ileti']));

    const r = await apps.runChecks(id);
    expect(r?.hepsi).toBe(true);
    expect(await apps.runChecks(id)).toBeNull(); // ikinci kez işlenmez

    const mine = (await call(app, 'GET', '/gallery-applications/me', undefined, t)).body;
    expect(mine.durum).toBe('APPROVED');
    expect(mine.galeri.slug).toBe('yildiz-otomotiv');
    const g = await db.gallery.findUniqueOrThrow({ where: { slug: 'yildiz-otomotiv' } });
    expect(g.plan).toBe('deneme');
    expect(Math.round(((g.trialEndsAt as Date).getTime() - Date.now()) / DAY)).toBe(30);
    expect(
      await db.accountMember.findFirst({ where: { accountId: g.accountId, role: 'OWNER' } }),
    ).not.toBeNull();
    const hak = await db.entitlementLedger.aggregate({
      where: { accountId: g.accountId, kind: 'talep' },
      _sum: { delta: true },
    });
    expect(hak._sum.delta).toBe(1);
    const app_ = await db.galleryApplication.findUniqueOrThrow({ where: { id } });
    expect(app_.decidedByAgent).toBe(true);
    expect(
      await db.auditLog.findFirst({
        where: { entityId: id, action: 'galeri_basvuru_onaylandi', actorType: 'AGENT' },
      }),
    ).not.toBeNull();
    expect(await db.outboxEvent.findFirst({ where: { type: 'galeri.onaylandi' } })).not.toBeNull();

    // Kurumsal hesabı olan yeniden başvuramaz
    expect((await call(app, 'PATCH', '/gallery-applications/me', { tur: 'BOAT' }, t)).status).toBe(409);

    // Herkese açık profil: işletme adı ve yetki belgesi no (m.21); vergi no görünmez
    const p = await call(app, 'GET', '/galeriler/yildiz-otomotiv');
    expect(p.body).toMatchObject({
      ad: 'Yıldız Otomotiv',
      isletmeAdi: 'Yıldız Otomotiv Ltd. Şti.',
      yetkiNo: '34-2021-001',
    });
    expect(JSON.stringify(p.body)).not.toContain('1234567890');

    // Konsol: ajanın onayladıkları; onay geri alınınca hesap askıya düşer, profil kapanır
    const q = await staffCall(app, 'GET', '/staff/gallery-applications', undefined, staffToken);
    expect(q.body.ajan.map((x: { id: string }) => x.id)).toContain(id);
    const geri = await staffCall(
      app,
      'POST',
      `/staff/gallery-applications/${id}/revoke`,
      { gerekce: 'Adres doğrulanamadı, dükkân yok' },
      staffToken,
    );
    expect(geri.status).toBe(204);
    expect((await db.account.findUniqueOrThrow({ where: { id: g.accountId } })).status).toBe('SUSPENDED');
    expect((await call(app, 'GET', '/galeriler/yildiz-otomotiv')).status).toBe(404);
  });

  it('bir kontrol geçmezse insan incelemesine düşer; ek belge, yeniden gönderim, çalışan onayı ve ret', async () => {
    const t = await login('+905328880002');
    const id = await basvur(t, '0000-1', 'Kaya Motors');
    const r = await apps.runChecks(id);
    expect(r?.hepsi).toBe(false);

    // Kuyrukta, kontroller ve ajan notuyla
    const q = await staffCall(app, 'GET', '/staff/gallery-applications', undefined, staffToken);
    const satir = q.body.bekleyen.find((x: { id: string }) => x.id === id);
    expect(satir.durum).toBe('IN_REVIEW');
    expect(satir.kontroller.find((k: { key: string }) => k.key === 'yetki').sonuc).toBe('kaldi');
    expect(satir.ajan).toContain('Yetki belgesi');

    // Ayrıntı ve belge (yalnızca çalışan)
    const det = await staffCall(app, 'GET', `/staff/gallery-applications/${id}`, undefined, staffToken);
    expect(det.body.belgeler).toHaveLength(3);
    const doc = await app.inject({
      method: 'GET',
      url: `/staff/gallery-applications/${id}/documents/${det.body.belgeler[0].id}`,
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(doc.statusCode).toBe(200);
    expect(doc.headers['content-type']).toBe('application/pdf');
    expect(doc.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
    expect(
      await db.auditLog.findFirst({
        where: { action: 'galeri_basvuru_belge_goruntulendi', actorType: 'STAFF' },
      }),
    ).not.toBeNull();
    expect((await call(app, 'GET', `/staff/gallery-applications/${id}`, undefined, t)).status).toBe(401);

    // Ek belge istenir: başvuran düzeltip yeniden gönderir
    expect(
      (
        await staffCall(
          app,
          'POST',
          `/staff/gallery-applications/${id}/request-docs`,
          { not: 'Yetki belgesinin güncel halini yükle' },
          staffToken,
        )
      ).status,
    ).toBe(204);
    const bekle = (await call(app, 'GET', '/gallery-applications/me', undefined, t)).body;
    expect(bekle).toMatchObject({ durum: 'DOCS_REQUESTED', not: 'Yetki belgesinin güncel halini yükle' });
    await call(app, 'PATCH', '/gallery-applications/me', { yetkiNo: '34-2022-777' }, t);
    expect(
      (await call(app, 'POST', '/gallery-applications/me/submit', { sozlesme: true }, t)).body.durum,
    ).toBe('SUBMITTED');

    // Çalışan onayı
    const ok = await staffCall(
      app,
      'POST',
      `/staff/gallery-applications/${id}/approve`,
      undefined,
      staffToken,
    );
    expect(ok.status).toBe(200);
    expect(ok.body.slug).toBe('kaya-motors');
    expect((await db.galleryApplication.findUniqueOrThrow({ where: { id } })).decidedByAgent).toBe(false);

    // Ret: başvuran gerekçeyi görür; reddedilen başvurudan sonra yeni başvuru açılabilir
    const t3 = await login('+905328880003');
    const id3 = await basvur(t3, '0000-2', 'Yeni Nesil Oto');
    await apps.runChecks(id3);
    expect(
      (
        await staffCall(
          app,
          'POST',
          `/staff/gallery-applications/${id3}/reject`,
          { gerekce: 'Adres haritada bulunamadı' },
          staffToken,
        )
      ).status,
    ).toBe(204);
    expect((await call(app, 'GET', '/gallery-applications/me', undefined, t3)).body).toMatchObject({
      durum: 'REJECTED',
      not: 'Adres haritada bulunamadı',
    });
    expect((await call(app, 'PATCH', '/gallery-applications/me', { tur: 'DEALER' }, t3)).body.durum).toBe(
      'DRAFT',
    );
    // Kayıtlar silinmez
    await expect(db.galleryApplication.delete({ where: { id: id3 } })).rejects.toThrow();
  });
});

describe('işçi modülü', () => {
  it('işçinin galeri modülü kendi başına kurulur (bağımlılık eksiği işçiyi sessizce durdurmasın)', async () => {
    const m = await Test.createTestingModule({
      imports: [DatabaseModule, StorageModule, GalleriesWorkerModule],
    }).compile();
    expect(m.get(GalleryApplicationService)).toBeDefined();
    await m.close();
  });
});

describe('eksik belgeyle gönderim (BasvuruMobil.dc.html)', () => {
  it('başvuru belge bekler, ajan onaylamaz; belge yüklenip yeniden gönderilince kontrol edilir', async () => {
    const t = await login('+905328880004');
    await call(app, 'PATCH', '/gallery-applications/me', form('34-2021-004', 'Eksik Oto'), t);
    await upload(t, 'vergi_levhasi');
    const s = await call(app, 'POST', '/gallery-applications/me/submit', { sozlesme: true }, t);
    expect(s.body.durum).toBe('SUBMITTED');
    expect((await apps.runChecks(s.body.id))?.hepsi).toBe(false);
    const m = (await call(app, 'GET', '/gallery-applications/me', undefined, t)).body;
    expect(m.durum).toBe('DOCS_REQUESTED');
    expect(m.not).toContain('Ticaret sicil gazetesi');
    await upload(t, 'sicil_gazetesi');
    await upload(t, 'oda_kayit');
    await call(app, 'POST', '/gallery-applications/me/submit', { sozlesme: true }, t);
    expect((await apps.runChecks(s.body.id))?.hepsi).toBe(true);
  });
});

describe('galeri ekibi ve deneme (Karar 12.5, 20)', () => {
  it('davet, kabul, rol sınırları, paket kullanıcı sınırı; deneme hatırlatması', async () => {
    const sahip = await login('+905328880010');
    const id = await basvur(sahip, '34-2023-010', 'Ege Oto');
    await apps.runChecks(id);
    const [g] = (await call(app, 'GET', '/gallery/mine', undefined, sahip)).body;
    expect(g).toMatchObject({ ad: 'Ege Oto', rol: 'OWNER' });
    const acc = g.accountId as string;

    // Sahip yönetici davet eder; yönetici davet ettiği numarayla girip kabul eder
    expect(
      (
        await call(
          app,
          'POST',
          `/gallery/${acc}/invites`,
          { telefon: '0532 888 00 11', rol: 'MANAGER' },
          sahip,
        )
      ).status,
    ).toBe(201);
    const yonetici = await login('+905328880011');
    const [davet] = (await call(app, 'GET', '/me/invites', undefined, yonetici)).body;
    expect(davet).toMatchObject({ galeri: 'Ege Oto', rol: 'MANAGER' });
    expect(
      (await call(app, 'POST', `/me/invites/${davet.id}/accept`, undefined, yonetici)).body.accountId,
    ).toBe(acc);

    // Yönetici yalnızca satış temsilcisi ekler
    expect(
      (
        await call(
          app,
          'POST',
          `/gallery/${acc}/invites`,
          { telefon: '05328880012', rol: 'MANAGER' },
          yonetici,
        )
      ).status,
    ).toBe(403);
    expect(
      (await call(app, 'POST', `/gallery/${acc}/invites`, { telefon: '05328880012', rol: 'SALES' }, yonetici))
        .status,
    ).toBe(201);
    const satis = await login('+905328880012');
    const [d2] = (await call(app, 'GET', '/me/invites', undefined, satis)).body;
    await call(app, 'POST', `/me/invites/${d2.id}/accept`, undefined, satis);

    // Satış temsilcisi fatura bilgisini ve davetleri görmez, davet edemez
    const sp = (await call(app, 'GET', `/gallery/${acc}`, undefined, satis)).body;
    expect(sp.isletme).toBeNull();
    expect(sp.ekip).toHaveLength(3);
    expect(
      (await call(app, 'POST', `/gallery/${acc}/invites`, { telefon: '05328880013', rol: 'SALES' }, satis))
        .status,
    ).toBe(403);
    // Başka galerinin paneli görünmez
    expect((await call(app, 'GET', `/gallery/${acc}`, undefined, await login('+905328880019'))).status).toBe(
      404,
    );

    // Deneme: en çok 5 kullanıcı (3 üye + 2 davet)
    await call(app, 'POST', `/gallery/${acc}/invites`, { telefon: '05328880013', rol: 'SALES' }, sahip);
    await call(app, 'POST', `/gallery/${acc}/invites`, { telefon: '05328880014', rol: 'SALES' }, sahip);
    const fazla = await call(
      app,
      'POST',
      `/gallery/${acc}/invites`,
      { telefon: '05328880015', rol: 'SALES' },
      sahip,
    );
    expect(fazla.status).toBe(409);
    expect(fazla.body.message).toContain('en çok 5');

    // Rol değişimi yalnızca sahipte; sahip çıkarılamaz; çıkarılan üye paneli göremez
    const satisId = sp.ekip.find((m: { sen: boolean }) => m.sen).userId as string;
    expect(
      (await call(app, 'PATCH', `/gallery/${acc}/members/${satisId}`, { rol: 'MANAGER' }, yonetici)).status,
    ).toBe(403);
    expect(
      (await call(app, 'PATCH', `/gallery/${acc}/members/${satisId}`, { rol: 'MANAGER' }, sahip)).status,
    ).toBe(200);
    const sahipId = sp.ekip.find((m: { rol: string }) => m.rol === 'OWNER').userId as string;
    expect((await call(app, 'DELETE', `/gallery/${acc}/members/${sahipId}`, undefined, sahip)).status).toBe(
      409,
    );
    expect((await call(app, 'DELETE', `/gallery/${acc}/members/${satisId}`, undefined, sahip)).status).toBe(
      204,
    );
    expect((await call(app, 'GET', `/gallery/${acc}`, undefined, satis)).status).toBe(404);

    // Profil: satış temsilcisi değiştiremez, sahip değiştirir
    const prof = await call(
      app,
      'PATCH',
      `/gallery/${acc}/profile`,
      { hakkinda: 'İzmir’in güvenilir galerisi', calismaSaatleri: 'Hafta içi 09.00–19.00' },
      sahip,
    );
    expect(prof.body.galeri.hakkinda).toBe('İzmir’in güvenilir galerisi');

    // Deneme hatırlatması: 2 gün kala yalnızca 3 günlük hatırlatma, ikinci turda yeni olay yok
    await db.gallery.update({
      where: { accountId: acc },
      data: { trialEndsAt: new Date(Date.now() + 2 * DAY) },
    });
    expect(await galleries.remindTrials()).toBeGreaterThanOrEqual(1);
    expect((await db.gallery.findUniqueOrThrow({ where: { accountId: acc } })).trialReminderDays).toEqual([
      3,
    ]);
    const once = await db.outboxEvent.count({ where: { type: 'galeri.deneme_bitiyor' } });
    await galleries.remindTrials();
    expect(await db.outboxEvent.count({ where: { type: 'galeri.deneme_bitiyor' } })).toBe(once);
    const panel = (await call(app, 'GET', `/gallery/${acc}`, undefined, sahip)).body;
    expect(panel.paket).toMatchObject({ key: 'deneme', denemeKalanGun: 2, saltOkunur: false, calisan: 5 });
  });
});
