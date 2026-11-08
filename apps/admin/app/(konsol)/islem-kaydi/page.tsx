'use client';

import { AUDIT_ACTIONS } from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { gunSaat, yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

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
      <p className="k-sub" style={{ marginBottom: 16 }}>
        Kayıtlar silinemez ve 2 yıl saklanır.
      </p>
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
          style={{
            flex: '1 1 240px',
            minWidth: 0,
            border: '1px solid #D5DAE5',
            borderRadius: 999,
            padding: '8px 14px',
            fontFamily: 'inherit',
            fontSize: 13.5,
          }}
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
            <div
              key={k.id}
              title={`${k.entityType} · ${k.entityId}`}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px 16px',
                padding: '12px 18px',
                borderBottom: '1px solid #EEF0F5',
                fontSize: 13.5,
              }}
            >
              <span style={{ flex: '0 0 96px', color: '#5A6073', fontWeight: 600 }}>
                {gunSaat(k.createdAt)}
              </span>
              <span style={{ flex: '0 0 150px', fontWeight: 800 }}>
                {k.actorId === me.id ? 'Sen' : k.actorName}
              </span>
              <span style={{ flex: '999 1 300px', minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700 }}>
                  {AUDIT_ACTIONS[k.action] ?? k.action}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 12.5,
                    color: '#3A4052',
                    marginTop: 2,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {degisim(k)}
                </span>
              </span>
              <span style={{ flex: '0 0 150px', fontSize: 12.5, color: '#5A6073' }}>
                {k.actorType === 'SYSTEM' || k.actorType === 'AGENT' || !k.ip ? 'Sistem' : k.ip}
              </span>
            </div>
          ))
        )}
      </div>
      {next ? (
        <button className="k-btn-line" type="button" style={{ marginTop: 12 }} onClick={() => load(next)}>
          Daha eski kayıtlar
        </button>
      ) : null}
    </>
  );
}
