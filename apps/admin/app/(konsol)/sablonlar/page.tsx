'use client';

import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

interface Satir {
  key: string;
  ad: string;
  tur: 'İşlemsel' | 'Ticari';
  kanallar: string[];
  surum: number;
}
interface Icerik {
  baslik: string;
  metin: string;
  sms?: string;
  eposta?: { konu: string; paragraflar: string[]; dugme?: { yazi: string; url: string } };
}
interface Detay {
  key: string;
  ad: string;
  tur: string;
  surum: number;
  kanallar: string[];
  degiskenler: string[];
  icerik: Icerik;
  kural: string;
}
interface Onizleme {
  uygulama: { baslik: string; metin: string };
  eposta: { kimden: string; konu: string; html: string } | null;
  sms: { metin: string; karakter: number; adet: number } | null;
}
type Kanal = 'eposta' | 'push' | 'sms' | 'uygulama';

const girdi: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 4,
  border: '1px solid #D5DAE5',
  borderRadius: 10,
  padding: '9px 10px',
  fontSize: 13.5,
  lineHeight: 1.5,
  fontFamily: 'inherit',
};
const etiket: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 10 };

/**
 * Şablonlar (YonetimKampanya.dc.html › şablonlar; Karar 48): tek şablondan e-posta, push, SMS ve uygulama içi metin.
 * Değişkenler {{ad}} biçiminde; yalnızca şablonun tanıdığı değişkenler kullanılabilir. Kayıt yeni sürüm olarak eklenir,
 * önizleme "Ayşe için" örnek değerlerle sunucuda üretilir (gönderilecek e-postanın aynısı).
 */
