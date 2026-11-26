'use client';

import { ekle } from '@rengarenk/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

interface Ozet {
  calisiyor: boolean;
  durum: {
    aski: number;
    askiSinir: number;
    yanit: number;
    yanitSinir: number;
    maliyetUsd: number;
    sinirUsd: number;
  };
  sayilar: {
    bugun: number;
    insana: number;
    geriOran: number;
    geri7: number;
    toplam7: number;
    tepkiSn: number | null;
    bekleyen: number;
  };
  oneriler: { id: string; tur: string; bg: string; fg: string; baslik: string; gerekce: string }[];
  akis: {
    id: string;
    saat: string;
    islem: string;
    neden: string;
    guven: string;
    geriAlinabilir: boolean;
    geriAlindi: boolean;
  }[];
}
const sayi = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
const usd = (n: number) =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n);
const yuzde = (x: number) =>
  `%${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(x * 100)}`;
const sure = (sn: number | null) => (sn === null ? '—' : sn < 60 ? `${sn} sn` : `${Math.round(sn / 60)} dk`);
const ORNEK = 'Geçen ay İzmir’de kaç galeri ilk mesaj gönderdi?';

/**
 * Rengarenk Ajanı (YonetimEkip.dc.html › ajan; Karar 41): durum ve günlük sınırlar, sayılar, öneriler, bugün
 * yaptıkları (geri alma), ajana sor. Tamamen durdurma `ajan` özellik anahtarıdır.
 */
