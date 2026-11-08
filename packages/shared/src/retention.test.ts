import { describe, expect, it } from 'vitest';
import { BREACH_STEPS, disposalNo, nextDisposalDate, RETENTION_RULES } from './retention.js';

describe('saklama ve imha (Karar 59)', () => {
  it('periyodik imha 1 Ocak ve 1 Temmuz, İstanbul 03.00 (UTC 00.00); tutanak numarası döneme göre', () => {
    const a = nextDisposalDate(new Date('2026-11-09T10:00:00Z'));
    expect(a.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(disposalNo(a)).toBe('İ-2027-01');
    const b = nextDisposalDate(new Date('2027-01-01T00:00:00Z'));
    expect(b.toISOString()).toBe('2027-07-01T00:00:00.000Z');
    expect(disposalNo(b)).toBe('İ-2027-02');
  });
  it('tasarımdaki saklama tablosu ve beş adımlı ihlal prosedürü', () => {
    expect(RETENTION_RULES.map((r) => r.key)).toEqual([
      'hesap',
      'mesaj',
      'fatura',
      'erisim',
      'kimlik',
      'islem',
      'riza',
      'kvkk',
    ]);
    expect(BREACH_STEPS).toHaveLength(5);
  });
});
