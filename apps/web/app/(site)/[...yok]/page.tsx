import { notFound } from 'next/navigation';

/** Tanımsız adresler sitenin çerçevesindeki "bulunamadı" sayfasına düşer. */
export default function Yok() {
  notFound();
}
