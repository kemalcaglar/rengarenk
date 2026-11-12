import { designCssVars } from '@rengarenk/shared';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Banner } from '../components/banner';
import { Olcum } from '../components/olcum';
import { YasalOnay } from '../components/yasal-onay';
import { getClientFlags, getDesign } from '../lib/bakim';
import './globals.css';
import './telefon.css';

export const metadata: Metadata = {
  title: 'Rengarenk · Aradığın aracı söyle, satıcı seni bulsun',
  description: 'Tersine ilan: talebini yaz, uygun aracı olan galeriler sana yazsın.',
};

/** Kök çerçeve: yazı tipi, bakım duyurusu ve tam bakım ekranı. Sayfa çerçeveleri (site) ve giris'te. */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const [durum, tasarim] = await Promise.all([getClientFlags(), getDesign()]);
  // Tasarım değerleri (Karar 46): renkler, yazı tipi, köşeler ve mevsimsel tema CSS değişkeni olarak
  const degiskenler = Object.entries(designCssVars(tasarim.degerler, tasarim.tema))
    .map(([k, v]) => `${k}:${v.replace(/[<>{};]/g, '')}`)
    .join(';');
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href={tasarim.font.css} />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: değerler API'nin doğruladığı renk ve sayılar; < > { } ; ayıklanır */}
        <style dangerouslySetInnerHTML={{ __html: `:root{${degiskenler}}` }} />
      </head>
      {/* Tarayıcı eklentileri (ör. ColorZilla) <body>'ye nitelik ekliyor; yalnızca bu etiketin uyarısı susturulur */}
      <body suppressHydrationWarning>
        <Olcum />
        <YasalOnay />
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
          <>
            <Banner yer="ust_serit" />
            {children}
          </>
        )}
      </body>
    </html>
  );
}
