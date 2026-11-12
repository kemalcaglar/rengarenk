import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { disposalNo, nextDisposalDate } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../src/audit/audit.service.js';
import { IpVault } from '../src/audit/ip-vault.js';
import type { Db } from '../src/database/prisma.js';
import { NotificationService } from '../src/notifications/notification.service.js';
import { NotificationEvents } from '../src/notifications/notification-events.js';
import { RetentionService } from '../src/privacy/retention.service.js';
import { DemandSearchService } from '../src/search/demand-search.service.js';
import { call, createTestApp, uyeOl } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;
let sahip: string;
let yonetici: string;
let destek: string;
let moderator: string;
const DAY = 86_400_000;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
  sahip = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
  yonetici = (await loginAs(app, await createStaff(db, 'ADMIN'))).token;
  destek = (await loginAs(app, await createStaff(db, 'SUPPORT'))).token;
  moderator = (await loginAs(app, await createStaff(db, 'MODERATOR'))).token;
});
afterAll(() => app.close());

async function uye(phone: string, ad: string) {
  const v = { body: await uyeOl(app, phone) };
  await call(app, 'PATCH', '/me', { firstName: ad, lastName: 'Deneme' }, v.body.accessToken);
  const u = await db.user.findUniqueOrThrow({
    where: { phone },
    include: { memberships: { select: { accountId: true } } },
  });
  return {
    userId: u.id,
    accountId: u.memberships[0]?.accountId as string,
    token: v.body.accessToken as string,
  };
}

/** 2 yıl önce kapanmış talep üzerinden sohbet ve mesajları */
async function eskiSohbet(
  alici: { userId: string; accountId: string },
  satici: { userId: string; accountId: string },
) {
  const kategori = await db.category.findFirstOrThrow({ select: { id: true } });
  const eski = new Date(Date.now() - 2 * 365 * DAY);
  const d = await db.demand.create({
    data: {
      id: uuidv7(),
      accountId: alici.accountId,
      userId: alici.userId,
      categoryId: kategori.id,
      status: 'CLOSED',
      closedAt: eski,
    },
  });
  const c = await db.conversation.create({
    data: {
      id: uuidv7(),
      origin: 'talep',
      demandId: d.id,
      buyerUserId: alici.userId,
      sellerAccountId: satici.accountId,
      sellerUserId: satici.userId,
      status: 'OPEN',
      entitlement: 'gunluk',
      lastMessageAt: eski,
    },
  });
  const m = await db.message.create({
    data: {
      id: uuidv7(),
      conversationId: c.id,
      side: 'satici',
      senderUserId: satici.userId,
      kind: 'metin',
      body: 'x',
      createdAt: eski,
    },
  });
  return { conversationId: c.id, messageId: m.id };
}

