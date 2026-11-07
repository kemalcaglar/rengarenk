import type { NextRequest } from 'next/server';
import { api, relayTokens } from '../../../../lib/oturum';

export async function POST(req: NextRequest) {
  const { challengeId, code } = (await req.json().catch(() => ({}))) as {
    challengeId?: string;
    code?: string;
  };
  return relayTokens(await api(req, '/auth/otp/verify', { challengeId, code, platform: 'WEB' }));
}
