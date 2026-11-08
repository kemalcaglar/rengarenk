import { describe, expect, it } from 'vitest';
import { searchQueryKey } from './demand';

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
