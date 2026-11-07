import type { PermissionGrants } from '@rengarenk/shared';
import { cookies, headers } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';

/**
 * Yönetim oturumu (T10, Karar 40). Oturum jetonu yalnızca httpOnly çerezde durur; tarayıcıdaki
 * kod jetonu hiç görmez. Konsolun sunucu tarafı API'ye jetonu yetki başlığıyla iletir.
 */
export const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const SESSION_COOKIE = 'rr_yonetim';
/** Google adımından sonra, iki adımlı doğrulama bitene kadar geçerli bilet */
export const TICKET_COOKIE = 'rr_giris';
/** Google'a giderken üretilen state; dönüşte eşleşmezse giriş reddedilir (giriş sahteciliğine karşı) */
export const STATE_COOKIE = 'rr_giris_durum';
/** Tarayıcı kimliği: yeni cihazdan girişi fark etmek için (Karar 40) */
export const DEVICE_COOKIE = 'rr_cihaz';

const secure = process.env.NODE_ENV === 'production';
export const cookieBase = { httpOnly: true, secure, sameSite: 'lax' as const };

export interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
  roleName: string;
  permissions: PermissionGrants;
  approverOf: string[];
  pendingApprovals: number;
  idleMinutes: number;
}

/** İstemcinin IP ve tarayıcı bilgisini API'ye taşır (hız sınırı, işlem kaydı, cihaz). */
export function forwardHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const fwd = h.get('x-forwarded-for');
  const ua = h.get('user-agent');
  if (fwd) out['x-forwarded-for'] = fwd;
  if (ua) out['user-agent'] = ua;
  return out;
}

export function apiFetch(
  path: string,
  opts: { method?: string; body?: unknown; token?: string; headers?: Headers } = {},
) {
  return fetch(`${API}${path}`, {
    method: opts.method ?? 'POST',
    headers: {
      ...(opts.headers ? forwardHeaders(opts.headers) : {}),
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: 'no-store',
  });
}

/** Sunucu bileşenleri için: oturum açıksa çalışanın bilgisi, değilse null. */
export async function getMe(): Promise<Me | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // API'ye ulaşılamazsa (açılıyor ya da kapalı) sayfa çökmez; oturum yokmuş gibi girişe yönlenir.
  const res = await apiFetch('/staff/me', { method: 'GET', token, headers: await headers() }).catch(
    () => null,
  );
  if (!res) return null;
  if (!res.ok) return null;
  return (await res.json()) as Me;
}

export async function message(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  return (Array.isArray(data.message) ? data.message[0] : data.message) ?? fallback;
}

export function clearCookie(res: NextResponse, name: string, path = '/') {
  res.cookies.set(name, '', { ...cookieBase, path, maxAge: 0 });
  return res;
}

export function originOk(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  return !origin || origin === req.nextUrl.origin;
}
