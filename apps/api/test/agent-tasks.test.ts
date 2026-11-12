import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AgentService } from '../src/agent/agent.service.js';
import { ENV, type Env } from '../src/config/env.js';
import type { Db } from '../src/database/prisma.js';
import { ModerationService } from '../src/moderation/moderation.service.js';
import { FailoverSmsSender } from '../src/sms/failover.sender.js';
import { SmsError, type SmsSender } from '../src/sms/sms.js';
import { createSmsSender } from '../src/sms/sms.module.js';
import { StaffAlertService } from '../src/staff-alerts/staff-alert.service.js';
import { SupportAgent } from '../src/support/support-agent.js';
import { call, createTestApp, uyeOl } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;
let moderator: string;
let destekci: string;
let izleyici: string;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
  const bmw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  const s = await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: bmw.id, name: '3 Serisi', categories: ['otomobil'] },
  });
  await db.catalogModel.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi/320i', makeId: bmw.id, seriesId: s.id, name: '320i' },
  });
  await createStaff(db, 'OWNER');
  moderator = (await loginAs(app, await createStaff(db, 'MODERATOR'))).token;
  destekci = (await loginAs(app, await createStaff(db, 'SUPPORT'))).token;
  izleyici = (await loginAs(app, await createStaff(db, 'VIEWER'))).token;
});
afterAll(() => app.close());

async function login(phone: string, ad: [string, string]) {
  const v = { body: await uyeOl(app, phone) };
  const token = v.body.accessToken as string;
  await call(app, 'PATCH', '/me', { firstName: ad[0], lastName: ad[1] }, token);
  const userId = (await db.user.findUniqueOrThrow({ where: { phone }, select: { id: true } })).id;
  return { token, userId };
}

async function talep(token: string, headline: string, aciklama: string) {
  const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, token);
  const data = {
    alanlar: {
      model: { make: 'bmw', series: 'bmw/3-serisi', model: 'bmw/3-serisi/320i' },
      konum: { il: 'İstanbul', ilce: 'Kadıköy' },
      aciklama,
    },
    alternatifler: [{ butce: { min: 2_000_000, max: 2_500_000 }, yil: { min: 2019, max: 2023 } }],
  };
  const u = await call(app, 'PATCH', `/demands/${d.body.id}`, { data, headline, step: 6 }, token);
  expect(u.status).toBe(200);
  const p = await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, token);
  expect(p.status).toBe(200);
  return { id: d.body.id as string, no: p.body.no as number, data };
}

