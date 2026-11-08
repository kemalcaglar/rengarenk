import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getClientFlags } from '../lib/bakim';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rengarenk · Aradığın aracı söyle, satıcı seni bulsun',
  description: 'Tersine ilan: talebini yaz, uygun aracı olan galeriler sana yazsın.',
};

/** Kök çerçeve: yazı tipi, bakım duyurusu ve tam bakım ekranı. Sayfa çerçeveleri (site) ve giris'te. */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const durum = await getClientFlags();
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
      {/* Tarayıcı eklentileri (ör. ColorZilla) <body>'ye nitelik ekliyor; yalnızca bu etiketin uyarısı susturulur */}
      <body suppressHydrationWarning>
        {durum?.duyuru ? (
          <div role="status" className="duyuru">
            {durum.duyuru}
          </div>
        ) : null}
        {durum?.bakim.tum ? (
          <main style={{ padding: '64px 24px' }}>
            <div className="card" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
              <h1 style={{ marginTop: 0 }}>Kısa bir bakımdayız</h1>
              <p className="muted">{durum.duyuru}</p>
            </div>
          </main>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
