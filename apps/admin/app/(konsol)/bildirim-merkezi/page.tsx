'use client';

import { type CSSProperties, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

interface Saglik {
  ad: string;
  saglayici: string;
  durum: string;
  bugun: number;
  teslim: number | null;
  kuyruk: number;
}
interface Merkez {
  ticariAcik: boolean;
  saglik: Saglik[];
  isinma: {
    baslangic: string | null;
    hafta: number | null;
    bugunLimit: number | null;
    bugunGonderilen: number;
  };
  engelListesi: Record<string, number>;
  kimlikler: { ad: string; adres: string; not: string }[];
  itibar: {
    gonderilen: number;
    ticariGonderilen: number;
    geriDonme: number | null;
    sikayet: number | null;
    sinir: { geriDonme: number; sikayet: number; enAzGonderim: number };
  };
  kurallar: { ad: string; not: string; deger: string }[];
}

const sayi = (n: number) => n.toLocaleString('tr-TR');
const yuzde = (x: number | null, basamak = 1) =>
  x === null ? '—' : `%${(x * 100).toLocaleString('tr-TR', { maximumFractionDigits: basamak })}`;

/** Durum rozeti renkleri (YonetimKampanya.dc.html › saglik) */
function rozet(durum: string): [string, string] {
  if (durum === 'Sağlıklı') return ['#E7FAF0', '#11683F'];
  if (durum === 'Beklemede' || durum === 'Kullanıldı') return ['#EEF3FF', '#2450C8'];
  if (durum === 'Durduruldu' || durum === 'Sorunlu') return ['#FDECEC', '#A3271F'];
  if (durum === 'Yok') return ['#EEF0F5', '#5A6073'];
  return ['#FFF6DF', '#7A5300'];
}

const ENGEL: Record<string, string> = {
  kalici_hata: 'Kalıcı hata (adres yok)',
  gecici_hata: 'Geçici hata (3’te listeye alınır)',
  sikayet: 'Spam şikâyeti',
  ayrildi: 'Ticari iletiden ayrıldı',
};

/** Isınma planı: 1. hafta 200, her hafta iki katı, 6. haftadan sonra sınırsız (commercial.ts isinmaLimiti) */
const PLAN = [200, 400, 800, 1600, 3200, null] as const;

const kart: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E3E6EF',
  borderRadius: 18,
  overflow: 'hidden',
  marginTop: 16,
};

/**
 * Bildirim merkezi (YonetimKampanya.dc.html › merkez; Karar 48–50): kanalların sağlığı, kendi e-posta sunucumuz,
 * ısınma planı, itibar sınırları ve gönderim kuralları. Ticari gönderim buradan durdurulur; sınır aşılırsa ajan
 * kendiliğinden durdurur.
 */
