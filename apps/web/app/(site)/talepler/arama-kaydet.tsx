'use client';

import { searchQueryKey } from '@rengarenk/shared';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiHatasi, istek, useGiris } from '../../../lib/istemci';
import css from './talepler.module.css';

const COKLU = new Set(['seri', 'makyaj', 'paket']);
const DISARIDA = new Set(['sayfa', 'sira', 'boyut']);

/** Aramayı kaydet (Liste.dc.html, Karar 30): kayıtlıysa yeşil "Arama kaydedildi"; ikinci basış kaydı siler. */
export function AramaKaydet({ ad }: { ad: string }) {
  const params = useSearchParams();
  const giris = useGiris();
  const [kayit, setKayit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState('');

  const sorgu: Record<string, string | string[]> = {};
  for (const k of new Set(params.keys())) {
    if (DISARIDA.has(k)) continue;
    sorgu[k] = COKLU.has(k) ? params.getAll(k) : (params.get(k) ?? '');
  }
  const benim = searchQueryKey(sorgu);

  useEffect(() => {
    if (!giris) return;
    istek<{ id: string; sorgu: Record<string, unknown> }[]>('/saved-searches')
      .then((l) => setKayit(l.find((s) => searchQueryKey(s.sorgu) === benim)?.id ?? null))
      .catch(() => undefined);
  }, [giris, benim]);

  async function bas() {
    if (giris === false) {
      window.location.href = `/giris?sonra=${encodeURIComponent(`/talepler?${params.toString()}`)}`;
      return;
    }
    setBusy(true);
    setHata('');
    try {
      if (kayit) {
        await istek(`/saved-searches/${kayit}`, { method: 'DELETE' });
        setKayit(null);
      } else {
        const r = await istek<{ id: string }>('/saved-searches', {
          method: 'POST',
          body: { ad: ad.slice(0, 80), sorgu },
        });
        setKayit(r.id);
      }
    } catch (e) {
      setHata(e instanceof ApiHatasi ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {kayit ? (
        <button
          type="button"
          onClick={bas}
          disabled={busy}
          title="Kayıtlı aramalardan çıkar"
          className={css.kaydedildi}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12l5 5 9-10" />
          </svg>
          Arama kaydedildi
        </button>
      ) : (
        <button type="button" onClick={bas} disabled={busy || giris === null} className={css.kaydet}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 3h12v18l-6-4-6 4z" />
          </svg>
          Aramayı kaydet
        </button>
      )}
      {hata ? (
        <span role="alert" className={css.kaydetHata}>
          {hata}
        </span>
      ) : null}
    </>
  );
}
