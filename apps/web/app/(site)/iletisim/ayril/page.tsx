'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { API } from '../../../../lib/istemci';

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
    <main style={{ maxWidth: 560, margin: '48px auto', padding: '0 24px' }}>
      <section
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--rr-cizgi, #E3E6EF)',
          borderRadius: 'var(--rr-kart-kose)',
          padding: 24,
        }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>Kampanya e-postaları</h1>
        <p role="status" style={{ margin: 0, fontSize: 15, color: durum === 'hata' ? '#A3271F' : '#11683F' }}>
          {durum === 'bekliyor'
            ? 'İşleniyor…'
            : durum === 'tamam'
              ? 'Kampanya ve duyuru iletilerinden ayrıldın; ticari ileti onayın geri alındı. Hesabınla ilgili işlemsel bildirimler (ödeme, mesaj, güvenlik) gelmeye devam eder.'
              : 'Bağlantı geçersiz. Tercihlerini Ayarlar › Bildirimler bölümünden değiştirebilirsin.'}
        </p>
        <p style={{ margin: '16px 0 0' }}>
          <Link href="/ayarlar?bolum=bildirim" style={{ fontWeight: 700 }}>
            Bildirim ayarlarına git
          </Link>
        </p>
      </section>
    </main>
  );
}
