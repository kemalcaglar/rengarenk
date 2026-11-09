'use client';

import { DASH_PERIODS, type DashMetric, type DashPeriod, GOAL_KEYS, type GoalKey } from '@rengarenk/shared';
import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

interface Olcum {
  key: DashMetric;
  ad: string;
  deger: number;
  yazi: string;
  fark: { metin: string; artis: boolean };
  karsi: string;
}
interface HedefSatir {
  key: GoalKey;
  ad: string;
  mevcut: string;
  hedef: string | null;
  hedefHam: number | null;
  ilerleme?: number;
  beklenen?: number | null;
  durumAd?: string;
  bg?: string;
  fg?: string;
  not?: string;
}
interface Panel {
  guncel: string;
  ana: {
    oran: number | null;
    toplam: number;
    once: number | null;
    farkPuan: number | null;
    trend: { bitis: string; oran: number | null; toplam: number }[];
  };
  olcumler: Olcum[];
  grafik: {
    gunler: { gun: string; adet: number }[];
    notlar: { id: string; gun: string; metin: string; kaynak: string }[];
  };
  bakilacak: { renk: string; baslik: string; detay: string; eylem: string; href: string | null }[];
  hedefler: { ay: string; gecen: number; satirlar: HedefSatir[] };
}
interface Kirilim {
  yorum: string;
  kanalNotu: string | null;
  kirilim: {
    ad: string;
    satir: { ad: string; deger: number; pay: number; fark: { metin: string; artis: boolean } }[];
  }[];
}

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const AYLAR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];
const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const gunYaz = (g: string) => `${Number(g.slice(8, 10))} ${AY_KISA[Number(g.slice(5, 7)) - 1]}`;
const yuzde = (x: number | null) => (x === null ? '—' : `%${Math.round(x * 100)}`);
const sayi = (n: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n);

/**
 * Kontrol paneli (YonetimRapor.dc.html › panel; Karar 44): ana ölçü, hedefi ve 12 haftalık eğilimi; altı ölçü ve dönem
 * seçimi; ölçüye tıklayınca neden analizi (il, kategori, platform; ajanın yorumu kurallardan); son 30 günün günlük yeni
 * talep grafiği ve notları; bugün bakılacaklar; aylık hedefler. Kanal kırılımı reklam ölçümüyle gelecek.
 */
