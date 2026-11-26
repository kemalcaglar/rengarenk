'use client';

import { BUILTIN_ROLES, STAFF_INVITE_HOURS } from '@rengarenk/shared';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { bas, gunSaat, once, yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

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
        <form onSubmit={submitInvite} aria-label="Davet" className={stil.kutu1}>
          <div className={stil.kutu2}>
            <label className={`k-field ${stil.etiket1}`}>
              Şirket e-postası
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ad.soyad@rengarenksite.com"
              />
            </label>
            <label className={`k-field ${stil.etiket2}`}>
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
          <p className={stil.metin1}>
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
          <span className={stil.metin2}>Çalışan</span>
          <span className={stil.metin3}>Rol</span>
          <span className={stil.metin4}>Son giriş</span>
          <span className={stil.etiket2}>Bu hafta</span>
          <span className={stil.metin5}>Durum</span>
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
                <span className={stil.metin6}>
                  <span
                    className={`k-avatar ${stil.metin7}`}
                    style={{ background: davetli ? '#F3F5FA' : AVATAR[i % AVATAR.length] }}
                    aria-hidden="true"
                  >
                    {davetli && m.name === m.email ? '?' : bas(m.name)}
                  </span>
                  <span className={stil.metin8}>
                    <span className={stil.metin9}>{self ? 'Sen' : m.name}</span>
                    <span className={stil.metin10}>
                      {davetli && m.name === m.email
                        ? kalanSaat > 0
                          ? `Davet gönderildi · ${kalanSaat} saat geçerli`
                          : 'Davetin süresi doldu'
                        : m.email}
                    </span>
                  </span>
                </span>
                <span className={stil.metin11}>
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
                      className={stil.girdi1}
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
                <span className={stil.metin12}>{self ? 'Şimdi · bu cihaz' : sonGiris(m.lastLoginAt)}</span>
                <span className={stil.metin13}>{davetli ? '—' : buHafta(m.week, self)}</span>
                <span className={stil.metin14}>
                  <span className="k-pill" style={{ background: bg, color: fg }}>
                    {durum}
                  </span>
                  {editable && davetli ? (
                    <button
                      type="button"
                      className={stil.dugme1}
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
                      className={stil.dugme1}
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
                      className={stil.dugme2}
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
            <span className={stil.metin6}>
              <span className={`k-avatar ${stil.metin15}`} aria-hidden="true">
                AJ
              </span>
              <span className={stil.metin8}>
                <span className={stil.metin16}>Rengarenk Ajanı</span>
                <span className={stil.metin17}>Ajan rolü</span>
              </span>
            </span>
            <span className={stil.metin11}>Ajan</span>
            <span className={stil.metin12}>Sürekli</span>
            <span className={stil.metin13}>
              {ajan.toplam7} işlem · %
              {new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(ajan.geriOran * 100)} geri
              alındı
            </span>
            <span className={stil.metin18}>
              <span className={`k-pill ${stil.metin19}`}>{ajan.calisiyor ? 'Çalışıyor' : 'Durduruldu'}</span>
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}
