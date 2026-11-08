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

type Item =
  | { href: string; ad: string; izin?: Permission; rozet?: 'onay' | 'entegrasyon' | 'basvuru' | 'moderasyon' }
  | { ad: string; sonra: true };

/**
 * Menü tasarımla birebir (YonetimEkip.dc.html, MENU): sekiz grup, aynı sırayla. Henüz yazılmamış ekranlar
 * tasarımın "sonra" biçiminde soluk ve tıklanmaz görünür (sahip kararı, 8 Kasım 2026).
 */
const MENU: { grup: string; ogeler: Item[] }[] = [
  {
    grup: 'Genel',
    ogeler: [
      { ad: 'Rengarenk Ajanı', sonra: true },
      { href: '/onaylar', ad: 'Onay kuyruğu', rozet: 'onay' },
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
      {
        href: '/galeri-basvurulari',
        ad: 'Galeri başvuruları',
        izin: 'galeri_basvuru.onayla',
        rozet: 'basvuru',
      },
      { href: '/moderasyon', ad: 'Moderasyon', izin: 'sikayet.coz', rozet: 'moderasyon' },
      { ad: 'Destek', sonra: true },
      { ad: 'Talepler ve portföy', sonra: true },
      { href: '/puan', ad: 'Satıcı puanı ve rozetler', izin: 'rapor.gor' },
      { href: '/odemeler', ad: 'Ödemeler ve faturalar', izin: 'rapor.gor' },
    ],
  },
  {
    grup: 'Büyüme',
    ogeler: [
      { ad: 'Raporlar', sonra: true },
      { ad: 'Zamanlanmış raporlar', sonra: true },
      { ad: 'Kampanyalar', sonra: true },
      { href: '/akislar', ad: 'Otomatik akışlar', izin: 'rapor.gor' },
      { ad: 'Segmentler', sonra: true },
      { href: '/sablonlar', ad: 'Şablonlar', izin: 'rapor.gor' },
      { href: '/bildirim-merkezi', ad: 'Bildirim merkezi', izin: 'rapor.gor' },
      { href: '/teslim-raporu', ad: 'Teslim raporu', izin: 'rapor.gor' },
    ],
  },
  {
    grup: 'Katalog',
    ogeler: [
      { href: '/kategoriler', ad: 'Kategoriler ve alanlar', izin: 'kategori.ayarla' },
      { href: '/eslestirme', ad: 'Eşleştirme ayarı', izin: 'kategori.ayarla' },
    ],
  },
  {
    grup: 'Görünüm',
    ogeler: [
      { ad: 'Ana sayfa düzeni', sonra: true },
      { ad: 'Banner ve vitrin', sonra: true },
      { ad: 'Açılış sayfaları', sonra: true },
      { ad: 'Tasarım değerleri', sonra: true },
      { ad: 'Yardım ve yasal metinler', sonra: true },
    ],
  },
  {
    grup: 'Sistem',
    ogeler: [
      { ad: 'Kurallar ve fiyatlar', sonra: true },
      { href: '/entegrasyonlar', ad: 'Entegrasyonlar', izin: 'kategori.ayarla', rozet: 'entegrasyon' },
      { href: '/sistem', ad: 'Özellik anahtarları ve bakım', izin: 'sistem.ayarla' },
      { ad: 'Yapay zekâ ve bütçe', sonra: true },
      { ad: 'Sistem sağlığı ve yedek', sonra: true },
    ],
  },
  {
    grup: 'Uyum ve KVKK',
    ogeler: [
      { ad: 'KVKK başvuruları', sonra: true },
      { ad: 'Saklama, imha ve VERBİS', sonra: true },
      { ad: 'Rıza ve çerez kayıtları', sonra: true },
      { ad: 'İhlal ve resmi talepler', sonra: true },
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
              <Link className="k-pending" href="/onaylar">
                Onayını bekleyen {me.pendingApprovals}
              </Link>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="k-avatar" aria-hidden="true">
                  {bas(me.name)}
                </span>
                <span>
                  <strong>Sen</strong> · {me.roleName}
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
                      <Link
                        key={i.href}
                        href={i.href}
                        aria-current={path === i.href || path.startsWith(`${i.href}/`) ? 'page' : undefined}
                      >
                        {i.ad}
                        {i.rozet === 'onay' ? (
                          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#7A5300' }}>
                            {me.pendingApprovals}
                          </span>
                        ) : null}
                        {i.rozet === 'basvuru' && me.pendingGalleryApplications > 0 ? (
                          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#7A5300' }}>
                            {me.pendingGalleryApplications}
                          </span>
                        ) : null}
                        {i.rozet === 'moderasyon' && me.overdueReports > 0 ? (
                          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#A3271F' }}>
                            {me.overdueReports} süre aştı
                          </span>
                        ) : null}
                        {i.rozet === 'entegrasyon' && me.integrationWarnings > 0 ? (
                          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#7A5300' }}>
                            {me.integrationWarnings} uyarı
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
