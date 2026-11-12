import { describe, expect, it } from 'vitest';
import { AI_BUDGET, aiCostMicroUsd, maskPii, unmaskPii } from './agent.js';

describe('yapay zekâ maskeleme (Karar 41, 57)', () => {
  it('telefon, e-posta, IBAN, T.C. kimlik no, plaka ve bilinen ad soyadı yer tutucuyla değiştirir', () => {
    const m = maskPii(
      'Ayşe Yılmaz yazdı: 0532 418 22 41 ya da +90 532 418 22 41, ayse@ornek.com, IBAN TR12 0006 1005 1978 6457 8413 26, TC 12345678901, plaka 34 ABC 123. Ayşe Hanım bekliyor.',
      { names: ['Ayşe Yılmaz'] },
    );
    expect(m.text).not.toMatch(/0532|ayse@|TR12|12345678901|34 ABC|Ayşe|Yılmaz/);
    expect(m.text).toContain('[TELEFON_1]');
    expect(m.text).toContain('[TELEFON_2]');
    expect(m.text).toContain('[EPOSTA_1]');
    expect(m.text).toContain('[IBAN_1]');
    expect(m.text).toContain('[TCKN]');
    expect(m.text).toContain('[PLAKA_1]');
    expect(m.text).toContain('[KİŞİ_1]');
    // Aynı değer aynı yer tutucu; T.C. kimlik no geri konmaz
    expect(m.text.match(/\[KİŞİ_1\]/g)?.length).toBe(1);
    expect(Object.values(m.map)).not.toContain('12345678901');
    expect(unmaskPii('Sayın [KİŞİ_1], numaranız [TELEFON_1]', m.map)).toBe(
      'Sayın Ayşe Yılmaz, numaranız 0532 418 22 41',
    );
  });

  it('fiyat, yıl ve kilometreye dokunmaz', () => {
    const t = '2019 sonrası otomatik dizel, 1.500.000 TL bütçe, en çok 120000 km';
    expect(maskPii(t).text).toBe(t);
  });

  it('maliyet milyonda bir USD ile hesaplanır; başlangıç sınırı 150 USD', () => {
    expect(aiCostMicroUsd('vertex', 'kucuk', 1_000_000, 0)).toBe(300_000);
    expect(aiCostMicroUsd('vertex', 'buyuk', 1000, 1000)).toBe(11_250);
    expect(aiCostMicroUsd('bedrock', 'kucuk', 1_000_000, 1_000_000)).toBe(300_000);
    expect(aiCostMicroUsd('bedrock', 'buyuk', 1000, 1000)).toBe(4_000);
    expect(AI_BUDGET.baslangicUsd).toBe(150);
  });
});
