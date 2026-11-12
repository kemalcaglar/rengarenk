import { type NextRequest, NextResponse } from 'next/server';
import { GOOGLE_COOKIE, kayitParcasi, siteAdresi } from '../../../../../lib/google';
import { api, withRefreshCookie } from '../../../../../lib/oturum';

/**
 * Google dönüşü (Karar 18). Mobil uygulamanın başlattığı girişte (`state` "m." ile başlar) kod uygulamaya iletilir;
 * uygulama kendi `state`'ini karşılaştırır. Web'de `state` çerezdekiyle aynı olmalı. Hesap varsa oturum açılır, yoksa
 * üyelik formu Google bilgileriyle açılır (bilgiler adresin # kısmında, sunucuya gitmez).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const state = q.get('state') ?? '';
  const code = q.get('code') ?? '';
  if (state.startsWith('m.')) {
    const hedef = new URL('rengarenk://google');
    for (const [k, v] of q) hedef.searchParams.set(k, v);
    return NextResponse.redirect(hedef.toString());
  }
  const hata = (neden: string) => {
    const res = NextResponse.redirect(siteAdresi(req, `/giris?hata=${neden}`));
    res.cookies.set(GOOGLE_COOKIE, '', { path: '/api/oturum/google', maxAge: 0 });
    return res;
  };
  let cerez: { state?: string; sonra?: string | null } = {};
  try {
    cerez = JSON.parse(req.cookies.get(GOOGLE_COOKIE)?.value ?? '{}');
  } catch {
    // geçersiz çerez: aşağıda reddedilir
  }
  if (!state || !code || cerez.state !== state) return hata(q.get('error') ? 'google_iptal' : 'google');

  const r = await api(req, '/auth/google/callback', { state, code });
  const data = (await r.json().catch(() => ({}))) as {
    tip?: 'giris' | 'kayit';
    refreshToken?: string;
    message?: string;
  } & Record<string, unknown>;
  if (!r.ok) return hata(r.status === 409 ? 'google_eposta' : 'google');
  if (data.tip === 'giris' && data.refreshToken) {
    const res = withRefreshCookie(
      NextResponse.redirect(siteAdresi(req, cerez.sonra ?? '/')),
      data.refreshToken,
    );
    res.cookies.set(GOOGLE_COOKIE, '', { path: '/api/oturum/google', maxAge: 0 });
    return res;
  }
  const hedef = siteAdresi(req, `/uye-ol${cerez.sonra ? `?sonra=${encodeURIComponent(cerez.sonra)}` : ''}`);
  hedef.hash = `g=${kayitParcasi(data)}`;
  const res = NextResponse.redirect(hedef);
  res.cookies.set(GOOGLE_COOKIE, '', { path: '/api/oturum/google', maxAge: 0 });
  return res;
}
