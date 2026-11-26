'use client';

import Link from 'next/link';
import { cx } from '../../../lib/cx';
import { API } from '../../../lib/istemci';
import { binlik } from '../../../lib/talep-bicim';
import stil from './araclar.module.css';

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
      <div className={stil.kutu1}>
        Favori aracın yok. Galeri araç sayfalarındaki “Favorilere ekle” ile ekleyebilirsin.
      </div>
    );
  return (
    <div className="rr-iki-sutun">
      {(liste ?? []).map((a) => (
        <article key={a.no} className={cx(stil.kutu2, a.satista ? stil.kutu3 : stil.kutu4)}>
          <div className={stil.kutu5}>
            {a.foto ? (
              // biome-ignore lint/performance/noImgElement: API'deki portföy fotoğrafı
              <img src={`${API}${a.foto}`} alt="" className={stil.gorsel1} />
            ) : null}
          </div>
          <div className={stil.kutu6}>
            <div className={stil.kutu7}>
              <span className={cx(stil.metin1, a.satista ? stil.metin2 : stil.metin3)}>
                {a.satista ? 'Satışta' : 'Satışta değil'}
              </span>
              <button
                type="button"
                onClick={() => kaldir(a)}
                aria-label="Favorilerden çıkar"
                className={stil.dugme1}
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
              <Link href={`/arac/${a.no}`} className={stil.bag1}>
                {a.ad}
              </Link>
            ) : (
              <span className={stil.metin4}>{a.ad}</span>
            )}
            <span className={stil.metin5}>{a.ozellik}</span>
            <span className={stil.metin6}>
              {[a.fiyat !== null ? `${binlik(a.fiyat)} TL` : null, a.galeri?.ad].filter(Boolean).join(' · ')}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
