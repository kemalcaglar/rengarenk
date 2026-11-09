import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../src/audit/audit.service.js';
import { ENV, type Env } from '../src/config/env.js';
import type { Db } from '../src/database/prisma.js';
import { MemoryEmail } from '../src/notifications/channels.js';
import { StaffAlertService } from '../src/staff-alerts/staff-alert.service.js';
import { createTestApp } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;
let uyarilar: StaffAlertService;
const ids: Record<'sahip' | 'yonetici' | 'moderator' | 'destek', string> = {
  sahip: '',
  yonetici: '',
  moderator: '',
  destek: '',
};
const tok: Record<keyof typeof ids, string> = { sahip: '', yonetici: '', moderator: '', destek: '' };

beforeAll(async () => {
  ({ app, db } = await createTestApp());
  uyarilar = app.get(StaffAlertService);
  for (const [k, rol] of [
    ['sahip', 'OWNER'],
    ['yonetici', 'ADMIN'],
    ['moderator', 'MODERATOR'],
    ['destek', 'SUPPORT'],
  ] as const) {
    const s = await createStaff(db, rol);
    ids[k] = s.id;
    tok[k] = (await loginAs(app, s)).token;
  }
});
afterAll(() => app.close());

const benim = (staffId: string, rule?: string) =>
  db.staffAlert.findMany({ where: { staffId, ...(rule ? { rule } : {}) }, orderBy: { createdAt: 'asc' } });

