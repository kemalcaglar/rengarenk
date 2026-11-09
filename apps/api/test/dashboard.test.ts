import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { StaffAlertService } from '../src/staff-alerts/staff-alert.service.js';
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

const DAY = 86_400_000;

async function login(phone: string) {
  const r = await call(app, 'POST', '/auth/otp/request', { phone });
  const v = await call(app, 'POST', '/auth/otp/verify', {
    challengeId: r.body.challengeId,
    code: sms.lastCode(phone),
    consents: SIGNUP_CONSENTS,
  });
  const t = v.body.accessToken as string;
  await call(app, 'PATCH', '/me', { firstName: 'Ayşe', lastName: 'Yılmaz' }, t);
  return t;
}

async function talep(token: string) {
  const d = await app.inject({
    method: 'POST',
    url: '/demands',
    payload: { kategori: 'otomobil' },
    headers: { authorization: `Bearer ${token}`, 'x-rr-platform': 'IOS' },
  });
  const id = d.json().id as string;
  const data = {
    alanlar: {
      model: { make: 'bmw', series: 'bmw/3-serisi', model: 'bmw/3-serisi/320i' },
      konum: { il: 'İzmir', ilce: 'Karşıyaka' },
    },
    alternatifler: [{ butce: { min: 1_500_000, max: 2_000_000 }, yil: { min: 2019, max: 2023 } }],
  };
  await call(app, 'PATCH', `/demands/${id}`, { data, step: 6 }, token);
  const p = await call(app, 'POST', `/demands/${id}/publish`, {}, token);
  return { id, no: p.body.no as number };
}

