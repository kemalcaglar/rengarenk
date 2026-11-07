'use client';

import { VEHICLE_CATEGORIES } from '@rengarenk/shared';
import { type ChangeEvent, useCallback, useEffect, useState } from 'react';
import { tarih, yonetim } from '../../../lib/istemci';
import { Switch } from '../switch';

interface Source {
  key: string;
  name: string;
  license: string;
  url: string | null;
  autoFetch: boolean;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastVersion: string | null;
  lastFileName: string | null;
  lastError: string | null;
  variants: number;
  variantsInLatest: number;
  stale: boolean;
}

interface Issue {
  kod: string;
  mesaj: string;
}

interface Import {
  id: string;
  version: string | null;
  fileName: string | null;
  trigger: string;
  status: 'APPLIED' | 'REJECTED' | 'FAILED' | 'SKIPPED';
  stats: {
    added?: number;
    updated?: number;
    missing?: number;
    items?: number;
    outOfScope?: number;
    neden?: string;
  };
  quality: { blocking?: Issue[]; warnings?: Issue[] };
  error: string | null;
  createdAt: string;
}

interface SeriesDetail {
  name: string;
  make: { name: string };
  years: number[];
  models: { id: string; name: string; years: number[] }[];
  bodies: { name: string; years: number[] }[];
  makyaj: { makyajsiz: number[]; makyajli: number[] };
  trims: { id: string; name: string; years: number[]; modelIds: string[] }[];
}

const STATUS: Record<Import['status'], [string, string, string]> = {
  APPLIED: ['Uygulandı', '#E7FAF0', '#11683F'],
  REJECTED: ['Durduruldu', '#FDECEC', '#A3271F'],
  FAILED: ['Hata', '#FDECEC', '#A3271F'],
  SKIPPED: ['Atlandı', '#F3F5FA', '#5A6073'],
};

const range = (ys: number[]) =>
  ys.length === 0 ? '—' : ys.length === 1 ? String(ys[0]) : `${ys[0]}–${ys[ys.length - 1]}`;
const sayi = (n: number | undefined) => new Intl.NumberFormat('tr-TR').format(n ?? 0);

async function katalog<T>(path: string): Promise<T> {
  const r = await fetch(`/api/katalog/${path}`);
  if (!r.ok) throw new Error('Katalog okunamadı');
  return (await r.json()) as T;
}

/**
 * Katalog kaynakları (Karar 33: konsoldaki katalog bölümü yalnızca izleme içindir; kimse elle veri girmez).
 * TSB dosyası iki yoldan girer: buradan yükleme ve otomatik çekme (sahip kararı, 7 Kasım 2026).
 */
