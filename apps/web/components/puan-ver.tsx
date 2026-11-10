'use client';

import { RATING_LABELS } from '@rengarenk/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { istek } from '../lib/istemci';

/**
 * Yıldız ver (Karar 55; tasarım: MesajlarMobil.dc.html › puan penceresi). Yalnızca yıldız verilir, yorum yazılmaz;
 * puan satıcıya isimsiz gider. Gönderince "Teşekkürler" ve "Aracı buldum" bağlantısı.
 */
export function PuanVer({
  sohbet,
  ad,
  bas,
  alt,
  kapat,
  verildi,
}: {
  sohbet: string;
  ad: string;
  bas: string;
  alt: string;
  kapat: () => void;
  verildi: (yildiz: number) => void;
}) {
  const [yildiz, setYildiz] = useState(0);
  const [tamam, setTamam] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && kapat();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [kapat]);

  async function gonder() {
    if (!yildiz) return;
    setMesgul(true);
    setHata(null);
    try {
      await istek(`/conversations/${sohbet}/rating`, { method: 'POST', body: { yildiz } });
      setTamam(true);
      verildi(yildiz);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(30,35,51,0.45)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="puan-baslik"
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--rr-kart, #FFFFFF)',
          borderRadius: 'calc(var(--rr-kart-kose) * 24 / 18)',
          padding: '20px 20px 24px',
        }}
      >
        {!tamam ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                aria-hidden="true"
                style={{
                  flex: 'none',
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: '#FFF6DF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 800,
                }}
              >
                {bas}
              </span>
              <span>
                <h2 id="puan-baslik" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  {ad} nasıldı?
                </h2>
                <span
                  style={{
                    display: 'block',
                    fontSize: 12.5,
                    color: 'var(--rr-soluk, #5A6073)',
                    marginTop: 2,
                  }}
                >
                  {alt}
                </span>
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label="Puan, 5 üzerinden"
              style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '22px 0 6px' }}
            >
              {[1, 2, 3, 4, 5].map((n) => {
                const on = n <= yildiz;
                return (
                  // biome-ignore lint/a11y/useSemanticElements: tasarımdaki yıldız düğmeleri radyo grubu olarak işaretli
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={n === yildiz}
                    aria-label={`${n} yıldız, ${RATING_LABELS[n]}`}
                    onClick={() => setYildiz(n)}
                    style={{
                      width: 54,
                      height: 54,
                      border: 0,
                      borderRadius: 'var(--rr-buton-kose)',
                      background: on ? '#FFF6DF' : 'var(--rr-zemin, #F6F8FD)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
                        style={{ fill: on ? 'var(--rr-sari, #FFC84A)' : '#FFFFFF' }}
                        stroke={on ? '#B07A00' : '#AEB5C4'}
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                );
              })}
            </div>
            <p style={{ margin: 0, textAlign: 'center', fontSize: 14.5, fontWeight: 800, minHeight: 20 }}>
              {RATING_LABELS[yildiz]}
            </p>
            <div
              style={{
                marginTop: 16,
                background: 'var(--rr-zemin, #F6F8FD)',
                borderRadius: 'var(--rr-buton-kose)',
                padding: '12px 14px',
                fontSize: 12.5,
                color: '#3A4052',
                lineHeight: 1.5,
              }}
            >
              Yalnızca yıldız verilir, yorum yazılmaz. Puanın satıcıya isimsiz gider; profilinde tek tek puan
              değil, <strong>Güvenilir satıcı</strong> ve <strong>Hızlı yanıt</strong> gibi rozetler görünür.
            </div>
            {hata ? (
              <p role="alert" style={{ margin: '10px 0 0', fontSize: 13, color: '#A3271F' }}>
                {hata}
              </p>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={kapat}
                style={{
                  border: '1px solid #D5DAE5',
                  background: 'var(--rr-kart, #FFFFFF)',
                  borderRadius: 'var(--rr-buton-kose)',
                  padding: '14px 8px',
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--rr-murekkep, #1E2333)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Sonra
              </button>
              <button
                type="button"
                aria-disabled={!yildiz || mesgul}
                onClick={gonder}
                style={{
                  border: 0,
                  background: yildiz ? 'var(--rr-mavi, #5B8CFF)' : 'var(--rr-cizgi, #E3E6EF)',
                  borderRadius: 'var(--rr-buton-kose)',
                  padding: '15px 8px',
                  fontSize: 15.5,
                  fontWeight: 800,
                  color: yildiz ? 'var(--rr-maviYazi, #1E2333)' : 'var(--rr-soluk, #5A6073)',
                  cursor: yildiz ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                }}
              >
                Puanı gönder
              </button>
            </div>
            <span
              title="Şikâyet moderasyonla birlikte açılacak"
              style={{
                display: 'block',
                textAlign: 'center',
                marginTop: 12,
                fontSize: 13,
                fontWeight: 700,
                color: '#8A91A3',
              }}
            >
              Bir sorun mu yaşadın? Şikayet et
            </span>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
            <span
              aria-hidden="true"
              style={{
                display: 'inline-flex',
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#E7FAF0',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                aria-hidden="true"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#11683F"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12l5 5 9-10" />
              </svg>
            </span>
            <h2 style={{ margin: '12px 0 4px', fontSize: 18, fontWeight: 800 }}>Teşekkürler</h2>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--rr-soluk, #5A6073)' }}>
              Puanın kaydedildi. Aracı bulduysan talebini kapatabilirsin; satıcılar sana yazmayı bırakır.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 18 }}>
              <button
                type="button"
                onClick={kapat}
                style={{
                  border: '1px solid #D5DAE5',
                  background: 'var(--rr-kart, #FFFFFF)',
                  borderRadius: 'var(--rr-buton-kose)',
                  padding: '14px 8px',
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: 'var(--rr-murekkep, #1E2333)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Kapat
              </button>
              <Link
                href="/taleplerim"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  borderRadius: 'var(--rr-buton-kose)',
                  padding: '14px 8px',
                  fontSize: 14.5,
                  fontWeight: 800,
                  color: 'var(--rr-yesilYazi, #1E2333)',
                  background: 'var(--rr-yesil, #3DD68C)',
                  textDecoration: 'none',
                }}
              >
                Aracı buldum
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
