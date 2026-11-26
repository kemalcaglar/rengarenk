'use client';

import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../lib/cx';
import { istek } from '../../lib/istemci';
import stil from './guven.module.css';

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
    <section className={stil.kutu1} aria-labelledby="guven">
      <h2 id="guven" className={stil.baslik1}>
        Yıldızların ve rozetlerin
      </h2>
      <p className={stil.metin1}>
        Rozetler alıcı yıldızları, yanıt süren ve şikâyet oranınla her gece güncellenir. Alıcılar tek tek puan
        görmez; yıldızı kimin verdiği sana da gösterilmez.
      </p>
      <div className={stil.kutu2}>
        <div className={stil.kutu3}>
          <div className={stil.kutu4}>
            <span className={stil.metin2}>
              {v.yildizOrtalama === null ? '—' : String(v.yildizOrtalama).replace('.', ',')}
            </span>
            <span className={stil.metin3}>
              ★ · {v.yildizSayisi} yıldız · ortalama yanıt {sure(v.ortalamaYanitDakika)}
            </span>
          </div>
          <div className={stil.kutu5}>
            {[5, 4, 3, 2, 1].map((n) => {
              const adet = v.dagilim[n - 1] ?? 0;
              return (
                <div key={n} title={`${n} yıldız: ${adet}`} className={stil.kutu6}>
                  <span className={stil.metin4}>{n} yıldız</span>
                  <span className={stil.metin5}>
                    <span className={stil.metin6} style={{ width: `${(adet / enCok) * 100}%` }} />
                  </span>
                  <span className={stil.metin7}>{adet}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className={stil.kutu7}>
          {v.rozetler.map((r) => (
            <div key={r.rozet} className={stil.kutu8}>
              <span
                title={r.aciklama}
                className={stil.metin8}
                style={{ background: r.var ? r.bg : '#F3F5FA', color: r.var ? r.renk : '#8A91A3' }}
              >
                {r.ad}
              </span>
              <span className={cx(stil.metin9, r.var ? stil.metin10 : stil.metin11)}>
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
    <div id="bir-yildiz" className={stil.kutu9}>
      <h3 className={stil.baslik2}>1 yıldızlı değerlendirmeler</h3>
      <p className={stil.metin12}>
        Haksız bulduğun 1 yıldıza {d.gun} gün içinde bir kez itiraz edebilirsin. Moderasyon sohbeti inceler;
        kabul edilirse yıldız ortalamana katılmaz.
        {d.yetkili ? '' : ' İtirazı galerinin sahibi ya da yöneticisi yapar.'}
      </p>
      <div className={stil.kutu10}>
        {d.yildizlar.map((y) => {
          const durum = y.itiraz ? DURUM[y.itiraz.durum] : null;
          return (
            <div key={y.id} className={stil.kutu11}>
              <div className={stil.kutu12}>
                <span className={stil.metin13}>
                  <span className={stil.metin14}>★</span> <span className={stil.metin15}>1 yıldız</span> ·{' '}
                  {tarih(y.tarih)}
                </span>
                {durum ? (
                  <span className={stil.metin8} style={{ background: durum[1], color: durum[2] }}>
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
                      className={stil.dugme1}
                    >
                      İtiraz et
                    </button>
                  )
                ) : new Date(y.itirazSonu) < new Date() ? (
                  <span className={stil.metin16}>İtiraz süresi doldu</span>
                ) : null}
              </div>
              {y.itiraz?.sonuc ? <p className={stil.metin17}>Moderasyon: {y.itiraz.sonuc}</p> : null}
              {acik === y.id ? (
                <div className={stil.kutu13}>
                  <label htmlFor={`itiraz-${y.id}`} className={stil.etiket1}>
                    Neden haksız?
                  </label>
                  <textarea
                    id={`itiraz-${y.id}`}
                    value={metin}
                    onChange={(e) => setMetin(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Örn. alıcıyla hiç konuşmadık, yalnızca ilk mesajımızı okudu."
                    className={stil.girdi1}
                  />
                  {hata ? (
                    <p role="alert" className={stil.metin18}>
                      {hata}
                    </p>
                  ) : null}
                  <div className={stil.kutu14}>
                    <button
                      type="button"
                      onClick={() => gonder(y.id)}
                      disabled={mesgul}
                      className={stil.dugme2}
                    >
                      İtirazı gönder
                    </button>
                    <button type="button" onClick={() => setAcik(null)} className={stil.dugme3}>
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
