import { type NextRequest, NextResponse } from 'next/server';
import { api, COOKIE, relayTokens } from '../../../../lib/oturum';

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(COOKIE)?.value;
  if (!refreshToken) return NextResponse.json({ message: 'Oturum yok' }, { status: 401 });
  return relayTokens(await api(req, '/auth/refresh', { refreshToken }));
}
