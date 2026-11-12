import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { armOf } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApprovalExecutor } from '../src/approvals/approval-executor.js';
import type { Db } from '../src/database/prisma.js';
import { StaffAlertService } from '../src/staff-alerts/staff-alert.service.js';
import { call, createTestApp, uyeOl } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
});
afterAll(() => app.close());

async function login(phone: string) {
  const v = { body: await uyeOl(app, phone) };
  const u = await db.user.findUniqueOrThrow({ where: { phone } });
  return { token: v.body.accessToken as string, id: u.id };
}

const fatura = { ad: 'Ayşe Yılmaz', eposta: 'ayse@ornek.com', il: 'İstanbul', ilce: 'Kadıköy' };
const deney = (o: Record<string, unknown> = {}) => ({
  ad: 'Ek ilk mesaj (10 adet) fiyatı: 99 TL mi, 119 TL mi?',
  urun: 'mesaj_10',
  fiyatB: 119,
  gun: 14,
  ...o,
});

/** Sentetik kullanıcılar: deneyde fiyatı görmüş, bir kısmı ödemiş (kol kimlikten) */
async function sentetik(expId: string, adet: number) {
  const gecen = new Date(Date.now() - 2 * 86_400_000);
  const dun = new Date(Date.now() - 86_400_000);
  const users = Array.from({ length: adet }, (_, i) => ({
    id: uuidv7(),
    phone: `+90539${String(i).padStart(7, '0')}`,
  }));
  await db.user.createMany({ data: users });
  const hesaplar = users.map((u) => ({ id: uuidv7(), kind: 'INDIVIDUAL' as const, name: 'Bireysel', u }));
  await db.account.createMany({ data: hesaplar.map((h) => ({ id: h.id, kind: h.kind, name: h.name })) });
  await db.accountMember.createMany({
    data: hesaplar.map((h) => ({ accountId: h.id, userId: h.u.id, role: 'OWNER' as const })),
  });
  await db.priceExperimentExposure.createMany({
    data: users.map((u) => ({ experimentId: expId, userId: u.id, arm: armOf(u.id, expId), seenAt: gecen })),
  });
  const say = { A: 0, B: 0 };
  const siparisler = [];
  for (const h of hesaplar) {
    const kol = armOf(h.u.id, expId);
    say[kol]++;
    // A kolunda her beşinci, B kolunda her ikinci kişi alır
    if (say[kol] % (kol === 'A' ? 5 : 2) !== 0) continue;
    siparisler.push({
      id: uuidv7(),
      no: `S${siparisler.length}${Date.now()}`.slice(0, 20),
      accountId: h.id,
      userId: h.u.id,
      channel: 'web',
      status: 'PAID' as const,
      items: [],
      totalKurus: BigInt(kol === 'A' ? 9900 : 11900),
      vatKurus: 0n,
      billing: {},
      consents: {},
      preInfo: '',
      provider: 'fake',
      paidAt: dun,
    });
  }
  await db.order.createMany({ data: siparisler });
  return say;
}

