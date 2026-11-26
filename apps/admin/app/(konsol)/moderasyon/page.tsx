'use client';

import {
  DECISION_NAMES,
  DECISION_NOTES,
  MODERATION_DECISIONS,
  type ModerationDecision,
} from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

interface Satir {
  id: string;
  no: number;
  oncelik: 'kritik' | 'yuksek' | 'normal';
  oncelikAd: string;
  neden: string;
  taraf: string;
  sonTarih: string;
  durum: 'acik' | 'kapali';
  karar: string | null;
  ajan: string | null;
}
interface Kuyruk {
  acik: Satir[];
  kapali: Satir[];
  suresiAsan: number;
}
interface Detay {
  id: string;
  no: number;
  neden: string;
  oncelik: string;
  hedefTur: 'mesaj' | 'talep' | 'arac';
  gizleAd: string;
  ozet: string;
  aciklama: string | null;
  kanit: {
    baslik: string;
    link: string | null;
    satirlar: { kim: string; yon: 'sol' | 'sag'; metin: string; hedef: boolean; gizli: boolean }[];
  };
  gecmis: number;
  ajan: string | null;
  /** Şikâyet edilenin etkin askısı (bu ya da başka bir karardan) */
  aski: { until: string | null } | null;
  oneri: { karar: ModerationDecision; metin: string };
  durum: 'acik' | 'kapali';
  karar: {
    karar: ModerationDecision;
    ad: string;
    not: string | null;
    kim: string;
    zaman: string;
    onay: string | null;
    geriAlindi: string | null;
  } | null;
  itiraz: { id: string; durum: string; metin: string } | null;
}
interface Itiraz {
  id: string;
  raporId: string;
  no: number;
  ad: string;
  metin: string;
  ilkKarar: string;
  ilkKararId: string | null;
  durum: 'acik' | 'kabul' | 'red';
  sonuc: string | null;
  inceleyen: string | null;
}
/** Galerinin 1 yıldıza itirazı (Karar 55; YonetimPazar.dc.html › "Hızlı Oto · 1 yıldıza itiraz") */
interface YildizItiraz {
  id: string;
  ad: string;
  metin: string;
  kanit: string;
  mesajlar: { taraf: string; metin: string; zaman: string }[];
  durum: 'acik' | 'kabul' | 'red';
  sonuc: string | null;
  inceleyen: string | null;
  sonGun: string;
}
interface Filtreler {
  filtreler: { key: string; ad: string; not: string; acik: boolean }[];
  kelimeler: string[];
}

/** Öncelik rozeti (YonetimPazar.dc.html › OC) */
const OC: Record<string, [string, string]> = {
  kritik: ['#FDECEC', '#A3271F'],
  yuksek: ['#FFF6DF', '#7A5300'],
  normal: ['#EEF3FF', '#2450C8'],
};

function sure(s: Satir, simdi: number): [string, string] {
  if (s.durum === 'kapali') return [s.karar ? `Karar: ${s.karar}` : 'Karara bağlandı', '#11683F'];
  const fark = new Date(s.sonTarih).getTime() - simdi;
  const sa = Math.floor(Math.abs(fark) / 3_600_000);
  const dk = Math.floor((Math.abs(fark) % 3_600_000) / 60_000);
  return fark < 0
    ? [`Süre aştı · ${sa} sa`, '#A3271F']
    : [`Kalan ${sa ? `${sa} sa ` : ''}${dk} dk`, '#5A6073'];
}
const saat = (d: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));

/**
 * Moderasyon (YonetimPazar.dc.html › moderasyon; Karar 41, 53): şikâyet kuyruğu önceliğe ve süreye göre, maskeli kanıt,
 * ajan önerisi, karar; itirazlar; otomatik içerik filtreleri ve yasaklı kelimeler (Yonetim.dc.html › içerik filtreleri).
 */
