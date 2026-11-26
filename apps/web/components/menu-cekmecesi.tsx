'use client';

import { DOTS } from '@rengarenk/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cx } from '../lib/cx';
import { istek, useGiris } from '../lib/istemci';
import { OGELER } from './hesabim-menu';
import { Logo } from './logo';
import stil from './menu-cekmecesi.module.css';

/** Kategori kareleri: tasarımdaki TINTS sırası (AnasayfaMobil.dc.html; DOTS ile aynı sırada) */
const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0', '#F3EFFF', '#FFF0EA'];
const YAKINDA = ['Emlak', 'İkinci el alışveriş'];
const BAGLANTILAR = [
  { ad: 'Nasıl çalışır?', href: '/#nasil' },
  { ad: 'Galeriler için · 30 gün ücretsiz', href: '/kurumsal-basvuru' },
  { ad: 'Yardım ve destek', href: '/yardim' },
  { ad: 'Güvenli alışveriş rehberi', href: '/yardim#gv' },
];

export interface MenuKategori {
  slug: string;
  name: string;
  color: string;
}

interface Ben {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

/**
 * Telefonda üst çubuğun solundaki ☰ düğmesi ve "Menü ve kategoriler" çekmecesi (tasarım: AnasayfaMobil.dc.html,
 * menuAcik; mobil uygulamada `components/menu-cekmecesi.tsx`): kullanıcı kartı, vasıta kategorileri (renkli kare ve
 * nokta), Diğer · Yakında, alt bağlantılar ve yasal metinler. Geniş ekranda düğme görünmez; kategoriler ana sayfanın
 * kenar çubuğundadır.
 */
export function MenuCekmecesi({ kategoriler }: { kategoriler: MenuKategori[] }) {
  const [acik, setAcik] = useState(false);
  const [vasita, setVasita] = useState(true);
  const giris = useGiris();
  const yol = usePathname();
  const [ben, setBen] = useState<Ben | null>(null);
  const dugme = useRef<HTMLButtonElement>(null);
  const kapatDugme = useRef<HTMLButtonElement>(null);

  // Profil yalnızca çekmece açılınca okunur (üst çubuk zaten kendi isteğini yapıyor)
  useEffect(() => {
    if (acik && giris && !ben)
      istek<Ben>('/me')
        .then(setBen)
        .catch(() => setBen({ firstName: null, lastName: null, displayName: null }));
  }, [acik, giris, ben]);

  // Açıkken sayfa kaymaz, Esc kapatır, ekran genişleyince (masaüstü düzeni) kapanır; kapanınca odak ☰'ye döner
  useEffect(() => {
    if (!acik) return;
    const onceki = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    kapatDugme.current?.focus();
    const tus = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAcik(false);
    };
    const genis = window.matchMedia('(min-width: 1024px)');
    const boyut = () => {
      if (genis.matches) setAcik(false);
    };
    window.addEventListener('keydown', tus);
    genis.addEventListener('change', boyut);
    return () => {
      document.body.style.overflow = onceki;
      window.removeEventListener('keydown', tus);
      genis.removeEventListener('change', boyut);
      dugme.current?.focus();
    };
  }, [acik]);

  const kapat = () => setAcik(false);
  const ad = ben
    ? [ben.firstName, ben.lastName].filter(Boolean).join(' ') || ben.displayName || 'Hesabım'
    : 'Hesabım';
  const bas =
    ad
      .split(/\s+/)
      .filter((p) => /^\p{L}/u.test(p))
      .slice(0, 2)
      .map((p) => p.charAt(0).toLocaleUpperCase('tr-TR'))
      .join('') || '?';

