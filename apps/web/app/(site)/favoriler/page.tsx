'use client';

import { type DemandSearchQuery, MAX_SAVED_SEARCHES, SAVED_SEARCH_NOTIFY } from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { HesabimMenu } from '../../../components/hesabim-menu';
import { cx } from '../../../lib/cx';
import { istek, useGiris } from '../../../lib/istemci';
import { aramaAdresi, binlik, butceAraligi, uzunTarih, yilAraligi, zaman } from '../../../lib/talep-bicim';
import { type FavoriArac, FavoriAraclar } from './araclar';
import stil from './page.module.css';

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
    <div className={`rr-sayfa ${stil.kutu1}`}>
      <HesabimMenu aktif="/favoriler" />

      <main className={stil.kutu2}>
        <h1 className={stil.baslik1}>Favoriler ve kayıtlı aramalar</h1>
        <p className={stil.metin1}>
          Satmak istediğin araca uyan talepleri takip et; yeni talep gelince haber verelim.
        </p>

        <div role="tablist" aria-label="Görünüm" className={stil.kutu3}>
          {sekmeler.map(([k, ad, n]) => {
            const on = sekme === k;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setSekme(k)}
                className={cx(stil.dugme1, on ? stil.dugme2 : stil.dugme3)}
              >
                {ad} <span className={cx(on ? stil.metin2 : stil.metin3)}>{n ?? ''}</span>
              </button>
            );
          })}
        </div>

        {hata ? (
          <p role="alert" className={stil.metin4}>
            {hata}
          </p>
        ) : null}

        {sekme === 'fav' ? (
          <>
            <div className="rr-iki-sutun">
              {(favoriler ?? []).map((f) => {
                const [etiket, bg, fg] = DURUM[f.durum];
                return (
                  <article key={f.no} className={cx(stil.kutu4, f.yazilabilir ? stil.kutu5 : stil.kutu6)}>
                    <div className={stil.kutu7}>
                      <span className={stil.metin5} style={{ background: bg, color: fg }}>
                        {etiket}
                      </span>
                      <button
                        type="button"
                        onClick={() => kaldir(f)}
                        aria-label="Favorilerden çıkar"
                        className={stil.dugme4}
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
                    <Link href={`/talep/${f.no}`} className={stil.bag1}>
                      {f.baslik}
                    </Link>
                    <p className={stil.metin6}>{ozet(f) || f.category.name}</p>
                    <p className={stil.metin7}>
                      {[f.sahip, [f.il, f.ilce].filter(Boolean).join(', '), zaman(f.yayin)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <div className={stil.kutu8}>
                      {f.yazilabilir ? (
                        <Link href={`/talep/${f.no}`} className={stil.bag2}>
                          Mesaj gönder
                        </Link>
                      ) : (
                        <span className={stil.metin8}>{KAPALI_NOT[f.durum]}</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            {favoriler && favoriler.length === 0 ? (
              <div className={stil.kutu9}>
                Favori talebin kalmadı. Talep sayfalarındaki kalp simgesiyle ekleyebilirsin.
              </div>
            ) : null}
          </>
        ) : sekme === 'arac' ? (
          <FavoriAraclar liste={araclar} kaldir={aracKaldir} />
        ) : (
          <div className={stil.kutu10}>
            {aramalar && aramalar.length === 0 ? (
              <div className={stil.kutu9}>
                Kayıtlı araman yok. <Link href="/talepler">Talep listesinde</Link> filtreleri seçip “Aramayı
                kaydet”e bas.
              </div>
            ) : null}
            {(aramalar ?? []).map((a) => (
              <article key={a.id} className={stil.kutu11}>
                <div className={stil.kutu12}>
                  <div className={stil.kutu13}>
                    {duzen?.id === a.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          adKaydet();
                        }}
                        className={stil.kutu14}
                      >
                        <input
                          aria-label="Arama adı"
                          value={duzen.ad}
                          maxLength={80}
                          onChange={(e) => setDuzen({ id: a.id, ad: e.target.value })}
                          className={stil.girdi1}
                        />
                        <button type="submit" disabled={!duzen.ad.trim()} className={stil.dugme5}>
                          Kaydet
                        </button>
                        <button type="button" onClick={() => setDuzen(null)} className={stil.dugme6}>
                          Vazgeç
                        </button>
                      </form>
                    ) : (
                      <h2 className={stil.baslik2}>{a.ad}</h2>
                    )}
                    {a.yeni ? (
                      <button type="button" onClick={() => gor(a)} className={stil.dugme7}>
                        {a.yeni} yeni talep
                      </button>
                    ) : null}
                  </div>
                  <div className={stil.kutu15}>
                    {a.kriterler.map((c) => (
                      <span key={c} className={stil.metin9}>
                        {c}
                      </span>
                    ))}
                  </div>
                  <p className={stil.metin10}>
                    {a.toplam === null
                      ? 'Arama şu an yanıt vermiyor'
                      : `Şu an ${a.toplam} aktif talep uyuyor`}{' '}
                    · Kaydedildi {uzunTarih(a.olusturuldu)}
                  </p>
                </div>
                <div className={stil.kutu16}>
                  <span className={stil.metin11}>Bildirim</span>
                  <div role="radiogroup" aria-label={`${a.ad} bildirimi`} className={stil.kutu17}>
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
                          className={cx(stil.dugme8, on ? stil.dugme9 : stil.dugme10)}
                        >
                          {b.ad}
                        </button>
                      );
                    })}
                  </div>
                  <div className={stil.kutu18}>
                    <a
                      href={aramaAdresi(a.sorgu)}
                      onClick={(e) => {
                        e.preventDefault();
                        gor(a);
                      }}
                      className={stil.bag3}
                    >
                      Talepleri gör
                    </a>
                    <button
                      type="button"
                      onClick={() => setDuzen({ id: a.id, ad: a.ad })}
                      className={stil.dugme11}
                    >
                      Düzenle
                    </button>
                    <button type="button" onClick={() => sil(a)} className={stil.dugme12}>
                      Sil
                    </button>
                  </div>
                </div>
              </article>
            ))}
            <p className={stil.metin12}>
              En fazla {MAX_SAVED_SEARCHES} kayıtlı arama tutabilirsin. Anlık bildirim telefonuna, günlük özet
              e-postana gelir.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
