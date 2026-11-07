import { type NextRequest, NextResponse } from 'next/server';
import { apiFetch, clearCookie, originOk, SESSION_COOKIE } from '../../../../lib/oturum';

export async function POST(req: NextRequest) {
  if (!originOk(req)) return NextResponse.json({ message: 'Geçersiz istek' }, { status: 403 });
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await apiFetch('/staff/auth/logout', { token, headers: req.headers }).catch(() => undefined);
  return clearCookie(new NextResponse(null, { status: 204 }), SESSION_COOKIE);
}
