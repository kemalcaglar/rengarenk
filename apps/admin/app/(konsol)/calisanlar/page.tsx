'use client';

import { BUILTIN_ROLES, STAFF_INVITE_HOURS } from '@rengarenk/shared';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { bas, gunSaat, once, yonetim } from '../../../lib/istemci';
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
  week: { onay: number; islem: number };
}

interface CustomRole {
  id: string;
  name: string;
}

/** Baş harf yuvarlakları: tasarımdaki sıra (YonetimEkip › Çalışanlar) */
const AVATAR = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0', '#F3EFFF', '#FFF0EA'];
/** Davet rol listesi tasarımdaki sırayla */
const DAVET_ROLLERI = [
  'SUPPORT',
  'MODERATOR',
  'OPERATIONS',
  'MARKETING',
  'FINANCE',
  'VIEWER',
  'ADMIN',
] as const;
const rolAdi = (k: string) => BUILTIN_ROLES.find((r) => r.key === k)?.ad ?? k;
const roleName = (m: Member) => m.customRole?.name ?? rolAdi(m.role);
const SIRA: Record<Member['status'], number> = { ACTIVE: 0, INVITED: 1, DISABLED: 2 };

/** Son giriş tasarımdaki gibi: "Bugün 11:42", "Dün 18:20", "3 gün önce" */
function sonGiris(iso: string | null) {
  if (!iso) return '—';
  const g = gunSaat(iso);
  return g.startsWith('Bugün') || g.startsWith('Dün') ? g : once(iso);
}

/** "Bu hafta": son 7 günde verilen onay kararı ve işlem kaydına giren işlem */
function buHafta(w: Member['week'], self: boolean) {
  const p: string[] = [];
  if (w.onay) p.push(`${w.onay} onay${self ? ' verdin' : ''}`);
  if (w.islem) p.push(`${w.islem} işlem`);
  return p.length ? p.join(', ') : '—';
}

const satirDugme = (renk: string) =>
  ({
    border: 0,
    background: 'transparent',
    padding: 0,
    fontFamily: 'inherit',
    fontSize: 12.5,
    fontWeight: 700,
    color: renk,
    cursor: 'pointer',
  }) as const;

