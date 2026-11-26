import type { ReactNode } from 'react';
import stil from './giris-cerceve.module.css';
import { Logo } from './logo';

/** Giriş ve üyelik çerçevesi (tasarım: Giris.dc.html): yalnızca logolu üst çubuk, alt bilgi yok. */
export function GirisCerceve({ children }: { children: ReactNode }) {
  return (
    <div className={stil.kutu1}>
      <header className={stil.kutu2}>
        <div className={`rr-sayfa ${stil.kutu3}`}>
          <span className={stil.metin1}>
            <Logo />
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}