export default function Moderasyon() {
  const { me } = useKonsol();
  const [q, setQ] = useState<Kuyruk | null>(null);
  const [sec, setSec] = useState<string | null>(null);
  const [d, setD] = useState<Detay | null>(null);
  const [karar, setKarar] = useState<ModerationDecision>('uyari');
  const [not, setNot] = useState('');
  const [itirazlar, setItirazlar] = useState<Itiraz[]>([]);
  const [yildizlar, setYildizlar] = useState<YildizItiraz[]>([]);
  const [f, setF] = useState<Filtreler | null>(null);
  const [yeni, setYeni] = useState('');
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [simdi, setSimdi] = useState(() => Date.now());

  const yukle = useCallback(async () => {
    try {
      const [k, i, y, fl] = await Promise.all([
        yonetim<Kuyruk>('moderation/reports'),
        yonetim<Itiraz[]>('moderation/appeals'),
        yonetim<YildizItiraz[]>('trust/appeals'),
        yonetim<Filtreler>('moderation/filters'),
      ]);
      setQ(k);
      setItirazlar(i);
      setYildizlar(y);
      setF(fl);
      setSec((s) => s ?? k.acik[0]?.id ?? k.kapali[0]?.id ?? null);
    } catch (e) {
      setHata((e as Error).message);
    }
  }, []);
  useEffect(() => {
    yukle();
    const t = setInterval(() => setSimdi(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [yukle]);
  useEffect(() => {
    if (!sec) return;
    setD(null);
    setNot('');
    yonetim<Detay>(`moderation/reports/${sec}`)
      .then((x) => {
        setD(x);
        setKarar(x.oneri.karar);
      })
      .catch((e: Error) => setHata(e.message));
  }, [sec]);

  const yetki = (k: ModerationDecision) => {
    const p = me.permissions;
    if (k === 'aski') return p['hesap.askiya_al'] === 'tam';
    if (k === 'engel') return p['hesap.kalici_engelle'] === 'tam' || p['hesap.kalici_engelle'] === 'oneri';
    return p['sikayet.coz'] === 'tam';
  };

  async function uygula() {
    if (!d) return;
    setHata(null);
    try {
      const x = await yonetim<Detay>(`moderation/reports/${d.id}/decide`, {
        method: 'POST',
        body: { karar, ...(not.trim() ? { not: not.trim() } : {}) },
      });
      setD(x);
      setBilgi(
        karar === 'engel'
          ? 'Kalıcı engelleme önerisi onay kuyruğuna düştü; askı onaya kadar sürer.'
          : `Karar uygulandı: ${DECISION_NAMES[karar]}. İki tarafa bildirim gidiyor.`,
      );
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function itirazKarar(i: Itiraz, kabul: boolean) {
    try {
      setItirazlar(
        await yonetim<Itiraz[]>(`moderation/appeals/${i.id}/decide`, { method: 'POST', body: { kabul } }),
      );
      setBilgi(kabul ? 'İtiraz kabul edildi; yaptırım kalktı.' : 'İtiraz reddedildi; karar geçerli.');
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function yildizKarar(i: YildizItiraz, kabul: boolean) {
    try {
      setYildizlar(
        await yonetim<YildizItiraz[]>(`trust/appeals/${i.id}/decide`, { method: 'POST', body: { kabul } }),
      );
      setBilgi(
        kabul
          ? 'İtiraz kabul edildi; yıldız hesaba katılmıyor, galeriye bildirildi.'
          : 'İtiraz reddedildi; yıldız geçerli, galeriye bildirildi.',
      );
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function filtre(key: string, acik: boolean) {
    try {
      setF(await yonetim<Filtreler>(`moderation/filters/${key}`, { method: 'PUT', body: { acik } }));
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function kelimeEkle() {
    if (yeni.trim().length < 2) return;
    try {
      setF(await yonetim<Filtreler>('moderation/words', { method: 'POST', body: { kelime: yeni.trim() } }));
      setYeni('');
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function kelimeSil(k: string) {
    try {
      setF(await yonetim<Filtreler>(`moderation/words/${encodeURIComponent(k)}`, { method: 'DELETE' }));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  const satirlar = q ? [...q.acik, ...q.kapali] : [];
  return (
    <>
      <div className={stil.kutu1}>
        <h1 className={stil.baslik1}>Moderasyon</h1>
        <p className={stil.metin1}>Kritik 1 saat · yüksek 4 saat · normal 24 saat içinde karara bağlanır.</p>
      </div>
      {hata ? <p className={stil.metin2}>{hata}</p> : null}
      {bilgi ? (
        <p role="status" className={stil.metin3}>
          {bilgi}
        </p>
      ) : null}
      <div className={stil.kutu2}>
        <section aria-label="Şikâyet kuyruğu" className={stil.kutu3}>
          {q && !satirlar.length ? <p className={stil.metin4}>Şikâyet yok.</p> : null}
          {satirlar.map((s) => {
            const on = s.id === sec;
            const [st, sr] = sure(s, simdi);
            const [ob, of] = OC[s.oncelik] ?? OC.normal;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSec(s.id);
                  setBilgi(null);
                }}
                aria-current={on}
                className={cx(
                  stil.dugme1,
                  on ? stil.dugme2 : stil.dugme3,
                  s.durum === 'kapali' ? stil.dugme4 : stil.dugme5,
                )}
              >
                <span className={stil.metin5}>
                  <span className={stil.metin6} style={{ background: ob, color: of }}>
                    {s.oncelikAd}
                  </span>
                  <span className={stil.metin7} style={{ color: sr }}>
                    {st}
                  </span>
                </span>
                <span className={stil.metin8}>{s.neden}</span>
                <span className={stil.metin9}>{s.taraf}</span>
              </button>
            );
          })}
        </section>

        <section aria-labelledby="sk" className={stil.kutu4}>
          {d ? (
            <>
              <div className={stil.kutu5}>
                <h2 id="sk" className={stil.baslik2}>
                  {d.neden} <span className={stil.metin10}>· S-{d.no}</span>
                </h2>
                <div className={stil.kutu6}>{d.ozet}</div>
                {d.aciklama ? (
                  <div className={stil.kutu7}>
                    <strong>Şikâyet eden yazdı:</strong> “{d.aciklama}”
                  </div>
                ) : null}
              </div>
              <div className={stil.kutu8}>
                <div className={stil.kutu9}>
                  Kanıt · {d.hedefTur === 'mesaj' ? 'sohbet kesiti' : d.kanit.baslik} (maskeli)
                  {d.kanit.link ? (
                    <a href={d.kanit.link} target="_blank" rel="noreferrer" className={stil.bag1}>
                      Sitede aç
                    </a>
                  ) : null}
                </div>
                {d.kanit.satirlar.map((sm, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: kesit sırası sabit
                    key={i}
                    className={cx(stil.kutu10, sm.yon === 'sag' ? stil.kutu11 : stil.kutu12)}
                  >
                    <div
                      className={cx(stil.kutu13, sm.hedef ? stil.kutu14 : stil.kutu15)}
                      style={{ border: `1px solid ${sm.hedef ? '#F2C46D' : '#E3E6EF'}` }}
                    >
                      <span className={stil.metin11}>
                        {sm.kim}
                        {sm.gizli ? ' · gizlendi' : ''}
                        {sm.hedef ? ' · şikâyet edilen' : ''}
                      </span>
                      {sm.metin}
                    </div>
                  </div>
                ))}
              </div>
              <div className={stil.kutu16}>
                <strong>Ajan önerisi:</strong> {d.oneri.metin}
                {d.ajan ? <span className={stil.metin12}>Ajan: {d.ajan}.</span> : null}
                {d.aski && d.durum === 'acik' ? (
                  <span className={stil.metin13}>
                    Hesap şu an{' '}
                    {d.aski.until ? `${saat(d.aski.until)} saatine kadar askıda.` : 'onay beklerken askıda.'}
                  </span>
                ) : null}
                {d.gecmis ? (
                  <span className={stil.metin14}>
                    Son 30 günde bu kişi hakkında {d.gecmis} karar daha var.
                  </span>
                ) : null}
              </div>
              {d.durum === 'acik' ? (
                <div className={stil.kutu17}>
                  <div className={stil.kutu18}>Karar</div>
                  <div role="radiogroup" aria-label="Karar" className={stil.kutu19}>
                    {MODERATION_DECISIONS.map((k) => {
                      const on = karar === k;
                      const izin = yetki(k);
                      return (
                        // biome-ignore lint/a11y/useSemanticElements: tasarımdaki karar hapları radyo grubu olarak işaretli
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={!izin}
                          onClick={() => setKarar(k)}
                          title={izin ? undefined : 'Bu karar için yetkin yok'}
                          className={cx(
                            stil.dugme6,
                            on ? stil.dugme7 : stil.kutu15,
                            izin ? stil.dugme8 : stil.dugme9,
                          )}
                          style={{ border: `1.5px solid ${on ? '#5B8CFF' : '#D5DAE5'}` }}
                        >
                          {k === 'gizle' ? d.gizleAd : DECISION_NAMES[k]}
                        </button>
                      );
                    })}
                  </div>
                  <p className={stil.metin15}>{DECISION_NOTES[karar]}</p>
                  <label className={stil.etiket1}>
                    Gerekçe (kullanıcıya gider)
                    <input
                      value={not}
                      onChange={(e) => setNot(e.target.value)}
                      maxLength={500}
                      placeholder="Ör. Mesajında kapora istendi."
                      className={stil.girdi1}
                    />
                  </label>
                  <button type="button" onClick={uygula} disabled={!yetki(karar)} className={stil.dugme10}>
                    Kararı uygula ve iki tarafa bildir
                  </button>
                </div>
              ) : d.karar ? (
                <div className={stil.kutu20}>
                  {d.karar.ad} · {d.karar.kim} · {saat(d.karar.zaman)}
                  {d.karar.onay
                    ? ` · onay: ${d.karar.onay === 'PENDING' ? 'bekliyor' : d.karar.onay.toLocaleLowerCase('tr-TR')}`
                    : ''}
                  {d.karar.geriAlindi ? ' · itirazla geri alındı' : ''}
                  {d.karar.not ? <span className={stil.metin16}>Gerekçe: {d.karar.not}</span> : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className={stil.metin17}>{q ? 'Bir şikâyet seç.' : 'Yükleniyor…'}</p>
          )}
        </section>
      </div>

      <section className={stil.kutu21} aria-labelledby="itiraz">
        <h2 id="itiraz" className={stil.baslik3}>
          İtirazlar
        </h2>
        {!itirazlar.length && !yildizlar.length ? <p className={stil.metin18}>İtiraz yok.</p> : null}
        {itirazlar.map((it) => (
          <div key={it.id} className={stil.kutu22}>
            <span className={stil.metin19}>
              <span className={stil.metin20}>
                {it.ad} · S-{it.no}
              </span>
              <span className={stil.metin21}>
                “{it.metin}” · ilk karar: {it.ilkKarar}
              </span>
            </span>
            {it.durum === 'acik' ? (
              it.ilkKararId === me.id ? (
                <span className={stil.metin22}>İlk kararı sen verdin; başka bir moderatör inceler</span>
              ) : (
                <span className={stil.metin23}>
                  <button type="button" onClick={() => itirazKarar(it, true)} className={stil.dugme11}>
                    Kabul et, kararı geri al
                  </button>
                  <button type="button" onClick={() => itirazKarar(it, false)} className={stil.dugme12}>
                    Reddet
                  </button>
                </span>
              )
            ) : (
              <span className={cx(stil.metin24, it.durum === 'kabul' ? stil.metin25 : stil.metin26)}>
                {it.durum === 'kabul' ? 'Kabul edildi' : 'Reddedildi'} · {it.inceleyen}
              </span>
            )}
          </div>
        ))}
        {yildizlar.map((it) => {
          const kalan = Math.ceil((new Date(it.sonGun).getTime() - simdi) / 86_400_000);
          return (
            <div key={it.id} className={stil.kutu22}>
              <span className={stil.metin19}>
                <span className={stil.metin20}>{it.ad}</span>
                <span className={stil.metin21}>
                  {it.kanit} · galeri: “{it.metin}”
                </span>
                {it.mesajlar.length ? (
                  <details className={stil.kutu23}>
                    <summary className={stil.metin27}>Sohbetin son mesajları (maskeli)</summary>
                    <div className={stil.kutu24}>
                      {it.mesajlar.map((m) => (
                        <span key={`${m.zaman}${m.taraf}`} className={stil.metin26}>
                          <b>{m.taraf}</b> · {saat(m.zaman)}: {m.metin}
                        </span>
                      ))}
                    </div>
                  </details>
                ) : null}
              </span>
              {it.durum === 'acik' ? (
                <span className={stil.metin28}>
                  <span className={cx(stil.metin29, kalan <= 0 ? stil.metin30 : stil.metin26)}>
                    {kalan <= 0 ? 'Süre aştı' : `Kalan ${kalan} gün`}
                  </span>
                  <button type="button" onClick={() => yildizKarar(it, true)} className={stil.dugme11}>
                    Kabul et, yıldızı sayma
                  </button>
                  <button type="button" onClick={() => yildizKarar(it, false)} className={stil.dugme12}>
                    Reddet
                  </button>
                </span>
              ) : (
                <span className={cx(stil.metin24, it.durum === 'kabul' ? stil.metin25 : stil.metin26)}>
                  {it.durum === 'kabul' ? 'Kabul edildi' : 'Reddedildi'} · {it.inceleyen}
                </span>
              )}
            </div>
          );
        })}
      </section>

      {f ? (
        <section className={stil.kutu25} aria-labelledby="filtre">
          <h2 id="filtre" className={stil.baslik4}>
            Otomatik içerik filtreleri
          </h2>
          {f.filtreler.map((x) => (
            <div key={x.key} className={stil.kutu26}>
              <span>
                <span className={stil.metin31}>{x.ad}</span>
                <span className={stil.metin21}>{x.not}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={x.acik}
                aria-label={x.ad}
                onClick={() => filtre(x.key, !x.acik)}
                className={cx(stil.dugme13, x.acik ? stil.dugme14 : stil.dugme15)}
              >
                <span className={cx(stil.metin32, x.acik ? stil.metin33 : stil.metin34)} />
              </button>
            </div>
          ))}
          <div className={stil.kutu27}>
            <span className={stil.metin35}>Yasaklı kelimeler</span>
            <div className={stil.kutu28}>
              {f.kelimeler.map((k) => (
                <span key={k} className={stil.metin36}>
                  {k}
                  <button
                    type="button"
                    aria-label={`${k} kelimesini kaldır`}
                    onClick={() => kelimeSil(k)}
                    className={stil.dugme16}
                  >
                    ×
                  </button>
                </span>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  kelimeEkle();
                }}
                className={stil.kutu29}
              >
                <label htmlFor="ykelime" className={stil.etiket2}>
                  Yeni yasaklı kelime
                </label>
                <input
                  id="ykelime"
                  value={yeni}
                  onChange={(e) => setYeni(e.target.value)}
                  placeholder="Kelime ekle"
                  maxLength={40}
                  className={stil.girdi2}
                />
                <button type="submit" className={stil.dugme17}>
                  Ekle
                </button>
              </form>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
