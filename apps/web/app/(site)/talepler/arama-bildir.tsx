'use client';

import { useEffect } from 'react';
import { istek } from '../../../lib/istemci';

/**
 * Arama günlüğü (Raporlar › En çok aranan modeller): kullanıcının yaptığı aramanın ilk sayfası bir kez bildirilir.
 * Liste sunucuda çekildiği için sayım tarayıcıdan gelir; sunucu marka ve seriyi ya da metinden bulunan modeli sayar.
 */
export function AramaBildir({ sorgu }: { sorgu: Record<string, string | string[] | undefined> }) {
  const anahtar = JSON.stringify(sorgu);
  useEffect(() => {
    const q = JSON.parse(anahtar) as Record<string, string | string[] | undefined>;
    if ((q.sayfa && q.sayfa !== '1') || !(q.marka || q.q)) return;
    const { kategori, marka, seri, q: metin } = q;
    istek('/talepler/arama', { method: 'POST', body: { kategori, marka, seri, q: metin } }).catch(
      () => undefined,
    );
  }, [anahtar]);
  return null;
}
