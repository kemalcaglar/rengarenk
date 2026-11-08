'use client';

import { useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';

interface Kanal {
  ad: string;
  not: string;
  gonderilen: number;
  teslim: number | null;
  okunma?: number | null;
  ayrilma?: number;
  sikayet?: number;
  maliyetKurus: number;
}
interface Rapor {
  kanallar: Kanal[];
  sablonlar: { key: string; ad: string; tur: string; adet: number; okunma: number }[];
}

const sayi = (n: number) => n.toLocaleString('tr-TR');
const yuzde = (x: number | null | undefined) =>
  x === null || x === undefined ? '—' : `%${(x * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
const tl = (k: number) => `₺${(k / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
const SUTUN = 'minmax(0, 2fr) repeat(6, minmax(0, 1fr))';

/**
 * Teslim raporu (YonetimKampanya.dc.html › teslim; Karar 48): son 30 gün kanal bazında gönderim, teslim, ayrılma,
 * şikâyet ve maliyet. E-postada izleme pikseli ve bağlantı yönlendirmesi kullanılmadığı için açılma ve tıklama
 * ölçülmez; uygulama içi bildirimde okunma oranı gösterilir.
 */
export default function TeslimRaporu() {
  const [r, setR] = useState<Rapor | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  useEffect(() => {
    yonetim<Rapor>('notifications/report')
      .then(setR)
      .catch((e: Error) => setHata(e.message));
  }, []);
  const enCok = Math.max(0.0001, ...(r?.sablonlar.map((s) => s.okunma) ?? []));

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Teslim raporu · son 30 gün</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Kanal ve şablon bazında gönderim, teslim, etkileşim ve maliyet.
        </p>
      </div>
      {hata ? <p style={{ color: '#A3271F', fontWeight: 700 }}>{hata}</p> : null}
      {r ? (
        <>
          <section
            aria-labelledby="kanal"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E3E6EF',
              borderRadius: 18,
              overflow: 'hidden',
            }}
          >
            <h2
              id="kanal"
              style={{
                margin: 0,
                padding: '16px 18px',
                fontSize: 17,
                fontWeight: 800,
                borderBottom: '1px solid #EEF0F5',
              }}
            >
              Kanallar
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 760 }}>
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
                  <span>Kanal</span>
                  <span style={{ textAlign: 'right' }}>Gönderilen</span>
                  <span style={{ textAlign: 'right' }}>Teslim</span>
                  <span style={{ textAlign: 'right' }}>Okunma</span>
                  <span style={{ textAlign: 'right' }}>Ayrılma</span>
                  <span style={{ textAlign: 'right' }}>Şikâyet</span>
                  <span style={{ textAlign: 'right' }}>Maliyet</span>
                </div>
                {r.kanallar.map((k) => (
                  <div
                    key={k.ad}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: SUTUN,
                      gap: 8,
                      alignItems: 'center',
                      padding: '12px 18px',
                      borderTop: '1px solid #EEF0F5',
                      fontSize: 13.5,
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 800 }}>{k.ad}</span>
                      <span style={{ display: 'block', fontSize: 12, color: '#5A6073' }}>{k.not}</span>
                    </span>
                    <span style={{ textAlign: 'right', fontWeight: 700 }}>{sayi(k.gonderilen)}</span>
                    <span style={{ textAlign: 'right' }}>{yuzde(k.teslim)}</span>
                    <span style={{ textAlign: 'right' }}>{yuzde(k.okunma)}</span>
                    <span style={{ textAlign: 'right' }}>
                      {k.ayrilma === undefined ? '—' : sayi(k.ayrilma)}
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      {k.sikayet === undefined ? '—' : sayi(k.sikayet)}
                    </span>
                    <span style={{ textAlign: 'right', fontWeight: 700 }}>{tl(k.maliyetKurus)}</span>
                  </div>
                ))}
              </div>
            </div>
            <p
              style={{
                margin: 0,
                padding: '12px 18px',
                borderTop: '1px solid #EEF0F5',
                background: '#F6F8FD',
                fontSize: 12.5,
                color: '#3A4052',
              }}
            >
              E-postada açılma ve tıklama ölçülmez: izleme pikseli ve bağlantı yönlendirmesi kullanılmıyor.
              SMS maliyeti doğrulama kodları hariç, tahminidir.
            </p>
          </section>

          <section
            aria-labelledby="sbl"
            style={{
              marginTop: 16,
              background: '#FFFFFF',
              border: '1px solid #E3E6EF',
              borderRadius: 18,
              padding: '18px 20px',
            }}
          >
            <h2 id="sbl" style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>
              Şablon ve akışlara göre okunma oranı
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#5A6073' }}>
              Uygulama içi bildirimlerden okunan pay
            </p>
            {r.sablonlar.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: '#5A6073' }}>Son 30 günde bildirim yok.</p>
            ) : (
              r.sablonlar.map((s) => (
                <div
                  key={s.key}
                  title={`${sayi(s.adet)} bildirim`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}
                >
                  <span style={{ flex: '0 1 280px', minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{s.ad}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: '#5A6073' }}>
                      {s.tur ? `${s.tur} · ` : ''}
                      {sayi(s.adet)} bildirim
                    </span>
                  </span>
                  <span style={{ flex: 1, minWidth: 0, height: 16 }}>
                    <span
                      style={{
                        display: 'block',
                        height: 16,
                        width: `${Math.max(1, (s.okunma / enCok) * 100)}%`,
                        background: '#5B8CFF',
                        borderRadius: '0 4px 4px 0',
                      }}
                    />
                  </span>
                  <span style={{ flex: '0 0 56px', fontSize: 13.5, fontWeight: 800, textAlign: 'right' }}>
                    {yuzde(s.okunma)}
                  </span>
                </div>
              ))
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
