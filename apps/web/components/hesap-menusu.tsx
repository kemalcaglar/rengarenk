'use client';

import { colors } from '@rengarenk/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCanli } from '../lib/canli';
import { istek, useGiris } from '../lib/istemci';

interface Ben {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

/** Üst çubuğun hesap bölümü: girişliyse avatar ve ad (Taleplerim'e gider), değilse "Giriş yap"; ve "Talep oluştur". */
export function HesapMenusu() {
  const giris = useGiris();
  const [ben, setBen] = useState<Ben | null>(null);
  useEffect(() => {
    if (giris)
      istek<Ben>('/me')
        .then(setBen)
        .catch(() => undefined);
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
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: colors.ink,
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
                borderRadius: 9,
                background: colors.pink,
                color: colors.ink,
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
      {ad ? (
        <Link
          href="/taleplerim"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: colors.ink,
            fontWeight: 600,
            fontSize: 14.5,
            padding: '8px 6px',
            textDecoration: 'none',
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
        </Link>
      ) : (
        <Link href="/giris" style={{ color: colors.ink, fontWeight: 600, fontSize: 15, padding: '10px 6px' }}>
          Giriş yap
        </Link>
      )}
      <Link
        href="/talep-olustur"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: colors.blue,
          color: colors.ink,
          fontWeight: 700,
          fontSize: 15,
          padding: '11px 18px',
          borderRadius: 12,
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
