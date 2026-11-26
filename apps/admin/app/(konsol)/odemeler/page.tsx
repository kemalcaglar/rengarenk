'use client';

import { tlYaz } from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

interface Veri {
  ozet: {
    ayTahsilatKurus: number;
    ayAdet: number;
    bugunKurus: number;
    basarisiz30: number;
    gecikenAbonelik: number;
    etkinAbonelik: number;
    mrrKurus: number;
    bekleyenFatura: number;
    inceleme: number;
  };
  siparisler: {
    id: string;
    no: string;
    musteri: string;
    galeri: boolean;
    kanal: string;
    kalem: string;
    tarih: string;
    tutarKurus: number;
    durum: 'PAID' | 'FAILED' | 'PENDING' | 'CANCELLED' | 'REFUNDED';
    durumAd: string;
    fatura: string;
    /** Ön bilgilendirme formu ve sözleşme e-postası (web siparişi) */
    sozlesme: string | null;
    iadeKurus: number;
    iadeEdilebilir: boolean;
  }[];
  abonelikler: {
    id: string;
    galeri: string;
    plan: string;
    donem: string;
    durum: 'ACTIVE' | 'PAST_DUE' | 'ENDED';
    durumAd: string;
    bitis: string;
    yenilemeKurus: number;
    kart: string | null;
    basarisizDeneme: number;
    sonrakiDeneme: string | null;
    bitisNedeni: string | null;
  }[];
  magaza: {
    id: string;
    tarih: string;
    tur: string;
    urun: string | null;
    magaza: string;
    not: string | null;
  }[];
}
interface Iade {
  id: string;
  siparis: string | null;
  tutarKurus: number;
  durum: 'PENDING_EXECUTION' | 'EXECUTED' | 'FAILED';
  durumAd: string;
  neden: string | null;
  onaylayan: string | null;
  yurutulme: string | null;
  not: string | null;
  fatura: string;
}
interface Teklif {
  siparis: { id: string; no: string; tutarKurus: number; musteri: string; tarih: string | null };
  iadeEdilenKurus: number;
  enFazlaKurus: number;
  gun: number;
  sure: number;
  iadeEdilemez: string | null;
  kalemler: { ad: string; tutarKurus: number; onerilenKurus: number; not: string }[];
  onerilenKurus: number;
}

const DURUMLAR = [
  ['tum', 'Hepsi'],
  ['odendi', 'Ödendi'],
  ['basarisiz', 'Başarısız'],
  ['bekliyor', 'Ödeme bekleniyor'],
] as const;
const TURLER = [
  ['tum', 'Tüm kanallar'],
  ['bireysel', 'Bireysel web'],
  ['galeri', 'Galeri'],
  ['magaza', 'App Store ve Google Play'],
] as const;

/** Tasarımdaki durum renkleri (Yonetim.dc.html › durum) */
const RENK: Record<string, [string, string]> = {
  PAID: ['#E7FAF0', '#11683F'],
  FAILED: ['#FDECEC', '#A3271F'],
  PENDING: ['#FFF6DF', '#7A5300'],
  CANCELLED: ['#F3F5FA', '#3A4052'],
  REFUNDED: ['#F3F5FA', '#3A4052'],
  EXECUTED: ['#F3F5FA', '#3A4052'],
  PENDING_EXECUTION: ['#FFF6DF', '#7A5300'],
  ACTIVE: ['#E7FAF0', '#11683F'],
  PAST_DUE: ['#FDECEC', '#A3271F'],
  ENDED: ['#F3F5FA', '#3A4052'],
};
const KANAL: Record<string, string> = {
  web: 'Web',
  otomatik: 'Otomatik yenileme',
  ios: 'App Store',
  android: 'Google Play',
};
const gun = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Istanbul',
      }).format(new Date(iso))
    : '—';

function Rozet({ durum, ad }: { durum: string; ad: string }) {
  const [bg, fg] = RENK[durum] ?? ['#F3F5FA', '#3A4052'];
  return (
    <span className={stil.metin1} style={{ background: bg, color: fg }}>
      {ad}
    </span>
  );
}

