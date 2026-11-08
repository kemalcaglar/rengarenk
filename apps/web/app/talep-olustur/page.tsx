import type { Metadata } from 'next';
import { Sihirbaz } from '../../components/sihirbaz/sihirbaz';

export const metadata: Metadata = { title: 'Talep oluştur · Rengarenk' };

/** Talep oluşturma sihirbazı (Karar 21; tasarım: Sihirbaz.dc.html). Kendi üst bilgisi vardır. */
export default function TalepOlustur() {
  return <Sihirbaz />;
}
