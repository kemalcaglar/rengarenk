'use client';

import { type CSSProperties, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';

interface Gecmis {
  kisi: { ad: string; userId: string } | null;
  gecmis: { ad: string; durum: 'Verdi' | 'Vermedi'; surum: string; zaman: string; kanal: string }[];
}

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const SUTUN = 'minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr)';
const zaman = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso));

/**
 * Rıza ve çerez kayıtları (YonetimSistem.dc.html › riza; Karar 59): her rıza tarih, metin sürümü ve kanalıyla saklanır,
 * kayıtlar değiştirilmez. İYS her gece eşitlenir (bağlantı hesap açılınca).
 */
export default function Riza() {
  const [sayilar, setSayilar] = useState<{ ad: string; deger: string; not: string }[] | null>(null);
  const [q, setQ] = useState('');
  const [g, setG] = useState<Gecmis | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    yonetim<{ ad: string; deger: string; not: string }[]>('consents/overview')
      .then(setSayilar)
      .catch((e: Error) => setHata(e.message));
  }, []);
  useEffect(() => {
    if (q.trim().length < 2) {
      setG(null);
      return;
    }
    const t = setTimeout(
      () =>
        yonetim<Gecmis>(`consents?q=${encodeURIComponent(q.trim())}`)
          .then(setG)
          .catch((e: Error) => setHata(e.message)),
      350,
    );
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Rıza ve çerez kayıtları</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Her rıza tarih, metin sürümü ve kanalıyla saklanır. İYS her gece eşitlenir.
        </p>
      </div>
      {hata ? <p style={{ color: '#A3271F', fontWeight: 700 }}>{hata}</p> : null}
      {sayilar ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
            gap: 10,
            marginBottom: 14,
          }}
        >
          {sayilar.map((s) => (
            <div key={s.ad} style={{ ...kart, borderRadius: 16, padding: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5A6073' }}>{s.ad}</div>
              <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4 }}>{s.deger}</div>
              <div style={{ fontSize: 12, color: '#5A6073', marginTop: 3 }}>{s.not}</div>
            </div>
          ))}
        </div>
      ) : null}
      <section aria-labelledby="rizag" style={{ ...kart, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '14px 18px',
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          <h2 id="rizag" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
            {g?.kisi ? `${g.kisi.ad} · rıza geçmişi` : 'Rıza geçmişi'}
          </h2>
          <input
            type="search"
            aria-label="Kullanıcı ara"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ad ya da telefonun son haneleri"
            style={{
              flex: '0 1 260px',
              border: '1px solid #D5DAE5',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 13.5,
              fontFamily: 'inherit',
            }}
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 640 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: SUTUN,
                gap: 8,
                padding: '10px 18px',
                background: '#F3F5FA',
                fontSize: 11.5,
                fontWeight: 800,
                color: '#5A6073',
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
            >
              <span>Rıza</span>
              <span>Durum</span>
              <span>Metin sürümü</span>
              <span>Tarih ve kanal</span>
            </div>
            {!g ? (
              <p style={{ margin: 0, padding: '14px 18px', fontSize: 13.5, color: '#5A6073' }}>
                Bir kişinin rıza geçmişini görmek için adını ya da telefonunun son hanelerini yaz.
              </p>
            ) : !g.kisi ? (
              <p style={{ margin: 0, padding: '14px 18px', fontSize: 13.5, color: '#5A6073' }}>
                Kişi bulunamadı.
              </p>
            ) : (
              g.gecmis.map((r, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: geçmiş sırası sabit
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: SUTUN,
                    gap: 8,
                    alignItems: 'center',
                    padding: '10px 18px',
                    borderTop: '1px solid #EEF0F5',
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{r.ad}</span>
                  <span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: r.durum === 'Verdi' ? '#E7FAF0' : '#F3F5FA',
                        color: r.durum === 'Verdi' ? '#11683F' : '#3A4052',
                      }}
                    >
                      {r.durum}
                    </span>
                  </span>
                  <span>{r.surum}</span>
                  <span style={{ color: '#3A4052' }}>
                    {zaman(r.zaman)} · {r.kanal}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
}
