import { createHash } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeAdNetwork } from '../src/ads/ad-networks.js';
import { AdsService } from '../src/ads/ads.service.js';
import type { Db } from '../src/database/prisma.js';
import { call, createTestApp, uyeOl } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;
let ads: AdsService;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
  ads = app.get(AdsService);
  FakeAdNetwork.gonderilen = [];
  const bmw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  const s = await db.catalogSeries.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi', makeId: bmw.id, name: '3 Serisi', categories: ['otomobil'] },
  });
  await db.catalogModel.create({
    data: { id: uuidv7(), key: 'bmw/3-serisi/320i', makeId: bmw.id, seriesId: s.id, name: '320i' },
  });
});
afterAll(() => app.close());

async function uye(phone: string, reklamOlcum: boolean) {
  const v = await uyeOl(app, phone, { consents: { reklamOlcum } });
  return { token: v.accessToken, id: v.userId, challengeId: v.challengeId };
}

async function talep(token: string) {
  const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, token);
  const data = {
    alanlar: {
      model: { make: 'bmw', series: 'bmw/3-serisi', model: 'bmw/3-serisi/320i' },
      konum: { il: 'İstanbul', ilce: 'Kadıköy' },
    },
    alternatifler: [{ butce: { min: 2_000_000, max: 2_500_000 }, yil: { min: 2019, max: 2023 } }],
  };
  await call(app, 'PATCH', `/demands/${d.body.id}`, { data, step: 6 }, token);
  await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, token);
  return d.body.id as string;
}

const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const temas = (o: Record<string, string>) => ({ sayfa: '/galeri-ol', at: new Date().toISOString(), ...o });

