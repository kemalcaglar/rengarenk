import { type NextRequest, NextResponse } from 'next/server';
import { API, clearCookie, forwardHeaders, originOk, SESSION_COOKIE } from '../../../../lib/oturum';

/**
 * Konsol sayfalarının API'ye köprüsü: /api/yonetim/<yol> → API /staff/<yol>. Oturum jetonu çerezden
 * yetki başlığına çevrilir. Değişiklik yapan isteklerde aynı köken ve `x-rr-istek` başlığı aranır
 * (başka bir siteden tetiklenen isteklere karşı).
 */
async function handle(req: NextRequest, ctx: { params: Promise<{ yol: string[] }> }) {
  const { yol } = await ctx.params;
  if (yol[0] === 'auth') return NextResponse.json({ message: 'Bulunamadı' }, { status: 404 });
  if (req.method !== 'GET' && (req.headers.get('x-rr-istek') !== '1' || !originOk(req))) {
    return NextResponse.json({ message: 'Geçersiz istek' }, { status: 403 });
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: 'Oturum kapalı' }, { status: 401 });

  const body = req.method === 'GET' ? undefined : await req.text();
  const res = await fetch(`${API}/staff/${yol.map(encodeURIComponent).join('/')}${req.nextUrl.search}`, {
    method: req.method,
    headers: {
      ...forwardHeaders(req.headers),
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body || undefined,
    cache: 'no-store',
  });
  const text = res.status === 204 ? null : await res.text();
  const out = new NextResponse(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
  return res.status === 401 ? clearCookie(out, SESSION_COOKIE) : out;
}

export { handle as DELETE, handle as GET, handle as PATCH, handle as POST, handle as PUT };
