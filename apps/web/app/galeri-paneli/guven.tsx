'use client';

import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { istek } from '../../lib/istemci';

export interface GuvenVerisi {
  yildizSayisi: number;
  yildizOrtalama: number | null;
  /** 1'den 5'e yıldız sayıları */
  dagilim: number[];
  yanitSohbet: number;
  ortalamaYanitDakika: number | null;
  ortancaYanitDakika: number | null;
  puan: number;
  rozetler: {
    rozet: string;
    var: boolean;
    eksik: string[];
    ad: string;
    bg: string;
    renk: string;
    aciklama: string;
  }[];
  takipci: number;
}

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const sure = (dk: number | null) =>
  dk === null ? '—' : dk < 60 ? `${Math.max(1, Math.round(dk))} dk` : `${Math.round(dk / 60)} sa`;

/**
 * Galeri paneli › Özet: yıldız ortalaması, dağılımı ve rozete ne kadar kaldığı (Karar 55). Galeri yıldızı kimin
 * verdiğini görmez; alıcılar puanı sayı olarak değil, yalnızca rozetleri görür. Tasarımda ayrı bir ekran yok;
 * GaleriMobil.dc.html'deki "Rozetlerin" kartı ve konsoldaki not esas alındı.
 */
export function Guven({ v, hesap }: { v: GuvenVerisi; hesap: string }) {
  const enCok = Math.max(1, ...v.dagilim);
  return (
    <section style={{ ...kart, padding: 20, marginTop: 16 }} aria-labelledby="guven">
      <h2 id="guven" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
        Yıldızların ve rozetlerin
      </h2>
      <p style={{ margin: '4px 0 14px', fontSize: 13.5, color: '#5A6073' }}>
        Rozetler alıcı yıldızları, yanıt süren ve şikâyet oranınla her gece güncellenir. Alıcılar tek tek puan
        görmez; yıldızı kimin verdiği sana da gösterilmez.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 34, fontWeight: 800 }}>
              {v.yildizOrtalama === null ? '—' : String(v.yildizOrtalama).replace('.', ',')}
            </span>
            <span style={{ fontSize: 14, color: '#5A6073' }}>
              ★ · {v.yildizSayisi} yıldız · ortalama yanıt {sure(v.ortalamaYanitDakika)}
            </span>
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
            {[5, 4, 3, 2, 1].map((n) => {
              const adet = v.dagilim[n - 1] ?? 0;
              return (
                <div
                  key={n}
                  title={`${n} yıldız: ${adet}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
                >
                  <span style={{ flex: '0 0 54px', color: '#3A4052' }}>{n} yıldız</span>
                  <span
                    style={{ flex: 1, height: 8, borderRadius: 4, background: '#EEF0F5', overflow: 'hidden' }}
                  >
                    <span
                      style={{
                        display: 'block',
                        height: 8,
                        borderRadius: 4,
                        background: '#FFC84A',
                        width: `${(adet / enCok) * 100}%`,
                      }}
                    />
                  </span>
                  <span style={{ flex: '0 0 28px', textAlign: 'right', fontWeight: 700 }}>{adet}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ flex: '1 1 300px', minWidth: 0, display: 'grid', gap: 10 }}>
          {v.rozetler.map((r) => (
            <div key={r.rozet} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span
                title={r.aciklama}
                style={{
                  flex: 'none',
                  fontSize: 12.5,
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: r.var ? r.bg : '#F3F5FA',
                  color: r.var ? r.renk : '#8A91A3',
                }}
              >
                {r.ad}
              </span>
              <span style={{ fontSize: 13, color: r.var ? '#11683F' : '#3A4052', lineHeight: 1.5 }}>
                {r.var ? 'Rozetin var' : `Kalan: ${r.eksik.join(', ')}`}
              </span>
            </div>
          ))}
        </div>
      </div>
      <BirYildiz hesap={hesap} />
    </section>
  );
}

interface DusukYildiz {
  yetkili: boolean;
  gun: number;
  yildizlar: {
    id: string;
    tarih: string;
    sayiliyor: boolean;
    itirazSonu: string;
    itirazEdebilir: boolean;
    itiraz: { durum: 'acik' | 'kabul' | 'red'; metin: string; sonuc: string | null } | null;
  }[];
}

const tarih = (s: string) => new Date(s).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
const DURUM: Record<string, [string, string, string]> = {
  acik: ['İtirazın moderasyonda', '#FFF6DF', '#7A5300'],
  kabul: ['İtiraz kabul edildi · yıldız hesaba katılmıyor', '#E7FAF0', '#11683F'],
  red: ['İtiraz reddedildi · yıldız geçerli', '#F3F5FA', '#3A4052'],
};
const ikincil: CSSProperties = {
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 10,
  padding: '7px 12px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

/**
 * 1 yıldıza itiraz (Karar 55): son 30 günün 1 yıldızları, yalnızca tarihiyle (yıldızı veren gösterilmez). Sahip ya
 * da yönetici her yıldıza bir kez itiraz eder; moderasyon sohbetin kanıtıyla inceler, sonuç bildirimle gelir.
 */
function BirYildiz({ hesap }: { hesap: string }) {
  const [d, setD] = useState<DusukYildiz | null>(null);
  const [acik, setAcik] = useState<string | null>(null);
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState('');
  const [mesgul, setMesgul] = useState(false);

  const yukle = useCallback(() => {
    istek<DusukYildiz>(`/gallery/${hesap}/ratings/low`)
      .then(setD)
      .catch(() => setD(null));
  }, [hesap]);
  useEffect(yukle, [yukle]);

  if (!d?.yildizlar.length) return null;
  async function gonder(id: string) {
    setHata('');
    if (metin.trim().length < 10) {
      setHata('İtirazını en az 10 karakterle anlat.');
      return;
    }
    setMesgul(true);
    try {
      setD(
        await istek<DusukYildiz>(`/gallery/${hesap}/ratings/${id}/appeal`, {
          method: 'POST',
          body: { metin: metin.trim() },
        }),
      );
      setAcik(null);
      setMetin('');
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  return (
    <div id="bir-yildiz" style={{ marginTop: 18, borderTop: '1px solid #EEF0F5', paddingTop: 14 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>1 yıldızlı değerlendirmeler</h3>
      <p style={{ margin: '4px 0 10px', fontSize: 13, color: '#5A6073', lineHeight: 1.5 }}>
        Haksız bulduğun 1 yıldıza {d.gun} gün içinde bir kez itiraz edebilirsin. Moderasyon sohbeti inceler;
        kabul edilirse yıldız ortalamana katılmaz.
        {d.yetkili ? '' : ' İtirazı galerinin sahibi ya da yöneticisi yapar.'}
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        {d.yildizlar.map((y) => {
          const durum = y.itiraz ? DURUM[y.itiraz.durum] : null;
          return (
            <div key={y.id} style={{ border: '1px solid #E3E6EF', borderRadius: 14, padding: '10px 14px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px' }}>
                <span style={{ flex: '1 1 200px', fontSize: 13.5 }}>
                  <span style={{ color: '#E0A100', fontWeight: 800 }}>★</span>{' '}
                  <span style={{ fontWeight: 700 }}>1 yıldız</span> · {tarih(y.tarih)}
                </span>
                {durum ? (
                  <span
                    style={{
                      flex: 'none',
                      fontSize: 12.5,
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: durum[1],
                      color: durum[2],
                    }}
                  >
                    {durum[0]}
                  </span>
                ) : y.itirazEdebilir ? (
                  acik === y.id ? null : (
                    <button
                      type="button"
                      onClick={() => {
                        setAcik(y.id);
                        setMetin('');
                        setHata('');
                      }}
                      style={{ ...ikincil, flex: 'none' }}
                    >
                      İtiraz et
                    </button>
                  )
                ) : new Date(y.itirazSonu) < new Date() ? (
                  <span style={{ flex: 'none', fontSize: 12.5, color: '#8A91A3' }}>İtiraz süresi doldu</span>
                ) : null}
              </div>
              {y.itiraz?.sonuc ? (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#3A4052' }}>
                  Moderasyon: {y.itiraz.sonuc}
                </p>
              ) : null}
              {acik === y.id ? (
                <div style={{ marginTop: 10 }}>
                  <label htmlFor={`itiraz-${y.id}`} style={{ fontSize: 13.5, fontWeight: 700 }}>
                    Neden haksız?
                  </label>
                  <textarea
                    id={`itiraz-${y.id}`}
                    value={metin}
                    onChange={(e) => setMetin(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Örn. alıcıyla hiç konuşmadık, yalnızca ilk mesajımızı okudu."
                    style={{
                      display: 'block',
                      width: '100%',
                      boxSizing: 'border-box',
                      marginTop: 6,
                      border: '1px solid #D5DAE5',
                      borderRadius: 12,
                      padding: '10px 12px',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                  {hata ? (
                    <p
                      role="alert"
                      style={{ margin: '6px 0 0', color: '#A3271F', fontWeight: 700, fontSize: 13 }}
                    >
                      {hata}
                    </p>
                  ) : null}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => gonder(y.id)}
                      disabled={mesgul}
                      style={{
                        border: 0,
                        background: '#5B8CFF',
                        borderRadius: 12,
                        padding: '9px 16px',
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: '#1E2333',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      İtirazı gönder
                    </button>
                    <button
                      type="button"
                      onClick={() => setAcik(null)}
                      style={{ ...ikincil, border: 0, background: 'transparent', color: '#5A6073' }}
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