export default function Katalog() {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [imports, setImports] = useState<Import[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    yonetim<Source[]>('catalog/sources')
      .then(setSources)
      .catch((e: Error) => setError(e.message));
    yonetim<Import[]>('catalog/imports?kaynak=tsb')
      .then(setImports)
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  async function run(fn: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await fn());
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    run(async () => {
      const res = await fetch('/api/yonetim/catalog/tsb/upload', {
        method: 'POST',
        headers: {
          'x-rr-istek': '1',
          'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'x-dosya-adi': encodeURIComponent(file.name),
        },
        body: file,
      });
      const data = (await res.json().catch(() => ({}))) as Partial<Import> & { message?: string };
      if (!res.ok) throw new Error(data.message ?? 'Dosya yüklenemedi');
      return `${file.name}: ${STATUS[data.status as Import['status']]?.[0] ?? data.status}`;
    });
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 className="k-h1">Katalog kaynakları</h1>
        <p className="k-sub">
          Katalog kaynaklardan kendiliğinden güncellenir; kalite kontrolünü geçmeyen dosya yayımlanmaz ve
          listeden düşen hiçbir araç silinmez (Karar 33). Kasko bedelleri hiçbir yerde saklanmaz.
        </p>
      </div>
      {error ? (
        <p className="k-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="k-note" role="status">
          {notice}
        </p>
      ) : null}

      {sources === null ? (
        <div className="k-panel k-empty">Yükleniyor…</div>
      ) : (
        sources.map((s) => {
          const [durum, bg, fg] =
            s.stale || s.lastError
              ? ['Uyarı', '#FFF6DF', '#7A5300']
              : s.lastSuccessAt
                ? ['Sağlıklı', '#E7FAF0', '#11683F']
                : ['Beklemede', '#EEF3FF', '#2450C8'];
          return (
            <section
              key={s.key}
              className="k-panel"
              style={{ padding: 18, marginBottom: 16 }}
              aria-label={s.name}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 800 }}>{s.name}</span>
                  <span style={{ display: 'block', fontSize: 13, color: '#5A6073', marginTop: 2 }}>
                    Katalog · ana kaynak · aylık dosya · {s.license}
                  </span>
                </span>
                <span className="k-pill" style={{ background: bg, color: fg }}>
                  {durum}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px 24px',
                  marginTop: 12,
                  fontSize: 13.5,
                  color: '#3A4052',
                }}
              >
                <span>Son başarılı: {tarih(s.lastSuccessAt)}</span>
                <span>Sürüm: {s.lastVersion ?? '—'}</span>
                <span>Dosya: {s.lastFileName ?? '—'}</span>
                <span>
                  Tip: {sayi(s.variantsInLatest)} son sürümde · {sayi(s.variants)} toplam
                </span>
                <span>Son kontrol: {tarih(s.lastCheckedAt)}</span>
              </div>
              {s.lastError ? (
                <p className="k-note" style={{ margin: '12px 0 0' }}>
                  Son deneme: {s.lastError}
                  {s.stale ? ' · 48 saattir güncellenemedi, sahibe uyarı gitti.' : ''}
                </p>
              ) : null}
              <div
                style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 14 }}
              >
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700 }}
                >
                  <Switch
                    on={s.autoFetch}
                    label="Otomatik çekme"
                    disabled={busy}
                    onChange={() =>
                      run(async () => {
                        await yonetim(`catalog/sources/${s.key}`, {
                          method: 'PATCH',
                          body: { autoFetch: !s.autoFetch },
                        });
                        return s.autoFetch
                          ? 'Otomatik çekme kapatıldı.'
                          : 'Otomatik çekme açıldı; 6 saatte bir yeni dosyaya bakılır.';
                      })
                    }
                  />
                  Otomatik çekme
                </span>
                {s.key === 'tsb' ? (
                  <>
                    <button
                      className="k-btn-line"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const r = await yonetim<{ durum: string }>('catalog/tsb/check', {
                            method: 'POST',
                            body: {},
                          });
                          const map: Record<string, string> = {
                            uygulandi: 'Yeni dosya indirildi ve kataloğa işlendi.',
                            yeni_dosya_yok: 'TSB’de yeni dosya yok.',
                            hata: 'TSB’ye ulaşılamadı; dosyayı buradan yükleyebilirsin.',
                            rejected: 'Yeni dosya kalite kontrolünü geçmedi, yayımlanmadı.',
                          };
                          return map[r.durum] ?? `Sonuç: ${r.durum}`;
                        })
                      }
                    >
                      Şimdi kontrol et
                    </button>
                    <label
                      className="k-btn"
                      style={{ fontSize: 14, padding: '10px 16px', opacity: busy ? 0.6 : 1 }}
                    >
                      {busy ? 'İşleniyor…' : 'Dosya yükle (.xlsx)'}
                      <input
                        type="file"
                        accept=".xlsx"
                        onChange={upload}
                        disabled={busy}
                        className="sr-only"
                      />
                    </label>
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 13.5 }}>
                        TSB sayfası
                      </a>
                    ) : null}
                  </>
                ) : null}
              </div>
            </section>
          );
        })
      )}

      <section className="k-panel" aria-labelledby="gecmis">
        <h2
          id="gecmis"
          style={{
            margin: 0,
            padding: '16px 18px',
            fontSize: 17,
            fontWeight: 800,
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          İçe aktarma geçmişi
        </h2>
        {imports.length === 0 ? (
          <div className="k-empty">Henüz içe aktarma yok.</div>
        ) : (
          imports.map((i) => {
            const [ad, bg, fg] = STATUS[i.status];
            const issues = [...(i.quality.blocking ?? []), ...(i.quality.warnings ?? [])];
            return (
              <div
                key={i.id}
                className="k-row"
                style={{ borderTop: 0, borderBottom: '1px solid #EEF0F5', alignItems: 'flex-start' }}
              >
                <span style={{ flex: '0 0 140px', fontSize: 13, color: '#5A6073', fontWeight: 600 }}>
                  {tarih(i.createdAt)}
                </span>
                <span style={{ flex: '999 1 320px', minWidth: 0 }}>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <span className="k-pill" style={{ background: bg, color: fg }}>
                      {ad}
                    </span>
                    <strong>{i.version ?? 'sürüm okunamadı'}</strong>
                    <span style={{ fontSize: 12.5, color: '#5A6073' }}>
                      {i.fileName ?? ''} · {i.trigger}
                    </span>
                  </span>
                  {i.status === 'APPLIED' ? (
                    <span style={{ display: 'block', fontSize: 12.5, color: '#3A4052', marginTop: 4 }}>
                      {sayi(i.stats.items)} tip · {sayi(i.stats.added)} yeni · {sayi(i.stats.updated)}{' '}
                      güncellendi · {sayi(i.stats.missing)} listeden düştü (silinmedi) ·{' '}
                      {sayi(i.stats.outOfScope)} kapsam dışı
                    </span>
                  ) : null}
                  {i.status === 'SKIPPED' ? (
                    <span style={{ display: 'block', fontSize: 12.5, color: '#3A4052', marginTop: 4 }}>
                      Aynı dosya daha önce işlendi.
                    </span>
                  ) : null}
                  {issues.map((q) => (
                    <span
                      key={q.kod + q.mesaj}
                      style={{ display: 'block', fontSize: 12.5, color: '#7A5300', marginTop: 4 }}
                    >
                      {q.mesaj}
                    </span>
                  ))}
                  {i.error ? (
                    <span style={{ display: 'block', fontSize: 12.5, color: '#A3271F', marginTop: 4 }}>
                      {i.error}
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })
        )}
      </section>

      <Gezgin />
    </>
  );
}

/** Kataloğu kontrol etmek için küçük bir gezgin: kategori → marka → seri → yıl. */
function Gezgin() {
  const [kategori, setKategori] = useState('otomobil');
  const [makes, setMakes] = useState<{ id: string; name: string }[]>([]);
  const [make, setMake] = useState('');
  const [series, setSeries] = useState<{ id: string; name: string }[]>([]);
  const [seri, setSeri] = useState('');
  const [yil, setYil] = useState('');
  const [detail, setDetail] = useState<SeriesDetail | null>(null);

  useEffect(() => {
    setMake('');
    katalog<{ id: string; name: string }[]>(`makes?kategori=${kategori}`)
      .then(setMakes)
      .catch(() => setMakes([]));
  }, [kategori]);
  useEffect(() => {
    setSeri('');
    setSeries([]);
    if (make)
      katalog<{ id: string; name: string }[]>(`makes/${make}/series?kategori=${kategori}`)
        .then(setSeries)
        .catch(() => undefined);
  }, [make, kategori]);
  useEffect(() => {
    setDetail(null);
    if (seri)
      katalog<SeriesDetail>(`series/${seri}${yil ? `?yil=${yil}` : ''}`)
        .then(setDetail)
        .catch(() => undefined);
  }, [seri, yil]);

  const select = {
    border: '1px solid #D5DAE5',
    borderRadius: 10,
    padding: 10,
    font: 'inherit',
    fontSize: 14,
    background: '#fff',
  };
  return (
    <section className="k-panel" style={{ marginTop: 16 }} aria-labelledby="gezgin">
      <div style={{ padding: '16px 18px', borderBottom: '1px solid #EEF0F5' }}>
        <h2 id="gezgin" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
          Katalog gezgini
        </h2>
        <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#5A6073' }}>
          Sihirbaz ve portföyün göreceği seçenekler. Kasa kuşağı ve makyaj bilgisi açık kaynaklar eklenince
          netleşir.
        </p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '14px 18px' }}>
        <select
          aria-label="Kategori"
          value={kategori}
          onChange={(e) => setKategori(e.target.value)}
          style={select}
        >
          {VEHICLE_CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select aria-label="Marka" value={make} onChange={(e) => setMake(e.target.value)} style={select}>
          <option value="">Marka ({makes.length})</option>
          {makes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Seri"
          value={seri}
          onChange={(e) => setSeri(e.target.value)}
          style={select}
          disabled={!make}
        >
          <option value="">Seri ({series.length})</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Model yılı"
          value={yil}
          onChange={(e) => setYil(e.target.value)}
          style={select}
          disabled={!seri}
        >
          <option value="">Tüm yıllar</option>
          {Array.from({ length: 15 }, (_, i) => 2026 - i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {detail ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
            padding: '0 18px 18px',
            fontSize: 13.5,
          }}
        >
          <div>
            <strong>Modeller</strong>
            {detail.models.map((m) => (
              <div key={m.id}>
                {m.name} <span className="muted">· {range(m.years)}</span>
              </div>
            ))}
          </div>
          <div>
            <strong>Kasa</strong>
            {detail.bodies.length ? (
              detail.bodies.map((b) => (
                <div key={b.name}>
                  {b.name} <span className="muted">· {range(b.years)}</span>
                </div>
              ))
            ) : (
              <div className="muted">Kaynakta yazmıyor</div>
            )}
            <strong style={{ display: 'block', marginTop: 10 }}>Makyaj</strong>
            <div>
              Makyajsız <span className="muted">· {range(detail.makyaj.makyajsiz)}</span>
            </div>
            <div>
              Makyajlı <span className="muted">· {range(detail.makyaj.makyajli)}</span>
            </div>
          </div>
          <div>
            <strong>Donanım paketleri ({detail.trims.length})</strong>
            {detail.trims.map((t) => (
              <div key={t.id}>
                {t.name} <span className="muted">· {range(t.years)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
