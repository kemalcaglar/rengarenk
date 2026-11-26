'use client';

import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import stil from './page.module.css';

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
      <div className={stil.kutu1}>
        <h1 className={stil.baslik1}>İhlal ve resmi talepler</h1>
        <p className={stil.metin1}>Yalnız sahip ve yönetici görür. Her adım işlem kaydına girer.</p>
      </div>
      {hata ? (
        <p role="alert" className={stil.metin2}>
          {hata}
        </p>
      ) : null}
      {i ? (
        <div className={stil.kutu2}>
          <section aria-labelledby="ihl" className={stil.kutu3} style={{ border: `1.5px solid ${kenar}` }}>
            <div className={stil.kutu4}>
              <h2 id="ihl" className={stil.baslik2}>
                Veri ihlali prosedürü
              </h2>
              <span className={cx(stil.metin3, a ? stil.metin4 : stil.metin5)}>{durum}</span>
            </div>
            {a ? (
              <div className={stil.kutu5}>
                <div className={stil.kutu6}>
                  {a.kurulBildirildi ? 'Kurul’a bildirildi' : 'Kurul’a bildirim için kalan süre'}
                </div>
                {!a.kurulBildirildi ? <div className={stil.kutu7}>{kalan(a.sonTarih, simdi)}</div> : null}
                <div className={stil.kutu8}>
                  {a.tatbikat ? 'Tatbikat' : 'İhlal'} · öğrenilme: {saat(a.ogrenildi)} · {a.ozet}
                </div>
              </div>
            ) : null}
            {i.adimlar.map((s) => (
              <div key={s.key} className={stil.kutu9}>
                <span className={cx(stil.metin6, s.tamam ? stil.metin5 : stil.metin7)}>
                  {s.tamam ? '✓' : s.no}
                </span>
                <span className={stil.metin8}>
                  <span className={stil.metin9}>{s.ad}</span>
                  <span className={stil.metin10}>{s.not}</span>
                  {a && s.key === 'kurul' && !s.tamam ? (
                    <span className={stil.metin11}>Form: {i.form.join(' · ')}</span>
                  ) : null}
                  {a && s.key === 'kisiler' && !s.tamam ? (
                    <span className={stil.metin12}>{i.kisiBildirimi}</span>
                  ) : null}
                  {s.tamam ? (
                    <span className={stil.metin13}>
                      {saat(s.tamam.zaman)} · {s.tamam.calisan}
                      {s.tamam.not ? ` · ${s.tamam.not}` : ''}
                    </span>
                  ) : null}
                </span>
                {a && !s.tamam && s.key !== 'kapat' ? (
                  <button
                    type="button"
                    className={stil.dugme1}
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
              <div className={stil.kutu10}>
                <label className={stil.etiket1}>
                  Rapor (neden, alınan önlemler, tekrarını önleme)
                  <textarea
                    rows={3}
                    value={rapor}
                    onChange={(e) => setRapor(e.target.value)}
                    className={stil.girdi1}
                  />
                </label>
                <button
                  type="button"
                  disabled={rapor.trim().length < 20}
                  className={stil.dugme2}
                  style={{ opacity: rapor.trim().length < 20 ? 0.55 : 1 }}
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
                <div className={stil.kutu11}>
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
                    className={stil.dugme3}
                  >
                    Tatbikat başlat
                  </button>
                  <button type="button" onClick={() => setGercek((x) => !x)} className={stil.dugme4}>
                    Gerçek ihlal kaydı aç
                  </button>
                </div>
                {gercek ? (
                  <div className={stil.kutu10}>
                    <label className={stil.etiket1}>
                      Ne oldu? (kişisel veri yazma)
                      <textarea
                        rows={2}
                        value={ozet}
                        onChange={(e) => setOzet(e.target.value)}
                        className={stil.girdi1}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={ozet.trim().length < 5}
                      className={stil.dugme5}
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
            <p className={stil.metin14}>
              Sorumlu: {i.sorumlu}
              {i.yedek ? ` · yedek: ${i.yedek}` : ''} ·{' '}
              {i.sonTatbikat ? `son tatbikat ${gun(i.sonTatbikat)}` : 'henüz tatbikat yapılmadı'}
            </p>
          </section>

          <section aria-labelledby="resmi" className={stil.kutu12}>
            <div className={stil.kutu13}>
              <h2 id="resmi" className={stil.baslik2}>
                Resmi makam talepleri
              </h2>
              <button type="button" className={stil.dugme6} onClick={() => setYeni((x) => !x)}>
                {yeni ? 'Vazgeç' : 'Yeni talep'}
              </button>
            </div>
            {yeni ? (
              <div className={stil.kutu14}>
                <label className={stil.etiket1}>
                  Makam
                  <input
                    value={form.makam}
                    onChange={(e) => setForm({ ...form, makam: e.target.value })}
                    placeholder="Ör. İstanbul Cumhuriyet Başsavcılığı"
                    className={stil.girdi2}
                  />
                </label>
                <label className={stil.etiket2}>
                  Konu
                  <input
                    value={form.konu}
                    onChange={(e) => setForm({ ...form, konu: e.target.value })}
                    placeholder="Ör. Kullanıcı bilgisi talebi"
                    className={stil.girdi2}
                  />
                </label>
                <div className={stil.etiket2}>
                  <span id="ilgili">İlgili kişi ya da galeri</span>
                  {secili ? (
                    <span className={stil.metin15}>
                      <strong>{secili.ad}</strong>
                      <button type="button" className={stil.dugme6} onClick={() => setSecili(null)}>
                        Değiştir
                      </button>
                    </span>
                  ) : (
                    <input
                      aria-labelledby="ilgili"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Ad, galeri adı ya da telefonun son haneleri"
                      className={stil.girdi2}
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
                    className={stil.dugme7}
                  >
                    <strong>{k.ad}</strong> <span className={stil.metin16}>· {k.alt}</span>
                  </button>
                ))}
                <label className={stil.etiket3}>
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
                  className={stil.dugme8}
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
            {r.length === 0 ? <p className={stil.metin17}>Henüz resmi makam talebi yok.</p> : null}
            {r.map((x) => {
              const [bg, fg] = DURUM_RENK[x.durum];
              const on = acik === x.id;
              return (
                <div key={x.id} className={stil.kutu15}>
                  <button
                    type="button"
                    aria-expanded={on}
                    onClick={() => setAcik(on ? null : x.id)}
                    className={cx(stil.dugme9, on ? stil.dugme10 : stil.dugme11)}
                  >
                    <span className={stil.metin18}>
                      <span className={stil.metin19}>{x.makam}</span>
                      <span className={stil.metin20} style={{ background: bg, color: fg }}>
                        {x.durumAd}
                      </span>
                    </span>
                    <span className={stil.metin21}>{x.detay}</span>
                  </button>
                  {on && secilen ? (
                    <div className={stil.kutu16}>
                      <p className={stil.metin22}>
                        {secilen.no}
                        {secilen.bildirimYasak ? ' · yazı kullanıcıya bildirimi yasaklıyor' : ''}
                      </p>
                      {secilen.belge ? (
                        <button
                          type="button"
                          className={stil.dugme6}
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
                        <label className={stil.etiket2}>
                          {secilen.belge ? 'Resmi yazıyı değiştir' : 'Resmi yazıyı yükle (PDF ya da görsel)'}
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png"
                            className={stil.girdi3}
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
                        <ul className={stil.liste1}>
                          {secilen.verilen.map((v) => (
                            <li key={v.zaman}>
                              {v.ne} · {saat(v.zaman)} · {v.calisan}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {secilen.durum === 'inceleniyor' ? (
                        <div className={stil.kutu17}>
                          <input
                            value={verilen}
                            onChange={(e) => setVerilen(e.target.value)}
                            placeholder="Verilen veri (ör. 3 Kas–5 Kas mesaj kayıtları)"
                            className={stil.girdi4}
                          />
                          <button
                            type="button"
                            disabled={verilen.trim().length < 3}
                            className={stil.dugme12}
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
                        <div className={stil.kutu10}>
                          <input
                            value={yanit}
                            onChange={(e) => setYanit(e.target.value)}
                            placeholder="Karar notu"
                            className={stil.girdi2}
                          />
                          <div className={stil.kutu18}>
                            {secilen.durum === 'inceleniyor' ? (
                              <button
                                type="button"
                                disabled={yanit.trim().length < 5}
                                className={stil.dugme13}
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
                              className={stil.dugme6}
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
            <p className={stil.metin23}>
              Talep yazısı yüklenir, verilen her veri kaydedilir. Kullanıcıya bildirim, talep yazısı aksini
              söylemiyorsa yapılır.
            </p>
          </section>
        </div>
      ) : null}
    </>
  );
}
