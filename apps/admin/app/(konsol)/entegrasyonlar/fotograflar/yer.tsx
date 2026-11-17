'use client';

import { useState } from 'react';
import { yonetim } from '../../../../lib/istemci';
import type { Alan } from './plaka';
import { type Hedef, YuklemeFormu } from './yukle';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const WEB = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
export const MAKYAJLAR: [string, string][] = [
  ['', 'Nesil geneli'],
  ['0', 'Makyaj öncesi'],
  ['1', '1. makyaj'],
  ['2', '2. makyaj'],
];

export interface Gorsel {
  id: string;
  status: 'aday' | 'secildi';
  /** commons; galeri: galerinin izin verdiği portföy fotoğrafı; yukleme: konsoldan elle (Karar 34) */
  origin: 'commons' | 'galeri' | 'yukleme';
  commonsFile: string;
  pageUrl: string;
  preview: string;
  width: number;
  height: number;
  author: string;
  license: string;
  score: number;
  facelift: number | null;
  yearFrom: number | null;
  yearTo: number | null;
  makyajAd: string | null;
  kopya: string | null;
  edited: boolean;
  blurAreas: Alan[] | null;
}

/** Fotoğrafın gideceği yer: nesil kodu, kodsuz kasa kuşağı ya da model geneli */
export interface Yer {
  hedef: Hedef;
  baslik: string;
  yillar: string | null;
  kategori: string | null;
  oneri: string;
  adaylar: Gorsel[];
  talepler?: { no: number; baslik: string; yayin: string | null }[];
}

export const onizleme = (i: Gorsel) =>
  i.kopya ? `${API}${i.kopya}` : i.origin === 'commons' ? i.preview : `${API}${i.preview}`;

const TUR_ADI: Record<Hedef['tur'], string> = { nesil: 'Nesil', kusak: 'Kasa', seri: 'Model geneli' };

/**
 * Bir yerin fotoğrafları (sahip isteği, 17 Kasım 2026): bekleyen talepler, seçili fotoğraf (kaldır, plaka), Commons
 * adayları (seç ya da seçiliyle değiştir, ele), Commons'ta kategori araması ve elle yükleme.
 */
