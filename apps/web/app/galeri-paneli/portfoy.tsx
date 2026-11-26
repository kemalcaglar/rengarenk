'use client';

import { BULK_COLUMNS } from '@rengarenk/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cx } from '../../lib/cx';
import { API, ApiHatasi, binlik, erisim, istek, yenile } from '../../lib/istemci';
import stil from './portfoy.module.css';

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
      <div className={stil.kutu1}>
        <div>
          <h1 className={stil.baslik1}>Portföy</h1>
          <p className={stil.metin1}>
            {l ? `${l.aktif} / ${l.sinir ?? 'sınırsız'} araç` : '…'} · Alıcılara yalnızca EİDS doğrulanmış
            araçlar görünür
          </p>
        </div>
        <div className={stil.kutu2}>
          {l?.toplu ? (
            <button type="button" onClick={toplu} className={stil.dugme1}>
              Toplu yükle
            </button>
          ) : null}
          <button type="button" onClick={ekle} className={stil.dugme2}>
            + Araç ekle
          </button>
        </div>
      </div>
      {hata ? (
        <p role="alert" className={stil.metin2}>
          {hata}
        </p>
      ) : null}
      <div className={stil.kutu3}>
        <div className={stil.kutu4}>
          <span className={stil.metin3}>Araç</span>
          <span className={stil.metin4}>Fiyat</span>
          <span className={stil.metin5}>EİDS</span>
          <span className={stil.metin6}>Eşleşme</span>
          <span className={stil.metin6}>Durum</span>
          <span className={stil.metin7} />
        </div>
        {l && l.araclar.length === 0 ? (
          <p className={stil.metin8}>Portföyünde henüz araç yok. “+ Araç ekle” ile başla.</p>
        ) : null}
        {(l?.araclar ?? []).map((p, i) => {
          const e = p.eids ? EIDS[p.eids] : null;
          return (
            <div key={p.id} className={cx(stil.kutu5, p.durum === 'SOLD' ? stil.kutu6 : stil.kutu7)}>
              <span className={stil.metin9}>
                <span className={stil.metin10} style={{ background: TINTS[i % TINTS.length] }}>
                  {p.foto ? (
                    // biome-ignore lint/performance/noImgElement: galeri fotoğrafı API'den akar
                    <img src={`${API}${p.foto}`} alt="" className={stil.gorsel1} />
                  ) : (
                    <span aria-hidden="true" className={stil.metin11} />
                  )}
                </span>
                <span className={stil.metin12}>
                  <span className={stil.metin13}>{p.ad}</span>
                  <span className={stil.metin14}>
                    {p.detay}
                    {p.durum === 'DRAFT' ? ` · ${p.fotoSayisi} fotoğraf` : ''}
                  </span>
                </span>
              </span>
              <span className={stil.metin15}>{binlik(p.fiyat)} TL</span>
              <span className={stil.metin5}>
                {e ? (
                  <span
                    title={p.not ?? ''}
                    className={stil.metin16}
                    style={{ background: e[1], color: e[2] }}
                  >
                    {e[0]}
                  </span>
                ) : (
                  <span className={stil.metin17}>—</span>
                )}
              </span>
              <span className={stil.metin18}>
                {typeof p.eslesme === 'number' ? `${p.eslesme} talep` : '—'}
              </span>
              <span className={stil.metin19}>{p.durumAd}</span>
              <span className={stil.metin20}>
                {p.duzenlenebilir && p.durum !== 'SOLD' ? (
                  <button type="button" onClick={() => duzenle(p.id)} className={stil.dugme3}>
                    Düzenle
                  </button>
                ) : null}
                {p.duzenlenebilir && p.durum === 'PUBLISHED' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => islem(p.id, 'passivate', 'Araç pasife alındı.')}
                      className={stil.dugme4}
                    >
                      Pasife al
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        window.confirm('Araç satıldı olarak işaretlensin mi? Alıcılardan hemen kalkar.') &&
                        islem(p.id, 'sold', 'Araç satıldı; alıcılardan kaldırıldı.')
                      }
                      className={stil.dugme5}
                    >
                      Satıldı
                    </button>
                  </>
                ) : null}
                {p.duzenlenebilir && p.durum === 'PASSIVE' ? (
                  <button
                    type="button"
                    onClick={() => islem(p.id, 'activate', 'Araç yeniden yayında.')}
                    className={stil.dugme6}
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
    <li className={cx(stil.oge1, durum === 'simdi' ? stil.oge2 : stil.oge3)}>
      <span
        className={stil.metin21}
        style={{
          color:
            durum === 'tamam'
              ? '#11683F'
              : durum === 'simdi'
                ? 'var(--rr-baglanti, #2450C8)'
                : 'var(--rr-soluk, #5A6073)',
        }}
      >
        {n} · {durum === 'tamam' ? 'Tamamlandı' : durum === 'simdi' ? 'Şimdi' : 'Sırada'}
      </span>
      <span className={stil.metin22}>{ad}</span>
      <span className={stil.metin23}>{alt}</span>
    </li>
  );

  return (
    <>
      <h1 className={stil.baslik2}>Toplu yükleme</h1>
      <p className={stil.metin24}>Excel veya CSV dosyanla stokunu tek seferde aktar.</p>
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
      <ol className={`rr-uc-sutun ${stil.liste1}`}>
        {adim(
          1,
          'Şablonu indir',
          'tamam',
          <button type="button" onClick={sablon} className={stil.dugme3}>
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
            className={cx(stil.dugme7, dosya ? stil.dugme8 : stil.dugme9)}
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
        <p role="alert" className={stil.metin2}>
          {hata}
        </p>
      ) : null}
      {on?.asistan && (on.asistan.baglanan || on.asistan.aciklama) ? (
        <details className={stil.kutu8}>
          <summary className={stil.metin25}>
            ✦ Asistan{' '}
            {[
              on.asistan.baglanan ? `${on.asistan.baglanan} satırdaki araç adını kataloğa bağladı` : null,
              on.asistan.aciklama ? `${on.asistan.aciklama} araca açıklama taslağı yazdı` : null,
            ]
              .filter(Boolean)
              .join(', ')}
            . Aktarmadan önce kontrol et.
          </summary>
          <ul className={stil.liste2}>
            {on.bilgiler.map((b) => (
              <li key={b.satir}>
                Satır {b.satir}: {b.not}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {on ? (
        <div className={stil.kutu3}>
          {on.hatalar.length ? (
            <>
              <div className={stil.kutu9}>
                <h2 className={stil.baslik3}>Düzeltme gereken satırlar</h2>
                <button
                  type="button"
                  onClick={() =>
                    dosya &&
                    dosyaGonder(`${base}/bulk/report`, dosya, 'portfoy_hata_raporu.xlsx').catch((e: Error) =>
                      setHata(e.message),
                    )
                  }
                  className={stil.dugme3}
                >
                  Hata raporunu indir
                </button>
              </div>
              {on.hatalar.map((h) => (
                <div key={h.satir} className={stil.kutu10}>
                  <span className={stil.metin26}>Satır {h.satir}</span>
                  <span className={stil.metin27}>{h.arac}</span>
                  <span className={stil.metin28}>{h.hata}</span>
                  <span className={stil.metin29}>{h.aksiyon} (dosyada)</span>
                </div>
              ))}
            </>
          ) : null}
          <div className={stil.kutu11}>
            <span className={stil.metin30}>
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
              className={stil.dugme2}
            >
              {on.hazir} aracı içe aktar
            </button>
          </div>
        </div>
      ) : (
        <p className={stil.metin31}>
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
    <section className={stil.kutu12} aria-labelledby="api">
      <h2 id="api" className={stil.baslik4}>
        API entegrasyonu
      </h2>
      {!acik ? (
        <p className={stil.metin32}>Stok sisteminden otomatik aktarım Kurumsal pakettedir.</p>
      ) : (
        <>
          <p className={stil.metin33}>
            Stok sistemin <code>PUT {API}/entegrasyon/v1/araclar/&lt;stok no&gt;</code> ile araç ekler ve
            günceller;
            <code> POST …/satildi</code> satılan aracı kaldırır. Anahtar yalnızca oluşturulurken bir kez
            gösterilir.
          </p>
          {yeni ? (
            <p className={stil.metin34}>
              Yeni anahtar: <strong>{yeni}</strong>
            </p>
          ) : null}
          {hata ? (
            <p role="alert" className={stil.metin35}>
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
            className={stil.kutu13}
          >
            <input
              aria-label="Anahtar adı"
              placeholder="Ör. Stok sistemi"
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              className={stil.girdi1}
            />
            <button type="submit" disabled={ad.trim().length < 2} className={stil.dugme2}>
              Anahtar oluştur
            </button>
          </form>
          {l.map((k) => (
            <div key={k.id} className={cx(stil.kutu14, k.iptal ? stil.kutu15 : stil.kutu7)}>
              <span className={stil.metin36}>{k.ad}</span>
              <code className={stil.metin37}>{k.onek}…</code>
              <span className={stil.metin38}>
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
                  className={stil.dugme10}
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
