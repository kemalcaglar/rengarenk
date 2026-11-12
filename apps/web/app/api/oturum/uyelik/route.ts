import type { NextRequest } from 'next/server';
import { api, relayTokens } from '../../../../lib/oturum';

/** Üye ol, 2. adım (Karar 18): telefona gelen kod doğrulanınca hesap açılır ve oturum başlar. */
export async function POST(req: NextRequest) {
  const { challengeId, code } = (await req.json().catch(() => ({}))) as {
    challengeId?: string;
    code?: string;
  };
  return relayTokens(await api(req, '/auth/register/verify', { challengeId, code }));
}
