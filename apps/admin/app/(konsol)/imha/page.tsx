'use client';

import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

interface Ozet {
  saklama: { key: string; ad: string; dayanak: string; sure: string; sonra: string }[];
  donem: {
    id: string;
    no: string;
    tarih: string;
    durum: 'liste' | 'onaylandi' | 'calisti';
    sayim: string | null;
    onaylayan: string | null;
    onayTarihi: string | null;
    liste: { kalem: string; ad: string; sayi: number }[];
  };
  onceki: { id: string; no: string; tarih: string } | null;
  verbis: { zorunlu: boolean; olcutler: { ad: string; deger: string; w: number }[]; envanter: string | null };
  disinda: string[];
}

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const SUTUN = 'minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1.4fr)';
const gun = (iso: string, yil = true) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    ...(yil ? { year: 'numeric' } : {}),
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso));
const kisaGun = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' }).format(
    new Date(iso),
  );
const sayi = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
/** "1 Ocak’ta", "1 Temmuz’da" */
const gunde = (iso: string) => `${gun(iso, false)}’${new Date(iso).getUTCMonth() < 6 ? 'ta' : 'da'}`;

/**
 * Saklama, imha ve VERBİS (YonetimSistem.dc.html › imha; Karar 59). Periyodik imha 6 ayda bir; ajan süresi dolan
 * kayıtları listeler, liste Sahip onayıyla imha edilir ve tutanağı saklanır.
 */
