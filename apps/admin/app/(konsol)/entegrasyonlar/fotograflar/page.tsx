'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../../lib/istemci';
import { type Alan, PlakaDuzenle } from './plaka';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const WEB = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
const MAKYAJLAR: [string, string][] = [
  ['', 'Nesil geneli'],
  ['0', 'Makyaj öncesi'],
  ['1', '1. makyaj'],
  ['2', '2. makyaj'],
];

interface Candidate {
  id: string;
  status: 'aday' | 'secildi';
  /** commons; galeri: Commons'ta fotoğraf yokken galerinin izin verdiği portföy fotoğrafı (Karar 34) */
  origin: 'commons' | 'galeri';
  commonsFile: string;
  pageUrl: string;
  preview: string;
  width: number;
  height: number;
  author: string;
  license: string;
  score: number;
  /** Seçilende: temsil ettiği makyaj, depodaki kopya, plaka düzenlemesi */
  facelift: number | null;
  makyajAd: string | null;
  kopya: string | null;
  edited: boolean;
  blurAreas: Alan[] | null;
}

interface Generation {
  id: string;
  code: string | null;
  name: string;
  startYear: number;
  endYear: number | null;
  commonsCategory: string | null;
  series: { name: string; make: { name: string } };
  images: Candidate[];
}

type Tab = 'bekleyen' | 'secili';

/**
 * Nesil fotoğrafları (Karar 34): Commons'taki açık lisanslı gerçek fotoğraflar. Sistem adayları bulur ve sıralar;
 * katalog sorumlusu nesil ve makyaj başına birini seçer (nesil geneli, makyaj öncesi, 1. ve 2. makyaj). Seçilen
 * fotoğrafın kopyası atfıyla depoya alınır ve kalır. Plakası okunan fotoğrafta plaka işaretlenip bulanıklaştırılır.
 */
