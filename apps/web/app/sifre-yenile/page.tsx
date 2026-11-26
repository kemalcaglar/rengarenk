'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { GirisDuzeni, Hata, post, primary } from '../../components/giris-ui';
import stil from './page.module.css';

/**
 * Yeni şifre (Karar 18): e-postadaki tek kullanımlık bağlantıdan gelinir. Şifre değişince bütün cihazlardaki oturumlar
 * kapanır ve kişi giriş sayfasına yönlenir.
 */
export default function SifreYenile() {
  const router = useRouter();
  const [kod, setKod] = useState<string | null>(null);
  const [sifre, setSifre] = useState('');
  const [tekrar, setTekrar] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setKod(new URLSearchParams(window.location.search).get('kod'));
  }, []);

  function kaydet(e: FormEvent) {
    e.preventDefault();
    if (sifre !== tekrar) {
      setError('Şifreler aynı değil');
      return;
    }
    setBusy(true);
    setError(null);
    post('/auth/password/reset', { kod, sifre })
      .then(() => router.push('/giris?sifre=yenilendi'))
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  }

  return (
    <GirisDuzeni baslikId="form-baslik">
      <h1 id="form-baslik" className={stil.baslik1}>
        Yeni şifre belirle
      </h1>
      <p className={stil.metin1}>
        Şifren değişince bütün cihazlarda oturumun kapanır; yeni şifrenle yeniden giriş yaparsın.
      </p>
      {kod === null ? null : kod ? (
        <form onSubmit={kaydet}>
          <label htmlFor="sifre" className={stil.etiket1}>
            Yeni şifre
          </label>
          <input
            id="sifre"
            type="password"
            autoComplete="new-password"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            required
            minLength={8}
            className={stil.girdi1}
          />
          <p className={stil.metin2}>En az 8 karakter; içinde harf ve rakam olsun.</p>
          <label htmlFor="tekrar" className={stil.etiket2}>
            Yeni şifre (tekrar)
          </label>
          <input
            id="tekrar"
            type="password"
            autoComplete="new-password"
            value={tekrar}
            onChange={(e) => setTekrar(e.target.value)}
            required
            className={stil.girdi1}
          />
          <button type="submit" disabled={busy} style={{ ...primary(true), marginTop: 20 }}>
            {busy ? 'Kaydediliyor…' : 'Şifremi değiştir'}
          </button>
          <Hata>{error}</Hata>
        </form>
      ) : (
        <Hata>
          Bağlantı eksik. E-postadaki düğmeye yeniden bas ya da{' '}
          <Link href="/sifremi-unuttum">yeni bağlantı iste</Link>.
        </Hata>
      )}
    </GirisDuzeni>
  );
}
