'use client';

import { ekle } from '@rengarenk/shared';
import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

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

const kart: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E3E6EF',
  borderRadius: 18,
  overflow: 'hidden',
};
const baslik: CSSProperties = {
  margin: 0,
  padding: '16px 18px',
  fontSize: 17,
  fontWeight: 800,
  borderBottom: '1px solid #EEF0F5',
};
const satir: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '8px 16px',
  padding: '13px 18px',
  borderBottom: '1px solid #EEF0F5',
};
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
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Rengarenk Ajanı</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
            Kural içindeki işleri kendisi yapar, gerisini sana önerir. Her işlemi geri alabilirsin.
          </p>
        </div>
        {o && durdurabilir ? (
          o.calisiyor ? (
            <button
              type="button"
              onClick={() => calistir(false)}
              style={{
                border: '1.5px solid #E5A6A1',
                background: '#FFFFFF',
                borderRadius: 12,
                padding: '11px 16px',
                fontSize: 14,
                fontWeight: 800,
                color: '#A3271F',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Ajanı tamamen durdur
            </button>
          ) : (
            <button
              type="button"
              onClick={() => calistir(true)}
              style={{
                border: 0,
                background: '#3DD68C',
                borderRadius: 12,
                padding: '12px 18px',
                fontSize: 14,
                fontWeight: 800,
                color: '#1E2333',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Ajanı yeniden başlat
            </button>
          )
        ) : null}
      </div>
      {hata ? (
        <p role="alert" style={{ color: '#A3271F', fontWeight: 700 }}>
          {hata}
        </p>
      ) : null}
      {o && s ? (
        <>
          <div
            role="status"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '10px 16px',
              borderRadius: 16,
              padding: '14px 18px',
              marginBottom: 16,
              background: durum.bg,
              border: `1px solid ${durum.kenar}`,
            }}
          >
            <span
              aria-hidden="true"
              style={{ width: 12, height: 12, borderRadius: '50%', background: durum.nokta }}
            />
            <span style={{ fontSize: 15, fontWeight: 800 }}>{durum.baslik}</span>
            <span style={{ fontSize: 13.5, color: '#3A4052' }}>{durum.not}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
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
              <div
                key={x.ad}
                style={{ background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 16, padding: 16 }}
              >
                <div style={{ fontSize: 13, color: '#5A6073', fontWeight: 600 }}>{x.ad}</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{x.deger}</div>
                <div style={{ fontSize: 12.5, color: '#5A6073', marginTop: 4 }}>{x.not}</div>
              </div>
            ))}
          </div>

          <section aria-labelledby="oneri" style={{ ...kart, marginTop: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                padding: '16px 18px',
                borderBottom: '1px solid #EEF0F5',
              }}
            >
              <h2 id="oneri" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                Ajanın önerileri
              </h2>
              <Link
                href="/onaylar"
                style={{ fontSize: 13.5, fontWeight: 700, color: '#2450C8', textDecoration: 'none' }}
              >
                Onay kuyruğuna git
              </Link>
            </div>
            {o.oneriler.length === 0 ? (
              <p style={{ margin: 0, padding: '14px 18px', fontSize: 13.5, color: '#5A6073' }}>
                Şu an öneri yok. Ajan her sabah kuralları yeniden değerlendirir.
              </p>
            ) : (
              o.oneriler.map((x) => (
                <div key={x.id} style={satir}>
                  <span
                    style={{
                      flex: 'none',
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: 999,
                      background: x.bg,
                      color: x.fg,
                    }}
                  >
                    {x.tur}
                  </span>
                  <span style={{ flex: '999 1 300px', minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800 }}>{x.baslik}</span>
                    <span style={{ display: 'block', fontSize: 13, color: '#3A4052', marginTop: 2 }}>
                      {x.gerekce}
                    </span>
                  </span>
                </div>
              ))
            )}
          </section>

          <section aria-labelledby="akis" style={{ ...kart, marginTop: 16 }}>
            <h2 id="akis" style={baslik}>
              Bugün yaptıkları
            </h2>
            {o.akis.length === 0 ? (
              <p style={{ margin: 0, padding: '14px 18px', fontSize: 13.5, color: '#5A6073' }}>
                Bugün henüz işlem yok.
              </p>
            ) : (
              o.akis.map((a) => (
                <div key={a.id} style={{ ...satir, padding: '12px 18px', opacity: a.geriAlindi ? 0.6 : 1 }}>
                  <span style={{ flex: '0 0 48px', fontSize: 13, fontWeight: 700, color: '#5A6073' }}>
                    {a.saat}
                  </span>
                  <span style={{ flex: '999 1 320px', minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{a.islem}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
                      {a.neden}
                    </span>
                  </span>
                  <span style={{ flex: 'none', fontSize: 12.5, fontWeight: 700, color: '#3A4052' }}>
                    {a.guven}
                  </span>
                  {a.geriAlinabilir ? (
                    <button
                      type="button"
                      onClick={() => gerial(a.id)}
                      style={{
                        flex: 'none',
                        border: '1px solid #D5DAE5',
                        background: '#FFFFFF',
                        borderRadius: 10,
                        padding: '7px 12px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#1E2333',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Geri al
                    </button>
                  ) : null}
                  {a.geriAlindi ? (
                    <span style={{ flex: 'none', fontSize: 13, fontWeight: 700, color: '#7A5300' }}>
                      Geri alındı
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </section>

          <section aria-labelledby="sor" style={{ ...kart, marginTop: 16, padding: 18 }}>
            <h2 id="sor" style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800 }}>
              Ajana sor
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sor();
              }}
              style={{ display: 'flex', gap: 8 }}
            >
              <label
                htmlFor="soru"
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  overflow: 'hidden',
                  clip: 'rect(0 0 0 0)',
                }}
              >
                Soru
              </label>
              <input
                id="soru"
                value={soru}
                maxLength={300}
                onChange={(e) => setSoru(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: '1px solid #D5DAE5',
                  borderRadius: 12,
                  padding: '12px 14px',
                  fontSize: 14.5,
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="submit"
                disabled={soruyor}
                style={{
                  border: 0,
                  background: '#5B8CFF',
                  borderRadius: 12,
                  padding: '12px 18px',
                  fontSize: 14.5,
                  fontWeight: 800,
                  color: '#1E2333',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Sor
              </button>
            </form>
            {cevap ? (
              <div
                style={{
                  marginTop: 12,
                  background: '#F6F8FD',
                  borderRadius: 14,
                  padding: '14px 16px',
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: '#2E3344',
                }}
              >
                {cevap.cevap}
                <span style={{ display: 'block', marginTop: 8, fontSize: 12.5, color: '#5A6073' }}>
                  {cevap.kaynak}
                </span>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </>
  );
}
