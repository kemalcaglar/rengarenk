'use client';

import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';

interface Adim {
  no: number;
  key: string;
  ad: string;
  not: string;
  tamam: { zaman: string; calisan: string; not: string | null } | null;
}
interface Ihlal {
  aktif: {
    id: string;
    no: number;
    tatbikat: boolean;
    ozet: string;
    ogrenildi: string;
    sonTarih: string;
    kurulBildirildi: boolean;
  } | null;
  adimlar: Adim[];
  form: string[];
  kisiBildirimi: string;
  sorumlu: string;
  yedek: string | null;
  sonTatbikat: string | null;
}
interface Resmi {
  id: string;
  no: string;
  makam: string;
  konu: string;
  hedef: string | null;
  durum: 'belge_bekleniyor' | 'inceleniyor' | 'yanitlandi' | 'reddedildi';
  durumAd: string;
  belge: boolean;
  bildirimYasak: boolean;
  verilen: { ne: string; zaman: string; calisan: string }[];
  detay: string;
}
interface Kisi {
  tip: 'kisi' | 'galeri';
  id: string;
  ad: string;
  alt: string;
}

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const girdi: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 5,
  border: '1px solid #D5DAE5',
  borderRadius: 10,
  padding: '9px 11px',
  fontSize: 13.5,
  fontFamily: 'inherit',
};
const ikincil: CSSProperties = {
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 10,
  padding: '7px 12px',
  fontSize: 13,
  fontWeight: 700,
  color: '#1E2333',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const birincil: CSSProperties = { ...ikincil, border: 0, background: '#5B8CFF', fontWeight: 800 };
const DURUM_RENK: Record<Resmi['durum'], [string, string]> = {
  belge_bekleniyor: ['#FFF6DF', '#7A5300'],
  inceleniyor: ['#EEF3FF', '#2450C8'],
  yanitlandi: ['#E7FAF0', '#11683F'],
  reddedildi: ['#F3F5FA', '#3A4052'],
};
const gun = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso));
const saat = (iso: string) => {
  const d = new Date(iso);
  const bugun = new Date().toDateString() === d.toDateString();
  const s = new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(d);
  return bugun ? `bugün ${s}` : `${gun(iso)} ${s}`;
};
const kalan = (iso: string, simdi: number) => {
  const ms = new Date(iso).getTime() - simdi;
  if (ms <= 0) return 'Süre doldu';
  const dk = Math.floor(ms / 60_000);
  return `${Math.floor(dk / 60)} sa ${dk % 60} dk`;
};

/**
 * İhlal ve resmi talepler (YonetimSistem.dc.html › ihlal; Karar 59). Yalnız sahip ve yönetici görür; her adım işlem
 * kaydına girer. Tasarımdaki "Tatbikat başlat"ın yanında gerçek ihlal için de kayıt açılabilir.
 */
