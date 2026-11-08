import type { Metadata } from 'next';
import { YasalMetin } from '../../../components/yasal-metin';

export const metadata: Metadata = { title: 'Rengarenk · Mesafeli hizmet sözleşmesi' };

/** Mesafeli hizmet sözleşmesi (Karar 39): ödeme ekranındaki onayla kurulur */
export default function Page() {
  return <YasalMetin textKey="mesafeli_sozlesme" />;
}
