'use client';

import { type FormEvent, useState } from 'react';
import { field, h1, label, primary } from '../../../components/giris-ui';
import { colors } from '../../../lib/renk';

const toBase64Url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** Sahte Google hesap seçicisi (geliştirme): seçilen e-posta, ad ve soyad yetki kodunun içine yazılır. */
export function SahteGoogle({ state, redirectUri }: { state: string; redirectUri: string }) {
  const [email, setEmail] = useState('');
  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const target = new URL(redirectUri, window.location.origin);
    // Yalnızca bu siteye geri dönülür
    if (target.origin !== window.location.origin) {
      setError('Dönüş adresi bu siteye ait değil');
      return;
    }
    const eposta = email.trim().toLowerCase();
    target.searchParams.set('state', state);
    target.searchParams.set(
      'code',
      `fake.${toBase64Url(
        JSON.stringify({
          email: eposta,
          sub: `fake-${eposta}`,
          hd: null,
          email_verified: true,
          ...(ad ? { given_name: ad } : {}),
          ...(soyad ? { family_name: soyad } : {}),
        }),
      )}`,
    );
    window.location.href = target.toString();
  }

  return (
    <form
      onSubmit={submit}
      style={{
        maxWidth: 420,
        width: '100%',
        display: 'grid',
        gap: 12,
        background: colors.surface,
        border: `1px solid ${colors.line}`,
        borderRadius: 'var(--rr-kart-kose)',
        padding: 28,
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>
        Geliştirme ortamı: Google girişi taklit ediliyor. Canlıda gerçek Google hesabı kullanılır.
      </p>
      <h1 style={{ ...h1, fontSize: 22 }}>Google hesabı seç</h1>
      <div>
        <label htmlFor="g-eposta" style={label}>
          Gmail adresi
        </label>
        <input
          id="g-eposta"
          type="email"
          required
          placeholder="ad@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={field}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label htmlFor="g-ad" style={label}>
            Ad
          </label>
          <input id="g-ad" value={ad} onChange={(e) => setAd(e.target.value)} style={field} />
        </div>
        <div>
          <label htmlFor="g-soyad" style={label}>
            Soyad
          </label>
          <input id="g-soyad" value={soyad} onChange={(e) => setSoyad(e.target.value)} style={field} />
        </div>
      </div>
      {error ? <p style={{ margin: 0, color: '#A3271F', fontWeight: 700 }}>{error}</p> : null}
      <button type="submit" style={primary(true)}>
        Devam et
      </button>
    </form>
  );
}
