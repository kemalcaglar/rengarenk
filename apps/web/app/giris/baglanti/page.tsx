'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import stil from './page.module.css';

/**
 * Giriş bağlantısı (Karar 52): destek ekibinin kişinin doğrulanmış e-postasına gönderdiği tek kullanımlık bağlantı.
 * Kod, web sunucusundaki oturum rotasından API'ye gider; yenileme jetonu httpOnly çereze yazılır. Girişten sonra
 * kişi numarasını Ayarlar › Profil'den değiştirebilir.
 */
export default function GirisBaglantisi() {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const bir = useRef(false);

  useEffect(() => {
    // Bağlantı bir kez kullanılır: geliştirmede iki kez çalışan efekt ikinci isteği göndermesin
    if (bir.current) return;
    bir.current = true;
    const kod = new URLSearchParams(window.location.search).get('k') ?? '';
    // Kod adres çubuğunda ve geçmişte kalmasın
    window.history.replaceState(null, '', '/giris/baglanti');
    fetch('/api/oturum/baglanti', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kod }),
    })
      .then(async (r) => {
        if (r.ok) {
          router.replace('/ayarlar?bolum=profil');
          return;
        }
        const d = (await r.json().catch(() => ({}))) as { message?: string };
        // Bozuk ya da eksik kopyalanmış bağlantı da süresi dolmuş gibi anlatılır
        setHata(
          r.status === 400 || !d.message
            ? 'Bağlantının süresi dolmuş ya da kullanılmış. Destek ekibimizden yenisini iste.'
            : d.message,
        );
      })
      .catch(() => setHata('Bağlantı açılamadı; internet bağlantını kontrol et.'));
  }, [router]);

  return (
    <main className={`rr-sayfa ${stil.kutu1}`}>
      <section className={stil.kutu2} aria-live="polite">
        <h1 className={stil.baslik1}>{hata ? 'Bağlantı açılamadı' : 'Giriş yapılıyor…'}</h1>
        {hata ? (
          <>
            <p role="alert" className={stil.metin1}>
              {hata}
            </p>
            <Link href="/giris" className={stil.bag1}>
              Telefonla giriş yap
            </Link>
            <p className={stil.metin2}>
              Telefonuna ulaşamıyorsan{' '}
              <Link href="/yardim" className={stil.bag2}>
                destek ekibimize yaz
              </Link>
              .
            </p>
          </>
        ) : (
          <p className={stil.metin3}>
            Destek ekibimizin gönderdiği bağlantıyı doğruluyoruz. Girdikten sonra numaranı Ayarlar › Profil
            bölümünden değiştirebilirsin.
          </p>
        )}
      </section>
    </main>
  );
}
