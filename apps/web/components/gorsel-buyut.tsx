'use client';

import { type MouseEvent, useEffect, useRef, useState } from 'react';
import { cx } from '../lib/cx';
import stil from './gorsel-buyut.module.css';

/**
 * Fotoğrafı tam ekranda gösterir (sahip isteği, 17 Kasım 2026): fotoğraf ekrana kırpılmadan sığar; üzerine tıklayınca
 * iki kat yakınlaşır (fare nereyi gösteriyorsa orası), yeniden tıklayınca geri döner. Esc, kapat düğmesi ya da
 * karanlık alana tıklama kapatır. Sayfa arkada kaymaz.
 */
export function GorselBuyut({
  src,
  alt,
  altyazi,
  kapat,
}: {
  src: string;
  alt: string;
  altyazi?: string | null;
  kapat: () => void;
}) {
  const [yakin, setYakin] = useState(false);
  const [odak, setOdak] = useState('50% 50%');
  const dugme = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') kapat();
    };
    document.addEventListener('keydown', esc);
    const tasma = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dugme.current?.focus();
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = tasma;
    };
  }, [kapat]);

  const konum = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setOdak(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={alt} className={stil.kutu1}>
      {/* Karanlık alana tıklama kapatır (klavyede Esc ve kapat düğmesi) */}
      <button type="button" aria-label="Kapat" tabIndex={-1} onClick={kapat} className={stil.dugme1} />
      <button ref={dugme} type="button" onClick={kapat} aria-label="Kapat" className={stil.dugme2}>
        ×
      </button>
      <button
        type="button"
        aria-label={yakin ? 'Uzaklaştır' : 'Yakınlaştır'}
        onClick={(e) => {
          konum(e);
          setYakin((v) => !v);
        }}
        onMouseMove={(e) => {
          if (yakin) konum(e);
        }}
        className={cx(stil.dugme3, yakin ? stil.dugme4 : stil.dugme5)}
      >
        {/* biome-ignore lint/performance/noImgElement: katalog görseli API'den akar */}
        <img
          src={src}
          alt={alt}
          className={stil.gorsel1}
          style={{ transform: yakin ? 'scale(2)' : 'none', transformOrigin: odak }}
        />
      </button>
      {altyazi ? <p className={stil.metin1}>{altyazi}</p> : null}
    </div>
  );
}