describe('saklama ve periyodik imha (Karar 59)', () => {
  it('ajan sayar, yalnızca Sahip onaylar, dönem gününde imha eder; şikâyetli ve resmi talepli kayıt bekletilir', async () => {
    const a = await uye('+905336660001', 'Alp');
    const b = await uye('+905336660002', 'Bora');
    const c = await uye('+905336660003', 'Cem');
    const s1 = await eskiSohbet(a, b);
    const s2 = await eskiSohbet(c, b);
    const s3 = await eskiSohbet(a, c);
    // s2 şikâyetli: bekletilir
    await db.report.create({
      data: {
        id: uuidv7(),
        source: 'kullanici',
        reporterUserId: c.userId,
        targetType: 'mesaj',
        targetId: s2.messageId,
        targetUserId: b.userId,
        reason: 'dolandiricilik',
        priority: 'kritik',
        dueAt: new Date(),
      },
    });
    // 6 yıl önce kapanmış hesabın kimlik kaydı; 3 yıllık SMS kodu; 2 yıllık çözülmüş destek talebi
    await db.accountClosure.create({
      data: {
        id: uuidv7(),
        userId: c.userId,
        phoneEnc: 'v1.x.y.z',
        phoneHash: 'h',
        keepIdentityUntil: new Date(Date.now() - DAY),
        purgeMessagesAt: new Date(Date.now() - 4 * 365 * DAY),
        closedAt: new Date(Date.now() - 6 * 365 * DAY),
      },
    });
    await db.otpChallenge.updateMany({
      where: { phone: '+905336660001' },
      data: { createdAt: new Date(Date.now() - 3 * 365 * DAY) },
    });
    const t = await db.supportTicket.create({
      data: {
        id: uuidv7(),
        userId: a.userId,
        channel: 'uygulama',
        topic: 'hesap',
        subject: 'Telefonumu değiştirdim',
        status: 'cozuldu',
        dueAt: new Date(),
        lastMessageAt: new Date(Date.now() - 2 * 365 * DAY),
        messages: { create: { id: uuidv7(), side: 'kullanici', body: 'gizli' } },
      },
    });

    // İşlem kaydındaki IP: satır yalnızca ekleme; 3 yıl önceki dönemin anahtarı imha edilir, bu dönemin kalır
    const audit = app.get(AuditService);
    const yeni = await audit.record({
      actorType: 'SYSTEM',
      action: 'ip_denemesi',
      entityType: 'user',
      entityId: a.userId,
      ip: '203.0.113.7',
    });
    expect(yeni.ip).toMatch(/^k1\.islem-\d{4}-[12]\./);
    expect(yeni.ip).not.toContain('203.0.113.7');
    expect(await audit.ips.open(yeni.ip)).toBe('203.0.113.7');
    const eskiTarih = new Date(Date.now() - 3 * 365 * DAY);
    const eski = await db.auditLog.create({
      data: {
        actorType: 'SYSTEM',
        action: 'ip_denemesi',
        entityType: 'user',
        entityId: a.userId,
        ip: await audit.ips.seal('198.51.100.9', eskiTarih),
        createdAt: eskiTarih,
      },
    });
    const yeniAnahtar = (yeni.ip as string).split('.')[1] as string;
    // Süresi dolmamış anahtar silinemez, hiçbir anahtar değiştirilemez (RR040, RR001)
    await expect(db.piiKey.delete({ where: { id: yeniAnahtar } })).rejects.toThrow(/RR040|silinemez/);
    await expect(db.piiKey.update({ where: { id: yeniAnahtar }, data: { keyEnc: 'x' } })).rejects.toThrow(
      /yalnızca ekleme/,
    );

    // Resmi talep süren kişi (Cem) bekletilir: s3 sohbeti ve kimlik kaydı
    const r = await staffCall(
      app,
      'POST',
      '/staff/official',
      { makam: 'İstanbul Cumhuriyet Başsavcılığı', konu: 'Kayıt ve mesaj bilgisi', kisi: c.userId },
      sahip,
    );
    expect(r.status).toBe(200);

    expect((await staffCall(app, 'GET', '/staff/retention', undefined, moderator)).status).toBe(403);
    const o = await staffCall(app, 'GET', '/staff/retention', undefined, destek);
    expect(o.status).toBe(200);
    const liste = Object.fromEntries(
      (o.body.donem.liste as { kalem: string; sayi: number }[]).map((x) => [x.kalem, x.sayi]),
    );
    expect(liste).toMatchObject({ sohbet: 1, hesap: 0, destek: 1, islem: 1 });
    expect(liste.erisim).toBeGreaterThanOrEqual(1);
    expect(o.body.donem.no).toBe(disposalNo(nextDisposalDate(new Date())));
    expect(o.body.verbis.zorunlu).toBe(false);
    expect(o.body.saklama).toHaveLength(8);

    // Yalnızca Sahip onaylar
    const id = o.body.donem.id as string;
    expect((await staffCall(app, 'POST', `/staff/retention/${id}/approve`, {}, destek)).status).toBe(403);
    expect((await staffCall(app, 'POST', `/staff/retention/${id}/approve`, {}, yonetici)).status).toBe(403);
    expect((await staffCall(app, 'POST', `/staff/retention/${id}/approve`, {}, sahip)).status).toBe(200);
    expect((await staffCall(app, 'POST', `/staff/retention/${id}/approve`, {}, sahip)).status).toBe(409);

    // Günü gelmeden çalışmaz
    const imha = app.get(RetentionService);
    expect(await imha.runDue(new Date())).toBeNull();
    const run = await db.disposalRun.findUniqueOrThrow({ where: { id } });
    const rapor = await imha.runDue(new Date(run.scheduledFor.getTime() + 60_000));
    expect(rapor?.no).toBe(run.no);
    expect(await db.message.count({ where: { conversationId: s1.conversationId } })).toBe(0);
    expect(await db.message.count({ where: { conversationId: s2.conversationId } })).toBe(1);
    expect(await db.message.count({ where: { conversationId: s3.conversationId } })).toBe(1);
    expect((await db.accountClosure.findUniqueOrThrow({ where: { userId: c.userId } })).phoneEnc).toBe(
      'v1.x.y.z',
    );
    expect(await db.otpChallenge.count({ where: { phone: '+905336660001' } })).toBe(0);
    const t2 = await db.supportTicket.findUniqueOrThrow({ where: { id: t.id }, include: { messages: true } });
    expect(t2.subject).toBe('imha edildi');
    expect(t2.purgedAt).not.toBeNull();
    expect(t2.messages[0]?.body).toBe('');
    const kayit = await db.disposalRun.findUniqueOrThrow({ where: { id } });
    expect(kayit.status).toBe('calisti');
    const k = (await staffCall(app, 'GET', `/staff/retention/${id}/report`, undefined, sahip)).body;
    expect(k.kalemler.find((x: { kalem: string }) => x.kalem === 'sohbet')).toMatchObject({
      imha: 1,
      bekletilen: 2,
    });
    expect(k.onaylayan).toBeTruthy();
    // Eski dönemin IP'si okunamaz, satır yerinde; bu dönemin IP'si okunur
    IpVault.forget();
    const eskiSatir = await db.auditLog.findUniqueOrThrow({ where: { id: eski.id } });
    expect(eskiSatir.ip).toBe(eski.ip);
    expect(await audit.ips.open(eskiSatir.ip)).toBeNull();
    expect(await audit.ips.open(yeni.ip)).toBe('203.0.113.7');
    const kayitlar = (await staffCall(app, 'GET', '/staff/audit?q=ip_denemesi', undefined, sahip)).body
      .items as {
      id: string;
      ip: string;
    }[];
    expect(kayitlar.find((x) => x.id === eski.id.toString())?.ip).toBe('imha edildi');
    expect(k.kalemler.find((x: { kalem: string }) => x.kalem === 'islem')).toMatchObject({ imha: 1 });
    expect(await db.auditLog.count({ where: { action: 'imha_yapildi' } })).toBe(1);
    // Dönem satırı silinmez
    await expect(db.disposalRun.delete({ where: { id } })).rejects.toThrow();
  });
});

