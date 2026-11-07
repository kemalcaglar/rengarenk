import type { ReactNode } from 'react';
import { CerezBandi } from '../../components/cerez-bandi';
import { SiteFooter } from '../../components/site-footer';
import { SiteHeader } from '../../components/site-header';

/** Sitenin ortak çerçevesi (tasarım: Anasayfa.dc.html): üst çubuk, içerik, alt bilgi, çerez bandı. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: '#F6F8FD', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader />
      <div style={{ flex: 1 }}>{children}</div>
      <SiteFooter />
      <CerezBandi />
    </div>
  );
}
