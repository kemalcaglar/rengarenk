import type { ClientFlags } from '@rengarenk/shared';
import { useEffect, useState } from 'react';

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Bakım durumu ve duyuru (T13). Uygulama açıkken dakikada bir yenilenir; API'ye ulaşılamazsa yok sayılır. */
export function useClientFlags(): ClientFlags | null {
  const [flags, setFlags] = useState<ClientFlags | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`${API}/flags`, {
        headers: { 'x-rr-platform': process.env.EXPO_OS === 'android' ? 'ANDROID' : 'IOS' },
      })
        .then((r) => (r.ok ? (r.json() as Promise<ClientFlags>) : null))
        .then((f) => alive && setFlags(f))
        .catch(() => undefined);
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return flags;
}