describe('fiyat deneyleri (Karar 44, 56)', () => {
  it('sahip onayıyla başlar; kullanıcı kolundaki fiyatı her yerde görür; sonuç, durdurma ve kazananı önerme', async () => {
    const sahip = await loginAs(app, await createStaff(db, 'OWNER'));
    const yonetici = await loginAs(app, await createStaff(db, 'ADMIN'));
    const destek = await loginAs(app, await createStaff(db, 'SUPPORT'));
    const yeni = (b: Record<string, unknown>, token = yonetici.token) =>
      staffCall(app, 'POST', '/staff/pricing/experiments', b, token);

    expect((await yeni(deney(), destek.token)).status).toBe(403);
    expect((await yeni(deney({ fiyatB: 99 }))).body.message).toBe('B fiyatı liste fiyatıyla aynı');
    expect((await yeni(deney({ fiyatB: 200 }))).status).toBe(400);
    const c = await yeni(deney());
    expect(c.status).toBe(200);
    expect(c.body[0]).toMatchObject({ durum: 'onay_bekliyor', fiyatA: '99 TL', fiyatB: '119 TL' });
    expect((await yeni(deney())).status).toBe(409);

    // Yalnızca sahip onaylar; onaylanınca başlar
    const r = await db.priceExperiment.findFirstOrThrow({ where: { productKey: 'mesaj_10' } });
    const onay = (token: string) =>
      staffCall(app, 'POST', `/staff/approvals/${r.approvalId}/approve`, {}, token);
    expect((await onay(yonetici.token)).status).toBe(403);
    expect((await onay(sahip.token)).status).toBe(200);
    expect(await app.get(ApprovalExecutor).execute(r.approvalId as string)).toBe('yurutuldu');
    const basladi = await db.priceExperiment.findUniqueOrThrow({ where: { id: r.id } });
    expect(basladi.status).toBe('suruyor');
    expect(basladi.endsAt?.getTime()).toBeGreaterThan(Date.now() + 13 * 86_400_000);

    // Her koldan birer kullanıcı
    const kullanicilar: Record<'A' | 'B', { token: string; id: string } | null> = { A: null, B: null };
    for (let i = 0; !(kullanicilar.A && kullanicilar.B); i++) {
      const u = await login(`+90538100${String(i).padStart(4, '0')}`);
      const k = armOf(u.id, r.id);
      kullanicilar[k] ??= u;
    }
    const a = kullanicilar.A as { token: string; id: string };
    const b = kullanicilar.B as { token: string; id: string };
    expect((await call(app, 'GET', '/orders/fiyatlar', undefined, a.token)).body.urunler.mesaj_10).toBe(99);
    expect((await call(app, 'GET', '/orders/fiyatlar', undefined, b.token)).body.urunler.mesaj_10).toBe(119);
    const ov = await call(app, 'GET', '/orders/overview', undefined, b.token);
    expect(ov.body.urunler.find((u: { key: string }) => u.key === 'mesaj_10').kurus).toBe(11_900);
    // Herkese açık liste fiyatı değişmez
    expect((await call(app, 'GET', '/fiyatlar')).body.urunler.mesaj_10).toBe(99);
    // Ödeme kolun fiyatıyla
    const s = await call(
      app,
      'POST',
      '/orders',
      { kalemler: [{ urun: 'mesaj_10' }], fatura, onay: { sozlesme: true } },
      b.token,
    );
    expect(s.body.toplamKurus).toBe(11_900);
    expect(await db.priceExperimentExposure.count({ where: { experimentId: r.id } })).toBe(2);

    // Sonuç: sentetik kullanıcılarla B kişi başı daha çok gelir getirir
    const say = await sentetik(r.id, 260);
    expect(say.A).toBeGreaterThanOrEqual(100);
    expect(say.B).toBeGreaterThanOrEqual(100);
    const kart = async () =>
      (await staffCall(app, 'GET', '/staff/reports/deney', undefined, sahip.token)).body.deneyler.find(
        (d: { id: string }) => d.id === r.id,
      );
    const k1 = await kart();
    expect(k1).toMatchObject({ tur: 'fiyat', durum: 'Sonuç hazır', kazanan: 'B', eylem: null });
    expect(k1.olcu).toContain('Ölçü: bireysel kullanıcı başına gelir · yalnızca web');
    expect(k1.kollar.map((x: { ad: string }) => x.ad)).toEqual(['A · 99 TL', 'B · 119 TL']);
    expect(k1.sonuc).toMatch(/^B kolu kişi başı .* önde · güven %9\d/);

    // Bitmeden önerilmez; durdurunca herkes liste fiyatına döner
    const id = r.id;
    expect(
      (await staffCall(app, 'POST', `/staff/pricing/experiments/${id}/propose`, {}, yonetici.token)).status,
    ).toBe(409);
    const d = await staffCall(app, 'POST', `/staff/pricing/experiments/${id}/stop`, {}, yonetici.token);
    expect(d.body.find((x: { id: string }) => x.id === id).durum).toBe('durduruldu');
    expect((await call(app, 'GET', '/orders/fiyatlar', undefined, b.token)).body.urunler.mesaj_10).toBe(99);
    expect(await kart()).toMatchObject({
      durum: 'Sonuç hazır',
      eylem: { kol: 'B', yazi: 'B fiyatını öner' },
    });

    // Ajan kazananı bildirir
    expect(await app.get(StaffAlertService).deneySonuc()).toBeGreaterThan(0);

    // Kazanan fiyat listesine öneri olarak gider (sahip onaylar); ikinci kez önerilmez
    const o = await staffCall(app, 'POST', `/staff/pricing/experiments/${id}/propose`, {}, yonetici.token);
    expect(o.status).toBe(200);
    const kitap = await db.priceBook.findFirstOrThrow({ where: { status: 'onay_bekliyor' } });
    expect((kitap.data as { urunler: Record<string, number> }).urunler.mesaj_10).toBe(119);
    expect(kitap.changes.join(' ')).toContain('119');
    expect(await kart()).toMatchObject({ durum: 'Tamamlandı', eylem: null });
    expect(
      (await staffCall(app, 'POST', `/staff/pricing/experiments/${id}/propose`, {}, yonetici.token)).status,
    ).toBe(409);
    // Fiyat değişmedi: öneri onay bekliyor
    expect((await call(app, 'GET', '/fiyatlar')).body.urunler.mesaj_10).toBe(99);
  });
});
