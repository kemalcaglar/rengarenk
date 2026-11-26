'use client';

import { useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import stil from './yardim.module.css';

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
    <div className={stil.kutu1}>
      <div className={stil.kutu2}>
        <label className={`k-field ${stil.etiket1}`}>
          Bölüm
          <select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
            {v?.konular.map((k) => (
              <option key={k.key} value={k.key}>
                {k.ad}
              </option>
            ))}
          </select>
        </label>
        <label className={`k-field ${stil.etiket2}`}>
          Durum
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Durum })}>
            <option value="taslak">Taslak</option>
            <option value="yayinda">Yayında</option>
            <option value="arsiv">Arşiv (kaldır)</option>
          </select>
        </label>
      </div>
      <label className={`k-field ${stil.etiket3}`}>
        Soru (başlık)
        <input
          value={form.title}
          maxLength={160}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </label>
      <label className={`k-field ${stil.etiket3}`}>
        Yanıt
        <textarea
          value={form.body}
          rows={7}
          maxLength={5000}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          className={stil.girdi1}
        />
      </label>
      <div className={stil.kutu3}>
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
    <section className={`k-panel ${stil.kutu4}`} aria-labelledby="makale">
      <div className={stil.kutu5}>
        <h2 id="makale" className={stil.baslik1}>
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
            className={stil.dugme1}
          >
            Makale ekle
          </button>
        ) : null}
      </div>
      {hata ? (
        <p className={`k-error ${stil.metin1}`} role="alert">
          {hata}
        </p>
      ) : null}
      {bilgi ? (
        <p className={`k-ok ${stil.metin1}`} role="status">
          {bilgi}
        </p>
      ) : null}
      {form && !form.id ? formu : null}
      {v === null ? <div className="k-empty">Yükleniyor…</div> : null}
      {v?.makaleler.map((m) => (
        <div key={m.id}>
          <div className={stil.kutu6}>
            <span className={stil.metin2}>
              <span className={stil.metin3}>
                {yazabilir ? (
                  <button
                    type="button"
                    onClick={() => (form?.id === m.id ? setForm(null) : duzenle(m))}
                    aria-expanded={form?.id === m.id}
                    className={stil.dugme2}
                  >
                    {m.title}
                  </button>
                ) : (
                  m.title
                )}
                {m.status === 'taslak' ? (
                  <span className={`k-pill ${stil.metin4}`}>
                    {m.source === 'ajan' ? 'Ajan taslağı' : 'Taslak'}
                  </span>
                ) : null}
              </span>
              <span className={stil.metin5}>
                {m.konu} · güncelleme {m.tarih}
              </span>
            </span>
            <span className={stil.metin6}>{sayi(m.okunma)} okunma</span>
            <span
              className={stil.metin7}
              style={{ color: m.faydali === null ? '#5A6073' : m.faydali >= 75 ? '#11683F' : '#7A5300' }}
            >
              {m.faydali === null ? 'oy yok' : `%${m.faydali} faydalı`}
            </span>
          </div>
          {form?.id === m.id ? formu : null}
        </div>
      ))}
      {v?.ajan ? (
        <p className={stil.metin8}>
          <strong>Ajan:</strong> {v.ajan.metin} Taslağı ben hazırlarım; yayın senin ya da pazarlamanın
          onayıyla.{' '}
          {yazabilir ? (
            <button
              type="button"
              className={`k-btn-line ${stil.dugme3}`}
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
