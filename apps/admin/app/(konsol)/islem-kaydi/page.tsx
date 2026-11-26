'use client';

import { AUDIT_ACTIONS } from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { gunSaat, yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

interface Entry {
  id: string;
  createdAt: string;
  actorType: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ip: string | null;
}

const FILTERS = [
  ['hepsi', 'Hepsi'],
  ['ajan', 'Ajan'],
  ['veri', 'Kişisel veri görüntüleme'],
  ['para', 'Ödeme ve iade'],
  ['yetki', 'Yetki ve ayar'],
] as const;

const yaz = (x: unknown) =>
  x === null || x === undefined ? '—' : typeof x === 'object' ? JSON.stringify(x) : String(x);

/** Değişimin okunur özeti: "durum: başvuru → aktif · rol: Destek"; değer yoksa kaydın kendisi. */
function degisim(k: Entry) {
  // Dizi değerleri (ör. değişen alan adları) olduğu gibi sıralanır
  if (Array.isArray(k.after) || Array.isArray(k.before)) {
    const list = (Array.isArray(k.after) ? k.after : k.before) as unknown[];
    return list.map(yaz).join(', ') || `${k.entityType} · ${k.entityId}`;
  }
  const once = (k.before && typeof k.before === 'object' ? k.before : {}) as Record<string, unknown>;
  const sonra = (k.after && typeof k.after === 'object' ? k.after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(once), ...Object.keys(sonra)])];
  const parts = keys.map((key) =>
    key in once && key in sonra
      ? `${key}: ${yaz(once[key])} → ${yaz(sonra[key])}`
      : key in sonra
        ? `${key}: ${yaz(sonra[key])}`
        : `${key}: ${yaz(once[key])} → —`,
  );
  return parts.length ? parts.join(' · ') : `${k.entityType} · ${k.entityId}`;
}

/** İşlem kaydı (tasarım: YonetimEkip › İşlem kaydı). Kayıtlar silinemez ve 2 yıl saklanır. */
export default function IslemKaydi() {
  const { me } = useKonsol();
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('hepsi');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Entry[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (once?: string) => {
      const p = new URLSearchParams({ filtre: filter });
      if (query) p.set('q', query);
      if (once) p.set('once', once);
      yonetim<{ items: Entry[]; next: string | null }>(`audit?${p}`)
        .then((r) => {
          setItems((prev) => (once && prev ? [...prev, ...r.items] : r.items));
          setNext(r.next);
        })
        .catch((e: Error) => setError(e.message));
    },
    [filter, query],
  );
  useEffect(() => load(), [load]);

  return (
    <>
      <h1 className="k-h1">İşlem kaydı</h1>
      <p className={`k-sub ${stil.metin1}`}>Kayıtlar silinemez ve 2 yıl saklanır.</p>
      <form
        className="k-chips"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
      >
        {FILTERS.map(([k, ad]) => (
          <button
            key={k}
            type="button"
            className="k-chip"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
          >
            {ad}
          </button>
        ))}
        <label className="sr-only" htmlFor="kara">
          Kayıtlarda ara
        </label>
        <input
          id="kara"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Kişi, kullanıcı veya işlem ara"
          className={stil.girdi1}
        />
      </form>
      {error ? (
        <p className="k-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="k-panel">
        {items === null ? (
          <div className="k-empty">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="k-empty">Kayıt yok.</div>
        ) : (
          items.map((k) => (
            <div key={k.id} title={`${k.entityType} · ${k.entityId}`} className={stil.kutu1}>
              <span className={stil.metin2}>{gunSaat(k.createdAt)}</span>
              <span className={stil.metin3}>{k.actorId === me.id ? 'Sen' : k.actorName}</span>
              <span className={stil.metin4}>
                <span className={stil.metin5}>{AUDIT_ACTIONS[k.action] ?? k.action}</span>
                <span className={stil.metin6}>{degisim(k)}</span>
              </span>
              <span className={stil.metin7}>
                {k.actorType === 'SYSTEM' || k.actorType === 'AGENT' || !k.ip ? 'Sistem' : k.ip}
              </span>
            </div>
          ))
        )}
      </div>
      {next ? (
        <button className={`k-btn-line ${stil.dugme1}`} type="button" onClick={() => load(next)}>
          Daha eski kayıtlar
        </button>
      ) : null}
    </>
  );
}
