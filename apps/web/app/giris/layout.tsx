import { colors } from '@rengarenk/shared';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Logo } from '../../components/logo';

export const metadata: Metadata = { title: 'Rengarenk · Giriş yap veya üye ol' };

/** Giriş çerçevesi (tasarım: Giris.dc.html): yalnızca logolu üst çubuk, alt bilgi yok. */
export default function GirisLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: '#F6F8FD', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: colors.surface, borderBottom: `1px solid ${colors.line}` }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '16px 24px' }}>
          <span style={{ display: 'inline-flex' }}>
            <Logo />
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}
