'use client';

import { LEGAL_PATHS, type PendingLegal } from '@rengarenk/shared';
import { useEffect, useState } from 'react';
import { cikisYap, istek, useGiris } from '../lib/istemci';
import { colors } from '../lib/renk';

/**
 * Yasal metin güncellemesi (Karar 46): esaslı değişiklikten sonra girişte yeni sürüm onaylatılır. Zorunlu metinler kabul
 * edilmeden devam edilemez (çıkış yapılabilir); isteğe bağlı rızalar (ticari ileti, reklam ölçümü) yeniden seçilir.
 */
export function YasalOnay() {
  const giris = useGiris();
  const [liste, setListe] = useState<PendingLegal[]>([]);
  const [kabul, setKabul] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    if (!giris) return;
    istek<PendingLegal[]>('/me/legal/pending')
      .then((l) => {
        setListe(l);
        setKabul(Object.fromEntries(l.map((x) => [x.key, x.zorunlu ? false : Boolean(x.onceki)])));
      })
      .catch(() => undefined);
  }, [giris]);

  if (!liste.length) return null;
  const hazir = liste.every((x) => !x.zorunlu || kabul[x.key]);

  async function gonder() {
    setBusy(true);
    setHata(null);
    try {
      const kalan = await istek<PendingLegal[]>('/me/legal/accept', {
        method: 'POST',
        body: {
          onaylar: liste.map((x) => ({ key: x.key, version: x.version, granted: Boolean(kabul[x.key]) })),
        },
      });
      setListe(kalan);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="yasal-onay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(30,35,51,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: 'min(560px, 100%)',
          maxHeight: '100%',
          overflow: 'auto',
          background: colors.surface,
          borderRadius: 'var(--rr-kart-kose)',
          padding: 22,
          boxShadow: '0 20px 48px rgba(30,35,51,0.25)',
        }}
      >
        <h2 id="yasal-onay" style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800 }}>
          Metinlerimizi güncelledik
        </h2>
        <p style={{ margin: '0 0 14px', fontSize: 14, color: colors.muted, lineHeight: 1.5 }}>
          Devam etmeden önce güncel sürümleri okuyup onaylaman gerekiyor. Hangi sürümü ne zaman onayladığın
          kaydedilir.
        </p>
        {liste.map((x) => (
          <section
            key={x.key}
            aria-label={x.ad}
            style={{
              border: `1px solid ${colors.line}`,
              borderRadius: 'var(--rr-buton-kose)',
              padding: 14,
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 15 }}>
                {x.ad} · s.{x.version}
              </strong>
              <a
                href={`/${LEGAL_PATHS[x.key]}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 13.5, fontWeight: 700 }}
              >
                Metni oku
              </a>
            </div>
            <p style={{ margin: '4px 0 10px', fontSize: 13, color: colors.inkSoft }}>
              Neler değişti: {x.ozet}
            </p>
            {x.zorunlu ? (
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={Boolean(kabul[x.key])}
                  onChange={(e) => setKabul((k) => ({ ...k, [x.key]: e.target.checked }))}
                  style={{ width: 18, height: 18, margin: '1px 0 0', flex: 'none' }}
                />
                Okudum, kabul ediyorum
              </label>
            ) : (
              <fieldset
                style={{ border: 0, padding: 0, margin: 0, display: 'flex', gap: 16, flexWrap: 'wrap' }}
              >
                <legend className="sr-only">{x.ad}</legend>
                {[
                  [true, 'Onay veriyorum'],
                  [false, 'Onay vermiyorum'],
                ].map(([v, ad]) => (
                  <label
                    key={String(v)}
                    style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}
                  >
                    <input
                      type="radio"
                      name={`yasal-${x.key}`}
                      checked={Boolean(kabul[x.key]) === v}
                      onChange={() => setKabul((k) => ({ ...k, [x.key]: v as boolean }))}
                    />
                    {ad as string}
                  </label>
                ))}
              </fieldset>
            )}
          </section>
        ))}
        {hata ? (
          <p role="alert" style={{ color: '#A3271F', fontSize: 13.5, margin: '6px 0' }}>
            {hata}
          </p>
        ) : null}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            marginTop: 12,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => void cikisYap()}
            style={{
              border: `1px solid ${colors.line}`,
              background: colors.surface,
              borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
              padding: '11px 16px',
              fontSize: 14.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Çıkış yap
          </button>
          <button
            type="button"
            disabled={!hazir || busy}
            onClick={() => void gonder()}
            style={{
              border: 0,
              background: hazir ? colors.blue : '#C9D3E6',
              color: hazir ? 'var(--rr-maviYazi, #1E2333)' : colors.ink,
              borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
              padding: '11px 18px',
              fontSize: 14.5,
              fontWeight: 800,
              cursor: hazir ? 'pointer' : 'not-allowed',
            }}
          >
            {busy ? 'Kaydediliyor…' : 'Onayla ve devam et'}
          </button>
        </div>
      </div>
    </div>
  );
}
