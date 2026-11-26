'use client';

import {
  type FeatureFlagKey,
  FLAG_AUDIENCE_NAMES,
  FLAG_AUDIENCES,
  FLAG_PLATFORMS,
  type FlagAudience,
  type FlagPlatform,
  UI_EXPERIMENTS,
} from '@rengarenk/shared';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { tarih, yonetim } from '../../../lib/istemci';
import { Switch } from '../switch';
import stil from './page.module.css';

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

/** "Web · %50 · Kurumsal galeriler" gibi kapsam özeti (tasarımdaki sağ sütun); kapalıysa "Kapalı". */
function scope(f: Flag) {
  if (!f.enabled) return 'Kapalı';
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
      <div className={stil.kutu1}>
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
        <h2 id="oz" className={stil.baslik1}>
          Özellik anahtarları
        </h2>
        {flags === null ? (
          <div className="k-empty">Yükleniyor…</div>
        ) : (
          flags.map((f) => (
            <div key={f.key} className={stil.kutu2}>
              <div className={stil.kutu3}>
                <span className={stil.metin1}>
                  <span className={stil.metin2}>{f.ad}</span>
                  <span className={stil.metin3}>{f.not}</span>
                  {UI_EXPERIMENTS[f.key as FeatureFlagKey] ? (
                    <span className={stil.metin4}>
                      {f.enabled && f.audience === 'ALL' && f.percent > 0 && f.percent < 100
                        ? 'Deney sürüyor · sonuç Raporlar › Deneyler’de'
                        : 'Yüzde 1–99 arası deney başlatır (kitle Herkes); sonuç Raporlar › Deneyler’de'}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className={`k-link ${stil.dugme1}`}
                  title="Kapsamı değiştir"
                  aria-expanded={open === f.key}
                  aria-label={`${f.ad} kapsamı: ${scope(f)}. Değiştir`}
                  onClick={() => setOpen(open === f.key ? null : f.key)}
                >
                  {scope(f)}
                </button>
                <Switch
                  on={f.enabled}
                  label={`${f.ad}: aç veya kapat`}
                  disabled={busy}
                  onChange={() => patch(f.key, { enabled: !f.enabled })}
                />
              </div>
              {open === f.key ? (
                <div className={stil.kutu4}>
                  <label className={`k-field ${stil.etiket1}`}>
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
                  <label className={`k-field ${stil.etiket2}`}>
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
                  <fieldset className={stil.kutu5}>
                    <legend className={stil.baslik2}>Platform (hiçbiri seçili değilse hepsi)</legend>
                    <span className={stil.metin5}>
                      {FLAG_PLATFORMS.map((p) => (
                        <label key={p} className={stil.etiket3}>
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
                  <p className={stil.metin6}>
                    Yüzde, giriş yapmış kullanıcılara uygulanır; aynı kişi hep aynı sonucu görür.
                    {f.updatedAt ? ` Son değişiklik: ${tarih(f.updatedAt)}.` : ''}
                  </p>
                </div>
              ) : null}
            </div>
          ))
        )}
      </section>

      <section className={`k-panel ${stil.kutu6}`} aria-labelledby="bakim">
        <div className={stil.kutu7}>
          <h2 id="bakim" className={stil.baslik3}>
            Bakım modu
          </h2>
          <p className={stil.metin7}>
            Yalnız sahip ve yönetici. Açılınca kullanıcılara üst şeritte duyuru kendiliğinden çıkar.
          </p>
        </div>
        {maintenance.map((b) => {
          const area = b.key;
          return (
            <div key={area} className={cx(stil.kutu8, b.enabled ? stil.kutu9 : undefined)}>
              <div className={stil.kutu10}>
                <span className={stil.metin8}>
                  <span className={stil.metin2}>{b.ad}</span>
                  <span className={cx(stil.metin9, b.enabled ? stil.metin10 : stil.metin11)}>
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
              {b.enabled ? (
                <label className={`k-field ${stil.etiket4}`}>
                  <span className="sr-only">{b.ad} duyuru metni</span>
                  <input
                    placeholder="Duyuru metni: Rengarenk kısa bir bakımda. Birazdan yeniden deneyebilirsin."
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
                    className={stil.girdi1}
                  />
                </label>
              ) : null}
            </div>
          );
        })}
      </section>
      <section className={`k-panel ${stil.kutu6}`} aria-labelledby="deneme">
        <div className={stil.kutu7}>
          <h2 id="deneme" className={stil.baslik3}>
            Çalışanların kullanıcı hesapları
          </h2>
          <p className={stil.metin7}>
            Kapsamı "Yalnızca çalışanlar" olan özellikler bu hesaplara açılır. Çalışanın uygulamaya kendi
            telefonuyla bir kez giriş yapmış olması gerekir.
          </p>
        </div>
        {testers.map((t) => (
          <div key={t.userId} className={`k-row ${stil.kutu11}`}>
            <span className={stil.metin12}>{t.name ?? 'Adsız kullanıcı'}</span>
            <span className={stil.metin13}>{t.phone}</span>
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
        <form onSubmit={addTester} className={stil.kutu12}>
          <label className={`k-field ${stil.etiket5}`}>
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
    </>
  );
}
