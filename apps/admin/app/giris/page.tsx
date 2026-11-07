import { redirect } from 'next/navigation';
import { getMe } from '../../lib/oturum';
import { Logo } from '../logo';

/** Yönetim girişi (T10): şirket Google hesabı, ardından zorunlu doğrulama uygulaması kodu. */
export default async function Giris({ searchParams }: { searchParams: Promise<{ hata?: string }> }) {
  if (await getMe()) redirect('/');
  const { hata } = await searchParams;
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', display: 'grid', gap: 16 }}>
        <Logo />
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Yönetim konsoluna giriş</h1>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>
            Şirket Google hesabınla giriş yap. İki adımlı doğrulama zorunludur; 30 dakika işlem yapmazsan
            oturum kapanır.
          </p>
        </div>
        {hata ? (
          <p className="k-error" role="alert" style={{ margin: 0 }}>
            {hata}
          </p>
        ) : null}
        <a className="k-btn" href="/api/oturum/google" style={{ textAlign: 'center' }}>
          Google Workspace ile giriş yap
        </a>
      </div>
    </main>
  );
}
