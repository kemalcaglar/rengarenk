'use client';

import { CAMPAIGN_CHANNELS, CAMPAIGN_GOALS, type CampaignChannel } from '@rengarenk/shared';
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
 * özeldir (tasarımdaki tek şablon seçimi yerine başlık, metin ve düğme); kupon ve A/B testi kendi modülleriyle gelecek.
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
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([yonetim<Satir[]>('campaigns'), yonetim<Segment[]>('segments')]);
      setListe(l);
      setSegmentler(s);
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
        },
      });
      setListe(l);
      const ilk = l[0];
      setBilgi(
        ilk?.durum === 'onay_bekliyor'
          ? 'Kampanya onay kuyruğuna gönderildi. Onaylanınca zamanında gider; sonucu listeye ve kontrol paneli grafiğine kendiliğinden düşer.'
          : 'Kampanya zamanlandı. Zamanında gider; sonucu listeye ve kontrol paneli grafiğine kendiliğinden düşer.',
      );
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
            <label style={{ ...etiket, flex: '1 1 200px', color: '#5A6073' }}>
              Kupon
              <select disabled style={{ ...girdi, color: '#5A6073' }}>
                <option>Kupon yok · kupon modülüyle gelecek</option>
              </select>
            </label>
            <span style={{ flex: 'none', fontSize: 12.5, color: '#5A6073', paddingTop: 30 }}>
              A/B testi deney altyapısıyla gelecek
            </span>
          </div>
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
    </>
  );
}
