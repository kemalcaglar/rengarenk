import { type NextRequest, NextResponse } from 'next/server';
import { api, withRefreshCookie } from '../../../../lib/oturum';

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (token) await api(req, '/auth/logout', undefined, token).catch(() => undefined);
  return withRefreshCookie(new NextResponse(null, { status: 204 }), null);
}
