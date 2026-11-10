'use client';

import { type DemandSearchQuery, MAX_SAVED_SEARCHES, SAVED_SEARCH_NOTIFY } from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { HesabimMenu } from '../../../components/hesabim-menu';
import { istek, useGiris } from '../../../lib/istemci';
import { aramaAdresi, binlik, butceAraligi, uzunTarih, yilAraligi, zaman } from '../../../lib/talep-bicim';
import { type FavoriArac, FavoriAraclar } from './araclar';

/** Favoriler ve kayıtlı aramalar (Karar 06.4, 30) · Favoriler.dc.html */

type Durum = 'yayinda' | 'son_gunler' | 'pasif' | 'bulundu' | 'kapandi';
interface Favori {
  no: number;
  baslik: string;
  category: { slug: string; name: string };
  arac: string;
  kmMax: number | null;
  durum: Durum;
  yazilabilir: boolean;
  sahip: string;
  il: string | null;
  ilce: string | null;
  yilMin: number | null;
  yilMax: number | null;
  butceMin: number | null;
  butceMax: number | null;
  yayin: string | null;
}
interface Arama {
  id: string;
  ad: string;
  sorgu: DemandSearchQuery;
  kriterler: string[];
  bildirim: string;
  toplam: number | null;
  yeni: number | null;
  olusturuldu: string;
}

const DURUM: Record<Durum, [string, string, string]> = {
  yayinda: ['Yayında', '#E7FAF0', '#11683F'],
  son_gunler: ['Son 2 gün', '#FFF6DF', '#7A5300'],
  pasif: ['Pasif', '#FFF6DF', '#7A5300'],
  bulundu: ['Aracını buldu', '#F3F5FA', '#3A4052'],
  kapandi: ['Kapandı', '#F3F5FA', '#3A4052'],
};
const KAPALI_NOT: Partial<Record<Durum, string>> = {
  pasif: 'Talep şu an pasif; sahibi yeniden yayına alınca yazabilirsin.',
  bulundu: 'Talep sahibi aracını buldu; yeni mesaj gönderilemez.',
  kapandi: 'Talep kapandı; yeni mesaj gönderilemez.',
};

const ozet = (f: Favori) =>
  [
    f.arac,
    yilAraligi(f.yilMin, f.yilMax),
    f.kmMax ? `En fazla ${binlik(f.kmMax)} km` : '',
    butceAraligi(f.butceMin, f.butceMax),
  ]
    .filter(Boolean)
    .join(' · ');

