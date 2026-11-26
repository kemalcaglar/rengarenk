'use client';

import { SIHIRBAZ_TANITIM, type SihirbazAdimi, tanitimAnahtari } from '@rengarenk/shared';
import { useEffect, useRef, useState } from 'react';
import { istek } from '../../lib/istemci';
import stil from './tanitim.module.css';

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
    <div className={stil.kutu1}>
      <div
        role="dialog"
        aria-modal="true"
        onKeyDown={(e) => e.key === 'Escape' && kapat()}
        aria-labelledby="tanitim-baslik"
        className={stil.kutu2}
      >
        <span className={stil.metin1}>
          Adım {sira} / {toplam}
        </span>
        <h2 id="tanitim-baslik" className={stil.baslik1}>
          {t.baslik}
        </h2>
        <p className={stil.metin2}>{t.metin}</p>
        <div className={stil.kutu3}>
          <button ref={dugme} type="button" onClick={kapat} className={stil.dugme1}>
            Anladım
          </button>
        </div>
      </div>
    </div>
  );
}
