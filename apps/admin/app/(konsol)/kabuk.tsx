'use client';

import type { Permission } from '@rengarenk/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { bas, yonetim } from '../../lib/istemci';
import type { Me } from '../../lib/oturum';

const KonsolContext = createContext<{ me: Me; refresh: () => void } | null>(null);

export function useKonsol() {
  const c = useContext(KonsolContext);
  if (!c) throw new Error('useKonsol yalnızca konsol içinde kullanılır');
  return c;
}

type Item = { href: string; ad: string; izin?: Permission } | { ad: string; sonra: true };

/** Menü tasarımdaki gruplarla aynı; henüz yazılmamış ekranlar "yakında" olarak görünür. */
const MENU: { grup: string; ogeler: Item[] }[] = [
  {
    grup: 'Genel',
    ogeler: [
      { ad: 'Rengarenk Ajanı', sonra: true },
      { href: '/onaylar', ad: 'Onay kuyruğu' },
      { ad: 'Kontrol paneli', sonra: true },
    ],
  },
  {
    grup: 'Ekip',
    ogeler: [
      { href: '/calisanlar', ad: 'Çalışanlar', izin: 'ekip.yonet' },
      { href: '/roller', ad: 'Roller ve yetkiler', izin: 'ekip.yonet' },
      { href: '/islem-kaydi', ad: 'İşlem kaydı', izin: 'islem_kaydi.gor' },
    ],
  },
  {
    grup: 'Pazar',
    ogeler: [
      { ad: 'Kullanıcılar ve galeriler', sonra: true },
      { ad: 'Galeri başvuruları', sonra: true },
      { ad: 'Moderasyon', sonra: true },
      { ad: 'Destek', sonra: true },
    ],
  },
  {
    grup: 'Katalog',
    ogeler: [
      { ad: 'Kategoriler ve alanlar', sonra: true },
      { ad: 'Eşleştirme ayarı', sonra: true },
      { href: '/katalog', ad: 'Katalog kaynakları', izin: 'kategori.ayarla' },
      { href: '/katalog/ad-esleme', ad: 'Ad eşleme', izin: 'kategori.ayarla' },
    ],
  },
  {
    grup: 'Sistem',
    ogeler: [
      { ad: 'Entegrasyonlar', sonra: true },
      { href: '/sistem', ad: 'Özellik anahtarları ve bakım', izin: 'sistem.ayarla' },
      { ad: 'Yapay zekâ ve bütçe', sonra: true },
    ],
  },
];

/**
 * Konsol kabuğu. 30 dakika işlem yapılmazsa API oturumu kapatır (Karar 40); burada da süre sayılır,
 * bitmeden 5 dakika önce uyarı çıkar ve süre dolunca giriş sayfasına dönülür.
 */
export function Kabuk({ me: initial, logo, children }: { me: Me; logo: ReactNode; children: ReactNode }) {
  const [me, setMe] = useState(initial);
  const path = usePathname();
  const [warn, setWarn] = useState(false);
  const last = useRef(Date.now());

  const refresh = useCallback(() => {
    yonetim<Me>('me')
      .then(setMe)
      .catch(() => undefined);
  }, []);

  // Sayfa değişimi bir işlemdir: hareketsizlik sayacı sıfırlanır.
  // biome-ignore lint/correctness/useExhaustiveDependencies: path yalnızca tetikleyici
  useEffect(() => {
    last.current = Date.now();
    setWarn(false);
  }, [path]);

  useEffect(() => {
    const touch = () => {
      last.current = Date.now();
      setWarn(false);
    };
    window.addEventListener('rr-etkinlik', touch);
    const idleMs = me.idleMinutes * 60_000;
    const t = setInterval(() => {
      const idle = Date.now() - last.current;
      if (idle >= idleMs) {
        window.location.href = `/giris?hata=${encodeURIComponent(`${me.idleMinutes} dakika işlem yapılmadığı için oturum kapandı`)}`;
      } else if (idle >= idleMs - 5 * 60_000) {
        setWarn(true);
      }
    }, 15_000);
    return () => {
      window.removeEventListener('rr-etkinlik', touch);
      clearInterval(t);
    };
  }, [me.idleMinutes]);

  async function logout() {
    await fetch('/api/oturum/cikis', { method: 'POST' }).catch(() => undefined);
    window.location.href = '/giris';
  }

  return (
    <KonsolContext.Provider value={{ me, refresh }}>
      <div style={{ minHeight: '100vh' }}>
        <header className="k-top">
          <div className="k-top-in">
            {logo}
            <span className="k-user">
              {me.pendingApprovals > 0 ? (
                <Link className="k-pending" href="/onaylar">
                  Onayını bekleyen {me.pendingApprovals}
                </Link>
              ) : null}
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="k-avatar" aria-hidden="true">
                  {bas(me.name)}
                </span>
                <span>
                  <strong>{me.name}</strong> · {me.roleName}
                </span>
              </span>
              <button className="k-link" type="button" onClick={logout}>
                Çıkış
              </button>
            </span>
          </div>
        </header>
        {warn ? (
          <div className="k-body" style={{ paddingBottom: 0 }}>
            <p className="k-note" role="status" style={{ margin: 0, flex: '1 1 100%' }}>
              İşlem yapmazsan oturumun birkaç dakika içinde kapanacak.{' '}
              <button className="k-link" type="button" onClick={refresh}>
                Oturumu sürdür
              </button>
            </p>
          </div>
        ) : null}
        <div className="k-body">
          <nav className="k-nav" aria-label="Yönetim konsolu">
            {MENU.map((g) => {
              const items = g.ogeler.filter((i) => 'sonra' in i || !i.izin || me.permissions[i.izin]);
              if (items.length === 0) return null;
              return (
                <div key={g.grup}>
                  <span className="k-nav-group">{g.grup}</span>
                  {items.map((i) =>
                    'sonra' in i ? (
                      <span key={i.ad} className="k-soon">
                        {i.ad}
                        <span>yakında</span>
                      </span>
                    ) : (
                      <Link key={i.href} href={i.href} aria-current={path === i.href ? 'page' : undefined}>
                        {i.ad}
                        {i.href === '/onaylar' && me.pendingApprovals > 0 ? (
                          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#7A5300' }}>
                            {me.pendingApprovals}
                          </span>
                        ) : null}
                      </Link>
                    ),
                  )}
                </div>
              );
            })}
          </nav>
          <main className="k-main">{children}</main>
        </div>
      </div>
    </KonsolContext.Provider>
  );
}
