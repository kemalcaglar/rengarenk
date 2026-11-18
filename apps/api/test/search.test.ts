import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from '@rengarenk/db';
import { teknikMetniOku } from '@rengarenk/shared';
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
      // Kapakta yazan bilgiler (sahip isteği, 17 Kasım 2026)
      kapakBilgi: ['2019–2023', 'G20 makyajsız', 'G20 makyajlı', 'M Sport'],
      modelAd: '320i',
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
    // Konsol menüsündeki "Araç görselleri" rozeti
    const once = (await staffCall(app, 'GET', '/staff/me', undefined, owner)).body.pendingImages;
    expect(once).toBeGreaterThan(0);

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
    expect((await staffCall(app, 'GET', '/staff/me', undefined, owner)).body.pendingImages).toBe(once - 1);
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

describe('teknik özellik bildirimi ve elle düzeltme (sahip isteği, 17 Kasım 2026)', () => {
  it('kullanıcı yanlış bildirir, konsola düşer; düzeltme talep sayfasında kaynağın yerine geçer, kaldırılınca geri döner', async () => {
    const owner = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
    const model = await db.catalogModel.findUniqueOrThrow({ where: { key: 'bmw/3-serisi/320i' } });
    // Türkiye'de satılan bir 320i tipi (TSB), teknik kaynağı yok
    await db.catalogVariant.create({
      data: {
        id: uuidv7(),
        source: 'tsb',
        sourceKey: 'test-320i',
        makeId: model.makeId,
        seriesId: model.seriesId,
        modelId: model.id,
        categories: ['otomobil'],
        years: [2020, 2021, 2022],
        rawName: '320I',
        confidence: 'yuksek',
        firstVersion: 't',
        lastVersion: 't',
      },
    });
    const t = await talep(
      '3-serisi',
      '320i',
      { butce: { max: 2_000_000 }, yil: { min: 2020, max: 2022 } },
      { il: 'Bursa' },
    );
    const motorlar = async () =>
      (await call(app, 'GET', `/talepler/${t.no}`)).body.gorunum.alternatifler[0].motorlar;
    // Kaynakta bilgi yok: sürüm gösterilmez
    expect(await motorlar()).toEqual([]);

    const okuyan = (await uyeOl(app, '+905327779001')).accessToken as string;
    const bildir = (b: object) => call(app, 'POST', '/demands/teknik-bildir', b, okuyan);
    expect((await bildir({ no: t.no, motor: 'bmw/5-serisi/520i', not: 'Güç yanlış yazıyor' })).status).toBe(
      400,
    );
    expect((await bildir({ no: t.no, motor: model.key, alan: 'uydurma', not: 'Güç yanlış' })).status).toBe(
      400,
    );
    const r = await bildir({ no: t.no, motor: model.key, alan: 'hp', not: 'Güç 184 hp olmalı' });
    expect(r.status).toBe(201);
    expect((await bildir({ no: t.no, motor: model.key, not: 'Yine yanlış' })).status).toBe(409);
    expect(await db.outboxEvent.count({ where: { type: 'katalog.teknik_bildirildi' } })).toBe(1);

    const kuyruk = (await staffCall(app, 'GET', '/staff/catalog/teknik/bildirimler', undefined, owner)).body;
    expect(kuyruk[0]).toMatchObject({
      talep: t.no,
      motor: '320i',
      alan: 'hp',
      alanAd: 'Güç',
      not: 'Güç 184 hp olmalı',
      modelId: model.id,
    });
    expect((await staffCall(app, 'GET', '/staff/me', undefined, owner)).body.openSpecReports).toBe(1);

    // Elle düzeltme: alan tanımına göre denetlenir; bildirimle birlikte kapanır
    const ekle = (b: object) => staffCall(app, 'POST', `/staff/catalog/teknik/model/${model.id}`, b, owner);
    expect((await ekle({ degerler: { hp: [190, 180] } })).status).toBe(400);
    expect((await ekle({ degerler: { cekisler: ['ucan'] } })).status).toBe(400);
    expect((await ekle({ degerler: { vitesler: ['8 ileri'] } })).status).toBe(400);
    const d = await ekle({
      yilBas: 2019,
      yilSon: 2022,
      degerler: { hp: [184, 184], vitesler: ['otomatik:8'], cekisler: ['arkadan'] },
      bildirim: r.body.id,
    });
    expect(d.status).toBe(200);
    expect((await db.catalogSpecReport.findUniqueOrThrow({ where: { id: r.body.id } })).status).toBe(
      'duzeltildi',
    );
    expect(await motorlar()).toEqual([
      {
        ad: '320i',
        model: model.key,
        ozet: expect.objectContaining({
          hp: [184, 184],
          vitesler: ['otomatik:8'],
          cekisler: ['arkadan'],
          kaynaklar: ['manuel'],
        }),
      },
    ]);
    // Başka yılların düzeltmesi uygulanmaz
    await ekle({ yilBas: 2010, yilSon: 2012, degerler: { hp: [150, 150] } });
    expect((await motorlar())[0].ozet.hp).toEqual([184, 184]);
    const m = (
      await staffCall(
        app,
        'GET',
        `/staff/catalog/teknik/model/${model.id}?yilBas=2020&yilSon=2022`,
        undefined,
        owner,
      )
    ).body;
    expect(m).toMatchObject({ ad: '320i', kaynak: null, sonuc: { hp: [184, 184] } });
    expect(m.duzeltmeler).toHaveLength(2);
    expect(
      (await staffCall(app, 'GET', `/staff/catalog/teknik/seri/${model.seriesId}`, undefined, owner)).body,
    ).toEqual([expect.objectContaining({ id: model.id, ad: '320i', yillar: [2020, 2022], duzeltme: 2 })]);

    // Kaldırılınca düzeltme düşer (kayıt silinmez)
    expect(
      (await staffCall(app, 'POST', `/staff/catalog/teknik/duzeltme/${d.body.id}/kaldir`, {}, owner)).status,
    ).toBe(200);
    expect(await motorlar()).toEqual([]);
    expect((await db.catalogSpecOverride.findUniqueOrThrow({ where: { id: d.body.id } })).status).toBe(
      'kaldirildi',
    );
    await expect(db.catalogSpecOverride.delete({ where: { id: d.body.id } })).rejects.toThrow();
  });
});

