'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { etiketleriYukle, sayfaGoruntulendi, temasGonder, temasYakala } from '../lib/olcum';

/**
 * Reklam ölçümü (Karar 35): izin varsa etiketleri yükler; her sayfada temas yakalar ve sayfa görüntülemeyi bildirir.
 * İzin yoksa hiçbir dış betik yüklenmez.
 */
export function Olcum() {
  const yol = usePathname();
  useEffect(() => {
    etiketleriYukle();
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: her yön değişiminde
  useEffect(() => {
    if (temasYakala()) void temasGonder();
    sayfaGoruntulendi();
  }, [yol]);
  return null;
}
