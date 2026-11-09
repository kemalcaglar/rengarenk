'use client';

import {
  CAMPAIGN_CHANNELS,
  CAMPAIGN_GOALS,
  type CampaignChannel,
  COUPON_AUDIENCES,
  COUPON_MAX_PERCENT,
  COUPON_TARGET_KEYS,
  COUPON_TARGETS,
  type CouponAudience,
  type CouponTarget,
} from '@rengarenk/shared';
import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';

interface Satir {
  id: string;
  ad: string;
  hedef: string;
  kanal: string;
  kitle: string;
  sonuc: string;
  durum: string;
  durumAd: string;
  bg: string;
  fg: string;
  iptalEdilebilir: boolean;
}
interface Kupon {
  id: string;
  kod: string;
  ad: string;
  yuzde: number;
  ozet: string;
  tarih: string;
  kullanim: string;
  durumKey: string;
  durum: string;
  bg: string;
  fg: string;
  secilebilir: boolean;
}
interface Segment {
  id: string;
  ad: string;
  sayi: number | null;
}
interface Tahmin {
  segment: string;
  toplam: number;
  satirlar: { ad: string; not: string; deger: number }[];
  maliyet: number;
  ulasilan: number;
  onayGerek: boolean;
}

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const girdi: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 5,
  border: '1px solid #D5DAE5',
  borderRadius: 10,
  padding: 10,
  fontSize: 14,
  background: '#FFFFFF',
  fontFamily: 'inherit',
};
const etiket: CSSProperties = { fontSize: 13, fontWeight: 700 };
const sayi = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
/** Yarın 10.00 (Türkiye) — datetime-local değeri */
const varsayilanZaman = () => {
  const d = new Date(Date.now() + 86_400_000);
  const g = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d);
  return `${g}T10:00`;
};

/**
 * Kampanyalar (YonetimKampanya.dc.html › kampanya; Karar 49, 51). Ticari ileti: yalnızca ticari ileti onayı ve kampanya
 * bildirimi izni olanlara; kişi başı haftada 2; 21.00–09.00 sabaha ertelenir. Gönderim özeti segmenti, kanal ulaşımını,
 * sıklık sınırına takılanları ve ısınmayı gösterir. 1.000 kişiyi aşan gönderim onay kuyruğuna gider. İçerik kampanyaya
 * özeldir (tasarımdaki tek şablon seçimi yerine başlık, metin ve düğme). Kupon bağlanabilir: kupon onaylanmadan kampanya
 * gönderilmez. Kuponlar bu sayfada hazırlanır; sahip ya da yönetici onaylar (%50 üstünü yalnızca sahip).
 */
