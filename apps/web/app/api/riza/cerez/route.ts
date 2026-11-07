import { randomBytes } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { API } from '../../../../lib/oturum';

const VISITOR = 'rr_ziyaretci';

/**
 * Çerez tercihi kaydı (Karar 59): ziyaretçiye rastgele bir kimlik verilir (httpOnly çerez, kişiyi tanımlamaz);
 * tercih bu kimlikle, metin sürümü ve kanalıyla API'de saklanır.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { analiz?: unknown; reklam?: unknown } | null;
  const visitor = req.cookies.get(VISITOR)?.value ?? randomBytes(18).toString('base64url');
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  const r = await fetch(`${API}/consents/cookie`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-rr-ziyaretci': visitor,
      'x-rr-platform': 'WEB',
      ...(fwd ? { 'x-forwarded-for': fwd } : {}),
    },
    body: JSON.stringify({ analiz: body?.analiz === true, reklam: body?.reklam === true }),
    cache: 'no-store',
  }).catch(() => null);
  const res = new NextResponse(null, { status: r?.ok ? 204 : 502 });
  res.cookies.set(VISITOR, visitor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/riza',
    maxAge: 365 * 24 * 60 * 60,
  });
  return res;
}
