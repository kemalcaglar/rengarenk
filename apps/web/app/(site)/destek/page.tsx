'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { HesabimMenu } from '../../../components/hesabim-menu';
import { istek, useGiris } from '../../../lib/istemci';

interface Satir {
  no: number;
  numara: string;
  konu: string;
  ozet: string;
  durum: 'acik' | 'yanitlandi' | 'cozuldu';
  durumAd: string;
  son: string;
  okunmamis: boolean;
}
interface Yazisma {
  no: number;
  numara: string;
  konu: string;
  konuTur: string;
  durum: 'acik' | 'yanitlandi' | 'cozuldu';
  durumAd: string;
  puan: number | null;
  puanVerebilir: boolean;
  mesajlar: { id: string; taraf: 'kullanici' | 'destek'; kim: string; metin: string; zaman: string }[];
}

const DURUM: Record<string, [string, string]> = {
  acik: ['#FFF6DF', '#7A5300'],
  yanitlandi: ['#EEF3FF', 'var(--rr-baglanti, #2450C8)'],
  cozuldu: ['#E7FAF0', '#11683F'],
};
const zaman = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso));

/**
 * Destek taleplerim (Karar 54): "Rengarenk Destek" yazışmaları. Mesajlarım'da en üstte sabit satır olarak da görünür;
 * yanıt geldiğinde bildirim ve e-posta gider. Çözülen talebe 1–5 puan verilir; yeniden yazınca talep açılır.
 */
