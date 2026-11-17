'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { istek } from '../lib/istemci';
import { colors } from '../lib/renk';

interface Bildirim {
  id: string;
  ikon: string;
  tint: string;
  baslik: string;
  metin: string;
  url: string | null;
  okundu: boolean;
  zaman: string;
}

const once = (iso: string) => {
  const dk = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (dk < 1) return 'şimdi';
  if (dk < 60) return `${dk} dk`;
  if (dk < 24 * 60) return `${Math.floor(dk / 60)} sa`;
  if (dk < 48 * 60) return 'Dün';
  return `${Math.floor(dk / (24 * 60))} gün`;
};

/**
 * Üst çubuktaki zil (Karar 48; sahip isteği, 17 Kasım 2026): üzerine gelince son bildirimler açılır (okunmamışlar
 * vurgulu); bildirime tıklayınca okundu sayılır ve ilgili sayfa açılır. Zile tıklamak Bildirimler sayfasına götürür
 * (dokunmatikte ve klavyede de). Esc ve dışarı tıklama paneli kapatır.
 */
export function BildirimAcilir({ okunmamis }: { okunmamis: number }) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [liste, setListe] = useState<Bildirim[] | null>(null);
  const kutu = useRef<HTMLDivElement>(null);
  const kapat = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Panel açılınca (ve açıkken sayı değişince) son bildirimler yeniden okunur
  useEffect(() => {
    if (!acik || okunmamis < 0) return;
    istek<{ bildirimler: Bildirim[] }>('/notifications')
      .then((r) => setListe(r.bildirimler.slice(0, 6)))
      .catch(() => setListe([]));
  }, [acik, okunmamis]);

  useEffect(() => {
    if (!acik) return;
    const disari = (e: PointerEvent) => {
      if (!kutu.current?.contains(e.target as Node)) setAcik(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAcik(false);
    };
    document.addEventListener('pointerdown', disari);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', disari);
      document.removeEventListener('keydown', esc);
    };
  }, [acik]);

  const gir = () => {
    if (kapat.current) clearTimeout(kapat.current);
    setAcik(true);
  };
  // Fare zilden panele geçerken kapanmasın diye kısa gecikme
  const cik = () => {
    kapat.current = setTimeout(() => setAcik(false), 180);
  };

  async function ac(b: Bildirim) {
    setAcik(false);
    if (!b.okundu)
      await istek('/notifications/read', { method: 'POST', body: { ids: [b.id] } }).catch(() => undefined);
    window.dispatchEvent(new Event('rr-bildirim'));
    router.push(b.url ?? '/bildirimler');
  }

  async function hepsiOkundu() {
    await istek('/notifications/read', { method: 'POST', body: { hepsi: true } }).catch(() => undefined);
    window.dispatchEvent(new Event('rr-bildirim'));
    setListe((l) => l?.map((b) => ({ ...b, okundu: true })) ?? null);
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: üzerine gelme yalnızca kolaylık; zil bağlantısı klavyeyle de çalışır
    <div ref={kutu} style={{ position: 'relative' }} onMouseEnter={gir} onMouseLeave={cik}>
      <Link
        href="/bildirimler"
        aria-label={`Bildirimler, ${okunmamis} okunmamış`}
        aria-haspopup="true"
        aria-expanded={acik}
        onFocus={gir}
        style={{
          position: 'relative',
          width: 40,
          height: 40,
          borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--rr-ust-yazi)',
          background: acik ? 'color-mix(in srgb, var(--rr-ust-yazi) 7%, transparent)' : 'transparent',
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
        {okunmamis > 0 ? (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 3,
              right: 2,
              minWidth: 18,
              height: 18,
              borderRadius: 'calc(var(--rr-buton-kose) * 9 / 14)',
              background: colors.pink,
              color: 'var(--rr-pembeYazi, #1E2333)',
              fontSize: 11,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {okunmamis > 99 ? '99+' : okunmamis}
          </span>
        ) : null}
      </Link>
      {acik ? (
        // Üst boşluk zil ile panel arasında fareyi kaybetmemek için (paddingTop)
        <div style={{ position: 'absolute', right: -60, top: '100%', paddingTop: 6, zIndex: 50 }}>
          <section
            aria-label="Son bildirimler"
            style={{
              width: 360,
              maxWidth: 'calc(100vw - 24px)',
              background: colors.surface,
              border: `1px solid ${colors.line}`,
              borderRadius: 'var(--rr-buton-kose)',
              boxShadow: '0 12px 32px rgba(30,35,51,0.14)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderBottom: `1px solid ${colors.line}`,
              }}
            >
              <strong style={{ fontSize: 15 }}>
                Bildirimler{okunmamis > 0 ? ` · ${okunmamis} yeni` : ''}
              </strong>
              {okunmamis > 0 ? (
                <button
                  type="button"
                  onClick={hepsiOkundu}
                  style={{
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: colors.link,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Tümünü okundu say
                </button>
              ) : null}
            </div>
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {liste === null ? (
                <p style={{ margin: 0, padding: 16, fontSize: 13.5, color: colors.muted }}>Yükleniyor…</p>
              ) : liste.length === 0 ? (
                <p style={{ margin: 0, padding: 16, fontSize: 13.5, color: colors.muted }}>
                  Henüz bildirimin yok.
                </p>
              ) : (
                liste.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => ac(b)}
                    style={{
                      display: 'flex',
                      width: '100%',
                      textAlign: 'left',
                      gap: 10,
                      padding: '11px 14px',
                      border: 0,
                      borderBottom: `1px solid ${colors.line}`,
                      background: b.okundu
                        ? colors.surface
                        : 'color-mix(in srgb, var(--rr-mavi, #5B8CFF) 6%, var(--rr-kart, #FFFFFF))',
                      color: colors.ink,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        flex: 'none',
                        width: 34,
                        height: 34,
                        borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
                        background: b.tint,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                      }}
                    >
                      {b.ikon}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: b.okundu ? 700 : 800 }}>
                          {b.baslik}
                          {b.okundu ? null : <span className="sr-only"> (okunmadı)</span>}
                        </span>
                        <span style={{ flex: 'none', fontSize: 11, color: colors.muted }}>
                          {once(b.zaman)}
                        </span>
                      </span>
                      <span
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          fontSize: 12.5,
                          color: colors.muted,
                          marginTop: 2,
                          lineHeight: 1.4,
                        }}
                      >
                        {b.metin}
                      </span>
                    </span>
                    {b.okundu ? null : (
                      <span
                        aria-hidden="true"
                        style={{
                          flex: 'none',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: colors.blue,
                          marginTop: 6,
                        }}
                      />
                    )}
                  </button>
                ))
              )}
            </div>
            <Link
              href="/bildirimler"
              onClick={() => setAcik(false)}
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '11px 14px',
                fontSize: 13.5,
                fontWeight: 700,
                color: colors.link,
                textDecoration: 'none',
              }}
            >
              Tüm bildirimleri gör
            </Link>
          </section>
        </div>
      ) : null}
    </div>
  );
}
