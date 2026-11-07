import { type NextRequest, NextResponse } from 'next/server';
import { apiFetch, message, originOk, TICKET_COOKIE } from '../../../../../lib/oturum';

/** İlk girişte doğrulama uygulaması kurulumu: karekod ve elle girilecek anahtar. */
export async function POST(req: NextRequest) {
  if (!originOk(req)) return NextResponse.json({ message: 'Geçersiz istek' }, { status: 403 });
  const ticket = req.cookies.get(TICKET_COOKIE)?.value;
  if (!ticket) return NextResponse.json({ message: 'Giriş isteğinin süresi doldu' }, { status: 401 });
  const res = await apiFetch('/staff/auth/2fa/setup', { body: { ticket }, headers: req.headers });
  if (!res.ok) {
    return NextResponse.json(
      { message: await message(res, 'Kurulum başlatılamadı') },
      { status: res.status },
    );
  }
  const { secret, qrSvg } = (await res.json()) as { secret: string; qrSvg: string };
  return NextResponse.json({ secret, qrSvg });
}
