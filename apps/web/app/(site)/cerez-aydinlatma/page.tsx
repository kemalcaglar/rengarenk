import type { Metadata } from 'next';
import { YasalMetin } from '../../../components/yasal-metin';

export const metadata: Metadata = { title: 'Rengarenk · Çerez politikası' };

export default function Page() {
  return <YasalMetin textKey="cerez_politikasi" />;
}
