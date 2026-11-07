import type { ClientFlags } from '@rengarenk/shared';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Bakım durumu ve duyuru (T13, tasarım: YonetimSistem › Bakım modu). 15 saniyede bir yenilenir;
 * API'ye ulaşılamazsa site normal açılır.
 */
export async function getClientFlags(): Promise<ClientFlags | null> {
  try {
    const r = await fetch(`${API}/flags`, {
      headers: { 'x-rr-platform': 'WEB' },
      next: { revalidate: 15 },
      signal: AbortSignal.timeout(2000),
    });
    return r.ok ? ((await r.json()) as ClientFlags) : null;
  } catch {
    return null;
  }
}