  return (
    <>
      <button
        ref={dugme}
        type="button"
        className={`rr-menu-dugme ${stil.dugme1}`}
        onClick={() => setAcik(true)}
        aria-label="Menü ve kategoriler"
        aria-expanded={acik}
        aria-controls="rr-cekmece"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {acik ? (
        <div className={`rr-cekmece ${stil.kutu1}`}>
          {/* Karartma: dokununca kapanır (klavyede Esc ve kapat düğmesi var) */}
          <div aria-hidden="true" onClick={kapat} className={stil.kutu2} />
          <nav id="rr-cekmece" aria-label="Menü ve kategoriler" className={stil.kutu3}>
            <div className={stil.kutu4}>
              <Logo />
              <button
                ref={kapatDugme}
                type="button"
                onClick={kapat}
                aria-label="Menüyü kapat"
                className={stil.dugme2}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {giris ? (
              <Link href="/taleplerim" onClick={kapat} className={stil.bag1}>
                <span aria-hidden="true" className={stil.metin1}>
                  {bas}
                </span>
                <span className={stil.metin2}>
                  <span className={stil.metin3}>{ad}</span>
                  <span className={stil.metin4}>Hesabım ve taleplerim</span>
                </span>
                <span aria-hidden="true" className={stil.metin5}>
                  ›
                </span>
              </Link>
            ) : null}

            {giris ? (
              // Hesabım bağlantıları (geniş ekranda sayfanın kenarındaki Hesabım menüsü)
              <nav aria-label="Hesabım" className={stil.kutu5}>
                {OGELER.filter((o) => o.href && o.href !== '/yardim').map((o) => (
                  <Link
                    key={o.ad}
                    href={o.href as string}
                    onClick={kapat}
                    aria-current={o.href === yol ? 'page' : undefined}
                    className={cx(stil.bag2, o.href === yol ? stil.bag3 : stil.bag4)}
                  >
                    {o.ad}
                  </Link>
                ))}
              </nav>
            ) : null}

            {giris === false ? (
              // Üye ol ve Giriş yap ayrı (Karar 18)
              <div className={stil.kutu6}>
                <Link href="/uye-ol" onClick={kapat} className={stil.bag5}>
                  Üye ol
                </Link>
                <Link href="/giris" onClick={kapat} className={stil.bag6}>
                  Giriş yap
                </Link>
              </div>
            ) : null}

            <div className={stil.kutu7}>
              <button
                type="button"
                onClick={() => setVasita(!vasita)}
                aria-expanded={vasita}
                className={stil.dugme3}
              >
                <span className={stil.metin6}>Vasıta kategorileri</span>
                <span className={stil.metin7}>{vasita ? 'Gizle' : 'Göster'}</span>
              </button>
              {vasita ? (
                <>
                  <Link href="/talepler" onClick={kapat} className={stil.bag7}>
                    Tüm vasıta talepleri
                  </Link>
                  {kategoriler.map((c, i) => (
                    <Link
                      key={c.slug}
                      href={`/talepler?kategori=${c.slug}`}
                      onClick={kapat}
                      className={stil.bag8}
                    >
                      <span
                        aria-hidden="true"
                        className={stil.metin8}
                        style={{
                          background:
                            TINTS[(DOTS as readonly string[]).indexOf(c.color)] ?? TINTS[i % TINTS.length],
                        }}
                      >
                        <span className={stil.metin9} style={{ background: c.color }} />
                      </span>
                      <span className={stil.metin10}>{c.name}</span>
                    </Link>
                  ))}
                </>
              ) : null}
              <p className={stil.metin11}>Diğer</p>
              {YAKINDA.map((y) => (
                <div key={y} className={stil.kutu8}>
                  {y}
                  <span className={stil.metin12}>Yakında</span>
                </div>
              ))}
            </div>

            <div className={stil.kutu9}>
              {BAGLANTILAR.map((b) => (
                <Link key={b.href} href={b.href} onClick={kapat} className={stil.bag9}>
                  {b.ad}
                </Link>
              ))}
              <p className={stil.metin13}>
                <Link href="/kullanim-kosullari" onClick={kapat} className={stil.bag10}>
                  Kullanım koşulları
                </Link>
                {' · '}
                <Link href="/kvkk" onClick={kapat} className={stil.bag10}>
                  Aydınlatma metni
                </Link>
                {' · '}
                <Link href="/cerez-aydinlatma" onClick={kapat} className={stil.bag10}>
                  Çerezler
                </Link>
              </p>
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
