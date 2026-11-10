import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategories } from '../../../../lib/kategoriler';
import { TalepDetay, type TalepVeri } from './detay';

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
    <main
      style={{
        maxWidth: 1360,
        margin: '0 auto',
        padding: '24px 24px 64px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: 24,
      }}
    >
      <aside
        aria-label="Kategoriler"
        style={{
          flex: '1 1 220px',
          maxWidth: 250,
          minWidth: 0,
          background: '#FFFFFF',
          border: '1px solid var(--rr-cizgi, #E3E6EF)',
          borderRadius: 'var(--rr-kart-kose)',
          padding: '18px 12px',
        }}
      >
        <h2
          style={{
            margin: '0 8px 12px',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: '#5A6073',
          }}
        >
          Kategoriler
        </h2>
        <Link
          href="/talepler"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 8px',
            fontSize: 15.5,
            fontWeight: 800,
            color: 'var(--rr-murekkep, #1E2333)',
            textDecoration: 'none',
          }}
        >
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
        <ul style={{ listStyle: 'none', margin: '0 0 8px', padding: 0 }}>
          {kategoriler
            .filter((c) => c.vertical === 'vasita')
            .map((c) => {
              const on = c.slug === kat?.slug;
              return (
                <li key={c.slug}>
                  <Link
                    href={`/talepler?kategori=${c.slug}`}
                    aria-current={on ? 'page' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 10px',
                      borderRadius: 10,
                      background: on ? '#EEF3FF' : 'transparent',
                      fontSize: 14,
                      fontWeight: on ? 700 : 500,
                      color: on ? 'var(--rr-murekkep, #1E2333)' : '#3A4052',
                      textDecoration: 'none',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, flex: 'none' }}
                    />
                    {c.name}
                  </Link>
                </li>
              );
            })}
        </ul>
        <div style={{ borderTop: '1px solid #EEF0F5', paddingTop: 8 }}>
          {['Emlak', 'İkinci el alışveriş'].map((ad) => (
            <span
              key={ad}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 8px',
                fontSize: 15.5,
                fontWeight: 700,
                color: '#6B7183',
              }}
            >
              {ad}
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#5A6073',
                  background: '#F3F5FA',
                  padding: '3px 8px',
                  borderRadius: 'var(--rr-etiket-kose)',
                }}
              >
                Yakında
              </span>
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
