'use client';

import { LEGAL_PATHS, type PendingLegal } from '@rengarenk/shared';
import { useEffect, useState } from 'react';
import { cx } from '../lib/cx';
import { cikisYap, istek, useGiris } from '../lib/istemci';
import stil from './yasal-onay.module.css';

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
    <div role="dialog" aria-modal="true" aria-labelledby="yasal-onay" className={stil.kutu1}>
      <div className={stil.kutu2}>
        <h2 id="yasal-onay" className={stil.baslik1}>
          Metinlerimizi güncelledik
        </h2>
        <p className={stil.metin1}>
          Devam etmeden önce güncel sürümleri okuyup onaylaman gerekiyor. Hangi sürümü ne zaman onayladığın
          kaydedilir.
        </p>
        {liste.map((x) => (
          <section key={x.key} aria-label={x.ad} className={stil.kutu3}>
            <div className={stil.kutu4}>
              <strong className={stil.metin2}>
                {x.ad} · s.{x.version}
              </strong>
              <a href={`/${LEGAL_PATHS[x.key]}`} target="_blank" rel="noreferrer" className={stil.bag1}>
                Metni oku
              </a>
            </div>
            <p className={stil.metin3}>Neler değişti: {x.ozet}</p>
            {x.zorunlu ? (
              <label className={stil.etiket1}>
                <input
                  type="checkbox"
                  checked={Boolean(kabul[x.key])}
                  onChange={(e) => setKabul((k) => ({ ...k, [x.key]: e.target.checked }))}
                  className={stil.girdi1}
                />
                Okudum, kabul ediyorum
              </label>
            ) : (
              <fieldset className={stil.kutu5}>
                <legend className="sr-only">{x.ad}</legend>
                {[
                  [true, 'Onay veriyorum'],
                  [false, 'Onay vermiyorum'],
                ].map(([v, ad]) => (
                  <label key={String(v)} className={stil.etiket2}>
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
          <p role="alert" className={stil.metin4}>
            {hata}
          </p>
        ) : null}
        <div className={stil.kutu6}>
          <button type="button" onClick={() => void cikisYap()} className={stil.dugme1}>
            Çıkış yap
          </button>
          <button
            type="button"
            disabled={!hazir || busy}
            onClick={() => void gonder()}
            className={cx(stil.dugme2, hazir ? stil.dugme3 : stil.dugme4)}
          >
            {busy ? 'Kaydediliyor…' : 'Onayla ve devam et'}
          </button>
        </div>
      </div>
    </div>
  );
}
