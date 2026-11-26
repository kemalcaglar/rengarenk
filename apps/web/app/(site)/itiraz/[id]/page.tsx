'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { istek, useGiris } from '../../../../lib/istemci';
import stil from './page.module.css';

interface Karar {
  id: string;
  no: number;
  karar: string;
  kararAd: string;
  aciklama: string;
  gerekce: string;
  hedef: string;
  tarih: string;
  aski: { until: string | null } | null;
  geriAlindi: string | null;
  itirazSonu: string;
  itirazEdebilir: boolean;
  itiraz: { durum: 'acik' | 'kabul' | 'red'; metin: string; sonuc: string | null; zaman: string } | null;
}

const tarih = (iso: string, saat = false) =>
  new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
    ...(saat ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(iso));

/**
 * Moderasyon kararı ve itiraz (Karar 53): bildirimdeki bağlantı buraya açılır. Karar, gerekçe ve askının bitişi görünür;
 * 7 gün içinde bir kez itiraz edilir. İtirazı ilk kararı veren dışında bir moderatör inceler.
 */
export default function Itiraz() {
  const { id } = useParams<{ id: string }>();
  const giris = useGiris();
  const [k, setK] = useState<Karar | null>(null);
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  useEffect(() => {
    if (giris === false) window.location.href = `/giris?sonra=/itiraz/${id}`;
    if (!giris) return;
    istek<Karar>(`/moderation/decisions/${id}`)
      .then(setK)
      .catch((e: Error) => setHata(e.message));
  }, [giris, id]);

  async function gonder() {
    if (metin.trim().length < 10) {
      setHata('İtirazını en az 10 karakterle yaz.');
      return;
    }
    setMesgul(true);
    setHata(null);
    try {
      setK(
        await istek<Karar>(`/moderation/decisions/${id}/appeal`, {
          method: 'POST',
          body: { metin: metin.trim() },
        }),
      );
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  return (
    <main className={`rr-sayfa ${stil.kutu1}`}>
      <h1 className={stil.baslik1}>Moderasyon kararı</h1>
      <p className={stil.metin1}>
        Bir şikayet üzerine içeriğini inceledik. Karara katılmıyorsan 7 gün içinde itiraz edebilirsin.
      </p>
      {hata && !k ? (
        <p role="alert" className={stil.metin2}>
          {hata}
        </p>
      ) : null}
      {k ? (
        <>
          <section className={stil.kutu2}>
            <div className={stil.kutu3}>
              <h2 className={stil.baslik2}>{k.kararAd}</h2>
              {k.geriAlindi ? <span className={stil.metin3}>Geri alındı</span> : null}
            </div>
            <p className={stil.metin4}>
              {k.hedef} · {tarih(k.tarih, true)} · S-{k.no}
            </p>
            <dl className={stil.liste1}>
              <div>
                <dt className={stil.metin5}>Gerekçe</dt>
                <dd className={stil.metin6}>{k.gerekce}</dd>
              </div>
              <div>
                <dt className={stil.metin5}>Ne anlama geliyor</dt>
                <dd className={stil.metin6}>{k.aciklama}</dd>
              </div>
              {k.aski && !k.geriAlindi ? (
                <div>
                  <dt className={stil.metin5}>Askı</dt>
                  <dd className={stil.metin7}>
                    {k.aski.until
                      ? `${tarih(k.aski.until, true)} saatine kadar mesaj gönderemezsin.`
                      : 'Karar sonuçlanana kadar mesaj gönderemezsin.'}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section aria-labelledby="itiraz-baslik" className={stil.kutu4}>
            <h2 id="itiraz-baslik" className={stil.baslik3}>
              İtiraz
            </h2>
            {k.itiraz ? (
              <>
                <p className={stil.metin8}>“{k.itiraz.metin}”</p>
                <p
                  role="status"
                  className={stil.metin9}
                  style={{
                    color:
                      k.itiraz.durum === 'kabul'
                        ? '#11683F'
                        : k.itiraz.durum === 'red'
                          ? '#3A4052'
                          : '#7A5300',
                  }}
                >
                  {k.itiraz.durum === 'acik'
                    ? 'İtirazın inceleniyor. Sonuçlanınca bildirim göndereceğiz.'
                    : k.itiraz.durum === 'kabul'
                      ? 'İtirazını haklı bulduk; karar geri alındı.'
                      : `İtirazını inceledik; karar geçerli.${k.itiraz.sonuc ? ` ${k.itiraz.sonuc}` : ''}`}
                </p>
              </>
            ) : k.itirazEdebilir ? (
              <>
                <p className={stil.metin10}>
                  {tarih(k.itirazSonu, true)} saatine kadar bir kez itiraz edebilirsin. Kararı veren dışında
                  bir moderatör inceler.
                </p>
                <label htmlFor="itiraz-metin" className={stil.etiket1}>
                  Neden katılmıyorsun?
                </label>
                <textarea
                  id="itiraz-metin"
                  value={metin}
                  onChange={(e) => setMetin(e.target.value)}
                  rows={5}
                  maxLength={1000}
                  className={stil.girdi1}
                />
                {hata ? (
                  <p role="alert" className={stil.metin11}>
                    {hata}
                  </p>
                ) : null}
                <button type="button" onClick={gonder} disabled={mesgul} className={stil.dugme1}>
                  İtiraz et
                </button>
              </>
            ) : (
              <p className={stil.metin12}>{k.geriAlindi ? 'Karar geri alındı.' : 'İtiraz süresi doldu.'}</p>
            )}
          </section>
          <p className={stil.metin13}>
            <Link href="/kullanim-kosullari" className={stil.bag1}>
              Kullanım koşulları
            </Link>
          </p>
        </>
      ) : null}
    </main>
  );
}
