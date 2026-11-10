import { describe, expect, it } from 'vitest';
import {
  activeTheme,
  applyDesignColors,
  butonOran,
  contrast,
  DEFAULT_DESIGN,
  designCssVars,
  designProblems,
  designTokensSchema,
  designWarnings,
  FONTS,
  fontCssUrl,
  kartOran,
  kartOranCss,
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

describe('tasarım değerleri: renkli zemin yazısı ve oranlı köşeler', () => {
  it('önceki sürümde olmayan renkler varsayılanla tamamlanır', () => {
    const eski = {
      renkler: {
        mavi: '#5B8CFF',
        pembe: '#FF6FB5',
        sari: '#FFC84A',
        yesil: '#3DD68C',
        murekkep: '#1E2333',
        baglanti: '#2450C8',
        zemin: '#F6F8FD',
        cizgi: '#E3E6EF',
      },
      yaziTipi: 'Plus Jakarta Sans',
      kartKose: 0,
      butonKose: 0,
      etiketKose: 0,
      temalar: [],
    };
    const t = designTokensSchema.parse(eski);
    expect(t.renkler.maviYazi).toBe('#1E2333');
    expect(t.renkler.kart).toBe('#FFFFFF');
    expect(t.renkler.soluk).toBe('#5A6073');
    expect(designCssVars(t)['--rr-maviYazi']).toBe('#1E2333');
  });

  it('mavi üstünde beyaz yazı gönderilebilir ama uyarı verir; okunmayan yazı reddedilir', () => {
    const beyaz = { ...DEFAULT_DESIGN, renkler: { ...DEFAULT_DESIGN.renkler, maviYazi: '#FFFFFF' } };
    expect(designProblems(beyaz)).toEqual([]);
    expect(designWarnings(beyaz)[0]).toMatch(/^Mavi üstündeki yazı: 3,2:1/);
    const sari = { ...DEFAULT_DESIGN, renkler: { ...DEFAULT_DESIGN.renkler, sariYazi: '#FFFFFF' } };
    expect(designProblems(sari)[0]).toMatch(/^Sarı üstündeki yazı okunmuyor/);
    const kart = { ...DEFAULT_DESIGN, renkler: { ...DEFAULT_DESIGN.renkler, kart: '#1E2333' } };
    expect(designProblems(kart)[0]).toMatch(/^Mürekkep rengi kart zeminine karşı okunmuyor/);
  });

  it('köşeler tasarımdaki oranla küçülür; 0 seçilirse hepsi kalkar', () => {
    applyDesignColors({ ...DEFAULT_DESIGN, kartKose: 9, butonKose: 0 });
    expect(kartOran(16)).toBe(8);
    expect(butonOran(10)).toBe(0);
    applyDesignColors(null);
    expect(kartOran(16)).toBe(16);
    expect(kartOranCss(16)).toBe('calc(var(--rr-kart-kose) * 16 / 18)');
  });
});
