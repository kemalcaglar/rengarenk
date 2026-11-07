import { VEHICLE_CATEGORIES } from '@rengarenk/shared';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function apiStatus(): Promise<string> {
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/health`, {
      cache: 'no-store',
    });
    return r.ok ? 'çalışıyor' : `hata (${r.status})`;
  } catch {
    return 'ulaşılamıyor';
  }
}

export default async function Home() {
  const status = await apiStatus();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)', gap: 24 }}>
      <aside className="card" style={{ padding: 18 }}>
        <p
          style={{
            margin: '0 0 8px',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 1,
            color: 'var(--muted)',
          }}
        >
          KATEGORİLER
        </p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {VEHICLE_CATEGORIES.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/kategori/${c.slug}`}
                style={{ display: 'block', padding: '7px 6px', color: 'var(--ink)' }}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section>
        <div className="card" style={{ background: 'var(--ink)', color: '#fff', border: 0 }}>
          <h1 style={{ margin: 0, fontSize: 30 }}>Aradığın aracı yaz, satıcılar sana gelsin.</h1>
          <p style={{ color: '#c9cedb' }}>
            İlan arama yok. Talebini bir kez oluştur; uygun aracı olan galeriler sana yazsın.
          </p>
          <Link href="/giris" className="btn" style={{ display: 'inline-block' }}>
            Talep oluştur · ilk talep ücretsiz
          </Link>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          Geliştirme iskeleti · API durumu: <strong>{status}</strong>
        </p>
      </section>
    </div>
  );
}
