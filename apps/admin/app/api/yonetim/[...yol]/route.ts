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

  // Gövde olduğu gibi (ham bayt) iletilir: JSON da, konsoldan yüklenen Excel dosyası da bozulmadan gider.
  const body = req.method === 'GET' ? undefined : await req.arrayBuffer();
  const hasBody = body !== undefined && body.byteLength > 0;
  const fileName = req.headers.get('x-dosya-adi');
  const res = await fetch(`${API}/staff/${yol.map(encodeURIComponent).join('/')}${req.nextUrl.search}`, {
    method: req.method,
    headers: {
      ...forwardHeaders(req.headers),
      authorization: `Bearer ${token}`,
      ...(hasBody ? { 'content-type': req.headers.get('content-type') ?? 'application/json' } : {}),
      ...(fileName ? { 'x-dosya-adi': fileName } : {}),
    },
    body: hasBody ? body : undefined,
    cache: 'no-store',
  });
  // Yanıt ham bayt olarak iletilir: başvuru belgeleri (PDF, fotoğraf) bozulmadan konsola gelir
  const data = res.status === 204 ? null : await res.arrayBuffer();
  const pass = ['content-disposition', 'cache-control'].flatMap((k) => {
    const v = res.headers.get(k);
    return v ? [[k, v] as [string, string]] : [];
  });
  const out = new NextResponse(data, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      ...Object.fromEntries(pass),
    },
  });
  return res.status === 401 ? clearCookie(out, SESSION_COOKIE) : out;
}

export { handle as DELETE, handle as GET, handle as PATCH, handle as POST, handle as PUT };
