'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { istek, useGiris } from '../../../../lib/istemci';

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
    <main style={{ maxWidth: 640, margin: '40px auto', padding: '0 24px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800 }}>Moderasyon kararı</h1>
      <p style={{ margin: '0 0 18px', fontSize: 14.5, color: '#5A6073' }}>
        Bir şikayet üzerine içeriğini inceledik. Karara katılmıyorsan 7 gün içinde itiraz edebilirsin.
      </p>
      {hata && !k ? (
        <p role="alert" style={{ color: '#A3271F', fontWeight: 700 }}>
          {hata}
        </p>
      ) : null}
      {k ? (
        <>
          <section
            style={{ background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18, padding: 20 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>{k.kararAd}</h2>
              {k.geriAlindi ? (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: '#E7FAF0',
                    color: '#11683F',
                  }}
                >
                  Geri alındı
                </span>
              ) : null}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#5A6073' }}>
              {k.hedef} · {tarih(k.tarih, true)} · S-{k.no}
            </p>
            <dl style={{ margin: '14px 0 0', display: 'grid', gap: 10, fontSize: 14.5, lineHeight: 1.55 }}>
              <div>
                <dt style={{ fontWeight: 800 }}>Gerekçe</dt>
                <dd style={{ margin: 0, color: '#3A4052' }}>{k.gerekce}</dd>
              </div>
              <div>
                <dt style={{ fontWeight: 800 }}>Ne anlama geliyor</dt>
                <dd style={{ margin: 0, color: '#3A4052' }}>{k.aciklama}</dd>
              </div>
              {k.aski && !k.geriAlindi ? (
                <div>
                  <dt style={{ fontWeight: 800 }}>Askı</dt>
                  <dd style={{ margin: 0, color: '#A3271F', fontWeight: 700 }}>
                    {k.aski.until
                      ? `${tarih(k.aski.until, true)} saatine kadar mesaj gönderemezsin.`
                      : 'Karar sonuçlanana kadar mesaj gönderemezsin.'}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section
            aria-labelledby="itiraz-baslik"
            style={{
              marginTop: 16,
              background: '#FFFFFF',
              border: '1px solid #E3E6EF',
              borderRadius: 18,
              padding: 20,
            }}
          >
            <h2 id="itiraz-baslik" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
              İtiraz
            </h2>
            {k.itiraz ? (
              <>
                <p style={{ margin: '8px 0 0', fontSize: 14, color: '#3A4052' }}>“{k.itiraz.metin}”</p>
                <p
                  role="status"
                  style={{
                    margin: '10px 0 0',
                    fontSize: 14.5,
                    fontWeight: 800,
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
                <p style={{ margin: '6px 0 10px', fontSize: 13.5, color: '#5A6073' }}>
                  {tarih(k.itirazSonu, true)} saatine kadar bir kez itiraz edebilirsin. Kararı veren dışında
                  bir moderatör inceler.
                </p>
                <label htmlFor="itiraz-metin" style={{ fontSize: 13.5, fontWeight: 700 }}>
                  Neden katılmıyorsun?
                </label>
                <textarea
                  id="itiraz-metin"
                  value={metin}
                  onChange={(e) => setMetin(e.target.value)}
                  rows={5}
                  maxLength={1000}
                  style={{
                    display: 'block',
                    width: '100%',
                    boxSizing: 'border-box',
                    marginTop: 6,
                    border: '1px solid #D5DAE5',
                    borderRadius: 12,
                    padding: '10px 12px',
                    fontSize: 14.5,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
                {hata ? (
                  <p
                    role="alert"
                    style={{ margin: '8px 0 0', color: '#A3271F', fontWeight: 700, fontSize: 13.5 }}
                  >
                    {hata}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={gonder}
                  disabled={mesgul}
                  style={{
                    marginTop: 12,
                    border: 0,
                    background: '#5B8CFF',
                    borderRadius: 14,
                    padding: '12px 20px',
                    fontSize: 15,
                    fontWeight: 800,
                    color: '#1E2333',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  İtiraz et
                </button>
              </>
            ) : (
              <p style={{ margin: '8px 0 0', fontSize: 14, color: '#5A6073' }}>
                {k.geriAlindi ? 'Karar geri alındı.' : 'İtiraz süresi doldu.'}
              </p>
            )}
          </section>
          <p style={{ margin: '16px 0 0', fontSize: 13.5 }}>
            <Link href="/kullanim-kosullari" style={{ fontWeight: 700 }}>
              Kullanım koşulları
            </Link>
          </p>
        </>
      ) : null}
    </main>
  );
}