export function YerKarti({
  yer,
  mesgul,
  act,
  yenile,
  plakaAc,
}: {
  yer: Yer;
  mesgul: string | null;
  act: (key: string, fn: () => Promise<string>) => Promise<void>;
  yenile: () => void;
  plakaAc: (i: Gorsel, sec?: (alanlar: Alan[]) => Promise<void>) => void;
}) {
  const [makyaj, setMakyaj] = useState<Record<string, string>>({});
  const [kategori, setKategori] = useState(yer.kategori ?? yer.oneri);
  const [yukle, setYukle] = useState(false);
  const h = yer.hedef;
  const secili = yer.adaylar.filter((i) => i.status === 'secildi');
  const adaylar = yer.adaylar.filter((i) => i.status === 'aday');
  const galeri = (i: Gorsel) => i.origin === 'galeri';
  const makyajOf = (i: Gorsel) =>
    makyaj[i.id] ??
    (galeri(i) && i.facelift !== null ? String(i.facelift) : h.makyaj !== null ? String(h.makyaj) : '');
  /** Aynı yerde seçili fotoğraf var: seçim onu kaldırıp yerine geçer */
  const dolu = (i: Gorsel) =>
    h.tur === 'seri'
      ? secili.some((s) => s.yearFrom === null && s.yearTo === null)
      : secili.some((s) => String(s.facelift ?? '') === makyajOf(i));

  function sec(i: Gorsel, plaka: { alanlar?: Alan[]; plakaYok?: boolean } = {}) {
    return act(i.id, async () => {
      const m = makyajOf(i);
      await yonetim(`catalog/images/${i.id}/select`, {
        method: 'POST',
        body: {
          ...(h.tur === 'seri' ? {} : { makyaj: m === '' ? null : Number(m) }),
          ...plaka,
          ...(dolu(i) ? { degistir: true } : {}),
        },
      });
      yenile();
      return `${yer.baslik}: fotoğraf seçildi ve depoya alındı; bu yerdeki talepler artık bu fotoğrafla görünüyor.`;
    });
  }

  return (
    <section className="k-panel" style={{ padding: 16, marginBottom: 14 }} aria-label={yer.baslik}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <span className="k-pill" style={{ background: '#EEF3FF', color: '#2B4FB8', marginRight: 8 }}>
            {TUR_ADI[h.tur]}
          </span>
          <strong style={{ fontSize: 15.5 }}>{yer.baslik}</strong>
          {yer.yillar ? <span style={{ color: '#5A6073', fontSize: 13.5 }}> · {yer.yillar}</span> : null}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="k-btn-line"
            style={{ fontSize: 13, padding: '6px 10px' }}
            onClick={() => setYukle((v) => !v)}
          >
            {yukle ? 'Yüklemeyi kapat' : 'Fotoğraf yükle'}
          </button>
        </div>
      </div>

      {yer.talepler?.length ? (
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#3A4052' }}>
          <strong>{yer.talepler.length} talep görsel bekliyor:</strong>{' '}
          {yer.talepler.slice(0, 8).map((t, n) => (
            <span key={t.no}>
              {n ? ', ' : ''}
              <a href={`${WEB}/talep/${t.no}`} target="_blank" rel="noreferrer">
                #{t.no}
              </a>
            </span>
          ))}
          {yer.talepler.length > 8 ? ` ve ${yer.talepler.length - 8} talep daha` : ''}. Şimdilik marka ve
          model kapağıyla görünüyorlar.
        </p>
      ) : null}

      <form
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', marginTop: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          void act(`ara-${h.id}`, async () => {
            const r = await yonetim<{ bulunan: number; eklenen: number }>('catalog/images/ara', {
              method: 'POST',
              body: { tur: h.tur, id: h.id, kategori },
            });
            yenile();
            return r.bulunan
              ? `Commons “${kategori}”: ${r.bulunan} uygun fotoğraf, ${r.eklenen} yeni aday eklendi.`
              : `Commons “${kategori}” kategorisinde lisansı ve ölçüsü uygun fotoğraf bulunamadı; kategori adını Commons'tan kontrol et ya da fotoğrafı elle yükle.`;
          });
        }}
      >
        <label className="k-field" style={{ flex: '1 1 260px', margin: 0 }}>
          Commons kategorisi
          <input value={kategori} onChange={(e) => setKategori(e.target.value)} />
        </label>
        <button type="submit" className="k-btn-line" disabled={mesgul !== null || kategori.trim().length < 2}>
          {mesgul === `ara-${h.id}` ? 'Aranıyor…' : "Commons'ta ara"}
        </button>
        <a
          href={`https://commons.wikimedia.org/wiki/Category:${encodeURIComponent(kategori.replace(/ /g, '_'))}`}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 13, paddingBottom: 12 }}
        >
          Commons'ta aç
        </a>
      </form>

      {yukle ? (
        <YuklemeFormu
          hedef={h}
          iptal={() => setYukle(false)}
          bitti={(m) => {
            setYukle(false);
            yenile();
            void act('yuklendi', async () => m);
          }}
        />
      ) : null}

      {yer.adaylar.length === 0 ? (
        <p style={{ margin: '12px 0 0', fontSize: 13.5, color: '#5A6073' }}>
          Henüz aday yok. Commons'ta kategoriyle ara ya da bulduğun fotoğrafı kaynağı ve lisansıyla yükle.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
            marginTop: 12,
          }}
        >
          {[...secili, ...adaylar].map((i) => (
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
                {/* biome-ignore lint/performance/noImgElement: konsol önizlemesi, Next görsel iyileştirmesi gerekmez */}
                <img
                  src={onizleme(i)}
                  alt={galeri(i) ? `${i.author} portföy fotoğrafı` : i.commonsFile}
                  loading="lazy"
                  style={{ width: '100%', aspectRatio: '3 / 2', objectFit: 'cover', display: 'block' }}
                />
              </a>
              <figcaption style={{ padding: 10, fontSize: 12, color: '#3A4052' }}>
                {i.origin !== 'commons' ? (
                  <span
                    className="k-pill"
                    style={{
                      background: '#FFF6DD',
                      color: '#7A5A00',
                      marginBottom: 6,
                      display: 'inline-block',
                    }}
                  >
                    {galeri(i) ? 'Galeri fotoğrafı' : 'Elle yüklendi'}
                  </span>
                ) : null}
                <span style={{ display: 'block', fontWeight: 700, overflowWrap: 'anywhere' }}>
                  {i.origin === 'commons' ? i.commonsFile : i.author}
                </span>
                <span style={{ display: 'block', color: '#5A6073' }}>
                  {galeri(i) ? 'Galeri portföyü' : i.author} · {i.license} · {i.width}×{i.height}
                </span>
                {i.status === 'secildi' ? (
                  <span
                    style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}
                  >
                    <span className="k-pill" style={{ background: '#E7FAF0', color: '#11683F' }}>
                      Yayında · {i.makyajAd}
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
                      disabled={mesgul !== null}
                      onClick={() => plakaAc(i)}
                    >
                      {i.edited ? 'Alanları düzenle' : 'Plakayı bulanıklaştır'}
                    </button>
                    {i.edited && !galeri(i) ? (
                      <button
                        type="button"
                        className="k-btn-line"
                        style={{ fontSize: 13, padding: '6px 10px' }}
                        disabled={mesgul !== null}
                        onClick={() =>
                          act(i.id, async () => {
                            await yonetim(`catalog/images/${i.id}/unblur`, { method: 'POST', body: {} });
                            yenile();
                            return 'Düzenleme geri alındı; özgün kopya gösteriliyor.';
                          })
                        }
                      >
                        Geri al
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="k-btn-line"
                      style={{ fontSize: 13, padding: '6px 10px', color: '#A3271F' }}
                      disabled={mesgul !== null}
                      onClick={() => {
                        if (
                          !window.confirm(
                            'Fotoğraf yayından kaldırılsın mı? Kayıt silinmez; yerine başkasını seçebilirsin.',
                          )
                        )
                          return;
                        void act(i.id, async () => {
                          await yonetim(`catalog/images/${i.id}/remove`, { method: 'POST', body: {} });
                          yenile();
                          return 'Fotoğraf kaldırıldı. Başka fotoğraf seçilene kadar talepler marka ve model kapağıyla görünür.';
                        });
                      }}
                    >
                      Kaldır
                    </button>
                  </span>
                ) : (
                  <span style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="k-btn-line"
                      style={{ fontSize: 13, padding: '6px 10px' }}
                      disabled={mesgul !== null}
                      onClick={() =>
                        act(i.id, async () => {
                          await yonetim(`catalog/images/${i.id}/reject`, { method: 'POST', body: {} });
                          yenile();
                          return 'Aday elendi.';
                        })
                      }
                    >
                      Ele
                    </button>
                    {h.tur === 'seri' ? null : (
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
                    )}
                    {galeri(i) ? (
                      <>
                        <button
                          type="button"
                          className="k-btn-ok"
                          style={{ fontSize: 13, padding: '6px 10px' }}
                          disabled={mesgul !== null}
                          onClick={() => plakaAc(i, (alanlar) => sec(i, { alanlar }))}
                        >
                          Plakayı işaretle ve seç
                        </button>
                        <button
                          type="button"
                          className="k-btn-line"
                          style={{ fontSize: 13, padding: '6px 10px' }}
                          disabled={mesgul !== null}
                          onClick={() => sec(i, { plakaYok: true })}
                        >
                          {mesgul === i.id ? 'Alınıyor…' : 'Plaka görünmüyor, seç'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="k-btn-ok"
                        style={{ fontSize: 13, padding: '6px 10px' }}
                        disabled={mesgul !== null}
                        onClick={() => sec(i)}
                      >
                        {mesgul === i.id ? 'Alınıyor…' : dolu(i) ? 'Bununla değiştir' : 'Bunu seç'}
                      </button>
                    )}
                  </span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
