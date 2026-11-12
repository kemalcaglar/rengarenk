import type { NextRequest } from 'next/server';
import { api, relayTokens } from '../../../../lib/oturum';

/** E-posta ve şifreyle giriş (Karar 18): yenileme jetonu httpOnly çereze yazılır. */
export async function POST(req: NextRequest) {
  const { eposta, sifre } = (await req.json().catch(() => ({}))) as { eposta?: string; sifre?: string };
  return relayTokens(await api(req, '/auth/login', { eposta, sifre, platform: 'WEB' }));
}
