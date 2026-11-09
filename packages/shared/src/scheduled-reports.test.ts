import { describe, expect, it } from 'vitest';
import { lastSlot, nextSlot, scheduledReportSchema, scheduleText } from './scheduled-reports.js';

describe('Zamanlanmış raporlar (Karar 44)', () => {
  it('sıklığı Türkçe yazar', () => {
    expect(scheduleText('hafta:1', '09:30')).toBe('Her pazartesi 09.30');
    expect(scheduleText('hafta:5', '17:00')).toBe('Her cuma 17.00');
    expect(scheduleText('ay:1', '10:00')).toBe('Her ayın 1’i 10.00');
    expect(scheduleText('ay:3', '10:00')).toBe('Her ayın 3’ü 10.00');
    expect(scheduleText('ay:6', '10:00')).toBe('Her ayın 6’sı 10.00');
    expect(scheduleText('gun', '09:00')).toBe('Her gün 09.00');
  });

  it('gönderim zamanını Türkiye saatine göre bulur', () => {
    // 9 Kasım 2026 pazartesi, 06.00 UTC = 09.00 TSİ
    const now = new Date('2026-11-09T06:00:00Z');
    expect(lastSlot('hafta:1', '09:30', now).toISOString()).toBe('2026-11-02T06:30:00.000Z');
    expect(nextSlot('hafta:1', '09:30', now).toISOString()).toBe('2026-11-09T06:30:00.000Z');
    expect(lastSlot('hafta:1', '09:00', now).toISOString()).toBe('2026-11-09T06:00:00.000Z');
    expect(lastSlot('ay:1', '10:00', now).toISOString()).toBe('2026-11-01T07:00:00.000Z');
    expect(nextSlot('ay:3', '10:00', now).toISOString()).toBe('2026-12-03T07:00:00.000Z');
    // Gece yarısından sonra TSİ'de gün değişir (UTC'de hâlâ önceki gün)
    const gece = new Date('2026-11-08T22:30:00Z'); // 9 Kasım 01.30 TSİ
    expect(lastSlot('gun', '01:00', gece).toISOString()).toBe('2026-11-08T22:00:00.000Z');
    expect(nextSlot('hafta:7', '20:00', gece).toISOString()).toBe('2026-11-15T17:00:00.000Z');
  });

  it('formu doğrular', () => {
    const ok = scheduledReportSchema.safeParse({
      kaynak: { tur: 'sekme', sekme: 'gelir' },
      siklik: 'hafta:5',
      saat: '17:00',
      alicilar: ['0192f6a0-0000-7000-8000-000000000001'],
    });
    expect(ok.success).toBe(true);
    for (const kotu of [
      { siklik: 'ay:31' },
      { siklik: 'hafta:8' },
      { saat: '24:00' },
      { alicilar: [] },
      { kaynak: { tur: 'sekme', sekme: 'yok' } },
    ])
      expect(
        scheduledReportSchema.safeParse({
          kaynak: { tur: 'sekme', sekme: 'gelir' },
          siklik: 'gun',
          saat: '09:00',
          alicilar: ['0192f6a0-0000-7000-8000-000000000001'],
          ...kotu,
        }).success,
      ).toBe(false);
  });
});
