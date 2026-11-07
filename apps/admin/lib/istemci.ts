/** Tarayıcıdan konsol API köprüsüne (/api/yonetim) istek. Oturum kapanırsa giriş sayfasına döner. */
export async function yonetim<T = unknown>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/yonetim/${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'x-rr-istek': '1',
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  window.dispatchEvent(new Event('rr-etkinlik'));
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.status === 401) {
    const text = (data as { message?: string } | null)?.message ?? 'Oturumun kapandı, yeniden giriş yap';
    window.location.href = `/giris?hata=${encodeURIComponent(text)}`;
    throw new Error(text);
  }
  if (!res.ok) {
    const m = (data as { message?: string | string[]; issues?: { message: string }[] } | null) ?? {};
    const text = m.issues?.[0]?.message ?? (Array.isArray(m.message) ? m.message[0] : m.message);
    throw new Error(text ?? 'İşlem yapılamadı');
  }
  return data as T;
}

export const tarih = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat('tr-TR', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Istanbul',
      }).format(new Date(iso))
    : '—';

export const bas = (ad: string) =>
  ad
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase('tr-TR'))
    .join('');
