import { describe, expect, it } from 'vitest';
import { bannerDateText, bannerMatches, bannerSchema, bannerStatus } from './content.js';

const taban = {
  baslik: 'Galeriler için ilk ay %50 indirim',
  yer: 'anasayfa_ust',
  kitle: 'ziyaretci',
  platform: 'hepsi',
  renk: '#9B7BFF',
};

describe('Banner ve duyuru (Karar 46)', () => {
  it('formu doğrular', () => {
    expect(bannerSchema.safeParse(taban).success).toBe(true);
    const tarihli = {
      ...taban,
      baslangic: '2026-11-10T00:00:00+03:00',
      bitis: '2026-12-01T00:00:00+03:00',
    };
    expect(bannerSchema.safeParse(tarihli).success).toBe(true);
    for (const kotu of [
      { url: 'https://baska.site' },
      { url: '//baska.site' },
      { dugme: 'Başvur' },
      { baslangic: '2026-11-10T00:00:00+03:00' },
      { baslangic: '2026-11-10T00:00:00+03:00', bitis: '2027-03-01T00:00:00+03:00' },
      { il: 'İzmir' },
      { kitle: 'galeri', il: 'Atlantis' },
    ])
      expect(bannerSchema.safeParse({ ...taban, ...kotu }).success).toBe(false);
    expect(bannerSchema.safeParse({ ...taban, kitle: 'galeri', il: 'Antalya' }).success).toBe(true);
  });

  it('durum ve tarih yazısı', () => {
    const bas = new Date('2026-11-09T21:00:00Z'); // 10 Kasım 00.00 TSİ
    const bit = new Date('2026-11-30T21:00:00Z'); // 1 Aralık 00.00 TSİ (dahil değil)
    const b = { published: true, stoppedAt: null, startsAt: bas, endsAt: bit };
    expect(bannerStatus(b, new Date('2026-11-09T12:00:00Z'))).toBe('zamanlandi');
    expect(bannerStatus(b, new Date('2026-11-15T12:00:00Z'))).toBe('yayinda');
    expect(bannerStatus(b, bit)).toBe('bitti');
    expect(bannerStatus({ ...b, published: false })).toBe('taslak');
    expect(bannerStatus({ ...b, stoppedAt: new Date() })).toBe('durduruldu');
    expect(bannerDateText(bas, bit)).toBe('10 – 30 Kas 2026');
    expect(bannerDateText(new Date('2026-10-27T21:00:00Z'), new Date('2026-11-03T21:00:00Z'))).toBe(
      '28 Eki – 3 Kas 2026',
    );
    expect(bannerDateText(null, null)).toBe('Tarih seçilmedi');
  });

  it('kitle, il ve platform eşleşmesi', () => {
    const galeriAntalya = { audience: 'galeri', il: 'Antalya', platform: 'web' };
    expect(bannerMatches(galeriAntalya, { kitle: 'galeri', il: 'Antalya', platform: 'web' })).toBe(true);
    expect(bannerMatches(galeriAntalya, { kitle: 'galeri', il: 'İzmir', platform: 'web' })).toBe(false);
    expect(bannerMatches(galeriAntalya, { kitle: 'galeri', il: 'Antalya', platform: 'mobil' })).toBe(false);
    expect(bannerMatches(galeriAntalya, { kitle: 'bireysel', il: 'Antalya', platform: 'web' })).toBe(false);
    const herkes = { audience: 'herkes', il: null, platform: 'hepsi' };
    expect(bannerMatches(herkes, { kitle: 'ziyaretci', il: null, platform: 'mobil' })).toBe(true);
  });
});
