'use client';

import { colors } from '@rengarenk/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 10 }} aria-label="Hesap">
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
