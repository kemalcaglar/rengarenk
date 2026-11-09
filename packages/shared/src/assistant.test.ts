import { describe, expect, it } from 'vitest';
import { parseDemandText } from './assistant.js';

describe('talep asistanı kuralları (Karar 42)', () => {
  it('örnek cümle: yıl, vites, yakıt, bütçe', () => {
    expect(parseDemandText('2019 sonrası otomatik, dizel, aile arabası, 1,5 milyon bütçe')).toEqual({
      yil: { min: 2019 },
      vites: ['otomatik'],
      yakit: ['dizel'],
      butce: { max: 1_500_000 },
    });
  });

  it('aralıklar, kilometre, konum, hasar, renk', () => {
    expect(
      parseDemandText(
        "BMW 320i, 2018-2021 arası, 100 bin km altı, 1-1,5 milyon, İstanbul Kadıköy'de, hasarsız, beyaz ya da siyah, takasa açığım",
      ),
    ).toEqual({
      km: 100_000,
      yil: { min: 2018, max: 2021 },
      butce: { min: 1_000_000, max: 1_500_000 },
      renk: ['beyaz', 'siyah'],
      hasar: 'yok',
      takas: true,
      konum: { il: 'İstanbul', ilce: 'Kadıköy' },
    });
  });

  it('noktalı tutar ve en çok; sayısal model adları bütçe sanılmaz', () => {
    expect(parseDemandText('Passat 1.5 TSI, en fazla 1.250.000 TL, benzinli, manuel, galeriden')).toEqual({
      butce: { max: 1_250_000 },
      yakit: ['benzin'],
      vites: ['manuel'],
      kimden: ['galeri'],
    });
    expect(parseDemandText('800 bin tl ye kadar 2015 model Clio, takas yok').butce).toEqual({ max: 800_000 });
    expect(parseDemandText('800 bin tl ye kadar 2015 model Clio, takas yok').yil).toEqual({
      min: 2015,
      max: 2015,
    });
    expect(parseDemandText('800 bin tl ye kadar 2015 model Clio, takas yok').takas).toBe(false);
  });
});

describe('yıl aralığı noktalama ile', () => {
  it('"2016-2018," virgülle biter', () => {
    expect(parseDemandText('Passat, 2016-2018, benzinli').yil).toEqual({ min: 2016, max: 2018 });
    expect(parseDemandText('bütçe 2.000.000 tl').yil).toBeUndefined();
  });
});