export default function Destek() {
  const giris = useGiris();
  const [liste, setListe] = useState<Satir[] | null>(null);
  const [no, setNo] = useState<number | null>(null);
  const [y, setY] = useState<Yazisma | null>(null);
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    const l = await istek<Satir[]>('/support/tickets');
    setListe(l);
    return l;
  }, []);
  useEffect(() => {
    if (giris === false) window.location.href = '/giris?sonra=/destek';
    if (!giris) return;
    const q = Number(new URLSearchParams(window.location.search).get('no'));
    yukle()
      .then((l) => setNo(q || l[0]?.no || null))
      .catch((e: Error) => setHata(e.message));
  }, [giris, yukle]);
  useEffect(() => {
    if (!no) return;
    setY(null);
    istek<Yazisma>(`/support/tickets/${no}`)
      .then((x) => {
        setY(x);
        setListe((l) => l?.map((s) => (s.no === no ? { ...s, okunmamis: false } : s)) ?? l);
      })
      .catch((e: Error) => setHata(e.message));
  }, [no]);

  async function gonder() {
    if (!no || !metin.trim()) return;
    try {
      setY(
        await istek<Yazisma>(`/support/tickets/${no}/messages`, {
          method: 'POST',
          body: { metin: metin.trim() },
        }),
      );
      setMetin('');
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function puanla(puan: number) {
    if (!no) return;
    try {
      setY(await istek<Yazisma>(`/support/tickets/${no}/rating`, { method: 'POST', body: { puan } }));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  return (
    <div
      className="rr-sayfa"
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
      <HesabimMenu aktif="/yardim" />
      <main style={{ flex: '999 1 640px', minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>Destek taleplerim</h1>
          <Link href="/yardim" style={{ fontSize: 14.5, fontWeight: 700 }}>
            Yardım merkezi · yeni talep
          </Link>
        </div>
        {hata ? (
          <p role="alert" style={{ color: '#A3271F', fontWeight: 700 }}>
            {hata}
          </p>
        ) : null}
        {liste && !liste.length ? (
          <p style={{ marginTop: 16, fontSize: 15, color: 'var(--rr-soluk, #5A6073)' }}>
            Henüz destek talebin yok. Sorunun yanıtını{' '}
            <Link href="/yardim" style={{ fontWeight: 700 }}>
              Yardım merkezinde
            </Link>{' '}
            bulamazsan oradan bize yazabilirsin.
          </p>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', marginTop: 16 }}>
          {liste?.length ? (
            <section
              aria-label="Talepler"
              style={{
                flex: '1 1 260px',
                maxWidth: 320,
                minWidth: 0,
                background: 'var(--rr-kart, #FFFFFF)',
                border: '1px solid var(--rr-cizgi, #E3E6EF)',
                borderRadius: 'var(--rr-kart-kose)',
                padding: 8,
              }}
            >
              {liste.map((s) => {
                const on = s.no === no;
                const [bg, fg] = DURUM[s.durum] ?? DURUM.acik;
                return (
                  <button
                    key={s.no}
                    type="button"
                    onClick={() => setNo(s.no)}
                    aria-current={on}
                    style={{
                      width: '100%',
                      display: 'block',
                      textAlign: 'left',
                      border: 0,
                      background: on ? '#F3EFFF' : 'transparent',
                      borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      color: 'var(--rr-murekkep, #1E2333)',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      <span style={{ color: 'var(--rr-soluk, #5A6073)' }}>
                        {s.numara} · {s.konu}
                      </span>
                      <span
                        style={{
                          padding: '1px 8px',
                          borderRadius: 'var(--rr-etiket-kose)',
                          background: bg,
                          color: fg,
                        }}
                      >
                        {s.durumAd}
                      </span>
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: s.okunmamis ? 800 : 600,
                        marginTop: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.okunmamis ? '● ' : ''}
                      {s.ozet}
                    </span>
                  </button>
                );
              })}
            </section>
          ) : null}
          {y ? (
            <section
              aria-labelledby="yz"
              style={{
                flex: '999 1 420px',
                minWidth: 0,
                background: 'var(--rr-kart, #FFFFFF)',
                border: '1px solid var(--rr-cizgi, #E3E6EF)',
                borderRadius: 'var(--rr-kart-kose)',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #EEF0F5' }}>
                <h2 id="yz" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  Rengarenk Destek · {y.numara}
                </h2>
                <div style={{ fontSize: 13, color: '#3A4052', marginTop: 3 }}>
                  {y.konuTur} · {y.durumAd}
                </div>
              </div>
              <div
                style={{
                  padding: '14px 18px',
                  background: 'var(--rr-zemin, #F6F8FD)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {y.mesajlar.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: m.taraf === 'kullanici' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '80%',
                        background: m.taraf === 'kullanici' ? 'var(--rr-mavi, #5B8CFF)' : '#FFFFFF',
                        color: m.taraf === 'kullanici' ? 'var(--rr-maviYazi, #1E2333)' : undefined,
                        border: m.taraf === 'kullanici' ? 0 : '1px solid var(--rr-cizgi, #E3E6EF)',
                        borderRadius: 'var(--rr-buton-kose)',
                        padding: '9px 12px',
                        fontSize: 14,
                        lineHeight: 1.55,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: '#3A4052' }}>
                        {m.kim} · {zaman(m.zaman)}
                      </span>
                      {m.metin}
                    </div>
                  </div>
                ))}
              </div>
              {y.puanVerebilir ? (
                <div style={{ padding: '14px 18px', borderTop: '1px solid #EEF0F5' }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>Sorunun nasıl çözüldü?</div>
                  <fieldset
                    aria-label="Puan, 5 üzerinden"
                    style={{ display: 'flex', gap: 6, marginTop: 8, border: 0, padding: 0 }}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => puanla(n)}
                        aria-label={`${n} puan`}
                        style={{
                          width: 44,
                          height: 44,
                          border: '1px solid #D5DAE5',
                          borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
                          background: 'var(--rr-kart, #FFFFFF)',
                          fontSize: 16,
                          fontWeight: 800,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </fieldset>
                </div>
              ) : y.puan ? (
                <div
                  style={{
                    padding: '12px 18px',
                    borderTop: '1px solid #EEF0F5',
                    fontSize: 13.5,
                    color: '#11683F',
                    fontWeight: 700,
                  }}
                >
                  Puanın için teşekkürler: {y.puan} / 5
                </div>
              ) : null}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  gonder();
                }}
                style={{ display: 'flex', gap: 8, padding: '12px 18px', borderTop: '1px solid #EEF0F5' }}
              >
                <label
                  htmlFor="dm"
                  style={{
                    position: 'absolute',
                    width: 1,
                    height: 1,
                    overflow: 'hidden',
                    clip: 'rect(0 0 0 0)',
                  }}
                >
                  Mesajın
                </label>
                <input
                  id="dm"
                  value={metin}
                  onChange={(e) => setMetin(e.target.value)}
                  maxLength={2000}
                  placeholder={y.durum === 'cozuldu' ? 'Yazarsan talebin yeniden açılır' : 'Mesaj yaz'}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: '1px solid #D5DAE5',
                    borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
                    padding: '11px 12px',
                    fontSize: 14.5,
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    border: 0,
                    background: 'var(--rr-mavi, #5B8CFF)',
                    borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
                    padding: '11px 18px',
                    fontSize: 14.5,
                    fontWeight: 800,
                    color: 'var(--rr-maviYazi, #1E2333)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Gönder
                </button>
              </form>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
