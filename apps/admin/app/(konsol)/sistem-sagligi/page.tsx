'use client';

import { useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

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
      <div style={{ marginBottom: 16 }}>
        <h1 className="k-h1">Sistem sağlığı ve yedek</h1>
        <p className="k-sub">{v?.yer ?? 'Google Cloud · Frankfurt · son 30 gün'}</p>
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
              gap: 10,
              marginBottom: 14,
            }}
          >
            {v.olcu.map((s) => (
              <div
                key={s.ad}
                style={{ background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 16, padding: 14 }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5A6073' }}>{s.ad}</div>
                <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4 }}>{s.deger}</div>
                <div style={{ fontSize: 12, color: '#5A6073', marginTop: 3 }}>{s.not}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            <section
              className="k-panel"
              style={{ flex: '1 1 380px', minWidth: 0, overflow: 'hidden' }}
              aria-labelledby="servis"
            >
              <h2
                id="servis"
                style={{
                  margin: 0,
                  padding: '16px 18px',
                  fontSize: 17,
                  fontWeight: 800,
                  borderBottom: '1px solid #EEF0F5',
                }}
              >
                Servisler
              </h2>
              {v.servisler.map((s) => (
                <div
                  key={s.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 18px',
                    borderBottom: '1px solid #EEF0F5',
                    fontSize: 13.5,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      flex: 'none',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: NOKTA[s.durum],
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 700 }}>{s.ad}</span>
                  <span style={{ flex: 'none', color: '#3A4052', maxWidth: '55%', textAlign: 'right' }}>
                    {s.not}
                  </span>
                </div>
              ))}
            </section>
            <section
              className="k-panel"
              style={{ flex: '1 1 380px', minWidth: 0, overflow: 'hidden' }}
              aria-labelledby="yedek"
            >
              <h2
                id="yedek"
                style={{
                  margin: 0,
                  padding: '16px 18px',
                  fontSize: 17,
                  fontWeight: 800,
                  borderBottom: '1px solid #EEF0F5',
                }}
              >
                Yedek ve geri yükleme
              </h2>
              {v.yedekler.map((y) => (
                <div
                  key={y.ad}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '10px 18px',
                    borderBottom: '1px solid #EEF0F5',
                    fontSize: 13.5,
                  }}
                >
                  <span style={{ color: '#3A4052' }}>{y.ad}</span>
                  <strong style={{ textAlign: 'right' }}>{y.deger}</strong>
                </div>
              ))}
              <div style={{ padding: '14px 18px' }}>
                {me.permissions['sistem.ayarla'] === 'tam' ? (
                  <button
                    type="button"
                    disabled={busy || v.testBekliyor}
                    onClick={() => void test()}
                    style={{
                      border: '1px solid #5B8CFF',
                      background: '#FFFFFF',
                      borderRadius: 10,
                      padding: '9px 14px',
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: '#2450C8',
                      cursor: v.testBekliyor ? 'default' : 'pointer',
                    }}
                  >
                    {v.testBekliyor ? 'Test bekliyor' : 'Geri yükleme testini şimdi başlat'}
                  </button>
                ) : null}
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#5A6073' }}>
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
