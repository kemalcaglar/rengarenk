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

type Tab = 'acik' | 'kapali' | 'ara';
const DURUM_AD = { acik: 'Açık', duzeltildi: 'Düzeltildi', reddedildi: 'Reddedildi' } as const;

/**
 * Teknik özellikler (sahip isteği, 17 Kasım 2026): kullanıcıların talep sayfasındaki "Bir değer yanlış mı? Bildir"
 * bildirimleri ve motor sürümlerinin değerlerini elle düzeltme ya da ekleme. Düzeltme kaynaklardaki değerin yerine
 * geçer, talep sayfasında ve sihirbazda hemen görünür; kayıtlar silinmez.
 */
export default function TeknikOzellikler() {
  const [tab, setTab] = useState<Tab>('acik');
  const [liste, setListe] = useState<Bildirim[] | null>(null);
  const [acikDuzelt, setAcikDuzelt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [seriler, setSeriler] = useState<{ id: string; ad: string }[]>([]);
  const [seri, setSeri] = useState<{ id: string; ad: string } | null>(null);
  const [surumler, setSurumler] = useState<Surum[] | null>(null);
  const [surum, setSurum] = useState<string | null>(null);

  const load = useCallback(() => {
    if (tab === 'ara') return;
    setListe(null);
    yonetim<Bildirim[]>(`catalog/teknik/bildirimler?durum=${tab}`)
      .then(setListe)
      .catch((e: Error) => setError(e.message));
  }, [tab]);
  useEffect(load, [load]);

  useEffect(() => {
    if (tab !== 'ara' || q.trim().length < 2) return setSeriler([]);
    const t = setTimeout(() => {
      yonetim<{ id: string; ad: string }[]>(`catalog/images/seriler?q=${encodeURIComponent(q.trim())}`)
        .then(setSeriler)
        .catch(() => setSeriler([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, tab]);

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
          Kullanıcılar talep sayfasının teknik sekmesinden yanlış gördükleri değeri bildirir; bildirimler
          burada bekler. Bir motor sürümünün değerini düzeltebilir ya da kaynaklarda olmayan değeri
          ekleyebilirsin (isteğe bağlı yıl aralığıyla). Düzeltme kaynaktaki değerin yerine geçer ve hemen
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
            ['acik', 'Açık bildirimler'],
            ['kapali', 'Kapanan bildirimler'],
            ['ara', 'Araç ara ve düzelt'],
          ] as const
        ).map(([k, ad]) => (
          <button key={k} type="button" className="k-chip" aria-pressed={tab === k} onClick={() => setTab(k)}>
            {ad}
          </button>
        ))}
      </fieldset>

      {tab === 'ara' ? (
        <>
          <div className="k-panel" style={{ padding: 16, marginBottom: 14 }}>
            <label className="k-field">
              Marka ya da model
              <input
                value={q}
                placeholder="Ör. BMW 3 Serisi, Fiat Egea"
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            {seriler.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {seriler.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="k-chip"
                    aria-pressed={seri?.id === s.id}
                    onClick={() => setSeri(s)}
                  >
                    {s.ad}
                  </button>
                ))}
              </div>
            ) : null}
            {seri && surumler ? (
              surumler.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
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
                      {s.duzeltme ? ` · ${s.duzeltme} düzeltme` : ''}
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
