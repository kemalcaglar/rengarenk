import type { Metadata } from 'next';
import { YasalMetin } from '../../../components/yasal-metin';

export const metadata: Metadata = { title: 'Rengarenk · Ön bilgilendirme formu' };

/** Ön bilgilendirme formu (Karar 39): her web ödemesinde sepetin içeriğiyle doldurulur ve onaylanır */
export default function Page() {
  return <YasalMetin textKey="on_bilgilendirme" />;
}
