'use client';

import { type FormEvent, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function post<T>(path: string, body: object): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { message?: string }).message ?? 'Bir şeyler ters gitti');
  return data as T;
}

/** Telefon ve SMS koduyla giriş (Karar 18, T09). Yenileme jetonu httpOnly çerezde (lib/oturum.ts). */
export default function Giris() {
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!challengeId) {
        const r = await post<{ challengeId: string }>('/auth/otp/request', { phone });
        setChallengeId(r.challengeId);
      } else {
        // Doğrulama web sunucusu üzerinden: yenileme jetonu httpOnly çereze yazılır.
        const r = await fetch('/api/oturum/dogrula', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ challengeId, code }),
        });
        const data = (await r.json().catch(() => ({}))) as { message?: string };
        if (!r.ok) throw new Error(data.message ?? 'Kod doğrulanamadı');
        setDone(true);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>Giriş yapıldı</h1>
        <p className="muted">Talep oluşturma Sprint 8'de geliyor.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="card"
      style={{ maxWidth: 420, margin: '0 auto', display: 'grid', gap: 14 }}
    >
      <h1 style={{ margin: 0 }}>Giriş yap</h1>
      <p className="muted" style={{ margin: 0 }}>
        Cep telefonuna bir kod göndereceğiz. Şifre yok.
      </p>
      <label htmlFor="phone" style={{ fontWeight: 700 }}>
        Cep telefonu
      </label>
      <input
        id="phone"
        className="input"
        inputMode="tel"
        autoComplete="tel"
        placeholder="0532 123 45 67"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={!!challengeId}
        required
      />
      {challengeId && (
        <>
          <label htmlFor="code" style={{ fontWeight: 700 }}>
            SMS kodu
          </label>
          <input
            id="code"
            className="input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </>
      )}
      {error && (
        <p role="alert" style={{ margin: 0, color: '#a11b1b' }}>
          {error}
        </p>
      )}
      <button className="btn" type="submit" disabled={busy}>
        {challengeId ? 'Giriş yap' : 'Kod gönder'}
      </button>
    </form>
  );
}
