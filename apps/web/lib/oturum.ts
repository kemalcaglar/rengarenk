import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Web oturumu: yenileme jetonu tarayıcıda JavaScript'in okuyamadığı (httpOnly) bir çerezde durur;
 * erişim jetonu yalnızca bellekte tutulur ve 15 dakikada bir bu uç noktalardan yenilenir.
 */
export const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const COOKIE = 'rr_yenileme';
const MAX_AGE = 90 * 24 * 60 * 60; // T09

/** API'ye istemcinin gerçek IP'siyle gider (hız sınırı ve işlem kaydı için). */
export async function api(req: NextRequest, path: string, body: unknown, token?: string) {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  return fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(fwd ? { 'x-forwarded-for': fwd } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
}

export function withRefreshCookie(res: NextResponse, refreshToken: string | null) {
  res.cookies.set(COOKIE, refreshToken ?? '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/oturum',
    maxAge: refreshToken ? MAX_AGE : 0,
  });
  return res;
}

type Tokens = { accessToken: string; refreshToken: string; expiresIn: number; isNewUser?: boolean };

/** API yanıtını tarayıcıya çevirir: yenileme jetonu çereze, erişim jetonu gövdeye. */
export async function relayTokens(apiRes: Response) {
  const data = (await apiRes.json().catch(() => ({}))) as Partial<Tokens> & { message?: string };
  if (!apiRes.ok || !data.refreshToken) {
    const res = NextResponse.json(
      { message: data.message ?? 'Oturum açılamadı' },
      { status: apiRes.ok ? 500 : apiRes.status },
    );
    return apiRes.status === 401 ? withRefreshCookie(res, null) : res;
  }
  const res = NextResponse.json({
    accessToken: data.accessToken,
    expiresIn: data.expiresIn,
    isNewUser: data.isNewUser,
  });
  return withRefreshCookie(res, data.refreshToken);
}
