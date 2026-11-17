import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/database/prisma.js';
import { DemandSearchService } from '../src/search/demand-search.service.js';
import { call, createTestApp, uyeOl } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;
let search: DemandSearchService;
let tel = 0;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
  search = app.get(DemandSearchService);
  const bmw = await db.catalogMake.create({ data: { id: uuidv7(), key: 'bmw', name: 'BMW' } });
  for (const [s, m] of [
    ['3-serisi', '320i'],
    ['5-serisi', '520i'],
  ] as const) {
    const series = await db.catalogSeries.create({
      data: {
        id: uuidv7(),
        key: `bmw/${s}`,
        makeId: bmw.id,
        name: s === '3-serisi' ? '3 Serisi' : '5 Serisi',
        categories: ['otomobil'],
      },
    });
    await db.catalogModel.create({
      data: { id: uuidv7(), key: `bmw/${s}/${m}`, makeId: bmw.id, seriesId: series.id, name: m },
    });
    await db.catalogTrim.create({
      data: {
        id: uuidv7(),
        key: `bmw/${s}/paket/m-sport`,
        makeId: bmw.id,
        seriesId: series.id,
        name: 'M Sport',
      },
    });
  }
});
afterAll(() => app.close());

async function talep(
  seri: string,
  model: string,
  alt: Record<string, unknown>,
  konum: { il: string; ilce?: string },
  headline?: string,
) {
  const phone = `+90532777${String(2000 + ++tel)}`;
  const v = { body: await uyeOl(app, phone) };
  const t = v.body.accessToken as string;
  const d = await call(app, 'POST', '/demands', { kategori: 'otomobil' }, t);
  await call(
    app,
    'PATCH',
    `/demands/${d.body.id}`,
    {
      data: {
        alanlar: { model: { make: 'bmw', series: `bmw/${seri}`, model: `bmw/${seri}/${model}` }, konum },
        alternatifler: [alt],
      },
      ...(headline ? { headline } : {}),
      contact: { phoneVisible: konum.il === 'İzmir', whatsappVisible: false, nameMode: 'tam' },
    },
    t,
  );
  const p = await call(app, 'POST', `/demands/${d.body.id}/publish`, {}, t);
  expect(p.status).toBe(200);
  await search.sync(d.body.id, true);
  return { id: d.body.id as string, no: p.body.no as number, token: t };
}