describe('teknik sekmesi talepteki vitese uyar (sahip bildirimi, 18 Kasım 2026)', () => {
  it('otomatik seçilen talepte manuel tipin değerleri gösterilmez; vites TSB adından gelir', async () => {
    await db.catalogSource.upsert({
      where: { key: 'vmm' },
      create: { key: 'vmm', name: 'vehicle-makes-models', license: 'ODbL', active: true },
      update: { active: true },
    });
    const model = await db.catalogModel.findUniqueOrThrow({ where: { key: 'bmw/3-serisi/320i' } });
    const tip = (anahtar: string, gearbox: string) =>
      db.catalogVariant.create({
        data: {
          id: uuidv7(),
          source: 'tsb',
          sourceKey: anahtar,
          makeId: model.makeId,
          seriesId: model.seriesId,
          modelId: model.id,
          categories: ['otomobil'],
          years: [2024],
          fuel: 'benzin',
          gearbox,
          powerHp: 170,
          rawName: anahtar,
          confidence: 'yuksek',
          firstVersion: 't',
          lastVersion: 't',
        },
      });
    // Manuel tipin motor kaydı var, otomatik tipin yok (Clio 1.0 TCe ve X-TRONIC gibi)
    const manuel = await tip('test-320i-manuel', 'manuel');
    await tip('test-320i-otomatik', 'otomatik');
    await db.$executeRaw`INSERT INTO catalog_variant_specs (variant_id, source, summary, signature, updated_at)
      VALUES (${manuel.id}::uuid, 'vmm', ${JSON.stringify({ vitesler: ['manuel:6'], hp: [170, 170], surum: 1 })}::jsonb, 't', now())`;
    const motorlar = async (alt: Record<string, unknown>) => {
      const t = await talep(
        '3-serisi',
        '320i',
        { butce: { max: 2_000_000 }, yil: { min: 2024, max: 2024 }, ...alt },
        { il: 'Bursa' },
      );
      return (await call(app, 'GET', `/talepler/${t.no}`)).body.gorunum.alternatifler[0].motorlar;
    };
    expect((await motorlar({ vites: ['otomatik'] }))[0].ozet).toMatchObject({
      vitesler: ['otomatik:'],
      hp: [170, 170],
      kaynaklar: ['tsb'],
    });
    expect((await motorlar({ vites: ['manuel'] }))[0].ozet).toMatchObject({
      vitesler: ['manuel:6'],
      kaynaklar: ['vmm'],
    });
    // Vites seçilmediyse motorun iki vitesi ayrı sekmede
    expect(
      (await motorlar({})).map((m: { ad: string; ozet: { vitesler: string[] } }) => [m.ad, m.ozet.vitesler]),
    ).toEqual([
      ['320i · Manuel', ['manuel:6']],
      ['320i · Otomatik', ['otomatik:']],
    ]);
  });
});

