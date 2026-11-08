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
    // yalnızca harfle başlayan sözcükler: "Sahip (geliştirme)" → "S"
    .filter((p) => /^\p{L}/u.test(p))
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase('tr-TR'))
    .join('');

/** Tasarımdaki göreli zaman: "bugün 22:58", "dün 18:20", "2 Kas 04:00" (İstanbul saati) */
export const goreli = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const tz = { timeZone: 'Europe/Istanbul' } as const;
  const gun = (x: Date) => new Intl.DateTimeFormat('tr-TR', { ...tz, dateStyle: 'short' }).format(x);
  const saat = new Intl.DateTimeFormat('tr-TR', { ...tz, hour: '2-digit', minute: '2-digit' }).format(d);
  const now = new Date();
  if (gun(d) === gun(now)) return `bugün ${saat}`;
  if (gun(d) === gun(new Date(now.getTime() - 86_400_000))) return `dün ${saat}`;
  return `${new Intl.DateTimeFormat('tr-TR', { ...tz, day: 'numeric', month: 'short' }).format(d)} ${saat}`;
};

/** Onay kuyruğundaki zaman: "az önce", "10 dk önce", "1 saat önce", "Dün", "3 gün önce", sonra tarih */
export const once = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const dk = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (dk < 1) return 'az önce';
  if (dk < 60) return `${dk} dk önce`;
  if (dk < 24 * 60) return `${Math.floor(dk / 60)} saat önce`;
  const gun = Math.floor(dk / (24 * 60));
  if (gun === 1) return 'Dün';
  if (gun < 7) return `${gun} gün önce`;
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
};

/** Tasarımdaki gün ve saat: "Bugün 14:48", "Dün 18:20", daha eskisi "2 Kas 04:00" */
export const gunSaat = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const g = goreli(iso);
  return g.charAt(0).toLocaleUpperCase('tr-TR') + g.slice(1);
};
