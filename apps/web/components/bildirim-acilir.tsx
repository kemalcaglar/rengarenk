'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cx } from '../lib/cx';
import { istek } from '../lib/istemci';
import stil from './bildirim-acilir.module.css';

interface Bildirim {
  id: string;
  ikon: string;
  tint: string;
  baslik: string;
  metin: string;
  url: string | null;
  okundu: boolean;
  zaman: string;
}

const once = (iso: string) => {
  const dk = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (dk < 1) return 'şimdi';
  if (dk < 60) return `${dk} dk`;
  if (dk < 24 * 60) return `${Math.floor(dk / 60)} sa`;
  if (dk < 48 * 60) return 'Dün';
  return `${Math.floor(dk / (24 * 60))} gün`;
};

/**
 * Üst çubuktaki zil (Karar 48; sahip isteği, 17 Kasım 2026): üzerine gelince son bildirimler açılır (okunmamışlar
 * vurgulu); bildirime tıklayınca okundu sayılır ve ilgili sayfa açılır. Zile tıklamak Bildirimler sayfasına götürür
 * (dokunmatikte ve klavyede de). Esc ve dışarı tıklama paneli kapatır.
 */
export function BildirimAcilir({ okunmamis }: { okunmamis: number }) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [liste, setListe] = useState<Bildirim[] | null>(null);
  const kutu = useRef<HTMLDivElement>(null);
  const kapat = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Panel açılınca (ve açıkken sayı değişince) son bildirimler yeniden okunur
  useEffect(() => {
    if (!acik || okunmamis < 0) return;
    istek<{ bildirimler: Bildirim[] }>('/notifications')
      .then((r) => setListe(r.bildirimler.slice(0, 6)))
      .catch(() => setListe([]));
  }, [acik, okunmamis]);

  useEffect(() => {
    if (!acik) return;
    const disari = (e: PointerEvent) => {
      if (!kutu.current?.contains(e.target as Node)) setAcik(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAcik(false);
    };
    document.addEventListener('pointerdown', disari);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', disari);
      document.removeEventListener('keydown', esc);
    };
  }, [acik]);

  const gir = () => {
    if (kapat.current) clearTimeout(kapat.current);
    setAcik(true);
  };
  // Fare zilden panele geçerken kapanmasın diye kısa gecikme
  const cik = () => {
    kapat.current = setTimeout(() => setAcik(false), 180);
  };

  async function ac(b: Bildirim) {
    setAcik(false);
    if (!b.okundu)
      await istek('/notifications/read', { method: 'POST', body: { ids: [b.id] } }).catch(() => undefined);
    window.dispatchEvent(new Event('rr-bildirim'));
    router.push(b.url ?? '/bildirimler');
  }

  async function hepsiOkundu() {
    await istek('/notifications/read', { method: 'POST', body: { hepsi: true } }).catch(() => undefined);
    window.dispatchEvent(new Event('rr-bildirim'));
    setListe((l) => l?.map((b) => ({ ...b, okundu: true })) ?? null);
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: üzerine gelme yalnızca kolaylık; zil bağlantısı klavyeyle de çalışır
    <div ref={kutu} className={stil.kutu1} onMouseEnter={gir} onMouseLeave={cik}>
      <Link
        href="/bildirimler"
        aria-label={`Bildirimler, ${okunmamis} okunmamış`}
        aria-haspopup="true"
        aria-expanded={acik}
        onFocus={gir}
        className={cx(stil.bag1, acik ? stil.bag2 : stil.bag3)}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
        {okunmamis > 0 ? (
          <span aria-hidden="true" className={stil.metin1}>
            {okunmamis > 99 ? '99+' : okunmamis}
          </span>
        ) : null}
      </Link>
      {acik ? (
        // Üst boşluk zil ile panel arasında fareyi kaybetmemek için (paddingTop)
        <div className={stil.kutu2}>
          <section aria-label="Son bildirimler" className={stil.kutu3}>
            <div className={stil.kutu4}>
              <strong className={stil.metin2}>
                Bildirimler{okunmamis > 0 ? ` · ${okunmamis} yeni` : ''}
              </strong>
              {okunmamis > 0 ? (
                <button type="button" onClick={hepsiOkundu} className={stil.dugme1}>
                  Tümünü okundu say
                </button>
              ) : null}
            </div>
            <div className={stil.kutu5}>
              {liste === null ? (
                <p className={stil.metin3}>Yükleniyor…</p>
              ) : liste.length === 0 ? (
                <p className={stil.metin3}>Henüz bildirimin yok.</p>
              ) : (
                liste.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => ac(b)}
                    className={cx(stil.dugme2, b.okundu ? stil.dugme3 : stil.dugme4)}
                  >
                    <span aria-hidden="true" className={stil.metin4} style={{ background: b.tint }}>
                      {b.ikon}
                    </span>
                    <span className={stil.metin5}>
                      <span className={stil.metin6}>
                        <span className={cx(stil.metin7, b.okundu ? stil.metin8 : stil.metin9)}>
                          {b.baslik}
                          {b.okundu ? null : <span className="sr-only"> (okunmadı)</span>}
                        </span>
                        <span className={stil.metin10}>{once(b.zaman)}</span>
                      </span>
                      <span className={stil.metin11}>{b.metin}</span>
                    </span>
                    {b.okundu ? null : <span aria-hidden="true" className={stil.metin12} />}
                  </button>
                ))
              )}
            </div>
            <Link href="/bildirimler" onClick={() => setAcik(false)} className={stil.bag4}>
              Tüm bildirimleri gör
            </Link>
          </section>
        </div>
      ) : null}
    </div>
  );
}
