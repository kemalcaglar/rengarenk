import { describe, expect, it } from 'vitest';
import { adEventId, agAdi, izinsizTemas, kampanyaAdi, kanalOf, touchFromUrl, touchSchema } from './ads.js';

const now = new Date('2026-11-09T10:00:00Z');

describe('reklam ölçümü (Karar 35)', () => {
  it('adresten temas: UTM, tıklama kimliği ve fbc; sorgusuz açılış sayfası', () => {
    const t = touchFromUrl(
      'https://rengarenk.com.tr/galeri-ol?utm_source=meta&utm_medium=paid&utm_campaign=galeri_ol_istanbul&fbclid=IwAR1&x=1',
      'https://l.facebook.com/',
      now,
    );
    expect(t).toEqual({
      utm_source: 'meta',
      utm_medium: 'paid',
      utm_campaign: 'galeri_ol_istanbul',
      fbclid: 'IwAR1',
      fbc: `fb.1.${now.getTime()}.IwAR1`,
      ref: 'l.facebook.com',
      sayfa: '/galeri-ol',
      at: now.toISOString(),
    });
    expect(touchSchema.safeParse(t).success).toBe(true);
    expect(kanalOf(t)).toBe('reklam');
    expect(agAdi(t)).toBe('Meta');
  });

  it('doğrudan giriş ve site içi gezinti temas değildir; dış yönlendirme organiktir', () => {
    expect(touchFromUrl('https://rengarenk.com.tr/talepler', '', now)).toBeNull();
    expect(touchFromUrl('https://rengarenk.com.tr/talepler', 'https://rengarenk.com.tr/', now)).toBeNull();
    const g = touchFromUrl('https://rengarenk.com.tr/', 'https://www.google.com/', now);
    expect(g).toMatchObject({ ref: 'google.com', sayfa: '/' });
    expect(kanalOf(g)).toBe('organik');
    expect(kampanyaAdi(g, 'organik')).toBe('google.com');
  });

  it('kanal: gclid reklam, e-posta ve bildirim kendi kanalımız', () => {
    expect(kanalOf({ gclid: 'x' })).toBe('reklam');
    expect(agAdi({ gclid: 'x' })).toBe('Google');
    expect(kanalOf({ utm_source: 'rengarenk', utm_medium: 'email' })).toBe('bildirim');
    expect(kanalOf({ utm_source: 'blog' })).toBe('organik');
    expect(kanalOf(null)).toBe('organik');
  });

  it('izinsiz temas tıklama kimliklerini ve Meta çerezlerini taşımaz', () => {
    const t = touchFromUrl('https://rengarenk.com.tr/?gclid=G&fbclid=F&utm_source=google', '', now);
    const z = izinsizTemas({ ...(t as NonNullable<typeof t>), fbp: 'fb.1.1.2' });
    expect(z).toEqual({ utm_source: 'google', sayfa: '/', at: now.toISOString() });
  });

  it('olay kimliği tarayıcıda ve sunucuda aynı', () => {
    expect(adEventId('Lead', 'abc')).toBe('talep-abc');
    expect(adEventId('Purchase', 'RR1')).toBe('satin-RR1');
  });
});
