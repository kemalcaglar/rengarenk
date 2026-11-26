'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cx } from '../../../../lib/cx';
import { API } from '../../../../lib/istemci';
import stil from './page.module.css';

/** Kampanya e-postasındaki "tek tıkla ayrıl" (Karar 49, 50): oturum istemez, imzalı bağlantıyla çalışır */
export default function Ayril() {
  const [durum, setDurum] = useState<'bekliyor' | 'tamam' | 'hata'>('bekliyor');
  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get('k') ?? '';
    fetch(`${API}/iletisim/ayril?k=${encodeURIComponent(k)}`, { method: 'POST' })
      .then((r) => setDurum(r.ok ? 'tamam' : 'hata'))
      .catch(() => setDurum('hata'));
  }, []);
  return (
    <main className={`rr-sayfa ${stil.kutu1}`}>
      <section className={stil.kutu2}>
        <h1 className={stil.baslik1}>Kampanya e-postaları</h1>
        <p role="status" className={cx(stil.metin1, durum === 'hata' ? stil.metin2 : stil.metin3)}>
          {durum === 'bekliyor'
            ? 'İşleniyor…'
            : durum === 'tamam'
              ? 'Kampanya ve duyuru iletilerinden ayrıldın; ticari ileti onayın geri alındı. Hesabınla ilgili işlemsel bildirimler (ödeme, mesaj, güvenlik) gelmeye devam eder.'
              : 'Bağlantı geçersiz. Tercihlerini Ayarlar › Bildirimler bölümünden değiştirebilirsin.'}
        </p>
        <p className={stil.metin4}>
          <Link href="/ayarlar?bolum=bildirim" className={stil.bag1}>
            Bildirim ayarlarına git
          </Link>
        </p>
      </section>
    </main>
  );
}
