import { randomBytes } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import {
  apiFetch,
  cookieBase,
  DEVICE_COOKIE,
  konsolAdresi,
  message,
  STATE_COOKIE,
} from '../../../../lib/oturum';

/** Giriş 1. adım: API'den Google adresini alır, state'i çereze yazar ve Google'a yönlendirir. */
export async function GET(req: NextRequest) {
  const res = await apiFetch('/staff/auth/google/start', { headers: req.headers });
  if (!res.ok) {
    const text = await message(res, 'Giriş başlatılamadı');
    return NextResponse.redirect(konsolAdresi(req, `/giris?hata=${encodeURIComponent(text)}`));
  }
  const { url, state } = (await res.json()) as { url: string; state: string };
  const out = NextResponse.redirect(url);
  out.cookies.set(STATE_COOKIE, state, { ...cookieBase, path: '/api/oturum/google', maxAge: 600 });
  if (!req.cookies.get(DEVICE_COOKIE)) {
    out.cookies.set(DEVICE_COOKIE, randomBytes(24).toString('base64url'), {
      ...cookieBase,
      path: '/api/oturum',
      maxAge: 365 * 86400,
    });
  }
  return out;
}