describe('Kontrol paneli ve hedefler (Karar 44)', () => {
  it('ölçüler, kırılım, ana ölçü, hedefler, grafik notu ve hedef sapması uyarısı', async () => {
    const owner = await loginAs(app, await createStaff(db, 'OWNER'));
    const destek = await loginAs(app, await createStaff(db, 'SUPPORT'));
    const alici = await login('+905321110001');
    const satici = await login('+905321110002');
    const t = await talep(alici);
    expect(
      (await call(app, 'POST', `/talepler/${t.no}/mesaj`, { metin: 'Merhaba, aracım var' }, satici)).status,
    ).toBe(201);

    const o = await staffCall(app, 'GET', '/staff/dashboard?donem=bugun', undefined, owner.token);
    expect(o.status).toBe(200);
    const deger = (k: string) => o.body.olcumler.find((m: { key: string }) => m.key === k);
    expect(deger('talep')).toMatchObject({ deger: 1, fark: { metin: 'yeni' } });
    expect(deger('mesaj').deger).toBe(1);
    expect(deger('sohbet').deger).toBe(0);
    expect(o.body.grafik.gunler).toHaveLength(30);
    expect(o.body.grafik.gunler.at(-1).adet).toBe(1);
    // Yeni talep henüz 48 saati doldurmadı: ana ölçüye girmez
    expect(o.body.ana.toplam).toBe(0);

    const k = await staffCall(
      app,
      'GET',
      '/staff/dashboard/breakdown/talep?donem=bugun',
      undefined,
      owner.token,
    );
    const boyut = (ad: string) => k.body.kirilim.find((x: { ad: string }) => x.ad === ad);
    expect(boyut('İl').satir[0]).toMatchObject({ ad: 'İzmir', deger: 1, pay: 100 });
    expect(boyut('Platform').satir[0].ad).toBe('iOS');
    expect(boyut('Kategori').satir[0].ad).toBe('Otomobil');
    expect(k.body.yorum).toContain('İzmir’den');

    // 3 gün önce yayınlanmış ve 1 gün içinde mesaj almış gibi: ana ölçüye girer
    await db.demand.update({ where: { id: t.id }, data: { publishedAt: new Date(Date.now() - 3 * DAY) } });
    await db.conversation.updateMany({
      where: { demandId: t.id },
      data: { createdAt: new Date(Date.now() - 2.5 * DAY) },
    });
    const o2 = await staffCall(app, 'GET', '/staff/dashboard?donem=ay', undefined, owner.token);
    expect(o2.body.ana).toMatchObject({ oran: 1, toplam: 1 });

    // Hedefler: destek giremez; sahip girer, işlem kaydına yazılır
    const ay = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
    }).format(new Date());
    const govde = { ay, hedefler: { talep: 4500, ana_olcu: 80 } };
    expect((await staffCall(app, 'PUT', '/staff/dashboard/goals', govde, destek.token)).status).toBe(403);
    const h = await staffCall(app, 'PUT', '/staff/dashboard/goals', govde, owner.token);
    expect(h.status).toBe(200);
    const satir = (key: string) => h.body.satirlar.find((x: { key: string }) => x.key === key);
    expect(satir('talep')).toMatchObject({ mevcut: '1', hedef: '4.500' });
    expect(satir('ana_olcu')).toMatchObject({ mevcut: '%100', hedef: '%80', durum: 'yolunda' });
    expect(satir('gelir').hedef).toBeNull();
    expect(await db.auditLog.count({ where: { action: 'hedef_guncellendi' } })).toBe(1);

    // Ayın ilk günlerinde değilse talep hedefi geride: uyarı bir kez
    const alerts = app.get(StaffAlertService);
    const n = await alerts.hedefSapma(new Date());
    const gecen = h.body.gecen as number;
    if (gecen > 0.05) {
      expect(n).toBeGreaterThan(0);
      expect(await alerts.hedefSapma(new Date())).toBe(0);
      expect(
        await db.staffAlert.count({ where: { rule: 'hedef_sapma', dedupeKey: { contains: 'talep' } } }),
      ).toBeGreaterThan(0);
    }

    // Grafik notu
    const gun = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
    const not = await staffCall(
      app,
      'POST',
      '/staff/dashboard/notes',
      { gun, metin: 'Antalya duyurusu' },
      owner.token,
    );
    expect(not.body.notlar.at(-1)).toMatchObject({ gun, metin: 'Antalya duyurusu', kaynak: 'elle' });
  });

  it('raporlar: huni, harita, en çok talep edilenler, gelir, birim; dışa aktarma yetkisi ve kişisel pano', async () => {
    const owner = await loginAs(app, await createStaff(db, 'OWNER'));
    const finans = await loginAs(app, await createStaff(db, 'FINANCE'));
    const destek = await loginAs(app, await createStaff(db, 'SUPPORT'));
    const alici = await login('+905321110011');
    const satici = await login('+905321110012');
    const t = await talep(alici);
    await call(app, 'POST', `/talepler/${t.no}/mesaj`, { metin: 'Merhaba, aracım var' }, satici);
    await db.demand.update({ where: { id: t.id }, data: { publishedAt: new Date(Date.now() - 3 * DAY) } });
    await db.conversation.updateMany({
      where: { demandId: t.id },
      data: { createdAt: new Date(Date.now() - 2.9 * DAY) },
    });

    const h = await staffCall(app, 'GET', '/staff/reports/huni?tarih=30', undefined, owner.token);
    expect(h.status).toBe(200);
    const adim = (ad: string) => h.body.huni.find((x: { ad: string }) => x.ad === ad);
    expect(adim('Üyelik').sayi).toBeGreaterThan(0);
    expect(adim('Talep oluşturan').sayi).toBeGreaterThan(0);
    expect(adim('İlk mesaj alan talep').sayi).toBeGreaterThan(0);
    // Süzgeç: başka il → talep yok, üyelik gösterilmez
    const s = await staffCall(app, 'GET', '/staff/reports/huni?tarih=30&il=Konya', undefined, owner.token);
    expect(s.body.huni.find((x: { ad: string }) => x.ad === 'Üyelik')).toBeUndefined();
    expect(s.body.huni[0].sayi).toBe(0);
    expect(
      (await staffCall(app, 'GET', '/staff/reports/huni?tarih=yok', undefined, owner.token)).status,
    ).toBe(400);

    const m = await staffCall(app, 'GET', '/staff/reports/model', undefined, owner.token);
    expect(m.body.modeller[0]).toMatchObject({ ad: 'BMW 3 Serisi', arac: 0, durum: 'Büyük açık' });
    const hr = await staffCall(app, 'GET', '/staff/reports/harita', undefined, owner.token);
    expect(hr.body.satirlar[0].il).toBe('İzmir');
    expect(hr.body.kategoriler).toContain('Otomobil');
    const g = await staffCall(app, 'GET', '/staff/reports/gelir', undefined, owner.token);
    expect(g.body.sayilar.map((x: { ad: string }) => x.ad)).toEqual([
      'Toplam gelir',
      'Aylık tekrarlayan',
      'Galeri kayıp oranı',
      'Denemeden ücretliye',
      'İade oranı',
    ]);
    expect(g.body.mrr).toHaveLength(6);
    const b = await staffCall(app, 'GET', '/staff/reports/birim', undefined, owner.token);
    expect(b.body.kohort).toHaveLength(5);
    // Reklam ve edinim (Karar 35): harcama çekilmediyse not bunu söyler; kanal kırılımı üç satır
    const rk = await staffCall(app, 'GET', '/staff/reports/reklam', undefined, owner.token);
    expect(rk.body.cekimNotu).toContain('henüz çekim yok');
    expect(rk.body.kanallar).toHaveLength(3);

    // Dışa aktarma: destek yapamaz; finans yapar, kişisel veri yok, işlem kaydına girer
    expect((await staffCall(app, 'GET', '/staff/reports/model/export', undefined, destek.token)).status).toBe(
      403,
    );
    const x = await staffCall(app, 'GET', '/staff/reports/model/export', undefined, finans.token);
    expect(x.status).toBe(200);
    expect(x.body.csv).toContain('BMW 3 Serisi');
    expect(x.body.csv).not.toContain('+90532');
    expect(await db.auditLog.count({ where: { action: 'rapor_disa_aktarildi' } })).toBe(1);

    const v = await staffCall(
      app,
      'POST',
      '/staff/reports/views',
      { ad: 'İzmir otomobil', sekme: 'harita', filtre: { tarih: '30', karsilastir: 'onceki', il: 'İzmir' } },
      owner.token,
    );
    expect(v.body[0]).toMatchObject({ name: 'İzmir otomobil', tab: 'harita' });
    // Pano kişiseldir
    expect((await staffCall(app, 'GET', '/staff/reports/views', undefined, finans.token)).body).toEqual([]);
  });
});
