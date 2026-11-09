'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

interface Uyari {
  id: string;
  kural: string;
  kuralAdi: string;
  kritik: boolean;
  baslik: string;
  metin: string;
  yol: string;
  okundu: boolean;
  eposta: 'bekliyor' | 'gonderildi' | 'hata' | 'yok';
  zaman: string;
}

const zaman = (d: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(d));

const EPOSTA: Record<Uyari['eposta'], string> = {
  bekliyor: 'E-posta sırada',
  gonderildi: 'E-postayla gönderildi',
  hata: 'E-posta gönderilemedi',
  yok: 'E-posta kanalı kapalı',
};

/**
 * Sana gelen çalışan uyarıları (Karar 40, 41, 57, 58, 59). Her uyarı şirket e-postana da gider; kurallar ve alıcılar
 * Büyüme › Zamanlanmış raporlar ve uyarılar ekranında.
 */
export default function Uyarilar() {
  const { refresh } = useKonsol();
  const [liste, setListe] = useState<Uyari[] | null>(null);
  const [okunmamis, setOkunmamis] = useState(0);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(() => {
    yonetim<{ okunmamis: number; uyarilar: Uyari[] }>('alerts')
      .then((r) => {
        setListe(r.uyarilar);
        setOkunmamis(r.okunmamis);
      })
      .catch((e: Error) => setHata(e.message));
  }, []);
  useEffect(yukle, [yukle]);

  async function oku(body: { ids?: string[]; hepsi?: boolean }) {
    try {
      await yonetim('alerts/read', { method: 'POST', body });
      yukle();
      refresh();
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  return (
    <>
      <div className="k-head">
        <div>
          <h1 className="k-h1">Uyarılar</h1>
          <p className="k-sub">
            Sana gelen çalışan uyarıları; her biri şirket e-postana da gider.{' '}
            <Link href="/zamanlanmis-raporlar">Kurallar ve alıcılar</Link>
          </p>
        </div>
        <button
          className="k-btn"
          type="button"
          disabled={okunmamis === 0}
          onClick={() => oku({ hepsi: true })}
        >
          Tümünü okundu say
        </button>
      </div>
      {hata ? (
        <p className="k-error" role="alert">
          {hata}
        </p>
      ) : null}
      <section className="k-panel" aria-label="Uyarılar">
        {liste === null ? <p className="k-empty">Yükleniyor…</p> : null}
        {liste?.length === 0 ? <p className="k-empty">Henüz uyarı yok.</p> : null}
        {(liste ?? []).map((u, i) => (
          <div
            key={u.id}
            className="k-row"
            style={{
              borderTop: i === 0 ? 0 : undefined,
              alignItems: 'flex-start',
              background: u.okundu ? '#FFFFFF' : '#F6F8FD',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flex: 'none',
                width: 8,
                height: 8,
                marginTop: 7,
                borderRadius: '50%',
                background: u.okundu ? 'transparent' : u.kritik ? '#E5484D' : '#5B8CFF',
              }}
            />
            <span style={{ flex: '999 1 320px', minWidth: 0 }}>
              <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                {u.kritik ? (
                  <span className="k-pill" style={{ background: '#FDECEC', color: '#A3271F' }}>
                    Kritik
                  </span>
                ) : null}
                <span className="k-pill" style={{ background: '#F3F5FA', color: '#3A4052' }}>
                  {u.kuralAdi}
                </span>
                <span style={{ fontSize: 12.5, color: '#5A6073' }}>{zaman(u.zaman)}</span>
              </span>
              <span style={{ display: 'block', marginTop: 6, fontSize: 14.5, fontWeight: 800 }}>
                {u.okundu ? null : <span className="sr-only">Okunmadı: </span>}
                {u.baslik}
              </span>
              <span
                style={{
                  display: 'block',
                  marginTop: 3,
                  fontSize: 13.5,
                  color: '#3A4052',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-line',
                }}
              >
                {u.metin}
              </span>
              <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#5A6073' }}>
                {EPOSTA[u.eposta]}
              </span>
            </span>
            <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
              <Link
                href={u.yol}
                onClick={() => (u.okundu ? undefined : oku({ ids: [u.id] }))}
                style={{ fontSize: 13.5, fontWeight: 800 }}
              >
                Aç
              </Link>
              {u.okundu ? null : (
                <button className="k-link" type="button" onClick={() => oku({ ids: [u.id] })}>
                  Okundu
                </button>
              )}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
