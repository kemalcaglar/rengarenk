'use client';

import { DOTS } from '@rengarenk/shared';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { istek, useGiris } from '../lib/istemci';
import { colors } from '../lib/renk';
import { Logo } from './logo';

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

const baslik = {
  fontSize: 12.5,
  fontWeight: 800,
  color: colors.muted,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
} as const;

const kareDugme = {
  width: 44,
  height: 44,
  border: 0,
  borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
  background: 'transparent',
  color: 'var(--rr-ust-yazi, #1E2333)',
  cursor: 'pointer',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
} as const;

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
    const genis = window.matchMedia('(min-width: 721px)');
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
        className="rr-menu-dugme"
        onClick={() => setAcik(true)}
        aria-label="Menü ve kategoriler"
        aria-expanded={acik}
        aria-controls="rr-cekmece"
        style={{ ...kareDugme, marginLeft: -10 }}
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
        <div className="rr-yalniz-dar" style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
          {/* Karartma: dokununca kapanır (klavyede Esc ve kapat düğmesi var) */}
          <div
            aria-hidden="true"
            onClick={kapat}
            style={{ position: 'absolute', inset: 0, background: 'rgba(30,35,51,0.45)' }}
          />
          <nav
            id="rr-cekmece"
            aria-label="Menü ve kategoriler"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 'min(324px, 88vw)',
              background: colors.surface,
              color: colors.ink,
              boxShadow: '8px 0 24px rgba(30,35,51,0.18)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 8px 10px 16px',
                borderBottom: '1px solid #EEF0F5',
              }}
            >
              <Logo />
              <button
                ref={kapatDugme}
                type="button"
                onClick={kapat}
                aria-label="Menüyü kapat"
                style={{ ...kareDugme, display: 'flex', color: colors.ink }}
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
              <Link
                href="/taleplerim"
                onClick={kapat}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  margin: '12px 12px 4px',
                  padding: '10px 12px',
                  background: colors.background,
                  borderRadius: 'var(--rr-buton-kose)',
                  color: colors.ink,
                  textDecoration: 'none',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flex: 'none',
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: '#FFEEF6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {bas}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800 }}>{ad}</span>
                  <span style={{ display: 'block', fontSize: 12, color: colors.muted }}>
                    Hesabım ve taleplerim
                  </span>
                </span>
                <span aria-hidden="true" style={{ fontSize: 18, color: '#AEB5C4' }}>
                  ›
                </span>
              </Link>
            ) : null}

            {giris === false ? (
              // Üye ol ve Giriş yap ayrı (Karar 18)
              <div style={{ display: 'flex', gap: 8, margin: '12px 12px 4px' }}>
                <Link
                  href="/uye-ol"
                  onClick={kapat}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '11px 10px',
                    borderRadius: 'var(--rr-buton-kose)',
                    background: colors.blue,
                    color: colors.onBlue,
                    fontSize: 14.5,
                    fontWeight: 800,
                    textDecoration: 'none',
                  }}
                >
                  Üye ol
                </Link>
                <Link
                  href="/giris"
                  onClick={kapat}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '11px 10px',
                    borderRadius: 'var(--rr-buton-kose)',
                    background: colors.background,
                    border: `1px solid ${colors.line}`,
                    color: colors.ink,
                    fontSize: 14.5,
                    fontWeight: 800,
                    textDecoration: 'none',
                  }}
                >
                  Giriş yap
                </Link>
              </div>
            ) : null}

            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0 0' }}>
              <button
                type="button"
                onClick={() => setVasita(!vasita)}
                aria-expanded={vasita}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: 0,
                  background: 'transparent',
                  padding: '10px 16px 6px',
                  cursor: 'pointer',
                  color: colors.ink,
                  fontFamily: 'inherit',
                }}
              >
                <span style={baslik}>Vasıta kategorileri</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: colors.link }}>
                  {vasita ? 'Gizle' : 'Göster'}
                </span>
              </button>
              {vasita ? (
                <>
                  <Link
                    href="/talepler"
                    onClick={kapat}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '11px 16px',
                      color: colors.ink,
                      fontSize: 14.5,
                      fontWeight: 800,
                    }}
                  >
                    Tüm vasıta talepleri
                  </Link>
                  {kategoriler.map((c, i) => (
                    <Link
                      key={c.slug}
                      href={`/talepler?kategori=${c.slug}`}
                      onClick={kapat}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 16px',
                        color: colors.ink,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          flex: 'none',
                          width: 30,
                          height: 30,
                          borderRadius: 'calc(var(--rr-buton-kose) * 9 / 14)',
                          // Kare, noktanın renginin açık tonu
                          background:
                            TINTS[(DOTS as readonly string[]).indexOf(c.color)] ?? TINTS[i % TINTS.length],
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color }} />
                      </span>
                      <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{c.name}</span>
                    </Link>
                  ))}
                </>
              ) : null}
              <p style={{ ...baslik, margin: '10px 16px 4px' }}>Diğer</p>
              {YAKINDA.map((y) => (
                <div
                  key={y}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    fontSize: 14.5,
                    fontWeight: 600,
                    color: colors.muted,
                  }}
                >
                  {y}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 'var(--rr-etiket-kose)',
                      background: '#F3F5FA',
                      color: colors.muted,
                    }}
                  >
                    Yakında
                  </span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #EEF0F5', padding: '8px 0 24px' }}>
              {BAGLANTILAR.map((b) => (
                <Link
                  key={b.href}
                  href={b.href}
                  onClick={kapat}
                  style={{
                    display: 'block',
                    padding: '9px 16px',
                    fontSize: 14,
                    fontWeight: 700,
                    color: colors.ink,
                  }}
                >
                  {b.ad}
                </Link>
              ))}
              <p style={{ margin: '6px 16px 0', fontSize: 11.5, color: colors.muted }}>
                <Link href="/kullanim-kosullari" onClick={kapat} style={{ color: colors.muted }}>
                  Kullanım koşulları
                </Link>
                {' · '}
                <Link href="/kvkk" onClick={kapat} style={{ color: colors.muted }}>
                  Aydınlatma metni
                </Link>
                {' · '}
                <Link href="/cerez-aydinlatma" onClick={kapat} style={{ color: colors.muted }}>
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
