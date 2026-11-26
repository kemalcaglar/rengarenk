import { notFound } from 'next/navigation';
import stil from './page.module.css';
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
    <main className={stil.kutu1}>
      <SahteGoogle state={state} redirectUri={redirect_uri} />
    </main>
  );
}
