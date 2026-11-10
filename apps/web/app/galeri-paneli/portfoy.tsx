'use client';

import { BULK_COLUMNS } from '@rengarenk/shared';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { API, ApiHatasi, binlik, erisim, istek, yenile } from '../../lib/istemci';

export interface PortfoyListesi {
  sinir: number | null;
  aktif: number;
  toplu: boolean;
  api: boolean;
  araclar: {
    id: string;
    no: number;
    ad: string;
    detay: string;
    fiyat: number;
    durum: string;
    durumAd: string;
    not: string | null;
    eids: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    foto: string | null;
    fotoSayisi: number;
    duzenlenebilir: boolean;
    /** Yayındaki aracın açık eşleşme sayısı (GaleriPanel.dc.html: "3 talep") */
    eslesme: number | null;
  }[];
}

const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0', '#F3EFFF', '#FFF0EA'];
const EIDS: Record<string, [string, string, string]> = {
  APPROVED: ['Doğrulandı', '#E7FAF0', '#11683F'],
  PENDING: ['Bekliyor', '#FFF6DF', '#7A5300'],
  REJECTED: ['Reddedildi', '#FDECEC', '#A3271F'],
};
const ikincil: CSSProperties = {
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
  padding: '11px 16px',
  fontSize: 14.5,
  fontWeight: 700,
  color: 'var(--rr-murekkep, #1E2333)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const birincil: CSSProperties = {
  ...ikincil,
  border: 0,
  background: 'var(--rr-mavi, #5B8CFF)',
  fontWeight: 800,
  padding: '12px 18px',
};

