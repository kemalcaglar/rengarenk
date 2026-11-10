'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { HesabimMenu } from '../../../components/hesabim-menu';
import { useCanli } from '../../../lib/canli';
import { istek, useGiris } from '../../../lib/istemci';

export interface Bildirim {
  id: string;
  grup: string;
  ikon: string;
  tint: string;
  baslik: string;
  metin: string;
  url: string | null;
  ticari: boolean;
  okundu: boolean;
  zaman: string;
}

const FILTRELER = [
  ['hepsi', 'Tümü'],
  ['mesaj', 'Mesajlar'],
  ['talep', 'Taleplerim'],
] as const;

const DAY = 86_400_000;
const once = (iso: string) => {
  const dk = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (dk < 1) return 'şimdi';
  if (dk < 60) return `${dk} dk`;
  if (dk < 24 * 60) return `${Math.floor(dk / 60)} sa`;
  if (dk < 48 * 60) return 'Dün';
  return `${Math.floor(dk / (24 * 60))} gün`;
};
const gunBasi = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Bildirimler (AnasayfaMobil.dc.html › bildirimler; Karar 48): süzgeç, Bugün / Bu hafta / Daha önce grupları, okunmamış
 * vurgusu, kampanyada "onay verdiğin için" etiketi, "Tümünü okundu say". Web tasarımında ayrı ekran yok; mobil tasarım
 * hesap düzeninde kullanıldı.
 */
export default function Bildirimler() {
  const giris = useGiris();
  const router = useRouter();
  const [filtre, setFiltre] = useState<'hepsi' | 'mesaj' | 'talep'>('hepsi');
  const [liste, setListe] = useState<Bildirim[] | null>(null);

  useEffect(() => {
    if (giris === false) router.replace('/giris?sonra=/bildirimler');
  }, [giris, router]);

  const yukle = useCallback(async () => {
    const r = await istek<{ bildirimler: Bildirim[] }>(
      `/notifications${filtre === 'hepsi' ? '' : `?grup=${filtre}`}`,
    );
    setListe(r.bildirimler);
  }, [filtre]);
  useEffect(() => {
    if (giris) yukle().catch(() => setListe([]));
  }, [giris, yukle]);
  useCanli((o) => {
    if (o.tip === 'bildirim') yukle().catch(() => undefined);
  }, !!giris);

  async function ac(b: Bildirim) {
    if (!b.okundu)
      await istek('/notifications/read', { method: 'POST', body: { ids: [b.id] } }).catch(() => undefined);
    window.dispatchEvent(new Event('rr-bildirim'));
    if (b.url) router.push(b.url);
    else yukle().catch(() => undefined);
  }

  const bugun = gunBasi();
  const gruplar = [
    ['Bugün', (t: number) => t >= bugun],
    ['Bu hafta', (t: number) => t < bugun && t >= bugun - 6 * DAY],
    ['Daha önce', (t: number) => t < bugun - 6 * DAY],
  ] as const;

  return (
    <div
      style={{
        maxWidth: 1360,
        margin: '0 auto',
        padding: '24px 24px 64px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: 24,
      }}
    >
      <HesabimMenu aktif="/bildirimler" />
      <main style={{ flex: '999 1 640px', minWidth: 0, maxWidth: 820 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>Bildirimler</h1>
          <button
            type="button"
            onClick={async () => {
              await istek('/notifications/read', { method: 'POST', body: { hepsi: true } }).catch(
                () => undefined,
              );
              window.dispatchEvent(new Event('rr-bildirim'));
              yukle().catch(() => undefined);
            }}
            style={{
              border: 0,
              background: 'transparent',
              padding: '10px 6px',
              fontSize: 13.5,
              fontWeight: 700,
              color: 'var(--rr-baglanti, #2450C8)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Tümünü okundu say
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '12px 0 4px' }}>
          {FILTRELER.map(([k, ad]) => (
            <button
              key={k}
              type="button"
              aria-pressed={filtre === k}
              onClick={() => setFiltre(k)}
              style={{
                border: filtre === k ? 0 : '1px solid #D5DAE5',
                background: filtre === k ? 'var(--rr-murekkep, #1E2333)' : '#FFFFFF',
                borderRadius: 'var(--rr-etiket-kose)',
                padding: filtre === k ? '9px 14px' : '8px 13px',
                fontSize: 13.5,
                fontWeight: filtre === k ? 800 : 700,
                color: filtre === k ? '#FFFFFF' : 'var(--rr-murekkep, #1E2333)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {ad}
            </button>
          ))}
        </div>
        {liste && !liste.length ? (
          <p style={{ marginTop: 16, color: '#5A6073' }}>Henüz bildirimin yok.</p>
        ) : null}
        {gruplar.map(([ad, kosul]) => {
          const ogeler = (liste ?? []).filter((b) => kosul(new Date(b.zaman).getTime()));
          if (!ogeler.length) return null;
          return (
            <section key={ad}>
              <h2
                style={{
                  margin: '14px 4px 8px',
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#5A6073',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {ad}
              </h2>
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--rr-cizgi, #E3E6EF)',
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                {ogeler.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => ac(b)}
                    style={{
                      display: 'flex',
                      width: '100%',
                      textAlign: 'left',
                      gap: 12,
                      padding: '13px 14px',
                      border: 0,
                      borderBottom: '1px solid #EEF0F5',
                      background: b.okundu ? '#FFFFFF' : '#F8FAFF',
                      color: 'var(--rr-murekkep, #1E2333)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        flex: 'none',
                        width: 38,
                        height: 38,
                        borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
                        background: b.tint,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                      }}
                    >
                      {b.ikon}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: b.okundu ? 700 : 800 }}>{b.baslik}</span>
                        <span style={{ flex: 'none', fontSize: 11.5, color: '#5A6073' }}>
                          {once(b.zaman)}
                        </span>
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 12.5,
                          color: '#3A4052',
                          marginTop: 3,
                          lineHeight: 1.45,
                        }}
                      >
                        {b.metin}
                      </span>
                      {b.ticari ? (
                        <span
                          style={{
                            display: 'inline-block',
                            marginTop: 5,
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: 'var(--rr-etiket-kose)',
                            background: '#F3F5FA',
                            color: '#5A6073',
                          }}
                        >
                          Kampanya · onay verdiğin için
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