export default function Kampanyalar() {
  const [liste, setListe] = useState<Satir[]>([]);
  const [segmentler, setSegmentler] = useState<Segment[]>([]);
  const [ad, setAd] = useState('');
  const [hedef, setHedef] = useState<string>('ust_sira');
  const [segmentId, setSegmentId] = useState('');
  const [kanallar, setKanallar] = useState<CampaignChannel[]>(['uygulama']);
  const [baslik, setBaslik] = useState('');
  const [metin, setMetin] = useState('');
  const [dugme, setDugme] = useState('');
  const [url, setUrl] = useState('/');
  const [zaman, setZaman] = useState(varsayilanZaman);
  const [tahmin, setTahmin] = useState<Tahmin | null>(null);
  const [kuponlar, setKuponlar] = useState<Kupon[]>([]);
  const [kuponId, setKuponId] = useState('');
  const [ab, setAb] = useState<{ baslik: string; metin: string; dugme: string } | null>(null);
  const [kuponForm, setKuponForm] = useState(false);
  const [yk, setYk] = useState({
    kod: '',
    ad: '',
    yuzde: 20,
    hedefler: ['ust_sira'] as CouponTarget[],
    kitle: 'herkes' as CouponAudience,
    bas: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date()),
    bit: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(
      new Date(Date.now() + 7 * 86_400_000),
    ),
    sinir: '',
  });
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    try {
      const [l, s, k] = await Promise.all([
        yonetim<Satir[]>('campaigns'),
        yonetim<Segment[]>('segments'),
        yonetim<Kupon[]>('coupons'),
      ]);
      setListe(l);
      setSegmentler(s);
      setKuponlar(k);
      setSegmentId((x) => x || s[0]?.id || '');
    } catch (e) {
      setHata((e as Error).message);
    }
  }, []);
  useEffect(() => {
    yukle();
  }, [yukle]);
  useEffect(() => {
    if (!segmentId || !kanallar.length) return setTahmin(null);
    yonetim<Tahmin>('campaigns/estimate', { method: 'POST', body: { segmentId, kanallar } })
      .then(setTahmin)
      .catch((e: Error) => setHata(e.message));
  }, [segmentId, kanallar]);

  async function gonder() {
    setHata(null);
    try {
      const l = await yonetim<Satir[]>('campaigns', {
        method: 'POST',
        body: {
          ad,
          hedef,
          segmentId,
          kanallar,
          baslik,
          metin,
          dugme,
          url,
          zaman: new Date(`${zaman}:00+03:00`).toISOString(),
          kuponId: kuponId || null,
          b: ab,
        },
      });
      setListe(l);
      const ilk = l[0];
      setBilgi(
        ilk?.durum === 'onay_bekliyor'
          ? 'Kampanya onay kuyruğuna gönderildi. Onaylanınca zamanında gider; sonucu listeye ve kontrol paneli grafiğine kendiliğinden düşer.'
          : 'Kampanya zamanlandı. Zamanında gider; sonucu listeye ve kontrol paneli grafiğine kendiliğinden düşer.',
      );
      setAb(null);
      setAd('');
      setBaslik('');
      setMetin('');
      setDugme('');
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function iptal(id: string) {
    try {
      setListe(await yonetim<Satir[]>(`campaigns/${id}/cancel`, { method: 'POST', body: {} }));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  async function kuponHazirla() {
    setHata(null);
    try {
      setKuponlar(
        await yonetim<Kupon[]>('coupons', {
          method: 'POST',
          body: {
            kod: yk.kod,
            ad: yk.ad,
            yuzde: yk.yuzde,
            hedefler: yk.hedefler,
            kitle: yk.kitle,
            baslangic: new Date(`${yk.bas}T00:00:00+03:00`).toISOString(),
            // Bitiş günü dahil
            bitis: new Date(new Date(`${yk.bit}T00:00:00+03:00`).getTime() + 86_400_000).toISOString(),
            toplamSinir: yk.sinir ? Number(yk.sinir) : null,
          },
        }),
      );
      setKuponForm(false);
      setBilgi(
        yk.yuzde > COUPON_MAX_PERCENT
          ? `Kupon onay kuyruğuna gitti. %${COUPON_MAX_PERCENT} üstü indirimi yalnızca sahip onaylar.`
          : 'Kupon onay kuyruğuna gitti. Sahip ya da yönetici onaylayınca geçerli olur.',
      );
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function kuponIptal(id: string) {
    try {
      setKuponlar(await yonetim<Kupon[]>(`coupons/${id}/cancel`, { method: 'POST', body: {} }));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const hazir =
    ad.trim().length >= 3 &&
    baslik.trim().length >= 3 &&
    metin.trim().length >= 10 &&
    dugme.trim().length >= 2;

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Kampanyalar</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Ticari iletiler yalnızca İYS onayı olanlara gider · kişi başı haftada en fazla 2 · 21.00–09.00 arası
          gönderilmez
        </p>
      </div>
      {bilgi ? (
        <div
          role="status"
          style={{
            background: '#F3EFFF',
            color: '#4B2FA6',
            borderRadius: 12,
            padding: '10px 14px',
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          {bilgi}
        </div>
      ) : null}
      {hata ? <p style={{ color: '#A3271F', fontWeight: 700 }}>{hata}</p> : null}

      <section aria-labelledby="liste" style={{ ...kart, overflow: 'hidden' }}>
        <h2
          id="liste"
          style={{
            margin: 0,
            padding: '16px 18px',
            fontSize: 17,
            fontWeight: 800,
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          Son kampanyalar
        </h2>
        {liste.length ? null : (
          <p style={{ margin: 0, padding: '12px 18px', fontSize: 13.5, color: '#5A6073' }}>
            Henüz kampanya yok.
          </p>
        )}
        {liste.map((k) => (
          <div
            key={k.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px 16px',
              padding: '12px 18px',
              borderBottom: '1px solid #EEF0F5',
            }}
          >
            <span style={{ flex: '999 1 280px', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800 }}>{k.ad}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#3A4052', marginTop: 2 }}>
                {k.kanal} · {k.kitle}
              </span>
            </span>
            <span style={{ flex: '1 1 240px', minWidth: 0, fontSize: 12.5, color: '#3A4052' }}>
              {k.sonuc}
            </span>
            {k.iptalEdilebilir ? (
              <button
                type="button"
                onClick={() => iptal(k.id)}
                style={{
                  flex: 'none',
                  border: 0,
                  background: 'transparent',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#5A6073',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                İptal et
              </button>
            ) : null}
            <span
              style={{
                flex: 'none',
                fontSize: 12,
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: 999,
                background: k.bg,
                color: k.fg,
              }}
            >
              {k.durumAd}
            </span>
          </div>
        ))}
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', marginTop: 16 }}>
        <section
          aria-labelledby="yeni"
          style={{ ...kart, flex: '999 1 480px', minWidth: 0, border: '1.5px solid #5B8CFF', padding: 18 }}
        >
          <h2 id="yeni" style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 800 }}>
            Yeni kampanya
          </h2>
          {segmentler.length ? null : (
            <p style={{ margin: '0 0 12px', fontSize: 13.5, color: '#7A5300', fontWeight: 700 }}>
              Önce bir segment kaydet: <Link href="/segmentler">Segmentler</Link>
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <label style={{ ...etiket, flex: '2 1 260px' }}>
              Kampanya adı
              <input value={ad} onChange={(e) => setAd(e.target.value)} maxLength={100} style={girdi} />
            </label>
            <label style={{ ...etiket, flex: '1 1 180px' }}>
              Hedef
              <select value={hedef} onChange={(e) => setHedef(e.target.value)} style={girdi}>
                {CAMPAIGN_GOALS.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.ad}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
            <label style={{ ...etiket, flex: '2 1 260px' }}>
              Segment
              <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)} style={girdi}>
                {segmentler.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ad}
                    {s.sayi !== null ? ` · ${sayi(s.sayi)} kişi` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ ...etiket, flex: '2 1 220px' }}>
              Bağlantı
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/haklarim"
                style={girdi}
              />
            </label>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
            <label style={{ ...etiket, flex: '2 1 260px' }}>
              Başlık
              <input
                value={baslik}
                onChange={(e) => setBaslik(e.target.value)}
                maxLength={80}
                style={girdi}
              />
            </label>
            <label style={{ ...etiket, flex: '1 1 160px' }}>
              Düğme
              <input value={dugme} onChange={(e) => setDugme(e.target.value)} maxLength={30} style={girdi} />
            </label>
          </div>
          <label style={{ ...etiket, display: 'block', marginTop: 12 }}>
            Metin
            <textarea
              value={metin}
              onChange={(e) => setMetin(e.target.value)}
              rows={3}
              maxLength={400}
              style={{ ...girdi, resize: 'vertical' }}
            />
          </label>
          <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700 }}>Kanallar</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {CAMPAIGN_CHANNELS.map((k) => {
              if (!k.acik)
                return (
                  <span
                    key={k.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      border: '1px dashed #D5DAE5',
                      borderRadius: 12,
                      padding: '9px 12px',
                      fontSize: 13.5,
                      color: '#5A6073',
                    }}
                  >
                    {k.ad} · kapalı (Karar 49)
                  </span>
                );
              const on = kanallar.includes(k.key as CampaignChannel);
              return (
                // biome-ignore lint/a11y/useSemanticElements: tasarımdaki kutucuklu kanal düğmesi (YonetimKampanya.dc.html)
                <button
                  key={k.key}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() =>
                    setKanallar(
                      on ? kanallar.filter((x) => x !== k.key) : [...kanallar, k.key as CampaignChannel],
                    )
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: `1.5px solid ${on ? '#5B8CFF' : '#D5DAE5'}`,
                    background: on ? '#EEF3FF' : '#FFFFFF',
                    borderRadius: 12,
                    padding: '9px 12px',
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: '#1E2333',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: `2px solid ${on ? '#5B8CFF' : '#D5DAE5'}`,
                      background: on ? '#5B8CFF' : '#FFFFFF',
                      color: '#FFFFFF',
                      fontSize: 11,
                      lineHeight: '14px',
                      textAlign: 'center',
                    }}
                  >
                    {on ? '✓' : ''}
                  </span>
                  {k.ad}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
            <label style={{ ...etiket, flex: '1 1 200px' }}>
              Gönderim zamanı
              <input
                type="datetime-local"
                value={zaman}
                onChange={(e) => setZaman(e.target.value)}
                style={girdi}
              />
            </label>
            <label style={{ ...etiket, flex: '1 1 200px' }}>
              Kupon
              <select value={kuponId} onChange={(e) => setKuponId(e.target.value)} style={girdi}>
                <option value="">Kupon yok</option>
                {kuponlar
                  .filter((k) => k.secilebilir)
                  .map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.kod} · {k.ad} %{k.yuzde} ({k.durum.toLocaleLowerCase('tr-TR')})
                    </option>
                  ))}
              </select>
            </label>
            <label
              style={{
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13.5,
                fontWeight: 700,
                paddingTop: 26,
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(ab)}
                onChange={(e) => setAb(e.target.checked ? { baslik, metin, dugme } : null)}
                style={{ width: 18, height: 18 }}
              />
              A/B testi
            </label>
          </div>
          {ab ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                background: '#F3EFFF',
              }}
            >
              <label style={{ ...etiket, flex: '2 1 240px' }}>
                B · Başlık
                <input
                  value={ab.baslik}
                  maxLength={80}
                  onChange={(e) => setAb({ ...ab, baslik: e.target.value })}
                  style={girdi}
                />
              </label>
              <label style={{ ...etiket, flex: '1 1 160px' }}>
                B · Düğme
                <input
                  value={ab.dugme}
                  maxLength={30}
                  onChange={(e) => setAb({ ...ab, dugme: e.target.value })}
                  style={girdi}
                />
              </label>
              <label style={{ ...etiket, flex: '1 1 100%' }}>
                B · Metin
                <textarea
                  value={ab.metin}
                  maxLength={400}
                  rows={2}
                  onChange={(e) => setAb({ ...ab, metin: e.target.value })}
                  style={{ ...girdi, resize: 'vertical' }}
                />
              </label>
              <p style={{ margin: 0, fontSize: 12.5, color: '#4B2FA6' }}>
                Segment yarı yarıya ayrılır (kişi hep aynı sürümü alır); ölçü bildirimi uygulamada açma oranı.
                Sonuç Raporlar › Deneyler’de.
              </p>
            </div>
          ) : null}
        </section>

        <section
          aria-labelledby="ozet"
          style={{ ...kart, flex: '1 1 300px', maxWidth: 380, minWidth: 0, overflow: 'hidden' }}
        >
          <h2
            id="ozet"
            style={{
              margin: 0,
              padding: '16px 18px',
              fontSize: 17,
              fontWeight: 800,
              borderBottom: '1px solid #EEF0F5',
            }}
          >
            Gönderim özeti
          </h2>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #EEF0F5' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5A6073' }}>Segmentteki kişi</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{tahmin ? sayi(tahmin.toplam) : '—'}</div>
          </div>
          {tahmin?.satirlar.map((s) => (
            <div
              key={s.ad}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                padding: '10px 18px',
                borderBottom: '1px solid #EEF0F5',
                fontSize: 13.5,
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700 }}>{s.ad}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#5A6073' }}>{s.not}</span>
              </span>
              <span
                style={{
                  flex: 'none',
                  fontWeight: 800,
                  color: s.deger < 0 || s.ad.startsWith('Isınma') ? '#7A5300' : '#1E2333',
                }}
              >
                {s.deger < 0 ? `−${sayi(-s.deger)}` : sayi(s.deger)}
              </span>
            </div>
          ))}
          {tahmin ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                padding: '10px 18px',
                borderBottom: '1px solid #EEF0F5',
                fontSize: 13.5,
              }}
            >
              <span>
                <span style={{ display: 'block', fontWeight: 700 }}>Tahmini maliyet</span>
                <span style={{ display: 'block', fontSize: 12, color: '#5A6073' }}>
                  Push ve e-posta kendi altyapımızdan
                </span>
              </span>
              <span style={{ fontWeight: 800, color: '#11683F' }}>₺0</span>
            </div>
          ) : null}
          <div style={{ padding: '14px 18px' }}>
            {tahmin?.onayGerek ? (
              <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#7A5300', fontWeight: 700 }}>
                1.000 kişiyi aştığı için sahip veya yönetici onayı gerekir.
              </p>
            ) : null}
            <button
              type="button"
              disabled={!kanallar.length || !hazir || !segmentId}
              onClick={gonder}
              style={{
                width: '100%',
                border: 0,
                background: '#5B8CFF',
                borderRadius: 12,
                padding: 12,
                fontSize: 14.5,
                fontWeight: 800,
                color: '#1E2333',
                cursor: 'pointer',
                opacity: !kanallar.length || !hazir || !segmentId ? 0.5 : 1,
                fontFamily: 'inherit',
              }}
            >
              {!kanallar.length
                ? 'En az bir kanal seç'
                : !hazir
                  ? 'Ad, başlık, metin ve düğmeyi yaz'
                  : tahmin?.onayGerek
                    ? 'Onaya gönder'
                    : 'Zamanla'}
            </button>
            {tahmin ? (
              <p
                style={{
                  margin: '12px 0 0',
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: '#2E3344',
                  border: '1px solid #E3E6EF',
                  borderRadius: 14,
                  padding: '12px 14px',
                }}
              >
                <strong>Ajan:</strong> bu kampanya {sayi(tahmin.ulasilan)} kişiye ulaşır.{' '}
                {tahmin.toplam - tahmin.ulasilan > 0
                  ? `${sayi(tahmin.toplam - tahmin.ulasilan)} kişi ticari ileti onayı, kampanya bildirimi izni ya da haftalık sınır nedeniyle almayacak.`
                  : ''}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <section aria-labelledby="kuponlar" style={{ ...kart, overflow: 'hidden', marginTop: 16 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '16px 18px',
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          <div>
            <h2 id="kuponlar" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
              Kuponlar
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#5A6073' }}>
              Web ödemesinde kodla, hesap başına bir kez · onay sahip ya da yönetici · %{COUPON_MAX_PERCENT}{' '}
              üstü yalnızca sahip · uygulama içi satın almada geçmez
            </p>
          </div>
          <button
            type="button"
            onClick={() => setKuponForm((x) => !x)}
            aria-expanded={kuponForm}
            style={{
              border: '1px solid #D5DAE5',
              background: '#FFFFFF',
              borderRadius: 10,
              padding: '9px 14px',
              fontSize: 13.5,
              fontWeight: 700,
              color: '#1E2333',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Yeni kupon
          </button>
        </div>
        {kuponForm ? (
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #EEF0F5', background: '#F6F8FD' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
              <label style={{ ...etiket, flex: '1 1 130px' }}>
                Kod
                <input
                  value={yk.kod}
                  maxLength={16}
                  placeholder="UST20"
                  onChange={(e) => setYk({ ...yk, kod: e.target.value.toLocaleUpperCase('tr-TR') })}
                  style={girdi}
                />
              </label>
              <label style={{ ...etiket, flex: '2 1 220px' }}>
                Ad
                <input
                  value={yk.ad}
                  maxLength={60}
                  placeholder="Hafta sonu üst sıra"
                  onChange={(e) => setYk({ ...yk, ad: e.target.value })}
                  style={girdi}
                />
              </label>
              <label style={{ ...etiket, flex: '0 1 100px' }}>
                İndirim %
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={yk.yuzde}
                  onChange={(e) => setYk({ ...yk, yuzde: Number(e.target.value) })}
                  style={girdi}
                />
              </label>
              <label style={{ ...etiket, flex: '1 1 140px' }}>
                Kitle
                <select
                  value={yk.kitle}
                  onChange={(e) => setYk({ ...yk, kitle: e.target.value as CouponAudience })}
                  style={girdi}
                >
                  {(Object.keys(COUPON_AUDIENCES) as CouponAudience[]).map((k) => (
                    <option key={k} value={k}>
                      {COUPON_AUDIENCES[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ ...etiket, flex: '1 1 140px' }}>
                Başlangıç
                <input
                  type="date"
                  value={yk.bas}
                  onChange={(e) => setYk({ ...yk, bas: e.target.value })}
                  style={girdi}
                />
              </label>
              <label style={{ ...etiket, flex: '1 1 140px' }}>
                Bitiş (dahil)
                <input
                  type="date"
                  value={yk.bit}
                  onChange={(e) => setYk({ ...yk, bit: e.target.value })}
                  style={girdi}
                />
              </label>
              <label style={{ ...etiket, flex: '0 1 130px' }}>
                Toplam sınır
                <input
                  type="number"
                  min={1}
                  value={yk.sinir}
                  placeholder="Sınırsız"
                  onChange={(e) => setYk({ ...yk, sinir: e.target.value })}
                  style={girdi}
                />
              </label>
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: '12px 0 0' }}>
              <legend style={{ ...etiket, padding: 0 }}>Ürünler</legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 6 }}>
                {COUPON_TARGET_KEYS.map((t) => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                    <input
                      type="checkbox"
                      checked={yk.hedefler.includes(t)}
                      onChange={() =>
                        setYk({
                          ...yk,
                          hedefler: yk.hedefler.includes(t)
                            ? yk.hedefler.filter((x) => x !== t)
                            : [...yk.hedefler, t],
                        })
                      }
                    />
                    {COUPON_TARGETS[t].ad}
                  </label>
                ))}
              </div>
            </fieldset>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <button
                type="button"
                onClick={kuponHazirla}
                disabled={yk.kod.length < 4 || yk.ad.trim().length < 3 || !yk.hedefler.length}
                style={{
                  border: 0,
                  background: '#5B8CFF',
                  borderRadius: 12,
                  padding: '11px 18px',
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#1E2333',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  opacity: yk.kod.length < 4 || yk.ad.trim().length < 3 || !yk.hedefler.length ? 0.5 : 1,
                }}
              >
                Onaya gönder
              </button>
              {yk.yuzde > COUPON_MAX_PERCENT ? (
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#7A5300' }}>
                  %{COUPON_MAX_PERCENT} üstü indirimi yalnızca sahip onaylar.
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
        {kuponlar.length === 0 ? (
          <p style={{ margin: 0, padding: '14px 18px', fontSize: 13.5, color: '#5A6073' }}>
            Henüz kupon yok.
          </p>
        ) : (
          kuponlar.map((k) => (
            <div
              key={k.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '6px 16px',
                padding: '12px 18px',
                borderBottom: '1px solid #EEF0F5',
              }}
            >
              <span style={{ flex: '0 0 96px', fontSize: 14.5, fontWeight: 800, letterSpacing: 0.5 }}>
                {k.kod}
              </span>
              <span style={{ flex: '999 1 260px', minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{k.ad}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
                  {k.ozet} · {k.tarih}
                </span>
              </span>
              <span style={{ flex: '1 1 180px', fontSize: 12.5, color: '#3A4052' }}>{k.kullanim}</span>
              {k.secilebilir ? (
                <button
                  type="button"
                  onClick={() => kuponIptal(k.id)}
                  style={{
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                    color: '#A3271F',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  İptal et
                </button>
              ) : null}
              <span
                style={{
                  flex: 'none',
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: k.bg,
                  color: k.fg,
                }}
              >
                {k.durum}
              </span>
            </div>
          ))
        )}
      </section>
    </>
  );
}
