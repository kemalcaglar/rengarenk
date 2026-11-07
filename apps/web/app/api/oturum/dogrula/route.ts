import type { NextRequest } from 'next/server';
import { api, relayTokens } from '../../../../lib/oturum';

/** Kod doğrulama; üyelik onayları (Karar 59) API'ye olduğu gibi iletilir, API doğrular ve kaydeder. */
export async function POST(req: NextRequest) {
  const { challengeId, code, consents } = (await req.json().catch(() => ({}))) as {
    challengeId?: string;
    code?: string;
    consents?: unknown;
  };
  return relayTokens(await api(req, '/auth/otp/verify', { challengeId, code, platform: 'WEB', consents }));
}