export default function BildirimMerkezi() {
  const { me } = useKonsol();
  const yetkili = me.permissions['sistem.ayarla'] === 'tam';
  const [m, setM] = useState<Merkez | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    yonetim<Merkez>('notifications/center')
      .then(setM)
      .catch((e: Error) => setHata(e.message));
  }, []);

  async function ticari(acik: boolean) {
    try {
      setM(await yonetim<Merkez>('notifications/commercial', { method: 'POST', body: { acik } }));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const ust = Math.log2(3200);
  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Bildirim merkezi</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
            Kanalların sağlığı, kendi e-posta sunucumuz ve gönderim kuralları.
          </p>
        </div>
        {m && yetkili ? (
          m.ticariAcik ? (
            <button
              type="button"
              onClick={() => ticari(false)}
              style={{
                border: '1.5px solid #E5A6A1',
                background: '#FFFFFF',
                borderRadius: 12,
                padding: '11px 16px',
                fontSize: 14,
                fontWeight: 800,
                color: '#A3271F',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Ticari gönderimi durdur
            </button>
          ) : (
            <button
              type="button"
              onClick={() => ticari(true)}
              style={{
                border: 0,
                background: '#3DD68C',
                borderRadius: 12,
                padding: '12px 18px',
                fontSize: 14,
                fontWeight: 800,
                color: '#1E2333',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Ticari gönderimi yeniden başlat
            </button>
          )
        ) : null}
      </div>
      {hata ? <p style={{ color: '#A3271F', fontWeight: 700 }}>{hata}</p> : null}
      {m ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
              gap: 12,
            }}
          >
            {m.saglik.map((sh) => {
              const [bg, fg] = rozet(sh.durum);
              return (
                <div
                  key={sh.ad}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E3E6EF',
                    borderRadius: 16,
                    padding: '14px 16px',
                  }}
                >
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 800 }}>{sh.ad}</span>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: bg,
                        color: fg,
                        flex: 'none',
                      }}
                    >
                      {sh.durum}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>{sh.saglayici}</div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                    {(
                      [
                        ['Bugün', sayi(sh.bugun)],
                        ['Teslim', yuzde(sh.teslim)],
                        ['Kuyruk', sayi(sh.kuyruk)],
                      ] as const
                    ).map(([e, v]) => (
                      <span key={e}>
                        <span style={{ display: 'block', fontSize: 11.5, color: '#5A6073' }}>{e}</span>
                        <span style={{ fontSize: 17, fontWeight: 800 }}>{v}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <section style={kart} aria-labelledby="smtp">
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #EEF0F5' }}>
              <h2 id="smtp" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                Kendi e-posta sunucumuz
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#5A6073' }}>
                Posta sunucusu ayrı sanal sunucuda · yeri bekliyor (Karar 50)
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              <div
                style={{
                  flex: '1 1 320px',
                  minWidth: 0,
                  padding: '14px 18px',
                  borderRight: '1px solid #EEF0F5',
                }}
              >
                <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: '#5A6073' }}>
                  Gönderen kimlikleri
                </h3>
                {m.kimlikler.map((k) => (
                  <div
                    key={k.ad}
                    style={{
                      border: '1px solid #E3E6EF',
                      borderRadius: 12,
                      padding: '10px 12px',
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 800 }}>{k.ad}</div>
                    <div style={{ fontSize: 12, color: '#3A4052', marginTop: 2, overflowWrap: 'anywhere' }}>
                      {k.adres}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#5A6073', marginTop: 2 }}>{k.not}</div>
                  </div>
                ))}
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#5A6073' }}>
                  SPF, DKIM, DMARC, ters DNS ve kara liste kontrolleri posta sunucusu kurulunca burada
                  görünür.
                </p>
                <h3 style={{ margin: '14px 0 8px', fontSize: 13, fontWeight: 800, color: '#5A6073' }}>
                  Gönderim dışı adresler
                </h3>
                {Object.keys(ENGEL).map((r) => (
                  <div
                    key={r}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12.5,
                      padding: '3px 0',
                    }}
                  >
                    <span>{ENGEL[r]}</span>
                    <strong>{sayi(m.engelListesi[r] ?? 0)}</strong>
                  </div>
                ))}
              </div>
              <div style={{ flex: '1 1 320px', minWidth: 0, padding: '14px 18px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: '#5A6073' }}>
                  Isınma planı · ticari IP
                </h3>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 6,
                    height: 120,
                    borderBottom: '1px solid #D5DAE5',
                  }}
                >
                  {PLAN.map((l, i) => {
                    const h = l === null ? 100 : Math.round((Math.log2(l) / ust) * 88);
                    const simdi = m.isinma.hafta !== null && Math.min(m.isinma.hafta, 6) === i + 1;
                    const gecti = m.isinma.hafta !== null && m.isinma.hafta > i + 1;
                    return (
                      <span
                        key={l ?? 'sinirsiz'}
                        title={l === null ? 'Sınır yok' : `Günde en çok ${sayi(l)} ticari e-posta`}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          height: '100%',
                        }}
                      >
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#3A4052', marginBottom: 3 }}>
                          {l === null ? 'Sınırsız' : sayi(l)}
                        </span>
                        <span
                          style={{
                            width: '100%',
                            height: `${h}%`,
                            background: simdi ? '#5B8CFF' : gecti ? '#BFD2FF' : '#EEF3FF',
                            border: simdi ? 0 : '1px dashed #BFD2FF',
                            borderRadius: '4px 4px 0 0',
                            boxSizing: 'border-box',
                          }}
                        />
                      </span>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {PLAN.map((l, i) => (
                    <span
                      key={l ?? 's'}
                      style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#5A6073' }}
                    >
                      {i + 1}. hf
                    </span>
                  ))}
                </div>
                <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.5, color: '#3A4052' }}>
                  {m.isinma.hafta === null ? (
                    <>
                      Isınma başlamadı (EPOSTA_ISINMA_BASLANGIC tanımlı değil). Başlayana kadar ticari e-posta
                      gönderilmez; işlemsel e-posta sınırsızdır.
                    </>
                  ) : m.isinma.hafta < 1 ? (
                    <>Isınma bu hafta başladı · ticari e-posta gelecek hafta günde 200 ile başlar.</>
                  ) : m.isinma.bugunLimit === null ? (
                    <>
                      Isınma tamamlandı · ticari e-postada günlük sınır yok. Bugün gönderilen{' '}
                      {sayi(m.isinma.bugunGonderilen)}.
                    </>
                  ) : (
                    <>
                      {m.isinma.hafta}. haftadayız · bugünkü ticari limit{' '}
                      <strong>{sayi(m.isinma.bugunLimit)}</strong>, gönderilen{' '}
                      {sayi(m.isinma.bugunGonderilen)}. Limiti aşan kişiler ertesi sabaha kalır.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px 22px',
                padding: '12px 18px',
                borderTop: '1px solid #EEF0F5',
                background: '#F6F8FD',
                fontSize: 12.5,
                color: '#3A4052',
              }}
            >
              <span>
                Geri dönme (7 gün) <strong>{yuzde(m.itibar.geriDonme)}</strong> · sınır{' '}
                {yuzde(m.itibar.sinir.geriDonme)}
              </span>
              <span>
                Spam şikâyeti <strong>{yuzde(m.itibar.sikayet, 2)}</strong> · sınır{' '}
                {yuzde(m.itibar.sinir.sikayet)}
              </span>
              <span>
                Son 7 günde gönderilen <strong>{sayi(m.itibar.gonderilen)}</strong> e-posta,{' '}
                {sayi(m.itibar.ticariGonderilen)} ticari
              </span>
            </div>
            <p
              style={{
                margin: 0,
                padding: '12px 18px',
                fontSize: 13,
                lineHeight: 1.5,
                color: '#2E3344',
                borderTop: '1px solid #EEF0F5',
              }}
            >
              <strong>Ajan:</strong> sınırlardan biri aşılırsa (en az {sayi(m.itibar.sinir.enAzGonderim)}{' '}
              gönderimde) ticari e-postayı kendiliğinden durdurur ve işlem kaydına yazar; doğrulama kodu ve
              ödeme e-postaları gitmeye devam eder.
            </p>
          </section>

          <section style={kart} aria-labelledby="kurallar">
            <h2
              id="kurallar"
              style={{
                margin: 0,
                padding: '16px 18px',
                fontSize: 17,
                fontWeight: 800,
                borderBottom: '1px solid #EEF0F5',
              }}
            >
              Gönderim kuralları
            </h2>
            {m.kurallar.map((gk) => (
              <div
                key={gk.ad}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '6px 16px',
                  padding: '11px 18px',
                  borderBottom: '1px solid #EEF0F5',
                }}
              >
                <span style={{ flex: '999 1 280px', minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800 }}>{gk.ad}</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 2 }}>
                    {gk.not}
                  </span>
                </span>
                <span
                  style={{
                    flex: '1 1 200px',
                    border: '1px solid #D5DAE5',
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 13.5,
                    fontWeight: 600,
                  }}
                >
                  {gk.deger}
                </span>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </>
  );
}
