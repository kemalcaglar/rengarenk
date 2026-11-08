'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../../lib/istemci';

interface Candidate {
  id: string;
  status: 'aday' | 'secildi';
  commonsFile: string;
  pageUrl: string;
  preview: string;
  width: number;
  height: number;
  author: string;
  license: string;
  score: number;
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
 * katalog sorumlusu nesil başına birini seçer. Seçilen fotoğrafın kopyası atfıyla depoya alınır ve o nesil için kalır.
 */
export default function Fotograflar() {
  const [tab, setTab] = useState<Tab>('bekleyen');
  const [rows, setRows] = useState<Generation[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
          BY-SA lisanslar. Tercih: dış çekim, ön çapraz açı, araç tam kadrajda, insan yok. Plakası okunan
          fotoğrafı seçme. Seçtiğin fotoğraf o nesil için kalır ve altında yazar ile lisans yazar (Karar 34).
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
              const r = await yonetim<{ nesil: number; aday: number }>('catalog/sources/commons/check', {
                method: 'POST',
                body: {},
              });
              load();
              return `${r.nesil} nesil için Commons'a bakıldı, ${r.aday} yeni aday eklendi.`;
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
                  <a href={i.pageUrl} target="_blank" rel="noreferrer">
                    {/* biome-ignore lint/performance/noImgElement: Commons önizlemesi, Next görsel iyileştirmesi gerekmez */}
                    <img
                      src={i.preview}
                      alt={i.commonsFile}
                      loading="lazy"
                      style={{ width: '100%', aspectRatio: '3 / 2', objectFit: 'cover', display: 'block' }}
                    />
                  </a>
                  <figcaption style={{ padding: 10, fontSize: 12, color: '#3A4052' }}>
                    <span style={{ display: 'block', fontWeight: 700, overflowWrap: 'anywhere' }}>
                      {i.commonsFile}
                    </span>
                    <span style={{ display: 'block', color: '#5A6073' }}>
                      {i.author} · {i.license} · {i.width}×{i.height}
                    </span>
                    {i.status === 'secildi' ? (
                      <span
                        className="k-pill"
                        style={{ marginTop: 8, background: '#E7FAF0', color: '#11683F' }}
                      >
                        Seçildi
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
                        <button
                          type="button"
                          className="k-btn-ok"
                          style={{ fontSize: 13, padding: '6px 10px' }}
                          disabled={busy !== null}
                          onClick={() =>
                            act(i.id, async () => {
                              await yonetim(`catalog/images/${i.id}/select`, { method: 'POST', body: {} });
                              setRows((rs) => rs?.filter((x) => x.id !== g.id) ?? null);
                              return `${title(g)} için fotoğraf seçildi ve depoya alındı.`;
                            })
                          }
                        >
                          {busy === i.id ? 'Alınıyor…' : 'Bunu seç'}
                        </button>
                      </span>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
