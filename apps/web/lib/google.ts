import type { NextRequest } from 'next/server';

/**
 * Sitenin dışarıdan görünen adresi: yönlendirmeler buna göre kurulur. Kapsayıcıda `req.url` iç adresi
 * (0.0.0.0:3000) taşıdığı için kullanılmaz; önce WEB_ORIGIN, yoksa vekil sunucunun ilettiği başlıklar.
 */
export function siteAdresi(req: NextRequest, yol: string): URL {
  const kok =
    process.env.WEB_ORIGIN ??
    `${req.headers.get('x-forwarded-proto') ?? 'http'}://${req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'}`;
  return new URL(yol, kok);
}

/** Google ile giriş çerezi: `state` ve girişten sonra dönülecek sayfa (Karar 18) */
export const GOOGLE_COOKIE = 'rr_google';

/** Yalnızca site içi göreli adres */
export const guvenliSonra = (s: string | null | undefined) =>
  s?.startsWith('/') && !s.startsWith('//') ? s : null;

export interface GoogleKayit {
  kayitJetonu: string;
  saglayici: 'google' | 'apple';
  ad: string | null;
  soyad: string | null;
  eposta: string;
}

/** Üyelik formuna giden Google bilgileri: adresin # kısmında base64url (sunucu günlüklerine düşmez) */
export function kayitParcasi(d: Record<string, unknown>) {
  const g: GoogleKayit = {
    kayitJetonu: String(d.kayitJetonu ?? ''),
    saglayici: d.saglayici === 'apple' ? 'apple' : 'google',
    ad: typeof d.ad === 'string' ? d.ad : null,
    soyad: typeof d.soyad === 'string' ? d.soyad : null,
    eposta: typeof d.eposta === 'string' ? d.eposta : '',
  };
  return Buffer.from(JSON.stringify(g)).toString('base64url');
}

/** Tarayıcıda # kısmını okur */
export function kayitOku(hash: string): GoogleKayit | null {
  const m = hash.match(/(?:^#|&)g=([A-Za-z0-9_-]+)/);
  if (!m?.[1]) return null;
  try {
    const b = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)));
    const g = JSON.parse(json) as GoogleKayit;
    return g.kayitJetonu ? g : null;
  } catch {
    return null;
  }
}
