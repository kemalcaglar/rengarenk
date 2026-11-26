'use client';

import {
  ACTION_REASONS,
  DEMAND_ACTIONS,
  type ListingRow,
  type PublicCategory,
  VEHICLE_ACTIONS,
} from '@rengarenk/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import stil from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const WEB = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
type Tur = 'talep' | 'arac';

const TON: Record<ListingRow['ton'], { bg: string; fg: string }> = {
  yesil: { bg: '#E7FAF0', fg: '#11683F' },
  sari: { bg: '#FFF6DF', fg: '#7A5300' },
  kirmizi: { bg: '#FDECEC', fg: '#A3271F' },
  mavi: { bg: '#EEF3FF', fg: '#2450C8' },
  gri: { bg: '#F3F5FA', fg: '#5A6073' },
};

/**
 * Pazar › Talepler ve portföy (YonetimPazar.dc.html › talep; Karar 53). Seçip toplu işlem: talepte düzeltme iste, gizle,
 * kategori öner; araçta gizle, belge iste, galeriye bildir. Gizleme moderasyon kararıdır (itiraz yolu açık); kayıt
 * sahibine gerekçe şablonla bildirilir.
 */
export default function TaleplerVePortfoy() {
  const [tur, setTur] = useState<Tur>('talep');
  const [satirlar, setSatirlar] = useState<ListingRow[] | null>(null);
  const [secim, setSecim] = useState<Record<string, boolean>>({});
  const [ara, setAra] = useState('');
  const [aranan, setAranan] = useState('');
  const [islem, setIslem] = useState<string | null>(null);
  const [gerekce, setGerekce] = useState('');
  const [kategori, setKategori] = useState('');
  const [kategoriler, setKategoriler] = useState<{ slug: string; ad: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(() => {
    setSatirlar(null);
    yonetim<ListingRow[]>(`listings/${tur}${aranan ? `?q=${encodeURIComponent(aranan)}` : ''}`)
      .then(setSatirlar)
      .catch((e: Error) => setHata(e.message));
  }, [tur, aranan]);
  useEffect(yukle, [yukle]);
  useEffect(() => {
    fetch(`${API}/categories`)
      .then((r) => (r.ok ? (r.json() as Promise<PublicCategory[]>) : []))
      .then((l) =>
        setKategoriler(
          l.flatMap((c) => [
            { slug: c.slug, ad: c.name },
            ...c.children.map((x) => ({ slug: x.slug, ad: `${c.name} › ${x.name}` })),
          ]),
        ),
      )
      .catch(() => undefined);
  }, []);

  const islemler = tur === 'talep' ? DEMAND_ACTIONS : VEHICLE_ACTIONS;
  const secili = useMemo(() => (satirlar ?? []).filter((r) => secim[r.id]), [satirlar, secim]);
  const sablonlar = islem ? ((ACTION_REASONS as Record<string, string[]>)[`${tur}.${islem}`] ?? []) : [];
  const basliklar =
    tur === 'talep'
      ? { a: 'Talep', b: 'Kategori', c: 'İlk mesaj' }
      : { a: 'Araç', b: 'Doğrulama', c: 'Fiyat' };

  function sec(k: string) {
    setIslem(k);
    setGerekce((ACTION_REASONS as Record<string, string[]>)[`${tur}.${k}`]?.[0] ?? '');
    setKategori('');
    setHata(null);
  }

  async function uygula() {
    if (!islem) return;
    setBusy(true);
    setHata(null);
    setBilgi(null);
    try {
      const r = await yonetim<{ yapilan: number; atlanan: string[] }>(`listings/${tur}/islem`, {
        method: 'POST',
        body: {
          ids: secili.map((s) => s.id),
          islem,
          gerekce,
          ...(islem === 'kategori' ? { kategori } : {}),
        },
      });
      const ad = (islemler as Record<string, string>)[islem];
      setBilgi(
        `${r.yapilan} kayıt için “${ad}” uygulandı; sahiplerine gerekçe bildirildi.${
          r.atlanan.length ? ` Uygun olmadığı için atlananlar: ${r.atlanan.join(', ')}.` : ''
        }`,
      );
      setSecim({});
      setIslem(null);
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={stil.kutu1}>
        <h1 className="k-h1">Talepler ve portföy</h1>
        <p className="k-sub">
          Seçip toplu işlem yapabilirsin. Gizlenen talebin sahibine gerekçe şablonla bildirilir.
        </p>
      </div>
      <div role="tablist" aria-label="Tür" className={stil.kutu2}>
        {(
          [
            ['talep', 'Talepler'],
            ['arac', 'Portföy araçları'],
          ] as const
        ).map(([k, ad]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tur === k}
            onClick={() => {
              setTur(k);
              setSecim({});
              setIslem(null);
              setBilgi(null);
            }}
            className={cx(stil.dugme1, tur === k ? stil.dugme2 : stil.dugme3)}
            style={{ border: 0, borderBottom: `3px solid ${tur === k ? '#5B8CFF' : 'transparent'}` }}
          >
            {ad}
          </button>
        ))}
        {/* Tasarıma ek: numara ya da metinle arama */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAranan(ara.trim());
          }}
          className={stil.kutu3}
        >
          <label className="sr-only" htmlFor="ara">
            Ara
          </label>
          <input
            id="ara"
            value={ara}
            onChange={(e) => setAra(e.target.value)}
            placeholder={tur === 'talep' ? 'Talep no ya da başlık' : 'Araç no ya da galeri'}
            className={stil.girdi1}
          />
          <button type="submit" className={`k-btn-line ${stil.dugme4}`}>
            Ara
          </button>
        </form>
      </div>

      {hata ? (
        <p className="k-error" role="alert">
          {hata}
        </p>
      ) : null}
      {bilgi ? (
        <p className="k-ok" role="status">
          {bilgi}
        </p>
      ) : null}

      {secili.length ? (
        <div className={stil.kutu4}>
          <div className={stil.kutu5}>
            <span className={stil.metin1}>{secili.length} seçili</span>
            {Object.entries(islemler).map(([k, ad]) => (
              <button
                key={k}
                type="button"
                aria-pressed={islem === k}
                onClick={() => sec(k)}
                className={cx(stil.dugme5, islem === k ? stil.dugme6 : stil.dugme7)}
                style={{ border: `1px solid ${islem === k ? '#FFFFFF' : '#5A6073'}` }}
              >
                {ad}
              </button>
            ))}
          </div>
          {islem ? (
            <div className={stil.kutu6}>
              {islem === 'kategori' ? (
                <label className={stil.etiket1}>
                  Önerilen kategori
                  <select
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                    className={stil.girdi2}
                  >
                    <option value="">Seç</option>
                    {kategoriler.map((k) => (
                      <option key={k.slug} value={k.slug}>
                        {k.ad}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {sablonlar.length > 1 ? (
                <label className={stil.etiket1}>
                  Gerekçe şablonu
                  <select
                    value={sablonlar.includes(gerekce) ? gerekce : ''}
                    onChange={(e) => e.target.value && setGerekce(e.target.value)}
                    className={stil.girdi3}
                  >
                    <option value="">Kendim yazacağım</option>
                    {sablonlar.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className={stil.etiket1}>
                Sahibine giden gerekçe
                <textarea
                  value={gerekce}
                  onChange={(e) => setGerekce(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className={stil.girdi4}
                />
              </label>
              <div className={stil.kutu7}>
                <button
                  type="button"
                  className="k-btn-ok"
                  disabled={busy || gerekce.trim().length < 10 || (islem === 'kategori' && !kategori)}
                  onClick={() => void uygula()}
                >
                  {busy ? 'Uygulanıyor…' : `${secili.length} kayda uygula`}
                </button>
                <button type="button" onClick={() => setIslem(null)} className={stil.dugme8}>
                  Vazgeç
                </button>
                {islem === 'gizle' ? (
                  <span className={stil.metin2}>
                    Moderasyon kararı olarak kaydedilir; sahibi itiraz edebilir.
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className={`k-panel ${stil.kutu8}`}>
        <div className={stil.kutu9}>
          <span />
          <span>{basliklar.a}</span>
          <span>{basliklar.b}</span>
          <span>{basliklar.c}</span>
          <span>Durum</span>
        </div>
        {satirlar === null ? <div className="k-empty">Yükleniyor…</div> : null}
        {satirlar?.length === 0 ? <div className="k-empty">Kayıt yok.</div> : null}
        {satirlar?.map((t) => {
          const on = Boolean(secim[t.id]);
          const ton = TON[t.ton];
          return (
            <div key={t.id} className={cx(stil.kutu10, on ? stil.kutu11 : stil.kutu12)}>
              {/* biome-ignore lint/a11y/useSemanticElements: tasarımdaki düğme biçimli seçim kutusu (YonetimPazar) */}
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={`Seç: ${t.ad}`}
                onClick={() => setSecim((s) => ({ ...s, [t.id]: !s[t.id] }))}
                className={cx(stil.dugme9, on ? stil.dugme10 : stil.kutu12)}
                style={{ border: `2px solid ${on ? '#5B8CFF' : '#AEB5C4'}` }}
              >
                {on ? '✓' : ''}
              </button>
              <span className={stil.metin3}>
                <a href={`${WEB}${t.url}`} target="_blank" rel="noreferrer" className={stil.bag1}>
                  {t.ad}
                </a>
                <span className={stil.metin4}>{t.alt}</span>
              </span>
              <span className={stil.metin5}>{t.b}</span>
              <span className={stil.metin5}>{t.c}</span>
              <span>
                <span className={stil.metin6} style={{ background: ton.bg, color: ton.fg }}>
                  {t.durum}
                </span>
              </span>
            </div>
          );
        })}
      </section>
    </>
  );
}
