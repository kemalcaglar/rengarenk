import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cx } from '../../../../lib/cx';
import { getCategories } from '../../../../lib/kategoriler';
import { TalepDetay, type TalepVeri } from './detay';
import stil from './page.module.css';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function talep(no: string): Promise<TalepVeri | null> {
  if (!/^\d{5,12}$/.test(no)) return null;
  const r = await fetch(`${API}/talepler/${no}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(4000),
  }).catch(() => null);
  return r?.ok ? ((await r.json()) as TalepVeri) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ no: string }> }): Promise<Metadata> {
  const t = await talep((await params).no);
  return { title: t ? `${t.baslik} · Rengarenk` : 'Talep bulunamadı · Rengarenk' };
}

/**
 * Talep detayı (onaylı referans tasarım: Main.dc.html; Karar 08, 11.4, 24, 29). Sunucuda çizilir; telefon
 * numarası yalnızca izin verildiyse ve giriş yapmış kullanıcıya görünür.
 */
export default async function TalepSayfasi({ params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const [t, kategoriler] = await Promise.all([talep(no), getCategories()]);
  if (!t) notFound();
  const benzer = await fetch(
    `${API}/talepler?${new URLSearchParams(
      t.gorunum.katalog.seri
        ? {
            kategori: t.category.slug,
            marka: t.data.alanlar.model ? String((t.data.alanlar.model as { make: string }).make) : '',
          }
        : { kategori: t.category.slug },
    ).toString()}&boyut=4`,
    { cache: 'no-store', signal: AbortSignal.timeout(3000) },
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  const kat = kategoriler.find(
    (c) => c.slug === t.category.slug || c.children.some((x) => x.slug === t.category.slug),
  );
  return (
    <main className={`rr-sayfa ${stil.kutu1}`}>
      {/* Telefonda kategoriler üst çubuktaki ☰ menüsünde; kenar çubuğu yalnızca geniş ekranda (ana sayfadaki gibi) */}
      <aside aria-label="Kategoriler" className={`rr-kenar ${stil.kutu2}`}>
        <h2 className={stil.baslik1}>Kategoriler</h2>
        <Link href="/talepler" className={stil.bag1}>
          Vasıta
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </Link>
        <ul className={stil.liste1}>
          {kategoriler
            .filter((c) => c.vertical === 'vasita')
            .map((c) => {
              const on = c.slug === kat?.slug;
              return (
                <li key={c.slug}>
                  <Link
                    href={`/talepler?kategori=${c.slug}`}
                    aria-current={on ? 'page' : undefined}
                    className={cx(stil.bag2, on ? stil.bag3 : stil.bag4)}
                  >
                    <span aria-hidden="true" className={stil.metin1} style={{ background: c.color }} />
                    {c.name}
                  </Link>
                </li>
              );
            })}
        </ul>
        <div className={stil.kutu3}>
          {['Emlak', 'İkinci el alışveriş'].map((ad) => (
            <span key={ad} className={stil.metin2}>
              {ad}
              <span className={stil.metin3}>Yakında</span>
            </span>
          ))}
        </div>
      </aside>
      <TalepDetay
        t={t}
        ustKategori={kat && kat.slug !== t.category.slug ? { slug: kat.slug, name: kat.name } : null}
        benzer={(
          (benzer?.sonuclar ?? []) as {
            no: number;
            baslik: string;
            il: string | null;
            yilMin: number | null;
            yilMax: number | null;
          }[]
        )
          .filter((b) => b.no !== t.no)
          .slice(0, 3)}
      />
    </main>
  );
}
