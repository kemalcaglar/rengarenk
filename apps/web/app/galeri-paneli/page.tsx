import type { Metadata } from 'next';
import { GaleriPaneli } from './panel';

export const metadata: Metadata = { title: 'Galeri paneli · Rengarenk' };

/** Galeri paneli (tasarım: GaleriPanel.dc.html). Kendi üst bilgisi vardır. */
export default function Sayfa() {
  return <GaleriPaneli />;
}
