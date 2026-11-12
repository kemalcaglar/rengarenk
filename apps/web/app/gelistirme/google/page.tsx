import { notFound } from 'next/navigation';
import { GirisCerceve } from '../../../components/giris-cerceve';
import { SahteGoogle } from './sahte-google';

/**
 * Yalnızca geliştirme: Google ile üye girişini taklit eder (API'de USER_AUTH_PROVIDER=fake). Canlıda bu sayfa yoktur
 * ve API sahte sağlayıcıyı kabul etmez (env.ts).
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
    <GirisCerceve>
      <main style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24 }}>
        <SahteGoogle state={state} redirectUri={redirect_uri} />
      </main>
    </GirisCerceve>
  );
}
