import { describe, expect, it } from 'vitest';
import { compactBudget, searchQueryKey } from './demand';

describe('searchQueryKey (Karar 30)', () => {
  it('sayfa, sıra ve boş değerleri yok sayar; çoklu değerlerin sırası önemsiz', () => {
    const a = searchQueryKey({ marka: 'bmw', seri: ['bmw/5', 'bmw/3'], sira: 'yeni', sayfa: '2', il: '' });
    const b = searchQueryKey({ seri: 'bmw/3,bmw/5', marka: 'bmw' });
    expect(a).toBe(b);
  });

  it('kayıtlı sorgudaki sayı ve true değerleri adresteki metinle eşleşir', () => {
    expect(searchQueryKey({ yilMin: 2019, telefon: true })).toBe(
      searchQueryKey({ yilMin: '2019', telefon: '1' }),
    );
    expect(searchQueryKey({ marka: 'bmw' })).not.toBe(searchQueryKey({ marka: 'audi' }));
  });
});

describe('compactBudget (vitrin kartı)', () => {
  it('fiyatı kısaltmadan tam yazar (sahip isteği)', () => {
    expect(compactBudget(null, 1_000_200)).toBe('En çok 1.000.200 TL');
    expect(compactBudget(1_000_200, 1_000_200)).toBe('1.000.200 TL');
    expect(compactBudget(850_000, 1_000_000)).toBe('850.000 – 1.000.000 TL');
    expect(compactBudget(500_000, null)).toBe('En az 500.000 TL');
    expect(compactBudget(null, null)).toBe('');
  });
});
