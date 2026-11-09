import { describe, expect, it } from 'vitest';
import { ekle, sayiSonKelime } from './tr-ek.js';

describe('Türkçe ekler', () => {
  it('özel adlara ve sayılara doğru eki getirir', () => {
    expect(ekle('İzmir', 'bulunma')).toBe('İzmir’de');
    expect(ekle('Antalya', 'bulunma')).toBe('Antalya’da');
    expect(ekle('Muş', 'bulunma')).toBe('Muş’ta');
    expect(ekle(24, 'iyelik')).toBe('24’ü');
    expect(ekle(7, 'iyelik')).toBe('7’si');
    expect(ekle(40, 'iyelik')).toBe('40’ı');
    expect(ekle(2026, 'bulunma')).toBe('2.026’da');
    expect(ekle(1146, 'iyelik')).toBe('1.146’sı');
    expect(sayiSonKelime(1000)).toBe('bin');
    expect(ekle('Ekim 2026', 'bulunma')).toBe('Ekim 2026’da');
    expect(ekle('eylül', 'yonelme')).toBe('eylül’e');
  });
});
