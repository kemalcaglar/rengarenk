'use client';

import { tlYaz } from '@rengarenk/shared';
import { useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';

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
    durum: 'PAID' | 'FAILED' | 'PENDING' | 'CANCELLED';
    durumAd: string;
    fatura: string;
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
 * mağaza bildirimleri. Yalnızca görüntüleme; iade bu ekranda yoktur (yalnızca sahibin onayıyla, ayrı süreçte).
 */
export default function Odemeler() {
  const [v, setV] = useState<Veri | null>(null);
  const [durum, setDurum] = useState<string>('tum');
  const [tur, setTur] = useState<string>('tum');
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    yonetim<Veri>(`payments?durum=${durum}&tur=${tur}`)
      .then((x) => {
        setV(x);
        setHata(null);
      })
      .catch((e: Error) => setHata(e.message));
  }, [durum, tur]);

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
            <span style={{ flex: '1 1 120px', fontSize: 13.5 }}>{s.fatura}</span>
          </div>
        ))}
      </div>

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
