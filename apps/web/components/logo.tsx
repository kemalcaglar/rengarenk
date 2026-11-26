import Link from 'next/link';
import { colors } from '../lib/renk';
import stil from './logo.module.css';

const BARS = [colors.blue, colors.pink, colors.yellow, colors.green];

/** Dört renkli çubuk ve "rengarenk" yazısı (tasarım: bütün web ekranlarının üst çubuğu) */
export function Logo() {
  return (
    <Link href="/" className={`rr-logo ${stil.bag1}`} aria-label="Rengarenk ana sayfa">
      <span className={stil.metin1} aria-hidden="true">
        {BARS.map((c) => (
          <span key={c} className={stil.metin2} style={{ background: c }} />
        ))}
      </span>
      <span className={stil.metin3}>rengarenk</span>
    </Link>
  );
}