describe('çalışan uyarıları (Karar 40, 41, 57, 58, 59)', () => {
  it('yeni cihazdan giriş sahibe gider, bir kez açılır; konsolda okunur', async () => {
    const olay = await db.outboxEvent.findFirst({
      where: { type: 'calisan.yeni_cihaz', payload: { path: ['staffId'], equals: ids.yonetici } },
    });
    expect(olay).not.toBeNull();
    const p = olay?.payload as Record<string, unknown>;
    expect(await uyarilar.onEvent('calisan.yeni_cihaz', p)).toBeGreaterThan(0);
    expect(await uyarilar.onEvent('calisan.yeni_cihaz', p)).toBe(0);

    const [u] = await benim(ids.sahip, 'yeni_cihaz').then((r) =>
      r.filter((x) => x.dedupeKey === `yeni_cihaz:${p.deviceId}`),
    );
    expect(u?.critical).toBe(true);
    expect(u?.title).toContain('ADMIN T.');
    expect(u?.link).toBe('/calisanlar');
    // Yönetici kendi girişinin uyarısını almaz (kural yalnızca sahibe)
    expect((await benim(ids.yonetici, 'yeni_cihaz')).length).toBe(0);

    const me = await staffCall(app, 'GET', '/staff/me', undefined, tok.sahip);
    expect(me.body.unreadAlerts).toBeGreaterThan(0);
    const l = await staffCall(app, 'GET', '/staff/alerts', undefined, tok.sahip);
    expect(l.status).toBe(200);
    expect(l.body.uyarilar.some((x: { id: string }) => x.id === u?.id)).toBe(true);
    // Başkasının uyarısı görünmez ve okunamaz
    const m = await staffCall(app, 'GET', '/staff/alerts', undefined, tok.moderator);
    expect(m.body.uyarilar.some((x: { id: string }) => x.id === u?.id)).toBe(false);
    await staffCall(app, 'POST', '/staff/alerts/read', { ids: [u?.id] }, tok.moderator);
    expect((await db.staffAlert.findUnique({ where: { id: u?.id } }))?.readAt).toBeNull();

    const r = await staffCall(app, 'POST', '/staff/alerts/read', { hepsi: true }, tok.sahip);
    expect(r.status).toBe(200);
    const me2 = await staffCall(app, 'GET', '/staff/me', undefined, tok.sahip);
    expect(me2.body.unreadAlerts).toBe(0);
    expect((await staffCall(app, 'POST', '/staff/alerts/read', {}, tok.sahip)).status).toBe(400);
  });

  it('KVKK başvurusunda 7 gün kala yetkililere bir kez uyarı', async () => {
    const k = await db.kvkkRequest.create({
      data: {
        id: uuidv7(),
        applicantName: 'Deneme Kişi',
        applicantEmail: 'deneme@ornek.com',
        kind: 'bilgi',
        text: 'Hangi verilerimi işliyorsunuz?',
        verification: 'kimlik',
        channel: 'eposta',
        dueAt: new Date(Date.now() + 5 * 86_400_000 + 3_600_000),
      },
    });
    expect(await uyarilar.kvkkSure()).toBeGreaterThan(0);
    expect(await uyarilar.kvkkSure()).toBe(0);
    const kim = await db.staffAlert.findMany({ where: { dedupeKey: `kvkk_sure:${k.id}` } });
    const alanlar = kim.map((x) => x.staffId);
    expect(alanlar).toContain(ids.sahip);
    expect(alanlar).toContain(ids.yonetici);
    expect(alanlar).toContain(ids.destek); // KVKK yanıtlama: öneri düzeyi
    expect(alanlar).not.toContain(ids.moderator);
    expect(kim[0]?.title).toBe(`KVKK başvurusu K-${k.no}: 6 gün kaldı`);
    expect(kim[0]?.body).not.toContain('Hangi verilerimi');
  });

  it('kurallar: alıcılar listelenir; kritik olmayanı yalnızca sahip kapatır, kritik kapanmaz', async () => {
    const r = await staffCall(app, 'GET', '/staff/alerts/rules', undefined, tok.sahip);
    expect(r.status).toBe(200);
    const yeni = r.body.find((x: { key: string }) => x.key === 'yeni_cihaz');
    expect(yeni).toMatchObject({ kritik: true, acik: true, kanal: 'Konsol ve e-posta' });
    expect(yeni.alicilar[0]).toBe('Sen');
    const ozet = r.body.find((x: { key: string }) => x.key === 'ajan_ozet');
    expect(ozet.alicilar).toContain('ADMIN T.');

    expect((await staffCall(app, 'GET', '/staff/alerts/rules', undefined, tok.destek)).status).toBe(200);
    expect(
      (await staffCall(app, 'POST', '/staff/alerts/rules/ajan_ozet', { enabled: false }, tok.yonetici))
        .status,
    ).toBe(403);
    expect(
      (await staffCall(app, 'POST', '/staff/alerts/rules/yeni_cihaz', { enabled: false }, tok.sahip)).status,
    ).toBe(400);
    expect(
      (await staffCall(app, 'POST', '/staff/alerts/rules/yok_boyle', { enabled: false }, tok.sahip)).status,
    ).toBe(400);
    const k = await staffCall(app, 'POST', '/staff/alerts/rules/ajan_ozet', { enabled: false }, tok.sahip);
    expect(k.status).toBe(200);
    expect(
      await db.auditLog.count({ where: { action: 'uyari_kurali_degisti', entityId: 'ajan_ozet' } }),
    ).toBeGreaterThan(0);

    const a = await db.agentAction.create({
      data: {
        id: uuidv7(),
        kind: 'ozet',
        title: 'Günlük özet yazıldı',
        reason: 'Dün 3 yeni talep.',
        confidence: 'Rapor',
      },
    });
    expect(await uyarilar.onEvent('ajan.ozet', { actionId: a.id })).toBe(0);
    await staffCall(app, 'POST', '/staff/alerts/rules/ajan_ozet', { enabled: true }, tok.sahip);
    expect(await uyarilar.onEvent('ajan.ozet', { actionId: a.id })).toBeGreaterThan(0);
    const [o] = await db.staffAlert.findMany({
      where: { staffId: ids.yonetici, dedupeKey: `ajan_ozet:${a.id}` },
    });
    expect(o?.body).toContain('Dün 3 yeni talep.');
    expect(o?.body).toContain('Dikkat isteyenler:');
    expect(o?.body).toContain('Ajanın son 24 saatte yaptıkları:');
    expect((await benim(ids.moderator, 'ajan_ozet')).length).toBe(0);
  });

  it('bütçe, ajan ve iade olayları; ilgisiz olay uyarı açmaz', async () => {
    expect(
      await uyarilar.onEvent('yz.butce_doldu', { ay: '2026-11', harcamaUsd: 150.2, sinirUsd: 150 }),
    ).toBeGreaterThan(0);
    const [b] = await benim(ids.sahip, 'yz_butce');
    expect(b?.critical).toBe(true);
    expect(b?.body).toContain('150,2 USD');
    expect((await benim(ids.yonetici, 'yz_butce')).length).toBe(0);

    expect(await uyarilar.onEvent('onay.istendi', { approvalId: uuidv7(), kind: 'PRICE_CHANGE' })).toBe(0);
    expect(await uyarilar.onEvent('galeri.onaylandi', { applicationId: uuidv7(), ajan: false })).toBe(0);
    expect(await uyarilar.onEvent('ayar.degisti', { key: 'bakim', enabled: true })).toBe(0);
    expect(await uyarilar.onEvent('ayar.degisti', { key: 'ajan', enabled: false })).toBeGreaterThan(0);
    const [d] = await benim(ids.yonetici, 'ajan_durdu');
    expect(d?.title).toBe('Rengarenk Ajanı durduruldu');

    // Gerçek ihlal kritik; tatbikat uyarı açmaz
    const ihlal = await db.breachIncident.create({
      data: {
        id: uuidv7(),
        drill: false,
        summary: 'Deneme',
        learnedAt: new Date(),
        deadline: new Date(Date.now() + 72 * 3_600_000),
        openedBy: ids.sahip,
      },
    });
    expect(await uyarilar.onEvent('ihlal.basladi', { breachId: ihlal.id })).toBeGreaterThan(0);
    const [i] = await benim(ids.destek, 'ihlal');
    expect(i?.critical).toBe(true);
    const tatbikat = await db.breachIncident.create({
      data: {
        id: uuidv7(),
        drill: true,
        summary: 'Tatbikat',
        learnedAt: new Date(),
        deadline: new Date(Date.now() + 72 * 3_600_000),
        openedBy: ids.sahip,
      },
    });
    expect(await uyarilar.onEvent('ihlal.basladi', { breachId: tatbikat.id })).toBe(0);
  });

  it('ajanın geri alınan işlemleri haftalık %5’i aşarsa bir kez', async () => {
    const simdi = new Date();
    await db.agentAction.createMany({
      data: Array.from({ length: 12 }, (_, i) => ({
        id: uuidv7(),
        kind: 'mesaj_gizle',
        title: 'Mesaj gizlendi',
        reason: 'Kapora',
        confidence: 'Kural',
        createdAt: new Date(simdi.getTime() - i * 3_600_000),
        undoneAt: i < 6 ? simdi : null,
        undoneBy: i < 6 ? ids.sahip : null,
      })),
    });
    expect(await uyarilar.ajanGeriAlma(simdi)).toBeGreaterThan(0);
    expect(await uyarilar.ajanGeriAlma(simdi)).toBe(0);
    const [g] = await benim(ids.sahip, 'ajan_geri_alma');
    expect(g?.title).toMatch(/^Ajanın işlemlerinin %\d/);
  });

  it('e-posta şirket adresine gider; kritik konu etiketli, bağlantı konsola', async () => {
    const posta = new MemoryEmail();
    const s = new StaffAlertService(db, app.get<Env>(ENV), app.get(AuditService), posta);
    let n = 0;
    for (let i = 0; i < 20; i++) {
      const k = await s.teslim();
      n += k;
      if ((await db.staffAlert.count({ where: { emailStatus: 'bekliyor' } })) === 0) break;
    }
    expect(n).toBeGreaterThan(0);
    const sahip = await db.staffMember.findUniqueOrThrow({ where: { id: ids.sahip } });
    const butce = posta.sent.find(
      (m) => m.to === sahip.email && m.subject.includes('Yapay zekâ bütçesi doldu'),
    );
    expect(butce?.subject).toContain('[Kritik]');
    expect(butce?.text).toContain('/yapay-zeka');
    expect(
      await db.staffAlert.count({ where: { staffId: ids.sahip, emailStatus: 'gonderildi' } }),
    ).toBeGreaterThan(0);
    // API sürecinde e-posta kanalı yok: teslim işçide
    expect(await uyarilar.teslim()).toBe(0);
  });
});
