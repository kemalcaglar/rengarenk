'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useCanli } from '../lib/canli';
import { cikisYap, istek, useGiris } from '../lib/istemci';
import { colors } from '../lib/renk';
import { OGELER } from './hesabim-menu';

interface Ben {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

/**
 * Üst çubuğun hesap bölümü: girişliyse zil, avatar ve ad (üzerine gelince ya da tıklayınca Hesabım menüsü ve "Çıkış
 * yap"), değilse "Giriş yap"; ve "Talep oluştur". Oturuma bakılırken yer tutucu gösterilir ("Giriş yap" yanıp sönmez).
 */
export function HesapMenusu() {
  const giris = useGiris();
  const [ben, setBen] = useState<Ben | null>(null);
  useEffect(() => {
    if (giris)
      istek<Ben>('/me')
        .then(setBen)
        // Profil okunamazsa da girişli görünür
        .catch(() => setBen({ firstName: null, lastName: null, displayName: null }));
  }, [giris]);
  const ad = ben
    ? [ben.firstName, ben.lastName].filter(Boolean).join(' ') || ben.displayName || 'Hesabım'
    : null;
  const bas =
    ad
      ?.split(/\s+/)
      .filter((p) => /^\p{L}/u.test(p))
      .slice(0, 2)
      .map((p) => p.charAt(0).toLocaleUpperCase('tr-TR'))
      .join('') || '?';
  // Zil (Karar 48): okunmamış bildirim sayısı; anlık iletimle ve bildirim sayfasından güncellenir
  const [okunmamis, setOkunmamis] = useState(0);
  useEffect(() => {
    if (!giris) return;
    const al = () =>
      istek<{ okunmamis: number }>('/notifications/unread')
        .then((r) => setOkunmamis(r.okunmamis))
        .catch(() => undefined);
    al();
    window.addEventListener('rr-bildirim', al);
    return () => window.removeEventListener('rr-bildirim', al);
  }, [giris]);
  useCanli((o) => {
    if (o.tip === 'bildirim' && typeof o.okunmamis === 'number') setOkunmamis(o.okunmamis);
  }, !!giris);
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 10 }} aria-label="Hesap">
      {ad ? (
        <Link
          href="/bildirimler"
          aria-label={`Bildirimler, ${okunmamis} okunmamış`}
          style={{
            position: 'relative',
            width: 40,
            height: 40,
            borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--rr-ust-yazi)',
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
      ) : null}
      {giris && ad ? (
        <HesapAcilir ad={ad} bas={bas} />
      ) : giris === false ? (
        <Link
          href="/giris"
          style={{ color: 'var(--rr-ust-yazi)', fontWeight: 600, fontSize: 15, padding: '10px 6px' }}
        >
          Giriş yap
        </Link>
      ) : (
        <span
          aria-hidden="true"
          style={{ width: 34, height: 34, borderRadius: '50%', background: '#EEF1F7', margin: '0 6px' }}
        />
      )}
      <Link
        href="/talep-olustur"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: colors.blue,
          color: 'var(--rr-maviYazi, #1E2333)',
          fontWeight: 700,
          fontSize: 15,
          padding: '11px 18px',
          borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
          textDecoration: 'none',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Talep oluştur
      </Link>
    </nav>
  );
}

/** Hesabım açılır menüsü: üzerine gelince (ya da tıklayınca, dokunmatikte) açılır; Esc ve dışarı tıklama kapatır. */
function HesapAcilir({ ad, bas }: { ad: string; bas: string }) {
  const [acik, setAcik] = useState(false);
  const [cikiyor, setCikiyor] = useState(false);
  const kutu = useRef<HTMLDivElement>(null);
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
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: üzerine gelme yalnızca kolaylık; düğme klavyeyle de açar
    <div
      ref={kutu}
      style={{ position: 'relative' }}
      onMouseEnter={() => setAcik(true)}
      onMouseLeave={() => setAcik(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={acik}
        onClick={() => setAcik((x) => !x)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--rr-ust-yazi)',
          fontWeight: 600,
          fontSize: 14.5,
          padding: '8px 6px',
          background: 'transparent',
          border: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: '#FFEEF6',
            color: '#A3236A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          {bas}
        </span>
        {ad}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ transform: acik ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {acik ? (
        // Üst boşluk düğmeyle menü arasında fareyi kaybetmemek için (paddingTop)
        <div style={{ position: 'absolute', right: 0, top: '100%', paddingTop: 6, zIndex: 50 }}>
          <div
            role="menu"
            aria-label="Hesabım"
            style={{
              minWidth: 230,
              background: colors.surface,
              border: `1px solid ${colors.line}`,
              borderRadius: 'var(--rr-buton-kose)',
              boxShadow: '0 12px 32px rgba(30,35,51,0.14)',
              padding: 8,
            }}
          >
            <span
              style={{
                display: 'block',
                padding: '8px 10px 8px',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: colors.muted,
              }}
            >
              Hesabım
            </span>
            {OGELER.filter((o) => o.href).map((o) => (
              <Link
                key={o.ad}
                href={o.href as string}
                role="menuitem"
                className="hesap-oge"
                onClick={() => setAcik(false)}
                style={{
                  display: 'block',
                  borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
                  padding: '9px 10px',
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: colors.inkSoft,
                  textDecoration: 'none',
                }}
              >
                {o.ad}
              </Link>
            ))}
            <div style={{ borderTop: `1px solid ${colors.line}`, margin: '6px 4px' }} />
            <button
              type="button"
              role="menuitem"
              className="hesap-oge"
              disabled={cikiyor}
              onClick={() => {
                setCikiyor(true);
                void cikisYap();
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
                padding: '9px 10px',
                fontSize: 14.5,
                fontWeight: 700,
                color: '#A3271F',
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {cikiyor ? 'Çıkılıyor…' : 'Çıkış yap'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
