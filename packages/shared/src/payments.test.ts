import { describe, expect, it } from 'vitest';
import { BIREYSEL_FIYATLAR, ONE_CIKARMA } from './demand.js';
import { orderCreateSchema, PRODUCTS, productByKey, tlYaz, vatOfGross } from './payments.js';

const fatura = { ad: 'Ayşe Yılmaz', eposta: 'ayse@ornek.com', il: 'İstanbul', ilce: 'Kadıköy' };

describe('ödeme kuralları (Karar 12.8, 38, 39)', () => {
  it('fiyatlar talep ekranındaki fiyatlarla aynı; mobil fiyat ,99 ile biter', () => {
    expect(productByKey('ek_talep')?.tl).toBe(BIREYSEL_FIYATLAR.ekTalep.tl);
    expect(productByKey('talep_paketi')?.mobil).toBe(BIREYSEL_FIYATLAR.talepPaketi.mobil);
    expect(productByKey('uzatma')?.tl).toBe(BIREYSEL_FIYATLAR.uzatma.tl);
    for (const o of ONE_CIKARMA) {
      const p = PRODUCTS.find((x) => x.oneCikarma?.tur === o.key && x.oneCikarma.gun === 7);
      expect(p?.tl).toBe(o.tl);
      expect(p?.mobil).toBe(o.mobil);
    }
    for (const p of PRODUCTS) expect(String(p.mobil)).toMatch(/\.99$/);
  });

  it('KDV dahil tutardan KDV; tutar yazımı', () => {
    expect(vatOfGross(19900)).toBe(3317);
    expect(vatOfGross(12000)).toBe(2000);
    expect(tlYaz(19900)).toBe('199 TL');
    expect(tlYaz(123450)).toBe('1.234,50 TL');
  });

  it('sözleşme onayı her zaman; hemen başlayan hizmette ikinci onay; öne çıkarmada talep', () => {
    const ok = orderCreateSchema.safeParse({
      kalemler: [{ urun: 'mesaj_10' }],
      fatura,
      onay: { sozlesme: true },
    });
    expect(ok.success).toBe(true);
    expect(
      orderCreateSchema.safeParse({ kalemler: [{ urun: 'mesaj_10' }], fatura, onay: { sozlesme: false } })
        .success,
    ).toBe(false);
    const ust = orderCreateSchema.safeParse({
      kalemler: [{ urun: 'ust_sira_7', talepNo: 1000001 }],
      fatura,
      onay: { sozlesme: true },
    });
    expect(ust.success).toBe(false);
    expect(
      orderCreateSchema.safeParse({
        kalemler: [{ urun: 'ust_sira_7' }],
        fatura,
        onay: { sozlesme: true, cayma: true },
      }).success,
    ).toBe(false);
    expect(
      orderCreateSchema.safeParse({
        kalemler: [{ urun: 'ust_sira_7', talepNo: 1000001 }],
        fatura,
        onay: { sozlesme: true, cayma: true },
      }).success,
    ).toBe(true);
    expect(
      orderCreateSchema.safeParse({
        kalemler: [{ urun: 'mesaj_10' }],
        fatura: { ...fatura, kurumsal: { unvan: 'Örnek Ltd.', vergiNo: '123', vergiDairesi: 'Kadıköy' } },
        onay: { sozlesme: true },
      }).success,
    ).toBe(false);
  });
});
