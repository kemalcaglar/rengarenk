import Link from 'next/link';

/** Hesabım menüsü (Taleplerim.dc.html, Favoriler.dc.html). Henüz yapılmamış ekranlar soluk ve tıklanmaz. */
export const OGELER: { ad: string; href?: string }[] = [
  { ad: 'Taleplerim', href: '/taleplerim' },
  { ad: 'Mesajlarım', href: '/mesajlarim' },
  { ad: 'Favoriler ve aramalar', href: '/favoriler' },
  { ad: 'Haklarım ve ödemeler', href: '/haklarim' },
  { ad: 'Bildirimler', href: '/bildirimler' },
  { ad: 'Ayarlar', href: '/ayarlar' },
  { ad: 'Yardım', href: '/yardim' },
  // Tasarımda yok: galeri paneline ya da kurumsal başvuruya giriş (Karar 03)
  { ad: 'Kurumsal hesap', href: '/galeri-paneli' },
];

export function HesabimMenu({ aktif }: { aktif: string }) {
  return (
    <nav
      aria-label="Hesabım"
      style={{
        flex: '1 1 220px',
        maxWidth: 250,
        minWidth: 0,
        background: '#FFFFFF',
        border: '1px solid #E3E6EF',
        borderRadius: 18,
        padding: 12,
      }}
    >
      <span
        style={{
          display: 'block',
          padding: '8px 10px 10px',
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: '#5A6073',
        }}
      >
        Hesabım
      </span>
      {OGELER.map((o) =>
        o.href ? (
          <Link
            key={o.ad}
            href={o.href}
            aria-current={o.href === aktif ? 'page' : undefined}
            style={{
              display: 'block',
              background: o.href === aktif ? '#EEF3FF' : 'transparent',
              borderRadius: 12,
              padding: '11px 12px',
              fontSize: 14.5,
              fontWeight: o.href === aktif ? 800 : 600,
              color: o.href === aktif ? '#1E2333' : '#3A4052',
              textDecoration: 'none',
            }}
          >
            {o.ad}
          </Link>
        ) : (
          <span
            key={o.ad}
            style={{
              display: 'block',
              borderRadius: 12,
              padding: '11px 12px',
              fontSize: 14.5,
              fontWeight: 600,
              color: '#8A91A3',
            }}
          >
            {o.ad}
          </span>
        ),
      )}
    </nav>
  );
}
