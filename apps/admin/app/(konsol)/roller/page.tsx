'use client';

import {
  BUILTIN_ROLES,
  PERMISSIONS,
  type Permission,
  type PermissionGrants,
  type PermissionLevel,
  ROLE_GRANTS,
} from '@rengarenk/shared';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import stil from './page.module.css';

interface CustomRole {
  id: string;
  name: string;
  permissions: PermissionGrants;
  members: number;
}

/** Hücre işaretleri ve renkleri tasarımdaki matristen. */
const CELL: Record<PermissionLevel | 'yok', { t: string; bg: string; fg: string; ad: string }> = {
  tam: { t: '✓', bg: '#E7FAF0', fg: '#11683F', ad: 'tam yetki' },
  oneri: { t: 'Ö', bg: '#FFF6DF', fg: '#7A5300', ad: 'öneri hazırlar, onay gerekir' },
  maskeli: { t: 'M', bg: '#EEF3FF', fg: '#2450C8', ad: 'kişisel veri maskeli' },
  onay: { t: 'O', bg: '#F3EFFF', fg: '#4B2FA6', ad: 'başkasının işlemini onaylar' },
  yok: { t: '–', bg: 'transparent', fg: '#AEB5C4', ad: 'yetkisi yok' },
};

/** Özel role verilemeyen yetkiler (Karar 40): çalışan yönetimi ve iadede tam yetki. */
const disabledLevel = (k: Permission, l: PermissionLevel) =>
  k === 'ekip.yonet' || (k === 'iade' && l === 'tam');

/** Roller ve yetkiler (tasarım: YonetimEkip › Roller ve yetkiler). */
export default function Roller() {
  const [custom, setCustom] = useState<CustomRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: string; name: string; permissions: PermissionGrants } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    yonetim<{ custom: CustomRole[] }>('roles')
      .then((r) => setCustom(r.custom))
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const columns = [
    ...BUILTIN_ROLES.map((r) => ({
      key: r.key,
      ad: r.ad,
      grants: ROLE_GRANTS[r.key],
      custom: null as CustomRole | null,
    })),
    ...custom.map((c) => ({ key: c.id, ad: c.name, grants: c.permissions, custom: c })),
  ];

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const body = { name: editing.name, permissions: editing.permissions };
      await yonetim(editing.id ? `roles/${editing.id}` : 'roles', {
        method: editing.id ? 'PATCH' : 'POST',
        body,
      });
      setEditing(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="k-head">
        <div>
          <h1 className="k-h1">Roller ve yetkiler</h1>
          <p className="k-sub">Hazır roller değiştirilemez; ihtiyacına göre özel rol oluşturabilirsin.</p>
        </div>
        <button
          className="k-btn-outline"
          type="button"
          onClick={() => setEditing({ name: '', permissions: {} })}
        >
          Özel rol oluştur
        </button>
      </div>

      {error ? (
        <p className="k-error" role="alert">
          {error}
        </p>
      ) : null}

      {editing ? (
        <form onSubmit={save} className={`k-panel ${stil.kutu1}`}>
          <label className={`k-field ${stil.etiket1}`}>
            Rol adı
            <input
              required
              minLength={2}
              maxLength={60}
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="ör. Katalog sorumlusu"
            />
          </label>
          <div className={stil.kutu2}>
            {PERMISSIONS.map((p) => (
              <div key={p.key} className={stil.kutu3}>
                <span className={stil.metin1}>{p.ad}</span>
                <select
                  aria-label={p.ad}
                  value={editing.permissions[p.key] ?? ''}
                  disabled={p.key === 'ekip.yonet'}
                  onChange={(e) => {
                    const next = { ...editing.permissions };
                    if (e.target.value) next[p.key] = e.target.value as PermissionLevel;
                    else delete next[p.key];
                    setEditing({ ...editing, permissions: next });
                  }}
                  className={stil.girdi1}
                >
                  <option value="">– yetkisi yok</option>
                  {(['tam', 'oneri', 'maskeli', 'onay'] as const).map((l) => (
                    <option key={l} value={l} disabled={disabledLevel(p.key, l)}>
                      {CELL[l].t} {CELL[l].ad}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <p className={stil.metin2}>
            Çalışan yönetimi ve iadede tam yetki yalnızca sahibe aittir. Özel roller onay kuyruğunda karar
            veremez.
          </p>
          <div className={stil.kutu4}>
            <button className="k-btn" type="submit" disabled={busy}>
              {editing.id ? 'Kaydet' : 'Rolü oluştur'}
            </button>
            <button className="k-btn-line" type="button" onClick={() => setEditing(null)}>
              Vazgeç
            </button>
          </div>
        </form>
      ) : null}

      <div className={`k-panel ${stil.kutu5}`}>
        <div style={{ minWidth: 220 + columns.length * 78 }}>
          <div
            className={stil.kutu6}
            style={{
              gridTemplateColumns: `minmax(220px, 2.4fr) repeat(${columns.length}, minmax(70px, 1fr))`,
            }}
          >
            <span className={stil.metin3}>Yetki</span>
            {columns.map((c) => (
              <span key={c.key} className={stil.metin4}>
                {c.custom ? (
                  <button
                    type="button"
                    className={`k-link ${stil.dugme1}`}
                    title={`${c.custom.members} çalışan · düzenle`}
                    onClick={() => setEditing({ id: c.custom?.id, name: c.ad, permissions: { ...c.grants } })}
                  >
                    {c.ad}
                  </button>
                ) : (
                  c.ad
                )}
              </span>
            ))}
          </div>
          {PERMISSIONS.map((p) => (
            <div
              key={p.key}
              className={stil.kutu7}
              style={{
                gridTemplateColumns: `minmax(220px, 2.4fr) repeat(${columns.length}, minmax(70px, 1fr))`,
              }}
            >
              <span className={stil.metin5}>{p.ad}</span>
              {columns.map((c) => {
                const cell = CELL[c.grants[p.key] ?? 'yok'];
                return (
                  <span key={c.key} className={stil.metin6}>
                    <span
                      title={cell.ad}
                      className={stil.metin7}
                      style={{ background: cell.bg, color: cell.fg }}
                    >
                      {cell.t}
                    </span>
                  </span>
                );
              })}
            </div>
          ))}
          <div className={stil.kutu8}>
            {(['tam', 'oneri', 'maskeli', 'onay', 'yok'] as const).map((l) => (
              <span key={l}>
                <strong style={{ color: CELL[l].fg === '#AEB5C4' ? '#8A91A3' : CELL[l].fg }}>
                  {CELL[l].t}
                </strong>{' '}
                {CELL[l].ad}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
