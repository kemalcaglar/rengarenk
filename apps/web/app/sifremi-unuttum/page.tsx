'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { Bilgi, field, GirisDuzeni, Hata, h1, label, lead, post, primary } from '../../components/giris-ui';

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
      <h1 id="form-baslik" style={h1}>
        Şifremi unuttum
      </h1>
      <p style={lead}>Üye olduğun e-posta adresini yaz; şifreni sıfırlaman için bir bağlantı gönderelim.</p>
      {gonderildi ? (
        <Bilgi>
          Bu adres kayıtlıysa şifre sıfırlama bağlantısını gönderdik. Gelen kutunu (ve istenmeyen klasörünü)
          kontrol et; bağlantı 1 saat geçerli.
        </Bilgi>
      ) : (
        <form onSubmit={gonder}>
          <label htmlFor="eposta" style={label}>
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
            style={field}
          />
          <button type="submit" disabled={busy} style={{ ...primary(true), marginTop: 20 }}>
            {busy ? 'Gönderiliyor…' : 'Bağlantı gönder'}
          </button>
          <Hata>{error}</Hata>
        </form>
      )}
      <p style={{ margin: '18px 0 0', fontSize: 14.5 }}>
        <Link href="/giris" style={{ fontWeight: 700 }}>
          Giriş sayfasına dön
        </Link>
      </p>
    </GirisDuzeni>
  );
}
