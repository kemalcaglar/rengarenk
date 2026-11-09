'use client';

import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';

interface Satir {
  id: string;
  no: string;
  kanal: string;
  konu: string;
  kim: string;
  etiket: string;
  durum: 'acik' | 'yanitlandi' | 'cozuldu';
  oncelikli: boolean;
  sonTarih: string | null;
}
interface Kuyruk {
  sayilar: { ad: string; deger: string; not: string }[];
  acik: Satir[];
  cozulen: Satir[];
}
interface Detay {
  id: string;
  numara: string;
  konu: string;
  konuTur: string;
  kanal: string;
  referans: string | null;
  durum: 'acik' | 'yanitlandi' | 'cozuldu';
  durumAd: string;
  puan: number | null;
  mesajlar: { id: string; taraf: 'kullanici' | 'destek'; kim: string; metin: string }[];
  kisi: { ad: string; userId: string | null };
  oneri: { soru: string; cevap: string; skor: number } | null;
  /** Rengarenk Ajanı: taslak ve güven ya da insana bırakma notu */
  ajan: { taslak: string | null; guven: number | null; not: string | null; yanitladi: boolean } | null;
  makrolar: { ad: string; metin: string }[];
}

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };

function sure(s: Satir, simdi: number): [string, string] {
  if (s.durum === 'cozuldu') return ['Çözüldü', '#11683F'];
  if (s.durum === 'yanitlandi') return ['Yanıtlandı', '#2450C8'];
  if (!s.sonTarih) return ['', '#5A6073'];
  const fark = new Date(s.sonTarih).getTime() - simdi;
  const sa = Math.floor(Math.abs(fark) / 3_600_000);
  const dk = Math.floor((Math.abs(fark) % 3_600_000) / 60_000);
  const y = `${sa ? `${sa} sa ` : ''}${dk} dk`;
  return fark < 0 ? [`Süre aştı · ${y}`, '#A3271F'] : [`Kalan ${y}`, '#5A6073'];
}

/**
 * Destek (YonetimPazar.dc.html › destek; Karar 54): uygulama içi sohbet ve e-posta tek kuyrukta, ilk yanıt süresi,
 * hazır yanıtlar, sık sorulanlardan önerilen yanıt (yapay zekâ taslağı Rengarenk Ajanı ile gelir), kullanıcı kartına geçiş.
 * Telefon numarası maskelidir. İade bu ekrandan yapılmaz; Ödemeler ekranında önerilir.
 */
