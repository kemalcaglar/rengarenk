import { describe, expect, it } from 'vitest';
import { firstMessageSchema, MESSAGE_MAX, scanMessage } from './messages.js';

describe('mesaj güvenliği (Karar 25)', () => {
  it('kapora, ödeme, IBAN, telefon ve bağlantı kalıplarını işaretler', () => {
    expect(scanMessage('Aracı başkasına vermemek için kapora göndermeniz gerekiyor')).toEqual(['kapora']);
    expect(scanMessage('Ön ödeme alırsak aracı ayırırız')).toEqual(['kapora']);
    expect(scanMessage('Parayı hesaba yatırın, sonra görüşürüz')).toEqual(['odeme']);
    expect(scanMessage('IBAN: TR12 0006 4000 0011 2345 6789 01')).toEqual(['iban']);
    expect(scanMessage('Beni 0532 123 45 67 numarasından arayın')).toEqual(['telefon']);
    expect(scanMessage('+905321234567')).toEqual(['telefon']);
    expect(scanMessage('Detaylar için bit.ly/abc ya da https://ornek.com')).toEqual(['baglanti']);
    expect(scanMessage('wa.me/905321234567')).toContain('baglanti');
  });

  it('olağan araç mesajını işaretlemez', () => {
    expect(
      scanMessage(
        'Merhaba, 2020 BMW 320i 1.6 turbo, 62.000 km, tramer 12.000 TL. Cumartesi 11:00 uygun mu? Fiyat 2.390.000 TL.',
      ),
    ).toEqual([]);
    expect(scanMessage('Aracı görmeye gelebilir miyim? Noterde ödeme yaparım.')).toEqual([]);
  });

  it('ilk mesaj: boş olamaz, en çok 600 karakter', () => {
    expect(firstMessageSchema.safeParse({ metin: '  ' }).success).toBe(false);
    expect(firstMessageSchema.safeParse({ metin: 'a'.repeat(MESSAGE_MAX + 1) }).success).toBe(false);
    expect(firstMessageSchema.safeParse({ metin: 'Merhaba' }).success).toBe(true);
  });
});
