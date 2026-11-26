'use client';

import {
  HEAT_RAMP,
  ILLER,
  REPORT_COMPARE,
  REPORT_RANGES,
  REPORT_TABS,
  type ReportFilter,
  type ReportTab,
} from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

interface Deney {
  id: string;
  tur: 'banner' | 'kampanya' | 'fiyat' | 'arayuz';
  anahtar?: string;
  ad: string;
  durum: string;
  bg: string;
  fg: string;
  olcu: string;
  kollar: { ad: string; deger: string; w: number; renk: string }[];
  sonuc: string;
  eylem: { kol: 'A' | 'B'; yazi: string } | null;
  bitti: boolean;
}
type Veri = Record<string, unknown> & {
  donem: string;
  filtreNotu: string | null;
  bos?: string;
  yorum?: string;
};
interface Kategori {
  slug: string;
  ad: string;
}
interface Pano {
  id: string;
  name: string;
  tab: ReportTab;
  filter: ReportFilter;
}

const sayi = (n: number) => new Intl.NumberFormat('tr-TR').format(n);
const kucukKart = (ad: string, deger: string, not: string) => (
  <div key={ad} className={stil.kutu1}>
    <div className={stil.kutu2}>{ad}</div>
    <div className={stil.kutu3}>{deger}</div>
    <div className={stil.kutu4}>{not}</div>
  </div>
);

/**
 * Raporlar (YonetimRapor.dc.html › rapor; Karar 44): huni, arz-talep haritası, gelir, en çok talep edilenler, birim
 * ekonomisi ve kohort gerçek veriyle; reklam ve edinim ilk temas ve gece çekilen harcamayla (Karar 35), deneyler A/B
 * testlerinden. Süzgeçler, "Panoya kaydet"
 * (kişisel) ve "Excel'e aktar" (sahip, yönetici, finans; kişisel veri yok, işlem kaydına girer). Ajan notları
 * kurallardan üretilir.
 */
