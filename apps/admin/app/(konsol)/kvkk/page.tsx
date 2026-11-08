'use client';

import { KVKK_KIND_KEYS, KVKK_KINDS, type KvkkKind } from '@rengarenk/shared';
import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

interface Satir {
  id: string;
  numara: string;
  tur: string;
  kim: string;
  alt: string;
  durum: 'acik' | 'yanitlandi';
  kalanGun: number | null;
  uyari: boolean;
}
interface Liste {
  sayilar: { ad: string; deger: string; not: string }[];
  acik: Satir[];
  kapali: Satir[];
}
interface Detay {
  id: string;
  numara: string;
  baslik: string;
  alt: string;
  metin: string;
  veriler: string[];
  taslak: string | null;
  yanit: string | null;
  durum: 'acik' | 'yanitlandi';
  userId: string | null;
  silme: boolean;
}

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const girdi: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 4,
  border: '1px solid #D5DAE5',
  borderRadius: 10,
  padding: 9,
  fontSize: 14,
  background: '#FFFFFF',
  fontFamily: 'inherit',
};

/**
 * KVKK başvuruları (YonetimSistem.dc.html › kvkk; Karar 58): 30 gün süre, ajanın topladığı veriler ve yanıt taslağı;
 * yanıtı her zaman bir çalışan okuyup gönderir. Dışarıdan (e-posta, posta) gelen başvuru kimlik doğrulandıktan sonra
 * buradan kaydedilir.
 */
