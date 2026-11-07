import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getClientFlags } from '../lib/bakim';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rengarenk · Aradığın aracı söyle, satıcı seni bulsun',
  description: 'Tersine ilan: talebini yaz, uygun aracı olan galeriler sana yazsın.',
};

const BARS = ['var(--blue)', 'var(--pink)', 'var(--yellow)', 'var(--green)'];

export default async function RootLayout({ children }: { children: ReactNode }) {
  const durum = await getClientFlags();
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
        {durum?.duyuru ? (
          <div role="status" className="duyuru">
            {durum.duyuru}
          </div>
        ) : null}
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
          {durum?.bakim.tum ? (
            <div className="card" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
              <h1 style={{ marginTop: 0 }}>Kısa bir bakımdayız</h1>
              <p className="muted">{durum.duyuru}</p>
            </div>
          ) : (
            children
          )}
        </main>
        <footer className="wrap" style={{ padding: '0 24px 32px', fontSize: 13 }}>
          <p className="muted" style={{ margin: 0 }}>
            <Link href="/veri-kaynaklari">Veri kaynakları</Link> ·{' '}
            <a href="https://vehiclesdb.com" rel="noreferrer">
              Vehicle data by VehiclesDB
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
