'use client';

import { useEffect, useState } from 'react';
import { cx } from '../../../../lib/cx';
import stil from './page.module.css';

/**
 * Ödeme kuruluşunun dönüş sayfası (PayTR merchant_ok_url / merchant_fail_url). Bu sayfaya ödeme bilgisi gelmez;
 * sonuç imzalı bildirimle API'ye ulaşır. Çerçevenin içinde açıldıysa kısa bir not gösterir (üst sayfa durumu izler),
 * doğrudan açıldıysa Haklarım'a (galeri siparişinde galeri paneline) sipariş numarasıyla döner.
 */
export default function OdemeSonucu() {
  const [hata, setHata] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setHata(q.get('hata') === '1');
    const no = q.get('siparis') ?? '';
    // Galeri siparişi (paket ve ek paket) galeri paneline döner
    if (window.top === window.self) {
      window.location.replace(
        q.get('galeri') === '1' ? `/galeri-paneli?bolum=paket&siparis=${no}` : `/haklarim?siparis=${no}`,
      );
    }
  }, []);
  return (
    <p className={cx(stil.metin1, hata ? stil.metin2 : stil.metin3)}>
      {hata ? 'Ödeme tamamlanamadı. Sepete dönüp yeniden deneyebilirsin.' : 'Ödemen işleniyor…'}
    </p>
  );
}
