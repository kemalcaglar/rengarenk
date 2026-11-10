import Link from 'next/link';
import { colors } from '../../lib/renk';

/** Bulunamayan sayfa: sitenin çerçevesi içinde, tasarımın kart ölçüleriyle. */
export default function NotFound() {
  return (
    <main style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 24px 64px' }}>
      <section
        style={{
          maxWidth: 640,
          background: colors.surface,
          border: `1px solid ${colors.line}`,
          borderRadius: 22,
          padding: 32,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Sayfa bulunamadı</h1>
        <p style={{ margin: '10px 0 22px', fontSize: 15, lineHeight: 1.55, color: colors.inkSoft }}>
          Aradığın sayfa kaldırılmış ya da henüz yayında değil.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            background: colors.blue,
            color: colors.ink,
            fontWeight: 800,
            fontSize: 15,
            padding: '13px 20px',
            borderRadius: 'var(--rr-buton-kose)',
            textDecoration: 'none',
          }}
        >
          Ana sayfaya dön
        </Link>
      </section>
    </main>
  );
}
