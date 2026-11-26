'use client';

import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

interface Ozet {
  yer: string;
  olcu: { ad: string; deger: string; not: string }[];
  servisler: { key: string; ad: string; durum: 'iyi' | 'uyari' | 'kotu' | 'yok'; not: string }[];
  yedekler: { ad: string; deger: string }[];
  testBekliyor: boolean;
}

const NOKTA = { iyi: '#3DD68C', uyari: '#FFC84A', kotu: '#E5484D', yok: '#AEB5C4' } as const;

/**
 * Sistem › Sistem sağlığı ve yedek (YonetimSistem.dc.html › saglik; Karar 56): çalışma süresi, hata oranı, yanıt süresi
 * ve kuyruk; servis yoklaması (işçi dakikada bir); yedek ve geri yükleme testi. Sayfa dakikada bir yenilenir.
 */
export default function SistemSagligi() {
  const { me } = useKonsol();
  const [v, setV] = useState<Ozet | null>(null);
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  const yukle = useCallback(() => {
    yonetim<Ozet>('system-health')
      .then(setV)
      .catch((e: Error) => setHata(e.message));
  }, []);
  useEffect(() => {
    yukle();
    const t = setInterval(yukle, 60_000);
    return () => clearInterval(t);
  }, [yukle]);

  async function test() {
    setBusy(true);
    setHata(null);
    try {
      await yonetim('system-health/restore-test', { method: 'POST', body: {} });
      setBilgi('Geri yükleme testi istendi; sunucu alınca ayrı bir ortamda başlar, sonucu burada görünür.');
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={stil.kutu1}>
        <h1 className="k-h1">Sistem sağlığı ve yedek</h1>
        <p className="k-sub">{v?.yer ?? 'AWS · Frankfurt · son 30 gün'}</p>
      </div>
      {hata ? (
        <p className="k-error" role="alert">
          {hata}
        </p>
      ) : null}
      {bilgi ? (
        <p className="k-ok" role="status">
          {bilgi}
        </p>
      ) : null}
      {!v ? (
        <div className="k-panel k-empty">Yükleniyor…</div>
      ) : (
        <>
          <div className={stil.kutu2}>
            {v.olcu.map((s) => (
              <div key={s.ad} className={stil.kutu3}>
                <div className={stil.kutu4}>{s.ad}</div>
                <div className={stil.kutu5}>{s.deger}</div>
                <div className={stil.kutu6}>{s.not}</div>
              </div>
            ))}
          </div>
          <div className={stil.kutu7}>
            <section className={`k-panel ${stil.kutu8}`} aria-labelledby="servis">
              <h2 id="servis" className={stil.baslik1}>
                Servisler
              </h2>
              {v.servisler.map((s) => (
                <div key={s.key} className={stil.kutu9}>
                  <span aria-hidden="true" className={stil.metin1} style={{ background: NOKTA[s.durum] }} />
                  <span className={stil.metin2}>{s.ad}</span>
                  <span className={stil.metin3}>{s.not}</span>
                </div>
              ))}
            </section>
            <section className={`k-panel ${stil.kutu8}`} aria-labelledby="yedek">
              <h2 id="yedek" className={stil.baslik1}>
                Yedek ve geri yükleme
              </h2>
              {v.yedekler.map((y) => (
                <div key={y.ad} className={stil.kutu10}>
                  <span className={stil.metin4}>{y.ad}</span>
                  <strong className={stil.metin5}>{y.deger}</strong>
                </div>
              ))}
              <div className={stil.kutu11}>
                {me.permissions['sistem.ayarla'] === 'tam' ? (
                  <button
                    type="button"
                    disabled={busy || v.testBekliyor}
                    onClick={() => void test()}
                    className={cx(stil.dugme1, v.testBekliyor ? stil.dugme2 : stil.dugme3)}
                  >
                    {v.testBekliyor ? 'Test bekliyor' : 'Geri yükleme testini şimdi başlat'}
                  </button>
                ) : null}
                <p className={stil.metin6}>
                  Test, yedeği ayrı bir ortama geri yükler; canlı sistemi etkilemez. Ayda bir kendiliğinden
                  çalışır.
                </p>
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
