'use client';

import {
  ACTION_REASONS,
  DEMAND_ACTIONS,
  type ListingRow,
  type PublicCategory,
  VEHICLE_ACTIONS,
} from '@rengarenk/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { yonetim } from '../../../lib/istemci';

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
const KOLON = '36px minmax(0, 2.6fr) minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1.2fr)';

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
      <div style={{ marginBottom: 14 }}>
        <h1 className="k-h1">Talepler ve portföy</h1>
        <p className="k-sub">
          Seçip toplu işlem yapabilirsin. Gizlenen talebin sahibine gerekçe şablonla bildirilir.
        </p>
      </div>
      <div
        role="tablist"
        aria-label="Tür"
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid #E3E6EF',
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
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
            style={{
              border: 0,
              borderBottom: `3px solid ${tur === k ? '#5B8CFF' : 'transparent'}`,
              background: 'transparent',
              padding: '10px 12px',
              fontSize: 14,
              fontWeight: tur === k ? 800 : 600,
              color: tur === k ? '#1E2333' : '#3A4052',
              cursor: 'pointer',
            }}
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
          style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 6 }}
        >
          <label className="sr-only" htmlFor="ara">
            Ara
          </label>
          <input
            id="ara"
            value={ara}
            onChange={(e) => setAra(e.target.value)}
            placeholder={tur === 'talep' ? 'Talep no ya da başlık' : 'Araç no ya da galeri'}
            style={{
              border: '1px solid #D5DAE5',
              borderRadius: 10,
              padding: '7px 10px',
              fontSize: 13.5,
              width: 220,
            }}
          />
          <button type="submit" className="k-btn-line" style={{ fontSize: 13, padding: '7px 12px' }}>
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
        <div
          style={{
            background: '#1E2333',
            color: '#FFFFFF',
            borderRadius: 14,
            padding: '10px 14px',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 800, marginRight: 8 }}>{secili.length} seçili</span>
            {Object.entries(islemler).map(([k, ad]) => (
              <button
                key={k}
                type="button"
                aria-pressed={islem === k}
                onClick={() => sec(k)}
                style={{
                  border: `1px solid ${islem === k ? '#FFFFFF' : '#5A6073'}`,
                  background: islem === k ? '#3A4052' : 'transparent',
                  borderRadius: 10,
                  padding: '7px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#FFFFFF',
                  cursor: 'pointer',
                }}
              >
                {ad}
              </button>
            ))}
          </div>
          {islem ? (
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              {islem === 'kategori' ? (
                <label style={{ fontSize: 12.5, fontWeight: 700 }}>
                  Önerilen kategori
                  <select
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                    style={{
                      display: 'block',
                      marginTop: 4,
                      borderRadius: 8,
                      padding: '6px 8px',
                      fontSize: 13.5,
                    }}
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
                <label style={{ fontSize: 12.5, fontWeight: 700 }}>
                  Gerekçe şablonu
                  <select
                    value={sablonlar.includes(gerekce) ? gerekce : ''}
                    onChange={(e) => e.target.value && setGerekce(e.target.value)}
                    style={{
                      display: 'block',
                      marginTop: 4,
                      borderRadius: 8,
                      padding: '6px 8px',
                      fontSize: 13.5,
                      maxWidth: '100%',
                    }}
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
              <label style={{ fontSize: 12.5, fontWeight: 700 }}>
                Sahibine giden gerekçe
                <textarea
                  value={gerekce}
                  onChange={(e) => setGerekce(e.target.value)}
                  rows={2}
                  maxLength={500}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 4,
                    borderRadius: 8,
                    padding: 8,
                    font: 'inherit',
                    fontSize: 13.5,
                    fontWeight: 400,
                    boxSizing: 'border-box',
                  }}
                />
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="k-btn-ok"
                  disabled={busy || gerekce.trim().length < 10 || (islem === 'kategori' && !kategori)}
                  onClick={() => void uygula()}
                >
                  {busy ? 'Uygulanıyor…' : `${secili.length} kayda uygula`}
                </button>
                <button
                  type="button"
                  onClick={() => setIslem(null)}
                  style={{
                    border: '1px solid #5A6073',
                    background: 'transparent',
                    color: '#FFFFFF',
                    borderRadius: 10,
                    padding: '7px 12px',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Vazgeç
                </button>
                {islem === 'gizle' ? (
                  <span style={{ fontSize: 12.5, color: '#D5DAE5', alignSelf: 'center' }}>
                    Moderasyon kararı olarak kaydedilir; sahibi itiraz edebilir.
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="k-panel" style={{ overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: KOLON,
            gap: 8,
            padding: '10px 18px',
            background: '#F3F5FA',
            fontSize: 11.5,
            fontWeight: 800,
            color: '#5A6073',
            textTransform: 'uppercase',
            letterSpacing: 0.3,
          }}
        >
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
            <div
              key={t.id}
              style={{
                display: 'grid',
                gridTemplateColumns: KOLON,
                gap: 8,
                alignItems: 'center',
                padding: '11px 18px',
                borderTop: '1px solid #EEF0F5',
                fontSize: 13.5,
                background: on ? '#F6F8FD' : '#FFFFFF',
              }}
            >
              {/* biome-ignore lint/a11y/useSemanticElements: tasarımdaki düğme biçimli seçim kutusu (YonetimPazar) */}
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={`Seç: ${t.ad}`}
                onClick={() => setSecim((s) => ({ ...s, [t.id]: !s[t.id] }))}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  border: `2px solid ${on ? '#5B8CFF' : '#AEB5C4'}`,
                  background: on ? '#5B8CFF' : '#FFFFFF',
                  color: '#FFFFFF',
                  fontSize: 12,
                  lineHeight: '16px',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                {on ? '✓' : ''}
              </button>
              <span style={{ minWidth: 0 }}>
                <a
                  href={`${WEB}${t.url}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'block', fontWeight: 800, color: '#1E2333' }}
                >
                  {t.ad}
                </a>
                <span style={{ display: 'block', fontSize: 12, color: '#5A6073' }}>{t.alt}</span>
              </span>
              <span style={{ color: '#3A4052' }}>{t.b}</span>
              <span style={{ color: '#3A4052' }}>{t.c}</span>
              <span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: ton.bg,
                    color: ton.fg,
                  }}
                >
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
