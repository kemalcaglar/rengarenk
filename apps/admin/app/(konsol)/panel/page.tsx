'use client';

import { DASH_PERIODS, type DashMetric, type DashPeriod, GOAL_KEYS, type GoalKey } from '@rengarenk/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

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

  if (!p) return <p className={stil.metin1}>{hata ?? 'Yükleniyor…'}</p>;

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
      <div className={stil.kutu1}>
        <div>
          <h1 className={stil.baslik1}>Kontrol paneli</h1>
          <p className={stil.metin2}>
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
        <div role="group" aria-label="Dönem" className={stil.kutu2}>
          {DASH_PERIODS.map((d) => (
            <button
              key={d.key}
              type="button"
              aria-pressed={donem === d.key}
              onClick={() => setDonem(d.key)}
              className={cx(stil.dugme1, donem === d.key ? stil.dugme2 : stil.dugme3)}
            >
              {d.ad}
            </button>
          ))}
        </div>
      </div>
      {hata ? <p className={stil.metin3}>{hata}</p> : null}

      <section aria-labelledby="ana" className={stil.kutu3}>
        <div className={stil.kutu4}>
          <h2 id="ana" className={stil.baslik2}>
            Ana ölçü · ilk mesaj alan talep oranı
          </h2>
          <div className={stil.kutu5}>
            <span className={stil.metin4}>{yuzde(p.ana.oran)}</span>
            {p.ana.farkPuan !== null ? (
              <span className={cx(stil.metin5, p.ana.farkPuan >= 0 ? stil.metin6 : stil.metin7)}>
                {p.ana.farkPuan >= 0 ? '▲' : '▼'} {Math.abs(p.ana.farkPuan)} puan
              </span>
            ) : null}
          </div>
          <p className={stil.metin8}>
            Son 30 gün · talebine 48 saat içinde en az bir satıcı yazan alıcılar ·{' '}
            {p.ana.toplam ? `${sayi(p.ana.toplam)} talep` : 'henüz 48 saati dolan talep yok'}
            {p.ana.once !== null ? ` · önceki 30 gün ${yuzde(p.ana.once)}` : ''}
          </p>
        </div>
        <div className={stil.kutu6}>
          {anaHedef?.hedef ? (
            <>
              <div className={stil.kutu7}>
                <span>
                  {ayAd} hedefi {anaHedef.hedef}
                </span>
                <span className={stil.metin1}>{anaHedef.not?.replace('Son 30 gün; ', '')}</span>
              </div>
              <div className={stil.kutu8}>
                <span
                  className={stil.metin9}
                  style={{ width: `${Math.min(100, (anaHedef.ilerleme ?? 0) * 100)}%` }}
                />
              </div>
            </>
          ) : (
            <p className={stil.metin10}>{ayAd} için ana ölçü hedefi girilmedi.</p>
          )}
        </div>
        <div className={stil.kutu9}>
          <div
            role="img"
            aria-label={`Son 12 haftada ana ölçü ${yuzde(trend[0]?.oran ?? null)}’dan ${yuzde(trend.at(-1)?.oran ?? null)}’a`}
            className={stil.kutu10}
          >
            {p.ana.trend.map((t, i) => (
              <span
                key={t.bitis}
                title={`${12 - i} hafta önce: ${yuzde(t.oran)} (${t.toplam} talep)`}
                className={cx(
                  stil.metin11,
                  i === p.ana.trend.length - 1 ? stil.metin12 : stil.metin13,
                  t.oran === null ? stil.metin14 : stil.metin15,
                )}
                style={{ height: `${Math.max(4, (t.oran ?? 0) * 100)}%` }}
              />
            ))}
          </div>
          <div className={stil.kutu11}>
            <span>12 hafta önce {yuzde(p.ana.trend[0]?.oran ?? null)}</span>
            <span>bu hafta {yuzde(p.ana.trend.at(-1)?.oran ?? null)}</span>
          </div>
        </div>
      </section>

      <div className={stil.kutu12}>
        {p.olcumler.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={detay === o.key}
            onClick={() => setDetay(detay === o.key ? null : o.key)}
            className={cx(stil.dugme4, detay === o.key ? stil.dugme5 : stil.dugme6)}
          >
            <span className={stil.metin16}>{o.ad}</span>
            <span className={stil.metin17}>{o.yazi}</span>
            <span className={cx(stil.metin18, o.fark.artis ? stil.metin6 : stil.metin7)}>{o.fark.metin}</span>
            <span className={stil.metin19}>{o.karsi}</span>
          </button>
        ))}
      </div>

      {detay && olcum ? (
        <section aria-labelledby="neden" className={stil.kutu13}>
          <div className={stil.kutu14}>
            <h2 id="neden" className={stil.baslik3}>
              Neden analizi · {olcum.ad} · {donemAd.toLocaleLowerCase('tr-TR')} · {olcum.yazi}
            </h2>
            <button type="button" onClick={() => setDetay(null)} className={stil.dugme7}>
              Kapat
            </button>
          </div>
          {k ? (
            <>
              <p className={stil.metin20}>
                <strong>Ajan:</strong> {k.yorum}
              </p>
              <div className={stil.kutu15}>
                {k.kirilim.map((b) => {
                  const mx = Math.max(1, ...b.satir.map((s) => Math.abs(s.deger)));
                  return (
                    <div key={b.ad} className={stil.kutu16}>
                      <h3 className={stil.baslik4}>{b.ad}</h3>
                      {b.satir.length ? null : <p className={stil.metin21}>Veri yok</p>}
                      {b.satir.map((s) => (
                        <div key={s.ad} title={`${s.ad}: payı %${s.pay}`} className={stil.kutu17}>
                          <div className={stil.kutu18}>
                            <span className={stil.metin22}>{s.ad}</span>
                            <span className={stil.metin23}>
                              {detay === 'gelir' ? `${sayi(s.deger)} ₺` : sayi(s.deger)} ·{' '}
                              <span className={cx(stil.metin24, s.fark.artis ? stil.metin6 : stil.metin7)}>
                                {s.fark.metin}
                              </span>
                            </span>
                          </div>
                          <div className={stil.kutu19}>
                            <div
                              className={stil.kutu20}
                              style={{ width: `${(Math.abs(s.deger) / mx) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              {k.kanalNotu ? <p className={stil.metin25}>{k.kanalNotu}</p> : null}
            </>
          ) : (
            <p className={stil.metin1}>Yükleniyor…</p>
          )}
        </section>
      ) : null}

      <div className={stil.kutu21}>
        <section aria-labelledby="gunluk" className={stil.kutu22}>
          <div className={stil.kutu23}>
            <h2 id="gunluk" className={stil.baslik3}>
              Günlük yeni talep · son 30 gün
            </h2>
            {notAc ? (
              <span className={stil.metin26}>
                <label className="sr-only" htmlFor="grafik-not">
                  Not
                </label>
                <input
                  id="grafik-not"
                  value={notMetin}
                  maxLength={80}
                  onChange={(e) => setNotMetin(e.target.value)}
                  placeholder="Bugüne not (ör. Antalya duyurusu)"
                  className={stil.girdi1}
                />
                <button type="button" onClick={notKaydet} className={stil.dugme8}>
                  Ekle
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setNotAc(true)} className={stil.dugme9}>
                Not ekle
              </button>
            )}
          </div>
          <div className={stil.kutu24}>
            <div className={stil.kutu25} />
            <div className={stil.kutu26} />
            <div className={stil.kutu27}>
              {p.grafik.gunler.map((g) => (
                <span
                  key={g.gun}
                  title={`${gunYaz(g.gun)}: ${g.adet} yeni talep`}
                  className={stil.metin27}
                  style={{ height: `${(g.adet / ust) * 100}%` }}
                />
              ))}
            </div>
            <span className={stil.metin28}>{ust}</span>
            <span className={stil.metin29}>{ust / 2}</span>
            {p.grafik.notlar.map((n) => {
              const i = p.grafik.gunler.findIndex((g) => g.gun === n.gun);
              if (i < 0) return null;
              const x = ((i + 0.5) / 30) * 100;
              const sag = x < 60;
              return (
                <div key={n.id} className={stil.kutu28} style={{ left: `${x}%` }}>
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
          <div className={stil.kutu29}>
            <span>{gunYaz(p.grafik.gunler[0]?.gun ?? '')}</span>
            <span>{gunYaz(p.grafik.gunler[14]?.gun ?? '')}</span>
            <span>{gunYaz(p.grafik.gunler[29]?.gun ?? '')}</span>
          </div>
          <p className={stil.metin30}>
            Mor çizgiler grafik notudur. Kampanya, fiyat ve kural değişiklikleri kendiliğinden not olarak
            eklenir.
          </p>
        </section>

        <section aria-labelledby="bugun" className={stil.kutu30}>
          <h2 id="bugun" className={stil.baslik5}>
            Bugün bakman gerekenler
          </h2>
          {p.bakilacak.length ? null : <p className={stil.metin31}>Bugün bakman gereken bir şey yok.</p>}
          {p.bakilacak.map((b) => (
            <div key={b.baslik} className={stil.kutu31}>
              <span aria-hidden="true" className={stil.metin32} style={{ background: b.renk }} />
              <span className={stil.metin33}>
                <span className={stil.metin34}>{b.baslik}</span>
                <span className={stil.metin35}>{b.detay}</span>
                {b.href ? (
                  <Link href={b.href} className={stil.bag1}>
                    {b.eylem}
                  </Link>
                ) : (
                  <span className={stil.metin36}>{b.eylem}</span>
                )}
              </span>
            </div>
          ))}
        </section>
      </div>

      <section aria-labelledby="hedef" className={stil.kutu32}>
        <div className={stil.kutu14}>
          <div>
            <h2 id="hedef" className={stil.baslik3}>
              {ayAd} hedefleri
            </h2>
            <p className={stil.metin37}>
              Ayın %{Math.round(p.hedefler.gecen * 100)}’i geçti. Dikey çizgi bugün olması gereken yeri
              gösterir.
            </p>
          </div>
          {hedefYazar ? (
            duzen ? (
              <button type="button" onClick={hedefKaydet} className={stil.dugme10}>
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
                className={stil.dugme11}
              >
                Hedefleri düzenle
              </button>
            )
          ) : null}
        </div>
        <div className={stil.kutu33}>
          {p.hedefler.satirlar.map((h) => (
            <div key={h.key} className={stil.kutu16}>
              <div className={stil.kutu34}>{h.ad}</div>
              <div className={stil.kutu35}>{h.mevcut}</div>
              {duzen ? (
                <label className={stil.etiket1}>
                  Hedef
                  <input
                    value={duzen[h.key] ?? ''}
                    inputMode="decimal"
                    onChange={(e) => setDuzen({ ...duzen, [h.key]: e.target.value })}
                    placeholder={
                      GOAL_KEYS.find((g) => g.key === h.key)?.birim === '%' ? 'örn. 80' : 'örn. 4500'
                    }
                    className={stil.girdi2}
                  />
                </label>
              ) : (
                <div className={stil.kutu36}>{h.hedef ? `Hedef ${h.hedef}` : 'Hedef girilmedi'}</div>
              )}
              {h.hedef && h.durumAd ? (
                <>
                  <div className={stil.kutu37}>
                    <span
                      className={stil.metin9}
                      style={{ width: `${Math.min(100, (h.ilerleme ?? 0) * 100)}%` }}
                    />
                    {h.beklenen !== null && h.beklenen !== undefined ? (
                      <span className={stil.metin38} style={{ left: `${h.beklenen * 100}%` }} />
                    ) : null}
                  </div>
                  <div className={stil.kutu38} style={{ background: h.bg, color: h.fg }}>
                    {h.durumAd}
                  </div>
                  <div className={stil.kutu39}>{h.not}</div>
                </>
              ) : null}
            </div>
          ))}
        </div>
        <p className={stil.metin39}>
          Ajan, hedeften sapmayı pazartesi raporunda yazar; sapma %10'u geçerse hemen bildirir.
        </p>
      </section>
    </>
  );
}
