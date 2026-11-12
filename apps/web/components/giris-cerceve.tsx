import type { ReactNode } from 'react';
import { colors } from '../lib/renk';
import { Logo } from './logo';

/** Giriş ve üyelik çerçevesi (tasarım: Giris.dc.html): yalnızca logolu üst çubuk, alt bilgi yok. */
export function GirisCerceve({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--rr-zemin, #F6F8FD)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header style={{ background: colors.surface, borderBottom: `1px solid ${colors.line}` }}>
        <div className="rr-sayfa" style={{ maxWidth: 1360, margin: '0 auto', padding: '16px 24px' }}>
          <span style={{ display: 'inline-flex' }}>
            <Logo />
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}
