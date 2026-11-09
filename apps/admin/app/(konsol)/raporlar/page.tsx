'use client';

import {
  HEAT_RAMP,
  ILLER,
  REPORT_COMPARE,
  REPORT_RANGES,
  REPORT_TABS,
  type ReportFilter,
  type ReportTab,
} from '@rengarenk/shared';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

interface Deney {
  id: string;
  tur: 'banner' | 'kampanya' | 'fiyat' | 'arayuz';
  anahtar?: string;
  ad: string;
  durum: string;
  bg: string;
  fg: string;
  olcu: string;
  kollar: { ad: string; deger: string; w: number; renk: string }[];
  sonuc: string;
  eylem: { kol: 'A' | 'B'; yazi: string } | null;
  bitti: boolean;
}
type Veri = Record<string, unknown> & {
  donem: string;
  filtreNotu: string | null;
  bos?: string;
  yorum?: string;
};
interface Kategori {
  slug: string;
  ad: string;
}
interface Pano {
  id: string;
  name: string;
  tab: ReportTab;
  filter: ReportFilter;
}

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const secim: CSSProperties = {
  display: 'block',
  marginTop: 4,
  border: '1px solid #D5DAE5',
  borderRadius: 10,
  padding: '8px 10px',
  fontSize: 13.5,
  background: '#FFFFFF',
  fontFamily: 'inherit',
};
const etiket: CSSProperties = { fontSize: 12, fontWeight: 700, color: '#5A6073' };
const ajan: CSSProperties = {
  margin: '6px 0 0',
  fontSize: 14,
  lineHeight: 1.55,
  color: '#2E3344',
  background: '#F6F8FD',
  borderRadius: 12,
  padding: '12px 14px',
};
const sayi = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
const kucukKart = (ad: string, deger: string, not: string) => (
  <div key={ad} style={{ ...kart, borderRadius: 16, padding: 14 }}>
    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5A6073' }}>{ad}</div>
    <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4 }}>{deger}</div>
    <div style={{ fontSize: 12, color: '#5A6073', marginTop: 3 }}>{not}</div>
  </div>
);

/**
 * Raporlar (YonetimRapor.dc.html › rapor; Karar 44): huni, arz-talep haritası, gelir, en çok talep edilenler, birim
 * ekonomisi ve kohort gerçek veriyle; reklam ve edinim ilk temas ve gece çekilen harcamayla (Karar 35), deneyler A/B
 * testlerinden. Süzgeçler, "Panoya kaydet"
 * (kişisel) ve "Excel'e aktar" (sahip, yönetici, finans; kişisel veri yok, işlem kaydına girer). Ajan notları
 * kurallardan üretilir.
 */
