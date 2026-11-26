'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { istek } from '../../../lib/istemci';
import stil from './page.module.css';

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
    <main className={`rr-sayfa ${stil.kutu1}`}>
      <section className={stil.kutu2}>
        <h1 className={stil.baslik1}>E-posta doğrulama</h1>
        <p
          role={durum === 'hata' ? 'alert' : 'status'}
          className={stil.metin1}
          style={{
            color: durum === 'hata' ? '#A3271F' : durum === 'tamam' ? '#11683F' : 'var(--rr-soluk, #5A6073)',
          }}
        >
          {durum === 'bekliyor' ? 'Doğrulanıyor…' : mesaj}
        </p>
        <p className={stil.metin2}>
          <Link href="/ayarlar?bolum=bildirim" className={stil.bag1}>
            Bildirim ayarlarına git
          </Link>
        </p>
      </section>
    </main>
  );
}
