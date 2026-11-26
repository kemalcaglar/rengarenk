'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../../lib/istemci';
import stil from './page.module.css';
import { type Alan, PlakaDuzenle } from './plaka';
import { type Gorsel, onizleme, type Yer, YerKarti } from './yer';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Tab = 'talepler' | 'bekleyen' | 'secili' | 'ara';

interface Bekleyen {
  hedefler: Yer[];
  toplam: number;
  katalogsuz: number;
}

/**
 * Araç görselleri (Karar 34; sahip isteği, 17 Kasım 2026): her talep görselle yayına girer. Fotoğraf nesle, kasa
 * kuşağına ya da modele (model geneli) bağlanır; katalogda fotoğraf yoksa talep marka ve model kapağıyla görünür ve
 * burada "Görsel bekleyen talepler" listesine düşer. Katalog sorumlusu Commons adaylarından seçer ya da bulduğu
 * fotoğrafı kaynağı ve lisansıyla yükler; seçili fotoğrafı değiştirir, kaldırır, plakasını bulanıklaştırır.
 */
export default function AracGorselleri() {
  const [tab, setTab] = useState<Tab>('talepler');
  const [bekleyen, setBekleyen] = useState<Bekleyen | null>(null);
  const [yerler, setYerler] = useState<Yer[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [seriler, setSeriler] = useState<{ id: string; ad: string; anaListe: boolean }[]>([]);
  const [seri, setSeri] = useState<{ id: string; ad: string } | null>(null);
  /** Plaka düzenleyici: seçili fotoğrafta düzenleme ya da galeri adayında "işaretle ve seç" */
  const [plaka, setPlaka] = useState<{ i: Gorsel; sec?: (alanlar: Alan[]) => Promise<void> } | null>(null);

  const load = useCallback(() => {
    setError(null);
    if (tab === 'talepler') {
      setBekleyen(null);
      yonetim<Bekleyen>('catalog/images/bekleyen-talepler')
        .then(setBekleyen)
        .catch((e: Error) => setError(e.message));
    } else if (tab === 'ara') {
      if (!seri) return setYerler([]);
      setYerler(null);
      yonetim<Yer[]>(`catalog/images/seri/${seri.id}`)
        .then(setYerler)
        .catch((e: Error) => setError(e.message));
    } else {
      setYerler(null);
      yonetim<Yer[]>(`catalog/images?durum=${tab}`)
        .then(setYerler)
        .catch((e: Error) => setError(e.message));
    }
  }, [tab, seri]);
  useEffect(load, [load]);

  // Araç ara: yazdıkça seri önerileri
  useEffect(() => {
    if (tab !== 'ara' || q.trim().length < 2) return setSeriler([]);
    const t = setTimeout(() => {
      yonetim<typeof seriler>(`catalog/images/seriler?q=${encodeURIComponent(q.trim())}`)
        .then(setSeriler)
        .catch(() => setSeriler([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, tab]);

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

  const liste = tab === 'talepler' ? (bekleyen?.hedefler ?? null) : yerler;
  const kart = (y: Yer) => (
    <YerKarti
      key={`${y.hedef.tur}:${y.hedef.id}:${y.hedef.makyaj ?? ''}`}
      yer={y}
      mesgul={busy}
      act={act}
      yenile={load}
      plakaAc={(i, sec) => setPlaka({ i, sec })}
    />
  );

  return (
    <>
      <Link href="/entegrasyonlar" className={stil.bag1}>
        ‹ Entegrasyonlar
      </Link>
      <div className={stil.kutu1}>
        <h1 className="k-h1">Araç görselleri</h1>
        <p className="k-sub">
          Her talep görselle yayına girer. Fotoğraf nesle, kasaya ya da modele (model geneli) bağlanır;
          katalogda fotoğraf yoksa talep şimdilik marka ve model kapağıyla görünür ve aşağıdaki listeye düşer.
          Commons'taki açık lisanslı fotoğraflardan seçebilir ya da bulduğun fotoğrafı kaynağı, yazarı ve
          lisansıyla yükleyebilirsin (yalnızca kamu malı, CC0, CC BY, CC BY-SA, kendi çekimimiz ya da yazılı
          izin; Karar 34). Seçili fotoğrafı değiştirebilir, kaldırabilir, plakasını bulanıklaştırabilirsin.
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

      <div className={stil.kutu2}>
        <fieldset className={`k-chips ${stil.kutu3}`}>
          <legend className="sr-only">Bölüm</legend>
          {(
            [
              ['talepler', `Görsel bekleyen talepler${bekleyen ? ` (${bekleyen.toplam})` : ''}`],
              ['bekleyen', 'Seçim bekleyen adaylar'],
              ['secili', 'Yayındaki fotoğraflar'],
              ['ara', 'Araç ara'],
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
              const r = await yonetim<{ nesil: number; aday: number; galeri?: number; model?: number }>(
                'catalog/sources/commons/check',
                { method: 'POST', body: {} },
              );
              load();
              return `${r.nesil} nesil için Commons'a bakıldı, ${r.aday} yeni aday; görsel bekleyen modellerden ${r.model ?? 0} aday; galeri portföylerinden ${r.galeri ?? 0} aday.`;
            })
          }
        >
          {busy === 'ara' ? 'Aranıyor…' : 'Yeni aday ara'}
        </button>
      </div>

      {tab === 'ara' ? (
        <div className={`k-panel ${stil.kutu4}`}>
          <label className="k-field">
            Marka ya da model
            <input
              value={q}
              placeholder="Ör. Renault Clio, Fiat Egea"
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          {seriler.length ? (
            <div className={stil.kutu5}>
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
          {seri ? (
            <p className={stil.metin1}>
              {seri.ad}: model geneli, nesiller ve kasalar aşağıda. Her birine fotoğraf seçebilir ya da
              yükleyebilirsin.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === 'talepler' && bekleyen?.katalogsuz ? (
        <p className="k-note">
          {bekleyen.katalogsuz} talebin aracı katalogda seçilmemiş (marka ya da model yok); bunlar kategori
          kapağıyla görünür.
        </p>
      ) : null}

      {tab === 'ara' && !seri ? null : liste === null ? (
        <div className="k-panel k-empty">Yükleniyor…</div>
      ) : liste.length === 0 ? (
        <div className="k-panel k-empty">
          {tab === 'talepler'
            ? 'Görsel bekleyen talep yok: yayındaki bütün talepler fotoğraflı.'
            : tab === 'bekleyen'
              ? 'Seçim bekleyen aday yok.'
              : tab === 'secili'
                ? 'Henüz yayında fotoğraf yok.'
                : 'Bu modelde görsel yeri yok.'}
        </div>
      ) : (
        liste.map(kart)
      )}

      {plaka?.sec ? (
        <PlakaDuzenle
          src={onizleme(plaka.i)}
          baslik={plaka.i.author}
          galeri
          ilk={[]}
          kapat={() => setPlaka(null)}
          kaydet={async (alanlar) => {
            const sec = plaka.sec;
            setPlaka(null);
            await sec?.(alanlar);
          }}
        />
      ) : plaka?.i.kopya ? (
        <PlakaDuzenle
          src={`${API}${plaka.i.kopya}`}
          baslik={`${plaka.i.author} · ${plaka.i.makyajAd ?? ''}`}
          galeri={plaka.i.origin === 'galeri'}
          ilk={plaka.i.blurAreas ?? []}
          kapat={() => setPlaka(null)}
          kaydet={async (alanlar) => {
            setError(null);
            try {
              await yonetim(`catalog/images/${plaka.i.id}/blur`, { method: 'POST', body: { alanlar } });
              setPlaka(null);
              setNotice(
                'Plaka bulanıklaştırıldı; talep sayfasında düzenlenmiş kopya ve “düzenlendi” atfı gösteriliyor.',
              );
              load();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      ) : null}
    </>
  );
}