describe('reklam ölçümü (Karar 35)', () => {
  it('izinli üyede temas ve olaylar; tekilleşen kimlik; Meta ve Google gönderimi; onayın geri alınması', async () => {
    const a = await uye('+905336660001', true);
    const b = await uye('+905336660002', false);

    // Temas: izinli üyede tıklama kimlikleri, IP ve tarayıcı saklanır; çerez izni yoksa saklanmaz
    const ilk = temas({
      utm_source: 'meta',
      utm_medium: 'paid',
      utm_campaign: 'galeri_ol_istanbul',
      fbclid: 'IwAR123',
      fbc: 'fb.1.1700000000000.IwAR123',
      gclid: 'Cj0KCQ',
    });
    const t1 = await app.inject({
      method: 'POST',
      url: '/me/temas',
      payload: { ilk, son: ilk, reklam: true },
      headers: { authorization: `Bearer ${a.token}`, 'user-agent': 'Deneme/1.0' },
    });
    expect(t1.statusCode).toBe(204);
    const at = await db.userAttribution.findUniqueOrThrow({ where: { userId: a.id } });
    expect(at).toMatchObject({
      channel: 'reklam',
      network: 'Meta',
      campaign: 'galeri_ol_istanbul',
      cookieOk: true,
      userAgent: 'Deneme/1.0',
    });
    expect(at.ip).toBeTruthy();
    expect((at.first as { fbclid?: string }).fbclid).toBe('IwAR123');

    await call(app, 'POST', '/me/temas', { ilk, son: ilk, reklam: false }, b.token);
    const bt = await db.userAttribution.findUniqueOrThrow({ where: { userId: b.id } });
    expect(bt.first).not.toHaveProperty('fbclid');
    expect(bt.first).not.toHaveProperty('gclid');
    expect(bt).toMatchObject({ ip: null, userAgent: null, cookieOk: false, campaign: 'galeri_ol_istanbul' });

    // İlk temas değişmez, son temas güncellenir
    const sonra = temas({
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'marka_model',
      gclid: 'Cj0KCQ',
    });
    sonra.at = new Date(Date.now() + 1000).toISOString();
    await call(app, 'POST', '/me/temas', { ilk: null, son: sonra, reklam: true }, a.token);
    const at2 = await db.userAttribution.findUniqueOrThrow({ where: { userId: a.id } });
    expect(at2.campaign).toBe('galeri_ol_istanbul');
    expect((at2.last as { utm_campaign: string }).utm_campaign).toBe('marka_model');

    // Olaylar yalnızca onaylı üyede, işlemle birlikte; kimlik tarayıcıyla aynı
    expect(await db.adEvent.findMany({ where: { userId: b.id } })).toHaveLength(0);
    const kayit = await db.adEvent.findUniqueOrThrow({ where: { id: `uyelik-${a.challengeId}` } });
    expect(kayit).toMatchObject({
      name: 'CompleteRegistration',
      metaStatus: 'bekliyor',
      googleStatus: 'yok',
    });
    const d = await talep(a.token);
    await talep(b.token);
    const lead = await db.adEvent.findUniqueOrThrow({ where: { id: `talep-${d}` } });
    expect(lead).toMatchObject({ name: 'Lead', userId: a.id });
    expect(lead.category).toBeTruthy();
    // Galeri onayı: yalnızca sunucudan, Google'a da gider; aynı kayıt ikinci kez yazılmaz
    for (let i = 0; i < 2; i++)
      await db.$transaction((tx) =>
        ads.olay(tx, a.id, 'DealerApproved', { ref: 'basvuru-1', platform: 'sunucu' }),
      );
    expect(await db.adEvent.count({ where: { userId: a.id, name: 'DealerApproved' } })).toBe(1);

    // Ağ hatası: olay bekler, deneme sayılır, Entegrasyonlar'da görünür
    FakeAdNetwork.hata.meta = 'Meta 500: geçici hata';
    await ads.gonder();
    expect((await db.adEvent.findUniqueOrThrow({ where: { id: lead.id } })).tries).toBe(1);
    expect((await ads.durum()).meta).toMatchObject({ hata: 'Meta 500: geçici hata', bekleyen: 3 });
    FakeAdNetwork.hata = {};

    // Google olayı ilk turda gitti (yalnızca Meta hata verdi)
    expect(await ads.gonder()).toBe(3);
    const meta = FakeAdNetwork.gonderilen.filter((g) => g.ag === 'meta').map((g) => g.olay);
    expect(meta.map((e) => e.name).sort()).toEqual(['CompleteRegistration', 'DealerApproved', 'Lead']);
    const l = meta.find((e) => e.name === 'Lead');
    expect(l).toMatchObject({
      id: `talep-${d}`,
      kaynak: 'web',
      user: {
        externalId: sha(a.id),
        ph: sha('905336660001'),
        fbc: 'fb.1.1700000000000.IwAR123',
        // Tarayıcı bilgisi son temastan
        ua: 'lightMyRequest',
      },
    });
    // Sunucu olayında tarayıcı bilgisi gitmez; telefon ve kimlik yalnızca özet
    const g = meta.find((e) => e.name === 'DealerApproved');
    expect(g?.kaynak).toBe('sunucu');
    expect(g?.user.ua).toBeUndefined();
    expect(JSON.stringify(FakeAdNetwork.gonderilen)).not.toContain('+905336660001');
    const google = FakeAdNetwork.gonderilen.filter((x) => x.ag === 'google');
    expect(google).toHaveLength(1);
    expect(google[0]?.olay.user.gclid).toBe('Cj0KCQ');
    expect((await ads.durum()).meta).toMatchObject({ hata: null, bekleyen: 0 });

    // Onay geri alınır: bekleyen olay iptal, tıklama kimlikleri, IP ve tarayıcı silinir, yeni olay yazılmaz
    await db.$transaction((tx) =>
      ads.olay(tx, a.id, 'Purchase', { ref: 'SIP1', platform: 'web', degerKurus: 9900 }),
    );
    expect((await call(app, 'GET', '/me/reklam-olcum', undefined, a.token)).body).toEqual({ acik: true });
    const kapat = await call(app, 'PUT', '/me/reklam-olcum', { acik: false }, a.token);
    expect(kapat.body).toEqual({ acik: false });
    expect((await db.adEvent.findUniqueOrThrow({ where: { id: 'satin-SIP1' } })).metaStatus).toBe('iptal');
    const at3 = await db.userAttribution.findUniqueOrThrow({ where: { userId: a.id } });
    expect(at3).toMatchObject({ ip: null, userAgent: null, campaign: 'galeri_ol_istanbul' });
    expect(JSON.stringify(at3.first)).not.toContain('IwAR123');
    expect(
      await db.$transaction((tx) => ads.olay(tx, a.id, 'Purchase', { ref: 'SIP2', platform: 'web' })),
    ).toBeNull();
    expect(
      await db.consent.findFirst({
        where: { userId: a.id, kind: 'reklam_olcum' },
        orderBy: { createdAt: 'desc' },
      }),
    ).toMatchObject({ granted: false, textKey: 'reklam_olcum' });

    // Mobil olay Meta'ya sunucudan gitmez (Meta SDK ile gelecek)
    const c = await uye('+905336660003', true);
    await db.$transaction((tx) => ads.olay(tx, c.id, 'Purchase', { ref: 'SIP3', platform: 'ios' }));
    expect((await db.adEvent.findUniqueOrThrow({ where: { id: 'satin-SIP3' } })).metaStatus).toBe('yok');
  });

  it('harcama gece çekilir; Raporlar › Reklam ve edinim kampanyaya göre üyelik, talep ve maliyet', async () => {
    const dun = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
      new Date(Date.now() - 86_400_000),
    );
    FakeAdNetwork.harcamalar = {
      meta: {
        [dun]: [{ campaign: 'galeri_ol_istanbul', spendKurus: 60_000, impressions: 5000, clicks: 120 }],
      },
      google: { [dun]: [{ campaign: 'hic_uye_yok', spendKurus: 10_000, impressions: 900, clicks: 15 }] },
    };
    expect(await ads.harcamaCek()).toBe(2);
    // Yeniden çekim aynı günü değiştirir, çiftlemez
    expect(await ads.harcamaCek()).toBe(2);
    expect(await db.adSpend.count()).toBe(2);

    const sahip = await loginAs(app, await createStaff(db, 'OWNER'));
    const r = await staffCall(app, 'GET', '/staff/reports/reklam', undefined, sahip.token);
    expect(r.status).toBe(200);
    const k = r.body.kampanyalar as {
      ad: string;
      kanal: string;
      harcama: string;
      uye: string;
      talep: string;
    }[];
    const galeri = k.find((x) => x.ad === 'galeri_ol_istanbul');
    // A ve B bu kampanyadan geldi (ilk temas); ikisi de birer talep açtı
    expect(galeri).toMatchObject({ kanal: 'Meta · reklam', uye: '2', talep: '2', uyeBasi: '300 TL' });
    expect(k.find((x) => x.ad === 'hic_uye_yok')).toMatchObject({ uye: '0', kanal: 'Google · reklam' });
    expect(k.find((x) => x.ad === 'Organik')).toMatchObject({ harcama: '—', uye: '1' });
    expect(r.body.reklamSayilar[0]).toMatchObject({ ad: 'Toplam harcama', deger: '700 TL' });
    expect(r.body.cekimNotu).toContain('son çekim bugün');
    expect(r.body.kanallar.map((x: { uye: number }) => x.uye)).toEqual([2, 0, 1]);

    const durum = await staffCall(app, 'GET', '/staff/integrations', undefined, sahip.token);
    expect(durum.body.reklam.meta).toMatchObject({ saglayici: 'sahte (geliştirme)', acik: true });
    expect(durum.body.reklam.meta.sonHarcama).toBeTruthy();
  });
});
