'use client';

import type { BannerPlace } from '@rengarenk/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cx } from '../lib/cx';
import { API, istek } from '../lib/istemci';
import stil from './banner.module.css';

interface Banner {
  id: string;
  kol: 'A' | 'B';
  baslik: string;
  metin: string;
  dugme: string;
  url: string;
  renk: string;
  zemin: string;
}

const olay = (id: string, tur: 'gosterim' | 'tiklama', kol: 'A' | 'B') =>
  fetch(`${API}/icerik/banner/${id}/olay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tur, kol }),
    keepalive: true,
  }).catch(() => undefined);

/**
 * Ziyaretçi kimliği: yalnızca A/B testinde kolu sabit tutmak için tarayıcıda rastgele üretilir; sunucuda saklanmaz.
 * Üye girişliyse kol hesabından hesaplanır.
 */
function ziyaretciKimligi() {
  try {
    let z = localStorage.getItem('rr_z');
    if (!z) {
      z = crypto.randomUUID();
      localStorage.setItem('rr_z', z);
    }
    return z;
  } catch {
    return '';
  }
}

/** Aynı sekmede aynı banner için tek gösterim sayılır */
const sayilan = new Set<string>();

/**
 * Konsoldan yayınlanan banner ve duyurular (Karar 46): yer, kitle (ziyaretçi, üye, galeri ve il), platform ve tarihe
 * göre API seçer. Gösterim ve tıklama günlük toplam olarak sayılır; kişisel veri gönderilmez.
 */
export function Banner({ yer, className }: { yer: BannerPlace; className?: string }) {
  const [liste, setListe] = useState<Banner[]>([]);

  useEffect(() => {
    let iptal = false;
    const z = ziyaretciKimligi();
    istek<Banner[]>(`/icerik/banner?yer=${yer}&platform=web${z ? `&z=${z}` : ''}`)
      .then((b) => {
        if (iptal) return;
        setListe(b);
        for (const x of b)
          if (!sayilan.has(x.id)) {
            sayilan.add(x.id);
            olay(x.id, 'gosterim', x.kol);
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
            className={stil.kutu1}
            style={{ background: b.zemin, borderBottom: `3px solid ${b.renk}` }}
          >
            <strong>{b.baslik}</strong>
            {b.metin ? <span className={stil.metin1}> · {b.metin}</span> : null}
            {b.dugme && b.url ? (
              <>
                {' '}
                <Link href={b.url} onClick={() => olay(b.id, 'tiklama', b.kol)} className={stil.bag1}>
                  {b.dugme}
                </Link>
              </>
            ) : null}
          </section>
        ))}
      </>
    );

  return (
    <div className={cx(stil.liste, className)}>
      {liste.map((b) => (
        <section
          key={b.id}
          aria-label={yer === 'duyuru' ? 'Duyuru' : 'Banner'}
          className={stil.kutu2}
          style={{
            background: b.zemin,
            border: '1px solid var(--rr-cizgi, #E3E6EF)',
            borderLeft: `6px solid ${b.renk}`,
          }}
        >
          <span className={stil.metin2}>
            <span className={stil.metin3}>{b.baslik}</span>
            {b.metin ? <span className={stil.metin4}>{b.metin}</span> : null}
          </span>
          {b.dugme && b.url ? (
            <Link href={b.url} onClick={() => olay(b.id, 'tiklama', b.kol)} className={stil.bag2}>
              {b.dugme}
            </Link>
          ) : null}
        </section>
      ))}
    </div>
  );
}
