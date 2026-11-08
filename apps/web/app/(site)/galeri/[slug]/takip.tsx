'use client';

import { useEffect, useState } from 'react';
import { istek, useGiris } from '../../../../lib/istemci';

/**
 * Galeriyi takip et (Karar 28; GaleriProfil.dc.html): takip edilen galerinin portföyüne eklenen ve yayındaki
 * taleplerine uyan araçlar günlük özetle bildirilir. Galeri takipçilerini tek tek görmez.
 */
export function TakipDugmesi({ slug }: { slug: string }) {
  const giris = useGiris();
  const [takip, setTakip] = useState(false);
  const [kendi, setKendi] = useState(false);
  const [mesgul, setMesgul] = useState(false);
  useEffect(() => {
    if (giris)
      istek<{ takip: boolean }>(`/galeriler/${encodeURIComponent(slug)}/takip`)
        .then((r) => setTakip(r.takip))
        .catch(() => undefined);
  }, [giris, slug]);
  if (kendi) return null;
  return (
    <button
      type="button"
      aria-pressed={takip}
      disabled={mesgul}
      onClick={async () => {
        if (!giris) {
          window.location.href = `/giris?sonra=/galeri/${slug}`;
          return;
        }
        setMesgul(true);
        try {
          const r = await istek<{ takip: boolean }>(`/galeriler/${encodeURIComponent(slug)}/takip`, {
            method: takip ? 'DELETE' : 'PUT',
          });
          setTakip(r.takip);
        } catch {
          // kendi galerisi takip edilemez
          setKendi(true);
        } finally {
          setMesgul(false);
        }
      }}
      style={{
        border: 0,
        background: takip ? '#E7FAF0' : '#5B8CFF',
        borderRadius: 12,
        padding: '11px 16px',
        fontSize: 14.5,
        fontWeight: 800,
        color: '#1E2333',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {takip ? '✓ Takip ediliyor' : 'Galeriyi takip et'}
    </button>
  );
}
