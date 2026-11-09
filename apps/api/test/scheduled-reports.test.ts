import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { gallerySlug, nextSlot } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApprovalService } from '../src/approvals/approval.service.js';
import { ApprovalExecutor } from '../src/approvals/approval-executor.js';
import { AuditService } from '../src/audit/audit.service.js';
import { ENV, type Env } from '../src/config/env.js';
import { DashboardService } from '../src/dashboard/dashboard.service.js';
import { ReportService } from '../src/dashboard/report.service.js';
import { ScheduledReportService } from '../src/dashboard/scheduled-report.service.js';
import type { Db } from '../src/database/prisma.js';
import { MemoryEmail } from '../src/notifications/channels.js';
import { NotificationService } from '../src/notifications/notification.service.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;
let eposta: MemoryEmail;
let svc: ScheduledReportService;

const DAY = 86_400_000;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
  eposta = new MemoryEmail();
  svc = new ScheduledReportService(
    db,
    app.get<Env>(ENV),
    app.get(ReportService),
    app.get(DashboardService),
    app.get(ApprovalService),
    app.get(AuditService),
    app.get(ApprovalExecutor),
    eposta,
    app.get(NotificationService),
  );
  const bmw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: bmw.id, name: '3 Serisi', categories: ['otomobil'] },
  });
});
afterAll(() => app.close());

async function login(phone: string) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  const userId = (await db.user.findUniqueOrThrow({ where: { phone } })).id;
  return { token: v.body.accessToken as string, userId };
}

async function talep(token: string) {
  const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, token);
  const id = d.body.id as string;
  const data = {
    alanlar: {
      model: { make: 'bmw', series: 'bmw/3-serisi' },
      konum: { il: 'İzmir', ilce: 'Karşıyaka' },
    },
    alternatifler: [{ butce: { min: 1_500_000, max: 2_000_000 }, yil: { min: 2019, max: 2023 } }],
  };
  await call(app, 'PATCH', `/demands/${id}`, { data, step: 6 }, token);
  expect((await call(app, 'POST', `/demands/${id}/publish`, {}, token)).status).toBe(200);
}

async function ucretliGaleri(ad: string, il: string) {
  const u = await login('+905321230001');
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
      taxOffice: 'Konak',
      mersisNo: '0123456789000015',
      il,
      ilce: 'Konak',
      address: 'Cumhuriyet Blv. No: 1',
      authorityNo: '35-2021-001',
      plan: 'profesyonel',
      applicationId,
      approvedAt: new Date(),
    },
  });
  await db.subscription.create({
    data: {
      id: uuidv7(),
      accountId,
      userId: u.userId,
      plan: 'profesyonel',
      period: 'aylik',
      priceKurus: 349_000n,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * DAY),
      quotaCycleStart: new Date(),
      billingEmail: 'fatura@ege.test',
    },
  });
  return { ...u, accountId };
}

