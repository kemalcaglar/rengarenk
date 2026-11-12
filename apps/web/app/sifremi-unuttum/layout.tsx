import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GirisCerceve } from '../../components/giris-cerceve';

export const metadata: Metadata = { title: 'Rengarenk · Şifremi unuttum' };

export default function Layout({ children }: { children: ReactNode }) {
  return <GirisCerceve>{children}</GirisCerceve>;
}
