'use client';

import { type FormEvent, useState } from 'react';

const toBase64Url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** Sahte Google hesap seçicisi (geliştirme). Seçilen e-posta, yetki kodunun içine yazılır. */
export function SahteGoogle({ state, redirectUri }: { state: string; redirectUri: string }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const target = new URL(redirectUri, window.location.origin);
    // Yalnızca bu konsola geri dönülür.
    if (target.origin !== window.location.origin) {
      setError('Dönüş adresi bu konsola ait değil');
      return;
    }
    target.searchParams.set('state', state);
    target.searchParams.set(
      'code',
      `fake.${toBase64Url(JSON.stringify({ email: email.trim().toLowerCase() }))}`,
    );
    window.location.href = target.toString();
  }

  return (
    <form
      onSubmit={submit}
      className="card"
      style={{ maxWidth: 420, width: '100%', display: 'grid', gap: 14 }}
    >
      <p className="k-note" style={{ margin: 0 }}>
        Geliştirme ortamı: Google girişi taklit ediliyor. Canlıda gerçek Google Workspace kullanılır.
      </p>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Hesap seç</h1>
      <label className="k-field" htmlFor="eposta">
        Şirket e-postası
        <input
          id="eposta"
          type="email"
          required
          placeholder="ad@sirket.com.tr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Gerçek bir e-posta kutusu gerekmez. Konsola kayıtlı bir çalışanın adresini yaz: seed'deki Sahip `.env`
        içindeki SEED_OWNER_EMAIL, davet ettiklerin de kendi adresleriyle girer. Alan adı STAFF_EMAIL_DOMAINS
        içinde olmalı.
      </p>
      {error ? <p className="k-error">{error}</p> : null}
      <button className="k-btn" type="submit">
        Devam et
      </button>
    </form>
  );
}