export default function Kvkk() {
  const { me } = useKonsol();
  const gonderebilir = me.permissions['kvkk.yanitla'] === 'tam';
  const [l, setL] = useState<Liste | null>(null);
  const [sec, setSec] = useState<string | null>(null);
  const [d, setD] = useState<Detay | null>(null);
  const [metin, setMetin] = useState('');
  const [okudum, setOkudum] = useState(false);
  const [yeni, setYeni] = useState(false);
  const [dis, setDis] = useState<{
    ad: string;
    eposta: string;
    tur: KvkkKind;
    metin: string;
    kanal: 'eposta' | 'posta';
  }>({
    ad: '',
    eposta: '',
    tur: 'bilgi',
    metin: '',
    kanal: 'eposta',
  });
  const [kimlik, setKimlik] = useState(false);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    try {
      const x = await yonetim<Liste>('kvkk');
      setL(x);
      setSec((s) => s ?? x.acik[0]?.id ?? x.kapali[0]?.id ?? null);
    } catch (e) {
      setHata((e as Error).message);
    }
  }, []);
  useEffect(() => {
    yukle();
  }, [yukle]);
  useEffect(() => {
    if (!sec) return;
    setD(null);
    setOkudum(false);
    yonetim<Detay>(`kvkk/${sec}`)
      .then((x) => {
        setD(x);
        setMetin(x.taslak ?? '');
      })
      .catch((e: Error) => setHata(e.message));
  }, [sec]);

  async function gonder() {
    if (!d) return;
    setHata(null);
    try {
      setD(await yonetim<Detay>(`kvkk/${d.id}/reply`, { method: 'POST', body: { metin, okudum: true } }));
      setBilgi('Yanıt gönderildi · başvuru kapatıldı ve kaydı 3 yıl saklanacak');
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function kaydet() {
    setHata(null);
    try {
      const x = await yonetim<Detay>('kvkk', { method: 'POST', body: { ...dis, kimlikDogrulandi: true } });
      setYeni(false);
      setKimlik(false);
      setDis({ ad: '', eposta: '', tur: 'bilgi', metin: '', kanal: 'eposta' });
      setBilgi(`${x.numara} kaydedildi; 30 günlük süre başladı.`);
      await yukle();
      setSec(x.id);
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const satirlar = l ? [...l.acik, ...l.kapali] : [];
  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>KVKK başvuruları</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
            En geç 30 gün içinde yanıtlanır (KVKK m.13). Ajan taslak hazırlar; yanıtı her zaman bir çalışan
            gönderir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setYeni((v) => !v)}
          style={{
            border: '1px solid #D5DAE5',
            background: '#FFFFFF',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13.5,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Dışarıdan gelen başvuruyu kaydet
        </button>
      </div>
      {hata ? <p style={{ color: '#A3271F', fontWeight: 700 }}>{hata}</p> : null}
      {bilgi ? (
        <p
          role="status"
          style={{
            background: '#E7FAF0',
            color: '#11683F',
            borderRadius: 12,
            padding: '10px 14px',
            fontWeight: 700,
          }}
        >
          {bilgi}
        </p>
      ) : null}
      {yeni ? (
        <section style={{ ...kart, padding: 18, marginBottom: 14 }} aria-label="Dışarıdan başvuru">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <label style={{ flex: '1 1 200px', fontSize: 12.5, fontWeight: 700 }}>
              Ad soyad
              <input value={dis.ad} onChange={(e) => setDis({ ...dis, ad: e.target.value })} style={girdi} />
            </label>
            <label style={{ flex: '1 1 220px', fontSize: 12.5, fontWeight: 700 }}>
              Yanıt e-postası
              <input
                value={dis.eposta}
                onChange={(e) => setDis({ ...dis, eposta: e.target.value })}
                style={girdi}
              />
            </label>
            <label style={{ flex: '0 1 160px', fontSize: 12.5, fontWeight: 700 }}>
              Tür
              <select
                value={dis.tur}
                onChange={(e) => setDis({ ...dis, tur: e.target.value as KvkkKind })}
                style={girdi}
              >
                {KVKK_KIND_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {KVKK_KINDS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: '0 1 140px', fontSize: 12.5, fontWeight: 700 }}>
              Kanal
              <select
                value={dis.kanal}
                onChange={(e) => setDis({ ...dis, kanal: e.target.value as 'eposta' | 'posta' })}
                style={girdi}
              >
                <option value="eposta">E-posta</option>
                <option value="posta">Posta</option>
              </select>
            </label>
          </div>
          <label style={{ display: 'block', marginTop: 10, fontSize: 12.5, fontWeight: 700 }}>
            Başvuru metni
            <textarea
              rows={3}
              value={dis.metin}
              onChange={(e) => setDis({ ...dis, metin: e.target.value })}
              style={{ ...girdi, resize: 'vertical' }}
            />
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <input
              type="checkbox"
              checked={kimlik}
              onChange={(e) => setKimlik(e.target.checked)}
              style={{ width: 17, height: 17 }}
            />
            Başvuranın kimliğini doğruladım
          </label>
          <button
            type="button"
            onClick={kaydet}
            disabled={!kimlik}
            style={{
              marginTop: 10,
              border: 0,
              background: kimlik ? '#5B8CFF' : '#C9D3E6',
              borderRadius: 10,
              padding: '10px 16px',
              fontSize: 13.5,
              fontWeight: 800,
              color: '#1E2333',
              cursor: kimlik ? 'pointer' : 'default',
              fontFamily: 'inherit',
            }}
          >
            Kaydet
          </button>
        </section>
      ) : null}
      {l ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
            gap: 10,
            marginBottom: 14,
          }}
        >
          {l.sayilar.map((s) => (
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
          aria-label="Başvurular"
          style={{ ...kart, flex: '1 1 300px', maxWidth: 360, minWidth: 0, padding: 8 }}
        >
          {l && !satirlar.length ? (
            <p style={{ margin: 0, padding: 12, fontSize: 13.5, color: '#5A6073' }}>Başvuru yok.</p>
          ) : null}
          {satirlar.map((b) => {
            const on = b.id === sec;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setSec(b.id);
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
                  <span style={{ color: '#4B2FA6' }}>
                    {b.tur} · {b.numara}
                  </span>
                  <span
                    style={{ color: b.durum === 'yanitlandi' ? '#11683F' : b.uyari ? '#7A5300' : '#5A6073' }}
                  >
                    {b.durum === 'yanitlandi' ? 'Yanıtlandı' : `Kalan ${Math.max(0, b.kalanGun ?? 0)} gün`}
                  </span>
                </span>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800, marginTop: 4 }}>{b.kim}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 2 }}>
                  {b.alt}
                </span>
              </button>
            );
          })}
        </section>
        <section
          aria-labelledby="bvd"
          style={{ ...kart, flex: '999 1 480px', minWidth: 0, overflow: 'hidden' }}
        >
          {d ? (
            <>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #EEF0F5' }}>
                <h2 id="bvd" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  {d.baslik}
                </h2>
                <div style={{ fontSize: 13, color: '#3A4052', marginTop: 3 }}>
                  {d.numara} · {d.alt}
                  {d.userId ? (
                    <>
                      {' · '}
                      <Link href={`/kullanicilar?kisi=${d.userId}`}>Kullanıcı kartı</Link>
                    </>
                  ) : null}
                </div>
              </div>
              <div
                style={{
                  padding: '14px 18px',
                  background: '#F6F8FD',
                  borderBottom: '1px solid #EEF0F5',
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                }}
              >
                <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#5A6073' }}>
                  Başvuru metni
                </span>
                {d.metin}
              </div>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid #EEF0F5' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#5A6073', marginBottom: 6 }}>
                  Ajanın topladığı veriler
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {d.veriler.length ? (
                    d.veriler.map((v) => (
                      <span
                        key={v}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '4px 9px',
                          borderRadius: 999,
                          background: '#EEF3FF',
                          color: '#2450C8',
                        }}
                      >
                        {v}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 12.5, color: '#5A6073' }}>
                      Hesapla eşleşmedi; veriler e-postayla doğrulanmalı.
                    </span>
                  )}
                </div>
              </div>
              {d.durum === 'acik' ? (
                <div style={{ padding: '14px 18px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontSize: 12.5,
                      fontWeight: 800,
                    }}
                  >
                    <span style={{ color: '#4B2FA6' }}>Ajanın yanıt taslağı</span>
                    <span style={{ color: '#5A6073' }}>Gönderimi yalnızca çalışan yapar</span>
                  </div>
                  <label
                    htmlFor="kvy"
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
                    id="kvy"
                    value={metin}
                    onChange={(e) => setMetin(e.target.value)}
                    rows={6}
                    style={{
                      display: 'block',
                      width: '100%',
                      boxSizing: 'border-box',
                      marginTop: 6,
                      border: '1.5px solid #C9B8FF',
                      background: '#FAF7FF',
                      borderRadius: 12,
                      padding: '10px 12px',
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                  {d.silme ? (
                    <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#7A5300' }}>
                      Hesap kapatma ve anonimleştirme sahip kararıyla eklenecek; kullanılmamış hakların iadesi
                      yalnızca sahip onayıyla yapılır.
                    </p>
                  ) : null}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 12,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={okudum}
                      onChange={(e) => setOkudum(e.target.checked)}
                      style={{ width: 17, height: 17 }}
                    />
                    Taslağı ve eklenecek verileri okudum
                  </label>
                  <button
                    type="button"
                    onClick={gonder}
                    disabled={!okudum || !gonderebilir}
                    title={gonderebilir ? undefined : 'Yanıtı tam yetkili çalışan gönderir'}
                    style={{
                      marginTop: 12,
                      border: 0,
                      background: okudum && gonderebilir ? '#5B8CFF' : '#C9D3E6',
                      borderRadius: 10,
                      padding: '10px 16px',
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: '#1E2333',
                      cursor: okudum && gonderebilir ? 'pointer' : 'default',
                      fontFamily: 'inherit',
                    }}
                  >
                    Yanıtı gönder
                  </button>
                </div>
              ) : (
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#11683F' }}>
                    Yanıt gönderildi · başvuru kapatıldı ve kaydı 3 yıl saklanacak
                  </div>
                  <p
                    style={{
                      margin: '8px 0 0',
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      color: '#3A4052',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {d.yanit}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p style={{ margin: 0, padding: 18, fontSize: 13.5, color: '#5A6073' }}>
              {l ? 'Bir başvuru seç.' : 'Yükleniyor…'}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
