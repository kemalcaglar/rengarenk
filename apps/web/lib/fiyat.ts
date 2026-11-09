'use client';

import { useEffect, useState } from 'react';
import { API } from './istemci';

let onbellek: Promise<Record<string, number> | null> | null = null;

/**
 * Yürürlükteki web fiyatları (Kurallar ve fiyatlar, Karar 56): `GET /fiyatlar` sayfa başına bir kez okunur; yanıt
 * gelene kadar ya da ulaşılamazsa koddaki başlangıç fiyatı gösterilir. Ödenen tutarı her zaman API hesaplar.
 */
export function useWebFiyat() {
  const [urunler, setUrunler] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    onbellek ??= fetch(`${API}/fiyatlar`)
      .then((r) => (r.ok ? (r.json() as Promise<{ urunler: Record<string, number> }>) : null))
      .then((d) => d?.urunler ?? null)
      .catch(() => null);
    onbellek.then(setUrunler);
  }, []);
  return (urun: string, yedek: number) => urunler?.[urun] ?? yedek;
}
