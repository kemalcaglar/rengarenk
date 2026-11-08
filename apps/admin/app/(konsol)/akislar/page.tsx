'use client';

import { useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

interface Akis {
  key: string;
  ad: string;
  tur: string;
  acik: boolean;
  adimlar: { tip: string; baslik: string; detay: string }[];
  kisi: number;
  okunma: number | null;
}

/** Adım rengi (YonetimKampanya.dc.html › akış adımları) */
const RENK: Record<string, string> = {
  Tetikleyici: '#FFC84A',
  Koşul: '#F3EFFF',
  Bekle: '#EEF0F5',
  İleti: '#EEF3FF',
  'Koşul ve ileti': '#EEF3FF',
  Hedef: '#E7FAF0',
};
const yuzde = (x: number | null) => (x === null ? '—' : `%${Math.round(x * 100)}`);

/**
 * Otomatik akışlar (YonetimKampanya.dc.html › akışlar; Karar 51): yedi akış, aç/kapat, adımlar ve son 30 gün. Adımlar
 * kodda tanımlıdır; "Adım ekle" akış düzenleyicisiyle (Aşama 9, kampanyalar) gelecek.
 */
export default function Akislar() {
  const { me } = useKonsol();
  const duzenler = me.permissions['kampanya.hazirla'] === 'tam';
  const [liste, setListe] = useState<Akis[] | null>(null);
  const [sec, setSec] = useState('doluyor');
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    yonetim<Akis[]>('notifications/automations')
      .then(setListe)
      .catch((e: Error) => setHata(e.message));
  }, []);

  async function degistir(a: Akis) {
    try {
      setListe(
        await yonetim<Akis[]>(`notifications/automations/${a.key}`, {
          method: 'POST',
          body: { acik: !a.acik },
        }),
      );
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const akis = liste?.find((a) => a.key === sec);
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Otomatik akışlar</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Tetikleyici, bekleme, koşul ve ileti adımlarıyla kurulur. Kişi hedefe ulaşınca akıştan çıkar.
        </p>
      </div>
      {hata ? <p style={{ color: '#A3271F' }}>{hata}</p> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section
          aria-label="Akışlar"
          style={{
            flex: '1 1 340px',
            maxWidth: 420,
            minWidth: 0,
            background: '#FFFFFF',
            border: '1px solid #E3E6EF',
            borderRadius: 18,
            padding: 8,
          }}
        >
          {(liste ?? []).map((a) => (
            <div
              key={a.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderRadius: 12,
                padding: 10,
                background: a.key === sec ? '#F3EFFF' : 'transparent',
              }}
            >
              <button
                type="button"
                onClick={() => setSec(a.key)}
                aria-current={a.key === sec}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'left',
                  border: 0,
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#1E2333',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{a.ad}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 2 }}>
                  {a.tur} ·{' '}
                  {a.acik
                    ? `30 günde ${a.kisi.toLocaleString('tr-TR')} ileti · okunma ${yuzde(a.okunma)}`
                    : 'Kapalı'}
                </span>
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={a.acik}
                aria-label={`${a.ad}: aç veya kapat`}
                disabled={!duzenler}
                onClick={() => degistir(a)}
                style={{
                  flex: 'none',
                  border: 0,
                  background: 'transparent',
                  padding: 0,
                  cursor: duzenler ? 'pointer' : 'default',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: 40,
                    height: 24,
                    borderRadius: 999,
                    background: a.acik ? '#3DD68C' : '#D5DAE5',
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: a.acik ? 19 : 3,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      boxShadow: '0 1px 2px rgba(30,35,51,0.3)',
                    }}
                  />
                </span>
              </button>
            </div>
          ))}
        </section>
        {akis ? (
          <section
            aria-labelledby="akisad"
            style={{
              flex: '999 1 420px',
              minWidth: 0,
              background: '#FFFFFF',
              border: '1px solid #E3E6EF',
              borderRadius: 18,
              padding: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <h2 id="akisad" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                {akis.ad}
              </h2>
              <span style={{ fontSize: 12.5, color: '#5A6073' }}>
                {akis.acik
                  ? `Son 30 gün: ${akis.kisi.toLocaleString('tr-TR')} ileti · uygulamada okunma ${yuzde(akis.okunma)}`
                  : 'Kapalı'}
              </span>
            </div>
            <div style={{ marginTop: 16 }}>
              {akis.adimlar.map((ad, i) => (
                <div key={`${ad.tip}-${ad.baslik}`} style={{ display: 'flex', gap: 12 }}>
                  <span
                    style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                  >
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        background: RENK[ad.tip] ?? '#EEF0F5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        width: 2,
                        background: '#E3E6EF',
                        minHeight: 14,
                        opacity: i === akis.adimlar.length - 1 ? 0 : 1,
                      }}
                    />
                  </span>
                  <div style={{ flex: 1, minWidth: 0, paddingBottom: 14 }}>
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                        color: '#5A6073',
                      }}
                    >
                      {ad.tip}
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 800, marginTop: 2 }}>{ad.baslik}</div>
                    <div style={{ fontSize: 12.5, color: '#3A4052', marginTop: 2 }}>{ad.detay}</div>
                  </div>
                </div>
              ))}
            </div>
            <p
              style={{
                margin: 0,
                borderTop: '1px solid #EEF0F5',
                paddingTop: 14,
                fontSize: 12.5,
                color: '#5A6073',
              }}
            >
              Akışın iletileri Şablonlar ekranından düzenlenir. Akış kapalıyken iletisi gönderilmez.
            </p>
          </section>
        ) : null}
      </div>
    </>
  );
}
