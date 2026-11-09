import { describe, expect, it } from 'vitest';
import { couponCodeSchema, couponDiscount, couponSchema, couponStatus, couponTargetOf } from './coupons.js';

const taban = {
  kod: 'ust20',
  ad: 'Hafta sonu üst sıra',
  yuzde: 20,
  hedefler: ['ust_sira'],
  kitle: 'bireysel',
  baslangic: '2026-11-14T00:00:00+03:00',
  bitis: '2026-11-16T00:00:00+03:00',
};

describe('Kuponlar', () => {
  it('kod büyük harfe çevrilir ve doğrulanır', () => {
    expect(couponCodeSchema.parse(' ust20 ')).toBe('UST20');
    expect(couponCodeSchema.parse('galeri30')).toBe('GALERI30');
    expect(couponCodeSchema.safeParse('A-1').success).toBe(false);
    expect(couponSchema.parse(taban).kod).toBe('UST20');
    expect(couponSchema.safeParse({ ...taban, hedefler: ['abonelik'] }).success).toBe(false);
    expect(couponSchema.safeParse({ ...taban, bitis: taban.baslangic }).success).toBe(false);
  });

  it('indirim aşağı yuvarlanır; ürün grubu', () => {
    expect(couponDiscount(14999, 20)).toBe(2999);
    expect(couponTargetOf('ust_sira_30')).toBe('ust_sira');
    expect(couponTargetOf('abonelik')).toBe('abonelik');
    expect(couponTargetOf('yok')).toBeUndefined();
  });

  it('durum: onay, tarih ve kullanım sınırı', () => {
    const c = {
      status: 'onaylandi',
      startsAt: new Date('2026-11-14T00:00:00+03:00'),
      endsAt: new Date('2026-11-16T00:00:00+03:00'),
      maxUses: 2,
    };
    const ici = new Date('2026-11-15T12:00:00+03:00');
    expect(couponStatus(c, 'APPROVED', 0, ici)).toBe('aktif');
    expect(couponStatus(c, 'APPROVED', 2, ici)).toBe('tukendi');
    expect(couponStatus(c, 'APPROVED', 0, new Date('2026-11-13T12:00:00+03:00'))).toBe('zamanlandi');
    expect(couponStatus(c, 'APPROVED', 0, c.endsAt)).toBe('bitti');
    expect(couponStatus({ ...c, status: 'onay_bekliyor' }, 'PENDING', 0, ici)).toBe('onay_bekliyor');
    expect(couponStatus({ ...c, status: 'onay_bekliyor' }, 'REJECTED', 0, ici)).toBe('reddedildi');
    expect(couponStatus({ ...c, status: 'iptal' }, 'APPROVED', 0, ici)).toBe('iptal');
  });
});
