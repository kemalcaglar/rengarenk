'use client';

import { useEffect, useState } from 'react';
import { API, erisim, istek } from './istemci';

let onbellek: Promise<Record<string, number> | null> | null = null;

/** Herkese açık liste fiyatları */
const liste = () =>
  fetch(`${API}/fiyatlar`)
    .then((r) => (r.ok ? (r.json() as Promise<{ urunler: Record<string, number> }>) : null))
    .then((d) => d?.urunler ?? null)
    .catch(() => null);

/**
 * Yürürlükteki web fiyatları (Kurallar ve fiyatlar, Karar 56): sayfa başına bir kez okunur; yanıt gelene kadar ya da
 * ulaşılamazsa koddaki başlangıç fiyatı gösterilir. Girişli kullanıcı kendi fiyatını alır (`/orders/fiyatlar`): süren
 * bir fiyat deneyinde kolundaki fiyat sihirbazda, Taleplerim'de ve ödemede aynıdır. Ödenen tutarı her zaman API
 * hesaplar.
 */
export function useWebFiyat() {
  const [urunler, setUrunler] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    onbellek ??= erisim()
      .catch(() => null)
      .then((token) =>
        token
          ? istek<{ urunler: Record<string, number> }>('/orders/fiyatlar')
              .then((d) => d.urunler)
              .catch(() => liste())
          : liste(),
      );
    onbellek.then(setUrunler);
  }, []);
  return (urun: string, yedek: number) => urunler?.[urun] ?? yedek;
}
