import { type NextRequest, NextResponse } from 'next/server';
import {
  apiFetch,
  clearCookie,
  cookieBase,
  DEVICE_COOKIE,
  message,
  originOk,
  SESSION_COOKIE,
  TICKET_COOKIE,
} from '../../../../lib/oturum';

/** Giriş 3. adım: doğrulama uygulaması kodu (veya kurtarma kodu). Doğruysa oturum çerezi yazılır. */
export async function POST(req: NextRequest) {
  if (!originOk(req)) return NextResponse.json({ message: 'Geçersiz istek' }, { status: 403 });
  const ticket = req.cookies.get(TICKET_COOKIE)?.value;
  if (!ticket) return NextResponse.json({ message: 'Giriş isteğinin süresi doldu' }, { status: 401 });
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const deviceId = req.cookies.get(DEVICE_COOKIE)?.value;

  const res = await apiFetch('/staff/auth/2fa/verify', {
    body: { ticket, code: code ?? '', ...(deviceId ? { deviceId } : {}) },
    headers: req.headers,
  });
  if (!res.ok) {
    return NextResponse.json({ message: await message(res, 'Kod doğrulanamadı') }, { status: res.status });
  }
  const data = (await res.json()) as { sessionToken: string; expiresAt: string; recoveryCodes?: string[] };
  const out = NextResponse.json({ recoveryCodes: data.recoveryCodes ?? null });
  out.cookies.set(SESSION_COOKIE, data.sessionToken, {
    ...cookieBase,
    path: '/',
    expires: new Date(data.expiresAt),
  });
  return clearCookie(out, TICKET_COOKIE, '/api/oturum');
}