describe('talep araması (Karar 06.1, 06.3)', () => {
  it('filtreler, metin araması, sıralama ve filtre sayıları; yayından kalkan talep listeden çıkar', async () => {
    const a = await talep(
      '3-serisi',
      '320i',
      {
        butce: { min: 1_750_000, max: 2_050_000 },
        yil: { min: 2019, max: 2023 },
        km: 60_000,
        kasa: ['G20:0', 'G20:1'],
        paket: ['bmw/3-serisi/paket/m-sport'],
        yakit: ['benzin'],
      },
      { il: 'İstanbul', ilce: 'Kadıköy' },
      'Aile için 320i arıyorum',
    );
    const b = await talep(
      '5-serisi',
      '520i',
      { butce: { min: 2_300_000, max: 2_800_000 }, yil: { min: 2017, max: 2020 }, kasa: ['G30:1'] },
      { il: 'İzmir' },
    );
    await talep(
      '3-serisi',
      '320i',
      { butce: { max: 1_300_000 }, yil: { min: 2012, max: 2015 }, kasa: ['F30:0'] },
      { il: 'Ankara' },
    );

    const tum = await call(app, 'GET', '/talepler?kategori=otomobil&marka=bmw');
    expect(tum.status).toBe(200);
    expect(tum.body.toplam).toBe(3);
    expect(tum.body.sonuclar[0].no).toBeGreaterThan(tum.body.sonuclar[2].no); // en yeni üstte
    expect(tum.body.filtreler.seri).toEqual(
      expect.arrayContaining([
        { key: 'bmw/3-serisi', ad: '3 Serisi', n: 2 },
        { key: 'bmw/5-serisi', ad: '5 Serisi', n: 1 },
      ]),
    );
    const ilk = tum.body.sonuclar.find((x: { no: number }) => x.no === a.no);
    expect(ilk).toMatchObject({
      baslik: 'Aile için 320i arıyorum',
      arac: 'BMW 3 Serisi 320i · G20 makyajsız veya G20 makyajlı · M Sport',
      kmMax: 60_000,
      il: 'İstanbul',
      ilce: 'Kadıköy',
      kategori: { slug: 'otomobil', name: 'Otomobil' },
    });

    // Çoklu seçim: seri seçilince seri sayıları değişmez, sonuçlar daralır
    const seri = await call(app, 'GET', '/talepler?marka=bmw&seri=bmw/3-serisi');
    expect(seri.body.toplam).toBe(2);
    expect(seri.body.filtreler.seri.find((x: { key: string }) => x.key === 'bmw/5-serisi')?.n).toBe(1);
    expect((await call(app, 'GET', '/talepler?makyaj=makyajli')).body.toplam).toBe(2);
    expect((await call(app, 'GET', '/talepler?paket=M%20Sport')).body.toplam).toBe(1);
    // Aralık örtüşmesi: 2018–2019 arayan 2019–2023 ve 2017–2020 taleplerini bulur
    expect((await call(app, 'GET', '/talepler?yilMin=2018&yilMax=2019')).body.toplam).toBe(2);
    expect((await call(app, 'GET', '/talepler?butceMin=2500000')).body.toplam).toBe(1);
    expect((await call(app, 'GET', '/talepler?il=Ankara')).body.toplam).toBe(1);
    expect((await call(app, 'GET', '/talepler?telefon=1')).body.toplam).toBe(1);
    expect(
      (await call(app, 'GET', '/talepler?q=520i')).body.sonuclar.map((x: { no: number }) => x.no),
    ).toEqual([b.no]);
    expect((await call(app, 'GET', `/talepler?q=${a.no}`)).body.sonuclar[0].no).toBe(a.no);
    const pahali = await call(app, 'GET', '/talepler?sira=butce_azalan');
    expect(pahali.body.sonuclar[0].no).toBe(b.no);
    expect((await call(app, 'GET', '/talepler?sira=uydurma')).status).toBe(400);

    await call(app, 'POST', `/demands/${b.id}/passivate`, {}, b.token);
    await search.sync(b.id, true);
    expect((await call(app, 'GET', '/talepler?marka=bmw')).body.toplam).toBe(2);

    // Gece eşitlemesi: indeks veritabanıyla aynı
    expect(await search.reindexAll()).toBe(2);
    expect((await call(app, 'GET', '/talepler')).body.toplam).toBe(2);

    // Ana sayfa vitrini (Karar 46): yayındaki talepler, karışık sırada; fotoğraf alanı her kartta
    const vitrin = await call(app, 'GET', '/talepler/vitrin?boyut=5');
    expect(vitrin.status).toBe(200);
    expect(vitrin.body.toplam).toBe(2);
    expect(vitrin.body.sonuclar).toHaveLength(2);
    expect(vitrin.body.sonuclar[0]).toHaveProperty('foto');
  });
});

