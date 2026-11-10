'use client';

import Link from 'next/link';
import { API } from '../../../lib/istemci';
import { binlik } from '../../../lib/talep-bicim';

export interface FavoriArac {
  no: number;
  ad: string;
  ozellik: string;
  fiyat: number | null;
  foto: string | null;
  galeri: { ad: string; slug: string } | null;
  satista: boolean;
  eklendi: string;
}

/**
 * Favoriler › Favori araçlar (tasarıma ek sekme; araç sayfasındaki "♡ Favorilere ekle" PortfoyArac.dc.html). Kart talep
 * favorileriyle aynı görünümde; satıştan kalkan araç soluk ve "Satışta değil".
 */
export function FavoriAraclar({
  liste,
  kaldir,
}: {
  liste: FavoriArac[] | null;
  kaldir: (a: FavoriArac) => void;
}) {
  if (liste && liste.length === 0)
    return (
      <div
        style={{
          background: 'var(--rr-kart, #FFFFFF)',
          border: '1px dashed #C9CFDB',
          borderRadius: 'var(--rr-kart-kose)',
          padding: '36px 20px',
          textAlign: 'center',
          fontSize: 15,
          color: 'var(--rr-soluk, #5A6073)',
        }}
      >
        Favori aracın yok. Galeri araç sayfalarındaki “Favorilere ekle” ile ekleyebilirsin.
      </div>
    );
  return (
    <div className="rr-iki-sutun">
      {(liste ?? []).map((a) => (
        <article
          key={a.no}
          style={{
            background: 'var(--rr-kart, #FFFFFF)',
            border: '1px solid var(--rr-cizgi, #E3E6EF)',
            borderRadius: 'var(--rr-kart-kose)',
            padding: 16,
            display: 'flex',
            gap: 14,
            opacity: a.satista ? 1 : 0.75,
          }}
        >
          <div
            style={{
              flex: '0 0 112px',
              height: 84,
              borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
              background: '#EEF3FF',
              overflow: 'hidden',
            }}
          >
            {a.foto ? (
              // biome-ignore lint/performance/noImgElement: API'deki portföy fotoğrafı
              <img
                src={`${API}${a.foto}`}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : null}
          </div>
          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 'var(--rr-etiket-kose)',
                  background: a.satista ? '#E7FAF0' : '#F3F5FA',
                  color: a.satista ? '#11683F' : 'var(--rr-soluk, #5A6073)',
                  alignSelf: 'flex-start',
                }}
              >
                {a.satista ? 'Satışta' : 'Satışta değil'}
              </span>
              <button
                type="button"
                onClick={() => kaldir(a)}
                aria-label="Favorilerden çıkar"
                style={{ flex: 'none', border: 0, background: 'transparent', padding: 2, cursor: 'pointer' }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="#FF6FB5"
                  stroke="#E0479A"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20s-7-4.4-9-9.1C1.7 7.6 3.9 4.5 7.1 4.5c2 0 3.4 1.1 4.9 2.9 1.5-1.8 2.9-2.9 4.9-2.9 3.2 0 5.4 3.1 4.1 6.4C19 15.6 12 20 12 20z" />
                </svg>
              </button>
            </div>
            {a.satista ? (
              <Link
                href={`/arac/${a.no}`}
                style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--rr-murekkep, #1E2333)' }}
              >
                {a.ad}
              </Link>
            ) : (
              <span style={{ fontSize: 16.5, fontWeight: 800 }}>{a.ad}</span>
            )}
            <span style={{ fontSize: 13.5, color: '#3A4052' }}>{a.ozellik}</span>
            <span style={{ fontSize: 12.5, color: 'var(--rr-soluk, #5A6073)' }}>
              {[a.fiyat !== null ? `${binlik(a.fiyat)} TL` : null, a.galeri?.ad].filter(Boolean).join(' · ')}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
