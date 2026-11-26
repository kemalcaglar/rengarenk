'use client';

import {
  COLORS,
  type Damage,
  FUELS,
  GEARBOXES,
  PHOTO_MAX,
  PHOTO_MIN,
  type PortfolioVehicleInput,
  type PublicCategory,
  portfolioRules,
  portfolioVehicleSchema,
  type RuleResult,
} from '@rengarenk/shared';
import { useEffect, useRef, useState } from 'react';
import { type BoyaDegeri, BoyaSemasi } from '../../components/sihirbaz/boya';
import { useKatalog } from '../../components/sihirbaz/katalog';
import { cx } from '../../lib/cx';
import { API, dosyaYukle, istek } from '../../lib/istemci';
import stil from './arac-formu.module.css';

export interface AracDetay {
  id: string;
  no: number;
  ad: string;
  durum: string;
  durumAd: string;
  not: string | null;
  eids: { durum: string; not: string | null } | null;
  eidsGerekli: boolean;
  veri: PortfolioVehicleInput & { hasar: Damage };
  fotolar: { id: string; url: string }[];
  ekspertiz: { ad: string; tarih: string } | null;
  kurallar: RuleResult[];
}

const BOS_HASAR: Damage = {
  parcalar: {},
  tramer: 0,
  sasiIslem: false,
  podyeIslem: false,
  airbagAcildi: false,
  agirHasar: false,
};

function Alan({ id, ad, children }: { id: string; ad: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={stil.etiket1}>
        {ad}
      </label>
      {children}
    </div>
  );
}

/**
 * Araç ekle ve düzenle (GaleriPanel.dc.html › Araç ekle; Karar 07, 17). Katalog bilgileri, araç ve yasal bilgiler,
 * boya-değişen-hasar (talep şemasının aynısı), fotoğraflar ve ekspertiz. Tasarıma ek: ilk tescil tarihi ve vites
 * (6 ay / 6.000 km kontrolü ve eşleştirme), üretici fiyatı beyanı.
 */
