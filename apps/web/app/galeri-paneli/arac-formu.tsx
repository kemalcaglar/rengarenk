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
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { type BoyaDegeri, BoyaSemasi } from '../../components/sihirbaz/boya';
import { useKatalog } from '../../components/sihirbaz/katalog';
import { API, dosyaYukle, istek } from '../../lib/istemci';

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

const girdi: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #D5DAE5',
  borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
  padding: '11px 12px',
  fontSize: 14.5,
  fontFamily: 'inherit',
  background: '#FFFFFF',
  color: 'var(--rr-murekkep, #1E2333)',
};
const etiket: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 };
const bolum: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid var(--rr-cizgi, #E3E6EF)',
  borderRadius: 'var(--rr-kart-kose)',
  padding: 20,
};
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
      <label htmlFor={id} style={etiket}>
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
      <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800 }}>
        {id ? (d?.ad ?? 'Araç') : 'Araç ekle'}
      </h1>
      <p style={{ margin: '0 0 18px', fontSize: 14.5, color: '#5A6073' }}>
        {d && d.durum !== 'DRAFT'
          ? `${d.durumAd}${d.not ? ` · ${d.not}` : ''} · Portföy no ${d.no}`
          : d?.eidsGerekli === false || katalogsuz || kok === 'kiralik'
            ? 'Araç, kaydedilip gönderilince alıcılara görünür.'
            : 'Araç, kaydedildikten sonra EİDS doğrulamasına gönderilir; doğrulanınca alıcılara görünür ve eşleşmeye girer.'}
      </p>
      {hata ? (
        <p
          role="alert"
          style={{
            margin: '0 0 14px',
            background: '#FFF0EE',
            border: '1px solid #F5C6C0',
            borderRadius: 'calc(var(--rr-buton-kose) - 2px)',
            padding: '10px 14px',
            fontSize: 14,
            color: '#A3271F',
          }}
        >
          {hata}
        </p>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section style={bolum} aria-labelledby="e1">
          <h2 id="e1" style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 800 }}>
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
                style={girdi}
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
                    style={girdi}
                  />
                </Alan>
                <Alan id="k-model" ad="Model">
                  <input
                    id="k-model"
                    value={v.modelAd ?? ''}
                    onChange={(e) => set('modelAd', e.target.value)}
                    style={girdi}
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
                    style={girdi}
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
                    style={girdi}
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
                  style={girdi}
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
                style={girdi}
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
                    style={girdi}
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
                    style={girdi}
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
                style={girdi}
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
            <p
              style={{
                margin: '10px 0 0',
                fontSize: 13,
                color: 'var(--rr-baglanti, #2450C8)',
                fontWeight: 600,
              }}
            >
              Model yılından kasa ve makyaj otomatik bulunur; paket listesi bu kasa için katalogdan gelir.
              Temsilî fotoğraf, açık lisanslı kaynaktan (Wikimedia Commons) atfıyla otomatik eklenir.
            </p>
          )}
        </section>

        <section style={bolum} aria-labelledby="e2">
          <h2 id="e2" style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 800 }}>
            Araç ve yasal bilgiler
          </h2>
          <div className="rr-dort-sutun">
            <Alan id="y-km" ad="Kilometre">
              <input
                id="y-km"
                inputMode="numeric"
                value={v.km ? new Intl.NumberFormat('tr-TR').format(Number(v.km)) : ''}
                onChange={(e) => set('km', Number(e.target.value.replace(/\D/g, '')) || 0)}
                style={girdi}
              />
            </Alan>
            <Alan id="y-renk" ad="Renk">
              <select
                id="y-renk"
                value={v.renk ?? ''}
                onChange={(e) => set('renk', e.target.value || undefined)}
                style={girdi}
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
                style={girdi}
              />
            </Alan>
            <Alan id="y-vites" ad="Vites">
              <select
                id="y-vites"
                value={v.vites ?? ''}
                onChange={(e) => set('vites', e.target.value || undefined)}
                style={girdi}
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
                style={girdi}
              />
            </Alan>
            <Alan id="y-sasi" ad="Şasi no (son 6 hane)">
              <input
                id="y-sasi"
                maxLength={6}
                value={v.sasiSon6 ?? ''}
                onChange={(e) => set('sasiSon6', e.target.value.toUpperCase() || undefined)}
                style={girdi}
              />
            </Alan>
            <Alan id="y-tescil" ad="İlk tescil tarihi">
              <input
                id="y-tescil"
                type="date"
                value={v.ilkTescil ?? ''}
                onChange={(e) => set('ilkTescil', e.target.value || undefined)}
                style={girdi}
              />
            </Alan>
            <Alan id="y-rehin" ad="Rehin / haciz şerhi">
              <select
                id="y-rehin"
                value={v.rehin ? 'var' : 'yok'}
                onChange={(e) => set('rehin', e.target.value === 'var')}
                style={girdi}
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
                style={girdi}
              />
            </Alan>
            <Alan id="y-takas" ad="Takas">
              <select
                id="y-takas"
                value={v.takas ? 'evet' : 'hayir'}
                onChange={(e) => set('takas', e.target.value === 'evet')}
                style={girdi}
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
                style={girdi}
              />
            </Alan>
            <Alan id="y-stok" ad="Stok no (isteğe bağlı)">
              <input
                id="y-stok"
                value={v.disNo ?? ''}
                onChange={(e) => set('disNo', e.target.value || undefined)}
                style={girdi}
              />
            </Alan>
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14, fontSize: 14 }}>
            <input
              type="checkbox"
              className="rr-isaret"
              checked={Boolean(v.fiyatBeyani)}
              onChange={(e) => set('fiyatBeyani', e.target.checked)}
            />
            <span>Satış fiyatı, aracın sıfır üretici tavsiye fiyatını aşmıyor.</span>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {kurallar.map((r) => (
              <span
                key={r.key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: r.ok ? '#E7FAF0' : r.engel ? '#FDECEC' : '#FFF6DF',
                  color: r.ok ? '#11683F' : r.engel ? '#A3271F' : '#7A5300',
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '6px 12px',
                  borderRadius: 'var(--rr-etiket-kose)',
                }}
              >
                {r.metin}
              </span>
            ))}
          </div>
        </section>

        <section style={bolum} aria-labelledby="e3">
          <h2 id="e3" style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>
            Boya, değişen ve hasar
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#5A6073' }}>
            Parça durumu, talep sayfasındaki şemanın aynısıyla parça parça girilir; alıcı kriterleriyle
            eşleştirme bu bilgiye göre yapılır.
          </p>
          <BoyaSemasi
            beyan
            value={boya}
            onChange={(b) => set('hasar', { ...v.hasar, parcalar: b.parts as Damage['parcalar'] })}
          />
          <div className="rr-dort-sutun" style={{ marginTop: 14 }}>
            <Alan id="h-tramer" ad="Tramer (TL)">
              <input
                id="h-tramer"
                inputMode="numeric"
                value={v.hasar.tramer ? new Intl.NumberFormat('tr-TR').format(v.hasar.tramer) : ''}
                onChange={(e) =>
                  set('hasar', { ...v.hasar, tramer: Number(e.target.value.replace(/\D/g, '')) || 0 })
                }
                style={girdi}
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
                  style={girdi}
                >
                  <option value="hayir">{key === 'airbagAcildi' ? 'Açılmamış' : 'Yok'}</option>
                  <option value="evet">{key === 'airbagAcildi' ? 'Açılmış' : 'Var'}</option>
                </select>
              </Alan>
            ))}
          </div>
        </section>

        <section style={bolum} aria-labelledby="e4">
          <h2 id="e4" style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 800 }}>
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
              style={{
                border: '2px dashed #AEB5C4',
                background: 'var(--rr-zemin, #F6F8FD)',
                borderRadius: 16,
                padding: 26,
                cursor: 'pointer',
                fontSize: 14.5,
                fontWeight: 700,
                color: 'var(--rr-murekkep, #1E2333)',
                fontFamily: 'inherit',
              }}
            >
              {busy === 'foto' ? 'Yükleniyor…' : 'Fotoğraf yükle'}
              <span
                style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: '#5A6073', marginTop: 4 }}
              >
                En az {PHOTO_MIN}, en fazla {PHOTO_MAX} fotoğraf · JPG veya PNG · şu an{' '}
                {d?.fotolar.length ?? 0}
              </span>
            </button>
            <div
              style={{
                border: '2px dashed #AEB5C4',
                background: 'var(--rr-zemin, #F6F8FD)',
                borderRadius: 16,
                padding: 18,
                textAlign: 'center',
              }}
            >
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>
                {d?.ekspertiz ? `Ekspertiz: ${d.ekspertiz.ad}` : 'Ekspertiz raporu yükle'}
              </span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 4 }}>
                PDF · Son 10 gün içinde alınmış olmalı
              </span>
              <span
                style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}
              >
                <input
                  aria-label="Rapor tarihi"
                  type="date"
                  value={raporTarihi}
                  onChange={(e) => setRaporTarihi(e.target.value)}
                  style={{ ...girdi, width: 'auto', padding: '8px 10px' }}
                />
                <button
                  type="button"
                  disabled={!raporTarihi || busy === 'rapor'}
                  onClick={() => raporRef.current?.click()}
                  style={{
                    border: '1px solid #D5DAE5',
                    background: '#FFFFFF',
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  PDF seç
                </button>
              </span>
            </div>
          </div>
          {/* GaleriMobil.dc.html'deki izin; web tasarımında yok, aynı biçimle eklendi */}
          <label
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              marginTop: 12,
              fontSize: 13.5,
              color: '#3A4052',
            }}
          >
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {d.fotolar.map((f, i) => (
                <div key={f.id} style={{ position: 'relative', width: 120 }}>
                  {/* biome-ignore lint/performance/noImgElement: galeri fotoğrafı API'den akar */}
                  <img
                    src={`${API}${f.url}`}
                    alt={`Fotoğraf ${i + 1}`}
                    style={{
                      width: 120,
                      height: 90,
                      objectFit: 'cover',
                      borderRadius: 10,
                      display: 'block',
                      border:
                        i === 0 ? '2px solid var(--rr-mavi, #5B8CFF)' : '1px solid var(--rr-cizgi, #E3E6EF)',
                    }}
                  />
                  <span
                    style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12 }}
                  >
                    {i === 0 ? (
                      <span style={{ fontWeight: 800, color: 'var(--rr-baglanti, #2450C8)' }}>Kapak</span>
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
                        style={{
                          border: 0,
                          background: 'transparent',
                          padding: 0,
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--rr-baglanti, #2450C8)',
                          cursor: 'pointer',
                        }}
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
                      style={{
                        border: 0,
                        background: 'transparent',
                        padding: 0,
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#A3271F',
                        cursor: 'pointer',
                      }}
                    >
                      Sil
                    </button>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={() => bitti('')}
            style={{
              border: '1px solid #D5DAE5',
              background: '#FFFFFF',
              borderRadius: 'var(--rr-buton-kose)',
              padding: '13px 20px',
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--rr-murekkep, #1E2333)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
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
            style={{
              border: '1px solid #D5DAE5',
              background: '#FFFFFF',
              borderRadius: 'var(--rr-buton-kose)',
              padding: '13px 20px',
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--rr-murekkep, #1E2333)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
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
              style={{
                border: 0,
                background: 'var(--rr-mavi, #5B8CFF)',
                borderRadius: 'var(--rr-buton-kose)',
                padding: '14px 24px',
                fontSize: 15,
                fontWeight: 800,
                color: 'var(--rr-murekkep, #1E2333)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
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
