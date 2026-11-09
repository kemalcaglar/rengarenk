import { describe, expect, it } from 'vitest';
import { aranabilir, contactPrefsSchema, saatYaz, trSaat } from './contact.js';

describe('iletişim tercihleri (Karar 29)', () => {
  it('Türkiye saatiyle aranabilir saatler; bitiş saati dahil değil', () => {
    // 06.30 UTC = 09.30 Türkiye
    const sabah = new Date('2026-11-09T06:30:00Z');
    expect(trSaat(sabah)).toBe(9);
    expect(aranabilir(9, 21, sabah)).toBe(true);
    expect(aranabilir(10, 21, sabah)).toBe(false);
    // 18.00 UTC = 21.00 Türkiye: 09.00–21.00 dışında
    expect(aranabilir(9, 21, new Date('2026-11-09T18:00:00Z'))).toBe(false);
    expect(aranabilir(0, 24, new Date('2026-11-09T20:59:00Z'))).toBe(true);
    expect(saatYaz(9)).toBe('09.00');
  });

  it('WhatsApp telefon izni ister; bitiş başlangıçtan sonra', () => {
    const ok = { phoneVisible: true, whatsappVisible: true, callFrom: 9, callTo: 21 };
    expect(contactPrefsSchema.safeParse(ok).success).toBe(true);
    expect(contactPrefsSchema.safeParse({ ...ok, phoneVisible: false }).success).toBe(false);
    expect(contactPrefsSchema.safeParse({ ...ok, callFrom: 21, callTo: 21 }).success).toBe(false);
    expect(contactPrefsSchema.safeParse({ ...ok, callTo: 25 }).success).toBe(false);
  });
});
