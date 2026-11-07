import type { Metadata } from 'next';
import { YasalMetin } from '../../../components/yasal-metin';

export const metadata: Metadata = { title: 'Rengarenk · Kullanım koşulları' };

export default function Page() {
  return <YasalMetin textKey="kullanim_kosullari" />;
}
