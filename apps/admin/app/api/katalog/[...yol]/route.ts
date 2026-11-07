import { type NextRequest, NextResponse } from 'next/server';
import { API, forwardHeaders } from '../../../../lib/oturum';

/** Katalog okuma uçlarına köprü (yalnızca GET, giriş gerekmez): /api/katalog/<yol> → API /catalog/<yol> */
export async function GET(req: NextRequest, ctx: { params: Promise<{ yol: string[] }> }) {
  const { yol } = await ctx.params;
  const res = await fetch(`${API}/catalog/${yol.map(encodeURIComponent).join('/')}${req.nextUrl.search}`, {
    headers: forwardHeaders(req.headers),
    cache: 'no-store',
  });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