/** Çalışanlar (tasarım: YonetimEkip › Çalışanlar). Davet, rol değişikliği, hesap kapatma. */
export default function Calisanlar() {
  const { me } = useKonsol();
  const [rows, setRows] = useState<Member[] | null>(null);
  const [custom, setCustom] = useState<CustomRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [invite, setInvite] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'SUPPORT' as string });
  const [busy, setBusy] = useState(false);
  const [ajan, setAjan] = useState<{ calisiyor: boolean; toplam7: number; geriOran: number } | null>(null);

  const load = useCallback(() => {
    yonetim<Member[]>('members')
      .then((r) =>
        setRows(
          [...r].sort(
            (a, b) => Number(b.id === me.id) - Number(a.id === me.id) || SIRA[a.status] - SIRA[b.status],
          ),
        ),
      )
      .catch((e: Error) => setError(e.message));
    yonetim<{ custom: CustomRole[] }>('roles')
      .then((r) => setCustom(r.custom))
      .catch(() => undefined);
    // Ajan servis hesabıdır, davetle açılmaz; tasarımdaki son satır (YonetimEkip › Çalışanlar)
    yonetim<{ calisiyor: boolean; sayilar: { toplam7: number; geriOran: number } }>('agent')
      .then((r) =>
        setAjan({ calisiyor: r.calisiyor, toplam7: r.sayilar.toplam7, geriOran: r.sayilar.geriOran }),
      )
      .catch(() => undefined);
  }, [me.id]);
  useEffect(load, [load]);

  const roleOptions = [
    ...DAVET_ROLLERI.map((k) => ({ value: k as string, label: rolAdi(k) })),
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
      await yonetim('members', { method: 'POST', body: { email: form.email, ...roleBody(form.role) } });
      setInvite(false);
      setForm({ email: '', role: 'SUPPORT' });
    }, 'Davet gönderildi. Çalışan şirket Google hesabıyla girip doğrulama uygulamasını kurduğunda hesabı açılır.');
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
          aria-label="Davet"
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #5B8CFF',
            borderRadius: 18,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
            <label className="k-field" style={{ flex: '2 1 260px' }}>
              Şirket e-postası
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ad.soyad@rengarenksite.com"
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
        <p className="k-ok" role="status">
          {notice}
        </p>
      ) : null}

      <div className="k-panel">
        <div className="k-thead">
          <span style={{ flex: '999 1 220px' }}>Çalışan</span>
          <span style={{ flex: '1 1 110px' }}>Rol</span>
          <span style={{ flex: '1 1 120px' }}>Son giriş</span>
          <span style={{ flex: '1 1 180px' }}>Bu hafta</span>
          <span style={{ flex: '1 1 140px' }}>Durum</span>
        </div>
        {rows === null ? (
          <div className="k-empty">Yükleniyor…</div>
        ) : (
          rows.map((m, i) => {
            const self = m.id === me.id;
            const davetli = m.status === 'INVITED';
            const editable = !self && m.role !== 'OWNER' && m.status !== 'DISABLED';
            const kalanSaat = m.inviteExpiresAt
              ? Math.ceil((new Date(m.inviteExpiresAt).getTime() - Date.now()) / 3600_000)
              : 0;
            const [durum, bg, fg] =
              m.status === 'DISABLED'
                ? ['Kapatıldı', '#F3F5FA', '#5A6073']
                : davetli
                  ? [kalanSaat > 0 ? 'Davet bekliyor' : 'Davet süresi doldu', '#FFF6DF', '#7A5300']
                  : m.twoFactorEnabled
                    ? ['Aktif · 2 adımlı', '#E7FAF0', '#11683F']
                    : ['2 adım kurulmadı', '#FFF6DF', '#7A5300'];
            return (
              <div key={m.id} className="k-row">
                <span
                  style={{ flex: '999 1 220px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <span
                    className="k-avatar"
                    style={{
                      background: davetli ? '#F3F5FA' : AVATAR[i % AVATAR.length],
                      color: '#1E2333',
                      fontSize: 12.5,
                    }}
                    aria-hidden="true"
                  >
                    {davetli && m.name === m.email ? '?' : bas(m.name)}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, overflowWrap: 'anywhere' }}>
                      {self ? 'Sen' : m.name}
                    </span>
                    <span
                      style={{ display: 'block', fontSize: 12.5, color: '#5A6073', overflowWrap: 'anywhere' }}
                    >
                      {davetli && m.name === m.email
                        ? kalanSaat > 0
                          ? `Davet gönderildi · ${kalanSaat} saat geçerli`
                          : 'Davetin süresi doldu'
                        : m.email}
                    </span>
                  </span>
                </span>
                <span style={{ flex: '1 1 110px', fontWeight: 700 }}>
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
                        border: 0,
                        background: 'transparent',
                        padding: 0,
                        fontFamily: 'inherit',
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#1E2333',
                        cursor: 'pointer',
                        maxWidth: '100%',
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
                <span style={{ flex: '1 1 120px', fontSize: 13, color: '#3A4052' }}>
                  {self ? 'Şimdi · bu cihaz' : sonGiris(m.lastLoginAt)}
                </span>
                <span style={{ flex: '1 1 180px', fontSize: 13, color: '#3A4052' }}>
                  {davetli ? '—' : buHafta(m.week, self)}
                </span>
                <span
                  style={{
                    flex: '1 1 140px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span className="k-pill" style={{ background: bg, color: fg }}>
                    {durum}
                  </span>
                  {editable && davetli ? (
                    <button
                      type="button"
                      style={satirDugme('#2450C8')}
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
                      type="button"
                      style={satirDugme('#2450C8')}
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
                      2 adımı sıfırla
                    </button>
                  ) : null}
                  {editable ? (
                    <button
                      type="button"
                      style={satirDugme('#A3271F')}
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
        {rows && ajan ? (
          <div className="k-row">
            <span
              style={{ flex: '999 1 220px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <span
                className="k-avatar"
                style={{ background: '#E7FAF0', color: '#1E2333', fontSize: 12.5 }}
                aria-hidden="true"
              >
                AJ
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 800 }}>Rengarenk Ajanı</span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073' }}>Ajan rolü</span>
              </span>
            </span>
            <span style={{ flex: '1 1 110px', fontWeight: 700 }}>Ajan</span>
            <span style={{ flex: '1 1 120px', fontSize: 13, color: '#3A4052' }}>Sürekli</span>
            <span style={{ flex: '1 1 180px', fontSize: 13, color: '#3A4052' }}>
              {ajan.toplam7} işlem · %
              {new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(ajan.geriOran * 100)} geri
              alındı
            </span>
            <span style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="k-pill" style={{ background: '#E7FAF0', color: '#11683F' }}>
                {ajan.calisiyor ? 'Çalışıyor' : 'Durduruldu'}
              </span>
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}
