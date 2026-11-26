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
import { useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import { Switch } from '../switch';
import stil from './page.module.css';

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
  b: Varyant | null;
}
interface Varyant {
  baslik: string;
  metin: string;
  dugme: string;
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
  b: null,
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
 * yayınlanır; bitişte kendiliğinden kalkar. Gösterim ve tıklama günlük toplam (kişisel veri yok). A/B testinde ikinci
 * sürüm yazılır; kazanan Raporlar › Deneyler'den herkese açılır. Vitrinde ücretli talepler önce; boş yerlere editör seçimi açılıp kapatılır.
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
      <div className={stil.kutu1}>
        <div>
          <h1 className={stil.baslik1}>Banner, duyuru ve vitrin</h1>
          <p className={stil.metin1}>
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
          className={stil.dugme1}
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
        <p role="status" className={stil.metin2}>
          {bilgi}
        </p>
      ) : null}

      {f ? (
        <section aria-label={duzenlenen ? 'Bannerı düzenle' : 'Yeni banner'} className={stil.kutu2}>
          <div className={stil.kutu3}>
            <label className={stil.etiket1}>
              Başlık
              <input
                value={f.baslik}
                maxLength={80}
                onChange={(e) => setForm({ ...f, baslik: e.target.value })}
                className={stil.girdi1}
              />
            </label>
            <label className={stil.etiket2}>
              Yer
              <select
                value={f.yer}
                onChange={(e) => setForm({ ...f, yer: e.target.value as BannerPlace })}
                className={stil.girdi1}
              >
                {(Object.keys(BANNER_PLACES) as BannerPlace[]).map((k) => (
                  <option key={k} value={k}>
                    {BANNER_PLACES[k].ad}
                  </option>
                ))}
              </select>
            </label>
            <label className={stil.etiket2}>
              Kitle
              <select
                value={f.kitle}
                onChange={(e) => {
                  const kitle = e.target.value as BannerAudience;
                  setForm({ ...f, kitle, il: kitle === 'bireysel' || kitle === 'galeri' ? f.il : null });
                }}
                className={stil.girdi1}
              >
                {(Object.keys(BANNER_AUDIENCES) as BannerAudience[]).map((k) => (
                  <option key={k} value={k}>
                    {BANNER_AUDIENCES[k]}
                  </option>
                ))}
              </select>
            </label>
            {kurumsal ? (
              <label className={stil.etiket3}>
                İl
                <select
                  value={f.il ?? ''}
                  onChange={(e) => setForm({ ...f, il: e.target.value || null })}
                  className={stil.girdi1}
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
            <label className={stil.etiket3}>
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
                className={stil.girdi1}
              />
            </label>
            <label className={stil.etiket3}>
              Bitiş (dahil)
              <input
                type="date"
                value={gunYaz(f.bitis, true)}
                onChange={(e) => setForm({ ...f, bitis: gunOku(e.target.value, true) })}
                className={stil.girdi1}
              />
            </label>
            <label className={stil.etiket4}>
              <input
                type="checkbox"
                checked={Boolean(f.b)}
                onChange={(e) =>
                  setForm({
                    ...f,
                    b: e.target.checked ? { baslik: f.baslik, metin: f.metin, dugme: f.dugme } : null,
                  })
                }
                className={stil.girdi2}
              />
              A/B testi
            </label>
          </div>
          {f.b ? (
            <div className={stil.kutu4}>
              <label className={stil.etiket1}>
                B · Başlık
                <input
                  value={f.b.baslik}
                  maxLength={80}
                  onChange={(e) => setForm({ ...f, b: { ...(f.b as Varyant), baslik: e.target.value } })}
                  className={stil.girdi1}
                />
              </label>
              <label className={stil.etiket5}>
                B · Metin
                <input
                  value={f.b.metin}
                  maxLength={160}
                  onChange={(e) => setForm({ ...f, b: { ...(f.b as Varyant), metin: e.target.value } })}
                  className={stil.girdi1}
                />
              </label>
              <label className={stil.etiket3}>
                B · Düğme
                <input
                  value={f.b.dugme}
                  maxLength={30}
                  onChange={(e) => setForm({ ...f, b: { ...(f.b as Varyant), dugme: e.target.value } })}
                  className={stil.girdi1}
                />
              </label>
              <p className={stil.metin3}>
                Görenler yarı yarıya ayrılır; ölçü tıklama oranı. Kazanan Raporlar › Deneyler’den herkese
                açılır.
              </p>
            </div>
          ) : null}
          <div className={stil.kutu5}>
            <label className={stil.etiket5}>
              Metin
              <input
                value={f.metin}
                maxLength={160}
                onChange={(e) => setForm({ ...f, metin: e.target.value })}
                className={stil.girdi1}
              />
            </label>
            <label className={stil.etiket3}>
              Düğme
              <input
                value={f.dugme}
                maxLength={30}
                onChange={(e) => setForm({ ...f, dugme: e.target.value })}
                className={stil.girdi1}
              />
            </label>
            <label className={stil.etiket6}>
              Bağlantı
              <input
                value={f.url}
                placeholder="/kurumsal-basvuru"
                onChange={(e) => setForm({ ...f, url: e.target.value })}
                className={stil.girdi1}
              />
            </label>
            <label className={stil.etiket3}>
              Platform
              <select
                value={f.platform}
                onChange={(e) => setForm({ ...f, platform: e.target.value as BannerPlatform })}
                className={stil.girdi1}
              >
                {(Object.keys(BANNER_PLATFORMS) as BannerPlatform[]).map((k) => (
                  <option key={k} value={k}>
                    {BANNER_PLATFORMS[k]}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className={stil.kutu6}>
              <legend className={stil.baslik2}>Renk</legend>
              <div className={stil.kutu7}>
                {BANNER_COLORS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-label={`Renk ${r}`}
                    aria-pressed={f.renk === r}
                    onClick={() => setForm({ ...f, renk: r })}
                    className={cx(stil.dugme2, f.renk === r ? stil.dugme3 : stil.dugme4)}
                    style={{ background: r }}
                  />
                ))}
              </div>
            </fieldset>
            <button type="button" onClick={kaydet} className={stil.dugme5}>
              Taslak olarak kaydet
            </button>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="bnr" className={stil.kutu8}>
        <h2 id="bnr" className={stil.baslik3}>
          Bannerlar ve duyurular
        </h2>
        {v === null ? (
          <p className="k-empty">Yükleniyor…</p>
        ) : v.bannerlar.length === 0 ? (
          <p className={stil.metin4}>Henüz banner yok. “Yeni banner veya duyuru” ile ilk taslağı hazırla.</p>
        ) : (
          v.bannerlar.map((b) => (
            <div key={b.id} className={stil.kutu9}>
              <span
                aria-hidden="true"
                className={stil.metin5}
                style={{ background: b.zemin, borderLeft: `4px solid ${b.renk}` }}
              />
              <span className={stil.metin6}>
                <span className={stil.metin7}>{b.ad}</span>
                <span className={stil.metin8}>
                  {b.yer} · {b.kitle} · {b.platform}
                </span>
                <span className={stil.metin9}>{b.tarih}</span>
              </span>
              <span className={stil.metin10}>{b.sonuc}</span>
              <span className={stil.metin11}>
                {b.durumKey === 'taslak' ? (
                  <>
                    <button
                      type="button"
                      className={stil.dugme6}
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
                        className={stil.dugme7}
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
                      className={stil.dugme8}
                      onClick={() => islem(`banners/${b.id}`, 'DELETE')}
                    >
                      Sil
                    </button>
                  </>
                ) : b.durumKey === 'yayinda' || b.durumKey === 'zamanlandi' ? (
                  tam ? (
                    <button
                      type="button"
                      className={stil.dugme6}
                      onClick={() => islem(`banners/${b.id}/stop`, 'POST', undefined, 'Banner durduruldu.')}
                    >
                      Durdur
                    </button>
                  ) : null
                ) : (
                  <button
                    type="button"
                    className={stil.dugme6}
                    onClick={() =>
                      islem(`banners/${b.id}/copy`, 'POST', undefined, 'Kopyası taslak olarak açıldı.')
                    }
                  >
                    Kopyala
                  </button>
                )}
                <span className={stil.metin12} style={{ background: b.bg, color: b.fg }}>
                  {b.durum}
                </span>
              </span>
            </div>
          ))
        )}
      </section>

      {v ? (
        <section aria-labelledby="vitrin" className={stil.kutu10}>
          <div className={stil.kutu11}>
            <div>
              <h2 id="vitrin" className={stil.baslik4}>
                Ana sayfa vitrini
              </h2>
              <p className={stil.metin13}>{v.vitrin.not}</p>
            </div>
            <span className={stil.metin14}>
              <Switch
                on={v.vitrin.editor}
                label="Boş yerlere editör seçimi koy"
                disabled={!tam}
                onChange={() => islem('banners/vitrin/editor', 'PUT', { acik: !v.vitrin.editor })}
              />
              Boş yerlere editör seçimi koy
            </span>
          </div>
          <div className={stil.kutu12}>
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
                  className={cx(stil.metin15, ucretli ? stil.metin16 : stil.metin17)}
                  style={{
                    background: ucretli ? '#5B8CFF' : editor ? '#F3EFFF' : '#FFFFFF',
                    border: `1px ${ucretli || editor ? 'solid' : 'dashed'} ${
                      ucretli ? '#5B8CFF' : editor ? '#C9B8FF' : '#AEB5C4'
                    }`,
                  }}
                >
                  {ucretli ? i + 1 : editor ? 'E' : ''}
                </span>
              );
            })}
          </div>
          <div className={stil.kutu13}>
            <span className={stil.metin18}>
              <span className={stil.metin19} />
              Ücretli vitrin
            </span>
            <span className={stil.metin18}>
              <span className={stil.metin20} />
              Editör seçimi
            </span>
            <span className={stil.metin18}>
              <span className={stil.metin21} />
              Boş
            </span>
          </div>
        </section>
      ) : null}
    </>
  );
}
