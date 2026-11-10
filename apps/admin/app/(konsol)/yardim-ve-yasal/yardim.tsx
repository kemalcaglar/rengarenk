'use client';

import { useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';

type Durum = 'taslak' | 'yayinda' | 'arsiv';
interface Makale {
  id: string;
  topic: string;
  konu: string;
  title: string;
  body: string;
  status: Durum;
  source: 'ekip' | 'ajan' | 'kurulum';
  tarih: string;
  okunma: number;
  faydali: number | null;
  oy: number;
}
interface Liste {
  konular: { key: string; ad: string }[];
  makaleler: Makale[];
  ajan: { metin: string; oran: number; konuAd: string } | null;
}
interface Form {
  id: string | null;
  topic: string;
  title: string;
  body: string;
  status: Durum;
}

const sayi = (n: number) => n.toLocaleString('tr-TR');

/**
 * Yardım makaleleri (YonetimIcerik.dc.html › Yardım makaleleri; Karar 46): okunma ve "faydalı" oranı, makale ekle ve
 * düzenle, ajanın karşılanmayan destek konusu notu ve taslağı (yayın insanla).
 */
export function YardimMakaleleri({ yazabilir }: { yazabilir: boolean }) {
  const [v, setV] = useState<Liste | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  const yukle = useCallback(() => {
    yonetim<Liste>('help')
      .then(setV)
      .catch((e: Error) => setHata(e.message));
  }, []);
  useEffect(yukle, [yukle]);

  async function islem(fn: () => Promise<string>) {
    setBusy(true);
    setHata(null);
    setBilgi(null);
    try {
      setBilgi(await fn());
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const duzenle = (m: Makale) =>
    setForm({ id: m.id, topic: m.topic, title: m.title, body: m.body, status: m.status });

  const formu = form ? (
    <div style={{ padding: '14px 18px', background: '#F6F8FD', borderBottom: '1px solid #EEF0F5' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label className="k-field" style={{ flex: '1 1 200px' }}>
          Bölüm
          <select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
            {v?.konular.map((k) => (
              <option key={k.key} value={k.key}>
                {k.ad}
              </option>
            ))}
          </select>
        </label>
        <label className="k-field" style={{ flex: '1 1 160px' }}>
          Durum
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Durum })}>
            <option value="taslak">Taslak</option>
            <option value="yayinda">Yayında</option>
            <option value="arsiv">Arşiv (kaldır)</option>
          </select>
        </label>
      </div>
      <label className="k-field" style={{ display: 'block', marginTop: 10 }}>
        Soru (başlık)
        <input
          value={form.title}
          maxLength={160}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </label>
      <label className="k-field" style={{ display: 'block', marginTop: 10 }}>
        Yanıt
        <textarea
          value={form.body}
          rows={7}
          maxLength={5000}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          style={{
            display: 'block',
            width: '100%',
            marginTop: 5,
            border: '1px solid #D5DAE5',
            borderRadius: 10,
            padding: 11,
            font: 'inherit',
            fontWeight: 400,
            fontSize: 14,
            lineHeight: 1.5,
            boxSizing: 'border-box',
          }}
        />
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button
          type="button"
          className="k-btn-ok"
          disabled={busy}
          onClick={() =>
            islem(async () => {
              const body = { topic: form.topic, title: form.title, body: form.body, status: form.status };
              if (form.id) await yonetim(`help/${form.id}`, { method: 'PUT', body });
              else await yonetim('help', { method: 'POST', body });
              setForm(null);
              return form.status === 'yayinda'
                ? 'Makale yayında; yardım merkezinde ve destek önerilerinde görünür.'
                : form.status === 'arsiv'
                  ? 'Makale yardım merkezinden kaldırıldı.'
                  : 'Taslak kaydedildi.';
            })
          }
        >
          Kaydet
        </button>
        <button type="button" className="k-btn-line" onClick={() => setForm(null)}>
          Vazgeç
        </button>
      </div>
    </div>
  ) : null;

  return (
    <section className="k-panel" style={{ marginTop: 14, overflow: 'hidden' }} aria-labelledby="makale">
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
        <h2 id="makale" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
          Yardım makaleleri
        </h2>
        {yazabilir ? (
          <button
            type="button"
            onClick={() =>
              setForm({
                id: null,
                topic: v?.konular[0]?.key ?? 'talep',
                title: '',
                body: '',
                status: 'taslak',
              })
            }
            style={{
              border: '1px solid #5B8CFF',
              background: '#FFFFFF',
              borderRadius: 10,
              padding: '8px 14px',
              fontSize: 13.5,
              fontWeight: 800,
              color: '#2450C8',
              cursor: 'pointer',
            }}
          >
            Makale ekle
          </button>
        ) : null}
      </div>
      {hata ? (
        <p className="k-error" role="alert" style={{ margin: '10px 18px' }}>
          {hata}
        </p>
      ) : null}
      {bilgi ? (
        <p className="k-ok" role="status" style={{ margin: '10px 18px' }}>
          {bilgi}
        </p>
      ) : null}
      {form && !form.id ? formu : null}
      {v === null ? <div className="k-empty">Yükleniyor…</div> : null}
      {v?.makaleler.map((m) => (
        <div key={m.id}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '6px 16px',
              padding: '12px 18px',
              borderBottom: '1px solid #EEF0F5',
              fontSize: 13.5,
            }}
          >
            <span style={{ flex: '999 1 300px', minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 800 }}>
                {yazabilir ? (
                  <button
                    type="button"
                    onClick={() => (form?.id === m.id ? setForm(null) : duzenle(m))}
                    aria-expanded={form?.id === m.id}
                    style={{
                      border: 0,
                      background: 'none',
                      padding: 0,
                      font: 'inherit',
                      fontWeight: 800,
                      color: '#1E2333',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {m.title}
                  </button>
                ) : (
                  m.title
                )}
                {m.status === 'taslak' ? (
                  <span className="k-pill" style={{ marginLeft: 8, background: '#FFF6DF', color: '#7A5300' }}>
                    {m.source === 'ajan' ? 'Ajan taslağı' : 'Taslak'}
                  </span>
                ) : null}
              </span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
                {m.konu} · güncelleme {m.tarih}
              </span>
            </span>
            <span style={{ flex: '0 0 120px', color: '#3A4052' }}>{sayi(m.okunma)} okunma</span>
            <span
              style={{
                flex: '0 0 120px',
                fontWeight: 700,
                color: m.faydali === null ? '#5A6073' : m.faydali >= 75 ? '#11683F' : '#7A5300',
              }}
            >
              {m.faydali === null ? 'oy yok' : `%${m.faydali} faydalı`}
            </span>
          </div>
          {form?.id === m.id ? formu : null}
        </div>
      ))}
      {v?.ajan ? (
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
          <strong>Ajan:</strong> {v.ajan.metin} Taslağı ben hazırlarım; yayın senin ya da pazarlamanın
          onayıyla.{' '}
          {yazabilir ? (
            <button
              type="button"
              className="k-btn-line"
              style={{ fontSize: 12.5, padding: '4px 10px', marginLeft: 4 }}
              disabled={busy}
              onClick={() =>
                islem(async () => {
                  await yonetim('help/ajan-taslak', { method: 'POST', body: {} });
                  return 'Ajan taslağı hazırladı; listede “Ajan taslağı” olarak görünüyor. Okuyup yayınlayabilirsin.';
                })
              }
            >
              Taslağı hazırla
            </button>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