export function AracFormu({
  accountId,
  id: ilkId,
  kategoriler,
  bitti,
}: {
  accountId: string;
  id: string | null;
  kategoriler: PublicCategory[];
  bitti: (mesaj: string) => void;
}) {
  const [id, setId] = useState(ilkId);
  const [d, setD] = useState<AracDetay | null>(null);
  const [v, setV] = useState<PortfolioVehicleInput & { hasar: Damage }>({
    kategori: 'otomobil',
    yil: new Date().getFullYear() - 3,
    km: 0,
    fiyat: 0,
    hasar: BOS_HASAR,
  });
  const [hata, setHata] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [raporTarihi, setRaporTarihi] = useState('');
  const fotoRef = useRef<HTMLInputElement>(null);
  const raporRef = useRef<HTMLInputElement>(null);
  const base = `/gallery/${accountId}/portfolio`;

  useEffect(() => {
    if (!ilkId) return;
    istek<AracDetay>(`${base}/${ilkId}`)
      .then((x) => {
        setD(x);
        setV(x.veri);
      })
      .catch((e: Error) => setHata(e.message));
  }, [ilkId, base]);

  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV((o) => ({ ...o, [k]: x }));
  const kat = kategoriler.find((c) => c.slug === v.kategori || c.children.some((x) => x.slug === v.kategori));
  const kok = kat?.slug ?? v.kategori;
  const katalogsuz = ['deniz', 'hava'].includes(kok);
  const k = useKatalog(
    katalogsuz ? undefined : kok,
    v.marka ? { make: v.marka, series: v.seri, model: v.model } : undefined,
  );
  const kurallar = (() => {
    const r = portfolioVehicleSchema.safeParse(v);
    return r.success
      ? portfolioRules(r.data, {
          rootSlug: kok,
          ekspertizTarihi: d?.ekspertiz ? new Date(d.ekspertiz.tarih) : null,
        })
      : (d?.kurallar ?? []);
  })();

  async function kaydet(): Promise<AracDetay | null> {
    const r = portfolioVehicleSchema.safeParse(v);
    if (!r.success) {
      setHata(r.error.issues[0]?.message ?? 'Bilgileri kontrol et');
      return null;
    }
    const x = id
      ? await istek<AracDetay>(`${base}/${id}`, { method: 'PUT', body: v })
      : await istek<AracDetay>(base, { method: 'POST', body: v });
    setId(x.id);
    setD(x);
    return x;
  }

  async function calis(ad: string, fn: () => Promise<unknown>) {
    setBusy(ad);
    setHata(null);
    try {
      await fn();
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const fotoYukle = (files: FileList) =>
    calis('foto', async () => {
      const x = id ? d : await kaydet();
      if (!x) return;
      let son = x;
      for (const f of Array.from(files)) son = await dosyaYukle<AracDetay>(`${base}/${x.id}/photos`, f);
      setD(son);
    });

  const boya: BoyaDegeri = { limit: 0, parts: v.hasar.parcalar };
  const yasal = d && !['DRAFT', 'REJECTED'].includes(d.durum);

  return (
    <>
      <h1 className={stil.baslik1}>{id ? (d?.ad ?? 'Araç') : 'Araç ekle'}</h1>
      <p className={stil.metin1}>
        {d && d.durum !== 'DRAFT'
          ? `${d.durumAd}${d.not ? ` · ${d.not}` : ''} · Portföy no ${d.no}`
          : d?.eidsGerekli === false || katalogsuz || kok === 'kiralik'
            ? 'Araç, kaydedilip gönderilince alıcılara görünür.'
            : 'Araç, kaydedildikten sonra EİDS doğrulamasına gönderilir; doğrulanınca alıcılara görünür ve eşleşmeye girer.'}
      </p>
      {hata ? (
        <p role="alert" className={stil.metin2}>
          {hata}
        </p>
      ) : null}
      <div className={stil.kutu1}>
        <section className={stil.kutu2} aria-labelledby="e1">
          <h2 id="e1" className={stil.baslik2}>
            Katalog bilgileri
          </h2>
          <div className="rr-dort-sutun">
            <Alan id="k-kat" ad="Kategori">
              <select
                id="k-kat"
                value={v.kategori}
                onChange={(e) =>
                  setV((o) => ({
                    ...o,
                    kategori: e.target.value,
                    marka: undefined,
                    seri: undefined,
                    model: undefined,
                    kasa: undefined,
                    paket: undefined,
                  }))
                }
                className={stil.girdi1}
              >
                {kategoriler.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Alan>
            {katalogsuz ? (
              <>
                <Alan id="k-marka" ad="Marka">
                  <input
                    id="k-marka"
                    value={v.markaAd ?? ''}
                    onChange={(e) => set('markaAd', e.target.value)}
                    className={stil.girdi1}
                  />
                </Alan>
                <Alan id="k-model" ad="Model">
                  <input
                    id="k-model"
                    value={v.modelAd ?? ''}
                    onChange={(e) => set('modelAd', e.target.value)}
                    className={stil.girdi1}
                  />
                </Alan>
              </>
            ) : (
              <>
                <Alan id="k-marka" ad="Marka">
                  <select
                    id="k-marka"
                    value={v.marka ?? ''}
                    onChange={(e) =>
                      setV((o) => ({
                        ...o,
                        marka: e.target.value || undefined,
                        seri: undefined,
                        model: undefined,
                        kasa: undefined,
                        paket: undefined,
                      }))
                    }
                    className={stil.girdi1}
                  >
                    <option value="">{k.hazir ? 'Marka seç' : 'Yükleniyor…'}</option>
                    {(k.makes ?? []).map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Alan>
                <Alan id="k-seri" ad="Seri">
                  <select
                    id="k-seri"
                    value={v.seri ?? ''}
                    disabled={!k.series?.length}
                    onChange={(e) =>
                      setV((o) => ({
                        ...o,
                        seri: e.target.value || undefined,
                        model: undefined,
                        kasa: undefined,
                        paket: undefined,
                      }))
                    }
                    className={stil.girdi1}
                  >
                    <option value="">Seri seç</option>
                    {(k.series ?? []).map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Alan>
              </>
            )}
            {katalogsuz ? null : (
              <Alan id="k-model" ad="Model">
                <select
                  id="k-model"
                  value={v.model ?? ''}
                  disabled={!k.models?.length}
                  onChange={(e) => set('model', e.target.value || undefined)}
                  className={stil.girdi1}
                >
                  <option value="">Model seç</option>
                  {(k.models ?? []).map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Alan>
            )}
            <Alan id="k-yil" ad="Model yılı">
              <input
                id="k-yil"
                inputMode="numeric"
                value={v.yil ? String(v.yil) : ''}
                onChange={(e) => set('yil', Number(e.target.value.replace(/\D/g, '')) || 0)}
                className={stil.girdi1}
              />
            </Alan>
            {katalogsuz ? null : (
              <>
                <Alan id="k-kasa" ad="Kasa ve makyaj">
                  <select
                    id="k-kasa"
                    value={v.kasa ?? ''}
                    disabled={!k.kusaklar.length}
                    onChange={(e) => set('kasa', e.target.value || undefined)}
                    className={stil.girdi1}
                  >
                    <option value="">Kasa seç</option>
                    {k.kusaklar
                      .filter((x) => !v.yil || (Number(v.yil) >= x.min && Number(v.yil) <= x.max))
                      .map((x) => (
                        <option key={x.value} value={x.value}>
                          {x.label} ({x.alt})
                        </option>
                      ))}
                  </select>
                </Alan>
                <Alan id="k-paket" ad="Donanım paketi">
                  <select
                    id="k-paket"
                    value={v.paket ?? ''}
                    disabled={!k.paketler.length}
                    onChange={(e) => set('paket', e.target.value || undefined)}
                    className={stil.girdi1}
                  >
                    <option value="">Paket seç</option>
                    {k.paketler.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Alan>
              </>
            )}
            <Alan id="k-yakit" ad="Yakıt">
              <select
                id="k-yakit"
                value={v.yakit ?? ''}
                onChange={(e) => set('yakit', e.target.value || undefined)}
                className={stil.girdi1}
              >
                <option value="">Seç</option>
                {FUELS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.ad}
                  </option>
                ))}
              </select>
            </Alan>
          </div>
          {katalogsuz ? null : (
            <p className={stil.metin3}>
              Model yılından kasa ve makyaj otomatik bulunur; paket listesi bu kasa için katalogdan gelir.
              Temsilî fotoğraf, açık lisanslı kaynaktan (Wikimedia Commons) atfıyla otomatik eklenir.
            </p>
          )}
        </section>

        <section className={stil.kutu2} aria-labelledby="e2">
          <h2 id="e2" className={stil.baslik2}>
            Araç ve yasal bilgiler
          </h2>
          <div className="rr-dort-sutun">
            <Alan id="y-km" ad="Kilometre">
              <input
                id="y-km"
                inputMode="numeric"
                value={v.km ? new Intl.NumberFormat('tr-TR').format(Number(v.km)) : ''}
                onChange={(e) => set('km', Number(e.target.value.replace(/\D/g, '')) || 0)}
                className={stil.girdi1}
              />
            </Alan>
            <Alan id="y-renk" ad="Renk">
              <select
                id="y-renk"
                value={v.renk ?? ''}
                onChange={(e) => set('renk', e.target.value || undefined)}
                className={stil.girdi1}
              >
                <option value="">Seç</option>
                {COLORS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.ad}
                  </option>
                ))}
              </select>
            </Alan>
            <Alan id="y-fiyat" ad={kok === 'kiralik' ? 'Günlük kira (TL)' : 'Satış fiyatı (TL)'}>
              <input
                id="y-fiyat"
                inputMode="numeric"
                value={v.fiyat ? new Intl.NumberFormat('tr-TR').format(Number(v.fiyat)) : ''}
                onChange={(e) => set('fiyat', Number(e.target.value.replace(/\D/g, '')) || 0)}
                className={stil.girdi1}
              />
            </Alan>
            <Alan id="y-vites" ad="Vites">
              <select
                id="y-vites"
                value={v.vites ?? ''}
                onChange={(e) => set('vites', e.target.value || undefined)}
                className={stil.girdi1}
              >
                <option value="">Seç</option>
                {GEARBOXES.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.ad}
                  </option>
                ))}
              </select>
            </Alan>
            <Alan id="y-plaka" ad="Plaka">
              <input
                id="y-plaka"
                placeholder="34 ABC 123"
                value={v.plaka ?? ''}
                onChange={(e) => set('plaka', e.target.value.toLocaleUpperCase('tr-TR'))}
                className={stil.girdi1}
              />
            </Alan>
            <Alan id="y-sasi" ad="Şasi no (son 6 hane)">
              <input
                id="y-sasi"
                maxLength={6}
                value={v.sasiSon6 ?? ''}
                onChange={(e) => set('sasiSon6', e.target.value.toUpperCase() || undefined)}
                className={stil.girdi1}
              />
            </Alan>
            <Alan id="y-tescil" ad="İlk tescil tarihi">
              <input
                id="y-tescil"
                type="date"
                value={v.ilkTescil ?? ''}
                onChange={(e) => set('ilkTescil', e.target.value || undefined)}
                className={stil.girdi1}
              />
            </Alan>
            <Alan id="y-rehin" ad="Rehin / haciz şerhi">
              <select
                id="y-rehin"
                value={v.rehin ? 'var' : 'yok'}
                onChange={(e) => set('rehin', e.target.value === 'var')}
                className={stil.girdi1}
              >
                <option value="yok">Yok</option>
                <option value="var">Var</option>
              </select>
            </Alan>
            <Alan id="y-garanti" ad="Kalan garanti">
              <input
                id="y-garanti"
                placeholder="Yok"
                value={v.garanti ?? ''}
                onChange={(e) => set('garanti', e.target.value || undefined)}
                className={stil.girdi1}
              />
            </Alan>
            <Alan id="y-takas" ad="Takas">
              <select
                id="y-takas"
                value={v.takas ? 'evet' : 'hayir'}
                onChange={(e) => set('takas', e.target.value === 'evet')}
                className={stil.girdi1}
              >
                <option value="evet">Kabul ediyor</option>
                <option value="hayir">Kabul etmiyor</option>
              </select>
            </Alan>
            <Alan id="y-uretici" ad="Üretici tavsiye fiyatı (TL, biliniyorsa)">
              <input
                id="y-uretici"
                inputMode="numeric"
                value={v.ureticiFiyati ? new Intl.NumberFormat('tr-TR').format(Number(v.ureticiFiyati)) : ''}
                onChange={(e) => set('ureticiFiyati', Number(e.target.value.replace(/\D/g, '')) || undefined)}
                className={stil.girdi1}
              />
            </Alan>
            <Alan id="y-stok" ad="Stok no (isteğe bağlı)">
              <input
                id="y-stok"
                value={v.disNo ?? ''}
                onChange={(e) => set('disNo', e.target.value || undefined)}
                className={stil.girdi1}
              />
            </Alan>
          </div>
          <label className={stil.etiket2}>
            <input
              type="checkbox"
              className="rr-isaret"
              checked={Boolean(v.fiyatBeyani)}
              onChange={(e) => set('fiyatBeyani', e.target.checked)}
            />
            <span>Satış fiyatı, aracın sıfır üretici tavsiye fiyatını aşmıyor.</span>
          </label>
          <div className={stil.kutu3}>
            {kurallar.map((r) => (
              <span
                key={r.key}
                className={stil.metin4}
                style={{
                  background: r.ok ? '#E7FAF0' : r.engel ? '#FDECEC' : '#FFF6DF',
                  color: r.ok ? '#11683F' : r.engel ? '#A3271F' : '#7A5300',
                }}
              >
                {r.metin}
              </span>
            ))}
          </div>
        </section>

        <section className={stil.kutu2} aria-labelledby="e3">
          <h2 id="e3" className={stil.baslik3}>
            Boya, değişen ve hasar
          </h2>
          <p className={stil.metin5}>
            Parça durumu, talep sayfasındaki şemanın aynısıyla parça parça girilir; alıcı kriterleriyle
            eşleştirme bu bilgiye göre yapılır.
          </p>
          <BoyaSemasi
            beyan
            value={boya}
            onChange={(b) => set('hasar', { ...v.hasar, parcalar: b.parts as Damage['parcalar'] })}
          />
          <div className={`rr-dort-sutun ${stil.kutu4}`}>
            <Alan id="h-tramer" ad="Tramer (TL)">
              <input
                id="h-tramer"
                inputMode="numeric"
                value={v.hasar.tramer ? new Intl.NumberFormat('tr-TR').format(v.hasar.tramer) : ''}
                onChange={(e) =>
                  set('hasar', { ...v.hasar, tramer: Number(e.target.value.replace(/\D/g, '')) || 0 })
                }
                className={stil.girdi1}
              />
            </Alan>
            {(
              [
                ['sasiIslem', 'Şasi işlemi'],
                ['podyeIslem', 'Podye işlemi'],
                ['airbagAcildi', 'Airbag'],
                ['agirHasar', 'Ağır hasar kaydı'],
              ] as const
            ).map(([key, ad]) => (
              <Alan key={key} id={`h-${key}`} ad={ad}>
                <select
                  id={`h-${key}`}
                  value={v.hasar[key] ? 'evet' : 'hayir'}
                  onChange={(e) => set('hasar', { ...v.hasar, [key]: e.target.value === 'evet' })}
                  className={stil.girdi1}
                >
                  <option value="hayir">{key === 'airbagAcildi' ? 'Açılmamış' : 'Yok'}</option>
                  <option value="evet">{key === 'airbagAcildi' ? 'Açılmış' : 'Var'}</option>
                </select>
              </Alan>
            ))}
          </div>
        </section>

        <section className={stil.kutu2} aria-labelledby="e4">
          <h2 id="e4" className={stil.baslik2}>
            Fotoğraflar ve ekspertiz
          </h2>
          <input
            ref={fotoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) fotoYukle(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={raporRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              calis('rapor', async () => {
                const x = id ? d : await kaydet();
                if (!x) return;
                setD(await dosyaYukle<AracDetay>(`${base}/${x.id}/report?tarih=${raporTarihi}`, f));
              });
            }}
          />
          <div className="rr-iki-sutun">
            <button
              type="button"
              disabled={busy === 'foto'}
              onClick={() => fotoRef.current?.click()}
              className={stil.dugme1}
            >
              {busy === 'foto' ? 'Yükleniyor…' : 'Fotoğraf yükle'}
              <span className={stil.metin6}>
                En az {PHOTO_MIN}, en fazla {PHOTO_MAX} fotoğraf · JPG veya PNG · şu an{' '}
                {d?.fotolar.length ?? 0}
              </span>
            </button>
            <div className={stil.kutu5}>
              <span className={stil.metin7}>
                {d?.ekspertiz ? `Ekspertiz: ${d.ekspertiz.ad}` : 'Ekspertiz raporu yükle'}
              </span>
              <span className={stil.metin8}>PDF · Son 10 gün içinde alınmış olmalı</span>
              <span className={stil.metin9}>
                <input
                  aria-label="Rapor tarihi"
                  type="date"
                  value={raporTarihi}
                  onChange={(e) => setRaporTarihi(e.target.value)}
                  className={stil.girdi2}
                />
                <button
                  type="button"
                  disabled={!raporTarihi || busy === 'rapor'}
                  onClick={() => raporRef.current?.click()}
                  className={stil.dugme2}
                >
                  PDF seç
                </button>
              </span>
            </div>
          </div>
          {/* GaleriMobil.dc.html'deki izin; web tasarımında yok, aynı biçimle eklendi */}
          <label className={stil.etiket3}>
            <input
              type="checkbox"
              className="rr-isaret"
              checked={Boolean(v.fotoKatalogIzni)}
              onChange={(e) => set('fotoKatalogIzni', e.target.checked)}
            />
            <span>
              Fotoğraflarım katalogda bu kasa ve paket için temsilî görsel olarak kullanılabilir (galeri
              adıyla gösterilir).
            </span>
          </label>
          {d?.fotolar.length ? (
            <div className={stil.kutu3}>
              {d.fotolar.map((f, i) => (
                <div key={f.id} className={stil.kutu6}>
                  {/* biome-ignore lint/performance/noImgElement: galeri fotoğrafı API'den akar */}
                  <img
                    src={`${API}${f.url}`}
                    alt={`Fotoğraf ${i + 1}`}
                    className={cx(stil.gorsel1, i === 0 ? stil.gorsel2 : stil.gorsel3)}
                  />
                  <span className={stil.metin10}>
                    {i === 0 ? (
                      <span className={stil.metin11}>Kapak</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          calis('sira', async () =>
                            setD(
                              await istek<AracDetay>(`${base}/${d.id}/photos`, {
                                method: 'PATCH',
                                body: {
                                  sira: [f.id, ...d.fotolar.filter((x) => x.id !== f.id).map((x) => x.id)],
                                },
                              }),
                            ),
                          )
                        }
                        className={stil.dugme3}
                      >
                        Kapak yap
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        calis('sil', async () =>
                          setD(
                            await istek<AracDetay>(`${base}/${d.id}/photos/${f.id}`, { method: 'DELETE' }),
                          ),
                        )
                      }
                      className={stil.dugme4}
                    >
                      Sil
                    </button>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <div className={stil.kutu7}>
          <button type="button" onClick={() => bitti('')} className={stil.dugme5}>
            Vazgeç
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              calis('kaydet', async () => {
                const x = await kaydet();
                if (x) bitti(yasal ? 'Araç güncellendi.' : 'Taslak kaydedildi.');
              })
            }
            className={stil.dugme5}
          >
            {yasal ? 'Kaydet' : 'Taslak kaydet'}
          </button>
          {!yasal ? (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() =>
                calis('gonder', async () => {
                  const x = await kaydet();
                  if (!x) return;
                  const s = await istek<AracDetay>(`${base}/${x.id}/submit`, { method: 'POST' });
                  bitti(
                    s.durum === 'PUBLISHED'
                      ? 'Araç yayında.'
                      : 'Araç EİDS doğrulamasına gönderildi; ruhsat sahibi onaylayınca yayına girer.',
                  );
                })
              }
              className={stil.dugme6}
            >
              {d?.eidsGerekli === false || katalogsuz || kok === 'kiralik'
                ? 'Kaydet ve yayınla'
                : "Kaydet ve EİDS'e gönder"}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
