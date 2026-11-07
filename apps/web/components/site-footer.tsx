import { colors } from '@rengarenk/shared';
import Link from 'next/link';

/**
 * Alt bilgi (tasarım: Anasayfa.dc.html). "Veri kaynakları" ve VehiclesDB atfı tasarımda yok; açık veri
 * lisansları sitede görünür bir atıf istediği için aynı biçimde eklendi (CC BY 4.0).
 */
export function SiteFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${colors.line}`, background: colors.surface }}>
      <div
        style={{
          maxWidth: 1360,
          margin: '0 auto',
          padding: 24,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: 13.5,
          color: colors.muted,
        }}
      >
        <span>rengarenk · Aradığın aracı söyle, satıcı seni bulsun.</span>
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
          <Link href="/yardim">Yardım ve destek</Link>
          <Link href="/kullanim-kosullari">Kullanım koşulları</Link>
          <Link href="/kvkk">KVKK</Link>
          <Link href="/veri-kaynaklari">Veri kaynakları</Link>
          <a href="https://vehiclesdb.com" rel="noreferrer">
            Vehicle data by VehiclesDB
          </a>
        </span>
      </div>
    </footer>
  );
}