export default function Fotograflar() {
  const [tab, setTab] = useState<Tab>('bekleyen');
  const [rows, setRows] = useState<Generation[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [makyaj, setMakyaj] = useState<Record<string, string>>({});
  /** Plaka düzenleyici: seçili fotoğrafta düzenleme ya da galeri adayında "işaretle ve seç" */
  const [plaka, setPlaka] = useState<{ g: Generation; i: Candidate; sec?: boolean } | null>(null);

  const load = useCallback(() => {
    setRows(null);
    yonetim<Generation[]>(`catalog/images?durum=${tab}`)
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  }, [tab]);
  useEffect(load, [load]);

  async function act(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      setNotice(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const title = (g: Generation) =>
    `${g.series.make.name} ${g.series.name} ${g.code ?? ''} · ${g.startYear}–${g.endYear ?? '…'}`;
  const galeri = (i: Candidate) => i.origin === 'galeri';
  // Galeri adayında makyaj aracın kasasından gelir
  const makyajOf = (i: Candidate) =>
    makyaj[i.id] ?? (galeri(i) && i.facelift !== null ? String(i.facelift) : '');
  const onizleme = (i: Candidate) =>
    i.kopya ? `${API}${i.kopya}` : galeri(i) ? `${API}${i.preview}` : i.preview;

  /** Adayı seç; galeri fotoğrafında plaka alanları ya da "plaka görünmüyor" onayıyla (Karar 34) */
  function sec(g: Generation, i: Candidate, plakaBilgi: { alanlar?: Alan[]; plakaYok?: boolean } = {}) {
    return act(i.id, async () => {
      const m = makyajOf(i);
      await yonetim(`catalog/images/${i.id}/select`, {
        method: 'POST',
        body: { makyaj: m === '' ? null : Number(m), ...plakaBilgi },
      });
      load();
      const ad = MAKYAJLAR.find(([v]) => v === m)?.[1] ?? 'Nesil geneli';
      return `${title(g)} · ${ad.toLocaleLowerCase('tr-TR')} fotoğrafı seçildi ve depoya alındı.${
        galeri(i) ? ' Atıfta galeri adı yazar.' : ''
      } Diğer makyajlar için Seçilmiş sekmesinden devam edebilirsin.`;
    });
  }

  return (
    <>
      <Link
        href="/entegrasyonlar"
        style={{ display: 'inline-block', marginBottom: 8, fontSize: 13.5, fontWeight: 700 }}
      >
        ‹ Entegrasyonlar
      </Link>
      <div style={{ marginBottom: 16 }}>
        <h1 className="k-h1">Nesil fotoğrafları</h1>
        <p className="k-sub">
          Talep sayfasındaki temsilî görsel Wikimedia Commons'tan gelir: yalnızca kamu malı, CC0, CC BY ve CC
          BY-SA lisanslar. Tercih: dış çekim, ön çapraz açı, araç tam kadrajda, insan yok. Her makyaj için
          ayrı fotoğraf seçebilirsin; makyaj fotoğrafı yoksa nesil geneli gösterilir. Plakası okunan fotoğrafı
          seçtikten sonra plakayı bulanıklaştır. Seçtiğin fotoğraf kalır ve altında yazar ile lisans yazar.
          Commons'ta fotoğrafı olmayan nesillerde, galerilerin izin verdiği portföy fotoğrafları da aday olur:
          plakayı işaretleyerek seçersin, atıfta galeri adı yazar; galeri izni kaldırırsa fotoğraf
          kendiliğinden geri çekilir (Karar 34).
        </p>
      </div>
      {error ? (
        <p className="k-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="k-ok" role="status">
          {notice}
        </p>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <fieldset className="k-chips" style={{ margin: 0 }}>
          <legend className="sr-only">Durum</legend>
          {(
            [
              ['bekleyen', 'Seçim bekleyen'],
              ['secili', 'Seçilmiş'],
            ] as const
          ).map(([key, ad]) => (
            <button
              key={key}
              type="button"
              className="k-chip"
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
            >
              {ad}
            </button>
          ))}
        </fieldset>
        <button
          type="button"
          className="k-btn-line"
          disabled={busy !== null}
          onClick={() =>
            act('ara', async () => {
              const r = await yonetim<{ nesil: number; aday: number; galeri?: number }>(
                'catalog/sources/commons/check',
                {
                  method: 'POST',
                  body: {},
                },
              );
              load();
              return `${r.nesil} nesil için Commons'a bakıldı, ${r.aday} yeni aday eklendi; galeri portföylerinden ${r.galeri ?? 0} aday.`;
            })
          }
        >
          Yeni aday ara
        </button>
      </div>

      {rows === null ? (
        <div className="k-panel k-empty">Yükleniyor…</div>
      ) : rows.length === 0 ? (
        <div className="k-panel k-empty">
          {tab === 'bekleyen' ? 'Seçim bekleyen nesil yok.' : 'Henüz seçilmiş fotoğraf yok.'}
        </div>
      ) : (
        rows.map((g) => (
          <section
            key={g.id}
            className="k-panel"
            style={{ padding: 16, marginBottom: 14 }}
            aria-label={title(g)}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
              <strong style={{ fontSize: 15.5 }}>{title(g)}</strong>
              {g.commonsCategory ? (
                <a
                  href={`https://commons.wikimedia.org/wiki/Category:${encodeURIComponent(g.commonsCategory)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 13 }}
                >
                  Commons kategorisi
                </a>
              ) : null}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12,
                marginTop: 12,
              }}
            >
              {g.images.map((i) => (
                <figure
                  key={i.id}
                  style={{
                    margin: 0,
                    border: i.status === 'secildi' ? '1.5px solid #5B8CFF' : '1px solid #E3E6EF',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#fff',
                  }}
                >
                  <a href={galeri(i) ? `${WEB}${i.pageUrl}` : i.pageUrl} target="_blank" rel="noreferrer">
                    {/* biome-ignore lint/performance/noImgElement: Commons önizlemesi, Next görsel iyileştirmesi gerekmez */}
                    <img
                      src={onizleme(i)}
                      alt={galeri(i) ? `${i.author} portföy fotoğrafı` : i.commonsFile}
                      loading="lazy"
                      style={{ width: '100%', aspectRatio: '3 / 2', objectFit: 'cover', display: 'block' }}
                    />
                  </a>
                  <figcaption style={{ padding: 10, fontSize: 12, color: '#3A4052' }}>
                    {galeri(i) ? (
                      <span
                        className="k-pill"
                        style={{
                          background: '#FFF6DD',
                          color: '#7A5A00',
                          marginBottom: 6,
                          display: 'inline-block',
                        }}
                      >
                        Galeri fotoğrafı
                      </span>
                    ) : null}
                    <span style={{ display: 'block', fontWeight: 700, overflowWrap: 'anywhere' }}>
                      {galeri(i) ? i.author : i.commonsFile}
                    </span>
                    <span style={{ display: 'block', color: '#5A6073' }}>
                      {galeri(i) ? 'Galeri portföyü' : i.author} · {i.license} · {i.width}×{i.height}
                    </span>
                    {i.status === 'secildi' ? (
                      <span
                        style={{
                          display: 'flex',
                          gap: 6,
                          marginTop: 8,
                          flexWrap: 'wrap',
                          alignItems: 'center',
                        }}
                      >
                        <span className="k-pill" style={{ background: '#E7FAF0', color: '#11683F' }}>
                          Seçildi · {i.makyajAd}
                        </span>
                        {i.edited ? (
                          <span className="k-pill" style={{ background: '#FFEEF6', color: '#A0256A' }}>
                            Plaka bulanık
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className="k-btn-line"
                          style={{ fontSize: 13, padding: '6px 10px' }}
                          disabled={busy !== null}
                          onClick={() => setPlaka({ g, i })}
                        >
                          {i.edited ? 'Alanları düzenle' : 'Plakayı bulanıklaştır'}
                        </button>
                        {i.edited && !galeri(i) ? (
                          <button
                            type="button"
                            className="k-btn-line"
                            style={{ fontSize: 13, padding: '6px 10px' }}
                            disabled={busy !== null}
                            onClick={() =>
                              act(i.id, async () => {
                                await yonetim(`catalog/images/${i.id}/unblur`, { method: 'POST', body: {} });
                                load();
                                return 'Düzenleme geri alındı; özgün kopya gösteriliyor.';
                              })
                            }
                          >
                            Geri al
                          </button>
                        ) : null}
                      </span>
                    ) : (
                      <span style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="k-btn-line"
                          style={{ fontSize: 13, padding: '6px 10px' }}
                          disabled={busy !== null}
                          onClick={() =>
                            act(i.id, async () => {
                              await yonetim(`catalog/images/${i.id}/reject`, { method: 'POST', body: {} });
                              setRows(
                                (rs) =>
                                  rs?.map((x) =>
                                    x.id === g.id
                                      ? { ...x, images: x.images.filter((y) => y.id !== i.id) }
                                      : x,
                                  ) ?? null,
                              );
                              return 'Aday elendi.';
                            })
                          }
                        >
                          Ele
                        </button>
                        <select
                          aria-label={`Makyaj · ${i.commonsFile}`}
                          value={makyajOf(i)}
                          onChange={(e) => setMakyaj((m) => ({ ...m, [i.id]: e.target.value }))}
                          style={{
                            fontSize: 13,
                            padding: '5px 6px',
                            borderRadius: 8,
                            border: '1px solid #D5DAE5',
                          }}
                        >
                          {MAKYAJLAR.map(([v, ad]) => (
                            <option key={v} value={v}>
                              {ad}
                            </option>
                          ))}
                        </select>
                        {galeri(i) ? (
                          <>
                            <button
                              type="button"
                              className="k-btn-ok"
                              style={{ fontSize: 13, padding: '6px 10px' }}
                              disabled={busy !== null}
                              onClick={() => setPlaka({ g, i, sec: true })}
                            >
                              Plakayı işaretle ve seç
                            </button>
                            <button
                              type="button"
                              className="k-btn-line"
                              style={{ fontSize: 13, padding: '6px 10px' }}
                              disabled={busy !== null}
                              onClick={() => sec(g, i, { plakaYok: true })}
                            >
                              {busy === i.id ? 'Alınıyor…' : 'Plaka görünmüyor, seç'}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="k-btn-ok"
                            style={{ fontSize: 13, padding: '6px 10px' }}
                            disabled={busy !== null}
                            onClick={() => sec(g, i)}
                          >
                            {busy === i.id ? 'Alınıyor…' : 'Bunu seç'}
                          </button>
                        )}
                      </span>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))
      )}
      {plaka?.sec ? (
        <PlakaDuzenle
          src={onizleme(plaka.i)}
          baslik={`${title(plaka.g)} · ${plaka.i.author}`}
          galeri
          ilk={[]}
          kapat={() => setPlaka(null)}
          kaydet={async (alanlar) => {
            const { g, i } = plaka;
            setPlaka(null);
            await sec(g, i, { alanlar });
          }}
        />
      ) : plaka?.i.kopya ? (
        <PlakaDuzenle
          src={`${API}${plaka.i.kopya}`}
          baslik={`${title(plaka.g)} · ${plaka.i.makyajAd ?? ''}`}
          galeri={galeri(plaka.i)}
          ilk={plaka.i.blurAreas ?? []}
          kapat={() => setPlaka(null)}
          kaydet={async (alanlar) => {
            setError(null);
            try {
              await yonetim(`catalog/images/${plaka.i.id}/blur`, { method: 'POST', body: { alanlar } });
              setPlaka(null);
              setNotice(
                'Plaka bulanıklaştırıldı; talep sayfasında düzenlenmiş kopya ve “düzenlendi” atfı gösteriliyor.',
              );
              load();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      ) : null}
    </>
  );
}
