'use client';

import type { BannerPlace } from '@rengarenk/shared';
import Link from 'next/link';
import { type CSSProperties, useEffect, useState } from 'react';
import { API, istek } from '../lib/istemci';

interface Banner {
  id: string;
  baslik: string;
  metin: string;
  dugme: string;
  url: string;
  renk: string;
  zemin: string;
}

const olay = (id: string, tur: 'gosterim' | 'tiklama') =>
  fetch(`${API}/icerik/banner/${id}/olay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tur }),
    keepalive: true,
  }).catch(() => undefined);

/** Aynı sekmede aynı banner için tek gösterim sayılır */
const sayilan = new Set<string>();

/**
 * Konsoldan yayınlanan banner ve duyurular (Karar 46): yer, kitle (ziyaretçi, üye, galeri ve il), platform ve tarihe
 * göre API seçer. Gösterim ve tıklama günlük toplam olarak sayılır; kişisel veri gönderilmez.
 */
export function Banner({ yer, style }: { yer: BannerPlace; style?: CSSProperties }) {
  const [liste, setListe] = useState<Banner[]>([]);

  useEffect(() => {
    let iptal = false;
    istek<Banner[]>(`/icerik/banner?yer=${yer}&platform=web`)
      .then((b) => {
        if (iptal) return;
        setListe(b);
        for (const x of b)
          if (!sayilan.has(x.id)) {
            sayilan.add(x.id);
            olay(x.id, 'gosterim');
          }
      })
      .catch(() => undefined);
    return () => {
      iptal = true;
    };
  }, [yer]);

  if (!liste.length) return null;

  if (yer === 'ust_serit')
    return (
      <>
        {liste.map((b) => (
          <section
            key={b.id}
            aria-label="Duyuru"
            style={{
              background: b.zemin,
              borderBottom: `3px solid ${b.renk}`,
              padding: '9px 16px',
              textAlign: 'center',
              fontSize: 14,
              color: '#1E2333',
            }}
          >
            <strong>{b.baslik}</strong>
            {b.metin ? <span style={{ color: '#3A4052' }}> · {b.metin}</span> : null}
            {b.dugme && b.url ? (
              <>
                {' '}
                <Link
                  href={b.url}
                  onClick={() => olay(b.id, 'tiklama')}
                  style={{ fontWeight: 800, color: '#2450C8' }}
                >
                  {b.dugme}
                </Link>
              </>
            ) : null}
          </section>
        ))}
      </>
    );

  return (
    <div style={{ display: 'grid', gap: 10, ...style }}>
      {liste.map((b) => (
        <section
          key={b.id}
          aria-label={yer === 'duyuru' ? 'Duyuru' : 'Banner'}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px 16px',
            background: b.zemin,
            border: '1px solid #E3E6EF',
            borderLeft: `6px solid ${b.renk}`,
            borderRadius: 16,
            padding: '14px 18px',
          }}
        >
          <span style={{ flex: '1 1 280px', minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 800 }}>{b.baslik}</span>
            {b.metin ? (
              <span style={{ display: 'block', fontSize: 14, color: '#3A4052', marginTop: 3 }}>
                {b.metin}
              </span>
            ) : null}
          </span>
          {b.dugme && b.url ? (
            <Link
              href={b.url}
              onClick={() => olay(b.id, 'tiklama')}
              style={{
                flex: 'none',
                background: '#1E2333',
                color: '#FFFFFF',
                borderRadius: 12,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              {b.dugme}
            </Link>
          ) : null}
        </section>
      ))}
    </div>
  );
}