export default function KontrolPaneli() {
  const { me } = useKonsol();
  const [donem, setDonem] = useState<DashPeriod>('bugun');
  const [p, setP] = useState<Panel | null>(null);
  const [detay, setDetay] = useState<DashMetric | null>(null);
  const [k, setK] = useState<Kirilim | null>(null);
  const [notAc, setNotAc] = useState(false);
  const [notMetin, setNotMetin] = useState('');
  const [duzen, setDuzen] = useState<Record<string, string> | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const hedefYazar = me.permissions['sistem.ayarla'] === 'tam';

  const yukle = useCallback(async (d: DashPeriod) => {
    try {
      setP(await yonetim<Panel>(`dashboard?donem=${d}`));
    } catch (e) {
      setHata((e as Error).message);
    }
  }, []);
  useEffect(() => {
    yukle(donem);
  }, [donem, yukle]);
  useEffect(() => {
    if (!detay) return setK(null);
    yonetim<Kirilim>(`dashboard/breakdown/${detay}?donem=${donem}`)
      .then(setK)
      .catch((e: Error) => setHata(e.message));
  }, [detay, donem]);

  if (!p) return <p style={{ color: '#5A6073' }}>{hata ?? 'Yükleniyor…'}</p>;

  const ay = p.hedefler.ay;
  const ayAd = AYLAR[Number(ay.slice(5, 7)) - 1] ?? ay;
  const anaHedef = p.hedefler.satirlar.find((h) => h.key === 'ana_olcu');
  const enCokGun = Math.max(10, ...p.grafik.gunler.map((g) => g.adet));
  const ust = Math.ceil(enCokGun / 10) * 10;
  const trend = p.ana.trend.filter((t) => t.oran !== null);
  const olcum = p.olcumler.find((o) => o.key === detay);
  const donemAd = DASH_PERIODS.find((x) => x.key === donem)?.ad ?? '';

  async function notKaydet() {
    const gun = p?.grafik.gunler.at(-1)?.gun;
    if (!gun || notMetin.trim().length < 3) return;
    try {
      const g = await yonetim<Panel['grafik']>('dashboard/notes', {
        method: 'POST',
        body: { gun, metin: notMetin.trim() },
      });
      setP((x) => (x ? { ...x, grafik: g } : x));
      setNotAc(false);
      setNotMetin('');
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function hedefKaydet() {
    if (!duzen) return;
    const hedefler: Partial<Record<GoalKey, number>> = {};
    for (const [key, v] of Object.entries(duzen)) {
      const n = Number(
        v
          .replace(/\./g, '')
          .replace(',', '.')
          .replace(/[^\d.]/g, ''),
      );
      if (v.trim() !== '' && Number.isFinite(n)) hedefler[key as GoalKey] = n;
    }
    try {
      const h = await yonetim<Panel['hedefler']>('dashboard/goals', {
        method: 'PUT',
        body: { ay, hedefler },
      });
      setP((x) => (x ? { ...x, hedefler: h } : x));
      setDuzen(null);
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Kontrol paneli</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
            {new Intl.DateTimeFormat('tr-TR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              weekday: 'long',
            }).format(new Date(p.guncel))}{' '}
            · veriler{' '}
            {new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(
              new Date(p.guncel),
            )}{' '}
            itibarıyla
          </p>
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: tasarımdaki hap biçimli dönem seçici (YonetimRapor.dc.html) */}
        <div
          role="group"
          aria-label="Dönem"
          style={{
            display: 'flex',
            gap: 6,
            background: '#FFFFFF',
            border: '1px solid #E3E6EF',
            borderRadius: 999,
            padding: 4,
          }}
        >
          {DASH_PERIODS.map((d) => (
            <button
              key={d.key}
              type="button"
              aria-pressed={donem === d.key}
              onClick={() => setDonem(d.key)}
              style={{
                border: 0,
                background: donem === d.key ? '#1E2333' : 'transparent',
                borderRadius: 999,
                padding: '8px 14px',
                fontSize: 13.5,
                fontWeight: donem === d.key ? 800 : 700,
                color: donem === d.key ? '#FFFFFF' : '#1E2333',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {d.ad}
            </button>
          ))}
        </div>
      </div>
      {hata ? <p style={{ color: '#A3271F', fontWeight: 700 }}>{hata}</p> : null}

      <section
        aria-labelledby="ana"
        style={{
          ...kart,
          padding: '18px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '18px 32px',
        }}
      >
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <h2 id="ana" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#5A6073' }}>
            Ana ölçü · ilk mesaj alan talep oranı
          </h2>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>{yuzde(p.ana.oran)}</span>
            {p.ana.farkPuan !== null ? (
              <span
                style={{ fontSize: 14, fontWeight: 800, color: p.ana.farkPuan >= 0 ? '#11683F' : '#A3271F' }}
              >
                {p.ana.farkPuan >= 0 ? '▲' : '▼'} {Math.abs(p.ana.farkPuan)} puan
              </span>
            ) : null}
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#5A6073' }}>
            Son 30 gün · talebine 48 saat içinde en az bir satıcı yazan alıcılar ·{' '}
            {p.ana.toplam ? `${sayi(p.ana.toplam)} talep` : 'henüz 48 saati dolan talep yok'}
            {p.ana.once !== null ? ` · önceki 30 gün ${yuzde(p.ana.once)}` : ''}
          </p>
        </div>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          {anaHedef?.hedef ? (
            <>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}
              >
                <span>
                  {ayAd} hedefi {anaHedef.hedef}
                </span>
                <span style={{ color: '#5A6073' }}>{anaHedef.not?.replace('Son 30 gün; ', '')}</span>
              </div>
              <div
                style={{
                  position: 'relative',
                  height: 10,
                  borderRadius: 999,
                  background: '#EEF0F5',
                  marginTop: 8,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${Math.min(100, (anaHedef.ilerleme ?? 0) * 100)}%`,
                    borderRadius: 999,
                    background: '#5B8CFF',
                  }}
                />
              </div>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: '#5A6073' }}>
              {ayAd} için ana ölçü hedefi girilmedi.
            </p>
          )}
        </div>
        <div style={{ flex: '0 1 220px', minWidth: 0 }}>
          <div
            role="img"
            aria-label={`Son 12 haftada ana ölçü ${yuzde(trend[0]?.oran ?? null)}’dan ${yuzde(trend.at(-1)?.oran ?? null)}’a`}
            style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64 }}
          >
            {p.ana.trend.map((t, i) => (
              <span
                key={t.bitis}
                title={`${12 - i} hafta önce: ${yuzde(t.oran)} (${t.toplam} talep)`}
                style={{
                  flex: 1,
                  height: `${Math.max(4, (t.oran ?? 0) * 100)}%`,
                  background: i === p.ana.trend.length - 1 ? '#2450C8' : '#A9C2FF',
                  borderRadius: '3px 3px 0 0',
                  opacity: t.oran === null ? 0.3 : 1,
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11.5,
              color: '#5A6073',
              marginTop: 4,
            }}
          >
            <span>12 hafta önce {yuzde(p.ana.trend[0]?.oran ?? null)}</span>
            <span>bu hafta {yuzde(p.ana.trend.at(-1)?.oran ?? null)}</span>
          </div>
        </div>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10,
          marginTop: 14,
        }}
      >
        {p.olcumler.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={detay === o.key}
            onClick={() => setDetay(detay === o.key ? null : o.key)}
            style={{
              textAlign: 'left',
              background: '#FFFFFF',
              border: detay === o.key ? '1.5px solid #5B8CFF' : '1px solid #E3E6EF',
              borderRadius: 16,
              padding: 14,
              cursor: 'pointer',
              color: '#1E2333',
              minWidth: 0,
              fontFamily: 'inherit',
            }}
          >
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#5A6073' }}>
              {o.ad}
            </span>
            <span style={{ display: 'block', fontSize: 22, fontWeight: 800, marginTop: 4 }}>{o.yazi}</span>
            <span
              style={{
                display: 'block',
                fontSize: 12.5,
                fontWeight: 800,
                color: o.fark.artis ? '#11683F' : '#A3271F',
                marginTop: 4,
              }}
            >
              {o.fark.metin}
            </span>
            <span style={{ display: 'block', fontSize: 11.5, color: '#5A6073', marginTop: 2 }}>
              {o.karsi}
            </span>
          </button>
        ))}
      </div>

      {detay && olcum ? (
        <section
          aria-labelledby="neden"
          style={{
            marginTop: 12,
            background: '#FFFFFF',
            border: '1.5px solid #5B8CFF',
            borderRadius: 18,
            padding: '18px 20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <h2 id="neden" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
              Neden analizi · {olcum.ad} · {donemAd.toLocaleLowerCase('tr-TR')} · {olcum.yazi}
            </h2>
            <button
              type="button"
              onClick={() => setDetay(null)}
              style={{
                border: 0,
                background: 'transparent',
                padding: 0,
                fontSize: 13.5,
                fontWeight: 700,
                color: '#2450C8',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Kapat
            </button>
          </div>
          {k ? (
            <>
              <p
                style={{
                  margin: '8px 0 14px',
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: '#2E3344',
                  background: '#F6F8FD',
                  borderRadius: 12,
                  padding: '12px 14px',
                }}
              >
                <strong>Ajan:</strong> {k.yorum}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 18,
                }}
              >
                {k.kirilim.map((b) => {
                  const mx = Math.max(1, ...b.satir.map((s) => Math.abs(s.deger)));
                  return (
                    <div key={b.ad} style={{ minWidth: 0 }}>
                      <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: '#5A6073' }}>
                        {b.ad}
                      </h3>
                      {b.satir.length ? null : (
                        <p style={{ margin: 0, fontSize: 12.5, color: '#5A6073' }}>Veri yok</p>
                      )}
                      {b.satir.map((s) => (
                        <div key={s.ad} title={`${s.ad}: payı %${s.pay}`} style={{ marginBottom: 8 }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 6,
                              fontSize: 12.5,
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {s.ad}
                            </span>
                            <span style={{ flex: 'none', color: '#3A4052' }}>
                              {detay === 'gelir' ? `${sayi(s.deger)} ₺` : sayi(s.deger)} ·{' '}
                              <span style={{ fontWeight: 800, color: s.fark.artis ? '#11683F' : '#A3271F' }}>
                                {s.fark.metin}
                              </span>
                            </span>
                          </div>
                          <div
                            style={{
                              height: 6,
                              borderRadius: '0 4px 4px 0',
                              background: '#EEF0F5',
                              marginTop: 4,
                            }}
                          >
                            <div
                              style={{
                                height: 6,
                                width: `${(Math.abs(s.deger) / mx) * 100}%`,
                                borderRadius: '0 4px 4px 0',
                                background: '#5B8CFF',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              {k.kanalNotu ? (
                <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#5A6073' }}>{k.kanalNotu}</p>
              ) : null}
            </>
          ) : (
            <p style={{ color: '#5A6073' }}>Yükleniyor…</p>
          )}
        </section>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 14, alignItems: 'stretch' }}>
        <section
          aria-labelledby="gunluk"
          style={{ ...kart, flex: '3 1 520px', minWidth: 0, padding: '18px 20px' }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 26,
            }}
          >
            <h2 id="gunluk" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
              Günlük yeni talep · son 30 gün
            </h2>
            {notAc ? (
              <span style={{ display: 'flex', gap: 6 }}>
                <label className="sr-only" htmlFor="grafik-not">
                  Not
                </label>
                <input
                  id="grafik-not"
                  value={notMetin}
                  maxLength={80}
                  onChange={(e) => setNotMetin(e.target.value)}
                  placeholder="Bugüne not (ör. Antalya duyurusu)"
                  style={{
                    border: '1px solid #D5DAE5',
                    borderRadius: 10,
                    padding: '7px 10px',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    width: 220,
                  }}
                />
                <button
                  type="button"
                  onClick={notKaydet}
                  style={{
                    border: 0,
                    background: '#5B8CFF',
                    borderRadius: 10,
                    padding: '7px 12px',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Ekle
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setNotAc(true)}
                style={{
                  border: '1px solid #D5DAE5',
                  background: '#FFFFFF',
                  borderRadius: 10,
                  padding: '7px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1E2333',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Not ekle
              </button>
            )}
          </div>
          <div style={{ position: 'relative', height: 190, borderBottom: '1px solid #D5DAE5' }}>
            <div
              style={{ position: 'absolute', left: 0, right: 0, top: 0, borderTop: '1px dashed #EEF0F5' }}
            />
            <div
              style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: '1px dashed #EEF0F5' }}
            />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
              {p.grafik.gunler.map((g) => (
                <span
                  key={g.gun}
                  title={`${gunYaz(g.gun)}: ${g.adet} yeni talep`}
                  style={{
                    flex: 1,
                    height: `${(g.adet / ust) * 100}%`,
                    background: '#5B8CFF',
                    borderRadius: '4px 4px 0 0',
                  }}
                />
              ))}
            </div>
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: -18,
                fontSize: 11,
                color: '#5A6073',
                background: '#FFFFFF',
                padding: '0 4px',
              }}
            >
              {ust}
            </span>
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: 'calc(50% - 16px)',
                fontSize: 11,
                color: '#5A6073',
                background: '#FFFFFF',
                padding: '0 4px',
              }}
            >
              {ust / 2}
            </span>
            {p.grafik.notlar.map((n) => {
              const i = p.grafik.gunler.findIndex((g) => g.gun === n.gun);
              if (i < 0) return null;
              const x = ((i + 0.5) / 30) * 100;
              const sag = x < 60;
              return (
                <div
                  key={n.id}
                  style={{
                    position: 'absolute',
                    top: -20,
                    bottom: 0,
                    left: `${x}%`,
                    borderLeft: '2px dashed #4B2FA6',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      ...(sag ? { top: 0, left: 4 } : { top: 22, right: 4 }),
                      whiteSpace: 'nowrap',
                      fontSize: 11.5,
                      fontWeight: 800,
                      background: '#F3EFFF',
                      color: '#4B2FA6',
                      padding: '2px 7px',
                      borderRadius: 999,
                    }}
                  >
                    {n.metin}
                  </span>
                </div>
              );
            })}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11.5,
              color: '#5A6073',
              marginTop: 6,
            }}
          >
            <span>{gunYaz(p.grafik.gunler[0]?.gun ?? '')}</span>
            <span>{gunYaz(p.grafik.gunler[14]?.gun ?? '')}</span>
            <span>{gunYaz(p.grafik.gunler[29]?.gun ?? '')}</span>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#5A6073' }}>
            Mor çizgiler grafik notudur. Kampanya, fiyat ve kural değişiklikleri kendiliğinden not olarak
            eklenir.
          </p>
        </section>

        <section
          aria-labelledby="bugun"
          style={{ ...kart, flex: '2 1 340px', minWidth: 0, overflow: 'hidden' }}
        >
          <h2
            id="bugun"
            style={{
              margin: 0,
              padding: '16px 18px',
              fontSize: 17,
              fontWeight: 800,
              borderBottom: '1px solid #EEF0F5',
            }}
          >
            Bugün bakman gerekenler
          </h2>
          {p.bakilacak.length ? null : (
            <p style={{ margin: 0, padding: '14px 18px', fontSize: 13.5, color: '#5A6073' }}>
              Bugün bakman gereken bir şey yok.
            </p>
          )}
          {p.bakilacak.map((b) => (
            <div
              key={b.baslik}
              style={{ display: 'flex', gap: 12, padding: '12px 18px', borderBottom: '1px solid #EEF0F5' }}
            >
              <span
                aria-hidden="true"
                style={{
                  flex: 'none',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  marginTop: 5,
                  background: b.renk,
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{b.baslik}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#3A4052', marginTop: 2 }}>
                  {b.detay}
                </span>
                {b.href ? (
                  <Link
                    href={b.href}
                    style={{
                      display: 'inline-block',
                      marginTop: 4,
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#2450C8',
                    }}
                  >
                    {b.eylem}
                  </Link>
                ) : (
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 4,
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#5A6073',
                    }}
                  >
                    {b.eylem}
                  </span>
                )}
              </span>
            </div>
          ))}
        </section>
      </div>

      <section aria-labelledby="hedef" style={{ ...kart, marginTop: 14, padding: '18px 20px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <h2 id="hedef" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
              {ayAd} hedefleri
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#5A6073' }}>
              Ayın %{Math.round(p.hedefler.gecen * 100)}’i geçti. Dikey çizgi bugün olması gereken yeri
              gösterir.
            </p>
          </div>
          {hedefYazar ? (
            duzen ? (
              <button
                type="button"
                onClick={hedefKaydet}
                style={{
                  border: 0,
                  background: '#5B8CFF',
                  borderRadius: 10,
                  padding: '9px 16px',
                  fontSize: 13.5,
                  fontWeight: 800,
                  color: '#1E2333',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Kaydet
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setDuzen(
                    Object.fromEntries(
                      p.hedefler.satirlar.map((h) => [h.key, h.hedefHam === null ? '' : String(h.hedefHam)]),
                    ),
                  )
                }
                style={{
                  border: '1px solid #5B8CFF',
                  background: '#FFFFFF',
                  borderRadius: 10,
                  padding: '8px 14px',
                  fontSize: 13.5,
                  fontWeight: 800,
                  color: '#2450C8',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Hedefleri düzenle
              </button>
            )
          ) : null}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 18,
            marginTop: 16,
          }}
        >
          {p.hedefler.satirlar.map((h) => (
            <div key={h.key} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#5A6073' }}>{h.ad}</div>
              <div style={{ fontSize: 19, fontWeight: 800, marginTop: 3 }}>{h.mevcut}</div>
              {duzen ? (
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#3A4052' }}>
                  Hedef
                  <input
                    value={duzen[h.key] ?? ''}
                    inputMode="decimal"
                    onChange={(e) => setDuzen({ ...duzen, [h.key]: e.target.value })}
                    placeholder={
                      GOAL_KEYS.find((g) => g.key === h.key)?.birim === '%' ? 'örn. 80' : 'örn. 4500'
                    }
                    style={{
                      display: 'block',
                      width: '100%',
                      boxSizing: 'border-box',
                      marginTop: 3,
                      border: '1px solid #D5DAE5',
                      borderRadius: 8,
                      padding: '6px 8px',
                      fontSize: 13.5,
                      fontFamily: 'inherit',
                    }}
                  />
                </label>
              ) : (
                <div style={{ fontSize: 12.5, color: '#3A4052' }}>
                  {h.hedef ? `Hedef ${h.hedef}` : 'Hedef girilmedi'}
                </div>
              )}
              {h.hedef && h.durumAd ? (
                <>
                  <div
                    style={{
                      position: 'relative',
                      height: 8,
                      borderRadius: 999,
                      background: '#EEF0F5',
                      marginTop: 8,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${Math.min(100, (h.ilerleme ?? 0) * 100)}%`,
                        borderRadius: 999,
                        background: '#5B8CFF',
                      }}
                    />
                    {h.beklenen !== null && h.beklenen !== undefined ? (
                      <span
                        style={{
                          position: 'absolute',
                          top: -4,
                          bottom: -4,
                          left: `${h.beklenen * 100}%`,
                          width: 2,
                          background: '#1E2333',
                        }}
                      />
                    ) : null}
                  </div>
                  <div
                    style={{
                      display: 'inline-block',
                      marginTop: 8,
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: 999,
                      background: h.bg,
                      color: h.fg,
                    }}
                  >
                    {h.durumAd}
                  </div>
                  <div style={{ fontSize: 12, color: '#5A6073', marginTop: 4 }}>{h.not}</div>
                </>
              ) : null}
            </div>
          ))}
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 12.5, color: '#5A6073' }}>
          Ajan, hedeften sapmayı pazartesi raporunda yazar; sapma %10'u geçerse hemen bildirir.
        </p>
      </section>
    </>
  );
}