export default function Sablonlar() {
  const { me } = useKonsol();
  const duzenler = me.permissions['kampanya.hazirla'] === 'tam';
  const [liste, setListe] = useState<Satir[]>([]);
  const [sec, setSec] = useState('talep.suresi_doluyor');
  const [d, setD] = useState<Detay | null>(null);
  const [ic, setIc] = useState<Icerik | null>(null);
  const [kanal, setKanal] = useState<Kanal>('eposta');
  const [onz, setOnz] = useState<Onizleme | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    yonetim<Satir[]>('notifications/templates')
      .then(setListe)
      .catch((e: Error) => setHata(e.message));
  }, []);
  useEffect(() => {
    setBilgi(null);
    yonetim<Detay>(`notifications/templates/${sec}`)
      .then((x) => {
        setD(x);
        setIc(x.icerik);
        setKanal(x.icerik.eposta ? 'eposta' : 'uygulama');
      })
      .catch((e: Error) => setHata(e.message));
  }, [sec]);

  // Önizleme: yazarken kısa gecikmeyle sunucuda üretilir
  const onizle = useCallback(async (key: string, icerik: Icerik) => {
    try {
      setOnz(
        await yonetim<Onizleme>(`notifications/templates/${key}/preview`, {
          method: 'POST',
          body: { icerik },
        }),
      );
      setHata(null);
    } catch (e) {
      setHata((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (!ic || !d) return;
    const t = setTimeout(() => onizle(d.key, ic), 400);
    return () => clearTimeout(t);
  }, [ic, d, onizle]);

  async function kaydet() {
    if (!d || !ic) return;
    try {
      const x = await yonetim<Detay>(`notifications/templates/${d.key}`, { method: 'POST', body: ic });
      setD(x);
      setListe((l) => l.map((s) => (s.key === x.key ? { ...s, surum: x.surum } : s)));
      setBilgi(`Sürüm ${x.surum} kaydedildi; bir dakika içinde gönderimlerde kullanılır.`);
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function test() {
    if (!d) return;
    try {
      await yonetim(`notifications/templates/${d.key}/test`, { method: 'POST', body: {} });
      setBilgi('Test e-postası kendi adresine gönderildi (örnek değerlerle).');
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const kanallar: [Kanal, string, boolean][] = [
    ['eposta', 'E-posta', !!ic?.eposta],
    ['push', 'Push', !!d?.kanallar.includes('push')],
    ['sms', 'SMS', d?.icerik.sms !== undefined],
    ['uygulama', 'Uygulama içi', !!d?.kanallar.includes('uygulama içi')],
  ];

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Şablonlar</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Tek şablondan e-posta, push, SMS ve uygulama içi metin. Değişkenler süslü parantezle yazılır.
        </p>
      </div>
      {hata ? <p style={{ color: '#A3271F', fontWeight: 700 }}>{hata}</p> : null}
      {bilgi ? <p style={{ color: '#11683F', fontWeight: 700 }}>{bilgi}</p> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section
          aria-label="Şablon listesi"
          style={{
            flex: '1 1 280px',
            maxWidth: 340,
            minWidth: 0,
            background: '#FFFFFF',
            border: '1px solid #E3E6EF',
            borderRadius: 18,
            padding: 8,
          }}
        >
          {liste.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSec(s.key)}
              aria-current={s.key === sec}
              style={{
                width: '100%',
                display: 'block',
                textAlign: 'left',
                border: 0,
                background: s.key === sec ? '#F3EFFF' : 'transparent',
                borderRadius: 12,
                padding: '10px 12px',
                cursor: 'pointer',
                color: '#1E2333',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 800 }}>{s.ad}</span>
                <span
                  style={{
                    flex: 'none',
                    alignSelf: 'flex-start',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: s.tur === 'Ticari' ? '#FFEEF6' : '#EEF3FF',
                    color: s.tur === 'Ticari' ? '#A3236A' : '#2450C8',
                  }}
                >
                  {s.tur}
                </span>
              </span>
              <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 2 }}>
                {s.kanallar.join(', ')} · s.{s.surum}
              </span>
            </button>
          ))}
        </section>

        {d && ic ? (
          <section
            aria-labelledby="sbad"
            style={{
              flex: '999 1 480px',
              minWidth: 0,
              background: '#FFFFFF',
              border: '1px solid #E3E6EF',
              borderRadius: 18,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 18px',
                borderBottom: '1px solid #EEF0F5',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <h2 id="sbad" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                {d.ad}{' '}
                <span style={{ fontSize: 13, color: '#5A6073', fontWeight: 600 }}>· sürüm {d.surum}</span>
              </h2>
              <span style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={test}
                  disabled={!ic.eposta}
                  style={{
                    border: '1px solid #D5DAE5',
                    background: '#FFFFFF',
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#1E2333',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Kendime test gönder
                </button>
                {duzenler ? (
                  <button
                    type="button"
                    onClick={kaydet}
                    style={{
                      border: 0,
                      background: '#3DD68C',
                      borderRadius: 10,
                      padding: '9px 14px',
                      fontSize: 13,
                      fontWeight: 800,
                      color: '#1E2333',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Yeni sürüm olarak kaydet
                  </button>
                ) : null}
              </span>
            </div>
            <div
              role="tablist"
              aria-label="Kanal"
              style={{ display: 'flex', gap: 4, padding: '0 12px', borderBottom: '1px solid #EEF0F5' }}
            >
              {kanallar.map(([k, ad, var_]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={kanal === k}
                  disabled={!var_}
                  onClick={() => setKanal(k)}
                  style={{
                    border: 0,
                    borderBottom: `3px solid ${kanal === k ? '#5B8CFF' : 'transparent'}`,
                    background: 'transparent',
                    padding: '11px 10px',
                    fontSize: 14,
                    fontWeight: kanal === k ? 800 : 600,
                    color: var_ ? (kanal === k ? '#1E2333' : '#3A4052') : '#AEB5C4',
                    cursor: var_ ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                  }}
                >
                  {ad}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '16px 18px' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                {kanal === 'eposta' && ic.eposta ? (
                  <>
                    <label style={etiket}>
                      Konu
                      <input
                        value={ic.eposta.konu}
                        readOnly={!duzenler}
                        onChange={(e) =>
                          setIc({
                            ...ic,
                            eposta: { ...(ic.eposta as NonNullable<Icerik['eposta']>), konu: e.target.value },
                          })
                        }
                        style={girdi}
                      />
                    </label>
                    <label style={etiket}>
                      Gövde (her satır bir paragraf)
                      <textarea
                        rows={6}
                        value={ic.eposta.paragraflar.join('\n')}
                        readOnly={!duzenler}
                        onChange={(e) =>
                          setIc({
                            ...ic,
                            eposta: {
                              ...(ic.eposta as NonNullable<Icerik['eposta']>),
                              paragraflar: e.target.value.split('\n').filter((x) => x.trim()),
                            },
                          })
                        }
                        style={girdi}
                      />
                    </label>
                    {ic.eposta.dugme ? (
                      <label style={etiket}>
                        Buton
                        <input
                          value={ic.eposta.dugme.yazi}
                          readOnly={!duzenler}
                          onChange={(e) =>
                            setIc({
                              ...ic,
                              eposta: {
                                ...(ic.eposta as NonNullable<Icerik['eposta']>),
                                dugme: {
                                  ...(ic.eposta?.dugme as { yazi: string; url: string }),
                                  yazi: e.target.value,
                                },
                              },
                            })
                          }
                          style={girdi}
                        />
                      </label>
                    ) : null}
                  </>
                ) : kanal === 'sms' ? (
                  <label style={etiket}>
                    SMS metni
                    <textarea
                      rows={3}
                      value={ic.sms ?? ''}
                      readOnly={!duzenler}
                      onChange={(e) => setIc({ ...ic, sms: e.target.value })}
                      style={girdi}
                    />
                  </label>
                ) : (
                  <>
                    <label style={etiket}>
                      Başlık
                      <input
                        value={ic.baslik}
                        readOnly={!duzenler}
                        onChange={(e) => setIc({ ...ic, baslik: e.target.value })}
                        style={girdi}
                      />
                    </label>
                    <label style={etiket}>
                      Metin
                      <textarea
                        rows={3}
                        value={ic.metin}
                        readOnly={!duzenler}
                        onChange={(e) => setIc({ ...ic, metin: e.target.value })}
                        style={girdi}
                      />
                    </label>
                  </>
                )}
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Değişkenler</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {d.degiskenler.map((v) => (
                    <span
                      key={v}
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '4px 9px',
                        borderRadius: 999,
                        background: '#F3EFFF',
                        color: '#4B2FA6',
                      }}
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
                <p style={{ margin: '10px 0 0', fontSize: 12, color: '#5A6073' }}>{d.kural}</p>
              </div>
              <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Önizleme · Ayşe için</div>
                {kanal === 'eposta' && onz?.eposta ? (
                  <div
                    style={{
                      border: '1px solid #E3E6EF',
                      borderRadius: 14,
                      overflow: 'hidden',
                      background: '#F6F8FD',
                    }}
                  >
                    <div
                      style={{
                        background: '#FFFFFF',
                        padding: '10px 14px',
                        borderBottom: '1px solid #E3E6EF',
                        fontSize: 12,
                        color: '#3A4052',
                      }}
                    >
                      <strong>{onz.eposta.kimden}</strong>
                      <br />
                      Konu: {onz.eposta.konu}
                    </div>
                    <iframe
                      title="E-posta önizlemesi"
                      srcDoc={onz.eposta.html}
                      sandbox=""
                      style={{ width: '100%', height: 420, border: 0, background: '#FFFFFF' }}
                    />
                  </div>
                ) : kanal === 'sms' && onz?.sms ? (
                  <div style={{ background: '#F3F5FA', borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#5A6073' }}>RENGARENK</div>
                    <div
                      style={{
                        background: '#FFFFFF',
                        borderRadius: 12,
                        padding: '10px 12px',
                        marginTop: 6,
                        fontSize: 13.5,
                      }}
                    >
                      {onz.sms.metin}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#5A6073', marginTop: 6 }}>
                      {onz.sms.karakter} karakter · {onz.sms.adet} SMS · Türkçe karakter kullanılmaz (tek
                      SMS’e sığması için)
                    </div>
                  </div>
                ) : onz ? (
                  <div style={{ background: '#1E2333', borderRadius: 16, padding: 14 }}>
                    <div style={{ color: '#AEB5C4', fontSize: 11, textAlign: 'center' }}>10:00</div>
                    <div
                      style={{ background: '#FFFFFF', borderRadius: 12, padding: '10px 12px', marginTop: 8 }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#5A6073' }}>RENGARENK · şimdi</div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, marginTop: 2 }}>
                        {onz.uygulama.baslik}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#3A4052', marginTop: 2 }}>
                        {onz.uygulama.metin}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
