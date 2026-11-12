import { type NextRequest, NextResponse } from 'next/server';
import { GOOGLE_COOKIE, guvenliSonra, siteAdresi } from '../../../../../lib/google';
import { api } from '../../../../../lib/oturum';

/**
 * Google ile devam et (Karar 18): API yönlendirme adresini ve `state`'i verir; `state` ve dönülecek sayfa httpOnly
 * çerezde durur (giriş sahteciliğine karşı dönüşte karşılaştırılır).
 */
export async function GET(req: NextRequest) {
  const sonra = guvenliSonra(req.nextUrl.searchParams.get('sonra'));
  const r = await api(req, '/auth/google/start', { platform: 'WEB' });
  if (!r.ok) {
    const neden = r.status === 503 ? 'google_kapali' : 'google';
    return NextResponse.redirect(siteAdresi(req, `/giris?hata=${neden}`));
  }
  const { url, state } = (await r.json()) as { url: string; state: string };
  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_COOKIE, JSON.stringify({ state, sonra }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/oturum/google',
    maxAge: 600,
  });
  return res;
}
