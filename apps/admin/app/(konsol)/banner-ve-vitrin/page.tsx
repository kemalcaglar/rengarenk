'use client';

import {
  BANNER_AUDIENCES,
  BANNER_COLORS,
  BANNER_PLACES,
  BANNER_PLATFORMS,
  type BannerAudience,
  type BannerPlace,
  type BannerPlatform,
  ILLER,
} from '@rengarenk/shared';
import { type CSSProperties, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import { Switch } from '../switch';

interface Icerik {
  baslik: string;
  metin: string;
  dugme: string;
  url: string;
  yer: BannerPlace;
  kitle: BannerAudience;
  il: string | null;
  platform: BannerPlatform;
  renk: string;
  baslangic: string | null;
  bitis: string | null;
}
interface Banner {
  id: string;
  ad: string;
  yer: string;
  kitle: string;
  platform: string;
  tarih: string;
  sonuc: string;
  durumKey: 'taslak' | 'zamanlandi' | 'yayinda' | 'bitti' | 'durduruldu';
  durum: string;
  bg: string;
  fg: string;
  renk: string;
  zemin: string;
  icerik: Icerik;
}
interface Veri {
  bannerlar: Banner[];
  vitrin: { yer: number; ucretli: number; editor: boolean; not: string };
}

const BOS: Icerik = {
  baslik: '',
  metin: '',
  dugme: '',
  url: '',
  yer: 'anasayfa_ust',
  kitle: 'herkes',
  il: null,
  platform: 'hepsi',
  renk: '#5B8CFF',
  baslangic: null,
  bitis: null,
};

const etiket: CSSProperties = { fontSize: 13, fontWeight: 700 };
const alan: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 5,
  border: '1px solid #D5DAE5',
  borderRadius: 10,
  padding: 10,
  fontSize: 14,
  background: '#FFFFFF',
  fontFamily: 'inherit',
};
const kutu: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E3E6EF',
  borderRadius: 18,
  overflow: 'hidden',
};
const kucuk: CSSProperties = {
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 10,
  padding: '6px 12px',
  fontSize: 13,
  fontWeight: 700,
  color: '#1E2333',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

/** Tarih kutusu (gün) ↔ Türkiye saatiyle gün başı; bitiş günü dahil (ertesi gün 00.00'a kadar) */
const gunYaz = (iso: string | null, bitis = false) => {
  if (!iso) return '';
  const t = new Date(new Date(iso).getTime() + 3 * 3_600_000 - (bitis ? 86_400_000 : 0));
  return t.toISOString().slice(0, 10);
};
const gunOku = (g: string, bitis = false) => {
  if (!g) return null;
  const t = new Date(`${g}T00:00:00+03:00`);
  return new Date(t.getTime() + (bitis ? 86_400_000 : 0)).toISOString();
};

/**
 * Görünüm › Banner, duyuru ve vitrin (YonetimIcerik.dc.html › banner; Karar 46). Taslak hazırlanır, tarih aralığıyla
 * yayınlanır; bitişte kendiliğinden kalkar. Gösterim ve tıklama günlük toplam (kişisel veri yok). A/B testi deney
 * altyapısıyla gelecek. Vitrinde ücretli talepler önce; boş yerlere editör seçimi açılıp kapatılır.
 */
export default function BannerVeVitrin() {
  const { me } = useKonsol();
  const tam = me.permissions['gorunum.duzenle'] === 'tam';
  const [v, setV] = useState<Veri | null>(null);
  const [form, setForm] = useState<Icerik | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  useEffect(() => {
    yonetim<Veri>('banners')
      .then(setV)
      .catch((e: Error) => setHata(e.message));
  }, []);

  async function islem(yol: string, method: 'POST' | 'PUT' | 'DELETE', body?: object, mesaj?: string) {
    setHata(null);
    setBilgi(null);
    try {
      setV(await yonetim<Veri>(yol, { method, ...(body ? { body } : {}) }));
      if (mesaj) setBilgi(mesaj);
      return true;
    } catch (e) {
      setHata((e as Error).message);
      return false;
    }
  }

  async function kaydet() {
    if (!form) return;
    const ok = await islem(
      duzenlenen ? `banners/${duzenlenen}` : 'banners',
      duzenlenen ? 'PUT' : 'POST',
      form,
      'Taslak kaydedildi. Yayınlamak için tarih seç ve “Yayınla”ya bas.',
    );
    if (ok) {
      setForm(null);
      setDuzenlenen(null);
    }
  }

  const f = form;
  const kurumsal = f && (f.kitle === 'bireysel' || f.kitle === 'galeri');

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
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Banner, duyuru ve vitrin</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
            Yer, kitle, platform ve tarih seç; bitiş tarihinde kendiliğinden kalkar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(form && !duzenlenen ? null : { ...BOS });
            setDuzenlenen(null);
          }}
          aria-expanded={Boolean(form)}
          style={{
            border: 0,
            background: '#5B8CFF',
            borderRadius: 12,
            padding: '12px 18px',
            fontSize: 14.5,
            fontWeight: 800,
            color: '#1E2333',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Yeni banner veya duyuru
        </button>
      </div>
      {hata ? (
        <p className="k-error" role="alert">
          {hata}
        </p>
      ) : null}
      {bilgi ? (
        <p
          role="status"
          style={{
            background: '#E7FAF0',
            color: '#11683F',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {bilgi}
        </p>
      ) : null}

      {f ? (
        <section
          aria-label={duzenlenen ? 'Bannerı düzenle' : 'Yeni banner'}
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #5B8CFF',
            borderRadius: 18,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
            <label style={{ ...etiket, flex: '2 1 240px' }}>
              Başlık
              <input
                value={f.baslik}
                maxLength={80}
                onChange={(e) => setForm({ ...f, baslik: e.target.value })}
                style={alan}
              />
            </label>
            <label style={{ ...etiket, flex: '1 1 160px' }}>
              Yer
              <select
                value={f.yer}
                onChange={(e) => setForm({ ...f, yer: e.target.value as BannerPlace })}
                style={alan}
              >
                {(Object.keys(BANNER_PLACES) as BannerPlace[]).map((k) => (
                  <option key={k} value={k}>
                    {BANNER_PLACES[k].ad}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ ...etiket, flex: '1 1 160px' }}>
              Kitle
              <select
                value={f.kitle}
                onChange={(e) => {
                  const kitle = e.target.value as BannerAudience;
                  setForm({ ...f, kitle, il: kitle === 'bireysel' || kitle === 'galeri' ? f.il : null });
                }}
                style={alan}
              >
                {(Object.keys(BANNER_AUDIENCES) as BannerAudience[]).map((k) => (
                  <option key={k} value={k}>
                    {BANNER_AUDIENCES[k]}
                  </option>
                ))}
              </select>
            </label>
            {kurumsal ? (
              <label style={{ ...etiket, flex: '1 1 140px' }}>
                İl
                <select
                  value={f.il ?? ''}
                  onChange={(e) => setForm({ ...f, il: e.target.value || null })}
                  style={alan}
                >
                  <option value="">Bütün iller</option>
                  {ILLER.map((i) => (
                    <option key={i.ad} value={i.ad}>
                      {i.ad}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label style={{ ...etiket, flex: '1 1 140px' }}>
              Başlangıç
              <input
                type="date"
                value={gunYaz(f.baslangic)}
                onChange={(e) =>
                  setForm({
                    ...f,
                    baslangic: gunOku(e.target.value),
                    bitis: e.target.value ? f.bitis : null,
                  })
                }
                style={alan}
              />
            </label>
            <label style={{ ...etiket, flex: '1 1 140px' }}>
              Bitiş (dahil)
              <input
                type="date"
                value={gunYaz(f.bitis, true)}
                onChange={(e) => setForm({ ...f, bitis: gunOku(e.target.value, true) })}
                style={alan}
              />
            </label>
            <label
              title="A/B testi deney altyapısı kurulunca açılacak"
              style={{
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13.5,
                fontWeight: 700,
                paddingBottom: 10,
                color: '#9AA0B0',
              }}
            >
              <input type="checkbox" disabled style={{ width: 18, height: 18 }} />
              A/B testi
            </label>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12, marginTop: 12 }}>
            <label style={{ ...etiket, flex: '3 1 300px' }}>
              Metin
              <input
                value={f.metin}
                maxLength={160}
                onChange={(e) => setForm({ ...f, metin: e.target.value })}
                style={alan}
              />
            </label>
            <label style={{ ...etiket, flex: '1 1 140px' }}>
              Düğme
              <input
                value={f.dugme}
                maxLength={30}
                onChange={(e) => setForm({ ...f, dugme: e.target.value })}
                style={alan}
              />
            </label>
            <label style={{ ...etiket, flex: '1 1 180px' }}>
              Bağlantı
              <input
                value={f.url}
                placeholder="/kurumsal-basvuru"
                onChange={(e) => setForm({ ...f, url: e.target.value })}
                style={alan}
              />
            </label>
            <label style={{ ...etiket, flex: '1 1 140px' }}>
              Platform
              <select
                value={f.platform}
                onChange={(e) => setForm({ ...f, platform: e.target.value as BannerPlatform })}
                style={alan}
              >
                {(Object.keys(BANNER_PLATFORMS) as BannerPlatform[]).map((k) => (
                  <option key={k} value={k}>
                    {BANNER_PLATFORMS[k]}
                  </option>
                ))}
              </select>
            </label>
            <fieldset style={{ flex: 'none', border: 0, padding: 0, margin: 0 }}>
              <legend style={{ ...etiket, padding: 0 }}>Renk</legend>
              <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                {BANNER_COLORS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-label={`Renk ${r}`}
                    aria-pressed={f.renk === r}
                    onClick={() => setForm({ ...f, renk: r })}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: r,
                      border: f.renk === r ? '3px solid #1E2333' : '3px solid #FFFFFF',
                      boxShadow: '0 0 0 1px #D5DAE5',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              onClick={kaydet}
              style={{
                border: 0,
                background: '#5B8CFF',
                borderRadius: 12,
                padding: '11px 18px',
                fontSize: 14,
                fontWeight: 800,
                color: '#1E2333',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Taslak olarak kaydet
            </button>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="bnr" style={kutu}>
        <h2
          id="bnr"
          style={{
            margin: 0,
            padding: '16px 18px',
            fontSize: 17,
            fontWeight: 800,
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          Bannerlar ve duyurular
        </h2>
        {v === null ? (
          <p className="k-empty">Yükleniyor…</p>
        ) : v.bannerlar.length === 0 ? (
          <p style={{ margin: 0, padding: '14px 18px', fontSize: 13.5, color: '#5A6073' }}>
            Henüz banner yok. “Yeni banner veya duyuru” ile ilk taslağı hazırla.
          </p>
        ) : (
          v.bannerlar.map((b) => (
            <div
              key={b.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '8px 16px',
                padding: '13px 18px',
                borderBottom: '1px solid #EEF0F5',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  flex: 'none',
                  width: 54,
                  height: 36,
                  borderRadius: 8,
                  background: b.zemin,
                  borderLeft: `4px solid ${b.renk}`,
                }}
              />
              <span style={{ flex: '999 1 260px', minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800 }}>{b.ad}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#3A4052', marginTop: 2 }}>
                  {b.yer} · {b.kitle} · {b.platform}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 2 }}>
                  {b.tarih}
                </span>
              </span>
              <span style={{ flex: '1 1 200px', minWidth: 0, fontSize: 12.5, color: '#3A4052' }}>
                {b.sonuc}
              </span>
              <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                {b.durumKey === 'taslak' ? (
                  <>
                    <button
                      type="button"
                      style={kucuk}
                      onClick={() => {
                        setForm({ ...b.icerik });
                        setDuzenlenen(b.id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Düzenle
                    </button>
                    {tam ? (
                      <button
                        type="button"
                        style={{ ...kucuk, border: 0, background: '#3DD68C', fontWeight: 800 }}
                        onClick={() =>
                          islem(
                            `banners/${b.id}/publish`,
                            'POST',
                            undefined,
                            'Banner yayınlandı; tarih aralığında gösterilir.',
                          )
                        }
                      >
                        Yayınla
                      </button>
                    ) : null}
                    <button
                      type="button"
                      style={{ ...kucuk, color: '#A3271F' }}
                      onClick={() => islem(`banners/${b.id}`, 'DELETE')}
                    >
                      Sil
                    </button>
                  </>
                ) : b.durumKey === 'yayinda' || b.durumKey === 'zamanlandi' ? (
                  tam ? (
                    <button
                      type="button"
                      style={kucuk}
                      onClick={() => islem(`banners/${b.id}/stop`, 'POST', undefined, 'Banner durduruldu.')}
                    >
                      Durdur
                    </button>
                  ) : null
                ) : (
                  <button
                    type="button"
                    style={kucuk}
                    onClick={() =>
                      islem(`banners/${b.id}/copy`, 'POST', undefined, 'Kopyası taslak olarak açıldı.')
                    }
                  >
                    Kopyala
                  </button>
                )}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: b.bg,
                    color: b.fg,
                  }}
                >
                  {b.durum}
                </span>
              </span>
            </div>
          ))
        )}
      </section>

      {v ? (
        <section aria-labelledby="vitrin" style={{ ...kutu, marginTop: 14 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '16px 18px',
              borderBottom: '1px solid #EEF0F5',
            }}
          >
            <div>
              <h2 id="vitrin" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                Ana sayfa vitrini
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#5A6073' }}>{v.vitrin.not}</p>
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700 }}>
              <Switch
                on={v.vitrin.editor}
                label="Boş yerlere editör seçimi koy"
                disabled={!tam}
                onChange={() => islem('banners/vitrin/editor', 'PUT', { acik: !v.vitrin.editor })}
              />
              Boş yerlere editör seçimi koy
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
              gap: 6,
              padding: '16px 18px',
            }}
          >
            {Array.from({ length: v.vitrin.yer }, (_, i) => {
              const ucretli = i < v.vitrin.ucretli;
              const editor = !ucretli && v.vitrin.editor;
              return (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: yer sırası sabit
                  key={i}
                  title={
                    ucretli
                      ? `Ücretli vitrin ${i + 1}`
                      : editor
                        ? 'Editör seçimi: fotoğraflı, yayındaki talepler karışık sırayla'
                        : 'Boş yer'
                  }
                  style={{
                    height: 34,
                    borderRadius: 8,
                    background: ucretli ? '#5B8CFF' : editor ? '#F3EFFF' : '#FFFFFF',
                    border: `1px ${ucretli || editor ? 'solid' : 'dashed'} ${
                      ucretli ? '#5B8CFF' : editor ? '#C9B8FF' : '#AEB5C4'
                    }`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 800,
                    color: ucretli ? '#1E2333' : '#4B2FA6',
                  }}
                >
                  {ucretli ? i + 1 : editor ? 'E' : ''}
                </span>
              );
            })}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px 16px',
              padding: '0 18px 14px',
              fontSize: 12.5,
              color: '#3A4052',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: '#5B8CFF' }} />
              Ücretli vitrin
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: '#F3EFFF',
                  border: '1px solid #C9B8FF',
                }}
              />
              Editör seçimi
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, border: '1px dashed #AEB5C4' }} />
              Boş
            </span>
          </div>
        </section>
      ) : null}
    </>
  );
}