export default function Imha() {
  const { me } = useKonsol();
  const [o, setO] = useState<Ozet | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  const yukle = useCallback(() => {
    yonetim<Ozet>('retention')
      .then(setO)
      .catch((e: Error) => setHata(e.message));
  }, []);
  useEffect(yukle, [yukle]);

  async function onayla() {
    if (!o) return;
    setHata(null);
    try {
      await yonetim(`retention/${o.donem.id}/approve`, { method: 'POST', body: {} });
      setBilgi('İmha listesi onaylandı.');
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function tutanak(id: string, no: string) {
    try {
      const r = await yonetim<unknown>(`retention/${id}/report`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `imha-tutanagi-${no}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const d = o?.donem;
  const onaylandi = d?.durum === 'onaylandi';
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Saklama, imha ve VERBİS</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Periyodik imha 6 ayda bir. Ajan süresi dolan kayıtları listeler; imha sahip onayıyla yapılır ve
          tutanağı saklanır.
        </p>
      </div>
      {hata ? (
        <p role="alert" style={{ color: '#A3271F', fontWeight: 700 }}>
          {hata}
        </p>
      ) : null}
      {bilgi ? (
        <p role="status" style={{ color: '#11683F', fontWeight: 700 }}>
          {bilgi}
        </p>
      ) : null}
      {o && d ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
          <section
            aria-labelledby="sure"
            style={{ ...kart, flex: '3 1 480px', minWidth: 0, overflow: 'hidden' }}
          >
            <h2
              id="sure"
              style={{
                margin: 0,
                padding: '16px 18px',
                fontSize: 17,
                fontWeight: 800,
                borderBottom: '1px solid #EEF0F5',
              }}
            >
              Saklama süreleri
            </h2>
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
              <span>Veri</span>
              <span>Süre</span>
              <span>Süre dolunca</span>
            </div>
            {o.saklama.map((s) => (
              <div
                key={s.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: SUTUN,
                  gap: 8,
                  padding: '10px 18px',
                  borderTop: '1px solid #EEF0F5',
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 700 }}>
                  {s.ad}
                  <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#5A6073' }}>
                    {s.dayanak}
                  </span>
                </span>
                <span>{s.sure}</span>
                <span style={{ color: '#3A4052' }}>{s.sonra}</span>
              </div>
            ))}
            <p
              style={{
                margin: 0,
                padding: '10px 18px 14px',
                fontSize: 12,
                color: '#5A6073',
                borderTop: '1px solid #EEF0F5',
              }}
            >
              {o.disinda.join(', ')} yalnızca ekleme yapılan kayıtlardır; satırları hiç değiştirilmez ve
              silinmez. İşlem kaydındaki IP adresleri dönem anahtarıyla şifrelidir; 2 yıl dolunca anahtar imha
              edilir ve IP okunamaz olur. Hesap kapanınca bu kayıtların kişiyle bağı kopar.
            </p>
          </section>

          <div style={{ flex: '2 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section
              aria-labelledby="donem"
              style={{
                ...kart,
                border: `1.5px solid ${onaylandi ? '#B9EBD1' : '#5B8CFF'}`,
                padding: '16px 18px',
              }}
            >
              <h2 id="donem" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                Sıradaki periyodik imha · {gun(d.tarih)}
              </h2>
              <p style={{ margin: '4px 0 10px', fontSize: 12.5, color: '#5A6073' }}>
                {o.onceki ? (
                  <>
                    Önceki: {gun(o.onceki.tarih)} · tutanak{' '}
                    <button
                      type="button"
                      onClick={() => o.onceki && tutanak(o.onceki.id, o.onceki.no)}
                      style={{
                        border: 0,
                        background: 'none',
                        padding: 0,
                        color: '#2450C8',
                        fontWeight: 700,
                        fontSize: 12.5,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {o.onceki.no}
                    </button>
                  </>
                ) : (
                  'Önceki: henüz periyodik imha yapılmadı'
                )}
                {d.sayim ? ` · ajanın son sayımı ${kisaGun(d.sayim)}` : ''}
              </p>
              {d.liste.map((k) => (
                <div
                  key={k.kalem}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '7px 0',
                    borderTop: '1px solid #EEF0F5',
                    fontSize: 13,
                  }}
                >
                  <span>{k.ad}</span>
                  <strong>{sayi(k.sayi)}</strong>
                </div>
              ))}
              {d.durum === 'liste' && me.role === 'OWNER' ? (
                <button
                  type="button"
                  onClick={onayla}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    border: 0,
                    background: '#5B8CFF',
                    borderRadius: 12,
                    padding: 11,
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#1E2333',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Listeyi onayla · {gunde(d.tarih)} imha et
                </button>
              ) : d.durum === 'liste' ? (
                <p style={{ margin: '12px 0 0', fontSize: 13, color: '#5A6073' }}>
                  Listeyi yalnızca sahip onaylar; onaylanmayan liste imha edilmez.
                </p>
              ) : (
                <p style={{ margin: '12px 0 0', fontSize: 13.5, fontWeight: 800, color: '#11683F' }}>
                  Onaylandı · {gun(d.tarih, false)} 03.00’te çalışacak · tutanak {d.no} hazırlanacak
                  {d.onaylayan ? (
                    <span
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#5A6073',
                        marginTop: 2,
                      }}
                    >
                      Onaylayan: {d.onaylayan}
                      {d.onayTarihi ? ` · ${kisaGun(d.onayTarihi)}` : ''}
                    </span>
                  ) : null}
                </p>
              )}
            </section>

            <section aria-labelledby="verbis" style={{ ...kart, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <h2 id="verbis" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                  VERBİS
                </h2>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: o.verbis.zorunlu ? '#FDECEC' : '#E7FAF0',
                    color: o.verbis.zorunlu ? '#A3271F' : '#11683F',
                  }}
                >
                  {o.verbis.zorunlu ? 'Kayıt gerekiyor' : 'Kayıt şimdilik zorunlu değil'}
                </span>
              </div>
              {o.verbis.olcutler.map((v) => (
                <div key={v.ad} style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{v.ad}</span>
                    <strong>{v.deger}</strong>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: '#EEF0F5', marginTop: 5 }}>
                    <div style={{ height: 8, width: `${v.w}%`, borderRadius: 999, background: '#5B8CFF' }} />
                  </div>
                </div>
              ))}
              <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.5, color: '#5A6073' }}>
                Muafiyet: 50’den az çalışan ve 100 milyon TL’den az yıllık bilanço, ana faaliyet özel
                nitelikli veri işleme değil. Eşiklerden biri aşılırsa ajan hatırlatır. Kişisel veri envanteri
                yine tutulur
                {o.verbis.envanter ? ` · son güncelleme ${kisaGun(o.verbis.envanter)}` : ''}. Avukat teyidi
                gerekir.
              </p>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