export default function IhlalVeResmi() {
  const [i, setI] = useState<Ihlal | null>(null);
  const [r, setR] = useState<Resmi[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [simdi, setSimdi] = useState(() => Date.now());
  const [gercek, setGercek] = useState(false);
  const [ozet, setOzet] = useState('');
  const [rapor, setRapor] = useState('');
  const [acik, setAcik] = useState<string | null>(null);
  const [yeni, setYeni] = useState(false);
  const [form, setForm] = useState({ makam: '', konu: '', bildirimYasak: false });
  const [q, setQ] = useState('');
  const [adaylar, setAdaylar] = useState<Kisi[]>([]);
  const [secili, setSecili] = useState<Kisi | null>(null);
  const [verilen, setVerilen] = useState('');
  const [yanit, setYanit] = useState('');

  const yukle = useCallback(() => {
    Promise.all([yonetim<Ihlal>('breach'), yonetim<Resmi[]>('official')])
      .then(([a, b]) => {
        setI(a);
        setR(b);
      })
      .catch((e: Error) => setHata(e.message));
  }, []);
  useEffect(yukle, [yukle]);
  useEffect(() => {
    const t = setInterval(() => setSimdi(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (q.trim().length < 2 || secili) {
      setAdaylar([]);
      return;
    }
    const t = setTimeout(
      () =>
        yonetim<Kisi[]>(`people?q=${encodeURIComponent(q.trim())}`)
          .then((x) => setAdaylar(x.slice(0, 6)))
          .catch(() => setAdaylar([])),
      300,
    );
    return () => clearTimeout(t);
  }, [q, secili]);

  async function calistir(fn: () => Promise<unknown>) {
    setHata(null);
    try {
      await fn();
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const a = i?.aktif;
  const kenar = a ? '#F2B8B3' : '#E3E6EF';
  const durum = !a ? 'Aktif ihlal yok' : a.tatbikat ? 'Tatbikat sürüyor' : 'İhlal sürüyor';
  const secilen = r.find((x) => x.id === acik) ?? null;

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>İhlal ve resmi talepler</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Yalnız sahip ve yönetici görür. Her adım işlem kaydına girer.
        </p>
      </div>
      {hata ? (
        <p role="alert" style={{ color: '#A3271F', fontWeight: 700 }}>
          {hata}
        </p>
      ) : null}
      {i ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
          <section
            aria-labelledby="ihl"
            style={{
              ...kart,
              border: `1.5px solid ${kenar}`,
              flex: '1 1 380px',
              minWidth: 0,
              padding: '16px 18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h2 id="ihl" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                Veri ihlali prosedürü
              </h2>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: a ? '#FDECEC' : '#E7FAF0',
                  color: a ? '#A3271F' : '#11683F',
                }}
              >
                {durum}
              </span>
            </div>
            {a ? (
              <div style={{ marginTop: 12, background: '#FDECEC', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#A3271F' }}>
                  {a.kurulBildirildi ? 'Kurul’a bildirildi' : 'Kurul’a bildirim için kalan süre'}
                </div>
                {!a.kurulBildirildi ? (
                  <div style={{ fontSize: 30, fontWeight: 800, color: '#A3271F' }}>
                    {kalan(a.sonTarih, simdi)}
                  </div>
                ) : null}
                <div style={{ fontSize: 12, color: '#5C1A15' }}>
                  {a.tatbikat ? 'Tatbikat' : 'İhlal'} · öğrenilme: {saat(a.ogrenildi)} · {a.ozet}
                </div>
              </div>
            ) : null}
            {i.adimlar.map((s) => (
              <div
                key={s.key}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '9px 0',
                  borderTop: '1px solid #EEF0F5',
                  marginTop: 8,
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    flex: 'none',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: s.tamam ? '#E7FAF0' : '#F3EFFF',
                    color: s.tamam ? '#11683F' : '#4B2FA6',
                    fontSize: 12,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {s.tamam ? '✓' : s.no}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: 800 }}>{s.ad}</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 1 }}>
                    {s.not}
                  </span>
                  {a && s.key === 'kurul' && !s.tamam ? (
                    <span style={{ display: 'block', fontSize: 12, color: '#3A4052', marginTop: 4 }}>
                      Form: {i.form.join(' · ')}
                    </span>
                  ) : null}
                  {a && s.key === 'kisiler' && !s.tamam ? (
                    <span
                      style={{
                        display: 'block',
                        fontSize: 12,
                        color: '#3A4052',
                        marginTop: 4,
                        background: '#F3F5FA',
                        borderRadius: 8,
                        padding: '6px 8px',
                      }}
                    >
                      {i.kisiBildirimi}
                    </span>
                  ) : null}
                  {s.tamam ? (
                    <span
                      style={{
                        display: 'block',
                        fontSize: 12,
                        color: '#11683F',
                        marginTop: 2,
                        fontWeight: 700,
                      }}
                    >
                      {saat(s.tamam.zaman)} · {s.tamam.calisan}
                      {s.tamam.not ? ` · ${s.tamam.not}` : ''}
                    </span>
                  ) : null}
                </span>
                {a && !s.tamam && s.key !== 'kapat' ? (
                  <button
                    type="button"
                    style={{ ...ikincil, flex: 'none', alignSelf: 'center' }}
                    onClick={() =>
                      calistir(() => yonetim(`breach/${a.id}/steps/${s.key}`, { method: 'POST', body: {} }))
                    }
                  >
                    Tamamlandı
                  </button>
                ) : null}
              </div>
            ))}
            {a ? (
              <div style={{ marginTop: 10 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700 }}>
                  Rapor (neden, alınan önlemler, tekrarını önleme)
                  <textarea
                    rows={3}
                    value={rapor}
                    onChange={(e) => setRapor(e.target.value)}
                    style={{ ...girdi, resize: 'vertical' }}
                  />
                </label>
                <button
                  type="button"
                  disabled={rapor.trim().length < 20}
                  style={{ ...birincil, marginTop: 8, opacity: rapor.trim().length < 20 ? 0.55 : 1 }}
                  onClick={() =>
                    calistir(async () => {
                      await yonetim(`breach/${a.id}/close`, { method: 'POST', body: { rapor } });
                      setRapor('');
                    })
                  }
                >
                  {a.tatbikat ? 'Tatbikatı bitir' : 'Kaydı kapat ve tutanağı sakla'}
                </button>
              </div>
            ) : (
              <>
                <div
                  style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 12 }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      calistir(() =>
                        yonetim('breach', {
                          method: 'POST',
                          body: { tatbikat: true, ozet: 'Periyodik tatbikat' },
                        }),
                      )
                    }
                    style={{
                      border: '1.5px solid #E5A6A1',
                      background: '#FFFFFF',
                      borderRadius: 12,
                      padding: '10px 14px',
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: '#A3271F',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Tatbikat başlat
                  </button>
                  <button
                    type="button"
                    onClick={() => setGercek((x) => !x)}
                    style={{ ...ikincil, border: 0, padding: 0, color: '#A3271F', background: 'none' }}
                  >
                    Gerçek ihlal kaydı aç
                  </button>
                </div>
                {gercek ? (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700 }}>
                      Ne oldu? (kişisel veri yazma)
                      <textarea
                        rows={2}
                        value={ozet}
                        onChange={(e) => setOzet(e.target.value)}
                        style={{ ...girdi, resize: 'vertical' }}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={ozet.trim().length < 5}
                      style={{ ...birincil, marginTop: 8, background: '#E5484D', color: '#FFFFFF' }}
                      onClick={() =>
                        calistir(async () => {
                          await yonetim('breach', { method: 'POST', body: { tatbikat: false, ozet } });
                          setOzet('');
                          setGercek(false);
                        })
                      }
                    >
                      İhlal kaydını aç · 72 saat başlasın
                    </button>
                  </div>
                ) : null}
              </>
            )}
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#5A6073' }}>
              Sorumlu: {i.sorumlu}
              {i.yedek ? ` · yedek: ${i.yedek}` : ''} ·{' '}
              {i.sonTatbikat ? `son tatbikat ${gun(i.sonTatbikat)}` : 'henüz tatbikat yapılmadı'}
            </p>
          </section>

          <section
            aria-labelledby="resmi"
            style={{ ...kart, flex: '1 1 380px', minWidth: 0, overflow: 'hidden' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                padding: '16px 18px',
                borderBottom: '1px solid #EEF0F5',
              }}
            >
              <h2 id="resmi" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                Resmi makam talepleri
              </h2>
              <button type="button" style={ikincil} onClick={() => setYeni((x) => !x)}>
                {yeni ? 'Vazgeç' : 'Yeni talep'}
              </button>
            </div>
            {yeni ? (
              <div style={{ padding: '12px 18px', borderBottom: '1px solid #EEF0F5', background: '#F7F8FC' }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700 }}>
                  Makam
                  <input
                    value={form.makam}
                    onChange={(e) => setForm({ ...form, makam: e.target.value })}
                    placeholder="Ör. İstanbul Cumhuriyet Başsavcılığı"
                    style={girdi}
                  />
                </label>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>
                  Konu
                  <input
                    value={form.konu}
                    onChange={(e) => setForm({ ...form, konu: e.target.value })}
                    placeholder="Ör. Kullanıcı bilgisi talebi"
                    style={girdi}
                  />
                </label>
                <div style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>
                  <span id="ilgili">İlgili kişi ya da galeri</span>
                  {secili ? (
                    <span
                      style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, fontSize: 13.5 }}
                    >
                      <strong>{secili.ad}</strong>
                      <button type="button" style={ikincil} onClick={() => setSecili(null)}>
                        Değiştir
                      </button>
                    </span>
                  ) : (
                    <input
                      aria-labelledby="ilgili"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Ad, galeri adı ya da telefonun son haneleri"
                      style={girdi}
                    />
                  )}
                </div>
                {adaylar.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => {
                      setSecili(k);
                      setQ('');
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      border: 0,
                      borderBottom: '1px solid #EEF0F5',
                      background: '#FFFFFF',
                      padding: '7px 10px',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <strong>{k.ad}</strong> <span style={{ color: '#5A6073' }}>· {k.alt}</span>
                  </button>
                ))}
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={form.bildirimYasak}
                    onChange={(e) => setForm({ ...form, bildirimYasak: e.target.checked })}
                  />
                  Talep yazısı kullanıcıya bildirimi yasaklıyor
                </label>
                <button
                  type="button"
                  disabled={form.makam.trim().length < 3 || form.konu.trim().length < 5}
                  style={{ ...birincil, marginTop: 10 }}
                  onClick={() =>
                    calistir(async () => {
                      await yonetim('official', {
                        method: 'POST',
                        body: {
                          ...form,
                          ...(secili ? { [secili.tip === 'galeri' ? 'galeri' : 'kisi']: secili.id } : {}),
                        },
                      });
                      setForm({ makam: '', konu: '', bildirimYasak: false });
                      setSecili(null);
                      setYeni(false);
                    })
                  }
                >
                  Talebi kaydet
                </button>
              </div>
            ) : null}
            {r.length === 0 ? (
              <p style={{ margin: 0, padding: '12px 18px', fontSize: 13, color: '#5A6073' }}>
                Henüz resmi makam talebi yok.
              </p>
            ) : null}
            {r.map((x) => {
              const [bg, fg] = DURUM_RENK[x.durum];
              const on = acik === x.id;
              return (
                <div key={x.id} style={{ borderBottom: '1px solid #EEF0F5' }}>
                  <button
                    type="button"
                    aria-expanded={on}
                    onClick={() => setAcik(on ? null : x.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      border: 0,
                      background: on ? '#F7F8FC' : '#FFFFFF',
                      padding: '12px 18px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      color: '#1E2333',
                    }}
                  >
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800 }}>{x.makam}</span>
                      <span
                        style={{
                          flex: 'none',
                          fontSize: 11.5,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: bg,
                          color: fg,
                        }}
                      >
                        {x.durumAd}
                      </span>
                    </span>
                    <span style={{ display: 'block', fontSize: 12.5, color: '#3A4052', marginTop: 3 }}>
                      {x.detay}
                    </span>
                  </button>
                  {on && secilen ? (
                    <div style={{ padding: '0 18px 14px', background: '#F7F8FC', fontSize: 13 }}>
                      <p style={{ margin: '0 0 8px', color: '#5A6073', fontSize: 12.5 }}>
                        {secilen.no}
                        {secilen.bildirimYasak ? ' · yazı kullanıcıya bildirimi yasaklıyor' : ''}
                      </p>
                      {secilen.belge ? (
                        <button
                          type="button"
                          style={ikincil}
                          onClick={() =>
                            calistir(async () => {
                              const res = await fetch(`/api/yonetim/official/${secilen.id}/document`);
                              if (!res.ok) throw new Error('Resmi yazı açılamadı');
                              window.open(URL.createObjectURL(await res.blob()), '_blank');
                            })
                          }
                        >
                          Resmi yazıyı aç
                        </button>
                      ) : null}
                      {secilen.durum === 'belge_bekleniyor' || secilen.durum === 'inceleniyor' ? (
                        <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>
                          {secilen.belge ? 'Resmi yazıyı değiştir' : 'Resmi yazıyı yükle (PDF ya da görsel)'}
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png"
                            style={{ display: 'block', marginTop: 5, fontSize: 13 }}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              calistir(async () => {
                                const res = await fetch(`/api/yonetim/official/${secilen.id}/document`, {
                                  method: 'POST',
                                  headers: { 'x-rr-istek': '1', 'content-type': f.type || 'application/pdf' },
                                  body: f,
                                });
                                if (!res.ok)
                                  throw new Error(
                                    (await res.json().catch(() => null))?.message ?? 'Yüklenemedi',
                                  );
                              });
                            }}
                          />
                        </label>
                      ) : null}
                      {secilen.verilen.length ? (
                        <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#3A4052' }}>
                          {secilen.verilen.map((v) => (
                            <li key={v.zaman}>
                              {v.ne} · {saat(v.zaman)} · {v.calisan}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {secilen.durum === 'inceleniyor' ? (
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <input
                            value={verilen}
                            onChange={(e) => setVerilen(e.target.value)}
                            placeholder="Verilen veri (ör. 3 Kas–5 Kas mesaj kayıtları)"
                            style={{ ...girdi, marginTop: 0 }}
                          />
                          <button
                            type="button"
                            disabled={verilen.trim().length < 3}
                            style={{ ...ikincil, flex: 'none' }}
                            onClick={() =>
                              calistir(async () => {
                                await yonetim(`official/${secilen.id}/give`, {
                                  method: 'POST',
                                  body: { ne: verilen },
                                });
                                setVerilen('');
                              })
                            }
                          >
                            Kaydet
                          </button>
                        </div>
                      ) : null}
                      {secilen.durum === 'belge_bekleniyor' || secilen.durum === 'inceleniyor' ? (
                        <div style={{ marginTop: 10 }}>
                          <input
                            value={yanit}
                            onChange={(e) => setYanit(e.target.value)}
                            placeholder="Karar notu"
                            style={girdi}
                          />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            {secilen.durum === 'inceleniyor' ? (
                              <button
                                type="button"
                                disabled={yanit.trim().length < 5}
                                style={birincil}
                                onClick={() =>
                                  calistir(async () => {
                                    await yonetim(`official/${secilen.id}/reply`, {
                                      method: 'POST',
                                      body: { durum: 'yanitlandi', not: yanit },
                                    });
                                    setYanit('');
                                  })
                                }
                              >
                                Yanıtlandı
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={yanit.trim().length < 5}
                              style={ikincil}
                              onClick={() =>
                                calistir(async () => {
                                  await yonetim(`official/${secilen.id}/reply`, {
                                    method: 'POST',
                                    body: { durum: 'reddedildi', not: yanit },
                                  });
                                  setYanit('');
                                })
                              }
                            >
                              Reddet
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <p style={{ margin: 0, padding: '12px 18px', fontSize: 12, color: '#5A6073' }}>
              Talep yazısı yüklenir, verilen her veri kaydedilir. Kullanıcıya bildirim, talep yazısı aksini
              söylemiyorsa yapılır.
            </p>
          </section>
        </div>
      ) : null}
    </>
  );
}
