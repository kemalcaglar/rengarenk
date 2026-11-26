'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

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
            className={cx(
              'k-row',
              stil.kutu1,
              i === 0 ? stil.kutu2 : undefined,
              u.okundu ? stil.kutu3 : stil.kutu4,
            )}
          >
            <span
              aria-hidden="true"
              className={stil.metin1}
              style={{ background: u.okundu ? 'transparent' : u.kritik ? '#E5484D' : '#5B8CFF' }}
            />
            <span className={stil.metin2}>
              <span className={stil.metin3}>
                {u.kritik ? <span className={`k-pill ${stil.metin4}`}>Kritik</span> : null}
                <span className={`k-pill ${stil.metin5}`}>{u.kuralAdi}</span>
                <span className={stil.metin6}>{zaman(u.zaman)}</span>
              </span>
              <span className={stil.metin7}>
                {u.okundu ? null : <span className="sr-only">Okunmadı: </span>}
                {u.baslik}
              </span>
              <span className={stil.metin8}>{u.metin}</span>
              <span className={stil.metin9}>{EPOSTA[u.eposta]}</span>
            </span>
            <span className={stil.metin10}>
              <Link
                href={u.yol}
                onClick={() => (u.okundu ? undefined : oku({ ids: [u.id] }))}
                className={stil.bag1}
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
