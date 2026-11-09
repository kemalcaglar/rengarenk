import { describe, expect, it } from 'vitest';
import { badgeRulesOf, DEFAULT_PRICE_BOOK, priceBookSchema } from './pricing.js';
import {
  badgeDescriptions,
  badgeProgress,
  badgesOf,
  median,
  type SellerFigures,
  sellerScore,
} from './ratings.js';

const galeri = (f: Partial<SellerFigures> = {}): SellerFigures => ({
  yildizSayisi: 12,
  yildizOrtalama: 4.7,
  yanitSohbet: 14,
  ortancaDakika: 18,
  sikayetOrani: 0,
  onayliGaleri: true,
  ...f,
});

describe('satıcı puanı ve rozetler (Karar 55)', () => {
  it('üç rozet eşikleriyle', () => {
    expect(badgesOf(galeri())).toEqual(['onay', 'hizli', 'guven']);
    expect(badgesOf(galeri({ yanitSohbet: 9 }))).toEqual(['onay', 'guven']);
    expect(badgesOf(galeri({ ortancaDakika: 60 }))).toEqual(['onay', 'guven']);
    expect(badgesOf(galeri({ yildizSayisi: 9 }))).toEqual(['onay', 'hizli']);
    expect(badgesOf(galeri({ yildizOrtalama: 4.4 }))).toEqual(['onay', 'hizli']);
    expect(badgesOf(galeri({ sikayetOrani: 0.01 }))).toEqual(['onay', 'hizli']);
    // Bireysel satıcı güvenilir satıcı olamaz, hızlı yanıt alabilir
    expect(badgesOf(galeri({ onayliGaleri: false }))).toEqual(['hizli']);
  });

  it('iç puan 0–100; rozete ne kadar kaldığı', () => {
    expect(sellerScore(galeri({ yildizOrtalama: 5, ortancaDakika: 10 }))).toBe(100);
    expect(
      sellerScore(
        galeri({ yildizOrtalama: 1, ortancaDakika: 1440, sikayetOrani: 0.05, onayliGaleri: false }),
      ),
    ).toBe(5);
    const p = badgeProgress(galeri({ yildizSayisi: 4, yanitSohbet: 3, ortancaDakika: 90 }));
    expect(p.find((x) => x.rozet === 'guven')?.eksik).toEqual(['6 yıldız daha']);
    expect(p.find((x) => x.rozet === 'hizli')?.eksik).toEqual([
      'son 30 günde 7 sohbet daha',
      'ortanca ilk yanıtın 1 saatin altına inmeli',
    ]);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('eşikler Kurallar ve fiyatlar listesinden (Karar 56)', () => {
    const kitap = {
      ...DEFAULT_PRICE_BOOK,
      rozetler: {
        hizliDakika: 30,
        hizliSohbet: 5,
        guvenYildiz: 20,
        guvenOrtalama: 4.8,
        guvenSikayetYuzde: 0.5,
      },
    };
    expect(priceBookSchema.safeParse(kitap).success).toBe(true);
    expect(
      priceBookSchema.safeParse({ ...kitap, rozetler: { ...kitap.rozetler, guvenOrtalama: 6 } }).success,
    ).toBe(false);
    const r = badgeRulesOf(kitap);
    expect(badgesOf(galeri({ ortancaDakika: 40, yanitSohbet: 6 }), r)).toEqual(['onay']);
    expect(
      badgesOf(galeri({ ortancaDakika: 20, yanitSohbet: 6, yildizSayisi: 20, yildizOrtalama: 4.9 }), r),
    ).toEqual(['onay', 'hizli', 'guven']);
    expect(badgeProgress(galeri({ ortancaDakika: 40 }), r).find((x) => x.rozet === 'hizli')?.eksik).toEqual([
      'ortanca ilk yanıtın 30 dakikanın altına inmeli',
    ]);
    expect(badgeDescriptions(r).hizli).toBe('Son 30 günde ortanca ilk yanıt 30 dakikanın altında');
    // Eski listede rozet yok: başlangıç değerleri
    const { rozetler: _r, ...eski } = DEFAULT_PRICE_BOOK;
    expect(badgeRulesOf(eski).hizli.ortancaDakika).toBe(60);
  });
});
