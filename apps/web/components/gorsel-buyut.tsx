'use client';

import { type MouseEvent, useEffect, useRef, useState } from 'react';

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
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(14,17,26,0.92)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '56px 16px 20px',
      }}
    >
      {/* Karanlık alana tıklama kapatır (klavyede Esc ve kapat düğmesi) */}
      <button
        type="button"
        aria-label="Kapat"
        tabIndex={-1}
        onClick={kapat}
        style={{ position: 'absolute', inset: 0, background: 'transparent', border: 0, cursor: 'default' }}
      />
      <button
        ref={dugme}
        type="button"
        onClick={kapat}
        aria-label="Kapat"
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 2,
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: 0,
          background: 'rgba(255,255,255,0.14)',
          color: '#FFFFFF',
          fontSize: 22,
          lineHeight: 1,
          cursor: 'pointer',
        }}
      >
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
        style={{
          position: 'relative',
          zIndex: 1,
          padding: 0,
          border: 0,
          background: 'transparent',
          maxWidth: '100%',
          maxHeight: 'calc(100% - 40px)',
          overflow: 'hidden',
          cursor: yakin ? 'zoom-out' : 'zoom-in',
          display: 'flex',
        }}
      >
        {/* biome-ignore lint/performance/noImgElement: katalog görseli API'den akar */}
        <img
          src={src}
          alt={alt}
          style={{
            display: 'block',
            maxWidth: '94vw',
            maxHeight: 'calc(100vh - 140px)',
            objectFit: 'contain',
            transform: yakin ? 'scale(2)' : 'none',
            transformOrigin: odak,
            transition: 'transform .2s ease',
          }}
        />
      </button>
      {altyazi ? (
        <p
          style={{
            position: 'relative',
            zIndex: 1,
            margin: '12px 0 0',
            maxWidth: 900,
            textAlign: 'center',
            fontSize: 12.5,
            color: 'rgba(255,255,255,0.8)',
          }}
        >
          {altyazi}
        </p>
      ) : null}
    </div>
  );
}
