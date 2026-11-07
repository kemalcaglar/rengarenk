'use client';

import {
  FLAG_AUDIENCE_NAMES,
  FLAG_AUDIENCES,
  FLAG_PLATFORMS,
  type FlagAudience,
  type FlagPlatform,
} from '@rengarenk/shared';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { tarih, yonetim } from '../../../lib/istemci';
import { Switch } from '../switch';

interface Flag {
  key: string;
  ad: string;
  not: string;
  enabled: boolean;
  audience: FlagAudience;
  percent: number;
  platforms: FlagPlatform[];
  note: string | null;
  updatedAt: string | null;
}

interface Tester {
  userId: string;
  phone: string;
  name: string | null;
  addedAt: string;
}

const PLATFORM_NAMES: Record<FlagPlatform, string> = { WEB: 'Web', IOS: 'iOS', ANDROID: 'Android' };

/** "Web · %50 · Kurumsal hesaplar" gibi kapsam özeti (tasarımdaki sağ sütun). */
function scope(f: Flag) {
  const parts = [
    f.platforms.length === 0 || f.platforms.length === 3
      ? null
      : f.platforms.map((p) => PLATFORM_NAMES[p]).join(', '),
    f.percent < 100 ? `%${f.percent}` : null,
    f.audience === 'ALL' && f.platforms.length === 0 && f.percent >= 100 ? 'Herkes' : null,
    f.audience !== 'ALL' ? FLAG_AUDIENCE_NAMES[f.audience] : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

/** Özellik anahtarları ve bakım (tasarım: YonetimSistem). Yetki: "Bakım modu ve özellik anahtarları". */
export default function Sistem() {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [maintenance, setMaintenance] = useState<Flag[]>([]);
  const [testers, setTesters] = useState<Tester[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    yonetim<{ flags: Flag[]; maintenance: Flag[] }>('flags')
      .then((r) => {
        setFlags(r.flags);
        setMaintenance(r.maintenance);
        setNotes(Object.fromEntries(r.maintenance.map((m) => [m.key, m.note ?? ''])));
      })
      .catch((e: Error) => setError(e.message));
    yonetim<Tester[]>('flags/testers')
      .then(setTesters)
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const patch = (key: string, body: Partial<Pick<Flag, 'enabled' | 'audience' | 'percent' | 'platforms'>>) =>
    run(() => yonetim(`flags/${key}`, { method: 'PATCH', body }));

  function addTester(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      await yonetim('flags/testers', { method: 'POST', body: { phone } });
      setPhone('');
    });
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 className="k-h1">Özellik anahtarları ve bakım</h1>
        <p className="k-sub">
          Yeni özellik önce küçük bir gruba açılır; sorun çıkarsa kod değişmeden kapatılır (Karar 47).
        </p>
      </div>
      {error ? (
        <p className="k-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="k-panel" aria-labelledby="oz">
        <h2
          id="oz"
          style={{
            margin: 0,
            padding: '16px 18px',
            fontSize: 17,
            fontWeight: 800,
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          Özellik anahtarları
        </h2>
        {flags === null ? (
          <div className="k-empty">Yükleniyor…</div>
        ) : (
          flags.map((f) => (
            <div key={f.key} style={{ borderBottom: '1px solid #EEF0F5' }}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '8px 16px',
                  padding: '12px 18px',
                }}
              >
                <span style={{ flex: '999 1 280px', minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{f.ad}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: '#3A4052', marginTop: 2 }}>
                    {f.not}
                  </span>
                </span>
                <button
                  type="button"
                  className="k-link"
                  style={{
                    flex: '1 1 200px',
                    minWidth: 0,
                    textAlign: 'left',
                    fontSize: 12.5,
                    color: '#3A4052',
                  }}
                  aria-expanded={open === f.key}
                  onClick={() => setOpen(open === f.key ? null : f.key)}
                >
                  {scope(f)} <span style={{ color: '#2450C8' }}>· kapsamı değiştir</span>
                </button>
                <Switch
                  on={f.enabled}
                  label={`${f.ad}: aç veya kapat`}
                  disabled={busy}
                  onChange={() => patch(f.key, { enabled: !f.enabled })}
                />
              </div>
              {open === f.key ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 14,
                    padding: '0 18px 14px',
                    alignItems: 'flex-end',
                  }}
                >
                  <label className="k-field" style={{ flex: '1 1 200px' }}>
                    Kitle
                    <select
                      value={f.audience}
                      disabled={busy}
                      onChange={(e) => patch(f.key, { audience: e.target.value as FlagAudience })}
                    >
                      {FLAG_AUDIENCES.map((a) => (
                        <option key={a} value={a}>
                          {FLAG_AUDIENCE_NAMES[a]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="k-field" style={{ flex: '0 1 140px' }}>
                    Yüzde
                    <input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={f.percent}
                      disabled={busy}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== f.percent && v >= 0 && v <= 100) patch(f.key, { percent: v });
                      }}
                    />
                  </label>
                  <fieldset
                    style={{
                      flex: '1 1 220px',
                      border: 0,
                      padding: 0,
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    <legend style={{ padding: 0, marginBottom: 8 }}>
                      Platform (hiçbiri seçili değilse hepsi)
                    </legend>
                    <span style={{ display: 'flex', gap: 14, fontWeight: 600 }}>
                      {FLAG_PLATFORMS.map((p) => (
                        <label key={p} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={f.platforms.includes(p)}
                            disabled={busy}
                            onChange={(e) =>
                              patch(f.key, {
                                platforms: e.target.checked
                                  ? [...f.platforms, p]
                                  : f.platforms.filter((x) => x !== p),
                              })
                            }
                          />
                          {PLATFORM_NAMES[p]}
                        </label>
                      ))}
                    </span>
                  </fieldset>
                  <p style={{ flex: '1 1 100%', margin: 0, fontSize: 12.5, color: '#5A6073' }}>
                    Yüzde, giriş yapmış kullanıcılara uygulanır; aynı kişi hep aynı sonucu görür.
                    {f.updatedAt ? ` Son değişiklik: ${tarih(f.updatedAt)}.` : ''}
                  </p>
                </div>
              ) : null}
            </div>
          ))
        )}
      </section>

      <section className="k-panel" style={{ marginTop: 16 }} aria-labelledby="deneme">
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #EEF0F5' }}>
          <h2 id="deneme" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
            Deneme kullanıcıları
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#5A6073' }}>
            Kitlesi "Yalnızca deneme kullanıcıları" olan özellikler yalnızca bu kişilere açılır. Çalışanların
            kendi kullanıcı hesaplarını ekle; kişinin uygulamaya bir kez giriş yapmış olması gerekir.
          </p>
        </div>
        {testers.map((t) => (
          <div key={t.userId} className="k-row" style={{ borderTop: 0, borderBottom: '1px solid #EEF0F5' }}>
            <span style={{ flex: '999 1 200px', fontWeight: 700 }}>{t.name ?? 'Adsız kullanıcı'}</span>
            <span style={{ flex: '1 1 160px', fontSize: 13, color: '#3A4052' }}>{t.phone}</span>
            <button
              className="k-btn-danger"
              type="button"
              disabled={busy}
              onClick={() => run(() => yonetim(`flags/testers/${t.userId}`, { method: 'DELETE' }))}
            >
              Çıkar
            </button>
          </div>
        ))}
        <form
          onSubmit={addTester}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '12px 18px', alignItems: 'flex-end' }}
        >
          <label className="k-field" style={{ flex: '1 1 220px' }}>
            Cep telefonu
            <input
              inputMode="tel"
              placeholder="0532 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <button className="k-btn-line" type="submit" disabled={busy || phone.trim().length < 10}>
            Listeye ekle
          </button>
        </form>
      </section>

      <section className="k-panel" style={{ marginTop: 16 }} aria-labelledby="bakim">
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #EEF0F5' }}>
          <h2 id="bakim" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
            Bakım modu
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#5A6073' }}>
            Yalnız sahip ve yönetici. Açılınca kullanıcılara üst şeritte duyuru kendiliğinden çıkar.
          </p>
        </div>
        {maintenance.map((b) => {
          const area = b.key;
          return (
            <div
              key={area}
              style={{
                padding: '12px 18px',
                borderBottom: '1px solid #EEF0F5',
                background: b.enabled ? '#FFF7F6' : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{b.ad}</span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      color: b.enabled ? '#A3271F' : '#5A6073',
                      marginTop: 2,
                    }}
                  >
                    {b.enabled ? 'Bakımda · kullanıcılara duyuru şeridi gösteriliyor' : b.not}
                  </span>
                </span>
                <Switch
                  on={b.enabled}
                  danger
                  label={`${b.ad}: bakıma al`}
                  disabled={busy}
                  onChange={() => {
                    if (
                      !b.enabled &&
                      area === 'tum' &&
                      !confirm('Tüm site bakıma alınsın mı? Kullanıcılar siteyi kullanamaz.')
                    )
                      return;
                    run(() =>
                      yonetim(`flags/bakim/${area}`, {
                        method: 'PUT',
                        body: { enabled: !b.enabled, note: notes[area] ?? '' },
                      }),
                    );
                  }}
                />
              </div>
              <label className="k-field" style={{ display: 'block', marginTop: 8 }}>
                <span className="sr-only">{b.ad} duyuru metni</span>
                <input
                  placeholder="Duyuru metni (boşsa: Rengarenk kısa bir bakımda. Birazdan yeniden deneyebilirsin.)"
                  value={notes[area] ?? ''}
                  maxLength={200}
                  onChange={(e) => setNotes({ ...notes, [area]: e.target.value })}
                  onBlur={() => {
                    if (b.enabled && (notes[area] ?? '') !== (b.note ?? ''))
                      run(() =>
                        yonetim(`flags/bakim/${area}`, {
                          method: 'PUT',
                          body: { enabled: true, note: notes[area] ?? '' },
                        }),
                      );
                  }}
                  style={{ fontSize: 13.5, padding: 9 }}
                />
              </label>
            </div>
          );
        })}
      </section>
    </>
  );
}