export default function Favoriler() {
  const giris = useGiris();
  const router = useRouter();
  const [sekme, setSekme] = useState<'fav' | 'arac' | 'ara'>('fav');
  const [araclar, setAraclar] = useState<FavoriArac[] | null>(null);
  const [favoriler, setFavoriler] = useState<Favori[] | null>(null);
  const [aramalar, setAramalar] = useState<Arama[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [duzen, setDuzen] = useState<{ id: string; ad: string } | null>(null);

  const yukle = useCallback(async () => {
    const [f, a, v] = await Promise.all([
      istek<Favori[]>('/favorites'),
      istek<Arama[]>('/saved-searches'),
      istek<FavoriArac[]>('/favoriler/araclar'),
    ]);
    setFavoriler(f);
    setAramalar(a);
    setAraclar(v);
  }, []);

  useEffect(() => {
    if (giris === false) router.replace('/giris?sonra=/favoriler');
    if (!giris) return;
    const q = new URLSearchParams(window.location.search).get('sekme');
    if (q === 'aramalar') setSekme('ara');
    if (q === 'araclar') setSekme('arac');
    yukle().catch((e: Error) => setHata(e.message));
  }, [giris, router, yukle]);

  async function dene(is: () => Promise<unknown>) {
    setHata(null);
    try {
      await is();
    } catch (e) {
      setHata((e as Error).message);
      await yukle().catch(() => undefined);
    }
  }

  const kaldir = (f: Favori) =>
    dene(async () => {
      setFavoriler((l) => (l ?? []).filter((x) => x.no !== f.no));
      await istek(`/favorites/${f.no}`, { method: 'DELETE' });
    });

  const aracKaldir = (a: FavoriArac) =>
    dene(async () => {
      setAraclar((l) => (l ?? []).filter((x) => x.no !== a.no));
      await istek(`/araclar/${a.no}/favori`, { method: 'DELETE' });
    });

  const bildirim = (a: Arama, key: string) =>
    dene(async () => {
      setAramalar((l) => (l ?? []).map((x) => (x.id === a.id ? { ...x, bildirim: key } : x)));
      await istek(`/saved-searches/${a.id}`, { method: 'PATCH', body: { bildirim: key } });
    });

  const sil = (a: Arama) =>
    dene(async () => {
      setAramalar((l) => (l ?? []).filter((x) => x.id !== a.id));
      await istek(`/saved-searches/${a.id}`, { method: 'DELETE' });
    });

  const gor = (a: Arama) =>
    dene(async () => {
      await istek(`/saved-searches/${a.id}`, { method: 'PATCH', body: { gordum: true } });
      router.push(aramaAdresi(a.sorgu));
    });

  const adKaydet = () =>
    dene(async () => {
      if (!duzen) return;
      const ad = duzen.ad.trim();
      await istek(`/saved-searches/${duzen.id}`, { method: 'PATCH', body: { ad } });
      setAramalar((l) => (l ?? []).map((x) => (x.id === duzen.id ? { ...x, ad } : x)));
      setDuzen(null);
    });

  // "Favori araçlar" tasarıma ek sekme (araç sayfasındaki "Favorilere ekle")
  const sekmeler: ['fav' | 'arac' | 'ara', string, number | null][] = [
    ['fav', 'Favori talepler', favoriler?.length ?? null],
    ['arac', 'Favori araçlar', araclar?.length ?? null],
    ['ara', 'Kayıtlı aramalar', aramalar?.length ?? null],
  ];

  return (
    <div
      style={{
        maxWidth: 1360,
        margin: '0 auto',
        padding: '24px 24px 64px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: 24,
      }}
    >
      <HesabimMenu aktif="/favoriler" />

      <main style={{ flex: '999 1 760px', minWidth: 0 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>
          Favoriler ve kayıtlı aramalar
        </h1>
        <p style={{ margin: '0 0 16px', fontSize: 14.5, color: 'var(--rr-soluk, #5A6073)' }}>
          Satmak istediğin araca uyan talepleri takip et; yeni talep gelince haber verelim.
        </p>

        <div
          role="tablist"
          aria-label="Görünüm"
          style={{
            display: 'flex',
            gap: 6,
            background: 'var(--rr-kart, #FFFFFF)',
            border: '1px solid var(--rr-cizgi, #E3E6EF)',
            borderRadius: 'var(--rr-buton-kose)',
            padding: 6,
            marginBottom: 16,
            maxWidth: 520,
          }}
        >
          {sekmeler.map(([k, ad, n]) => {
            const on = sekme === k;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setSekme(k)}
                style={{
                  flex: 1,
                  border: 0,
                  background: on ? '#EEF3FF' : 'transparent',
                  borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
                  padding: '11px 12px',
                  fontSize: 14.5,
                  fontWeight: on ? 800 : 600,
                  color: on ? 'var(--rr-murekkep, #1E2333)' : '#3A4052',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {ad}{' '}
                <span style={{ color: on ? 'var(--rr-baglanti, #2450C8)' : 'var(--rr-soluk, #5A6073)' }}>
                  {n ?? ''}
                </span>
              </button>
            );
          })}
        </div>

        {hata ? (
          <p
            role="alert"
            style={{
              margin: '0 0 14px',
              background: '#FFF0EE',
              border: '1px solid #F5C6C0',
              borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
              padding: '10px 14px',
              fontSize: 14,
              color: '#A3271F',
            }}
          >
            {hata}
          </p>
        ) : null}

        {sekme === 'fav' ? (
          <>
            <div className="rr-iki-sutun">
              {(favoriler ?? []).map((f) => {
                const [etiket, bg, fg] = DURUM[f.durum];
                return (
                  <article
                    key={f.no}
                    style={{
                      background: 'var(--rr-kart, #FFFFFF)',
                      border: '1px solid var(--rr-cizgi, #E3E6EF)',
                      borderRadius: 'var(--rr-kart-kose)',
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      opacity: f.yazilabilir ? 1 : 0.75,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: 'var(--rr-etiket-kose)',
                          background: bg,
                          color: fg,
                        }}
                      >
                        {etiket}
                      </span>
                      <button
                        type="button"
                        onClick={() => kaldir(f)}
                        aria-label="Favorilerden çıkar"
                        style={{
                          flex: 'none',
                          border: 0,
                          background: 'transparent',
                          padding: 2,
                          cursor: 'pointer',
                        }}
                      >
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="#FF6FB5"
                          stroke="#E0479A"
                          strokeWidth="1.6"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M12 20s-7-4.4-9-9.1C1.7 7.6 3.9 4.5 7.1 4.5c2 0 3.4 1.1 4.9 2.9 1.5-1.8 2.9-2.9 4.9-2.9 3.2 0 5.4 3.1 4.1 6.4C19 15.6 12 20 12 20z" />
                        </svg>
                      </button>
                    </div>
                    <Link
                      href={`/talep/${f.no}`}
                      style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--rr-murekkep, #1E2333)' }}
                    >
                      {f.baslik}
                    </Link>
                    <p style={{ margin: 0, fontSize: 13.5, color: '#3A4052' }}>
                      {ozet(f) || f.category.name}
                    </p>
                    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--rr-soluk, #5A6073)' }}>
                      {[f.sahip, [f.il, f.ilce].filter(Boolean).join(', '), zaman(f.yayin)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                      {f.yazilabilir ? (
                        <Link
                          href={`/talep/${f.no}`}
                          style={{
                            background: 'var(--rr-mavi, #5B8CFF)',
                            borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
                            padding: '9px 14px',
                            fontSize: 13.5,
                            fontWeight: 800,
                            color: 'var(--rr-maviYazi, #1E2333)',
                          }}
                        >
                          Mesaj gönder
                        </Link>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--rr-soluk, #5A6073)', padding: '8px 0' }}>
                          {KAPALI_NOT[f.durum]}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            {favoriler && favoriler.length === 0 ? (
              <div
                style={{
                  background: 'var(--rr-kart, #FFFFFF)',
                  border: '1px dashed #C9CFDB',
                  borderRadius: 'var(--rr-kart-kose)',
                  padding: '36px 20px',
                  textAlign: 'center',
                  fontSize: 15,
                  color: 'var(--rr-soluk, #5A6073)',
                }}
              >
                Favori talebin kalmadı. Talep sayfalarındaki kalp simgesiyle ekleyebilirsin.
              </div>
            ) : null}
          </>
        ) : sekme === 'arac' ? (
          <FavoriAraclar liste={araclar} kaldir={aracKaldir} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {aramalar && aramalar.length === 0 ? (
              <div
                style={{
                  background: 'var(--rr-kart, #FFFFFF)',
                  border: '1px dashed #C9CFDB',
                  borderRadius: 'var(--rr-kart-kose)',
                  padding: '36px 20px',
                  textAlign: 'center',
                  fontSize: 15,
                  color: 'var(--rr-soluk, #5A6073)',
                }}
              >
                Kayıtlı araman yok. <Link href="/talepler">Talep listesinde</Link> filtreleri seçip “Aramayı
                kaydet”e bas.
              </div>
            ) : null}
            {(aramalar ?? []).map((a) => (
              <article
                key={a.id}
                style={{
                  background: 'var(--rr-kart, #FFFFFF)',
                  border: '1px solid var(--rr-cizgi, #E3E6EF)',
                  borderRadius: 'var(--rr-kart-kose)',
                  padding: 18,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '14px 20px',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: '999 1 360px', minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    {duzen?.id === a.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          adKaydet();
                        }}
                        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flex: 1, minWidth: 0 }}
                      >
                        <input
                          aria-label="Arama adı"
                          value={duzen.ad}
                          maxLength={80}
                          onChange={(e) => setDuzen({ id: a.id, ad: e.target.value })}
                          style={{
                            flex: '1 1 220px',
                            minWidth: 0,
                            border: '1px solid #D5DAE5',
                            borderRadius: 'calc(var(--rr-buton-kose) * 10 / 14)',
                            padding: '8px 10px',
                            fontSize: 15,
                            fontWeight: 700,
                            color: 'var(--rr-murekkep, #1E2333)',
                          }}
                        />
                        <button
                          type="submit"
                          disabled={!duzen.ad.trim()}
                          style={{
                            border: 0,
                            borderRadius: 'calc(var(--rr-buton-kose) * 9 / 14)',
                            background: 'var(--rr-mavi, #5B8CFF)',
                            color: 'var(--rr-maviYazi, #1E2333)',
                            fontWeight: 700,
                            fontSize: 14,
                            padding: '9px 16px',
                            cursor: 'pointer',
                          }}
                        >
                          Kaydet
                        </button>
                        <button
                          type="button"
                          onClick={() => setDuzen(null)}
                          style={{
                            border: 0,
                            background: 'transparent',
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: 'var(--rr-soluk, #5A6073)',
                            cursor: 'pointer',
                          }}
                        >
                          Vazgeç
                        </button>
                      </form>
                    ) : (
                      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{a.ad}</h2>
                    )}
                    {a.yeni ? (
                      <button
                        type="button"
                        onClick={() => gor(a)}
                        style={{
                          border: 0,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: 12.5,
                          fontWeight: 800,
                          padding: '3px 10px',
                          borderRadius: 'var(--rr-etiket-kose)',
                          background: '#FFEEF6',
                          color: '#A3236A',
                        }}
                      >
                        {a.yeni} yeni talep
                      </button>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {a.kriterler.map((c) => (
                      <span
                        key={c}
                        style={{
                          background: '#F3F5FA',
                          borderRadius: 'var(--rr-etiket-kose)',
                          padding: '5px 11px',
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: '#3A4052',
                        }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--rr-soluk, #5A6073)' }}>
                    {a.toplam === null
                      ? 'Arama şu an yanıt vermiyor'
                      : `Şu an ${a.toplam} aktif talep uyuyor`}{' '}
                    · Kaydedildi {uzunTarih(a.olusturuldu)}
                  </p>
                </div>
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: 'var(--rr-soluk, #5A6073)',
                      marginBottom: 6,
                    }}
                  >
                    Bildirim
                  </span>
                  <div
                    role="radiogroup"
                    aria-label={`${a.ad} bildirimi`}
                    style={{
                      display: 'flex',
                      gap: 4,
                      background: '#F3F5FA',
                      borderRadius: 'calc(var(--rr-buton-kose) * 12 / 14)',
                      padding: 4,
                    }}
                  >
                    {SAVED_SEARCH_NOTIFY.map((b) => {
                      const on = a.bildirim === b.key;
                      return (
                        // biome-ignore lint/a11y/useSemanticElements: tasarımdaki gibi bölmeli seçim düğmesi
                        <button
                          key={b.key}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => (on ? undefined : bildirim(a, b.key))}
                          style={{
                            flex: 1,
                            border: 0,
                            background: on ? 'var(--rr-kart, #FFFFFF)' : 'transparent',
                            borderRadius: 'calc(var(--rr-buton-kose) * 9 / 14)',
                            padding: '8px 6px',
                            fontSize: 13,
                            fontWeight: on ? 800 : 600,
                            color: 'var(--rr-murekkep, #1E2333)',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {b.ad}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 13.5 }}>
                    <a
                      href={aramaAdresi(a.sorgu)}
                      onClick={(e) => {
                        e.preventDefault();
                        gor(a);
                      }}
                      style={{ fontWeight: 700 }}
                    >
                      Talepleri gör
                    </a>
                    <button
                      type="button"
                      onClick={() => setDuzen({ id: a.id, ad: a.ad })}
                      style={{
                        border: 0,
                        background: 'transparent',
                        padding: 0,
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: 'var(--rr-baglanti, #2450C8)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => sil(a)}
                      style={{
                        border: 0,
                        background: 'transparent',
                        padding: 0,
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: '#A3271F',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </article>
            ))}
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--rr-soluk, #5A6073)' }}>
              En fazla {MAX_SAVED_SEARCHES} kayıtlı arama tutabilirsin. Anlık bildirim telefonuna, günlük özet
              e-postana gelir.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
