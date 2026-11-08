'use client';

import { tlYaz } from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

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

const kart = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 } as const;
const gun = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Istanbul',
      }).format(new Date(iso))
    : '—';
const baslikSatiri = {
  display: 'flex',
  gap: 14,
  padding: '12px 18px',
  background: '#F3F5FA',
  fontSize: 12.5,
  fontWeight: 700,
  color: '#5A6073',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
} as const;
const satir = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '8px 14px',
  padding: '13px 18px',
  borderTop: '1px solid #EEF0F5',
  fontSize: 14,
} as const;

function Rozet({ durum, ad }: { durum: string; ad: string }) {
  const [bg, fg] = RENK[durum] ?? ['#F3F5FA', '#3A4052'];
  return (
    <span
      style={{
        fontSize: 12.5,
        fontWeight: 700,
        padding: '3px 9px',
        borderRadius: 999,
        background: bg,
        color: fg,
      }}
    >
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
      <h1 style={{ margin: '0 0 16px', fontSize: 26, fontWeight: 800 }}>Ödemeler ve faturalar</h1>
      {hata ? <p style={{ color: '#A3271F' }}>{hata}</p> : null}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {kutular.map(([ad, deger, not, renk]) => (
          <section key={ad} style={{ ...kart, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#5A6073' }}>{ad}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: renk, marginTop: 2 }}>{deger}</div>
            <div style={{ fontSize: 12.5, color: '#5A6073', marginTop: 4 }}>{not}</div>
          </section>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '18px 0 12px' }}>
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
        <span style={{ width: 1, background: '#E3E6EF', margin: '0 4px' }} aria-hidden="true" />
        {TURLER.map(([k, ad]) => (
          <button key={k} type="button" className="k-chip" aria-pressed={tur === k} onClick={() => setTur(k)}>
            {ad}
          </button>
        ))}
      </div>

      <div style={{ ...kart, overflow: 'hidden' }}>
        <div style={baslikSatiri}>
          <span style={{ flex: '999 1 220px' }}>Müşteri ve kalem</span>
          <span style={{ flex: '1 1 110px' }}>Tutar</span>
          <span style={{ flex: '1 1 120px' }}>Durum</span>
          <span style={{ flex: '1 1 120px' }}>Fatura</span>
        </div>
        {v && !v.siparisler.length ? (
          <p style={{ margin: 0, padding: '14px 18px', borderTop: '1px solid #EEF0F5', color: '#5A6073' }}>
            Bu seçimle ödeme yok.
          </p>
        ) : null}
        {v?.siparisler.map((s) => (
          <div key={s.id} style={satir}>
            <span style={{ flex: '999 1 220px', minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 800 }}>{s.musteri}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073' }}>
                {s.kalem} · {gun(s.tarih)} · {KANAL[s.kanal] ?? s.kanal} · {s.no}
              </span>
            </span>
            <span style={{ flex: '1 1 110px', fontWeight: 800 }}>{tlYaz(s.tutarKurus)}</span>
            <span style={{ flex: '1 1 120px' }}>
              <Rozet durum={s.durum} ad={s.durumAd} />
            </span>
            <span style={{ flex: '1 1 120px', fontSize: 13.5 }}>
              {s.fatura}
              {iadeYetkisi && s.iadeEdilebilir ? (
                <button
                  type="button"
                  onClick={() => iadeAc(s.id)}
                  style={{
                    display: 'block',
                    marginTop: 4,
                    border: 0,
                    background: 'none',
                    padding: 0,
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#A3271F',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  İade öner
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </div>

      {teklif ? (
        <section
          aria-labelledby="iade"
          style={{ ...kart, padding: 20, marginTop: 16, border: '2px solid #FFB4AE' }}
        >
          <h2 id="iade" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            İade önerisi · {teklif.siparis.musteri} · {teklif.siparis.no}
          </h2>
          <p style={{ margin: '4px 0 12px', fontSize: 13.5, color: '#5A6073' }}>
            Ödenen {tlYaz(teklif.siparis.tutarKurus)} · {teklif.gun} gün önce
            {teklif.iadeEdilenKurus ? ` · daha önce ${tlYaz(teklif.iadeEdilenKurus)} iade edildi` : ''} ·
            cayma süresi {teklif.sure} gün. İadeyi yalnızca Sahip onaylar; onaylarken tutarı düşürebilir.
          </p>
          {teklif.kalemler.map((k) => (
            <div
              key={k.ad}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: 8,
                padding: '8px 0',
                borderTop: '1px solid #EEF0F5',
                fontSize: 14,
              }}
            >
              <span style={{ flex: '1 1 260px' }}>
                <strong>{k.ad}</strong>
                <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073' }}>{k.not}</span>
              </span>
              <span>
                {tlYaz(k.tutarKurus)} → <strong>{tlYaz(k.onerilenKurus)}</strong>
              </span>
            </div>
          ))}
          {teklif.iadeEdilemez ? (
            <p style={{ margin: '12px 0 0', fontWeight: 700, color: '#A3271F' }}>{teklif.iadeEdilemez}</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                iadeIste();
              }}
              style={{ display: 'grid', gap: 10, marginTop: 12 }}
            >
              <label style={{ fontSize: 13.5, fontWeight: 700 }}>
                İade tutarı (TL) · önerilen {tlYaz(teklif.onerilenKurus)}, en çok {tlYaz(teklif.enFazlaKurus)}
                <input
                  inputMode="decimal"
                  required
                  value={tutar}
                  onChange={(e) => setTutar(e.target.value)}
                  style={{
                    display: 'block',
                    width: 180,
                    marginTop: 6,
                    border: '1px solid #D5DAE5',
                    borderRadius: 10,
                    padding: 10,
                    fontSize: 15,
                    fontFamily: 'inherit',
                  }}
                />
              </label>
              <label style={{ fontSize: 13.5, fontWeight: 700 }}>
                Gerekçe
                <textarea
                  required
                  minLength={10}
                  value={neden}
                  onChange={(e) => setNeden(e.target.value)}
                  placeholder="Ör. Kullanıcı 14 gün içinde cayma hakkını kullandı, destek kaydı 1234"
                  rows={2}
                  style={{
                    display: 'block',
                    width: '100%',
                    boxSizing: 'border-box',
                    marginTop: 6,
                    border: '1px solid #D5DAE5',
                    borderRadius: 10,
                    padding: 10,
                    fontSize: 14,
                    fontFamily: 'inherit',
                  }}
                />
              </label>
              <span style={{ display: 'flex', gap: 8 }}>
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
          <h2 style={{ margin: '24px 0 10px', fontSize: 18, fontWeight: 800 }}>İadeler</h2>
          <div style={{ ...kart, overflow: 'hidden' }}>
            {iadeler.map((r) => (
              <div key={r.id} style={satir}>
                <span style={{ flex: '999 1 220px', minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 800 }}>{r.siparis ?? '—'}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073' }}>
                    {r.neden ?? ''}
                    {r.onaylayan ? ` · onaylayan ${r.onaylayan}` : ''}
                    {r.yurutulme ? ` · ${gun(r.yurutulme)}` : ''}
                  </span>
                  {r.not ? (
                    <span style={{ display: 'block', fontSize: 12.5, color: '#A3271F' }}>{r.not}</span>
                  ) : null}
                </span>
                <span style={{ flex: '1 1 110px', fontWeight: 800 }}>{tlYaz(r.tutarKurus)}</span>
                <span style={{ flex: '1 1 120px' }}>
                  <Rozet durum={r.durum} ad={r.durumAd} />
                </span>
                <span style={{ flex: '1 1 120px', fontSize: 13.5 }}>{r.fatura}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <h2 style={{ margin: '24px 0 10px', fontSize: 18, fontWeight: 800 }}>Galeri abonelikleri</h2>
      <div style={{ ...kart, overflow: 'hidden' }}>
        <div style={baslikSatiri}>
          <span style={{ flex: '999 1 220px' }}>Galeri ve paket</span>
          <span style={{ flex: '1 1 140px' }}>Yenileme</span>
          <span style={{ flex: '1 1 120px' }}>Durum</span>
          <span style={{ flex: '1 1 160px' }}>Kart ve deneme</span>
        </div>
        {v && !v.abonelikler.length ? (
          <p style={{ margin: 0, padding: '14px 18px', borderTop: '1px solid #EEF0F5', color: '#5A6073' }}>
            Henüz abonelik yok.
          </p>
        ) : null}
        {v?.abonelikler.map((a) => (
          <div key={a.id} style={satir}>
            <span style={{ flex: '999 1 220px', minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 800 }}>{a.galeri}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073' }}>
                {a.plan} · {a.donem}
              </span>
            </span>
            <span style={{ flex: '1 1 140px' }}>
              <span style={{ display: 'block', fontWeight: 800 }}>{tlYaz(a.yenilemeKurus)}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073' }}>
                {a.durum === 'ENDED' ? `Bitti ${gun(a.bitis)}` : gun(a.bitis)}
              </span>
            </span>
            <span style={{ flex: '1 1 120px' }}>
              <Rozet durum={a.durum} ad={a.durumAd} />
            </span>
            <span style={{ flex: '1 1 160px', fontSize: 13.5 }}>
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
          <h2 style={{ margin: '24px 0 4px', fontSize: 18, fontWeight: 800 }}>
            İncelenecek mağaza bildirimleri
          </h2>
          <p style={{ margin: '0 0 10px', fontSize: 13.5, color: '#5A6073' }}>
            Eşleşmeyen satış ve iadeler; destek ilgili kullanıcıyla eşler.
          </p>
          <div style={{ ...kart, overflow: 'hidden' }}>
            {v.magaza.map((m) => (
              <div key={m.id} style={satir}>
                <span style={{ flex: '999 1 220px', fontWeight: 700 }}>{m.not ?? m.tur}</span>
                <span style={{ flex: '1 1 160px', fontSize: 13 }}>
                  {m.magaza} · {m.urun ?? '—'}
                </span>
                <span style={{ flex: '1 1 120px', fontSize: 13, color: '#5A6073' }}>{gun(m.tarih)}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
