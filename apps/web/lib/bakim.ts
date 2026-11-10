import { type ClientFlags, DEFAULT_DESIGN, fontCssUrl, type PublicDesign } from '@rengarenk/shared';

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

/**
 * Yayındaki tasarım değerleri (Karar 46): renkler, yazı tipi, köşeler ve geçerli mevsimsel tema. Dakikada bir yenilenir;
 * API'ye ulaşılamazsa varsayılan değerler.
 */
export async function getDesign(): Promise<PublicDesign> {
  try {
    const r = await fetch(`${API}/tasarim`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(2000) });
    if (r.ok) return (await r.json()) as PublicDesign;
  } catch {
    // varsayılana düşer
  }
  return {
    surum: 0,
    degerler: DEFAULT_DESIGN,
    tema: null,
    font: { ad: DEFAULT_DESIGN.yaziTipi, css: fontCssUrl(DEFAULT_DESIGN.yaziTipi), dosyalar: {} },
  };
}
