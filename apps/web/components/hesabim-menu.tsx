import Link from 'next/link';
import { cx } from '../lib/cx';
import stil from './hesabim-menu.module.css';

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
      // Telefonda bu bağlantılar üst çubuktaki ☰ çekmecesinde (sayfada ikinci bir menü olmasın)
      className={`rr-yalniz-genis ${stil.kutu1}`}
    >
      <span className={`rr-serit-baslik ${stil.metin1}`}>Hesabım</span>
      {OGELER.map((o) =>
        o.href ? (
          <Link
            key={o.ad}
            href={o.href}
            aria-current={o.href === aktif ? 'page' : undefined}
            className={cx(stil.bag1, o.href === aktif ? stil.bag2 : stil.bag3)}
          >
            {o.ad}
          </Link>
        ) : (
          <span key={o.ad} className={`rr-serit-oge ${stil.metin2}`}>
            {o.ad}
          </span>
        ),
      )}
    </nav>
  );
}
