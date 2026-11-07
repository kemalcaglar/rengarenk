'use client';

import { useCallback, useEffect, useState } from 'react';
import { tarih, yonetim } from '../../../lib/istemci';

interface Entry {
  id: string;
  createdAt: string;
  actorType: string;
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

/** İşlem adlarının okunur karşılığı; listede olmayan ad olduğu gibi gösterilir. */
const ACTIONS: Record<string, string> = {
  giris: 'Kullanıcı girişi',
  profil_guncelle: 'Profil güncellendi',
  oturum_kapat: 'Oturum kapatıldı',
  yonetim_giris: 'Yönetim girişi',
  yonetim_cikis: 'Yönetimden çıkış',
  yonetim_giris_reddedildi: 'Yönetim girişi reddedildi',
  yonetim_kod_hatali: 'Hatalı doğrulama kodu',
  calisan_davet: 'Çalışan davet edildi',
  calisan_davet_yenilendi: 'Davet yenilendi',
  calisan_rol_degisti: 'Çalışan rolü değişti',
  calisan_kapatildi: 'Çalışan hesabı kapatıldı',
  calisan_2fa_sifirlandi: 'İki adımlı doğrulama sıfırlandı',
  sahip_hesabi_acildi: 'Sahip hesabı açıldı',
  ozel_rol_olustur: 'Özel rol oluşturuldu',
  ozel_rol_degisti: 'Özel rol değişti',
  onay_istendi: 'Onay istendi',
  onay_onaylandi: 'Onaylandı',
  onay_reddedildi: 'Reddedildi',
  onay_geri_cekildi: 'İstek geri çekildi',
  onay_suresi_doldu: 'Onay isteğinin süresi doldu',
  onay_yurutuldu: 'Onaylanan işlem yürütüldü',
};

const summary = (v: unknown) => {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object')
    return Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => `${k}: ${typeof x === 'object' ? JSON.stringify(x) : String(x)}`)
      .join(' · ');
  return String(v);
};

/** İşlem kaydı (tasarım: YonetimEkip › İşlem kaydı). Kayıtlar silinemez ve 2 yıl saklanır. */
export default function IslemKaydi() {
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
          placeholder="İşlem adı, kişi ya da kayıt kimliği"
          style={{
            flex: '1 1 240px',
            minWidth: 0,
            border: '1px solid #D5DAE5',
            borderRadius: 999,
            padding: '8px 14px',
            fontSize: 13.5,
            font: 'inherit',
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
              className="k-row"
              style={{ fontSize: 13.5, alignItems: 'flex-start', gap: '6px 16px' }}
            >
              <span style={{ flex: '0 0 130px', color: '#5A6073', fontWeight: 600 }}>
                {tarih(k.createdAt)}
              </span>
              <span style={{ flex: '0 0 150px', fontWeight: 800 }}>{k.actorName}</span>
              <span style={{ flex: '999 1 300px', minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700 }}>{ACTIONS[k.action] ?? k.action}</span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 12.5,
                    color: '#3A4052',
                    marginTop: 2,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {k.entityType} · {k.entityId}
                  {k.before ? ` · önce: ${summary(k.before)}` : ''}
                  {k.after ? ` · sonra: ${summary(k.after)}` : ''}
                </span>
              </span>
              <span style={{ flex: '0 0 120px', fontSize: 12.5, color: '#5A6073' }}>{k.ip ?? 'Sistem'}</span>
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
