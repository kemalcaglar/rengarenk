'use client';

import { useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

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
      <div className={stil.kutu1}>
        <div>
          <h1 className={stil.baslik1}>Bildirim merkezi</h1>
          <p className={stil.metin1}>Kanalların sağlığı, kendi e-posta sunucumuz ve gönderim kuralları.</p>
        </div>
        {m && yetkili ? (
          m.ticariAcik ? (
            <button type="button" onClick={() => ticari(false)} className={stil.dugme1}>
              Ticari gönderimi durdur
            </button>
          ) : (
            <button type="button" onClick={() => ticari(true)} className={stil.dugme2}>
              Ticari gönderimi yeniden başlat
            </button>
          )
        ) : null}
      </div>
      {hata ? <p className={stil.metin2}>{hata}</p> : null}
      {m ? (
        <>
          <div className={stil.kutu2}>
            {m.saglik.map((sh) => {
              const [bg, fg] = rozet(sh.durum);
              return (
                <div key={sh.ad} className={stil.kutu3}>
                  <div className={stil.kutu4}>
                    <span className={stil.metin3}>{sh.ad}</span>
                    <span className={stil.metin4} style={{ background: bg, color: fg }}>
                      {sh.durum}
                    </span>
                  </div>
                  <div className={stil.kutu5}>{sh.saglayici}</div>
                  <div className={stil.kutu6}>
                    {(
                      [
                        ['Bugün', sayi(sh.bugun)],
                        ['Teslim', yuzde(sh.teslim)],
                        ['Kuyruk', sayi(sh.kuyruk)],
                      ] as const
                    ).map(([e, v]) => (
                      <span key={e}>
                        <span className={stil.metin5}>{e}</span>
                        <span className={stil.metin6}>{v}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <section className={stil.kutu7} aria-labelledby="smtp">
            <div className={stil.kutu8}>
              <h2 id="smtp" className={stil.baslik2}>
                Kendi e-posta sunucumuz
              </h2>
              <p className={stil.metin7}>Posta sunucusu ayrı sanal sunucuda · yeri bekliyor (Karar 50)</p>
            </div>
            <div className={stil.kutu9}>
              <div className={stil.kutu10}>
                <h3 className={stil.baslik3}>Gönderen kimlikleri</h3>
                {m.kimlikler.map((k) => (
                  <div key={k.ad} className={stil.kutu11}>
                    <div className={stil.kutu12}>{k.ad}</div>
                    <div className={stil.kutu13}>{k.adres}</div>
                    <div className={stil.kutu14}>{k.not}</div>
                  </div>
                ))}
                <p className={stil.metin8}>
                  SPF, DKIM, DMARC, ters DNS ve kara liste kontrolleri posta sunucusu kurulunca burada
                  görünür.
                </p>
                <h3 className={stil.baslik4}>Gönderim dışı adresler</h3>
                {Object.keys(ENGEL).map((r) => (
                  <div key={r} className={stil.kutu15}>
                    <span>{ENGEL[r]}</span>
                    <strong>{sayi(m.engelListesi[r] ?? 0)}</strong>
                  </div>
                ))}
              </div>
              <div className={stil.kutu16}>
                <h3 className={stil.baslik3}>Isınma planı · ticari IP</h3>
                <div className={stil.kutu17}>
                  {PLAN.map((l, i) => {
                    const h = l === null ? 100 : Math.round((Math.log2(l) / ust) * 88);
                    const simdi = m.isinma.hafta !== null && Math.min(m.isinma.hafta, 6) === i + 1;
                    const gecti = m.isinma.hafta !== null && m.isinma.hafta > i + 1;
                    return (
                      <span
                        key={l ?? 'sinirsiz'}
                        title={l === null ? 'Sınır yok' : `Günde en çok ${sayi(l)} ticari e-posta`}
                        className={stil.metin9}
                      >
                        <span className={stil.metin10}>{l === null ? 'Sınırsız' : sayi(l)}</span>
                        <span
                          className={cx(stil.metin11, simdi ? stil.metin12 : stil.metin13)}
                          style={{
                            height: `${h}%`,
                            background: simdi ? '#5B8CFF' : gecti ? '#BFD2FF' : '#EEF3FF',
                          }}
                        />
                      </span>
                    );
                  })}
                </div>
                <div className={stil.kutu18}>
                  {PLAN.map((l, i) => (
                    <span key={l ?? 's'} className={stil.metin14}>
                      {i + 1}. hf
                    </span>
                  ))}
                </div>
                <p className={stil.metin15}>
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
            <div className={stil.kutu19}>
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
            <p className={stil.metin16}>
              <strong>Ajan:</strong> sınırlardan biri aşılırsa (en az {sayi(m.itibar.sinir.enAzGonderim)}{' '}
              gönderimde) ticari e-postayı kendiliğinden durdurur ve işlem kaydına yazar; doğrulama kodu ve
              ödeme e-postaları gitmeye devam eder.
            </p>
          </section>

          <section className={stil.kutu7} aria-labelledby="kurallar">
            <h2 id="kurallar" className={stil.baslik5}>
              Gönderim kuralları
            </h2>
            {m.kurallar.map((gk) => (
              <div key={gk.ad} className={stil.kutu20}>
                <span className={stil.metin17}>
                  <span className={stil.metin18}>{gk.ad}</span>
                  <span className={stil.metin19}>{gk.not}</span>
                </span>
                <span className={stil.metin20}>{gk.deger}</span>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </>
  );
}
