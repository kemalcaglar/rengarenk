import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { call, createTestApp } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
});
afterAll(() => app.close());

const sayfa = (baslik = 'Alıcılar seni bekliyor: ilk 30 gün ücretsiz') => ({
  ad: 'Galeri ol · İstanbul',
  slug: 'galeri-ol',
  seoBaslik: 'Galeri ol: alıcılar sana gelsin | Rengarenk',
  utm: { source: 'meta', medium: 'paid', campaign: 'galeri_ol_istanbul' },
  bloklar: [
    { tur: 'baslik', baslik, alt: 'İlan vermeden müşteri bul', dugme: 'Başvur', hedef: 'galeri' },
    { tur: 'rakamlar', maddeler: [{ deger: '1.410', etiket: 'talep bu ay İstanbul’da' }] },
    { tur: 'sss', sorular: [{ soru: 'Deneme ücretli mi?', cevap: 'İlk 30 gün ücretsiz.' }] },
  ],
});

describe('Açılış sayfaları (Karar 46)', () => {
  it('taslak önizlenir, yayınlanınca kök adreste sunulur; sürüme dönülür; sayımlar kişisel veri tutmaz', async () => {
    const pazarlama = await loginAs(app, await createStaff(db, 'MARKETING'));
    const destek = await loginAs(app, await createStaff(db, 'SUPPORT'));
    expect((await staffCall(app, 'POST', '/staff/landing', sayfa(), destek.token)).status).toBe(403);
    expect(
      (await staffCall(app, 'POST', '/staff/landing', { ...sayfa(), slug: 'talepler' }, pazarlama.token))
        .status,
    ).toBe(400);

    const c = await staffCall(app, 'POST', '/staff/landing', sayfa(), pazarlama.token);
    expect(c.status).toBe(200);
    const id = c.body.id as string;
    expect(c.body.reklamBaglantisi).toBe(
      'http://localhost:3000/galeri-ol?utm_source=meta&utm_medium=paid&utm_campaign=galeri_ol_istanbul',
    );
    expect(c.body.olaylar).toEqual(['PageView', 'SubmitApplication (galeri başvurusu)']);
    expect(c.body.ozet[0]).toMatchObject({ ad: 'Başlık', renk: '#5B8CFF' });
    // Aynı adres ikinci kez alınamaz
    expect((await staffCall(app, 'POST', '/staff/landing', sayfa(), pazarlama.token)).status).toBe(409);

    // Yayında değil: herkese kapalı, önizleme bağlantısıyla açık
    expect((await call(app, 'GET', '/acilis/galeri-ol')).status).toBe(404);
    const token = new URL(c.body.onizleme).searchParams.get('onizleme') as string;
    const on = await call(app, 'GET', `/acilis/galeri-ol?onizleme=${token}`);
    expect(on.body).toMatchObject({
      onizleme: true,
      seoBaslik: 'Galeri ol: alıcılar sana gelsin | Rengarenk',
    });
    expect((await call(app, 'GET', '/acilis/galeri-ol?onizleme=1.x')).status).toBe(404);

    expect(
      (await staffCall(app, 'POST', `/staff/landing/${id}/publish`, {}, pazarlama.token)).body.surum,
    ).toBe(1);
    const acik = await call(app, 'GET', '/acilis/galeri-ol');
    expect(acik.body.bloklar[0].baslik).toBe('Alıcılar seni bekliyor: ilk 30 gün ücretsiz');

    // Taslak değişir, yayındaki aynı kalır; yeniden yayınlanır; 1. sürüme dönülür
    await staffCall(
      app,
      'PUT',
      `/staff/landing/${id}`,
      sayfa('Yeni başlık: alıcılar seni bekliyor'),
      pazarlama.token,
    );
    expect((await call(app, 'GET', '/acilis/galeri-ol')).body.bloklar[0].baslik).toBe(
      'Alıcılar seni bekliyor: ilk 30 gün ücretsiz',
    );
    const liste = await staffCall(app, 'GET', '/staff/landing', undefined, pazarlama.token);
    expect(liste.body[0]).toMatchObject({ adres: '/galeri-ol', durum: 'yayinda', taslakDegisti: true });
    await staffCall(app, 'POST', `/staff/landing/${id}/publish`, {}, pazarlama.token);
    expect((await call(app, 'GET', '/acilis/galeri-ol')).body.bloklar[0].baslik).toBe(
      'Yeni başlık: alıcılar seni bekliyor',
    );
    const geri = await staffCall(app, 'POST', `/staff/landing/${id}/rollback/1`, {}, pazarlama.token);
    expect(geri.body.surum).toBe(3);
    expect((await call(app, 'GET', '/acilis/galeri-ol')).body.bloklar[0].baslik).toBe(
      'Alıcılar seni bekliyor: ilk 30 gün ücretsiz',
    );

    // Sayımlar
    await call(app, 'POST', '/acilis/galeri-ol/olay', { tur: 'ziyaret' });
    await call(app, 'POST', '/acilis/galeri-ol/olay', { tur: 'ziyaret' });
    await call(app, 'POST', '/acilis/galeri-ol/olay', { tur: 'tiklama' });
    const l2 = await staffCall(app, 'GET', '/staff/landing', undefined, pazarlama.token);
    expect(l2.body[0].sonuc).toBe('2 ziyaret · %50 düğmeye tıkladı · son 30 gün');
    expect(await db.auditLog.count({ where: { action: 'acilis_yayinlandi', entityId: id } })).toBe(3);

    // Kapatılınca herkese kapanır
    await staffCall(app, 'POST', `/staff/landing/${id}/unpublish`, {}, pazarlama.token);
    expect((await call(app, 'GET', '/acilis/galeri-ol')).status).toBe(404);
  });
});
