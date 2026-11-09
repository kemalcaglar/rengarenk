import { describe, expect, it } from 'vitest';
import {
  bannedWordsIn,
  hideDemandText,
  hidePhones,
  maskEvidence,
  reasonsFor,
  reportCreateSchema,
  scanDemandText,
  shortName,
} from './moderation.js';

describe('moderasyon yardımcıları (Karar 53)', () => {
  it('kanıt maskesi: IBAN son 4 hane, telefon son 2 hane, bağlantı işaretlenir', () => {
    const m = maskEvidence(
      'IBAN TR33 0006 1005 1978 6457 8413 26, ara 0532 111 22 33 ya da https://ode.me/x',
    );
    expect(m).toContain('TR•• •••• •••• •••• •••• 1326');
    expect(m).toContain('05•• ••• •• 33');
    expect(m).toContain('[bağlantı]');
    expect(m).not.toMatch(/0006|111 22/);
  });

  it('numara gizleme ve yasaklı kelime (Türkçe büyük-küçük harf)', () => {
    expect(hidePhones('Numaram +90 532 111 22 33')).toBe('Numaram [numara gizlendi]');
    expect(bannedWordsIn('Önce KAPORA, sonra İBAN', ['kapora', 'iban', 'noter'])).toEqual(['kapora', 'iban']);
  });

  it('nedenler hedefe göre; kısa ad', () => {
    expect(reasonsFor('mesaj')).toContain('kapora');
    expect(reasonsFor('mesaj')).not.toContain('yanlis_kategori');
    expect(reasonsFor('talep')).not.toContain('yasakli_kelime');
    expect(reportCreateSchema.safeParse({ hedef: 'arac', id: '5', neden: 'kapora' }).success).toBe(false);
    expect(shortName('Emre', 'kaya')).toBe('Emre K.');
    expect(shortName(null, null)).toBe('Kullanıcı');
  });
});

describe('talep metni (Karar 41, 13.2)', () => {
  it('telefon, IBAN, e-posta ve bağlantıyı bulur; araç bilgisini işaretlemez', () => {
    expect(scanDemandText('2019 sonrası 1.5 TSI, 120.000 km altı, bütçe 1.500.000')).toEqual([]);
    expect(scanDemandText('Ara: 0532 418 22 41')).toEqual(['telefon']);
    expect(scanDemandText('Sabit hat (0212) 555 44 33')).toEqual(['telefon']);
    expect(scanDemandText('IBAN TR33 0006 1005 1978 6457 8413 26')).toEqual(['iban']);
    expect(scanDemandText('ayse@ornek.com yaz, www.ilan.com/x')).toEqual(['eposta', 'baglanti']);
    expect(scanDemandText('ilanım ornekilan.com.tr/abc')).toEqual(['baglanti']);
  });

  it('herkese açık metinde gizler', () => {
    expect(hideDemandText('Passat arıyorum 0532 418 22 41')).toBe('Passat arıyorum [numara gizlendi]');
    expect(hideDemandText('TR33 0006 1005 1978 6457 8413 26 ödeme')).toBe('[IBAN gizlendi] ödeme');
    expect(hideDemandText('https://x.ly/a ve ayse@ornek.com')).toBe(
      '[bağlantı gizlendi] ve [e-posta gizlendi]',
    );
    expect(hideDemandText('1.5 TSI DSG, 2020')).toBe('1.5 TSI DSG, 2020');
    expect(hideDemandText(null)).toBeNull();
  });
});
