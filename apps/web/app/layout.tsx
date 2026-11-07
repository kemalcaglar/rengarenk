import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rengarenk · Aradığın aracı söyle, satıcı seni bulsun',
  description: 'Tersine ilan: talebini yaz, uygun aracı olan galeriler sana yazsın.',
};

const BARS = ['var(--blue)', 'var(--pink)', 'var(--yellow)', 'var(--green)'];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap"
        />
      </head>
      <body>
        <header className="bar">
          <div
            className="wrap"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}
          >
            <Link href="/" className="brand" aria-label="Rengarenk ana sayfa">
              <span aria-hidden="true">
                {BARS.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
              rengarenk
            </Link>
            <Link href="/giris" className="btn" style={{ padding: '10px 16px' }}>
              Giriş yap
            </Link>
          </div>
        </header>
        <main className="wrap" style={{ padding: '32px 24px 64px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