describe('teknik özellik ve donanım girişi (sahip isteği, 18 Kasım 2026)', () => {
  it('eksik araç listelenir; metinden okunan değerler ve pakete özel donanım talep sayfasında görünür', async () => {
    const owner = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
    const model = await db.catalogModel.findUniqueOrThrow({ where: { key: 'bmw/5-serisi/520i' } });
    const paket = await db.catalogTrim.findUniqueOrThrow({ where: { key: 'bmw/5-serisi/paket/m-sport' } });
    const baska = await db.catalogTrim.findUniqueOrThrow({ where: { key: 'bmw/3-serisi/paket/m-sport' } });
    await db.catalogVariant.create({
      data: {
        id: uuidv7(),
        source: 'tsb',
        sourceKey: 'test-520i-msport',
        makeId: model.makeId,
        seriesId: model.seriesId,
        modelId: model.id,
        trimId: paket.id,
        categories: ['otomobil'],
        years: [2023],
        fuel: 'benzin',
        gearbox: 'otomatik',
        powerHp: 170,
        rawName: '520I M SPORT',
        confidence: 'yuksek',
        firstVersion: 't',
        lastVersion: 't',
      },
    });
    const yil = { butce: { max: 3_000_000 }, yil: { min: 2023, max: 2023 } };
    const pakette = await talep('5-serisi', '520i', { ...yil, paket: [paket.key] }, { il: 'Bursa' });
    const paketsiz = await talep('5-serisi', '520i', yil, { il: 'Bursa' });
    const motor = async (no: number) =>
      (await call(app, 'GET', `/talepler/${no}`)).body.gorunum.alternatifler[0].motorlar[0];
    const eksikler = async () =>
      (await staffCall(app, 'GET', '/staff/catalog/teknik/eksikler', undefined, owner)).body as {
        modelId: string;
        talepSayisi: number;
        eksik: string[];
        donanimVar: boolean;
      }[];

    const once = (await eksikler()).find((x) => x.modelId === model.id);
    expect(once?.donanimVar).toBe(false);
    expect(once?.talepSayisi).toBeGreaterThanOrEqual(2);
    expect(once?.eksik).toContain('Tork');

    const r = teknikMetniOku(`--Motor ve Performans--
Maksimum Güç\t170 hp (125 kw) / 5.000 rpm
Maksimum Tork\t250 Nm / 1.500 rpm
Hızlanma 0-100 km/saat\t8.1 sn
Azami Sürat\t225 km/saat
Yakıt Tüketimi (Şehir içi / Şehir dışı)\t7.9 lt / 5.4 lt
Yakıt Depo Hacmi\t68 lt
Uzunluk\t5060 mm
Net Ağırlık\t1695 kg
Bagaj Kapasitesi\t520 lt
--Donanım--
-Güvenlik-
ABS\t
Isofix\t`);
    const ekle = (b: object) => staffCall(app, 'POST', `/staff/catalog/teknik/model/${model.id}`, b, owner);
    expect((await ekle({ paket: baska.id, degerler: r.degerler })).status).toBe(400);
    expect((await ekle({ degerler: {}, donanim: [] })).status).toBe(400);
    expect((await ekle({ paket: paket.id, degerler: r.degerler, donanim: r.donanim })).status).toBe(200);

    // Pakete özel kayıt yalnızca o paketi seçen talepte
    const m = await motor(pakette.no);
    expect(m.ozet).toMatchObject({ hp: [170, 170], tork: [250, 250], torkDevir: [1500, 1500] });
    expect(m.donanim).toEqual([
      { paket: 'M Sport', gruplar: [{ ad: 'Güvenlik', ogeler: ['ABS', 'Isofix'] }] },
    ]);
    const p = await motor(paketsiz.no);
    expect(p.donanim).toBeUndefined();
    expect(p.ozet.tork).toBeUndefined();

    // Bütün paketler için donanım: paketsiz talepte de görünür, konsolda paketin listesi önce gelir
    await ekle({ donanim: [{ ad: 'Konfor', ogeler: ['Klima'] }], degerler: {} });
    expect((await motor(paketsiz.no)).donanim).toEqual([
      { paket: null, gruplar: [{ ad: 'Konfor', ogeler: ['Klima'] }] },
    ]);
    const k = (
      await staffCall(
        app,
        'GET',
        `/staff/catalog/teknik/model/${model.id}?paket=${paket.id}`,
        undefined,
        owner,
      )
    ).body;
    expect(k.paketler).toEqual([{ id: paket.id, ad: 'M Sport', yillar: [2023, 2023] }]);
    expect(k.donanim).toEqual([{ ad: 'Güvenlik', ogeler: ['ABS', 'Isofix'] }]);
    expect(k.sonuc.tork).toEqual([250, 250]);
    expect(k.duzeltmeler).toHaveLength(2);

    expect((await eksikler()).find((x) => x.modelId === model.id)).toBeUndefined();
  });
});

