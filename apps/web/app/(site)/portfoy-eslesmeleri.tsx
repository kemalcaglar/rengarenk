'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { istek, useGiris } from '../../lib/istemci';
import { butceAraligi, zaman } from '../../lib/talep-bicim';

interface Kart {
  no: number;
  baslik: string;
  il: string | null;
  ilce: string | null;
  butceMin: number | null;
  butceMax: number | null;
  yayin: string | null;
  arac: string;
}

/**
 * Ana sayfada galeriler için "Portföyünüze uyan talepler" (Karar 22, Anasayfa.dc.html): otomatik eşleşmeler.
 * Galeri üyesi olmayan ya da paketinde otomatik eşleşme olmayan kullanıcıda gösterilmez.
 */
export function PortfoyEslesmeleri() {
  const giris = useGiris();
  const [liste, setListe] = useState<Kart[]>([]);

  useEffect(() => {
    if (giris)
      istek<{ galeri: boolean; eslesmeler: Kart[] }>('/me/matches')
        .then((r) => setListe(r.eslesmeler))
        .catch(() => undefined);
  }, [giris]);

  if (!liste.length) return null;

  return (
    <section aria-labelledby="eslesmeler">
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 id="eslesmeler" style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>
          Portföyünüze uyan talepler
        </h2>
        <Link href="/galeri-paneli?bolum=eslesme" style={{ fontSize: 14, fontWeight: 700 }}>
          Tümünü gör
        </Link>
      </div>
      <div className="rr-uc-sutun">
        {liste.map((e) => (
          <Link
            key={e.no}
            href={`/talep/${e.no}`}
            style={{
              display: 'block',
              background: '#FFFFFF',
              border: '1px solid #E3E6EF',
              borderRadius: 16,
              padding: 16,
              color: '#1E2333',
              textDecoration: 'none',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#E7FAF0',
                color: '#11683F',
                fontSize: 12,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 999,
              }}
            >
              Portföyünüzdeki {e.arac} uyuyor
            </span>
            <span
              style={{ display: 'block', fontSize: 15.5, fontWeight: 800, lineHeight: 1.35, marginTop: 10 }}
            >
              {e.baslik}
            </span>
            <span style={{ display: 'block', fontSize: 13, color: '#5A6073', marginTop: 6 }}>
              {[[e.il, e.ilce].filter(Boolean).join(', '), zaman(e.yayin)].filter(Boolean).join(' · ')}
            </span>
            <span
              style={{ display: 'block', fontSize: 15, fontWeight: 800, color: '#2450C8', marginTop: 10 }}
            >
              {butceAraligi(e.butceMin, e.butceMax)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
