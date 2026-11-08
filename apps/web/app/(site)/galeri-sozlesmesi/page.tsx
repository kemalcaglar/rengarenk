import type { Metadata } from 'next';
import { YasalMetin } from '../../../components/yasal-metin';

export const metadata: Metadata = { title: 'Rengarenk · Galeri hizmet sözleşmesi' };

/** Galeri hizmet sözleşmesi (Karar 39): kurumsal başvuruda onaylanır */
export default function Page() {
  return <YasalMetin textKey="galeri_sozlesmesi" />;
}
