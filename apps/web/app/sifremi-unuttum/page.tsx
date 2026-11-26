'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { Bilgi, GirisDuzeni, Hata, post, primary } from '../../components/giris-ui';
import stil from './page.module.css';

/**
 * Şifremi unuttum (Karar 18): adres kayıtlıysa e-postaya 1 saat geçerli, tek kullanımlık bağlantı gider. Yanıt her
 * durumda aynıdır (adresin kayıtlı olup olmadığı anlaşılmaz).
 */
export default function SifremiUnuttum() {
  const [eposta, setEposta] = useState('');
  const [busy, setBusy] = useState(false);
  const [gonderildi, setGonderildi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function gonder(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    post('/auth/password/forgot', { eposta })
      .then(() => setGonderildi(true))
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  }

  return (
    <GirisDuzeni baslikId="form-baslik">
      <h1 id="form-baslik" className={stil.baslik1}>
        Şifremi unuttum
      </h1>
      <p className={stil.metin1}>
        Üye olduğun e-posta adresini yaz; şifreni sıfırlaman için bir bağlantı gönderelim.
      </p>
      {gonderildi ? (
        <Bilgi>
          Bu adres kayıtlıysa şifre sıfırlama bağlantısını gönderdik. Gelen kutunu (ve istenmeyen klasörünü)
          kontrol et; bağlantı 1 saat geçerli.
        </Bilgi>
      ) : (
        <form onSubmit={gonder}>
          <label htmlFor="eposta" className={stil.etiket1}>
            E-posta
          </label>
          <input
            id="eposta"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={eposta}
            onChange={(e) => setEposta(e.target.value)}
            required
            className={stil.girdi1}
          />
          <button type="submit" disabled={busy} style={{ ...primary(true), marginTop: 20 }}>
            {busy ? 'Gönderiliyor…' : 'Bağlantı gönder'}
          </button>
          <Hata>{error}</Hata>
        </form>
      )}
      <p className={stil.metin2}>
        <Link href="/giris" className={stil.bag1}>
          Giriş sayfasına dön
        </Link>
      </p>
    </GirisDuzeni>
  );
}
