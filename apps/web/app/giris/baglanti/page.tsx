'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { colors } from '../../../lib/renk';

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
    <main
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 16px',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 460,
          background: colors.surface,
          border: `1px solid ${colors.line}`,
          borderRadius: 20,
          padding: 28,
        }}
        aria-live="polite"
      >
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800 }}>
          {hata ? 'Bağlantı açılamadı' : 'Giriş yapılıyor…'}
        </h1>
        {hata ? (
          <>
            <p role="alert" style={{ margin: '0 0 18px', fontSize: 14.5, color: '#A3271F', fontWeight: 700 }}>
              {hata}
            </p>
            <Link
              href="/giris"
              style={{
                display: 'inline-block',
                background: 'var(--rr-mavi, #5B8CFF)',
                color: 'var(--rr-murekkep, #1E2333)',
                borderRadius: 'var(--rr-buton-kose)',
                padding: '12px 20px',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              Telefonla giriş yap
            </Link>
            <p style={{ margin: '14px 0 0', fontSize: 13.5, color: '#5A6073' }}>
              Telefonuna ulaşamıyorsan{' '}
              <Link href="/yardim" style={{ color: 'var(--rr-baglanti, #2450C8)', fontWeight: 700 }}>
                destek ekibimize yaz
              </Link>
              .
            </p>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 14.5, color: '#5A6073' }}>
            Destek ekibimizin gönderdiği bağlantıyı doğruluyoruz. Girdikten sonra numaranı Ayarlar › Profil
            bölümünden değiştirebilirsin.
          </p>
        )}
      </section>
    </main>
  );
}
