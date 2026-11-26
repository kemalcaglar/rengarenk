import Link from 'next/link';
import { CerezTercihleri } from './cerez-tercihleri';
import stil from './site-footer.module.css';

/**
 * Alt bilgi (tasarım: Anasayfa.dc.html). "Veri kaynakları" ve VehiclesDB atfı tasarımda yok; açık veri
 * lisansları sitede görünür bir atıf istediği için aynı biçimde eklendi (CC BY 4.0). "Çerez tercihleri" de tasarımda yok;
 * reklam ölçümü izni her zaman geri alınabilsin diye eklendi (Karar 35, 59).
 */
export function SiteFooter() {
  return (
    <footer className={stil.kutu1}>
      <div className={stil.kutu2}>
        <span>rengarenk · Aradığın aracı söyle, satıcı seni bulsun.</span>
        <span className={stil.metin1}>
          <Link href="/yardim">Yardım ve destek</Link>
          <Link href="/kullanim-kosullari">Kullanım koşulları</Link>
          <Link href="/kvkk">KVKK</Link>
          <CerezTercihleri />
          <Link href="/veri-kaynaklari">Veri kaynakları</Link>
          <a href="https://vehiclesdb.com" rel="noreferrer">
            Vehicle data by VehiclesDB
          </a>
        </span>
      </div>
    </footer>
  );
}