describe('Zamanlanmış raporlar (Karar 44)', () => {
  it('hazır raporlar, yeni rapor, yetkiler, PDF ve Excel ekleri, zamanında tek gönderim', async () => {
    const sahipS = await createStaff(db, 'OWNER');
    const sahip = await loginAs(app, sahipS);
    const yonetici = await loginAs(app, await createStaff(db, 'ADMIN'));
    const pazarlamaS = await createStaff(db, 'MARKETING');
    const pazarlama = await loginAs(app, pazarlamaS);
    const finansS = await createStaff(db, 'FINANCE');
    const destekS = await createStaff(db, 'SUPPORT');
    const destek = await loginAs(app, destekS);

    // Destek raporları göremez
    expect((await staffCall(app, 'GET', '/staff/scheduled-reports', undefined, destek.token)).status).toBe(
      403,
    );
    const l = await staffCall(app, 'GET', '/staff/scheduled-reports', undefined, sahip.token);
    expect(l.status).toBe(200);
    const satir = (body: { raporlar: { key: string | null; id: string }[] }, key: string) =>
      body.raporlar.find((r) => r.key === key) as unknown as Record<string, unknown> & { id: string };
    expect(l.body.raporlar.map((r: { key: string }) => r.key)).toEqual(['haftalik', 'aylik', 'galeri']);
    expect(satir(l.body, 'haftalik')).toMatchObject({ zaman: 'Her pazartesi 09.30', acik: true });
    expect(String(satir(l.body, 'haftalik').alici).startsWith('Sen, ')).toBe(true);
    expect(satir(l.body, 'aylik')).toMatchObject({ zaman: 'Her ayın 1’i 10.00', acik: true });
    expect(satir(l.body, 'galeri')).toMatchObject({
      zaman: 'Her ayın 3’ü 10.00',
      acik: false,
      alici: 'Tüm ücretli galeriler (0)',
      degistirebilir: true,
    });
    // Pazarlama hazır raporu değiştiremez, galeri raporunu açma isteği gönderebilir
    const lp = await staffCall(app, 'GET', '/staff/scheduled-reports', undefined, pazarlama.token);
    expect(satir(lp.body, 'haftalik').degistirebilir).toBe(false);
    expect(satir(lp.body, 'galeri').degistirebilir).toBe(true);
    // Formda yalnızca raporları görebilen çalışanlar
    const ids = l.body.calisanlar.map((c: { id: string }) => c.id);
    expect(ids).toContain(finansS.id);
    expect(ids).not.toContain(destekS.id);

    // Yeni rapor: alıcı yetkisizse reddedilir
    const govde = {
      kaynak: { tur: 'sekme', sekme: 'model' },
      siklik: 'hafta:5',
      saat: '17:00',
      alicilar: [pazarlamaS.id, destekS.id],
    };
    expect((await staffCall(app, 'POST', '/staff/scheduled-reports', govde, pazarlama.token)).status).toBe(
      400,
    );
    const c = await staffCall(
      app,
      'POST',
      '/staff/scheduled-reports',
      { ...govde, alicilar: [pazarlamaS.id, finansS.id] },
      pazarlama.token,
    );
    expect(c.status).toBe(200);
    const yeni = c.body.raporlar.find((r: { key: string | null }) => !r.key);
    expect(yeni).toMatchObject({
      ad: 'En çok talep edilenler',
      zaman: 'Her cuma 17.00',
      bicim: 'E-posta (PDF) · En çok talep edilenler',
      silinebilir: true,
    });
    expect(yeni.alici.startsWith('Sen, ')).toBe(true);

    // Hazır raporu yalnızca sahip ve yönetici kapatır
    const haftalik = satir(l.body, 'haftalik').id;
    expect(
      (
        await staffCall(
          app,
          'POST',
          `/staff/scheduled-reports/${haftalik}/switch`,
          { acik: false },
          pazarlama.token,
        )
      ).status,
    ).toBe(403);
    const k = await staffCall(
      app,
      'POST',
      `/staff/scheduled-reports/${haftalik}/switch`,
      { acik: false },
      yonetici.token,
    );
    expect(satir(k.body, 'haftalik').durum).toBe('Kapalı');
    await staffCall(
      app,
      'POST',
      `/staff/scheduled-reports/${haftalik}/switch`,
      { acik: true },
      yonetici.token,
    );

    // Galeri raporu: yönetici açamaz (toplu gönderimde yalnızca onaylar); pazarlama açınca onay bekler
    const galeri = satir(l.body, 'galeri').id;
    expect(
      (
        await staffCall(
          app,
          'POST',
          `/staff/scheduled-reports/${galeri}/switch`,
          { acik: true },
          yonetici.token,
        )
      ).status,
    ).toBe(403);
    const g = await staffCall(
      app,
      'POST',
      `/staff/scheduled-reports/${galeri}/switch`,
      { acik: true },
      pazarlama.token,
    );
    expect(satir(g.body, 'galeri')).toMatchObject({ acik: false, durum: 'Onay bekliyor' });
    const r = await db.scheduledReport.findUniqueOrThrow({ where: { id: galeri } });
    const approvalId = r.approvalId as string;
    expect((await db.approval.findUniqueOrThrow({ where: { id: approvalId } })).kind).toBe('BULK_SEND');
    expect(
      (await staffCall(app, 'POST', `/staff/approvals/${approvalId}/approve`, {}, sahip.token)).status,
    ).toBe(200);
    expect(await app.get(ApprovalExecutor).execute(approvalId)).toBe('yurutuldu');
    expect((await db.scheduledReport.findUniqueOrThrow({ where: { id: galeri } })).enabled).toBe(true);

    // Haftalık rapor: PDF ekli e-posta, Excel yok; kişisel veri yok
    const now = new Date();
    const hr = await db.scheduledReport.findUniqueOrThrow({ where: { key: 'haftalik' } });
    expect(await svc.run(hr, new Date(now.getTime() - 60_000), now)).toBe(true);
    // Aynı zaman ikinci kez gönderilmez
    expect(await svc.run(hr, new Date(now.getTime() - 60_000), now)).toBe(false);
    const haftalikPosta = eposta.sent.filter((m) => m.subject.includes('Haftalık rapor'));
    expect(haftalikPosta.map((m) => m.to).sort()).toEqual(
      [
        sahipS.email,
        pazarlamaS.email,
        (await db.staffMember.findFirstOrThrow({ where: { role: 'ADMIN' } })).email,
      ].sort(),
    );
    const ek = haftalikPosta[0]?.attachments ?? [];
    expect(ek.map((e) => e.contentType)).toEqual(['application/pdf']);
    expect(
      Buffer.from(ek[0]?.content ?? '')
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');
    expect(haftalikPosta[0]?.text).toContain('Ana ölçü');

    // Aylık rapor: dışa aktarma yetkisi olana (sahip, finans) Excel de eklenir
    const ar = await db.scheduledReport.findUniqueOrThrow({ where: { key: 'aylik' } });
    await svc.run(ar, new Date(now.getTime() - 60_000), now);
    const aylik = eposta.sent.filter((m) => m.subject.includes('Aylık rapor'));
    expect(aylik.map((m) => m.to).sort()).toEqual([sahipS.email, finansS.email].sort());
    for (const m of aylik) {
      expect(m.attachments?.map((e) => e.contentType)).toEqual([
        'application/pdf',
        'text/csv; charset=utf-8',
      ]);
      expect(String(m.attachments?.[1]?.content)).toContain('Toplam gelir');
    }
    const kosu = await db.scheduledReportRun.findFirstOrThrow({ where: { reportId: ar.id } });
    expect(kosu).toMatchObject({ status: 'tamam', recipients: 2, sent: 2 });

    // İşçi: yalnızca zamanı gelen rapor; eklendikten önceki zamanlar gönderilmez
    await db.scheduledReport.updateMany({ where: { key: { not: null } }, data: { enabled: false } });
    const cuma = new Date(nextSlot('hafta:5', '17:00', now).getTime() + 5 * 60_000);
    await db.$executeRaw`UPDATE scheduled_reports SET created_at = ${new Date(cuma.getTime() - 8 * DAY)}, updated_at = ${new Date(cuma.getTime() - 8 * DAY)} WHERE key IS NULL`;
    const once = eposta.sent.length;
    expect(await svc.dispatchDue(cuma)).toBe(1);
    expect(await svc.dispatchDue(cuma)).toBe(0);
    const yeniPosta = eposta.sent.slice(once);
    expect(yeniPosta.map((m) => m.to).sort()).toEqual([pazarlamaS.email, finansS.email].sort());
    expect(yeniPosta[0]?.subject).toContain('En çok talep edilenler');

    // Silme: yalnızca ekleyen ya da yönetici; işlem kaydına girer
    expect(
      (await staffCall(app, 'DELETE', `/staff/scheduled-reports/${yeni.id}`, undefined, destek.token)).status,
    ).toBe(403);
    const s = await staffCall(
      app,
      'DELETE',
      `/staff/scheduled-reports/${yeni.id}`,
      undefined,
      pazarlama.token,
    );
    expect(s.body.raporlar).toHaveLength(3);
    for (const action of [
      'zamanli_rapor_eklendi',
      'zamanli_rapor_degisti',
      'zamanli_rapor_onay_istendi',
      'zamanli_rapor_silindi',
    ])
      expect(await db.auditLog.count({ where: { action } })).toBeGreaterThan(0);
  });

  it('galerilere aranan modeller: ilde yeterli talep yoksa Türkiye geneli; portföyde olmayan model için öneri', async () => {
    const galeri = await ucretliGaleri('Ege Otomotiv', 'İzmir');
    await talep((await login('+905321230002')).token);
    await talep((await login('+905321230003')).token);

    const liste = await svc.galeriModelleri();
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({
      accountId: galeri.accountId,
      bolge: 'Türkiye genelinde',
      modeller: [{ sira: 1, ad: 'BMW 3 Serisi', talep: 2, arac: 0 }],
    });
    expect(liste[0]?.oneri).toBe(
      'BMW 3 Serisi için Türkiye genelinde son 30 günde 2 talep açıldı; portföyünde yok. Bu modelden araç eklersen talep sahipleriyle eşleşirsin.',
    );

    const r = await db.scheduledReport.findUniqueOrThrow({ where: { key: 'galeri' } });
    await svc.run(r, new Date(Date.now() - 60_000));
    const b = await db.notification.findFirstOrThrow({
      where: { userId: galeri.userId, sablon: 'galeri.aranan_modeller' },
    });
    expect(b.baslik).toBe('Türkiye genelinde en çok aranan modeller');
    expect(await db.scheduledReportRun.findFirstOrThrow({ where: { reportId: r.id } })).toMatchObject({
      status: 'tamam',
      recipients: 1,
      sent: 1,
    });
  });
});