export default function Destek() {
  const [q, setQ] = useState<Kuyruk | null>(null);
  const [sec, setSec] = useState<string | null>(null);
  const [d, setD] = useState<Detay | null>(null);
  const [metin, setMetin] = useState('');
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [simdi, setSimdi] = useState(() => Date.now());

  const yukle = useCallback(async () => {
    try {
      const k = await yonetim<Kuyruk>('support/tickets');
      setQ(k);
      setSec((s) => s ?? k.acik[0]?.id ?? k.cozulen[0]?.id ?? null);
    } catch (e) {
      setHata((e as Error).message);
    }
  }, []);
  useEffect(() => {
    yukle();
    const t = setInterval(() => setSimdi(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [yukle]);
  useEffect(() => {
    if (!sec) return;
    setD(null);
    yonetim<Detay>(`support/tickets/${sec}`)
      .then((x) => {
        setD(x);
        setMetin(x.durum !== 'cozuldu' ? (x.ajan?.taslak ?? x.oneri?.cevap ?? '') : '');
      })
      .catch((e: Error) => setHata(e.message));
  }, [sec]);

  async function gonder(coz: boolean) {
    if (!d || !metin.trim()) return;
    setHata(null);
    try {
      setD(
        await yonetim<Detay>(`support/tickets/${d.id}/reply`, {
          method: 'POST',
          body: { metin: metin.trim(), coz },
        }),
      );
      setMetin('');
      setBilgi(
        coz
          ? 'Yanıt gönderildi · çözüldü · memnuniyet sorusu 24 saat sonra gidecek'
          : 'Yanıt gönderildi; kullanıcıya bildirim ve e-posta gidiyor.',
      );
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function coz() {
    if (!d) return;
    try {
      setD(await yonetim<Detay>(`support/tickets/${d.id}/resolve`, { method: 'POST' }));
      setBilgi('Talep çözüldü olarak kapatıldı.');
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const satirlar = q ? [...q.acik, ...q.cozulen] : [];
  const taslakVar = Boolean(d?.ajan?.taslak || d?.oneri);
  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Destek</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Uygulama içi sohbet ve e-posta tek kuyrukta. Telefon desteği ilk sürümde yok.
        </p>
      </div>
      {hata ? <p style={{ color: '#A3271F', fontWeight: 700 }}>{hata}</p> : null}
      {q ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
            gap: 10,
            marginBottom: 14,
          }}
        >
          {q.sayilar.map((s) => (
            <div key={s.ad} style={{ ...kart, borderRadius: 16, padding: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5A6073' }}>{s.ad}</div>
              <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4 }}>{s.deger}</div>
              <div style={{ fontSize: 12, color: '#5A6073', marginTop: 3 }}>{s.not}</div>
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section
          aria-label="Destek talepleri"
          style={{ ...kart, flex: '1 1 300px', maxWidth: 360, minWidth: 0, padding: 8 }}
        >
          {q && !satirlar.length ? (
            <p style={{ margin: 0, padding: 12, fontSize: 13.5, color: '#5A6073' }}>Destek talebi yok.</p>
          ) : null}
          {satirlar.map((s) => {
            const on = s.id === sec;
            const [st, sr] = sure(s, simdi);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSec(s.id);
                  setBilgi(null);
                }}
                aria-current={on}
                style={{
                  width: '100%',
                  display: 'block',
                  textAlign: 'left',
                  border: 0,
                  background: on ? '#F3EFFF' : 'transparent',
                  borderRadius: 12,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  color: '#1E2333',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 11.5,
                    fontWeight: 800,
                  }}
                >
                  <span style={{ color: '#5A6073' }}>
                    {s.no} · {s.kanal}
                    {s.oncelikli && s.durum !== 'cozuldu' ? ' · öncelikli' : ''}
                  </span>
                  <span style={{ color: sr }}>{st}</span>
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 800,
                    marginTop: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.konu}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 2 }}>
                  {s.kim} · {s.etiket}
                </span>
              </button>
            );
          })}
        </section>

        <section
          aria-labelledby="dt"
          style={{ ...kart, flex: '999 1 480px', minWidth: 0, overflow: 'hidden' }}
        >
          {d ? (
            <>
              <div
                style={{
                  padding: '16px 18px',
                  borderBottom: '1px solid #EEF0F5',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <h2 id="dt" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                    {d.konu}
                  </h2>
                  <span style={{ display: 'block', fontSize: 13, color: '#3A4052', marginTop: 3 }}>
                    {d.numara} · {d.kisi.ad} · {d.kanal} · {d.konuTur}
                    {d.referans ? ` · No ${d.referans}` : ''}
                  </span>
                </span>
                {d.kisi.userId ? (
                  <Link
                    href={`/kullanicilar?kisi=${d.kisi.userId}`}
                    style={{ fontSize: 13.5, fontWeight: 700, color: '#2450C8' }}
                  >
                    Kullanıcı kartını aç
                  </Link>
                ) : null}
              </div>
              <div style={{ padding: '14px 18px', background: '#F6F8FD' }}>
                {d.mesajlar.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: m.taraf === 'destek' ? 'flex-end' : 'flex-start',
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '80%',
                        background: m.taraf === 'destek' ? '#EEF3FF' : '#FFFFFF',
                        border: '1px solid #E3E6EF',
                        borderRadius: 14,
                        padding: '9px 12px',
                        fontSize: 13.5,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: '#5A6073' }}>
                        {m.kim}
                      </span>
                      {m.metin}
                    </div>
                  </div>
                ))}
              </div>
              {d.durum !== 'cozuldu' && d.ajan?.not && !d.ajan.taslak ? (
                <p
                  style={{
                    margin: 0,
                    padding: '12px 18px 0',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#7A5300',
                  }}
                >
                  Ajan: {d.ajan.not}
                </p>
              ) : null}
              {d.durum !== 'cozuldu' ? (
                <div style={{ padding: '14px 18px', borderTop: '1px solid #EEF0F5' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontSize: 12.5,
                      fontWeight: 800,
                    }}
                  >
                    <span style={{ color: '#4B2FA6' }}>{taslakVar ? 'Ajanın taslağı' : 'Yanıt'}</span>
                    <span style={{ color: '#5A6073' }}>
                      {d.ajan?.taslak
                        ? `Güven %${d.ajan.guven ?? 0} · eşik %90 altında, onayın gerekiyor`
                        : d.oneri
                          ? `Sık sorulanlardan: “${d.oneri.soru}” · onayın gerekiyor`
                          : ''}
                    </span>
                  </div>
                  <label
                    htmlFor="yanit"
                    style={{
                      position: 'absolute',
                      width: 1,
                      height: 1,
                      overflow: 'hidden',
                      clip: 'rect(0 0 0 0)',
                    }}
                  >
                    Yanıt metni
                  </label>
                  <textarea
                    id="yanit"
                    value={metin}
                    onChange={(e) => setMetin(e.target.value)}
                    rows={5}
                    maxLength={4000}
                    style={{
                      display: 'block',
                      width: '100%',
                      boxSizing: 'border-box',
                      marginTop: 6,
                      border: `1.5px solid ${taslakVar ? '#C9B8FF' : '#D5DAE5'}`,
                      background: taslakVar ? '#FAF7FF' : '#FFFFFF',
                      borderRadius: 12,
                      padding: '10px 12px',
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {d.makrolar.map((h) => (
                      <button
                        key={h.ad}
                        type="button"
                        onClick={() => setMetin((m) => (m.trim() ? `${m.trim()}\n\n${h.metin}` : h.metin))}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '5px 10px',
                          borderRadius: 999,
                          border: '1px dashed #AEB5C4',
                          background: '#FFFFFF',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {h.ad}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => gonder(false)}
                      style={{
                        border: '1px solid #D5DAE5',
                        background: '#FFFFFF',
                        borderRadius: 10,
                        padding: '9px 14px',
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: '#1E2333',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Gönder
                    </button>
                    <button
                      type="button"
                      onClick={() => gonder(true)}
                      style={{
                        border: 0,
                        background: '#5B8CFF',
                        borderRadius: 10,
                        padding: '10px 16px',
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: '#1E2333',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Gönder ve çözüldü say
                    </button>
                    <button
                      type="button"
                      onClick={coz}
                      style={{
                        border: 0,
                        background: 'transparent',
                        padding: '9px 6px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#5A6073',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Yanıtsız kapat
                    </button>
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: 12, color: '#5A6073' }}>
                    İade, hesap silme ve hukuki konular her zaman insana kalır. İade gerekiyorsa{' '}
                    <Link href="/odemeler">Ödemeler ekranında öner</Link>; iadeyi yalnızca sahip onaylar.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    padding: '14px 18px',
                    borderTop: '1px solid #EEF0F5',
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: '#11683F',
                  }}
                >
                  {bilgi ?? (d.ajan?.yanitladi ? `Ajan çözdü · ${d.ajan.not ?? ''}` : 'Çözüldü')}
                  {d.puan ? ` · memnuniyet ${d.puan}/5` : ''}
                </div>
              )}
              {bilgi && d.durum !== 'cozuldu' ? (
                <p
                  role="status"
                  style={{
                    margin: 0,
                    padding: '0 18px 14px',
                    fontSize: 13,
                    color: '#11683F',
                    fontWeight: 700,
                  }}
                >
                  {bilgi}
                </p>
              ) : null}
            </>
          ) : (
            <p style={{ margin: 0, padding: 18, fontSize: 13.5, color: '#5A6073' }}>
              {q ? 'Bir destek talebi seç.' : 'Yükleniyor…'}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
