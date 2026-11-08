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
  it('milyon ve bin birimleriyle kısaltır', () => {
    expect(compactBudget(1_350_000, 1_600_000)).toBe('1,35 – 1,6 mn TL');
    expect(compactBudget(850_000, 1_000_000)).toBe('850 bin – 1 mn TL');
    expect(compactBudget(700_000, 850_000)).toBe('700 – 850 bin TL');
    expect(compactBudget(null, 2_000_000)).toBe('En çok 2 mn TL');
    expect(compactBudget(500_000, null)).toBe('En az 500 bin TL');
    expect(compactBudget(null, null)).toBe('');
    expect(compactBudget(850_000, 1_000_000, 'milyon')).toBe('850 bin – 1 milyon TL');
  });
});
