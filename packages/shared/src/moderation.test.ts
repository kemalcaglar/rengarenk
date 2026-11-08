import { describe, expect, it } from 'vitest';
import {
  bannedWordsIn,
  hidePhones,
  maskEvidence,
  reasonsFor,
  reportCreateSchema,
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
