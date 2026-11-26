import type { ReactNode } from 'react';
import { CerezBandi } from '../../components/cerez-bandi';
import { SiteFooter } from '../../components/site-footer';
import { SiteHeader } from '../../components/site-header';
import stil from './layout.module.css';

/** Sitenin ortak çerçevesi (tasarım: Anasayfa.dc.html): üst çubuk, içerik, alt bilgi, çerez bandı. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className={stil.kutu1}>
      <SiteHeader />
      <div className={stil.kutu2}>{children}</div>
      <SiteFooter />
      <CerezBandi />
    </div>
  );
}
