import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getMe } from '../../lib/oturum';
import { Logo } from '../logo';
import { Kabuk } from './kabuk';

/** Konsolun tüm sayfaları: oturum yoksa ya da kapandıysa girişe döner. */
export default async function KonsolLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  if (!me) redirect('/giris');
  return (
    <Kabuk me={me} logo={<Logo />}>
      {children}
    </Kabuk>
  );
}
