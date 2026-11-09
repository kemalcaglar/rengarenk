import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApprovalExecutor } from '../src/approvals/approval-executor.js';
import type { Db } from '../src/database/prisma.js';
import type { MemorySmsSender } from '../src/sms/console.sender.js';
import { call, createTestApp, SIGNUP_CONSENTS } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let sms: MemorySmsSender;
let db: Db;

beforeAll(async () => {
  ({ app, sms, db } = await createTestApp());
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
  return v.body.accessToken as string;
}

async function talep(token: string) {
  const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, token);
  await call(
    app,
    'PATCH',
    `/demands/${d.body.id}`,
    {
      data: {
        alanlar: {
          model: { make: 'bmw', series: 'bmw/3-serisi' },
          konum: { il: 'İstanbul', ilce: 'Kadıköy' },
        },
        alternatifler: [{ butce: { min: 2_000_000, max: 2_500_000 }, yil: { min: 2019, max: 2023 } }],
      },
      step: 6,
    },
    token,
  );
  const p = await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, token);
  return p.body.no as number;
}

const fatura = { ad: 'Ayşe Yılmaz', eposta: 'ayse@ornek.com', il: 'İstanbul', ilce: 'Kadıköy' };
const form = (url: string, body: Record<string, string>) =>
  app.inject({
    method: 'POST',
    url,
    payload: new URLSearchParams(body).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });

const kupon = (ek: object = {}) => ({
  kod: 'ust20',
  ad: 'Hafta sonu üst sıra',
  yuzde: 20,
  hedefler: ['ust_sira'],
  kitle: 'bireysel',
  baslangic: new Date(Date.now() - 3_600_000).toISOString(),
  bitis: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  toplamSinir: 100,
  ...ek,
});

describe('Kuponlar (Karar 40, 51, 56)', () => {
  it('dört göz onayı, %50 üstü yalnız sahip, ödemede indirim, hesap başına bir kez, iptal', async () => {
    const pazarlama = await loginAs(app, await createStaff(db, 'MARKETING'));
    const yonetici = await loginAs(app, await createStaff(db, 'ADMIN'));
    const sahip = await loginAs(app, await createStaff(db, 'OWNER'));
    const destek = await loginAs(app, await createStaff(db, 'SUPPORT'));
    expect((await staffCall(app, 'POST', '/staff/coupons', kupon(), destek.token)).status).toBe(403);

    const c = await staffCall(app, 'POST', '/staff/coupons', kupon(), pazarlama.token);
    expect(c.status).toBe(200);
    expect(c.body[0]).toMatchObject({
      kod: 'UST20',
      durum: 'Onay bekliyor',
      kullanim: '0 / 100 kullanım · 0 TL indirim',
    });
    expect((await staffCall(app, 'POST', '/staff/coupons', kupon(), pazarlama.token)).status).toBe(409);

    const k = await db.coupon.findUniqueOrThrow({ where: { code: 'UST20' } });
    const onay = (id: string, token: string) =>
      staffCall(app, 'POST', `/staff/approvals/${id}/approve`, {}, token);
    expect((await onay(k.approvalId as string, yonetici.token)).status).toBe(200);
    expect(await app.get(ApprovalExecutor).execute(k.approvalId as string)).toBe('yurutuldu');

    // %50'nin üstü: yönetici onaylayamaz, sahip onaylar
    await staffCall(app, 'POST', '/staff/coupons', kupon({ kod: 'BUYUK60', yuzde: 60 }), pazarlama.token);
    const b = await db.coupon.findUniqueOrThrow({ where: { code: 'BUYUK60' } });
    expect((await onay(b.approvalId as string, yonetici.token)).status).toBe(403);
    expect((await onay(b.approvalId as string, sahip.token)).status).toBe(200);

    // Kullanıcı: önizleme yalnızca uygun ürüne indirim yapar
    const u = await login('+905321270001');
    const no = await talep(u);
    expect(
      (await call(app, 'POST', '/orders/kupon', { kod: 'YOK1', urunler: ['ust_sira_7'] }, u)).body.message,
    ).toBe('Kupon kodu bulunamadı');
    const o = await call(
      app,
      'POST',
      '/orders/kupon',
      { kod: 'ust20', urunler: ['ust_sira_7', 'mesaj_10'] },
      u,
    );
    expect(o.status).toBe(200);
    const [ust, mesaj] = o.body.kalemler;
    expect(mesaj.indirimKurus).toBe(0);
    expect(ust.indirimKurus).toBeGreaterThan(0);
    const liste = ust.tutarKurus + ust.indirimKurus;
    expect(ust.indirimKurus).toBe(Math.floor((liste * 20) / 100));
    expect(o.body.indirimKurus).toBe(ust.indirimKurus);

    // Sipariş: indirimli tutar; ödeme alınınca kullanım yazılır
    const s = await call(
      app,
      'POST',
      '/orders',
      {
        kalemler: [{ urun: 'ust_sira_7', talepNo: no }],
        fatura,
        kupon: 'UST20',
        onay: { sozlesme: true, cayma: true },
      },
      u,
    );
    expect(s.status).toBe(201);
    expect(s.body.toplamKurus).toBe(ust.tutarKurus);
    const siparis = await db.order.findUniqueOrThrow({ where: { no: s.body.no } });
    expect(siparis).toMatchObject({ couponId: k.id, discountKurus: BigInt(ust.indirimKurus) });
    await form(`/odeme/sahte/${s.body.no}`, { durum: 'success' });
    expect(await db.couponRedemption.count({ where: { couponId: k.id } })).toBe(1);
    // Aynı hesap ikinci kez kullanamaz
    const iki = await call(app, 'POST', '/orders/kupon', { kod: 'UST20', urunler: ['ust_sira_7'] }, u);
    expect(iki.body.message).toBe('Bu kuponu daha önce kullandın');

    const l = await staffCall(app, 'GET', '/staff/coupons', undefined, pazarlama.token);
    const satir = l.body.find((x: { kod: string }) => x.kod === 'UST20');
    expect(satir.durum).toBe('Geçerli');
    expect(satir.kullanim).toMatch(/^1 \/ 100 kullanım · /);

    // İptal edilen kupon kullanılamaz
    await staffCall(app, 'POST', `/staff/coupons/${b.id}/cancel`, {}, pazarlama.token);
    const u2 = await login('+905321270002');
    expect(
      (await call(app, 'POST', '/orders/kupon', { kod: 'BUYUK60', urunler: ['ust_sira_7'] }, u2)).body
        .message,
    ).toBe('Kupon geçerli değil');
    for (const action of ['kupon_hazirlandi', 'kupon_iptal'])
      expect(await db.auditLog.count({ where: { action } })).toBeGreaterThan(0);
  });
});
