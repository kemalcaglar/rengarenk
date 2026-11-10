import { describe, expect, it } from 'vitest';
import {
  activeTheme,
  applyDesignColors,
  contrast,
  DEFAULT_DESIGN,
  designCssVars,
  designProblems,
  designTokensSchema,
  FONTS,
  fontCssUrl,
  themeStatus,
} from './design.js';
import { colors } from './tokens.js';

describe('tasarım değerleri (Karar 46)', () => {
  it('varsayılan değerler geçerli ve okunabilir; çok sayıda Türkçe destekli yazı tipi', () => {
    expect(designTokensSchema.safeParse(DEFAULT_DESIGN).success).toBe(true);
    expect(designProblems(DEFAULT_DESIGN)).toEqual([]);
    expect(FONTS.length).toBeGreaterThanOrEqual(60);
    expect(Math.round(contrast('#1E2333', '#F6F8FD'))).toBe(15);
    expect(fontCssUrl('Plus Jakarta Sans')).toBe(
      'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
    );
  });

  it('okunmayan metin rengi ve tema bandı reddedilir; tema tarihine göre geçerli', () => {
    const t = {
      ...DEFAULT_DESIGN,
      renkler: { ...DEFAULT_DESIGN.renkler, baglanti: '#9DB8FF' },
      temalar: [
        {
          id: 'yilbasi',
          ad: 'Yılbaşı',
          baslangic: '2026-12-20',
          bitis: '2027-01-02',
          ustBant: '#22306B',
          ustYazi: '#2A3570',
          rozet: '❄ Mutlu yıllar',
          not: '',
        },
      ],
    };
    const p = designProblems(t);
    expect(p[0]).toMatch(/^Bağlantı rengi zemine karşı okunmuyor/);
    expect(p.at(-1)).toMatch(/^Yılbaşı: üst bant yazısı okunmuyor/);
    expect(activeTheme(t, new Date('2026-12-25T10:00:00Z'))?.ad).toBe('Yılbaşı');
    expect(activeTheme(t, new Date('2027-01-03T10:00:00Z'))).toBeNull();
    expect(themeStatus(t.temalar[0] as never, new Date('2026-11-10T10:00:00Z'))).toBe('Zamanlandı');
    expect(designCssVars(t, activeTheme(t, new Date('2026-12-25T10:00:00Z')))['--rr-ust-bant']).toBe(
      '#22306B',
    );
  });

  it('mobil ve e-posta için ortak renkler yayındaki değerlere geçer ve geri döner', () => {
    applyDesignColors({ ...DEFAULT_DESIGN, renkler: { ...DEFAULT_DESIGN.renkler, mavi: '#3366FF' } });
    expect(colors.blue).toBe('#3366FF');
    applyDesignColors(null);
    expect(colors.blue).toBe('#5B8CFF');
  });
});
