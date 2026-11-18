'use client';

import { useCallback, useEffect, useState } from 'react';
import { tarih, yonetim } from '../../../lib/istemci';
import { Duzenleyici } from './duzenleyici';

const WEB = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

interface Bildirim {
  id: string;
  talep: number;
  yillar: [number | null, number | null];
  arac: string | null;
  modelId: string | null;
  motor: string;
  alan: string | null;
  alanAd: string | null;
  not: string;
  durum: 'acik' | 'duzeltildi' | 'reddedildi';
  zaman: string;
  karar: string | null;
}

interface Surum {
  id: string;
  ad: string;
  yillar: [number, number] | null;
  duzeltme: number;
}

interface Eksik {
  modelId: string | null;
  seriesId: string | null;
  arac: string | null;
  motor: string | null;
  talepSayisi: number;
  talepler: number[];
  eksik: string[];
  donanimVar: boolean;
  makeId: string | null;
}

type Tab = 'eksik' | 'acik' | 'kapali' | 'ara';
const DURUM_AD = { acik: 'Açık', duzeltildi: 'Düzeltildi', reddedildi: 'Reddedildi' } as const;

/**
 * Teknik özellikler (sahip isteği, 17 Kasım 2026): kullanıcıların talep sayfasındaki "Bir değer yanlış mı? Bildir"
 * bildirimleri ve motor sürümlerinin değerlerini elle düzeltme ya da ekleme. Düzeltme kaynaklardaki değerin yerine
 * geçer, talep sayfasında ve sihirbazda hemen görünür; kayıtlar silinmez.
 */