export default function Raporlar() {
  const { me } = useKonsol();
  const disaAktarir = me.permissions['rapor.disa_aktar'] === 'tam';
  const [sekme, setSekme] = useState<ReportTab>('huni');
  const [f, setF] = useState<ReportFilter>({ tarih: '30', karsilastir: 'onceki' });
  const [v, setV] = useState<Veri | null>(null);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [panolar, setPanolar] = useState<Pano[]>([]);
  const [haritaOlcu, setHaritaOlcu] = useState<'bos' | 'sayi'>('bos');
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [tazele, setTazele] = useState(0);
  const [hata, setHata] = useState<string | null>(null);

  const sorgu = useCallback(
    (x: ReportFilter) =>
      new URLSearchParams(
        Object.entries(x).filter(([, val]) => val !== undefined && val !== '') as [string, string][],
      ).toString(),
    [],
  );
  useEffect(() => {
    // "tazele" deney kazananı açılınca raporu yeniden yükler
    if (tazele < 0) return;
    setV(null);
    yonetim<Veri>(`reports/${sekme}?${sorgu(f)}`)
      .then(setV)
      .catch((e: Error) => setHata(e.message));
  }, [sekme, f, sorgu, tazele]);

  async function kazanan(d: Deney) {
    if (!d.eylem) return;
    try {
      if (d.tur === 'fiyat') {
        // Fiyat deneyi: kazanan fiyat, fiyat değişikliği olarak sahibin onayına gider (Karar 56)
        await yonetim(`pricing/experiments/${d.id}/propose`, { method: 'POST', body: {} });
        setBilgi(
          'Kazanan fiyat, fiyat değişikliği olarak sahibin onayına gönderildi (Kurallar ve fiyatlar).',
        );
        setTazele((x) => x + 1);
        return;
      }
      if (d.tur === 'arayuz') {
        // Arayüz deneyi: B herkese açılır (anahtar %100) ya da A'da kalınır (anahtar kapanır)
        await yonetim(`flags/${d.anahtar}/deney/${d.eylem.kol}`, { method: 'POST', body: {} });
        setBilgi(
          d.eylem.kol === 'B'
            ? 'B herkese açıldı; özellik anahtarı %100.'
            : 'Deney bitti; anahtar kapandı, herkes A’yı görüyor.',
        );
        setTazele((x) => x + 1);
        return;
      }
      await yonetim(`banners/${d.id}/ab/${d.eylem.kol}`, { method: 'POST', body: {} });
      setBilgi(
        d.eylem.kol === 'B'
          ? 'B herkese açıldı; banner artık B sürümüyle görünüyor.'
          : 'Test bitti; banner A sürümüyle devam ediyor.',
      );
      setTazele((x) => x + 1);
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/categories`)
      .then((r) => r.json() as Promise<{ slug: string; name?: string; ad?: string }[]>)
      .then((c) => setKategoriler(c.map((x) => ({ slug: x.slug, ad: x.ad ?? x.name ?? x.slug }))))
      .catch(() => undefined);
    yonetim<Pano[]>('reports/views')
      .then(setPanolar)
      .catch(() => undefined);
    // Zamanlanmış raporlar ekranındaki kayıtlı panodan gelindiyse o görünüm açılır
    const pano = new URLSearchParams(window.location.search).get('pano');
    if (pano)
      yonetim<Pano>(`reports/views/${pano}`)
        .then((p) => {
          setSekme(p.tab);
          setF(p.filter);
          setBilgi(`Kayıtlı pano açıldı: “${p.name}”.`);
        })
        .catch((e: Error) => setHata(e.message));
  }, []);

  async function panoyaKaydet() {
    const tab = REPORT_TABS.find((t) => t.key === sekme)?.ad ?? sekme;
    const ad = `${tab} · ${REPORT_RANGES.find((r) => r.key === f.tarih)?.ad.toLocaleLowerCase('tr-TR')}${f.il ? ` · ${f.il}` : ''}`;
    try {
      setPanolar(await yonetim<Pano[]>('reports/views', { method: 'POST', body: { ad, sekme, filtre: f } }));
      setBilgi(`Panoya kaydedildi: “${ad}”. Kayıtlı panolarından açabilirsin.`);
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function disaAktar() {
    try {
      const r = await yonetim<{ dosya: string; csv: string }>(`reports/${sekme}/export?${sorgu(f)}`);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' }));
      a.download = r.dosya;
      a.click();
      URL.revokeObjectURL(a.href);
      setBilgi(`${r.dosya} hazırlandı. Kişisel veri içermez; dışa aktarma işlem kaydına yazıldı.`);
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  // Sekme değişince yeni veri gelene kadar eski sekmenin verisi çizilmez
  const gecerli = v && (v as { sekme?: string }).sekme === sekme ? v : null;
  const veri = gecerli as Record<string, never> | null;

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Raporlar</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
            Kırılım için kontrol panelindeki ölçülere tıkla; burada süzgeçlerle daralt.
          </p>
        </div>
        <span style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={panoyaKaydet}
            style={{
              border: '1px solid #D5DAE5',
              background: '#FFFFFF',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 14,
              fontWeight: 700,
              color: '#1E2333',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Panoya kaydet
          </button>
          {disaAktarir ? (
            <button
              type="button"
              onClick={disaAktar}
              style={{
                border: 0,
                background: '#5B8CFF',
                borderRadius: 12,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 800,
                color: '#1E2333',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Excel'e aktar
            </button>
          ) : null}
        </span>
      </div>
      {bilgi ? (
        <div
          role="status"
          style={{
            background: '#E7FAF0',
            color: '#11683F',
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14, alignItems: 'flex-end' }}>
        <label style={etiket}>
          Tarih
          <select
            value={f.tarih}
            onChange={(e) => setF({ ...f, tarih: e.target.value as ReportFilter['tarih'] })}
            style={secim}
          >
            {REPORT_RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.ad}
              </option>
            ))}
          </select>
        </label>
        <label style={etiket}>
          Karşılaştır
          <select
            value={f.karsilastir}
            onChange={(e) => setF({ ...f, karsilastir: e.target.value as ReportFilter['karsilastir'] })}
            style={secim}
          >
            {REPORT_COMPARE.map((r) => (
              <option key={r.key} value={r.key}>
                {r.ad}
              </option>
            ))}
          </select>
        </label>
        <label style={etiket}>
          İl
          <select
            value={f.il ?? ''}
            onChange={(e) => setF({ ...f, il: e.target.value || undefined })}
            style={secim}
          >
            <option value="">Tüm Türkiye</option>
            {ILLER.map((i) => (
              <option key={i.plaka} value={i.ad}>
                {i.ad}
              </option>
            ))}
          </select>
        </label>
        <label style={etiket}>
          Kategori
          <select
            value={f.kategori ?? ''}
            onChange={(e) => setF({ ...f, kategori: e.target.value || undefined })}
            style={secim}
          >
            <option value="">Tüm kategoriler</option>
            {kategoriler.map((k) => (
              <option key={k.slug} value={k.slug}>
                {k.ad}
              </option>
            ))}
          </select>
        </label>
        <label style={etiket}>
          Platform
          <select
            value={f.platform ?? ''}
            onChange={(e) =>
              setF({ ...f, platform: (e.target.value || undefined) as ReportFilter['platform'] })
            }
            style={secim}
          >
            <option value="">Hepsi</option>
            <option value="WEB">Web</option>
            <option value="IOS">iOS</option>
            <option value="ANDROID">Android</option>
          </select>
        </label>
        {panolar.length ? (
          <label style={etiket}>
            Kayıtlı panolarım
            <select
              value=""
              onChange={(e) => {
                const p = panolar.find((x) => x.id === e.target.value);
                if (p) {
                  setSekme(p.tab);
                  setF(p.filter);
                }
              }}
              style={secim}
            >
              <option value="">Seç</option>
              {panolar.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label="Rapor türü"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          borderBottom: '1px solid #E3E6EF',
          marginBottom: 16,
        }}
      >
        {REPORT_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={sekme === t.key}
            onClick={() => setSekme(t.key)}
            style={{
              border: 0,
              borderBottom: `3px solid ${sekme === t.key ? '#5B8CFF' : 'transparent'}`,
              background: 'transparent',
              padding: '10px 12px',
              fontSize: 14,
              fontWeight: sekme === t.key ? 800 : 600,
              color: sekme === t.key ? '#1E2333' : '#3A4052',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t.ad}
          </button>
        ))}
      </div>

      {!gecerli ? <p style={{ color: '#5A6073' }}>Yükleniyor…</p> : null}
      {gecerli?.filtreNotu ? (
        <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#7A5300' }}>{gecerli.filtreNotu}</p>
      ) : null}
      {gecerli?.bos ? (
        <section style={{ ...kart, padding: '18px 20px' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
            {REPORT_TABS.find((t) => t.key === sekme)?.ad}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#3A4052', lineHeight: 1.55 }}>{gecerli.bos}</p>
        </section>
      ) : null}

      {gecerli && sekme === 'deney' && Array.isArray(gecerli.deneyler) && gecerli.deneyler.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(gecerli.deneyler as Deney[]).map((d) => (
            <article key={d.id} style={{ ...kart, padding: '16px 18px' }}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 15.5, fontWeight: 800 }}>{d.ad}</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: d.bg,
                    color: d.fg,
                  }}
                >
                  {d.durum}
                </span>
              </div>
              <p style={{ margin: '4px 0 12px', fontSize: 13, color: '#5A6073' }}>{d.olcu}</p>
              {d.kollar.map((k) => (
                <div key={k.ad} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ flex: '0 0 260px', minWidth: 0, fontSize: 13.5, fontWeight: 700 }}>
                    {k.ad}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, height: 16 }}>
                    <span
                      style={{
                        display: 'block',
                        height: 16,
                        width: `${k.w}%`,
                        background: k.renk,
                        borderRadius: '0 4px 4px 0',
                      }}
                    />
                  </span>
                  <span style={{ flex: '0 0 70px', fontSize: 13.5, fontWeight: 800, textAlign: 'right' }}>
                    {k.deger}
                  </span>
                </div>
              ))}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginTop: 6,
                }}
              >
                <span style={{ fontSize: 13, color: '#3A4052' }}>{d.sonuc}</span>
                {d.eylem &&
                (d.tur === 'fiyat'
                  ? ['tam', 'oneri'].includes(me.permissions['fiyat.degistir'] ?? '')
                  : d.tur === 'arayuz'
                    ? me.permissions['sistem.ayarla'] === 'tam'
                    : me.permissions['gorunum.duzenle'] === 'tam') ? (
                  <button
                    type="button"
                    onClick={() => kazanan(d)}
                    style={{
                      border: 0,
                      background: '#3DD68C',
                      borderRadius: 10,
                      padding: '9px 14px',
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: '#1E2333',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {d.eylem.yazi}
                  </button>
                ) : null}
                {d.bitti && d.tur === 'banner' ? (
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: '#11683F' }}>Herkese açıldı</span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {gecerli && sekme === 'huni' && veri ? (
        <section aria-labelledby="huni" style={{ ...kart, padding: '18px 20px' }}>
          <h2 id="huni" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
            Huni · {gecerli.donem}
          </h2>
          <p style={{ margin: '4px 0 16px', fontSize: 13, color: '#5A6073' }}>
            {veri.ust} {veri.ziyaretNotu}
          </p>
          {(
            veri.huni as {
              ad: string;
              sayi: number;
              not: string;
              w: number;
              fark: { metin: string } | null;
            }[]
          ).map((h) => (
            <div
              key={h.ad}
              title={`${h.ad}: ${sayi(h.sayi)}${h.fark ? ` · önceki döneme göre ${h.fark.metin}` : ''}`}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '6px 16px',
                marginBottom: 12,
              }}
            >
              <span style={{ flex: '0 0 190px', fontSize: 14, fontWeight: 700 }}>{h.ad}</span>
              <span
                style={{
                  flex: '1 1 300px',
                  minWidth: 0,
                  height: 28,
                  background: '#F3F5FA',
                  borderRadius: '0 6px 6px 0',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    height: 28,
                    width: `${h.w}%`,
                    background: '#5B8CFF',
                    borderRadius: '0 6px 6px 0',
                  }}
                />
              </span>
              <span style={{ flex: '0 0 90px', fontSize: 15, fontWeight: 800, textAlign: 'right' }}>
                {sayi(h.sayi)}
              </span>
              <span style={{ flex: '0 0 190px', fontSize: 12.5, color: '#3A4052' }}>{h.not}</span>
            </div>
          ))}
          <p style={ajan}>
            <strong>Ajan:</strong> {gecerli.yorum}
          </p>
        </section>
      ) : null}

      {gecerli && sekme === 'harita' && veri ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
          <section
            aria-labelledby="harita"
            style={{ ...kart, flex: '3 1 560px', minWidth: 0, padding: '18px 20px' }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 14,
              }}
            >
              <h2 id="harita" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                İl ve kategoriye göre arz-talep
              </h2>
              <span style={{ display: 'flex', gap: 6 }}>
                {(
                  [
                    ['bos', 'Mesaj almayan talep oranı'],
                    ['sayi', 'Talep sayısı'],
                  ] as const
                ).map(([k, ad]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={haritaOlcu === k}
                    onClick={() => setHaritaOlcu(k)}
                    style={{
                      border: haritaOlcu === k ? 0 : '1px solid #D5DAE5',
                      background: haritaOlcu === k ? '#1E2333' : '#FFFFFF',
                      borderRadius: 999,
                      padding: haritaOlcu === k ? '7px 12px' : '6px 11px',
                      fontSize: 13,
                      fontWeight: haritaOlcu === k ? 800 : 700,
                      color: haritaOlcu === k ? '#FFFFFF' : '#1E2333',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {ad}
                  </button>
                ))}
              </span>
            </div>
            {(veri.satirlar as unknown[]).length ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `110px repeat(${(veri.kategoriler as string[]).length}, minmax(0, 1fr))`,
                  gap: 2,
                  fontSize: 12.5,
                }}
              >
                <span />
                {(veri.kategoriler as string[]).map((k) => (
                  <span
                    key={k}
                    style={{ padding: '6px 4px', fontWeight: 800, color: '#5A6073', textAlign: 'center' }}
                  >
                    {k}
                  </span>
                ))}
                {(
                  veri.satirlar as {
                    il: string;
                    hucre: {
                      kategori: string;
                      sayi: number;
                      bos: number | null;
                      sayiAdim: number;
                      bosAdim: number;
                      ipucu: string;
                    }[];
                  }[]
                ).flatMap((s) => [
                  <span key={s.il} style={{ padding: '10px 6px', fontWeight: 700 }}>
                    {s.il}
                  </span>,
                  ...s.hucre.map((h) => {
                    const adim = haritaOlcu === 'bos' ? h.bosAdim : h.sayiAdim;
                    return (
                      <span
                        key={`${s.il}${h.kategori}`}
                        title={h.ipucu}
                        style={{
                          padding: '10px 4px',
                          textAlign: 'center',
                          fontWeight: 800,
                          borderRadius: 6,
                          background: adim < 0 ? '#F6F8FD' : HEAT_RAMP[adim],
                          color: adim >= 3 ? '#FFFFFF' : '#1E2333',
                        }}
                      >
                        {haritaOlcu === 'bos'
                          ? h.bos === null
                            ? '—'
                            : `%${Math.round(h.bos * 100)}`
                          : sayi(h.sayi)}
                      </span>
                    );
                  }),
                ])}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 13.5, color: '#5A6073' }}>Bu süzgeçte talep yok.</p>
            )}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '6px 14px',
                marginTop: 12,
                fontSize: 12,
                color: '#3A4052',
              }}
            >
              <span style={{ fontWeight: 700 }}>
                {haritaOlcu === 'bos'
                  ? 'Talebin 48 saatte mesaj almayan payı (koyu = arz açığı):'
                  : `${gecerli.donem.charAt(0).toLocaleUpperCase('tr-TR')}${gecerli.donem.slice(1)} açılan talep:`}
              </span>
              {(veri.lejant as Record<string, string[]>)[haritaOlcu]?.map((ad, i) => (
                <span key={ad} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: HEAT_RAMP[i],
                      border: '1px solid #E3E6EF',
                    }}
                  />
                  {ad}
                </span>
              ))}
            </div>
          </section>
          <section
            aria-labelledby="acik"
            style={{ ...kart, flex: '2 1 300px', minWidth: 0, overflow: 'hidden' }}
          >
            <h2
              id="acik"
              style={{
                margin: 0,
                padding: '16px 18px',
                fontSize: 17,
                fontWeight: 800,
                borderBottom: '1px solid #EEF0F5',
              }}
            >
              En büyük arz açıkları
            </h2>
            {(veri.aciklar as { yer: string; oran: string; not: string }[]).map((a) => (
              <div key={a.yer} style={{ padding: '12px 18px', borderBottom: '1px solid #EEF0F5' }}>
                <span
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  <span>{a.yer}</span>
                  <span>{a.oran}</span>
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#3A4052', marginTop: 2 }}>
                  {a.not}
                </span>
              </div>
            ))}
            <p
              style={{
                margin: 0,
                padding: '12px 18px',
                fontSize: 13,
                lineHeight: 1.5,
                color: '#2E3344',
                background: '#F6F8FD',
              }}
            >
              <strong>Ajan:</strong> {gecerli.yorum}
            </p>
          </section>
        </div>
      ) : null}

      {gecerli && sekme === 'gelir' && veri ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 10,
              marginBottom: 14,
            }}
          >
            {(veri.sayilar as { ad: string; deger: string; not: string }[]).map((s) =>
              kucukKart(s.ad, s.deger, s.not),
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
            <section
              aria-labelledby="kalem"
              style={{ ...kart, flex: '3 1 480px', minWidth: 0, padding: '18px 20px' }}
            >
              <h2 id="kalem" style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 800 }}>
                Gelir kalemleri · {gecerli.donem}
              </h2>
              {(veri.kalemler as { ad: string; tutar: string; w: number; ipucu: string }[]).length ? null : (
                <p style={{ margin: 0, fontSize: 13.5, color: '#5A6073' }}>Bu dönemde ödeme yok.</p>
              )}
              {(veri.kalemler as { ad: string; tutar: string; w: number; ipucu: string }[]).map((k) => (
                <div
                  key={k.ad}
                  title={k.ipucu}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}
                >
                  <span style={{ flex: '0 0 200px', fontSize: 13.5, fontWeight: 700 }}>{k.ad}</span>
                  <span style={{ flex: 1, minWidth: 0, height: 18 }}>
                    <span
                      style={{
                        display: 'block',
                        height: 18,
                        width: `${k.w}%`,
                        background: '#5B8CFF',
                        borderRadius: '0 4px 4px 0',
                      }}
                    />
                  </span>
                  <span style={{ flex: '0 0 110px', fontSize: 13.5, fontWeight: 800, textAlign: 'right' }}>
                    {k.tutar}
                  </span>
                </div>
              ))}
            </section>
            <section
              aria-labelledby="mrr"
              style={{ ...kart, flex: '2 1 320px', minWidth: 0, padding: '18px 20px' }}
            >
              <h2 id="mrr" style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>
                Aylık tekrarlayan gelir
              </h2>
              <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#5A6073' }}>
                Galeri abonelikleri · KDV hariç · bu ay bugün itibarıyla
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 10,
                  height: 150,
                  borderBottom: '1px solid #D5DAE5',
                }}
              >
                {(() => {
                  const m = veri.mrr as { ay: string; kurus: number; tutar: string }[];
                  const mx = Math.max(1, ...m.map((x) => x.kurus));
                  return m.map((x, i) => (
                    <span
                      key={x.ay}
                      title={`${x.ay}: ${x.tutar}`}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        height: '100%',
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#3A4052', marginBottom: 4 }}>
                        {x.kurus >= 100_000_00
                          ? `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(x.kurus / 100_000)} bin`
                          : x.tutar}
                      </span>
                      <span
                        style={{
                          width: '100%',
                          height: `${(x.kurus / mx) * 85}%`,
                          background: i === m.length - 1 ? '#2450C8' : '#5B8CFF',
                          borderRadius: '4px 4px 0 0',
                        }}
                      />
                    </span>
                  ));
                })()}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                {(veri.mrr as { ay: string }[]).map((x) => (
                  <span key={x.ay} style={{ flex: 1, textAlign: 'center', fontSize: 11.5, color: '#5A6073' }}>
                    {x.ay}
                  </span>
                ))}
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 12.5, color: '#3A4052' }}>{veri.platformPayi}</p>
            </section>
          </div>
        </>
      ) : null}

      {gecerli && sekme === 'model' && veri ? (
        <section aria-labelledby="model" style={{ ...kart, overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #EEF0F5' }}>
            <h2 id="model" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
              En çok talep edilen modeller · {gecerli.donem}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#5A6073' }}>
              Uygun araç: aynı seriden, galeri portföylerinde yayında olan araç sayısı. {veri.aramaNotu}
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '34px minmax(0, 2.4fr) repeat(3, minmax(0, 1fr)) minmax(0, 1.3fr)',
              gap: 8,
              padding: '10px 18px',
              background: '#F3F5FA',
              fontSize: 11.5,
              fontWeight: 800,
              color: '#5A6073',
              textTransform: 'uppercase',
              letterSpacing: 0.3,
            }}
          >
            <span>#</span>
            <span>Model</span>
            <span style={{ textAlign: 'right' }}>Talep</span>
            <span style={{ textAlign: 'right' }}>Arama</span>
            <span style={{ textAlign: 'right' }}>Uygun araç</span>
            <span>Durum</span>
          </div>
          {(veri.modeller as { sira: number }[]).length ? null : (
            <p style={{ margin: 0, padding: '12px 18px', fontSize: 13.5, color: '#5A6073' }}>
              Bu süzgeçte talep yok.
            </p>
          )}
          {(
            veri.modeller as {
              sira: number;
              ad: string;
              talep: number;
              arama: number | null;
              arac: number;
              durum: string;
              bg: string;
              fg: string;
            }[]
          ).map((m) => (
            <div
              key={m.sira}
              style={{
                display: 'grid',
                gridTemplateColumns: '34px minmax(0, 2.4fr) repeat(3, minmax(0, 1fr)) minmax(0, 1.3fr)',
                gap: 8,
                alignItems: 'center',
                padding: '11px 18px',
                borderTop: '1px solid #EEF0F5',
                fontSize: 13.5,
              }}
            >
              <span style={{ fontWeight: 800, color: '#5A6073' }}>{m.sira}</span>
              <span style={{ minWidth: 0, fontWeight: 800 }}>{m.ad}</span>
              <span style={{ textAlign: 'right', fontWeight: 700 }}>{sayi(m.talep)}</span>
              <span style={{ textAlign: 'right' }}>{m.arama === null ? '—' : sayi(m.arama)}</span>
              <span style={{ textAlign: 'right' }}>{sayi(m.arac)}</span>
              <span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: m.bg,
                    color: m.fg,
                  }}
                >
                  {m.durum}
                </span>
              </span>
            </div>
          ))}
          <p
            style={{
              margin: 0,
              padding: '12px 18px',
              fontSize: 13,
              lineHeight: 1.5,
              color: '#2E3344',
              background: '#F6F8FD',
            }}
          >
            <strong>Ajan:</strong> {gecerli.yorum}
          </p>
        </section>
      ) : null}

      {gecerli && sekme === 'reklam' && veri ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 10,
              marginBottom: 14,
            }}
          >
            {(veri.reklamSayilar as { ad: string; deger: string; not: string }[]).map((x) => (
              <div key={x.ad} style={{ ...kart, borderRadius: 16, padding: 14 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5A6073' }}>{x.ad}</div>
                <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4 }}>{x.deger}</div>
                <div style={{ fontSize: 12, color: '#5A6073', marginTop: 3 }}>{x.not}</div>
              </div>
            ))}
          </div>
          <section aria-labelledby="kampanya" style={{ ...kart, overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: 8,
                padding: '16px 18px',
                borderBottom: '1px solid #EEF0F5',
              }}
            >
              <h2 id="kampanya" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                Kanal ve kampanya
              </h2>
              <span style={{ fontSize: 12.5, color: '#5A6073' }}>{veri.cekimNotu}</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 2.6fr) repeat(6, minmax(0, 1fr))',
                gap: 8,
                padding: '10px 18px',
                background: '#F3F5FA',
                fontSize: 11.5,
                fontWeight: 800,
                color: '#5A6073',
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
            >
              <span>Kampanya</span>
              {['Harcama', 'Üyelik', 'Talep', 'Yeni galeri', 'Üye başı', 'Getiri'].map((k) => (
                <span key={k} style={{ textAlign: 'right' }}>
                  {k}
                </span>
              ))}
            </div>
            {(veri.kampanyalar as unknown[]).length ? null : (
              <p style={{ margin: 0, padding: '12px 18px', fontSize: 13.5, color: '#5A6073' }}>
                Bu dönemde yeni üye ve reklam harcaması yok.
              </p>
            )}
            {(
              veri.kampanyalar as {
                ad: string;
                kanal: string;
                harcama: string;
                uye: string;
                talep: string;
                galeri: string;
                uyeBasi: string;
                getiri: string;
              }[]
            ).map((k) => (
              <div
                key={`${k.kanal}|${k.ad}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 2.6fr) repeat(6, minmax(0, 1fr))',
                  gap: 8,
                  alignItems: 'center',
                  padding: '12px 18px',
                  borderTop: '1px solid #EEF0F5',
                  fontSize: 13.5,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 800, overflowWrap: 'anywhere' }}>{k.ad}</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#5A6073' }}>{k.kanal}</span>
                </span>
                <span style={{ textAlign: 'right', fontWeight: 700 }}>{k.harcama}</span>
                <span style={{ textAlign: 'right' }}>{k.uye}</span>
                <span style={{ textAlign: 'right' }}>{k.talep}</span>
                <span style={{ textAlign: 'right' }}>{k.galeri}</span>
                <span style={{ textAlign: 'right' }}>{k.uyeBasi}</span>
                <span style={{ textAlign: 'right', fontWeight: 800 }}>{k.getiri}</span>
              </div>
            ))}
            {gecerli.yorum ? (
              <p
                style={{
                  margin: 0,
                  padding: '12px 18px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: '#2E3344',
                  background: '#F6F8FD',
                }}
              >
                <strong>Ajan:</strong> {gecerli.yorum}
              </p>
            ) : null}
          </section>
          <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#5A6073' }}>
            Getiri: kampanyadan gelen kullanıcıların 30 günlük ödemesi ÷ harcama. Üyeler ilk temaslarının
            kampanyasına bağlanır. Dönüşümler sunucu tarafından, ölçüme izin veren kullanıcılar için
            gönderilir (Karar 35).
          </p>
          <section aria-labelledby="kanal" style={{ ...kart, overflow: 'hidden', marginTop: 14 }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #EEF0F5' }}>
              <h2 id="kanal" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                Kanal kırılımı · {gecerli.donem}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#5A6073' }}>
                Reklam: tıklama kimliği ya da ücretli UTM. Bildirim ve e-posta: kendi iletilerimiz. Organik:
                gerisi.
              </p>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 2fr) repeat(4, minmax(0, 1fr))',
                gap: 8,
                padding: '10px 18px',
                background: '#F3F5FA',
                fontSize: 11.5,
                fontWeight: 800,
                color: '#5A6073',
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
            >
              <span>Kanal</span>
              {['Üyelik', 'Talep', 'Yeni galeri', '30 günlük ödeme'].map((k) => (
                <span key={k} style={{ textAlign: 'right' }}>
                  {k}
                </span>
              ))}
            </div>
            {(
              veri.kanallar as {
                kanal: string;
                ad: string;
                uye: number;
                talep: number;
                galeri: number;
                odeme: string;
              }[]
            ).map((k) => (
              <div
                key={k.kanal}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 2fr) repeat(4, minmax(0, 1fr))',
                  gap: 8,
                  padding: '12px 18px',
                  borderTop: '1px solid #EEF0F5',
                  fontSize: 13.5,
                }}
              >
                <span style={{ fontWeight: 800 }}>{k.ad}</span>
                <span style={{ textAlign: 'right' }}>{sayi(k.uye)}</span>
                <span style={{ textAlign: 'right' }}>{sayi(k.talep)}</span>
                <span style={{ textAlign: 'right' }}>{sayi(k.galeri)}</span>
                <span style={{ textAlign: 'right', fontWeight: 700 }}>{k.odeme}</span>
              </div>
            ))}
          </section>
        </>
      ) : null}

      {gecerli && sekme === 'birim' && veri ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 10,
              marginBottom: 14,
            }}
          >
            {(veri.sayilar as { ad: string; deger: string; not: string }[]).map((s) =>
              kucukKart(s.ad, s.deger, s.not),
            )}
          </div>
          <section aria-labelledby="kohort" style={{ ...kart, padding: '18px 20px' }}>
            <h2 id="kohort" style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>
              Ücretli galeri tutma · kohort
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#5A6073' }}>
              Her satır o ay ücretliye geçen galeriler; hücreler sonraki aylarda hâlâ ödeyenlerin oranı.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '130px repeat(5, minmax(0, 1fr))',
                gap: 2,
                fontSize: 13,
              }}
            >
              <span />
              {(veri.kohortBaslik as string[]).map((b) => (
                <span key={b} style={{ padding: 6, textAlign: 'center', fontWeight: 800, color: '#5A6073' }}>
                  {b}
                </span>
              ))}
              {(
                veri.kohort as {
                  ay: string;
                  adet: number;
                  hucre: { v: number | null; adim: number; ipucu: string }[];
                }[]
              ).flatMap((k) => [
                <span key={k.ay} style={{ padding: '10px 6px', fontWeight: 700 }}>
                  {k.ay}
                  <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#5A6073' }}>
                    {k.adet} galeri
                  </span>
                </span>,
                ...k.hucre.map((h, i) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: ay sütunları sabit
                    key={`${k.ay}${i}`}
                    title={h.ipucu}
                    style={{
                      padding: '10px 4px',
                      textAlign: 'center',
                      fontWeight: 800,
                      borderRadius: 6,
                      background: h.adim < 0 ? 'transparent' : HEAT_RAMP[h.adim],
                      color: h.adim >= 3 ? '#FFFFFF' : '#1E2333',
                    }}
                  >
                    {h.v === null ? '' : `%${h.v}`}
                  </span>
                )),
              ])}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
