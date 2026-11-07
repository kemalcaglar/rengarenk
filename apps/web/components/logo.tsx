import { colors } from '@rengarenk/shared';
import Link from 'next/link';

const BARS = [colors.blue, colors.pink, colors.yellow, colors.green];

/** Dört renkli çubuk ve "rengarenk" yazısı (tasarım: bütün web ekranlarının üst çubuğu) */
export function Logo() {
  return (
    <Link
      href="/"
      style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.ink, textDecoration: 'none' }}
      aria-label="Rengarenk ana sayfa"
    >
      <span style={{ display: 'flex', gap: 3 }} aria-hidden="true">
        {BARS.map((c) => (
          <span key={c} style={{ width: 10, height: 22, borderRadius: 5, background: c }} />
        ))}
      </span>
      <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>rengarenk</span>
    </Link>
  );
}
