'use client';

import { BUILTIN_ROLES, INVITABLE_ROLES, STAFF_INVITE_HOURS } from '@rengarenk/shared';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { bas, tarih, yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  status: 'ACTIVE' | 'DISABLED' | 'INVITED';
  twoFactorEnabled: boolean;
  inviteExpiresAt: string | null;
  lastLoginAt: string | null;
  customRole: { id: string; name: string } | null;
}

interface CustomRole {
  id: string;
  name: string;
}

const AVATAR = ['#EEF3FF', '#FFE8F3', '#FFF6DF', '#E7FAF0', '#F3EFFF'];
const roleName = (m: Member) =>
  m.customRole?.name ?? BUILTIN_ROLES.find((r) => r.key === m.role)?.ad ?? m.role;

/** Çalışanlar (tasarım: YonetimEkip › Çalışanlar). Davet, rol değişikliği, hesap kapatma. */
export default function Calisanlar() {
  const { me } = useKonsol();
  const [rows, setRows] = useState<Member[] | null>(null);
  const [custom, setCustom] = useState<CustomRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [invite, setInvite] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: 'SUPPORT' as string });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    yonetim<Member[]>('members')
      .then(setRows)
      .catch((e: Error) => setError(e.message));
    yonetim<{ custom: CustomRole[] }>('roles')
      .then((r) => setCustom(r.custom))
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  const roleOptions = [
    ...INVITABLE_ROLES.map((k) => ({ value: k, label: BUILTIN_ROLES.find((r) => r.key === k)?.ad ?? k })),
    ...custom.map((c) => ({ value: `CUSTOM:${c.id}`, label: `${c.name} (özel)` })),
  ];
  const roleBody = (v: string) =>
    v.startsWith('CUSTOM:') ? { role: 'CUSTOM', customRoleId: v.slice(7) } : { role: v };

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(ok);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submitInvite(e: FormEvent) {
    e.preventDefault();
    act(async () => {
      await yonetim('members', {
        method: 'POST',
        body: { email: form.email, name: form.name, ...roleBody(form.role) },
      });
      setInvite(false);
      setForm({ email: '', name: '', role: 'SUPPORT' });
    }, 'Davet oluşturuldu. Çalışan şirket Google hesabıyla girip doğrulama uygulamasını kurduğunda hesabı açılır.');
  }

  return (
    <>
      <div className="k-head">
        <div>
          <h1 className="k-h1">Çalışanlar</h1>
          <p className="k-sub">Herkes şirket e-postasıyla ve iki adımlı girişle bağlanır.</p>
        </div>
        <button className="k-btn" type="button" onClick={() => setInvite((v) => !v)}>
          Çalışan davet et
        </button>
      </div>

      {invite ? (
        <form
          onSubmit={submitInvite}
          className="k-panel"
          style={{ border: '1.5px solid #5B8CFF', padding: 18, marginBottom: 16, overflow: 'visible' }}
          aria-label="Davet"
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
            <label className="k-field" style={{ flex: '2 1 240px' }}>
              Şirket e-postası
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ad.soyad@rengarenk.com.tr"
              />
            </label>
            <label className="k-field" style={{ flex: '2 1 200px' }}>
              Ad soyad
              <input
                required
                minLength={2}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="k-field" style={{ flex: '1 1 180px' }}>
              Rol
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {roleOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="k-btn" type="submit" disabled={busy}>
              Daveti gönder
            </button>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#5A6073' }}>
            Davet {STAFF_INVITE_HOURS} saat geçerlidir. İlk girişte doğrulama uygulaması kurulmadan konsol
            açılmaz.
          </p>
        </form>
      ) : null}

      {error ? (
        <p className="k-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="k-note" role="status">
          {notice}
        </p>
      ) : null}

      <div className="k-panel">
        <div className="k-thead">
          <span style={{ flex: '999 1 220px' }}>Çalışan</span>
          <span style={{ flex: '1 1 150px' }}>Rol</span>
          <span style={{ flex: '1 1 140px' }}>Son giriş</span>
          <span style={{ flex: '1 1 220px' }}>Durum</span>
        </div>
        {rows === null ? (
          <div className="k-empty">Yükleniyor…</div>
        ) : (
          rows.map((m, i) => {
            const self = m.id === me.id;
            const editable = !self && m.role !== 'OWNER' && m.status !== 'DISABLED';
            const invitedExpired =
              m.status === 'INVITED' && m.inviteExpiresAt && new Date(m.inviteExpiresAt) < new Date();
            const [durum, bg, fg] =
              m.status === 'DISABLED'
                ? ['Kapalı', '#F3F5FA', '#5A6073']
                : m.status === 'INVITED'
                  ? [invitedExpired ? 'Davet süresi doldu' : 'Davet edildi', '#FFF6DF', '#7A5300']
                  : ['Aktif', '#E7FAF0', '#11683F'];
            return (
              <div key={m.id} className="k-row">
                <span
                  style={{ flex: '999 1 220px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <span
                    className="k-avatar"
                    style={{ background: AVATAR[i % AVATAR.length], color: '#1E2333' }}
                    aria-hidden="true"
                  >
                    {bas(m.name)}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800 }}>
                      {m.name}
                      {self ? ' (sen)' : ''}
                    </span>
                    <span
                      style={{ display: 'block', fontSize: 12.5, color: '#5A6073', overflowWrap: 'anywhere' }}
                    >
                      {m.email}
                    </span>
                  </span>
                </span>
                <span style={{ flex: '1 1 150px', fontWeight: 700 }}>
                  {editable ? (
                    <select
                      aria-label={`${m.name} rolü`}
                      value={m.role === 'CUSTOM' ? `CUSTOM:${m.customRole?.id}` : m.role}
                      disabled={busy}
                      onChange={(e) =>
                        act(
                          () =>
                            yonetim(`members/${m.id}/role`, {
                              method: 'PATCH',
                              body: roleBody(e.target.value),
                            }),
                          `${m.name} için rol değiştirildi.`,
                        )
                      }
                      style={{
                        border: '1px solid #D5DAE5',
                        borderRadius: 8,
                        padding: '6px 8px',
                        font: 'inherit',
                        fontWeight: 700,
                      }}
                    >
                      {roleOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    roleName(m)
                  )}
                </span>
                <span style={{ flex: '1 1 140px', fontSize: 13, color: '#3A4052' }}>
                  {tarih(m.lastLoginAt)}
                </span>
                <span
                  style={{
                    flex: '1 1 220px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span className="k-pill" style={{ background: bg, color: fg }}>
                    {durum}
                  </span>
                  {editable && m.status === 'INVITED' ? (
                    <button
                      className="k-link"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        act(() => yonetim(`members/${m.id}/reinvite`, { method: 'POST' }), 'Davet yenilendi.')
                      }
                    >
                      Daveti yenile
                    </button>
                  ) : null}
                  {editable && m.twoFactorEnabled ? (
                    <button
                      className="k-link"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(
                            `${m.name} için doğrulama uygulaması sıfırlansın mı? Açık oturumları kapanır.`,
                          )
                        )
                          act(
                            () => yonetim(`members/${m.id}/2fa-reset`, { method: 'POST' }),
                            'İki adımlı doğrulama sıfırlandı.',
                          );
                      }}
                    >
                      2FA sıfırla
                    </button>
                  ) : null}
                  {editable ? (
                    <button
                      className="k-btn-danger"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (confirm(`${m.name} hesabı ve açık oturumları kapatılsın mı?`))
                          act(
                            () => yonetim(`members/${m.id}/disable`, { method: 'POST' }),
                            `${m.name} hesabı kapatıldı.`,
                          );
                      }}
                    >
                      Kapat
                    </button>
                  ) : null}
                </span>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
