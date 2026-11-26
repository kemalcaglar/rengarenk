import { redirect } from 'next/navigation';
import { getMe } from '../../lib/oturum';
import { Logo } from '../logo';
import stil from './page.module.css';

/** Yönetim girişi (T10): şirket Google hesabı, ardından zorunlu doğrulama uygulaması kodu. */
export default async function Giris({ searchParams }: { searchParams: Promise<{ hata?: string }> }) {
  if (await getMe()) redirect('/');
  const { hata } = await searchParams;
  return (
    <main className={stil.kutu1}>
      <div className={`card ${stil.kutu2}`}>
        <Logo />
        <div>
          <h1 className={stil.baslik1}>Yönetim konsoluna giriş</h1>
          <p className={`muted ${stil.metin1}`}>
            Şirket Google hesabınla giriş yap. İki adımlı doğrulama zorunludur; 30 dakika işlem yapmazsan
            oturum kapanır.
          </p>
        </div>
        {hata ? (
          <p className={`k-error ${stil.metin2}`} role="alert">
            {hata}
          </p>
        ) : null}
        <a className={`k-btn ${stil.bag1}`} href="/api/oturum/google">
          Google Workspace ile giriş yap
        </a>
      </div>
    </main>
  );
}