export default function Raporlar() {
  const { me } = useKonsol();
  const disaAktarir = me.permissions['rapor.disa_aktar'] === 'tam';
  const [sekme, setSekme] = useState<ReportTab>('huni');
  const [f, setF] = useState<ReportFilter>({ tarih: '30', karsilastir: 'onceki' });
  const [v, setV] = useState<Veri | null>(null);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [panolar, setPanolar] = useState<Pano[]>([]);
  const [haritaOlcu, setHaritaOlcu] = useState<'bos' | 'sayi'>('bos');
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [tazele, setTazele] = useState(0);
  const [hata, setHata] = useState<string | null>(null);

  const sorgu = useCallback(
    (x: ReportFilter) =>
      new URLSearchParams(
        Object.entries(x).filter(([, val]) => val !== undefined && val !== '') as [string, string][],
      ).toString(),
    [],
  );
  useEffect(() => {
    // "tazele" deney kazananı açılınca raporu yeniden yükler
    if (tazele < 0) return;
    setV(null);
    yonetim<Veri>(`reports/${sekme}?${sorgu(f)}`)
      .then(setV)
      .catch((e: Error) => setHata(e.message));
  }, [sekme, f, sorgu, tazele]);

  async function kazanan(d: Deney) {
    if (!d.eylem) return;
    try {
      if (d.tur === 'fiyat') {
        // Fiyat deneyi: kazanan fiyat, fiyat değişikliği olarak sahibin onayına gider (Karar 56)
        await yonetim(`pricing/experiments/${d.id}/propose`, { method: 'POST', body: {} });
        setBilgi(
          'Kazanan fiyat, fiyat değişikliği olarak sahibin onayına gönderildi (Kurallar ve fiyatlar).',
        );
        setTazele((x) => x + 1);
        return;
      }
      if (d.tur === 'arayuz') {
        // Arayüz deneyi: B herkese açılır (anahtar %100) ya da A'da kalınır (anahtar kapanır)
        await yonetim(`flags/${d.anahtar}/deney/${d.eylem.kol}`, { method: 'POST', body: {} });
        setBilgi(
          d.eylem.kol === 'B'
            ? 'B herkese açıldı; özellik anahtarı %100.'
            : 'Deney bitti; anahtar kapandı, herkes A’yı görüyor.',
        );
        setTazele((x) => x + 1);
        return;
      }
      await yonetim(`banners/${d.id}/ab/${d.eylem.kol}`, { method: 'POST', body: {} });
      setBilgi(
        d.eylem.kol === 'B'
          ? 'B herkese açıldı; banner artık B sürümüyle görünüyor.'
          : 'Test bitti; banner A sürümüyle devam ediyor.',
      );
      setTazele((x) => x + 1);
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/categories`)
      .then((r) => r.json() as Promise<{ slug: string; name?: string; ad?: string }[]>)
      .then((c) => setKategoriler(c.map((x) => ({ slug: x.slug, ad: x.ad ?? x.name ?? x.slug }))))
      .catch(() => undefined);
    yonetim<Pano[]>('reports/views')
      .then(setPanolar)
      .catch(() => undefined);
    // Zamanlanmış raporlar ekranındaki kayıtlı panodan gelindiyse o görünüm açılır
    const pano = new URLSearchParams(window.location.search).get('pano');
    if (pano)
      yonetim<Pano>(`reports/views/${pano}`)
        .then((p) => {
          setSekme(p.tab);
          setF(p.filter);
          setBilgi(`Kayıtlı pano açıldı: “${p.name}”.`);
        })
        .catch((e: Error) => setHata(e.message));
  }, []);

  async function panoyaKaydet() {
    const tab = REPORT_TABS.find((t) => t.key === sekme)?.ad ?? sekme;
    const ad = `${tab} · ${REPORT_RANGES.find((r) => r.key === f.tarih)?.ad.toLocaleLowerCase('tr-TR')}${f.il ? ` · ${f.il}` : ''}`;
    try {
      setPanolar(await yonetim<Pano[]>('reports/views', { method: 'POST', body: { ad, sekme, filtre: f } }));
      setBilgi(`Panoya kaydedildi: “${ad}”. Kayıtlı panolarından açabilirsin.`);
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function disaAktar() {
    try {
      const r = await yonetim<{ dosya: string; csv: string }>(`reports/${sekme}/export?${sorgu(f)}`);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' }));
      a.download = r.dosya;
      a.click();
      URL.revokeObjectURL(a.href);
      setBilgi(`${r.dosya} hazırlandı. Kişisel veri içermez; dışa aktarma işlem kaydına yazıldı.`);
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  // Sekme değişince yeni veri gelene kadar eski sekmenin verisi çizilmez
  const gecerli = v && (v as { sekme?: string }).sekme === sekme ? v : null;
  const veri = gecerli as Record<string, never> | null;

  return (
    <>
      <div className={stil.kutu5}>
        <div>
          <h1 className={stil.baslik1}>Raporlar</h1>
          <p className={stil.metin1}>
            Kırılım için kontrol panelindeki ölçülere tıkla; burada süzgeçlerle daralt.
          </p>
        </div>
        <span className={stil.metin2}>
          <button type="button" onClick={panoyaKaydet} className={stil.dugme1}>
            Panoya kaydet
          </button>
          {disaAktarir ? (
            <button type="button" onClick={disaAktar} className={stil.dugme2}>
              Excel'e aktar
            </button>
          ) : null}
        </span>
      </div>
      {bilgi ? (
        <div role="status" className={stil.kutu6}>
          {bilgi}
        </div>
      ) : null}
      {hata ? <p className={stil.metin3}>{hata}</p> : null}

      <div className={stil.kutu7}>
        <label className={stil.etiket1}>
          Tarih
          <select
            value={f.tarih}
            onChange={(e) => setF({ ...f, tarih: e.target.value as ReportFilter['tarih'] })}
            className={stil.girdi1}
          >
            {REPORT_RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.ad}
              </option>
            ))}
          </select>
        </label>
        <label className={stil.etiket1}>
          Karşılaştır
          <select
            value={f.karsilastir}
            onChange={(e) => setF({ ...f, karsilastir: e.target.value as ReportFilter['karsilastir'] })}
            className={stil.girdi1}
          >
            {REPORT_COMPARE.map((r) => (
              <option key={r.key} value={r.key}>
                {r.ad}
              </option>
            ))}
          </select>
        </label>
        <label className={stil.etiket1}>
          İl
          <select
            value={f.il ?? ''}
            onChange={(e) => setF({ ...f, il: e.target.value || undefined })}
            className={stil.girdi1}
          >
            <option value="">Tüm Türkiye</option>
            {ILLER.map((i) => (
              <option key={i.plaka} value={i.ad}>
                {i.ad}
              </option>
            ))}
          </select>
        </label>
        <label className={stil.etiket1}>
          Kategori
          <select
            value={f.kategori ?? ''}
            onChange={(e) => setF({ ...f, kategori: e.target.value || undefined })}
            className={stil.girdi1}
          >
            <option value="">Tüm kategoriler</option>
            {kategoriler.map((k) => (
              <option key={k.slug} value={k.slug}>
                {k.ad}
              </option>
            ))}
          </select>
        </label>
        <label className={stil.etiket1}>
          Platform
          <select
            value={f.platform ?? ''}
            onChange={(e) =>
              setF({ ...f, platform: (e.target.value || undefined) as ReportFilter['platform'] })
            }
            className={stil.girdi1}
          >
            <option value="">Hepsi</option>
            <option value="WEB">Web</option>
            <option value="IOS">iOS</option>
            <option value="ANDROID">Android</option>
          </select>
        </label>
        {panolar.length ? (
          <label className={stil.etiket1}>
            Kayıtlı panolarım
            <select
              value=""
              onChange={(e) => {
                const p = panolar.find((x) => x.id === e.target.value);
                if (p) {
                  setSekme(p.tab);
                  setF(p.filter);
                }
              }}
              className={stil.girdi1}
            >
              <option value="">Seç</option>
              {panolar.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div role="tablist" aria-label="Rapor türü" className={stil.kutu8}>
        {REPORT_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={sekme === t.key}
            onClick={() => setSekme(t.key)}
            className={cx(stil.dugme3, sekme === t.key ? stil.dugme4 : stil.dugme5)}
            style={{ border: 0, borderBottom: `3px solid ${sekme === t.key ? '#5B8CFF' : 'transparent'}` }}
          >
            {t.ad}
          </button>
        ))}
      </div>

      {!gecerli ? <p className={stil.metin4}>Yükleniyor…</p> : null}
      {gecerli?.filtreNotu ? <p className={stil.metin5}>{gecerli.filtreNotu}</p> : null}
      {gecerli?.bos ? (
        <section className={stil.kutu9}>
          <h2 className={stil.baslik2}>{REPORT_TABS.find((t) => t.key === sekme)?.ad}</h2>
          <p className={stil.metin6}>{gecerli.bos}</p>
        </section>
      ) : null}

      {gecerli && sekme === 'deney' && Array.isArray(gecerli.deneyler) && gecerli.deneyler.length ? (
        <div className={stil.kutu10}>
          {(gecerli.deneyler as Deney[]).map((d) => (
            <article key={d.id} className={stil.kutu11}>
              <div className={stil.kutu12}>
                <span className={stil.metin7}>{d.ad}</span>
                <span className={stil.metin8} style={{ background: d.bg, color: d.fg }}>
                  {d.durum}
                </span>
              </div>
              <p className={stil.metin9}>{d.olcu}</p>
              {d.kollar.map((k) => (
                <div key={k.ad} className={stil.kutu13}>
                  <span className={stil.metin10}>{k.ad}</span>
                  <span className={stil.metin11}>
                    <span className={stil.metin12} style={{ width: `${k.w}%`, background: k.renk }} />
                  </span>
                  <span className={stil.metin13}>{k.deger}</span>
                </div>
              ))}
              <div className={stil.kutu14}>
                <span className={stil.metin14}>{d.sonuc}</span>
                {d.eylem &&
                (d.tur === 'fiyat'
                  ? ['tam', 'oneri'].includes(me.permissions['fiyat.degistir'] ?? '')
                  : d.tur === 'arayuz'
                    ? me.permissions['sistem.ayarla'] === 'tam'
                    : me.permissions['gorunum.duzenle'] === 'tam') ? (
                  <button type="button" onClick={() => kazanan(d)} className={stil.dugme6}>
                    {d.eylem.yazi}
                  </button>
                ) : null}
                {d.bitti && d.tur === 'banner' ? <span className={stil.metin15}>Herkese açıldı</span> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {gecerli && sekme === 'huni' && veri ? (
        <section aria-labelledby="huni" className={stil.kutu9}>
          <h2 id="huni" className={stil.baslik2}>
            Huni · {gecerli.donem}
          </h2>
          <p className={stil.metin16}>
            {veri.ust} {veri.ziyaretNotu}
          </p>
          {(
            veri.huni as {
              ad: string;
              sayi: number;
              not: string;
              w: number;
              fark: { metin: string } | null;
            }[]
          ).map((h) => (
            <div
              key={h.ad}
              title={`${h.ad}: ${sayi(h.sayi)}${h.fark ? ` · önceki döneme göre ${h.fark.metin}` : ''}`}
              className={stil.kutu15}
            >
              <span className={stil.metin17}>{h.ad}</span>
              <span className={stil.metin18}>
                <span className={stil.metin19} style={{ width: `${h.w}%` }} />
              </span>
              <span className={stil.metin20}>{sayi(h.sayi)}</span>
              <span className={stil.metin21}>{h.not}</span>
            </div>
          ))}
          <p className={stil.metin22}>
            <strong>Ajan:</strong> {gecerli.yorum}
          </p>
        </section>
      ) : null}

      {gecerli && sekme === 'harita' && veri ? (
        <div className={stil.kutu16}>
          <section aria-labelledby="harita" className={stil.kutu17}>
            <div className={stil.kutu18}>
              <h2 id="harita" className={stil.baslik2}>
                İl ve kategoriye göre arz-talep
              </h2>
              <span className={stil.metin23}>
                {(
                  [
                    ['bos', 'Mesaj almayan talep oranı'],
                    ['sayi', 'Talep sayısı'],
                  ] as const
                ).map(([k, ad]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={haritaOlcu === k}
                    onClick={() => setHaritaOlcu(k)}
                    className={cx(stil.dugme7, haritaOlcu === k ? stil.dugme8 : stil.dugme9)}
                  >
                    {ad}
                  </button>
                ))}
              </span>
            </div>
            {(veri.satirlar as unknown[]).length ? (
              <div
                className={stil.kutu19}
                style={{
                  gridTemplateColumns: `110px repeat(${(veri.kategoriler as string[]).length}, minmax(0, 1fr))`,
                }}
              >
                <span />
                {(veri.kategoriler as string[]).map((k) => (
                  <span key={k} className={stil.metin24}>
                    {k}
                  </span>
                ))}
                {(
                  veri.satirlar as {
                    il: string;
                    hucre: {
                      kategori: string;
                      sayi: number;
                      bos: number | null;
                      sayiAdim: number;
                      bosAdim: number;
                      ipucu: string;
                    }[];
                  }[]
                ).flatMap((s) => [
                  <span key={s.il} className={stil.metin25}>
                    {s.il}
                  </span>,
                  ...s.hucre.map((h) => {
                    const adim = haritaOlcu === 'bos' ? h.bosAdim : h.sayiAdim;
                    return (
                      <span
                        key={`${s.il}${h.kategori}`}
                        title={h.ipucu}
                        className={cx(stil.metin26, adim >= 3 ? stil.metin27 : stil.metin28)}
                        style={{ background: adim < 0 ? '#F6F8FD' : HEAT_RAMP[adim] }}
                      >
                        {haritaOlcu === 'bos'
                          ? h.bos === null
                            ? '—'
                            : `%${Math.round(h.bos * 100)}`
                          : sayi(h.sayi)}
                      </span>
                    );
                  }),
                ])}
              </div>
            ) : (
              <p className={stil.metin29}>Bu süzgeçte talep yok.</p>
            )}
            <div className={stil.kutu20}>
              <span className={stil.metin30}>
                {haritaOlcu === 'bos'
                  ? 'Talebin 48 saatte mesaj almayan payı (koyu = arz açığı):'
                  : `${gecerli.donem.charAt(0).toLocaleUpperCase('tr-TR')}${gecerli.donem.slice(1)} açılan talep:`}
              </span>
              {(veri.lejant as Record<string, string[]>)[haritaOlcu]?.map((ad, i) => (
                <span key={ad} className={stil.metin31}>
                  <span className={stil.metin32} style={{ background: HEAT_RAMP[i] }} />
                  {ad}
                </span>
              ))}
            </div>
          </section>
          <section aria-labelledby="acik" className={stil.kutu21}>
            <h2 id="acik" className={stil.baslik3}>
              En büyük arz açıkları
            </h2>
            {(veri.aciklar as { yer: string; oran: string; not: string }[]).map((a) => (
              <div key={a.yer} className={stil.kutu22}>
                <span className={stil.metin33}>
                  <span>{a.yer}</span>
                  <span>{a.oran}</span>
                </span>
                <span className={stil.metin34}>{a.not}</span>
              </div>
            ))}
            <p className={stil.metin35}>
              <strong>Ajan:</strong> {gecerli.yorum}
            </p>
          </section>
        </div>
      ) : null}

      {gecerli && sekme === 'gelir' && veri ? (
        <>
          <div className={stil.kutu23}>
            {(veri.sayilar as { ad: string; deger: string; not: string }[]).map((s) =>
              kucukKart(s.ad, s.deger, s.not),
            )}
          </div>
          <div className={stil.kutu16}>
            <section aria-labelledby="kalem" className={stil.kutu24}>
              <h2 id="kalem" className={stil.baslik4}>
                Gelir kalemleri · {gecerli.donem}
              </h2>
              {(veri.kalemler as { ad: string; tutar: string; w: number; ipucu: string }[]).length ? null : (
                <p className={stil.metin29}>Bu dönemde ödeme yok.</p>
              )}
              {(veri.kalemler as { ad: string; tutar: string; w: number; ipucu: string }[]).map((k) => (
                <div key={k.ad} title={k.ipucu} className={stil.kutu25}>
                  <span className={stil.metin36}>{k.ad}</span>
                  <span className={stil.metin37}>
                    <span className={stil.metin38} style={{ width: `${k.w}%` }} />
                  </span>
                  <span className={stil.metin39}>{k.tutar}</span>
                </div>
              ))}
            </section>
            <section aria-labelledby="mrr" className={stil.kutu26}>
              <h2 id="mrr" className={stil.baslik5}>
                Aylık tekrarlayan gelir
              </h2>
              <p className={stil.metin40}>Galeri abonelikleri · KDV hariç · bu ay bugün itibarıyla</p>
              <div className={stil.kutu27}>
                {(() => {
                  const m = veri.mrr as { ay: string; kurus: number; tutar: string }[];
                  const mx = Math.max(1, ...m.map((x) => x.kurus));
                  return m.map((x, i) => (
                    <span key={x.ay} title={`${x.ay}: ${x.tutar}`} className={stil.metin41}>
                      <span className={stil.metin42}>
                        {x.kurus >= 100_000_00
                          ? `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(x.kurus / 100_000)} bin`
                          : x.tutar}
                      </span>
                      <span
                        className={cx(stil.metin43, i === m.length - 1 ? stil.metin44 : stil.metin45)}
                        style={{ height: `${(x.kurus / mx) * 85}%` }}
                      />
                    </span>
                  ));
                })()}
              </div>
              <div className={stil.kutu28}>
                {(veri.mrr as { ay: string }[]).map((x) => (
                  <span key={x.ay} className={stil.metin46}>
                    {x.ay}
                  </span>
                ))}
              </div>
              <p className={stil.metin47}>{veri.platformPayi}</p>
            </section>
          </div>
        </>
      ) : null}

      {gecerli && sekme === 'model' && veri ? (
        <section aria-labelledby="model" className={stil.kutu29}>
          <div className={stil.kutu30}>
            <h2 id="model" className={stil.baslik2}>
              En çok talep edilen modeller · {gecerli.donem}
            </h2>
            <p className={stil.metin48}>
              Uygun araç: aynı seriden, galeri portföylerinde yayında olan araç sayısı. {veri.aramaNotu}
            </p>
          </div>
          <div className={stil.kutu31}>
            <span>#</span>
            <span>Model</span>
            <span className={stil.metin49}>Talep</span>
            <span className={stil.metin49}>Arama</span>
            <span className={stil.metin49}>Uygun araç</span>
            <span>Durum</span>
          </div>
          {(veri.modeller as { sira: number }[]).length ? null : (
            <p className={stil.metin50}>Bu süzgeçte talep yok.</p>
          )}
          {(
            veri.modeller as {
              sira: number;
              ad: string;
              talep: number;
              arama: number | null;
              arac: number;
              durum: string;
              bg: string;
              fg: string;
            }[]
          ).map((m) => (
            <div key={m.sira} className={stil.kutu32}>
              <span className={stil.metin51}>{m.sira}</span>
              <span className={stil.metin52}>{m.ad}</span>
              <span className={stil.metin53}>{sayi(m.talep)}</span>
              <span className={stil.metin49}>{m.arama === null ? '—' : sayi(m.arama)}</span>
              <span className={stil.metin49}>{sayi(m.arac)}</span>
              <span>
                <span className={stil.metin8} style={{ background: m.bg, color: m.fg }}>
                  {m.durum}
                </span>
              </span>
            </div>
          ))}
          <p className={stil.metin35}>
            <strong>Ajan:</strong> {gecerli.yorum}
          </p>
        </section>
      ) : null}

      {gecerli && sekme === 'reklam' && veri ? (
        <>
          <div className={stil.kutu33}>
            {(veri.reklamSayilar as { ad: string; deger: string; not: string }[]).map((x) => (
              <div key={x.ad} className={stil.kutu1}>
                <div className={stil.kutu2}>{x.ad}</div>
                <div className={stil.kutu3}>{x.deger}</div>
                <div className={stil.kutu4}>{x.not}</div>
              </div>
            ))}
          </div>
          <section aria-labelledby="kampanya" className={stil.kutu29}>
            <div className={stil.kutu34}>
              <h2 id="kampanya" className={stil.baslik2}>
                Kanal ve kampanya
              </h2>
              <span className={stil.metin54}>{veri.cekimNotu}</span>
            </div>
            <div className={stil.kutu35}>
              <span>Kampanya</span>
              {['Harcama', 'Üyelik', 'Talep', 'Yeni galeri', 'Üye başı', 'Getiri'].map((k) => (
                <span key={k} className={stil.metin49}>
                  {k}
                </span>
              ))}
            </div>
            {(veri.kampanyalar as unknown[]).length ? null : (
              <p className={stil.metin50}>Bu dönemde yeni üye ve reklam harcaması yok.</p>
            )}
            {(
              veri.kampanyalar as {
                ad: string;
                kanal: string;
                harcama: string;
                uye: string;
                talep: string;
                galeri: string;
                uyeBasi: string;
                getiri: string;
              }[]
            ).map((k) => (
              <div key={`${k.kanal}|${k.ad}`} className={stil.kutu36}>
                <span className={stil.metin55}>
                  <span className={stil.metin56}>{k.ad}</span>
                  <span className={stil.metin57}>{k.kanal}</span>
                </span>
                <span className={stil.metin53}>{k.harcama}</span>
                <span className={stil.metin49}>{k.uye}</span>
                <span className={stil.metin49}>{k.talep}</span>
                <span className={stil.metin49}>{k.galeri}</span>
                <span className={stil.metin49}>{k.uyeBasi}</span>
                <span className={stil.metin58}>{k.getiri}</span>
              </div>
            ))}
            {gecerli.yorum ? (
              <p className={stil.metin35}>
                <strong>Ajan:</strong> {gecerli.yorum}
              </p>
            ) : null}
          </section>
          <p className={stil.metin59}>
            Getiri: kampanyadan gelen kullanıcıların 30 günlük ödemesi ÷ harcama. Üyeler ilk temaslarının
            kampanyasına bağlanır. Dönüşümler sunucu tarafından, ölçüme izin veren kullanıcılar için
            gönderilir (Karar 35).
          </p>
          <section aria-labelledby="kanal" className={stil.kutu37}>
            <div className={stil.kutu30}>
              <h2 id="kanal" className={stil.baslik2}>
                Kanal kırılımı · {gecerli.donem}
              </h2>
              <p className={stil.metin48}>
                Reklam: tıklama kimliği ya da ücretli UTM. Bildirim ve e-posta: kendi iletilerimiz. Organik:
                gerisi.
              </p>
            </div>
            <div className={stil.kutu38}>
              <span>Kanal</span>
              {['Üyelik', 'Talep', 'Yeni galeri', '30 günlük ödeme'].map((k) => (
                <span key={k} className={stil.metin49}>
                  {k}
                </span>
              ))}
            </div>
            {(
              veri.kanallar as {
                kanal: string;
                ad: string;
                uye: number;
                talep: number;
                galeri: number;
                odeme: string;
              }[]
            ).map((k) => (
              <div key={k.kanal} className={stil.kutu39}>
                <span className={stil.metin60}>{k.ad}</span>
                <span className={stil.metin49}>{sayi(k.uye)}</span>
                <span className={stil.metin49}>{sayi(k.talep)}</span>
                <span className={stil.metin49}>{sayi(k.galeri)}</span>
                <span className={stil.metin53}>{k.odeme}</span>
              </div>
            ))}
          </section>
        </>
      ) : null}

      {gecerli && sekme === 'birim' && veri ? (
        <>
          <div className={stil.kutu40}>
            {(veri.sayilar as { ad: string; deger: string; not: string }[]).map((s) =>
              kucukKart(s.ad, s.deger, s.not),
            )}
          </div>
          <section aria-labelledby="kohort" className={stil.kutu9}>
            <h2 id="kohort" className={stil.baslik5}>
              Ücretli galeri tutma · kohort
            </h2>
            <p className={stil.metin61}>
              Her satır o ay ücretliye geçen galeriler; hücreler sonraki aylarda hâlâ ödeyenlerin oranı.
            </p>
            <div className={stil.kutu41}>
              <span />
              {(veri.kohortBaslik as string[]).map((b) => (
                <span key={b} className={stil.metin62}>
                  {b}
                </span>
              ))}
              {(
                veri.kohort as {
                  ay: string;
                  adet: number;
                  hucre: { v: number | null; adim: number; ipucu: string }[];
                }[]
              ).flatMap((k) => [
                <span key={k.ay} className={stil.metin25}>
                  {k.ay}
                  <span className={stil.metin63}>{k.adet} galeri</span>
                </span>,
                ...k.hucre.map((h, i) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: ay sütunları sabit
                    key={`${k.ay}${i}`}
                    title={h.ipucu}
                    className={cx(stil.metin26, h.adim >= 3 ? stil.metin27 : stil.metin28)}
                    style={{ background: h.adim < 0 ? 'transparent' : HEAT_RAMP[h.adim] }}
                  >
                    {h.v === null ? '' : `%${h.v}`}
                  </span>
                )),
              ])}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
