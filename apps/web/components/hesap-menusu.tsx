'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useCanli } from '../lib/canli';
import { cx } from '../lib/cx';
import { cikisYap, istek, useGiris } from '../lib/istemci';
import { BildirimAcilir } from './bildirim-acilir';
import { OGELER } from './hesabim-menu';
import stil from './hesap-menusu.module.css';

interface Ben {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

/**
 * Üst çubuğun hesap bölümü: girişliyse zil (üzerine gelince son bildirimler), avatar ve ad (üzerine gelince ya da tıklayınca Hesabım menüsü ve "Çıkış
 * yap"), değilse "Giriş yap"; ve "Talep oluştur". Oturuma bakılırken yer tutucu gösterilir ("Giriş yap" yanıp sönmez).
 */
export function HesapMenusu() {
  const giris = useGiris();
  const [ben, setBen] = useState<Ben | null>(null);
  useEffect(() => {
    if (giris)
      istek<Ben>('/me')
        .then(setBen)
        // Profil okunamazsa da girişli görünür
        .catch(() => setBen({ firstName: null, lastName: null, displayName: null }));
  }, [giris]);
  const ad = ben
    ? [ben.firstName, ben.lastName].filter(Boolean).join(' ') || ben.displayName || 'Hesabım'
    : null;
  const bas =
    ad
      ?.split(/\s+/)
      .filter((p) => /^\p{L}/u.test(p))
      .slice(0, 2)
      .map((p) => p.charAt(0).toLocaleUpperCase('tr-TR'))
      .join('') || '?';
  // Zil (Karar 48): okunmamış bildirim sayısı; anlık iletimle ve bildirim sayfasından güncellenir
  const [okunmamis, setOkunmamis] = useState(0);
  useEffect(() => {
    if (!giris) return;
    const al = () =>
      istek<{ okunmamis: number }>('/notifications/unread')
        .then((r) => setOkunmamis(r.okunmamis))
        .catch(() => undefined);
    al();
    window.addEventListener('rr-bildirim', al);
    return () => window.removeEventListener('rr-bildirim', al);
  }, [giris]);
  useCanli((o) => {
    if (o.tip === 'bildirim' && typeof o.okunmamis === 'number') setOkunmamis(o.okunmamis);
  }, !!giris);
  return (
    <nav className={`rr-hesap ${stil.kutu1}`} aria-label="Hesap">
      {ad ? <BildirimAcilir okunmamis={okunmamis} /> : null}
      {giris && ad ? (
        <HesapAcilir ad={ad} bas={bas} />
      ) : giris === false ? (
        <>
          <Link href="/giris" className={stil.bag1}>
            Giriş yap
          </Link>
          {/* Üye ol ve Giriş yap ayrı (Karar 18); telefonda Üye ol ☰ menüsünde */}
          <Link href="/uye-ol" className={`rr-yalniz-genis ${stil.bag1}`}>
            Üye ol
          </Link>
        </>
      ) : (
        <span aria-hidden="true" className={stil.metin1} />
      )}
      <Link href="/talep-olustur" aria-label="Talep oluştur" className={`rr-talep-dugme ${stil.bag2}`}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span className="rr-yalniz-genis">Talep oluştur</span>
      </Link>
    </nav>
  );
}

/** Hesabım açılır menüsü: üzerine gelince (ya da tıklayınca, dokunmatikte) açılır; Esc ve dışarı tıklama kapatır. */
function HesapAcilir({ ad, bas }: { ad: string; bas: string }) {
  const [acik, setAcik] = useState(false);
  const [cikiyor, setCikiyor] = useState(false);
  const kutu = useRef<HTMLDivElement>(null);
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
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: üzerine gelme yalnızca kolaylık; düğme klavyeyle de açar
    <div
      ref={kutu}
      className={stil.kutu2}
      onMouseEnter={() => setAcik(true)}
      onMouseLeave={() => setAcik(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={acik}
        onClick={() => setAcik((x) => !x)}
        className={stil.dugme1}
      >
        <span aria-hidden="true" className={stil.metin2}>
          {bas}
        </span>
        <span className="rr-hesap-ad">{ad}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cx(stil.gorsel1, acik ? stil.gorsel2 : undefined)}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {acik ? (
        // Üst boşluk düğmeyle menü arasında fareyi kaybetmemek için (paddingTop)
        <div className={stil.kutu3}>
          <div role="menu" aria-label="Hesabım" className={stil.kutu4}>
            <span className={stil.metin3}>Hesabım</span>
            {OGELER.filter((o) => o.href).map((o) => (
              <Link
                key={o.ad}
                href={o.href as string}
                role="menuitem"
                className={`hesap-oge ${stil.bag3}`}
                onClick={() => setAcik(false)}
              >
                {o.ad}
              </Link>
            ))}
            <div className={stil.kutu5} />
            <button
              type="button"
              role="menuitem"
              className={`hesap-oge ${stil.dugme2}`}
              disabled={cikiyor}
              onClick={() => {
                setCikiyor(true);
                void cikisYap();
              }}
            >
              {cikiyor ? 'Çıkılıyor…' : 'Çıkış yap'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