describe('ajanın sormadan yaptığı işler (Karar 41)', () => {
  it('talep metninde telefon ve bağlantı: herkese açık görünümde gizli, düzeltme istenir, düzeltilince kalkar', async () => {
    const a = await login('+905339981001', ['Deniz', 'Ak']);
    const t = await talep(
      a.token,
      'Passat arıyorum 0532 418 22 41',
      'Fiyatı uygun olan yazsın, ilanım ornekilan.com/abc adresinde de var.',
    );
    const ms = app.get(ModerationService);
    expect(await ms.ajanTalepKontrolu(t.id)).toBe('duzeltme_istendi');
    expect(await ms.ajanTalepKontrolu(t.id)).toBe('islem_yok');

    const herkes = await call(app, 'GET', `/talepler/${t.no}`);
    expect(herkes.status).toBe(200);
    expect(herkes.body.baslik).toBe('Passat arıyorum [numara gizlendi]');
    expect(herkes.body.data.alanlar.aciklama).toContain('[bağlantı gizlendi]');
    expect(JSON.stringify(herkes.body)).not.toContain('418 22 41');

    const sahibi = await call(app, 'GET', `/demands/${t.id}`, undefined, a.token);
    expect(sahibi.body.headline).toBe('Passat arıyorum 0532 418 22 41');
    expect(sahibi.body.duzeltme.alanlar).toEqual(['telefon numarası', 'bağlantı']);

    const islem = await db.agentAction.findFirstOrThrow({
      where: { kind: 'talep_duzeltme', entityId: t.id },
    });
    expect(islem.title).toBe(`Talep açıklaması için düzeltme istendi: No ${t.no}`);
    expect(islem.reason).toBe(
      'Telefon numarası ve bağlantı var; talep düzeltilene kadar yayında ama bu bilgiler gizli',
    );
    const olay = await db.outboxEvent.findFirst({
      where: { type: 'talep.duzeltme_istendi', payload: { path: ['demandId'], equals: t.id } },
    });
    expect(olay).not.toBeNull();

    // Sahibi düzeltir: işaret kalkar
    const u = await call(
      app,
      'PATCH',
      `/demands/${t.id}`,
      {
        headline: 'Passat arıyorum',
        data: { ...t.data, alanlar: { ...t.data.alanlar, aciklama: 'Temiz araç arıyorum.' } },
      },
      a.token,
    );
    expect(u.status).toBe(200);
    expect(await ms.ajanTalepKontrolu(t.id)).toBe('duzeltildi');
    expect((await db.demand.findUniqueOrThrow({ where: { id: t.id } })).correctionAt).toBeNull();

    // Yeni düzeltme isteği moderatörce geri alınır (izleyici alamaz)
    await call(
      app,
      'PATCH',
      `/demands/${t.id}`,
      { headline: 'Passat, IBAN TR33 0006 1005 1978 6457 8413 26' },
      a.token,
    );
    expect(await ms.ajanTalepKontrolu(t.id)).toBe('duzeltme_istendi');
    const ikinci = await db.agentAction.findFirstOrThrow({
      where: { kind: 'talep_duzeltme', entityId: t.id, undoneAt: null },
    });
    expect(
      (await staffCall(app, 'POST', `/staff/agent/actions/${ikinci.id}/undo`, {}, izleyici)).status,
    ).toBe(403);
    expect(
      (await staffCall(app, 'POST', `/staff/agent/actions/${ikinci.id}/undo`, {}, moderator)).status,
    ).toBe(204);
    expect((await db.demand.findUniqueOrThrow({ where: { id: t.id } })).correctionFlags).toEqual([]);
  });

  it('destek: hak sorusunu kayıttan yanıtlayıp çözer; iade insana kalır; düşük güvende taslak bırakır', async () => {
    const k = await login('+905339981002', ['Ayşe', 'Yılmaz']);
    const ajan = app.get(SupportAgent);

    const hak = await call(
      app,
      'POST',
      '/support/tickets',
      {
        konu: 'diger',
        metin: 'Dün 5 ilk mesaj hakkım vardı, bugün 2 görünüyor. Hakkım neden azaldı?',
      },
      k.token,
    );
    expect(hak.status).toBe(201);
    const t1 = await db.supportTicket.findUniqueOrThrow({ where: { no: hak.body.no } });
    expect(await ajan.isle(t1.id)).toBe('yanitladi');
    expect(await ajan.isle(t1.id)).toBe('islem_yok');
    const t1s = await db.supportTicket.findUniqueOrThrow({ where: { id: t1.id } });
    expect(t1s.status).toBe('cozuldu');
    expect(t1s.agentConfidence).toBe(93);
    const kullanici = await call(app, 'GET', `/support/tickets/${hak.body.no}`, undefined, k.token);
    const yanit = kullanici.body.mesajlar.find((m: { taraf: string }) => m.taraf === 'destek');
    expect(yanit.kim).toBe('Rengarenk Destek · otomatik yanıt');
    expect(yanit.metin).toContain('bugün 0 ücretsiz ilk mesaj hakkını kullandın');
    const konsol = await staffCall(app, 'GET', `/staff/support/tickets/${t1.id}`, undefined, destekci);
    expect(konsol.body.ajan).toMatchObject({ yanitladi: true, guven: 93 });
    expect(konsol.body.mesajlar.at(-1).kim).toBe('Rengarenk Destek · Ajan');

    // Geri al: talep yeniden insana açılır
    const islem = await db.agentAction.findFirstOrThrow({ where: { kind: 'destek_yanit', entityId: t1.id } });
    expect((await staffCall(app, 'POST', `/staff/agent/actions/${islem.id}/undo`, {}, destekci)).status).toBe(
      204,
    );
    expect((await db.supportTicket.findUniqueOrThrow({ where: { id: t1.id } })).status).toBe('acik');

    // Satın aldığını söylüyor ama ek hak yok: ödeme kaydına bakılmalı, taslak insana
    const odedim = await call(
      app,
      'POST',
      '/support/tickets',
      { konu: 'diger', metin: 'Satın aldığım ilk mesaj hakları görünmüyor.' },
      k.token,
    );
    const t0 = await db.supportTicket.findUniqueOrThrow({ where: { no: odedim.body.no } });
    expect(await ajan.isle(t0.id)).toBe('taslak');
    expect((await db.supportTicket.findUniqueOrThrow({ where: { id: t0.id } })).agentNote).toContain(
      'ödeme kaydına bakılmalı',
    );

    // İade: ajan yanıtlamaz, iade önerisi açmaz
    const iade = await call(
      app,
      'POST',
      '/support/tickets',
      { konu: 'odeme', metin: 'Yanlış paket aldım, İade istiyorum.' },
      k.token,
    );
    const t2 = await db.supportTicket.findUniqueOrThrow({ where: { no: iade.body.no } });
    const onaylar = await db.approval.count({ where: { kind: 'REFUND' } });
    expect(await ajan.isle(t2.id)).toBe('insana');
    expect(await db.approval.count({ where: { kind: 'REFUND' } })).toBe(onaylar);
    const t2s = await db.supportTicket.findUniqueOrThrow({ where: { id: t2.id } });
    expect(t2s.status).toBe('acik');
    expect(t2s.agentNote).toContain('iadeyi yalnızca sahip onaylar');
    expect(t2s.agentDraft).toBeNull();

    // Ödeme konusunda sık sorulanlardan yanıt: güven %90'ın altında kalır, taslak insana
    const sss = await call(
      app,
      'POST',
      '/support/tickets',
      { konu: 'odeme', metin: 'Telefon numaramı nasıl değiştiririm?' },
      k.token,
    );
    const t3 = await db.supportTicket.findUniqueOrThrow({ where: { no: sss.body.no } });
    expect(await ajan.isle(t3.id)).toBe('taslak');
    const d3 = await staffCall(app, 'GET', `/staff/support/tickets/${t3.id}`, undefined, destekci);
    expect(d3.body.durum).toBe('acik');
    expect(d3.body.ajan.taslak).toMatch(/^Merhaba, /);
    expect(d3.body.ajan.guven).toBeLessThan(90);
    expect(d3.body.ajan.not).toMatch(/^Sık sorulanlardan: /);

    const kuyruk = await staffCall(app, 'GET', '/staff/support/tickets', undefined, destekci);
    const kendi = kuyruk.body.sayilar.find((x: { ad: string }) => x.ad === 'Ajanın kendi çözdüğü');
    expect(kendi.deger).toMatch(/^%\d+$/);
    expect(kendi.not).toMatch(/^Son 30 gün · geri dönen %\d+$/);
  });

  it('spam: 24 saatte 5 farklı kişiden şikâyet alan hesap kısıtlanır; ajan durunca kısıtlamaz', async () => {
    const sp = await login('+905339981003', ['Spam', 'Hesap']);
    const ms = app.get(ModerationService);
    const sikayet = () =>
      db.report.create({
        data: {
          id: uuidv7(),
          source: 'kullanici',
          reporterUserId: uuidv7(),
          targetType: 'mesaj',
          targetId: uuidv7(),
          targetUserId: sp.userId,
          reason: 'spam',
          priority: 'normal',
          dueAt: new Date(Date.now() + 86_400_000),
        },
      });
    for (let i = 0; i < 4; i++) await sikayet();
    expect(await ms.ajanSpamKontrolu(sp.userId)).toBe('islem_yok');
    await sikayet();

    // Ajan durdurulduysa otomatik kısıtlama yok
    await db.featureFlag.update({ where: { key: 'ajan' }, data: { enabled: false } });
    AgentService.unut();
    expect(await ms.ajanSpamKontrolu(sp.userId)).toBe('islem_yok');
    await db.featureFlag.update({ where: { key: 'ajan' }, data: { enabled: true } });
    AgentService.unut();

    expect(await ms.ajanSpamKontrolu(sp.userId)).toBe('kisitlandi');
    expect(await ms.ajanSpamKontrolu(sp.userId)).toBe('islem_yok');
    const a = await db.userSanction.findFirstOrThrow({ where: { userId: sp.userId, byAgent: true } });
    expect(a.until && a.until > new Date()).toBe(true);
    const islem = await db.agentAction.findFirstOrThrow({ where: { kind: 'spam_kisit', undoneAt: null } });
    expect(islem.reason).toContain('5 farklı kişiden şikâyet');
    expect(
      (await staffCall(app, 'POST', `/staff/agent/actions/${islem.id}/undo`, {}, moderator)).status,
    ).toBe(204);
    expect((await db.userSanction.findUniqueOrThrow({ where: { id: a.id } })).liftedAt).not.toBeNull();
  });

  it('SMS ana sağlayıcı art arda hata verince yedeğe geçiş ajanın akışına yazılır', async () => {
    let hata = 0;
    const ana: SmsSender = {
      name: 'ana',
      send: async () => {
        hata++;
        throw new SmsError('zaman aşımı', 'ana', false);
      },
    };
    const yedek: SmsSender = { name: 'yedek', send: async () => ({ provider: 'yedek', messageId: 'y1' }) };
    const kayitlar: string[] = [];
    const f = new FailoverSmsSender(ana, yedek, {
      failureThreshold: 2,
      onFailover: (i) => kayitlar.push(i.primary),
    });
    await f.send('+905339981004', 'kod');
    await f.send('+905339981004', 'kod');
    await f.send('+905339981004', 'kod');
    expect(hata).toBe(2);
    expect(kayitlar).toEqual(['ana']);

    // Modüldeki bağlantı: akışa "SMS sağlayıcısı yedeğe geçirildi"
    const env = { ...app.get<Env>(ENV), SMS_PROVIDER: 'test', SMS_FALLBACK_PROVIDER: 'console' } as Env;
    const s = createSmsSender(env, app.get(AgentService), db) as FailoverSmsSender;
    expect(s).toBeInstanceOf(FailoverSmsSender);
  });

  it('ana ölçü 24 saatte 5 puandan fazla düşerse uyarı', async () => {
    const simdi = new Date();
    const a = await login('+905339981005', ['Ana', 'Ölçü']);
    const hesap = await db.accountMember.findFirstOrThrow({
      where: { userId: a.userId },
      select: { accountId: true },
    });
    const kat = await db.category.findFirstOrThrow({ where: { slug: 'otomobil' }, select: { id: true } });
    const yaz = async (saatOnce: number, mesajli: boolean) => {
      const id = uuidv7();
      const yayin = new Date(simdi.getTime() - saatOnce * 3_600_000);
      await db.demand.create({
        data: {
          id,
          userId: a.userId,
          accountId: hesap.accountId,
          categoryId: kat.id,
          status: 'PUBLISHED',
          schemaVersion: 1,
          publishedAt: yayin,
          expiresAt: new Date(simdi.getTime() + 30 * 86_400_000),
          data: {},
        },
      });
      if (mesajli)
        await db.conversation.create({
          data: {
            id: uuidv7(),
            origin: 'talep',
            demandId: id,
            buyerUserId: a.userId,
            sellerUserId: a.userId,
            sellerAccountId: hesap.accountId,
            status: 'OPEN',
            entitlement: 'gunluk',
            lastMessageAt: new Date(yayin.getTime() + 3_600_000),
            createdAt: new Date(yayin.getTime() + 3_600_000),
          },
        });
    };
    // Önceki gün 20 talebin 18'i (%90), son gün 20 talebin 14'ü (%70)
    for (let i = 0; i < 20; i++) await yaz(80, i < 18);
    for (let i = 0; i < 20; i++) await yaz(60, i < 14);
    const u = app.get(StaffAlertService);
    expect(await u.anaOlcu(simdi)).toBeGreaterThan(0);
    expect(await u.anaOlcu(simdi)).toBe(0);
    const al = await db.staffAlert.findFirstOrThrow({ where: { rule: 'ana_olcu' } });
    expect(al.title).toBe('Ana ölçü 20 puan düştü: %70');
  });
});