export default function Ajan() {
  const { me } = useKonsol();
  const [o, setO] = useState<Ozet | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [soru, setSoru] = useState(ORNEK);
  const [cevap, setCevap] = useState<{ cevap: string; kaynak: string } | null>(null);
  const [soruyor, setSoruyor] = useState(false);

  const yukle = useCallback(() => {
    yonetim<Ozet>('agent')
      .then(setO)
      .catch((e: Error) => setHata(e.message));
  }, []);
  useEffect(yukle, [yukle]);

  async function calistir(calisiyor: boolean) {
    setHata(null);
    try {
      await yonetim('agent/run', { method: 'POST', body: { calisiyor } });
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function gerial(id: string) {
    setHata(null);
    try {
      await yonetim(`agent/actions/${id}/undo`, { method: 'POST', body: {} });
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function sor() {
    if (soru.trim().length < 3) return;
    setSoruyor(true);
    setHata(null);
    try {
      setCevap(await yonetim('agent/ask', { method: 'POST', body: { soru } }));
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setSoruyor(false);
    }
  }

  const durdurabilir = !!me.permissions['sistem.ayarla'];
  const d = o?.durum;
  const durum = o?.calisiyor
    ? {
        bg: '#E7FAF0',
        kenar: '#B9EBD1',
        nokta: '#3DD68C',
        baslik: 'Ajan çalışıyor',
        not: d
          ? `Günlük limitler: askıya alma ${d.aski} / ${d.askiSinir} · otomatik yanıt ${d.yanit} / ${d.yanitSinir} · bu ayki yapay zekâ maliyeti ${usd(d.maliyetUsd)} / ${d.sinirUsd} USD`
          : '',
      }
    : {
        bg: '#FDECEC',
        kenar: '#F2B8B3',
        nokta: '#E5484D',
        baslik: 'Ajan durduruldu',
        not: 'Hiçbir otomatik işlem yapılmıyor; şikâyetler ve destek talepleri insan kuyruğunda bekliyor.',
      };
  const s = o?.sayilar;

  return (
    <>
      <div className={stil.kutu1}>
        <div>
          <h1 className={stil.baslik1}>Rengarenk Ajanı</h1>
          <p className={stil.metin1}>
            Kural içindeki işleri kendisi yapar, gerisini sana önerir. Her işlemi geri alabilirsin.
          </p>
        </div>
        {o && durdurabilir ? (
          o.calisiyor ? (
            <button type="button" onClick={() => calistir(false)} className={stil.dugme1}>
              Ajanı tamamen durdur
            </button>
          ) : (
            <button type="button" onClick={() => calistir(true)} className={stil.dugme2}>
              Ajanı yeniden başlat
            </button>
          )
        ) : null}
      </div>
      {hata ? (
        <p role="alert" className={stil.metin2}>
          {hata}
        </p>
      ) : null}
      {o && s ? (
        <>
          <div
            role="status"
            className={stil.kutu2}
            style={{ background: durum.bg, border: `1px solid ${durum.kenar}` }}
          >
            <span aria-hidden="true" className={stil.metin3} style={{ background: durum.nokta }} />
            <span className={stil.metin4}>{durum.baslik}</span>
            <span className={stil.metin5}>{durum.not}</span>
          </div>

          <div className={stil.kutu3}>
            {[
              {
                ad: 'Bugünkü işlem',
                deger: sayi(s.bugun),
                not: s.insana ? `${ekle(s.insana, 'iyelik')} insana bırakıldı` : 'Hiçbiri insana bırakılmadı',
              },
              {
                ad: 'Geri alınan (7 gün)',
                deger: yuzde(s.geriOran),
                not: `${sayi(s.toplam7)} işlemden ${s.geri7 ? ekle(s.geri7, 'iyelik') : 'hiçbiri'}`,
              },
              { ad: 'Ort. tepki süresi', deger: sure(s.tepkiSn), not: 'Şikâyet gelişinden işleme' },
              { ad: 'Onayını bekleyen', deger: sayi(s.bekleyen), not: 'İade, gönderim, kupon, engelleme' },
            ].map((x) => (
              <div key={x.ad} className={stil.kutu4}>
                <div className={stil.kutu5}>{x.ad}</div>
                <div className={stil.kutu6}>{x.deger}</div>
                <div className={stil.kutu7}>{x.not}</div>
              </div>
            ))}
          </div>

          <section aria-labelledby="oneri" className={stil.kutu8}>
            <div className={stil.kutu9}>
              <h2 id="oneri" className={stil.baslik2}>
                Ajanın önerileri
              </h2>
              <Link href="/onaylar" className={stil.bag1}>
                Onay kuyruğuna git
              </Link>
            </div>
            {o.oneriler.length === 0 ? (
              <p className={stil.metin6}>Şu an öneri yok. Ajan her sabah kuralları yeniden değerlendirir.</p>
            ) : (
              o.oneriler.map((x) => (
                <div key={x.id} className={stil.kutu10}>
                  <span className={stil.metin7} style={{ background: x.bg, color: x.fg }}>
                    {x.tur}
                  </span>
                  <span className={stil.metin8}>
                    <span className={stil.metin9}>{x.baslik}</span>
                    <span className={stil.metin10}>{x.gerekce}</span>
                  </span>
                </div>
              ))
            )}
          </section>

          <section aria-labelledby="akis" className={stil.kutu8}>
            <h2 id="akis" className={stil.baslik3}>
              Bugün yaptıkları
            </h2>
            {o.akis.length === 0 ? (
              <p className={stil.metin6}>Bugün henüz işlem yok.</p>
            ) : (
              o.akis.map((a) => (
                <div key={a.id} className={cx(stil.kutu11, a.geriAlindi ? stil.kutu12 : stil.kutu13)}>
                  <span className={stil.metin11}>{a.saat}</span>
                  <span className={stil.metin12}>
                    <span className={stil.metin13}>{a.islem}</span>
                    <span className={stil.metin14}>{a.neden}</span>
                  </span>
                  <span className={stil.metin15}>{a.guven}</span>
                  {a.geriAlinabilir ? (
                    <button type="button" onClick={() => gerial(a.id)} className={stil.dugme3}>
                      Geri al
                    </button>
                  ) : null}
                  {a.geriAlindi ? <span className={stil.metin16}>Geri alındı</span> : null}
                </div>
              ))
            )}
          </section>

          <section aria-labelledby="sor" className={stil.kutu14}>
            <h2 id="sor" className={stil.baslik4}>
              Ajana sor
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sor();
              }}
              className={stil.kutu15}
            >
              <label htmlFor="soru" className={stil.etiket1}>
                Soru
              </label>
              <input
                id="soru"
                value={soru}
                maxLength={300}
                onChange={(e) => setSoru(e.target.value)}
                className={stil.girdi1}
              />
              <button type="submit" disabled={soruyor} className={stil.dugme4}>
                Sor
              </button>
            </form>
            {cevap ? (
              <div className={stil.kutu16}>
                {cevap.cevap}
                <span className={stil.metin17}>{cevap.kaynak}</span>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </>
  );
}
