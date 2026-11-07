'use client';

import { type FormEvent, useEffect, useState } from 'react';

async function post<T>(path: string, body?: object): Promise<T> {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await r.json().catch(() => ({}))) as { message?: string };
  if (r.status === 401 && /süresi doldu|baştan/.test(data.message ?? '')) {
    window.location.href = `/giris?hata=${encodeURIComponent(data.message ?? '')}`;
  }
  if (!r.ok) throw new Error(data.message ?? 'Bir şeyler ters gitti');
  return data as T;
}

/**
 * İki adımlı doğrulama (Karar 40). İlk girişte doğrulama uygulaması kurulur ve tek kullanımlık
 * kurtarma kodları bir kez gösterilir; sonraki girişlerde uygulamadaki 6 haneli kod istenir.
 */
export function IkiAdim({ setup }: { setup: boolean }) {
  const [qr, setQr] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [useRecovery, setUseRecovery] = useState(false);

  useEffect(() => {
    if (!setup) return;
    post<{ secret: string; qrSvg: string }>('/api/oturum/iki-adim/kurulum')
      .then(setQr)
      .catch((e: Error) => setError(e.message));
  }, [setup]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ recoveryCodes: string[] | null }>('/api/oturum/iki-adim', { code });
      if (r.recoveryCodes) setRecovery(r.recoveryCodes);
      else window.location.href = '/';
    } catch (err) {
      setError((err as Error).message);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (recovery) {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Kurtarma kodlarını sakla</h1>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          Telefonuna erişemezsen bu kodlardan biriyle girebilirsin. Her kod bir kez kullanılır ve bir daha
          gösterilmez. Parola yöneticine kaydet ya da yazdırıp güvenli bir yerde tut.
        </p>
        <ol
          style={{
            margin: 0,
            padding: '14px 14px 14px 40px',
            background: '#F3F5FA',
            borderRadius: 12,
            columns: 2,
            fontFamily: 'ui-monospace, Consolas, monospace',
            fontSize: 15,
            lineHeight: 1.9,
          }}
        >
          {recovery.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
        <button className="k-btn" type="button" onClick={() => (window.location.href = '/')}>
          Kaydettim, konsola geç
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
          {setup ? 'Doğrulama uygulamasını kur' : 'İki adımlı doğrulama'}
        </h1>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>
          {setup
            ? 'Google Authenticator, Microsoft Authenticator ya da parola yöneticinle karekodu okut, ardından uygulamadaki 6 haneli kodu yaz. Kurulum bitmeden konsol açılmaz.'
            : useRecovery
              ? 'Kurtarma kodlarından birini yaz (ör. abcd-efgh). Kullandığın kod bir daha geçerli olmaz.'
              : 'Doğrulama uygulamandaki 6 haneli kodu yaz.'}
        </p>
      </div>

      {setup ? (
        qr ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <div
              style={{ width: 176, height: 176, border: '1px solid #E3E6EF', borderRadius: 12, padding: 8 }}
              aria-label="Doğrulama uygulaması karekodu"
              role="img"
              // Karekod SVG'si API'de üretilir; içinde yalnızca kare yollar vardır.
              // biome-ignore lint/security/noDangerouslySetInnerHtml: API'nin ürettiği karekod
              dangerouslySetInnerHTML={{ __html: qr.qrSvg }}
            />
            <div style={{ flex: '1 1 180px', minWidth: 0, fontSize: 13 }}>
              <div className="muted" style={{ fontWeight: 700 }}>
                Karekodu okutamıyorsan anahtarı elle gir:
              </div>
              <code
                style={{
                  display: 'block',
                  marginTop: 6,
                  wordBreak: 'break-all',
                  background: '#F3F5FA',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: 13.5,
                }}
              >
                {qr.secret.match(/.{1,4}/g)?.join(' ')}
              </code>
            </div>
          </div>
        ) : error ? null : (
          <p className="muted">Karekod hazırlanıyor…</p>
        )
      ) : null}

      <label className="k-field" htmlFor="kod">
        {useRecovery ? 'Kurtarma kodu' : 'Doğrulama kodu'}
        <input
          id="kod"
          inputMode={useRecovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          maxLength={useRecovery ? 9 : 7}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={useRecovery ? 'abcd-efgh' : '123 456'}
          style={{ fontSize: 20, letterSpacing: 3 }}
        />
      </label>

      {error ? (
        <p className="k-error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}

      <button className="k-btn" type="submit" disabled={busy || code.trim().length < 6}>
        {busy ? 'Doğrulanıyor…' : setup ? 'Kurulumu tamamla' : 'Giriş yap'}
      </button>
      {!setup ? (
        <button className="k-link" type="button" onClick={() => setUseRecovery((v) => !v)}>
          {useRecovery
            ? 'Doğrulama uygulaması kodunu kullan'
            : 'Telefonuma erişemiyorum, kurtarma kodu kullan'}
        </button>
      ) : null}
      <a href="/giris" style={{ fontSize: 13.5, textAlign: 'center' }}>
        Girişe baştan başla
      </a>
    </form>
  );
}
