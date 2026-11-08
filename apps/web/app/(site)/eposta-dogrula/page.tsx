'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { istek } from '../../../lib/istemci';

/** E-postadaki doğrulama bağlantısı (Karar 48): kod tek kullanımlıktır, oturum istemez */
export default function EpostaDogrula() {
  const [durum, setDurum] = useState<'bekliyor' | 'tamam' | 'hata'>('bekliyor');
  const [mesaj, setMesaj] = useState('');
  useEffect(() => {
    const kod = new URLSearchParams(window.location.search).get('kod') ?? '';
    istek<{ adres: string }>('/eposta/dogrula', { method: 'POST', body: { kod } })
      .then((r) => {
        setDurum('tamam');
        setMesaj(`${r.adres} doğrulandı. Bildirim e-postaları artık bu adrese gelecek.`);
      })
      .catch((e: Error) => {
        setDurum('hata');
        setMesaj(e.message);
      });
  }, []);
  return (
    <main style={{ maxWidth: 560, margin: '48px auto', padding: '0 24px' }}>
      <section style={{ background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18, padding: 24 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>E-posta doğrulama</h1>
        <p
          role={durum === 'hata' ? 'alert' : 'status'}
          style={{
            margin: 0,
            fontSize: 15,
            color: durum === 'hata' ? '#A3271F' : durum === 'tamam' ? '#11683F' : '#5A6073',
          }}
        >
          {durum === 'bekliyor' ? 'Doğrulanıyor…' : mesaj}
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