describe('teknik kayıt vitese bağlanır ve düzenlenir (sahip isteği, 18 Kasım 2026)', () => {
  it('otomatik kaydı manuel seçen görmez; düzenleme eskisinin yerine geçer; uygulanacak tipler listelenir', async () => {
    const owner = (await loginAs(app, await createStaff(db, 'OWNER'))).token;
    // Önceki testin 320i tipleri (2024, manuel ve otomatik)
    const model = await db.catalogModel.findUniqueOrThrow({ where: { key: 'bmw/3-serisi/320i' } });
    const ekle = (b: object) => staffCall(app, 'POST', `/staff/catalog/teknik/model/${model.id}`, b, owner);
    const yil = { butce: { max: 2_000_000 }, yil: { min: 2024, max: 2024 } };
    const motorlar = async (alt: Record<string, unknown>) => {
      const t = await talep('3-serisi', '320i', { ...yil, ...alt }, { il: 'Bursa' });
      return (await call(app, 'GET', `/talepler/${t.no}`)).body.gorunum.alternatifler[0].motorlar as {
        ad: string;
        ozet: { tork?: [number, number] };
        donanim?: unknown[];
      }[];
    };

    // Uygulanacak tipler ve vites seçenekleri
    const m = (
      await staffCall(
        app,
        'GET',
        `/staff/catalog/teknik/model/${model.id}?yilBas=2024&vites=otomatik`,
        undefined,
        owner,
      )
    ).body;
    expect(m.vitesler).toEqual(['manuel', 'otomatik']);
    expect(m.tipler).toEqual([
      { ad: 'test-320i-otomatik', paket: null, vites: 'otomatik', yillar: [2024, 2024] },
    ]);

    expect((await ekle({ vites: 'yari_otomatik', degerler: { tork: [300, 300] } })).status).toBe(400);
    const r = await ekle({
      yilBas: 2024,
      vites: 'otomatik',
      degerler: { tork: [300, 300] },
      donanim: [{ ad: 'Konfor', ogeler: ['Klima'] }],
    });
    expect(r.status).toBe(200);
    const oto = await motorlar({ vites: ['otomatik'] });
    expect(oto[0]).toMatchObject({ ad: '320i', ozet: { tork: [300, 300] } });
    expect(oto[0]?.donanim).toHaveLength(1);
    const man = await motorlar({ vites: ['manuel'] });
    expect(man[0]?.ozet.tork).toBeUndefined();
    expect(man[0]?.donanim).toBeUndefined();

    // Düzenle: yeni kayıt eskisinin yerine geçer, eski kaldırılır; kaldırılmış kayıt yeniden düzenlenemez
    const d = await ekle({
      yerine: r.body.id,
      yilBas: 2024,
      vites: 'otomatik',
      degerler: { tork: [320, 320] },
    });
    expect(d.status).toBe(200);
    expect(await db.catalogSpecOverride.findUniqueOrThrow({ where: { id: r.body.id } })).toMatchObject({
      status: 'kaldirildi',
      replacedBy: d.body.id,
    });
    expect((await motorlar({ vites: ['otomatik'] }))[0]?.ozet.tork).toEqual([320, 320]);
    expect((await ekle({ yerine: r.body.id, degerler: { tork: [1, 1] } })).status).toBe(409);

    // Araç seçimi: marka ve modeller
    const bmw = (await staffCall(app, 'GET', '/staff/catalog/teknik/markalar', undefined, owner)).body.find(
      (x: { ad: string }) => x.ad === 'BMW',
    );
    expect(bmw).toBeDefined();
    const seriler = (await staffCall(app, 'GET', `/staff/catalog/teknik/marka/${bmw.id}`, undefined, owner))
      .body;
    expect(seriler.map((x: { ad: string }) => x.ad)).toEqual(['3 Serisi', '5 Serisi']);
  });
});
