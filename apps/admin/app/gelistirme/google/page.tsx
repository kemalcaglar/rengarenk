import { notFound } from 'next/navigation';
import { SahteGoogle } from './sahte-google';

/**
 * Yalnızca geliştirme: Google Workspace hesabı açılana kadar Google girişini taklit eder
 * (API'de STAFF_AUTH_PROVIDER=fake). Canlıda bu sayfa yoktur ve API sahte sağlayıcıyı kabul etmez.
 */
export default async function Gelistirme({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; redirect_uri?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { state, redirect_uri } = await searchParams;
  if (!state || !redirect_uri) notFound();
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <SahteGoogle state={state} redirectUri={redirect_uri} />
    </main>
  );
}
