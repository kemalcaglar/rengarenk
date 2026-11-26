import Link from 'next/link';
import stil from './not-found.module.css';

/** Bulunamayan sayfa: sitenin çerçevesi içinde, tasarımın kart ölçüleriyle. */
export default function NotFound() {
  return (
    <main className={`rr-sayfa ${stil.kutu1}`}>
      <section className={stil.kutu2}>
        <h1 className={stil.baslik1}>Sayfa bulunamadı</h1>
        <p className={stil.metin1}>Aradığın sayfa kaldırılmış ya da henüz yayında değil.</p>
        <Link href="/" className={stil.bag1}>
          Ana sayfaya dön
        </Link>
      </section>
    </main>
  );
}