describe('favoriler ve kayıtlı aramalar (Karar 06.4, 30)', () => {
  it('favoriye ekle, durum, kendi talebi eklenemez; kayıtlı arama sayıları ve 10 sınırı', async () => {
    const sahip = await talep(
      '3-serisi',
      '320i',
      { butce: { max: 1_900_000 }, yil: { min: 2018 } },
      { il: 'Bursa' },
    );
    const phone = '+905327779999';
    const v = { body: await uyeOl(app, phone) };
    const t = v.body.accessToken as string;

    expect((await call(app, 'PUT', `/favorites/${sahip.no}`, undefined, sahip.token)).status).toBe(400);
    expect((await call(app, 'PUT', `/favorites/${sahip.no}`, undefined, t)).status).toBe(204);
    expect((await call(app, 'PUT', `/favorites/${sahip.no}`, undefined, t)).status).toBe(204);
    const fav = await call(app, 'GET', '/favorites', undefined, t);
    expect(fav.body).toHaveLength(1);
    expect(fav.body[0]).toMatchObject({ no: sahip.no, durum: 'yayinda', yazilabilir: true, il: 'Bursa' });
    expect((await call(app, 'GET', `/talepler/${sahip.no}`, undefined, t)).body.owner.favori).toBe(true);
    await call(app, 'POST', `/demands/${sahip.id}/passivate`, {}, sahip.token);
    expect((await call(app, 'GET', '/favorites', undefined, t)).body[0].durum).toBe('pasif');
    expect((await call(app, 'DELETE', `/favorites/${sahip.no}`, undefined, t)).status).toBe(204);
    expect((await call(app, 'GET', '/favorites', undefined, t)).body).toHaveLength(0);

    const k = await call(
      app,
      'POST',
      '/saved-searches',
      { ad: 'Benim 320i', sorgu: { marka: 'bmw', seri: ['bmw/3-serisi'], il: 'İstanbul', sayfa: 3 } },
      t,
    );
    expect(k.status).toBe(201);
    let liste = await call(app, 'GET', '/saved-searches', undefined, t);
    expect(liste.body[0]).toMatchObject({ ad: 'Benim 320i', bildirim: 'anlik', toplam: 1, yeni: 0 });
    expect(liste.body[0].sorgu.sayfa).toBeUndefined();
    expect(liste.body[0].kriterler).toEqual(['BMW', '3 Serisi', 'İstanbul']);
    // Yeni bir uygun talep yayınlanınca "1 yeni"
    await talep('3-serisi', '320i', { butce: { max: 2_000_000 }, yil: { min: 2020 } }, { il: 'İstanbul' });
    liste = await call(app, 'GET', '/saved-searches', undefined, t);
    expect(liste.body[0]).toMatchObject({ toplam: 2, yeni: 1 });
    await call(app, 'PATCH', `/saved-searches/${k.body.id}`, { gordum: true, bildirim: 'gunluk' }, t);
    liste = await call(app, 'GET', '/saved-searches', undefined, t);
    expect(liste.body[0]).toMatchObject({ yeni: 0, bildirim: 'gunluk' });

    for (let i = 0; i < 9; i++)
      await call(app, 'POST', '/saved-searches', { ad: `Arama ${i}`, sorgu: {} }, t);
    expect((await call(app, 'POST', '/saved-searches', { ad: 'Fazla', sorgu: {} }, t)).status).toBe(409);
    expect((await call(app, 'DELETE', `/saved-searches/${k.body.id}`, undefined, t)).status).toBe(204);
  });
});