/** Portföy listesi (GaleriPanel.dc.html › Portföy) */
export function Portfoy({
  accountId,
  ekle,
  duzenle,
  toplu,
  bildir,
}: {
  accountId: string;
  ekle: () => void;
  duzenle: (id: string) => void;
  toplu: () => void;
  bildir: (m: string) => void;
}) {
  const [l, setL] = useState<PortfoyListesi | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const base = `/gallery/${accountId}/portfolio`;
  const yukle = useCallback(() => {
    istek<PortfoyListesi>(base)
      .then(setL)
      .catch((e: Error) => setHata(e.message));
  }, [base]);
  useEffect(yukle, [yukle]);

  async function islem(id: string, yol: string, mesaj: string) {
    try {
      await istek(`${base}/${id}/${yol}`, { method: 'POST' });
      bildir(mesaj);
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }

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
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Portföy</h1>
          <p style={{ margin: '3px 0 0', fontSize: 14.5, color: '#5A6073' }}>
            {l ? `${l.aktif} / ${l.sinir ?? 'sınırsız'} araç` : '…'} · Alıcılara yalnızca EİDS doğrulanmış
            araçlar görünür
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {l?.toplu ? (
            <button type="button" onClick={toplu} style={ikincil}>
              Toplu yükle
            </button>
          ) : null}
          <button type="button" onClick={ekle} style={birincil}>
            + Araç ekle
          </button>
        </div>
      </div>
      {hata ? (
        <p
          role="alert"
          style={{
            margin: '0 0 14px',
            background: '#FFF0EE',
            borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
            padding: '10px 14px',
            fontSize: 14,
            color: '#A3271F',
          }}
        >
          {hata}
        </p>
      ) : null}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--rr-cizgi, #E3E6EF)',
          borderRadius: 'var(--rr-kart-kose)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 14,
            padding: '12px 18px',
            background: '#F3F5FA',
            fontSize: 12.5,
            fontWeight: 700,
            color: '#5A6073',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          <span style={{ flex: '999 1 260px' }}>Araç</span>
          <span style={{ flex: '1 1 110px' }}>Fiyat</span>
          <span style={{ flex: '1 1 130px' }}>EİDS</span>
          <span style={{ flex: '1 1 90px' }}>Eşleşme</span>
          <span style={{ flex: '1 1 90px' }}>Durum</span>
          <span style={{ flex: '0 0 70px' }} />
        </div>
        {l && l.araclar.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: '28px 18px',
              borderTop: '1px solid #EEF0F5',
              textAlign: 'center',
              color: '#5A6073',
            }}
          >
            Portföyünde henüz araç yok. “+ Araç ekle” ile başla.
          </p>
        ) : null}
        {(l?.araclar ?? []).map((p, i) => {
          const e = p.eids ? EIDS[p.eids] : null;
          return (
            <div
              key={p.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '10px 14px',
                padding: '12px 18px',
                borderTop: '1px solid #EEF0F5',
                opacity: p.durum === 'SOLD' ? 0.6 : 1,
              }}
            >
              <span
                style={{ flex: '999 1 260px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <span
                  style={{
                    width: 72,
                    height: 48,
                    borderRadius: 10,
                    background: TINTS[i % TINTS.length],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 'none',
                    overflow: 'hidden',
                  }}
                >
                  {p.foto ? (
                    // biome-ignore lint/performance/noImgElement: galeri fotoğrafı API'den akar
                    <img
                      src={`${API}${p.foto}`}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      style={{
                        width: 60,
                        maxWidth: '100%',
                        aspectRatio: '60 / 22',
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #C9D3E6, #EEF1F7)',
                      }}
                    />
                  )}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800 }}>{p.ad}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
                    {p.detay}
                    {p.durum === 'DRAFT' ? ` · ${p.fotoSayisi} fotoğraf` : ''}
                  </span>
                </span>
              </span>
              <span style={{ flex: '1 1 110px', fontSize: 14.5, fontWeight: 800 }}>{binlik(p.fiyat)} TL</span>
              <span style={{ flex: '1 1 130px' }}>
                {e ? (
                  <span
                    title={p.not ?? ''}
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 'var(--rr-etiket-kose)',
                      background: e[1],
                      color: e[2],
                    }}
                  >
                    {e[0]}
                  </span>
                ) : (
                  <span style={{ fontSize: 13, color: '#5A6073' }}>—</span>
                )}
              </span>
              <span style={{ flex: '1 1 90px', fontSize: 14, fontWeight: 700 }}>
                {typeof p.eslesme === 'number' ? `${p.eslesme} talep` : '—'}
              </span>
              <span style={{ flex: '1 1 90px', fontSize: 13.5, color: '#3A4052' }}>{p.durumAd}</span>
              <span
                style={{
                  flex: '0 0 70px',
                  textAlign: 'right',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 4,
                }}
              >
                {p.duzenlenebilir && p.durum !== 'SOLD' ? (
                  <button
                    type="button"
                    onClick={() => duzenle(p.id)}
                    style={{
                      border: 0,
                      background: 'transparent',
                      padding: 0,
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: 'var(--rr-baglanti, #2450C8)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Düzenle
                  </button>
                ) : null}
                {p.duzenlenebilir && p.durum === 'PUBLISHED' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => islem(p.id, 'passivate', 'Araç pasife alındı.')}
                      style={{
                        border: 0,
                        background: 'transparent',
                        padding: 0,
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: '#5A6073',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Pasife al
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        window.confirm('Araç satıldı olarak işaretlensin mi? Alıcılardan hemen kalkar.') &&
                        islem(p.id, 'sold', 'Araç satıldı; alıcılardan kaldırıldı.')
                      }
                      style={{
                        border: 0,
                        background: 'transparent',
                        padding: 0,
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: '#A3271F',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Satıldı
                    </button>
                  </>
                ) : null}
                {p.duzenlenebilir && p.durum === 'PASSIVE' ? (
                  <button
                    type="button"
                    onClick={() => islem(p.id, 'activate', 'Araç yeniden yayında.')}
                    style={{
                      border: 0,
                      background: 'transparent',
                      padding: 0,
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: '#11683F',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Yayına al
                  </button>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

interface Onizleme {
  toplam: number;
  hazir: number;
  yeni: number;
  guncelleme: number;
  kapasite: number | null;
  hatalar: { satir: number; arac: string; hata: string; aksiyon: string }[];
  /** Toplu yükleme yardımı (Karar 42; anahtar açıksa) */
  asistan: { baglanan: number; aciklama: number } | null;
  bilgiler: { satir: number; arac: string; not: string }[];
}

/** Dosyayı ham gövdeyle gönderir; yanıt JSON ya da dosya */
async function dosyaGonder(path: string, f: File, indir?: string) {
  const tur = f.name.toLowerCase().endsWith('.csv')
    ? 'text/csv'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const gonder = (t: string | null) =>
    fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'content-type': tur, ...(t ? { authorization: `Bearer ${t}` } : {}) },
      body: f,
    });
  let r = await gonder(await erisim());
  if (r.status === 401) r = await gonder(await yenile());
  if (!r.ok) {
    const b = (await r.json().catch(() => ({}))) as { message?: string };
    throw new ApiHatasi(b.message ?? 'Dosya işlenemedi', r.status, {});
  }
  if (indir) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await r.blob());
    a.download = indir;
    a.click();
    return null;
  }
  return r.json();
}

/** Toplu yükleme (GaleriPanel.dc.html) ve API entegrasyonu (Karar 07.3; tasarıma ek bölüm) */
export function TopluYukleme({
  accountId,
  bitti,
  api,
}: {
  accountId: string;
  bitti: (m: string) => void;
  api: boolean;
}) {
  const [dosya, setDosya] = useState<File | null>(null);
  const [on, setOn] = useState<Onizleme | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const base = `/gallery/${accountId}/portfolio`;

  async function sablon() {
    const t = await erisim();
    const r = await fetch(`${API}${base}/template`, { headers: t ? { authorization: `Bearer ${t}` } : {} });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await r.blob());
    a.download = 'rengarenk_portfoy_sablonu.xlsx';
    a.click();
  }

  async function sec(f: File) {
    setDosya(f);
    setOn(null);
    setHata(null);
    setBusy(true);
    try {
      setOn((await dosyaGonder(`${base}/bulk?onizle=1`, f)) as Onizleme);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const adim = (n: number, ad: string, durum: 'tamam' | 'simdi' | 'sonra', alt: React.ReactNode) => (
    <li
      style={{
        background: durum === 'simdi' ? '#EEF3FF' : '#FFFFFF',
        border:
          durum === 'simdi' ? '2px solid var(--rr-mavi, #5B8CFF)' : '1px solid var(--rr-cizgi, #E3E6EF)',
        borderRadius: 16,
        padding: durum === 'simdi' ? 15 : 16,
      }}
    >
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 800,
          color:
            durum === 'tamam' ? '#11683F' : durum === 'simdi' ? 'var(--rr-baglanti, #2450C8)' : '#5A6073',
        }}
      >
        {n} · {durum === 'tamam' ? 'Tamamlandı' : durum === 'simdi' ? 'Şimdi' : 'Sırada'}
      </span>
      <span style={{ display: 'block', fontSize: 15, fontWeight: 800, marginTop: 4 }}>{ad}</span>
      <span style={{ display: 'block', fontSize: 13.5, color: '#3A4052', marginTop: 6 }}>{alt}</span>
    </li>
  );

  return (
    <>
      <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>Toplu yükleme</h1>
      <p style={{ margin: '0 0 18px', fontSize: 14.5, color: '#5A6073' }}>
        Excel veya CSV dosyanla stokunu tek seferde aktar.
      </p>
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.csv"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) sec(f);
        }}
      />
      <ol className="rr-uc-sutun" style={{ listStyle: 'none', margin: '0 0 16px', padding: 0 }}>
        {adim(
          1,
          'Şablonu indir',
          'tamam',
          <button
            type="button"
            onClick={sablon}
            style={{
              border: 0,
              background: 'transparent',
              padding: 0,
              fontSize: 13.5,
              fontWeight: 700,
              color: 'var(--rr-baglanti, #2450C8)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            rengarenk_portfoy_sablonu.xlsx
          </button>,
        )}
        {adim(
          2,
          'Dosyayı yükle',
          dosya ? 'tamam' : 'simdi',
          <button
            type="button"
            onClick={() => ref.current?.click()}
            style={{
              border: 0,
              background: 'transparent',
              padding: 0,
              fontSize: 13.5,
              fontWeight: 700,
              color: dosya ? '#3A4052' : 'var(--rr-baglanti, #2450C8)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            {busy
              ? 'İnceleniyor…'
              : dosya
                ? `${dosya.name}${on ? ` · ${on.toplam} satır` : ''}`
                : 'Excel ya da CSV seç'}
          </button>,
        )}
        {adim(
          3,
          'Önizle ve onayla',
          on ? 'simdi' : 'sonra',
          on
            ? `${on.hazir} satır hazır${on.hatalar.length ? `, ${on.hatalar.length} satırda düzeltme gerekiyor` : ''}`
            : 'Dosya yüklenince',
        )}
      </ol>
      {hata ? (
        <p
          role="alert"
          style={{
            margin: '0 0 14px',
            background: '#FFF0EE',
            borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
            padding: '10px 14px',
            fontSize: 14,
            color: '#A3271F',
          }}
        >
          {hata}
        </p>
      ) : null}
      {on?.asistan && (on.asistan.baglanan || on.asistan.aciklama) ? (
        <details
          style={{
            margin: '0 0 14px',
            border: '1.5px solid #C9B8FF',
            background: '#FAF7FF',
            borderRadius: 'var(--rr-buton-kose)',
            padding: '10px 14px',
            fontSize: 13.5,
            color: 'var(--rr-murekkep, #1E2333)',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 800, color: '#4B2FA6' }}>
            ✦ Asistan{' '}
            {[
              on.asistan.baglanan ? `${on.asistan.baglanan} satırdaki araç adını kataloğa bağladı` : null,
              on.asistan.aciklama ? `${on.asistan.aciklama} araca açıklama taslağı yazdı` : null,
            ]
              .filter(Boolean)
              .join(', ')}
            . Aktarmadan önce kontrol et.
          </summary>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.55, color: '#3A4052' }}>
            {on.bilgiler.map((b) => (
              <li key={b.satir}>
                Satır {b.satir}: {b.not}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {on ? (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--rr-cizgi, #E3E6EF)',
            borderRadius: 'var(--rr-kart-kose)',
            overflow: 'hidden',
          }}
        >
          {on.hatalar.length ? (
            <>
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid #EEF0F5',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Düzeltme gereken satırlar</h2>
                <button
                  type="button"
                  onClick={() =>
                    dosya &&
                    dosyaGonder(`${base}/bulk/report`, dosya, 'portfoy_hata_raporu.xlsx').catch((e: Error) =>
                      setHata(e.message),
                    )
                  }
                  style={{
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--rr-baglanti, #2450C8)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Hata raporunu indir
                </button>
              </div>
              {on.hatalar.map((h) => (
                <div
                  key={h.satir}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '8px 16px',
                    padding: '12px 18px',
                    borderBottom: '1px solid #EEF0F5',
                  }}
                >
                  <span style={{ flex: '0 0 72px', fontSize: 13.5, fontWeight: 800, color: '#5A6073' }}>
                    Satır {h.satir}
                  </span>
                  <span style={{ flex: '1 1 200px', fontSize: 14, fontWeight: 700 }}>{h.arac}</span>
                  <span style={{ flex: '2 1 260px', fontSize: 13.5, color: '#A3271F', fontWeight: 600 }}>
                    {h.hata}
                  </span>
                  <span style={{ flex: 'none', fontSize: 13, fontWeight: 700, color: '#5A6073' }}>
                    {h.aksiyon} (dosyada)
                  </span>
                </div>
              ))}
            </>
          ) : null}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              padding: '16px 18px',
              background: 'var(--rr-zemin, #F6F8FD)',
            }}
          >
            <span style={{ fontSize: 14, color: '#3A4052' }}>
              {on.hatalar.length ? 'Hatalı satırlar düzeltilmeden de hazır olanlar aktarılabilir. ' : ''}
              {on.guncelleme ? `${on.guncelleme} araç stok numarasıyla güncellenecek. ` : ''}
              {on.kapasite !== null && on.yeni > on.kapasite
                ? `Paket sınırı nedeniyle en çok ${Math.max(0, on.kapasite)} yeni araç eklenir. `
                : ''}
              Aktarılan araçlar taslak olur; fotoğrafları ekleyip EİDS'e gönder.
            </span>
            <button
              type="button"
              disabled={!on.hazir || busy}
              onClick={async () => {
                if (!dosya) return;
                setBusy(true);
                try {
                  const r = (await dosyaGonder(`${base}/bulk`, dosya)) as {
                    eklendi: number;
                    guncellendi: number;
                  };
                  bitti(
                    `${r.eklendi} araç eklendi${r.guncellendi ? `, ${r.guncellendi} araç güncellendi` : ''}.`,
                  );
                } catch (e) {
                  setHata((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
              style={birincil}
            >
              {on.hazir} aracı içe aktar
            </button>
          </div>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: '#5A6073' }}>
          Sütunlar: {BULK_COLUMNS.map(([b]) => b).join(', ')}. Marka, seri, model ve paket katalogdaki adlarla
          yazılır.
        </p>
      )}
      <ApiAnahtarlari accountId={accountId} acik={api} />
    </>
  );
}

function ApiAnahtarlari({ accountId, acik }: { accountId: string; acik: boolean }) {
  const [l, setL] = useState<
    { id: string; ad: string; onek: string; sonKullanim: string | null; iptal: string | null }[]
  >([]);
  const [yeni, setYeni] = useState<string | null>(null);
  const [ad, setAd] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const base = `/gallery/${accountId}/portfolio/api-keys`;
  const yukle = useCallback(() => {
    if (acik)
      istek<typeof l>(base)
        .then(setL)
        .catch(() => undefined);
  }, [acik, base]);
  useEffect(yukle, [yukle]);
  return (
    <section
      style={{
        marginTop: 22,
        background: '#FFFFFF',
        border: '1px solid var(--rr-cizgi, #E3E6EF)',
        borderRadius: 'var(--rr-kart-kose)',
        padding: 20,
      }}
      aria-labelledby="api"
    >
      <h2 id="api" style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>
        API entegrasyonu
      </h2>
      {!acik ? (
        <p style={{ margin: 0, fontSize: 13.5, color: '#5A6073' }}>
          Stok sisteminden otomatik aktarım Kurumsal pakettedir.
        </p>
      ) : (
        <>
          <p style={{ margin: '0 0 12px', fontSize: 13.5, color: '#5A6073' }}>
            Stok sistemin <code>PUT {API}/entegrasyon/v1/araclar/&lt;stok no&gt;</code> ile araç ekler ve
            günceller;
            <code> POST …/satildi</code> satılan aracı kaldırır. Anahtar yalnızca oluşturulurken bir kez
            gösterilir.
          </p>
          {yeni ? (
            <p
              style={{
                margin: '0 0 12px',
                background: '#E7FAF0',
                borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
                padding: '10px 14px',
                fontSize: 13.5,
                color: '#11683F',
                wordBreak: 'break-all',
              }}
            >
              Yeni anahtar: <strong>{yeni}</strong>
            </p>
          ) : null}
          {hata ? (
            <p role="alert" style={{ margin: '0 0 12px', color: '#A3271F', fontSize: 13.5 }}>
              {hata}
            </p>
          ) : null}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const r = await istek<{ anahtar: string }>(base, { method: 'POST', body: { ad } });
                setYeni(r.anahtar);
                setAd('');
                yukle();
              } catch (err) {
                setHata((err as Error).message);
              }
            }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}
          >
            <input
              aria-label="Anahtar adı"
              placeholder="Ör. Stok sistemi"
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              style={{
                flex: '1 1 220px',
                border: '1px solid #D5DAE5',
                borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
                padding: '10px 12px',
                fontSize: 14.5,
                fontFamily: 'inherit',
              }}
            />
            <button type="submit" disabled={ad.trim().length < 2} style={birincil}>
              Anahtar oluştur
            </button>
          </form>
          {l.map((k) => (
            <div
              key={k.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '6px 16px',
                padding: '10px 0',
                borderTop: '1px solid #EEF0F5',
                fontSize: 14,
                opacity: k.iptal ? 0.55 : 1,
              }}
            >
              <span style={{ flex: '1 1 180px', fontWeight: 700 }}>{k.ad}</span>
              <code style={{ flex: '0 0 auto' }}>{k.onek}…</code>
              <span style={{ flex: '1 1 160px', color: '#5A6073', fontSize: 13 }}>
                {k.iptal
                  ? 'İptal edildi'
                  : k.sonKullanim
                    ? `Son kullanım ${new Date(k.sonKullanim).toLocaleString('tr-TR')}`
                    : 'Henüz kullanılmadı'}
              </span>
              {k.iptal ? null : (
                <button
                  type="button"
                  onClick={() =>
                    istek(`${base}/${k.id}`, { method: 'DELETE' })
                      .then(yukle)
                      .catch((e: Error) => setHata(e.message))
                  }
                  style={{
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: '#A3271F',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  İptal et
                </button>
              )}
            </div>
          ))}
        </>
      )}
    </section>
  );
}