export default function TeknikOzellikler() {
  const [tab, setTab] = useState<Tab>('eksik');
  const [liste, setListe] = useState<Bildirim[] | null>(null);
  const [eksikler, setEksikler] = useState<Eksik[] | null>(null);
  const [acikDuzelt, setAcikDuzelt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [markalar, setMarkalar] = useState<{ id: string; ad: string }[] | null>(null);
  const [marka, setMarka] = useState('');
  const [seriler, setSeriler] = useState<{ id: string; ad: string; yillar: [number, number] | null }[]>([]);
  const [seri, setSeri] = useState<{ id: string; ad: string } | null>(null);
  const [surumler, setSurumler] = useState<Surum[] | null>(null);
  const [surum, setSurum] = useState<string | null>(null);

  const load = useCallback(() => {
    if (tab === 'ara') return;
    if (tab === 'eksik') {
      setEksikler(null);
      yonetim<Eksik[]>('catalog/teknik/eksikler')
        .then(setEksikler)
        .catch((e: Error) => setError(e.message));
      return;
    }
    setListe(null);
    yonetim<Bildirim[]>(`catalog/teknik/bildirimler?durum=${tab}`)
      .then(setListe)
      .catch((e: Error) => setError(e.message));
  }, [tab]);
  useEffect(load, [load]);

  // Araç seçimi: Türkiye'de satılan tipi olan markalar, markanın modelleri, modelin motor sürümleri
  useEffect(() => {
    if (tab !== 'ara' || markalar) return;
    yonetim<{ id: string; ad: string }[]>('catalog/teknik/markalar')
      .then(setMarkalar)
      .catch((e: Error) => setError(e.message));
  }, [tab, markalar]);

  useEffect(() => {
    setSeriler([]);
    if (!marka) return;
    yonetim<typeof seriler>(`catalog/teknik/marka/${marka}`)
      .then(setSeriler)
      .catch((e: Error) => setError(e.message));
  }, [marka]);

  useEffect(() => {
    if (!seri) return;
    setSurumler(null);
    setSurum(null);
    yonetim<Surum[]>(`catalog/teknik/seri/${seri.id}`)
      .then(setSurumler)
      .catch((e: Error) => setError(e.message));
  }, [seri]);

  async function karar(b: Bildirim, durum: 'duzeltildi' | 'reddedildi') {
    setError(null);
    try {
      await yonetim(`catalog/teknik/bildirimler/${b.id}`, { method: 'POST', body: { durum } });
      setNotice(durum === 'reddedildi' ? 'Bildirim reddedildi.' : 'Bildirim düzeltildi olarak kapatıldı.');
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 className="k-h1">Teknik özellikler</h1>
        <p className="k-sub">
          Yayındaki taleplerde geçen ve bilgisi eksik araçlar, kullanıcıların "yanlış" bildirimleri ve araç
          arama burada. Bir motor sürümünün teknik değerlerini ve paket donanımını elle girebilirsin: metni
          yapıştırınca alanlar kendiliğinden dolar. Girdiğin değer kaynaktaki değerin yerine geçer ve hemen
          görünür; kaldırınca kaynaktaki değer geri gelir.
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
      <fieldset className="k-chips">
        <legend className="sr-only">Bölüm</legend>
        {(
          [
            ['eksik', 'Bilgisi eksik araçlar'],
            ['acik', 'Açık bildirimler'],
            ['kapali', 'Kapanan bildirimler'],
            ['ara', 'Araç ara ve bilgi gir'],
          ] as const
        ).map(([k, ad]) => (
          <button key={k} type="button" className="k-chip" aria-pressed={tab === k} onClick={() => setTab(k)}>
            {ad}
          </button>
        ))}
      </fieldset>

      {tab === 'eksik' ? (
        eksikler === null ? (
          <div className="k-panel k-empty">Yükleniyor…</div>
        ) : eksikler.length === 0 ? (
          <div className="k-panel k-empty">Yayındaki taleplerin araçlarında eksik bilgi yok.</div>
        ) : (
          <>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#5A6073' }}>
              Yayındaki taleplerde geçen motor sürümleri; vites, güç, tork, 0-100, azami hız, tüketim, depo,
              ölçüler, bagaj ya da ağırlık eksikse veya donanım girilmemişse listelenir. En çok talepte geçen
              önce.
            </p>
            {eksikler.map((x) => {
              const anahtar = x.modelId ?? `seri-${x.seriesId}`;
              return (
                <div key={anahtar}>
                  <section
                    className="k-panel"
                    style={{ padding: 14, marginBottom: 10 }}
                    aria-label={`${x.arac} ${x.motor ?? ''}`}
                  >
                    <div
                      style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}
                    >
                      <div style={{ flex: '1 1 420px' }}>
                        <strong style={{ fontSize: 15 }}>
                          {x.arac} {x.motor ?? <span style={{ color: '#5A6073' }}>(motor seçilmemiş)</span>}
                        </strong>
                        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#5A6073' }}>
                          {x.talepSayisi} talep:{' '}
                          {x.talepler.map((no, i) => (
                            <span key={no}>
                              {i ? ', ' : ''}
                              <a href={`${WEB}/talep/${no}`} target="_blank" rel="noreferrer">
                                #{no}
                              </a>
                            </span>
                          ))}
                          {x.talepSayisi > x.talepler.length ? ' …' : ''}
                        </p>
                        {x.modelId ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                            {x.eksik.map((e) => (
                              <span
                                key={e}
                                className="k-pill"
                                style={{ background: '#FFF6DD', color: '#7A5A00' }}
                              >
                                {e}
                              </span>
                            ))}
                            {!x.donanimVar ? (
                              <span className="k-pill" style={{ background: '#FFEEF6', color: '#8A1F4F' }}>
                                Donanım yok
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#5A6073' }}>
                            Talepte motor seçilmediği için modelin sürümlerinden birini seçip bilgi gir.
                          </p>
                        )}
                      </div>
                      <div>
                        {x.modelId ? (
                          <button
                            type="button"
                            className="k-btn-ok"
                            style={{ fontSize: 13, padding: '6px 12px' }}
                            onClick={() => setAcikDuzelt((v) => (v === anahtar ? null : anahtar))}
                          >
                            {acikDuzelt === anahtar ? 'Kapat' : 'Bilgi gir'}
                          </button>
                        ) : x.seriesId ? (
                          <button
                            type="button"
                            className="k-btn-line"
                            style={{ fontSize: 13, padding: '6px 12px' }}
                            onClick={() => {
                              if (x.makeId) setMarka(x.makeId);
                              setSeri({ id: x.seriesId as string, ad: x.arac ?? '' });
                              setTab('ara');
                            }}
                          >
                            Sürümleri aç
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </section>
                  {acikDuzelt === anahtar && x.modelId ? (
                    <Duzenleyici
                      modelId={x.modelId}
                      bitti={(m) => {
                        setNotice(m);
                        load();
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </>
        )
      ) : tab === 'ara' ? (
        <>
          <div className="k-panel" style={{ padding: 16, marginBottom: 14 }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#5A6073' }}>
              Türkiye'de satılan (TSB listesindeki) her araca istediğin zaman teknik özellik ve donanım
              girebilirsin: marka, model ve motor sürümünü seç; paket, vites ve yılları düzenleyicide
              seçersin.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <label className="k-field" style={{ flex: '1 1 200px' }}>
                Marka
                <select
                  value={marka}
                  onChange={(e) => {
                    setMarka(e.target.value);
                    setSeri(null);
                    setSurumler(null);
                    setSurum(null);
                  }}
                >
                  <option value="">{markalar ? 'Marka seç' : 'Yükleniyor…'}</option>
                  {(markalar ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.ad}
                    </option>
                  ))}
                </select>
              </label>
              <label className="k-field" style={{ flex: '1 1 260px' }}>
                Model
                <select
                  value={seri?.id ?? ''}
                  disabled={!marka}
                  onChange={(e) => {
                    const x = seriler.find((s) => s.id === e.target.value);
                    setSeri(x ? { id: x.id, ad: x.ad } : null);
                  }}
                >
                  <option value="">Model seç</option>
                  {seri && !seriler.some((s) => s.id === seri.id) ? (
                    <option value={seri.id}>{seri.ad}</option>
                  ) : null}
                  {seriler.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.ad}
                      {s.yillar ? ` (${s.yillar[0]}–${s.yillar[1]})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {seri && surumler ? (
              surumler.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                  <span style={{ width: '100%', fontSize: 13, fontWeight: 700 }}>Motor sürümü</span>
                  {surumler.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="k-chip"
                      aria-pressed={surum === s.id}
                      onClick={() => setSurum(s.id)}
                    >
                      {s.ad}
                      {s.yillar ? ` · ${s.yillar[0]}–${s.yillar[1]}` : ''}
                      {s.duzeltme ? ` · ${s.duzeltme} kayıt` : ''}
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ margin: '12px 0 0', fontSize: 13, color: '#5A6073' }}>
                  Bu modelde Türkiye'de satılan motor sürümü yok.
                </p>
              )
            ) : null}
          </div>
          {surum ? <Duzenleyici key={surum} modelId={surum} /> : null}
        </>
      ) : liste === null ? (
        <div className="k-panel k-empty">Yükleniyor…</div>
      ) : liste.length === 0 ? (
        <div className="k-panel k-empty">
          {tab === 'acik' ? 'Açık bildirim yok.' : 'Kapanan bildirim yok.'}
        </div>
      ) : (
        liste.map((b) => (
          <div key={b.id}>
            <section
              className="k-panel"
              style={{ padding: 16, marginBottom: 10 }}
              aria-label={`${b.arac} ${b.motor}`}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <strong style={{ fontSize: 15 }}>
                    {b.arac} {b.motor}
                  </strong>
                  {b.alanAd ? (
                    <span
                      className="k-pill"
                      style={{ marginLeft: 8, background: '#FFF6DD', color: '#7A5A00' }}
                    >
                      {b.alanAd}
                    </span>
                  ) : null}
                  <p style={{ margin: '6px 0 0', fontSize: 14 }}>{b.not}</p>
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#5A6073' }}>
                    <a href={`${WEB}/talep/${b.talep}`} target="_blank" rel="noreferrer">
                      Talep #{b.talep}
                    </a>
                    {b.yillar[0] || b.yillar[1] ? ` · ${b.yillar[0] ?? '…'}–${b.yillar[1] ?? '…'}` : ''} ·{' '}
                    {tarih(b.zaman)}
                    {b.durum !== 'acik' ? ` · ${DURUM_AD[b.durum]} (${tarih(b.karar)})` : ''}
                  </p>
                </div>
                {b.durum === 'acik' ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {b.modelId ? (
                      <button
                        type="button"
                        className="k-btn-ok"
                        style={{ fontSize: 13, padding: '6px 12px' }}
                        onClick={() => setAcikDuzelt((x) => (x === b.id ? null : b.id))}
                      >
                        {acikDuzelt === b.id ? 'Düzenleyiciyi kapat' : 'Düzelt'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="k-btn-line"
                      style={{ fontSize: 13, padding: '6px 12px' }}
                      onClick={() => karar(b, 'duzeltildi')}
                    >
                      Düzeltildi say
                    </button>
                    <button
                      type="button"
                      className="k-btn-line"
                      style={{ fontSize: 13, padding: '6px 12px', color: '#A3271F' }}
                      onClick={() => karar(b, 'reddedildi')}
                    >
                      Reddet
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
            {acikDuzelt === b.id && b.modelId ? (
              <Duzenleyici
                modelId={b.modelId}
                yillar={b.yillar}
                bildirim={b.id}
                bitti={(m) => {
                  setAcikDuzelt(null);
                  setNotice(`${m} Bildirim kapatıldı.`);
                  load();
                }}
              />
            ) : null}
          </div>
        ))
      )}
    </>
  );
}
