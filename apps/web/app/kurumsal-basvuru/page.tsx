import type { Metadata } from 'next';
import { KurumsalBasvuru } from './basvuru';

export const metadata: Metadata = { title: 'Kurumsal hesap başvurusu · Rengarenk' };

/** Kurumsal hesap başvurusu (Karar 03; tasarım: Basvuru.dc.html). Kendi üst bilgisi vardır. */
export default function Sayfa() {
  return <KurumsalBasvuru />;
}
