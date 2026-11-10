import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { colors, DEFAULT_DESIGN, templateOf } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApprovalExecutor } from '../src/approvals/approval-executor.js';
import type { Db } from '../src/database/prisma.js';
import { TemplatesService } from '../src/notifications/templates.service.js';
import { call, createTestApp } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
});
afterAll(() => app.close());

const pgCode = (e: unknown) => String((e as Error)?.message).match(/Code: `(RR0\d\d)`/)?.[1];
const gun = (fark: number) =>
  new Date(Date.now() + 3 * 3_600_000 + fark * 86_400_000).toISOString().slice(0, 10);

describe('Tasarım değerleri (YonetimIcerik.dc.html; Karar 46)', () => {
  it('taslak, okunabilirlik denetimi, sahip ya da yönetici onayıyla yayın; web, mobil ve e-posta yayındakini okur', async () => {
    const ilk = (await call(app, 'GET', '/tasarim')).body;
    expect(ilk).toMatchObject({
      surum: 0,
      degerler: { yaziTipi: 'Plus Jakarta Sans', kartKose: 18 },
      tema: null,
      font: { ad: 'Plus Jakarta Sans' },
    });

    const admin = await createStaff(db, 'ADMIN');
    const owner = await createStaff(db, 'OWNER');
    const at = (await loginAs(app, admin)).token;
    const ot = (await loginAs(app, owner)).token;
    const v = (await staffCall(app, 'GET', '/staff/design', undefined, at)).body;
    expect(v.fontlar.length).toBeGreaterThanOrEqual(60);
    expect(v.renkler.find((r: { key: string }) => r.key === 'murekkep')).toMatchObject({
      not: 'Metin · zemine karşıtlık 14,7:1',
      grup: 'Metin ve yüzeyler',
    });
    expect(v.renkler.find((r: { key: string }) => r.key === 'maviYazi')).toMatchObject({
      ad: 'Mavi üstündeki yazı',
      grup: 'Renkli zeminlerin üstündeki yazı',
    });

    // Okunmayan bağlantı rengi onaya gönderilemez
    const kotu = { ...DEFAULT_DESIGN, renkler: { ...DEFAULT_DESIGN.renkler, baglanti: '#A9C1FF' } };
    expect((await staffCall(app, 'PUT', '/staff/design/draft', { degerler: kotu }, at)).body).toEqual({
      surum: 1,
    });
    const red = await staffCall(app, 'POST', '/staff/design/submit', {}, at);
    expect(red.status).toBe(400);
    expect(red.body.message).toMatch(/^Bağlantı rengi zemine karşı okunmuyor/);

    const iyi = {
      ...DEFAULT_DESIGN,
      renkler: { ...DEFAULT_DESIGN.renkler, mavi: '#4F7DF0' },
      yaziTipi: 'Manrope',
      kartKose: 16,
      temalar: [
        {
          id: 'yilbasi',
          ad: 'Yılbaşı',
          baslangic: gun(-1),
          bitis: gun(10),
          ustBant: '#22306B',
          ustYazi: '#FFFFFF',
          rozet: '❄ Mutlu yıllar',
          not: 'Ana sayfa bannerı Banner ve vitrin’den',
        },
      ],
    };
    expect(
      (await staffCall(app, 'PUT', '/staff/design/draft', { degerler: iyi, not: 'Yılbaşı hazırlığı' }, at))
        .body,
    ).toEqual({ surum: 1 });
    const g = await staffCall(app, 'POST', '/staff/design/submit', {}, at);
    expect(g.status).toBe(201);
    expect(g.body.degisiklikler).toEqual([
      'Mavi · ana renk: #5B8CFF → #4F7DF0',
      'Yazı tipi: Plus Jakarta Sans → Manrope',
      'Kart köşesi: 18 → 16 px',
      `Tema eklendi: Yılbaşı (${gun(-1)} – ${gun(10)})`,
    ]);
    // İsteyen yönetici kendi isteğini onaylayamaz; sahip onaylar, işçi yayına alır
    expect(
      (await staffCall(app, 'POST', `/staff/approvals/${g.body.approvalId}/approve`, {}, at)).status,
    ).toBe(403);
    expect(
      (await staffCall(app, 'POST', `/staff/approvals/${g.body.approvalId}/approve`, {}, ot)).status,
    ).toBe(200);
    expect(await app.get(ApprovalExecutor).execute(g.body.approvalId)).toBe('yurutuldu');

    const yayin = (await call(app, 'GET', '/tasarim')).body;
    expect(yayin).toMatchObject({
      surum: 1,
      degerler: { yaziTipi: 'Manrope', kartKose: 16, renkler: { mavi: '#4F7DF0' } },
      tema: { ad: 'Yılbaşı', ustBant: '#22306B' },
      font: { css: expect.stringContaining('family=Manrope') },
    });
    const kayit = await db.designVersion.findFirstOrThrow({ where: { status: 'yayinda' } });
    await expect(
      db.designVersion.update({ where: { id: kayit.id }, data: { tokens: DEFAULT_DESIGN } }),
    ).rejects.toSatisfy((e) => pgCode(e) === 'RR043');

    // E-posta: yazı tipi, köşe ve tema başlığı; renkler ortak değerlerden
    await app.get(TemplatesService).email; // hizmet hazır
    const { DesignService } = await import('../src/content/design.service.js');
    await app.get(DesignService).uygula();
    expect(colors.blue).toBe('#4F7DF0');
    const sablon = templateOf('hesap.telefon_degisti');
    const e = await app
      .get(TemplatesService)
      .email(sablon as never, { ad: 'Ayşe', tel: '+90 5XX XXX XX 41' });
    expect(e?.html).toContain('Manrope');
    expect(e?.html).toContain('#22306B');
    expect(e?.html).toContain('#4F7DF0');
  });

  it('mavi butonda beyaz yazı ve köşesiz tasarım gönderilir; onaydaki taslak geri çekilip yeniden düzenlenir', async () => {
    const admin = await createStaff(db, 'ADMIN');
    const at = (await loginAs(app, admin)).token;
    const yayinda = (await call(app, 'GET', '/tasarim')).body.degerler;
    const yeni = {
      ...yayinda,
      renkler: { ...yayinda.renkler, maviYazi: '#FFFFFF' },
      kartKose: 0,
      butonKose: 0,
      etiketKose: 0,
    };
    await staffCall(app, 'PUT', '/staff/design/draft', { degerler: yeni }, at);
    const v = (await staffCall(app, 'GET', '/staff/design', undefined, at)).body;
    expect(v.sorunlar).toEqual([]);
    expect(v.uyarilar[0]).toMatch(/^Mavi üstündeki yazı: /);
    const g = await staffCall(app, 'POST', '/staff/design/submit', {}, at);
    expect(g.status).toBe(201);
    expect(g.body.degisiklikler).toEqual(
      expect.arrayContaining(['Mavi üstündeki yazı: #1E2333 → #FFFFFF', 'Kart köşesi: 16 → 0 px']),
    );
    expect((await staffCall(app, 'GET', '/staff/design', undefined, at)).body.taslak.onayda).toBe(true);

    // Başkası geri çekemez; gönderen geri çeker, taslak yeniden düzenlenir
    const diger = await createStaff(db, 'ADMIN');
    const dt = (await loginAs(app, diger)).token;
    expect((await staffCall(app, 'POST', '/staff/design/geri-cek', {}, dt)).status).toBe(403);
    expect((await staffCall(app, 'POST', '/staff/design/geri-cek', {}, at)).status).toBe(201);
    const sonra = (await staffCall(app, 'GET', '/staff/design', undefined, at)).body;
    expect(sonra.taslak).toMatchObject({ onayda: false, degerler: { kartKose: 0 } });
    expect(
      (await staffCall(app, 'PUT', '/staff/design/draft', { degerler: { ...yeni, butonKose: 4 } }, at)).body,
    ).toEqual({ surum: sonra.taslak.surum });
    expect((await staffCall(app, 'POST', '/staff/design/geri-cek', {}, at)).status).toBe(409);
  });
});
