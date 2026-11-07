import { timingSafeEqual } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import {
  apiFetch,
  clearCookie,
  cookieBase,
  message,
  STATE_COOKIE,
  TICKET_COOKIE,
} from '../../../../../lib/oturum';

const back = (req: NextRequest, hata: string) =>
  clearCookie(
    NextResponse.redirect(new URL(`/giris?hata=${encodeURIComponent(hata)}`, req.url)),
    STATE_COOKIE,
    '/api/oturum/google',
  );

/** Giriş 2. adım: Google dönüşü. State çerezle eşleşmeli; API şirket hesabını ve çalışanı denetler. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const state = q.get('state') ?? '';
  const code = q.get('code');
  const expected = req.cookies.get(STATE_COOKIE)?.value ?? '';
  if (q.get('error')) return back(req, 'Google girişi iptal edildi');
  if (
    !code ||
    !state ||
    state.length !== expected.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(expected))
  ) {
    return back(req, 'Giriş isteği bu tarayıcıdan başlatılmamış, yeniden dene');
  }

  const res = await apiFetch('/staff/auth/google/callback', { body: { state, code }, headers: req.headers });
  if (!res.ok) return back(req, await message(res, 'Giriş yapılamadı'));
  const { ticket, needsSetup } = (await res.json()) as { ticket: string; needsSetup: boolean };

  const out = NextResponse.redirect(new URL(`/giris/iki-adim${needsSetup ? '?kurulum=1' : ''}`, req.url));
  out.cookies.set(TICKET_COOKIE, ticket, { ...cookieBase, path: '/api/oturum', maxAge: 600 });
  return clearCookie(out, STATE_COOKIE, '/api/oturum/google');
}