describe('veri ihlali ve resmi talepler (Karar 59)', () => {
  it('tatbikat: tek açık kayıt, adımlar işlem kaydında; gerçek ihlal Kurul bildirimi olmadan kapanmaz', async () => {
    expect((await staffCall(app, 'GET', '/staff/breach', undefined, destek)).status).toBe(403);
    const t = await staffCall(
      app,
      'POST',
      '/staff/breach',
      { tatbikat: true, ozet: 'Altı aylık tatbikat' },
      yonetici,
    );
    expect(t.status).toBe(200);
    expect(
      (await staffCall(app, 'POST', '/staff/breach', { tatbikat: false, ozet: 'Gerçek ihlal' }, sahip))
        .status,
    ).toBe(409);
    const g = await staffCall(app, 'GET', '/staff/breach', undefined, sahip);
    expect(g.body.aktif).toMatchObject({ tatbikat: true });
    expect(new Date(g.body.aktif.sonTarih).getTime() - new Date(g.body.aktif.ogrenildi).getTime()).toBe(
      72 * 3600_000,
    );
    expect(g.body.sorumlu).toBe('Sen');
    expect(g.body.adimlar).toHaveLength(5);
    expect((await staffCall(app, 'POST', `/staff/breach/${t.body.id}/steps/durdur`, {}, sahip)).status).toBe(
      200,
    );
    expect((await staffCall(app, 'POST', `/staff/breach/${t.body.id}/steps/durdur`, {}, sahip)).status).toBe(
      409,
    );
    expect(
      (
        await staffCall(
          app,
          'POST',
          `/staff/breach/${t.body.id}/close`,
          { rapor: 'Tatbikat tamamlandı, eksik yok, süreler tutuldu.' },
          sahip,
        )
      ).status,
    ).toBe(200);
    expect((await staffCall(app, 'GET', '/staff/breach', undefined, sahip)).body).toMatchObject({
      aktif: null,
    });

    const ihlal = await staffCall(
      app,
      'POST',
      '/staff/breach',
      { tatbikat: false, ozet: 'Yedek dosyası açıkta kaldı' },
      sahip,
    );
    expect(await db.outboxEvent.count({ where: { type: 'ihlal.basladi' } })).toBe(1);
    const kapat = { rapor: 'Dosya kaldırıldı, erişim anahtarları yenilendi, kimse etkilenmedi.' };
    expect((await staffCall(app, 'POST', `/staff/breach/${ihlal.body.id}/close`, kapat, sahip)).status).toBe(
      409,
    );
    expect(
      (
        await staffCall(
          app,
          'POST',
          `/staff/breach/${ihlal.body.id}/steps/kurul`,
          { not: 'İlk bildirim' },
          sahip,
        )
      ).status,
    ).toBe(200);
    expect((await staffCall(app, 'POST', `/staff/breach/${ihlal.body.id}/close`, kapat, sahip)).status).toBe(
      200,
    );
    expect(await db.auditLog.count({ where: { action: 'ihlal_adimi' } })).toBe(2);
  });

  it('resmi talep: yazı yüklenmeden veri verilmez; verilen her veri kaydedilir; kullanıcıya bildirim', async () => {
    const d = await uye('+905336660010', 'Defne');
    const r = await staffCall(
      app,
      'POST',
      '/staff/official',
      { makam: 'Tüketici Hakem Heyeti', konu: 'İade uyuşmazlığı', kisi: d.userId },
      yonetici,
    );
    const id = r.body.id as string;
    expect(
      (await staffCall(app, 'POST', `/staff/official/${id}/give`, { ne: 'Ödeme kayıtları' }, sahip)).status,
    ).toBe(409);
    expect(
      (
        await staffCall(
          app,
          'POST',
          `/staff/official/${id}/reply`,
          { durum: 'yanitlandi', not: 'Kayıtlar verildi' },
          sahip,
        )
      ).status,
    ).toBe(409);
    const yukle = await app.inject({
      method: 'POST',
      url: `/staff/official/${id}/document`,
      payload: Buffer.from('%PDF-1.4 resmi yazi'),
      headers: { 'content-type': 'application/pdf', authorization: `Bearer ${sahip}` },
    });
    expect(yukle.statusCode).toBe(200);
    expect(
      (await staffCall(app, 'POST', `/staff/official/${id}/give`, { ne: 'Ödeme ve iade kayıtları' }, sahip))
        .status,
    ).toBe(200);
    expect(
      (
        await staffCall(
          app,
          'POST',
          `/staff/official/${id}/reply`,
          { durum: 'yanitlandi', not: 'Kayıtlar verildi' },
          sahip,
        )
      ).status,
    ).toBe(200);
    const l = (await staffCall(app, 'GET', '/staff/official', undefined, sahip)).body;
    expect(l.find((x: { id: string }) => x.id === id)).toMatchObject({
      durum: 'yanitlandi',
      durumAd: 'Yanıtlandı',
      belge: true,
      verilen: [{ ne: 'Ödeme ve iade kayıtları' }],
    });
    expect(await db.auditLog.count({ where: { action: 'resmi_veri_verildi', entityId: id } })).toBe(1);
    const ev = await db.outboxEvent.findFirstOrThrow({ where: { type: 'resmi.yanitlandi' } });
    const olaylar = new NotificationEvents(db, app.get(NotificationService), app.get(DemandSearchService));
    expect(await olaylar.handle('resmi.yanitlandi', ev.payload as Record<string, unknown>)).toBe(1);
    expect(await db.notification.count({ where: { userId: d.userId } })).toBeGreaterThanOrEqual(1);
  });
});
