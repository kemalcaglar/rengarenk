import type { NextRequest } from 'next/server';
import { api, relayTokens } from '../../../../lib/oturum';

/** Destekten gelen giriş bağlantısı (Karar 52): kod API'de doğrulanır, yenileme jetonu httpOnly çereze yazılır. */
export async function POST(req: NextRequest) {
  const { kod } = (await req.json().catch(() => ({}))) as { kod?: string };
  return relayTokens(await api(req, '/auth/link/verify', { kod }));
}
