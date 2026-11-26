'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../../lib/cx';
import { tarih, yonetim } from '../../../../lib/istemci';
import stil from './page.module.css';

interface SeriesRef {
  id: string;
  name: string;
  make: string;
}

interface Alias {
  id: string;
  source: string;
  fromKey: string;
  fromName: string;
  toKey: string;
  status: 'onerildi' | 'onaylandi' | 'reddedildi';
  method: 'kural' | 'elle' | 'ajan';
  reason: string | null;
  variants: number;
  decidedAt: string | null;
  createdAt: string;
  from: SeriesRef | null;
  to: SeriesRef | null;
}

const SOURCE: Record<string, string> = {
  tsb: 'TSB',
  vmm: 'vehicle-makes-models',
  wikidata: 'Wikidata',
  yerli: 'Yerli liste',
  '*': 'Bütün kaynaklar',
};

/** Önerinin gerekçesi, sade dille */
const REASON: Record<string, string> = {
  ek: 'Seri adına ek almış (ör. “Focus CC” → Focus)',
  'bitişik yazım': 'Bitişik yazılmış (ör. “Tiguanallspace” → Tiguan)',
  'yazım farkı': 'Yalnızca noktalama ya da boşluk farkı (ör. “MX5” → MX-5)',
  'yazım hatası': 'Tek harf farkı, büyük olasılıkla yazım hatası',
  'elektrikli sürüm': 'Aynı modelin elektrikli sürümü; ayrı tutmak da birleştirmek de olur',
  elle: 'Çalışan elle ekledi',
};

const TABS: { key: Alias['status']; ad: string }[] = [
  { key: 'onerildi', ad: 'Bekleyen öneriler' },
  { key: 'onaylandi', ad: 'Onaylananlar' },
  { key: 'reddedildi', ad: 'Reddedilenler' },
];

const seriesLabel = (r: SeriesRef | null, key: string, name?: string) =>
  r ? `${r.make} ${r.name}` : (name ?? key);

/**
 * Ad eşleme (Teknik tasarım §5, Karar 33): aynı serinin farklı yazımları tek seride birleşir. Sistem kurala göre
 * önerir; katalog sorumlusu onaylar ya da reddeder. Onaylanınca tipler hedef seriye taşınır; hiçbir kayıt silinmez.
 */
export default function AdEsleme() {
  const [tab, setTab] = useState<Alias['status']>('onerildi');
  const [rows, setRows] = useState<Alias[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(() => {
    setRows(null);
    yonetim<Alias[]>(`catalog/aliases?durum=${tab}`)
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  }, [tab]);
  useEffect(load, [load]);

  async function act(id: string, fn: () => Promise<string>) {
    setBusy(id);
    setError(null);
    setNotice(null);
    try {
      setNotice(await fn());
      setRows((rs) => rs?.filter((r) => r.id !== id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const shown = (rows ?? []).filter((r) => {
    const q = filter.trim().toLocaleLowerCase('tr-TR');
    if (!q) return true;
    return `${r.fromName} ${r.fromKey} ${r.toKey} ${r.to?.make ?? ''}`.toLocaleLowerCase('tr-TR').includes(q);
  });

  return (
    <>
      <Link href="/entegrasyonlar" className={stil.bag1}>
        ‹ Entegrasyonlar
      </Link>
      <div className={stil.kutu1}>
        <h1 className="k-h1">Ad eşleme</h1>
        <p className="k-sub">
          Aynı seri kaynaklarda farklı yazılabiliyor: TSB “Touraeg”, vehicle-makes-models “Focus CC” yazıyor.
          Sistem benzer adı önerir; onaylarsan o yazımın bütün tipleri hedef seriye taşınır ve sonraki
          dosyalarda da oraya girer. Reddedilen öneri bir daha gelmez. Hiçbir kayıt silinmez.
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
          <legend className="sr-only">Durum</legend>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className="k-chip"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              {t.ad}
            </button>
          ))}
        </fieldset>
        <input
          aria-label="Ara"
          placeholder="Marka ya da seri ara"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={stil.girdi1}
        />
        {tab === 'onerildi' ? (
          <button
            type="button"
            className="k-btn-line"
            disabled={busy !== null}
            onClick={() =>
              act('yenile', async () => {
                const r = await yonetim<{ eklenen: number }>('catalog/aliases/suggest', {
                  method: 'POST',
                  body: {},
                });
                load();
                return r.eklenen ? `${r.eklenen} yeni öneri eklendi.` : 'Yeni öneri yok.';
              })
            }
          >
            Önerileri yenile
          </button>
        ) : null}
      </div>

      <section className="k-panel" aria-label={TABS.find((t) => t.key === tab)?.ad}>
        {rows === null ? (
          <div className="k-empty">Yükleniyor…</div>
        ) : shown.length === 0 ? (
          <div className="k-empty">
            {tab === 'onerildi' ? 'Bekleyen öneri yok.' : 'Bu listede kayıt yok.'}
          </div>
        ) : (
          shown.map((r) => (
            <div key={r.id} className={`k-row ${stil.kutu4}`}>
              <span className={stil.metin1}>
                <span className={stil.metin2}>
                  <strong>{seriesLabel(r.from, r.fromKey, r.fromName)}</strong>
                  <span aria-hidden="true" className={stil.metin3}>
                    →
                  </span>
                  <span className="sr-only">eşlensin:</span>
                  <strong>{seriesLabel(r.to, r.toKey)}</strong>
                </span>
                <span className={stil.metin4}>
                  {SOURCE[r.source] ?? r.source} · {r.variants} tip ·{' '}
                  {REASON[r.reason ?? ''] ?? r.reason ?? ''}
                  {r.decidedAt ? ` · karar ${tarih(r.decidedAt)}` : ''}
                </span>
              </span>
              {r.status === 'onerildi' ? (
                <span className={stil.metin5}>
                  <button
                    type="button"
                    className="k-btn-line"
                    disabled={busy !== null}
                    onClick={() =>
                      act(r.id, async () => {
                        await yonetim(`catalog/aliases/${r.id}/reject`, { method: 'POST', body: {} });
                        return `${r.fromName} ayrı seri olarak kalacak.`;
                      })
                    }
                  >
                    Ayrı kalsın
                  </button>
                  <button
                    type="button"
                    className="k-btn-ok"
                    disabled={busy !== null}
                    onClick={() =>
                      act(r.id, async () => {
                        const res = await yonetim<{ tasinan: number }>(`catalog/aliases/${r.id}/approve`, {
                          method: 'POST',
                          body: {},
                        });
                        return `${r.fromName} → ${seriesLabel(r.to, r.toKey)} onaylandı; ${res.tasinan} tip taşındı.`;
                      })
                    }
                  >
                    {busy === r.id ? 'İşleniyor…' : 'Onayla'}
                  </button>
                </span>
              ) : (
                <span className={cx('k-pill', r.status === 'onaylandi' ? stil.metin6 : stil.metin7)}>
                  {r.status === 'onaylandi' ? 'Birleştirildi' : 'Ayrı seri'}
                </span>
              )}
            </div>
          ))
        )}
      </section>
    </>
  );
}