/**
 * Ödemeler ve faturalar (tasarım: Yonetim.dc.html › Ödemeler; Karar 13.4, 12.7, 38). Sipariş tablosu tasarımdaki
 * sütunlarla (müşteri ve kalem, tutar, durum, fatura). Tasarıma ek: tahsilat özeti, galeri abonelikleri ve incelenecek
 * mağaza bildirimleri. İade yetkisi olan çalışan "İade öner" ile Sahibin onayına gönderir; iade bu ekrandan yapılmaz,
 * yalnızca Sahip onaylar ve ayrı iade yürütücü süreci yürütür.
 */
export default function Odemeler() {
  const { me } = useKonsol();
  const iadeYetkisi = me.permissions.iade === 'tam' || me.permissions.iade === 'oneri';
  const [v, setV] = useState<Veri | null>(null);
  const [iadeler, setIadeler] = useState<Iade[]>([]);
  const [teklif, setTeklif] = useState<Teklif | null>(null);
  const [tutar, setTutar] = useState('');
  const [neden, setNeden] = useState('');
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [durum, setDurum] = useState<string>('tum');
  const [tur, setTur] = useState<string>('tum');
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(() => {
    yonetim<Veri>(`payments?durum=${durum}&tur=${tur}`)
      .then((x) => {
        setV(x);
        setHata(null);
      })
      .catch((e: Error) => setHata(e.message));
    yonetim<Iade[]>('refunds')
      .then(setIadeler)
      .catch(() => undefined);
  }, [durum, tur]);
  useEffect(yukle, [yukle]);

  async function iadeAc(id: string) {
    setHata(null);
    setBilgi(null);
    try {
      const q = await yonetim<Teklif>(`refunds/quote/${id}`);
      setTeklif(q);
      setTutar(q.onerilenKurus ? String(q.onerilenKurus / 100).replace('.', ',') : '');
      setNeden('');
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  async function iadeIste() {
    if (!teklif) return;
    setHata(null);
    try {
      const tutarKurus = Math.round(Number(tutar.replace(/\./g, '').replace(',', '.')) * 100);
      await yonetim('refunds', {
        method: 'POST',
        body: { siparis: teklif.siparis.id, tutarKurus, neden: neden.trim() },
      });
      setTeklif(null);
      setBilgi(
        'İade önerisi Onay kuyruğuna gönderildi. Yalnızca Sahip onaylar; onaydan sonra iade yürütücü yapar.',
      );
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const o = v?.ozet;
  const kutular = o
    ? [
        [
          'Bu ay tahsilat',
          tlYaz(o.ayTahsilatKurus),
          `${o.ayAdet} ödeme · son 24 saat ${tlYaz(o.bugunKurus)}`,
          '#11683F',
        ],
        [
          'Galeri abonelikleri',
          String(o.etkinAbonelik),
          `Aylık tekrarlayan ${tlYaz(o.mrrKurus)} (KDV hariç)`,
          '#2450C8',
        ],
        [
          'Başarısız ödeme',
          String(o.basarisiz30),
          o.gecikenAbonelik ? `${o.gecikenAbonelik} abonelik otomatik yeniden denenecek` : 'Son 30 gün',
          '#A3271F',
        ],
        [
          'Bekleyen fatura ve inceleme',
          String(o.bekleyenFatura + o.inceleme),
          `${o.bekleyenFatura} fatura kuyrukta · ${o.inceleme} inceleme`,
          '#7A5300',
        ],
      ]
    : [];

  return (
    <>
      <h1 className={stil.baslik1}>Ödemeler ve faturalar</h1>
      {hata ? <p className={stil.metin2}>{hata}</p> : null}
      {bilgi ? (
        <p role="status" className={stil.metin3}>
          {bilgi}
        </p>
      ) : null}

      <div className={stil.kutu1}>
        {kutular.map(([ad, deger, not, renk]) => (
          <section key={ad} className={stil.kutu2}>
            <div className={stil.kutu3}>{ad}</div>
            <div className={stil.kutu4} style={{ color: renk }}>
              {deger}
            </div>
            <div className={stil.kutu5}>{not}</div>
          </section>
        ))}
      </div>

      <div className={stil.kutu6}>
        {DURUMLAR.map(([k, ad]) => (
          <button
            key={k}
            type="button"
            className="k-chip"
            aria-pressed={durum === k}
            onClick={() => setDurum(k)}
          >
            {ad}
          </button>
        ))}
        <span className={stil.metin4} aria-hidden="true" />
        {TURLER.map(([k, ad]) => (
          <button key={k} type="button" className="k-chip" aria-pressed={tur === k} onClick={() => setTur(k)}>
            {ad}
          </button>
        ))}
      </div>

      <div className={stil.kutu7}>
        <div className={stil.kutu8}>
          <span className={stil.metin5}>Müşteri ve kalem</span>
          <span className={stil.metin6}>Tutar</span>
          <span className={stil.metin7}>Durum</span>
          <span className={stil.metin7}>Fatura</span>
        </div>
        {v && !v.siparisler.length ? <p className={stil.metin8}>Bu seçimle ödeme yok.</p> : null}
        {v?.siparisler.map((s) => (
          <div key={s.id} className={stil.kutu9}>
            <span className={stil.metin9}>
              <span className={stil.metin10}>{s.musteri}</span>
              <span className={stil.metin11}>
                {s.kalem} · {gun(s.tarih)} · {KANAL[s.kanal] ?? s.kanal} · {s.no}
              </span>
            </span>
            <span className={stil.metin12}>{tlYaz(s.tutarKurus)}</span>
            <span className={stil.metin7}>
              <Rozet durum={s.durum} ad={s.durumAd} />
            </span>
            <span className={stil.metin13}>
              {s.fatura}
              {s.sozlesme ? <span className={stil.metin14}>{s.sozlesme}</span> : null}
              {iadeYetkisi && s.iadeEdilebilir ? (
                <button type="button" onClick={() => iadeAc(s.id)} className={stil.dugme1}>
                  İade öner
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </div>

      {teklif ? (
        <section aria-labelledby="iade" className={stil.kutu10}>
          <h2 id="iade" className={stil.baslik2}>
            İade önerisi · {teklif.siparis.musteri} · {teklif.siparis.no}
          </h2>
          <p className={stil.metin15}>
            Ödenen {tlYaz(teklif.siparis.tutarKurus)} · {teklif.gun} gün önce
            {teklif.iadeEdilenKurus ? ` · daha önce ${tlYaz(teklif.iadeEdilenKurus)} iade edildi` : ''} ·
            cayma süresi {teklif.sure} gün. İadeyi yalnızca Sahip onaylar; onaylarken tutarı düşürebilir.
          </p>
          {teklif.kalemler.map((k) => (
            <div key={k.ad} className={stil.kutu11}>
              <span className={stil.metin16}>
                <strong>{k.ad}</strong>
                <span className={stil.metin11}>{k.not}</span>
              </span>
              <span>
                {tlYaz(k.tutarKurus)} → <strong>{tlYaz(k.onerilenKurus)}</strong>
              </span>
            </div>
          ))}
          {teklif.iadeEdilemez ? (
            <p className={stil.metin17}>{teklif.iadeEdilemez}</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                iadeIste();
              }}
              className={stil.kutu12}
            >
              <label className={stil.etiket1}>
                İade tutarı (TL) · önerilen {tlYaz(teklif.onerilenKurus)}, en çok {tlYaz(teklif.enFazlaKurus)}
                <input
                  inputMode="decimal"
                  required
                  value={tutar}
                  onChange={(e) => setTutar(e.target.value)}
                  className={stil.girdi1}
                />
              </label>
              <label className={stil.etiket1}>
                Gerekçe
                <textarea
                  required
                  minLength={10}
                  value={neden}
                  onChange={(e) => setNeden(e.target.value)}
                  placeholder="Ör. Kullanıcı 14 gün içinde cayma hakkını kullandı, destek kaydı 1234"
                  rows={2}
                  className={stil.girdi2}
                />
              </label>
              <span className={stil.metin18}>
                <button type="submit" className="k-chip" aria-pressed="true">
                  Sahibin onayına gönder
                </button>
                <button type="button" className="k-chip" onClick={() => setTeklif(null)}>
                  Vazgeç
                </button>
              </span>
            </form>
          )}
        </section>
      ) : null}

      {iadeler.length ? (
        <>
          <h2 className={stil.baslik3}>İadeler</h2>
          <div className={stil.kutu7}>
            {iadeler.map((r) => (
              <div key={r.id} className={stil.kutu9}>
                <span className={stil.metin9}>
                  <span className={stil.metin10}>{r.siparis ?? '—'}</span>
                  <span className={stil.metin11}>
                    {r.neden ?? ''}
                    {r.onaylayan ? ` · onaylayan ${r.onaylayan}` : ''}
                    {r.yurutulme ? ` · ${gun(r.yurutulme)}` : ''}
                  </span>
                  {r.not ? <span className={stil.metin19}>{r.not}</span> : null}
                </span>
                <span className={stil.metin12}>{tlYaz(r.tutarKurus)}</span>
                <span className={stil.metin7}>
                  <Rozet durum={r.durum} ad={r.durumAd} />
                </span>
                <span className={stil.metin13}>{r.fatura}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <h2 className={stil.baslik3}>Galeri abonelikleri</h2>
      <div className={stil.kutu7}>
        <div className={stil.kutu8}>
          <span className={stil.metin5}>Galeri ve paket</span>
          <span className={stil.metin20}>Yenileme</span>
          <span className={stil.metin7}>Durum</span>
          <span className={stil.metin21}>Kart ve deneme</span>
        </div>
        {v && !v.abonelikler.length ? <p className={stil.metin8}>Henüz abonelik yok.</p> : null}
        {v?.abonelikler.map((a) => (
          <div key={a.id} className={stil.kutu9}>
            <span className={stil.metin9}>
              <span className={stil.metin10}>{a.galeri}</span>
              <span className={stil.metin11}>
                {a.plan} · {a.donem}
              </span>
            </span>
            <span className={stil.metin20}>
              <span className={stil.metin10}>{tlYaz(a.yenilemeKurus)}</span>
              <span className={stil.metin11}>
                {a.durum === 'ENDED' ? `Bitti ${gun(a.bitis)}` : gun(a.bitis)}
              </span>
            </span>
            <span className={stil.metin7}>
              <Rozet durum={a.durum} ad={a.durumAd} />
            </span>
            <span className={stil.metin22}>
              {a.durum === 'PAST_DUE'
                ? `${a.basarisizDeneme}. deneme başarısız${a.sonrakiDeneme ? ` · sonraki ${gun(a.sonrakiDeneme)}` : ''}`
                : a.durum === 'ENDED'
                  ? a.bitisNedeni === 'odeme_alinamadi'
                    ? 'Ödeme alınamadı, askıya alındı'
                    : 'İptal edildi'
                  : (a.kart ?? 'Kayıtlı kart')}
            </span>
          </div>
        ))}
      </div>

      {v?.magaza.length ? (
        <>
          <h2 className={stil.baslik4}>İncelenecek mağaza bildirimleri</h2>
          <p className={stil.metin23}>Eşleşmeyen satış ve iadeler; destek ilgili kullanıcıyla eşler.</p>
          <div className={stil.kutu7}>
            {v.magaza.map((m) => (
              <div key={m.id} className={stil.kutu9}>
                <span className={stil.metin24}>{m.not ?? m.tur}</span>
                <span className={stil.metin25}>
                  {m.magaza} · {m.urun ?? '—'}
                </span>
                <span className={stil.metin26}>{gun(m.tarih)}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
