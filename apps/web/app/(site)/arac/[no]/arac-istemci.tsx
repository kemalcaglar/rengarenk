'use client';

import { useState } from 'react';
import { API, istek, useGiris } from '../../../../lib/istemci';

/** Fotoğraf gezgini (PortfoyArac.dc.html): büyük görsel, önceki/sonraki, küçük resimler */
export function FotoGezgini({ fotolar, ad }: { fotolar: string[]; ad: string }) {
  const [i, setI] = useState(0);
  const n = fotolar.length;
  const git = (d: number) => setI((x) => (x + d + n) % n);
  const ok = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: 0,
    background: 'rgba(255,255,255,0.95)',
    fontSize: 20,
    fontWeight: 800,
    color: '#1E2333',
    cursor: 'pointer',
  } as const;
  return (
    <section
      aria-label="Fotoğraflar"
      style={{ background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18, overflow: 'hidden' }}
    >
      <div
        style={{
          position: 'relative',
          height: 400,
          background: '#EEF3FF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {n ? (
          // biome-ignore lint/performance/noImgElement: galeri fotoğrafı API'den akar
          <img
            src={`${API}${fotolar[i]}`}
            alt={`${ad}, fotoğraf ${i + 1}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : null}
        {n > 1 ? (
          <>
            <button
              type="button"
              aria-label="Önceki fotoğraf"
              onClick={() => git(-1)}
              style={{ ...ok, left: 14 }}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Sonraki fotoğraf"
              onClick={() => git(1)}
              style={{ ...ok, right: 14 }}
            >
              ›
            </button>
          </>
        ) : null}
        <span
          style={{
            position: 'absolute',
            left: 14,
            bottom: 12,
            fontSize: 13,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.95)',
          }}
        >
          {n ? i + 1 : 0} / {n}
        </span>
        <span
          style={{
            position: 'absolute',
            right: 14,
            bottom: 12,
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.95)',
            color: '#5A6073',
          }}
        >
          Galerinin yüklediği fotoğraflar
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: 10, overflowX: 'auto' }}>
        {fotolar.map((f, j) => (
          <button
            key={f}
            type="button"
            aria-label={`Fotoğraf ${j + 1}`}
            onClick={() => setI(j)}
            style={{
              flex: 'none',
              width: 92,
              height: 62,
              borderRadius: 10,
              border: j === i ? '2px solid #5B8CFF' : '1px solid #E3E6EF',
              padding: 0,
              overflow: 'hidden',
              cursor: 'pointer',
              background: '#F3F5FA',
            }}
          >
            {/* biome-ignore lint/performance/noImgElement: küçük resim */}
            <img
              src={`${API}${f}`}
              alt=""
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </button>
        ))}
      </div>
    </section>
  );
}

const telefon = (e164: string) => e164.replace(/^\+90(\d{3})(\d{3})(\d{2})(\d{2})$/, '0$1 $2 $3 $4');

/** "Telefonu göster" ve WhatsApp: girişli kullanıcıya temsilcinin numarası */
export function Iletisim({ no }: { no: number }) {
  const giris = useGiris();
  const [t, setT] = useState<{ ad: string | null; phone: string | null } | null>(null);
  const goster = async () => {
    if (!giris) {
      window.location.href = `/giris?sonra=/arac/${no}`;
      return;
    }
    setT(
      await istek<{ ad: string | null; phone: string | null }>(`/araclar/${no}/iletisim`).catch(() => ({
        ad: null,
        phone: null,
      })),
    );
  };
  const kutu = {
    display: 'block',
    textAlign: 'center',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    fontWeight: 800,
    textDecoration: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as const;
  return (
    <>
      <button
        type="button"
        disabled
        title="Mesajlaşma yakında açılacak"
        style={{ ...kutu, border: 0, background: '#C9D7FF', color: '#5A6073', cursor: 'default' }}
      >
        Bu araç için mesaj gönder
      </button>
      {t?.phone ? (
        <a
          href={`tel:${t.phone}`}
          style={{ ...kutu, border: '1px solid #D5DAE5', background: '#FFFFFF', color: '#1E2333' }}
        >
          {telefon(t.phone)}
          {t.ad ? ` · ${t.ad}` : ''}
        </a>
      ) : (
        <button
          type="button"
          onClick={goster}
          style={{ ...kutu, border: '1px solid #D5DAE5', background: '#FFFFFF', color: '#1E2333' }}
        >
          Telefonu göster
        </button>
      )}
      {t?.phone ? (
        <a
          href={`https://wa.me/${t.phone.replace(/\D/g, '')}`}
          rel="noreferrer"
          target="_blank"
          style={{ ...kutu, border: '1px solid #3DD68C', color: '#11683F' }}
        >
          WhatsApp
        </a>
      ) : null}
    </>
  );
}
