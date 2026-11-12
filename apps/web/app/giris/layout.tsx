import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GirisCerceve } from '../../components/giris-cerceve';

export const metadata: Metadata = { title: 'Rengarenk · Giriş yap' };

/** Giriş çerçevesi (tasarım: Giris.dc.html): yalnızca logolu üst çubuk, alt bilgi yok. */
export default function GirisLayout({ children }: { children: ReactNode }) {
  return <GirisCerceve>{children}</GirisCerceve>;
}
