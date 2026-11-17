'use client';

import { SIHIRBAZ_TANITIM, type SihirbazAdimi, tanitimAnahtari } from '@rengarenk/shared';
import { useEffect, useRef, useState } from 'react';
import { istek } from '../../lib/istemci';
import { colors } from '../../lib/renk';

/**
 * Sihirbaz adımlarının tanıtımı (sahip isteği, 17 Kasım 2026): üye bir adıma ilk kez geldiğinde o adımı anlatan pencere
 * açılır; "Anladım" denince sunucuya yazılır (`POST /me/tanitim`) ve bir daha gösterilmez (her cihazda).
 */
export function SihirbazTanitimi({
  adim,
  sira,
  toplam,
  acik,
}: {
  adim: SihirbazAdimi;
  sira: number;
  toplam: number;
  /** Sihirbaz hazır (taslak yüklendi ya da kategori adımı) */
  acik: boolean;
}) {
  const [gorulen, setGorulen] = useState<Set<string> | null>(null);
  const dugme = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    istek<{ tanitim?: string[] }>('/me')
      .then((m) => setGorulen(new Set(m.tanitim ?? [])))
      // Okunamazsa gösterilmez (sihirbazı engellemesin)
      .catch(() => setGorulen(new Set(Object.keys(SIHIRBAZ_TANITIM).map((k) => `sihirbaz.${k}`))));
  }, []);

  const anahtar = tanitimAnahtari(adim);
  const goster = acik && gorulen !== null && !gorulen.has(anahtar);
  useEffect(() => {
    if (goster) dugme.current?.focus();
  }, [goster]);

  if (!goster) return null;
  const t = SIHIRBAZ_TANITIM[adim];
  const kapat = () => {
    setGorulen((g) => new Set([...(g ?? []), anahtar]));
    istek('/me/tanitim', { method: 'POST', body: { anahtar } }).catch(() => undefined);
  };
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(30, 35, 51, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onKeyDown={(e) => e.key === 'Escape' && kapat()}
        aria-labelledby="tanitim-baslik"
        style={{
          width: '100%',
          maxWidth: 460,
          background: colors.surface,
          borderRadius: 'calc(var(--rr-kart-kose) * 20 / 18)',
          padding: '24px 24px 20px',
          boxShadow: '0 18px 50px rgba(30, 35, 51, 0.25)',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            fontSize: 12.5,
            fontWeight: 800,
            color: colors.onBlue,
            background: colors.blue,
            borderRadius: 'var(--rr-etiket-kose)',
            padding: '4px 10px',
          }}
        >
          Adım {sira} / {toplam}
        </span>
        <h2 id="tanitim-baslik" style={{ margin: '14px 0 8px', fontSize: 20, fontWeight: 800 }}>
          {t.baslik}
        </h2>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: colors.muted }}>{t.metin}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            ref={dugme}
            type="button"
            onClick={kapat}
            style={{
              border: 0,
              background: colors.blue,
              color: colors.onBlue,
              borderRadius: 'var(--rr-buton-kose)',
              padding: '12px 24px',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Anladım
          </button>
        </div>
      </div>
    </div>
  );
}