describe('talep görseli (sahip isteği, 17 Kasım 2026; Karar 34)', () => {
  it('görselsiz talep konsolda bekler; elle yüklenen model fotoğrafı talepte görünür, değiştirilir ve kaldırılır', async () => {
    const owner = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
    const t = await talep(
      '5-serisi',
      '520i',
      { butce: { max: 3_000_000 }, yil: { min: 2018, max: 2021 } },
      { il: 'Bursa' },
    );
    const seri = await db.catalogSeries.findUniqueOrThrow({ where: { key: 'bmw/5-serisi' } });

    // Katalogda fotoğraf yok: kartta foto boş (arayüz kapak gösterir), konsolda model geneli yerinde bekler
    expect((await call(app, 'GET', `/talepler?q=${t.no}`)).body.sonuclar[0].foto).toBeNull();
    let bekleyen = (await staffCall(app, 'GET', '/staff/catalog/images/bekleyen-talepler', undefined, owner))
      .body;
    const yer = bekleyen.hedefler.find((h: { seriesId: string }) => h.seriesId === seri.id);
    expect(yer).toMatchObject({
      hedef: { tur: 'seri', id: seri.id },
      baslik: 'BMW 5 Serisi · model geneli',
      oneri: 'BMW 5 Serisi',
    });
    expect(yer.talepler.map((x: { no: number }) => x.no)).toContain(t.no);

    const jpeg = async (w: number, h: number, renk = '#5B8CFF') =>
      sharp({ create: { width: w, height: h, channels: 3, background: renk } })
        .jpeg()
        .toBuffer();
    const yukle = async (q: Record<string, string>, govde: Buffer, token = owner) => {
      const r = await app.inject({
        method: 'POST',
        url: `/staff/catalog/images/yukle?${new URLSearchParams(q)}`,
        payload: govde,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'image/jpeg' },
      });
      return { status: r.statusCode, body: JSON.parse(r.body) };
    };
    const bilgi = {
      tur: 'seri',
      id: seri.id,
      kaynak: 'https://commons.wikimedia.org/wiki/File:BMW_G30.jpg',
      yazar: 'Ali Veli',
      lisans: 'CC BY 4.0',
    };
    // Lisans listeden (NC/ND yok), kaynak zorunlu, küçük fotoğraf alınmaz, yetki gerekir
    expect((await yukle({ ...bilgi, lisans: 'CC BY-NC 4.0' }, await jpeg(1200, 800))).status).toBe(400);
    expect((await yukle({ ...bilgi, kaynak: 'yok' }, await jpeg(1200, 800))).status).toBe(400);
    expect((await yukle(bilgi, await jpeg(400, 300))).status).toBe(400);
    const destek = (await loginAs(app, await createStaff(db, 'SUPPORT'))).token;
    expect((await yukle(bilgi, await jpeg(1200, 800), destek)).status).toBe(403);

    const ilk = await yukle(bilgi, await jpeg(1200, 800));
    expect(ilk.status).toBe(200);
    expect(ilk.body).toMatchObject({ status: 'secildi', origin: 'yukleme', seriesId: seri.id, width: 1200 });
    // Değişiklik aynı işlemde outbox'a yazılır (işçi serinin taleplerini dizinde yeniler)
    expect(
      await db.outboxEvent.count({
        where: { type: 'katalog.fotograf_degisti', payload: { equals: { seriesId: seri.id } } },
      }),
    ).toBeGreaterThan(0);
    await search.sync(t.id, true);
    expect((await call(app, 'GET', `/talepler?q=${t.no}`)).body.sonuclar[0].foto).toBe(
      `/catalog/images/${ilk.body.id}`,
    );
    const sayfa = await call(app, 'GET', `/talepler/${t.no}`);
    expect(sayfa.body.gorunum.alternatifler[0].foto).toMatchObject({
      kaynak: 'yukleme',
      genel: true,
      nesil: null,
      caption: 'Fotoğraf: Ali Veli · CC BY 4.0 · temsilî görsel',
    });
    expect((await app.inject({ method: 'GET', url: `/catalog/images/${ilk.body.id}` })).statusCode).toBe(200);
    bekleyen = (await staffCall(app, 'GET', '/staff/catalog/images/bekleyen-talepler', undefined, owner))
      .body;
    expect(bekleyen.hedefler.some((h: { seriesId: string }) => h.seriesId === seri.id)).toBe(false);

    // Aynı yere yeni yükleme eskisini kaldırır (kayıt silinmez)
    const ikinci = await yukle(bilgi, await jpeg(1600, 900, '#F05A9B'));
    expect(ikinci.body.status).toBe('secildi');
    expect((await db.catalogImage.findUniqueOrThrow({ where: { id: ilk.body.id } })).status).toBe(
      'kaldirildi',
    );
    const yerler = (await staffCall(app, 'GET', `/staff/catalog/images/seri/${seri.id}`, undefined, owner))
      .body;
    expect(yerler[0]).toMatchObject({ hedef: { tur: 'seri' } });
    expect(yerler[0].adaylar.map((i: { id: string }) => i.id)).toEqual([ikinci.body.id]);
    expect(
      (await staffCall(app, 'GET', '/staff/catalog/images/seriler?q=bmw 5', undefined, owner)).body[0],
    ).toMatchObject({ id: seri.id, ad: 'BMW 5 Serisi' });

    // Kaldırılınca talep yeniden kapakla görünür ve konsolda bekler
    expect(
      (await staffCall(app, 'POST', `/staff/catalog/images/${ikinci.body.id}/remove`, {}, owner)).status,
    ).toBe(200);
    expect((await call(app, 'GET', `/talepler/${t.no}`)).body.gorunum.alternatifler[0].foto).toBeNull();
    bekleyen = (await staffCall(app, 'GET', '/staff/catalog/images/bekleyen-talepler', undefined, owner))
      .body;
    expect(bekleyen.hedefler.some((h: { seriesId: string }) => h.seriesId === seri.id)).toBe(true);
  });
});
