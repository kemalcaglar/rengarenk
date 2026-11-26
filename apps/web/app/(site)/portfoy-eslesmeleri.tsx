'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { istek, useGiris } from '../../lib/istemci';
import { butceAraligi, zaman } from '../../lib/talep-bicim';
import stil from './portfoy-eslesmeleri.module.css';

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
      <div className={stil.kutu1}>
        <h2 id="eslesmeler" className={stil.baslik1}>
          Portföyünüze uyan talepler
        </h2>
        <Link href="/galeri-paneli?bolum=eslesme" className={stil.bag1}>
          Tümünü gör
        </Link>
      </div>
      <div className="rr-uc-sutun">
        {liste.map((e) => (
          <Link key={e.no} href={`/talep/${e.no}`} className={stil.bag2}>
            <span className={stil.metin1}>Portföyünüzdeki {e.arac} uyuyor</span>
            <span className={stil.metin2}>{e.baslik}</span>
            <span className={stil.metin3}>
              {[[e.il, e.ilce].filter(Boolean).join(', '), zaman(e.yayin)].filter(Boolean).join(' · ')}
            </span>
            <span className={stil.metin4}>{butceAraligi(e.butceMin, e.butceMax)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
