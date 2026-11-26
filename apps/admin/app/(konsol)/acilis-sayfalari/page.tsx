'use client';

import {
  LANDING_BLOCK_DEFAULTS,
  LANDING_BLOCKS,
  type LandingBlock,
  type LandingBlockType,
} from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

interface Satir {
  id: string;
  ad: string;
  adres: string;
  durum: 'taslak' | 'yayinda' | 'kapali';
  taslakDegisti: boolean;
  sonuc: string;
}
interface Sayfa {
  id: string;
  ad: string;
  slug: string;
  seoBaslik: string;
  utm: { source: string; medium: string; campaign: string };
  bloklar: LandingBlock[];
  durum: Satir['durum'];
  surum: number;
  reklamBaglantisi: string;
  olaylar: string[];
  onizleme: string;
  surumler: { surum: number; zaman: string; kim: string }[];
}
type Taslak = Pick<Sayfa, 'ad' | 'slug' | 'seoBaslik' | 'utm' | 'bloklar'> & { id: string | null };

const DURUM: Record<Satir['durum'], [string, string, string]> = {
  yayinda: ['Yayında', '#E7FAF0', '#11683F'],
  taslak: ['Taslak', '#FFF6DF', '#7A5300'],
  kapali: ['Kapalı', '#F3F5FA', '#5A6073'],
};
const YENI: Taslak = {
  id: null,
  ad: 'Yeni açılış sayfası',
  slug: 'yeni-sayfa',
  seoBaslik: 'Aradığın aracı yaz | Rengarenk',
  utm: { source: 'meta', medium: 'paid', campaign: 'yeni_sayfa' },
  bloklar: [LANDING_BLOCK_DEFAULTS.baslik, LANDING_BLOCK_DEFAULTS.nasil, LANDING_BLOCK_DEFAULTS.form],
};

/** Blok içeriğinin kısa hâli */
function ozet(b: LandingBlock) {
  switch (b.tur) {
    case 'baslik':
    case 'form':
      return b.baslik;
    case 'rakamlar':
      return b.maddeler.map((m) => `${m.deger} ${m.etiket}`).join(' · ');
    case 'avantajlar':
      return b.maddeler.map((m) => m.baslik).join(' · ');
    case 'nasil':
      return `${b.adimlar.length} adım`;
    case 'sss':
      return `${b.sorular.length} soru`;
    default:
      return b.maddeler.join(' · ');
  }
}

/**
 * Açılış sayfaları (YonetimIcerik.dc.html › acilis; Karar 46, 35). Hazır bloklardan sayfa kurulur, bloğa tıklayınca
 * içeriği düzenlenir, ↑ ↓ ile sıralanır. Yayınla yeni sürüm açar; önceki sürüme dönülebilir. Reklam bağlantısı UTM'lerle
 * kendiliğinden üretilir; ölçüm olayları blokların hedefinden çıkar. Önizleme bağlantısı 1 saat geçerlidir.
 */
export default function AcilisSayfalari() {
  const { me } = useKonsol();
  const yayinlar = me.permissions['gorunum.duzenle'] === 'tam';
  const [liste, setListe] = useState<Satir[]>([]);
  const [secili, setSecili] = useState<Sayfa | null>(null);
  const [t, setT] = useState<Taslak | null>(null);
  const [acik, setAcik] = useState<number | null>(null);
  const [degisti, setDegisti] = useState(false);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const listele = useCallback(async () => {
    const l = await yonetim<Satir[]>('landing');
    setListe(l);
    return l;
  }, []);
  const ac = useCallback(async (id: string) => {
    const s = await yonetim<Sayfa>(`landing/${id}`);
    setSecili(s);
    setT({ id: s.id, ad: s.ad, slug: s.slug, seoBaslik: s.seoBaslik, utm: s.utm, bloklar: s.bloklar });
    setAcik(null);
    setDegisti(false);
  }, []);
  useEffect(() => {
    listele()
      .then((l) => (l[0] ? ac(l[0].id) : setT(YENI)))
      .catch((e: Error) => setHata(e.message));
  }, [listele, ac]);

  const yaz = (x: Partial<Taslak>) => {
    if (!t) return;
    setT({ ...t, ...x });
    setDegisti(true);
  };
  const blokYaz = (i: number, b: LandingBlock) =>
    yaz({ bloklar: t?.bloklar.map((x, j) => (j === i ? b : x)) });
  const tasi = (i: number, d: -1 | 1) => {
    if (!t) return;
    const j = i + d;
    if (j < 0 || j >= t.bloklar.length) return;
    const b = [...t.bloklar];
    [b[i], b[j]] = [b[j] as LandingBlock, b[i] as LandingBlock];
    yaz({ bloklar: b });
    setAcik(j);
  };

  async function kaydet() {
    if (!t) return null;
    setHata(null);
    try {
      const { id, ...govde } = t;
      const s = await yonetim<Sayfa>(id ? `landing/${id}` : 'landing', {
        method: id ? 'PUT' : 'POST',
        body: govde,
      });
      setSecili(s);
      setT({ ...t, id: s.id });
      setDegisti(false);
      await listele();
      return s;
    } catch (e) {
      setHata((e as Error).message);
      return null;
    }
  }
  async function yayinla() {
    const s = degisti || !t?.id ? await kaydet() : secili;
    if (!s) return;
    try {
      const y = await yonetim<Sayfa>(`landing/${s.id}/publish`, { method: 'POST', body: {} });
      setSecili(y);
      await listele();
      setBilgi(`Yayınlandı: ${y.reklamBaglantisi.split('?')[0]} · sürüm ${y.surum}.`);
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function islem(yol: string, mesaj: string) {
    if (!secili) return;
    try {
      const y = await yonetim<Sayfa>(`landing/${secili.id}/${yol}`, { method: 'POST', body: {} });
      setSecili(y);
      setT({ id: y.id, ad: y.ad, slug: y.slug, seoBaslik: y.seoBaslik, utm: y.utm, bloklar: y.bloklar });
      await listele();
      setBilgi(mesaj);
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  function editor(b: LandingBlock, i: number) {
    const satirlar = <T extends Record<string, string>>(
      liste: T[],
      alanlar: [keyof T & string, string][],
      yeni: T,
      set: (x: T[]) => void,
    ) => (
      <>
        {liste.map((m, k) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: düzenlenen satırların sırası
          <div key={k} className={stil.kutu1}>
            {alanlar.map(([a, ad]) => (
              <label key={a} className={stil.etiket1}>
                {ad}
                <input
                  value={m[a]}
                  onChange={(e) => set(liste.map((x, j) => (j === k ? { ...x, [a]: e.target.value } : x)))}
                  className={stil.girdi1}
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() => set(liste.filter((_, j) => j !== k))}
              className={stil.dugme1}
            >
              Sil
            </button>
          </div>
        ))}
        <button type="button" onClick={() => set([...liste, yeni])} className={stil.dugme2}>
          + Satır ekle
        </button>
      </>
    );
    switch (b.tur) {
      case 'baslik':
      case 'form':
        return (
          <div className={stil.kutu2}>
            <label className={stil.etiket2}>
              Başlık
              <input
                value={b.baslik}
                onChange={(e) => blokYaz(i, { ...b, baslik: e.target.value })}
                className={stil.girdi1}
              />
            </label>
            <label className={stil.etiket2}>
              {b.tur === 'baslik' ? 'Alt başlık' : 'Metin'}
              <input
                value={b.tur === 'baslik' ? b.alt : b.metin}
                onChange={(e) =>
                  blokYaz(
                    i,
                    b.tur === 'baslik' ? { ...b, alt: e.target.value } : { ...b, metin: e.target.value },
                  )
                }
                className={stil.girdi1}
              />
            </label>
            <span className={stil.metin1}>
              <label className={stil.etiket3}>
                Düğme
                <input
                  value={b.dugme}
                  onChange={(e) => blokYaz(i, { ...b, dugme: e.target.value })}
                  className={stil.girdi1}
                />
              </label>
              <label className={stil.etiket3}>
                Düğmenin hedefi
                <select
                  value={b.hedef}
                  onChange={(e) => blokYaz(i, { ...b, hedef: e.target.value as 'talep' | 'galeri' })}
                  className={stil.girdi1}
                >
                  <option value="talep">Talep oluşturma</option>
                  <option value="galeri">Galeri başvurusu</option>
                </select>
              </label>
            </span>
          </div>
        );
      case 'rakamlar':
        return satirlar(
          b.maddeler,
          [
            ['deger', 'Değer'],
            ['etiket', 'Etiket'],
          ],
          { deger: '', etiket: '' },
          (x) => blokYaz(i, { ...b, maddeler: x }),
        );
      case 'avantajlar':
        return satirlar(
          b.maddeler,
          [
            ['baslik', 'Başlık'],
            ['metin', 'Metin'],
          ],
          { baslik: '', metin: '' },
          (x) => blokYaz(i, { ...b, maddeler: x }),
        );
      case 'nasil':
        return satirlar(
          b.adimlar,
          [
            ['baslik', 'Adım'],
            ['metin', 'Açıklama'],
          ],
          { baslik: '', metin: '' },
          (x) => blokYaz(i, { ...b, adimlar: x }),
        );
      case 'sss':
        return satirlar(
          b.sorular,
          [
            ['soru', 'Soru'],
            ['cevap', 'Cevap'],
          ],
          { soru: '', cevap: '' },
          (x) => blokYaz(i, { ...b, sorular: x }),
        );
      default:
        return satirlar(
          b.maddeler.map((m) => ({ metin: m })),
          [['metin', 'Rozet']],
          { metin: '' },
          (x) => blokYaz(i, { ...b, maddeler: x.map((y) => y.metin) }),
        );
    }
  }

  const ayarlar = t
    ? [
        { ad: 'Adres', alan: 'slug' as const, deger: t.slug, onEk: 'rengarenksite.com/' },
        { ad: 'Sayfa başlığı', alan: 'seoBaslik' as const, deger: t.seoBaslik },
      ]
    : [];

  return (
    <>
      <div className={stil.kutu3}>
        <div>
          <h1 className={stil.baslik1}>Açılış sayfaları</h1>
          <p className={stil.metin2}>
            Reklamlar için hazır bloklardan sayfa kur. UTM ve ölçüm olayları kendiliğinden eklenir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSecili(null);
            setT(YENI);
            setDegisti(true);
            setAcik(null);
          }}
          className={stil.dugme3}
        >
          Yeni sayfa
        </button>
      </div>
      {bilgi ? (
        <div role="status" className={stil.kutu4}>
          {bilgi}
        </div>
      ) : null}
      {hata ? <p className={stil.metin3}>{hata}</p> : null}

      <div className={stil.kutu5}>
        <section aria-label="Sayfalar" className={stil.kutu6}>
          {liste.length ? null : <p className={stil.metin4}>Henüz sayfa yok.</p>}
          {liste.map((s) => {
            const on = secili?.id === s.id;
            const [ad, bg, fg] = DURUM[s.durum];
            return (
              <button
                key={s.id}
                type="button"
                aria-current={on}
                onClick={() => ac(s.id)}
                className={cx(stil.dugme4, on ? stil.dugme5 : stil.dugme6)}
              >
                <span className={stil.metin5}>
                  <span className={stil.metin6}>{s.ad}</span>
                  <span className={stil.metin7} style={{ background: bg, color: fg }}>
                    {ad}
                  </span>
                </span>
                <span className={stil.metin8}>rengarenksite.com{s.adres}</span>
                <span className={stil.metin9}>
                  {s.sonuc}
                  {s.taslakDegisti ? ' · yayınlanmamış değişiklik var' : ''}
                </span>
              </button>
            );
          })}
        </section>

        {t ? (
          <section aria-labelledby="sayfa" className={stil.kutu7}>
            <div className={stil.kutu8}>
              <input
                aria-label="Sayfa adı"
                value={t.ad}
                onChange={(e) => yaz({ ad: e.target.value })}
                className={stil.girdi2}
              />
              <h2 id="sayfa" className="sr-only">
                {t.ad}
              </h2>
              <span className={stil.metin10}>
                {degisti ? (
                  <button type="button" onClick={kaydet} className={stil.dugme7}>
                    Taslağı kaydet
                  </button>
                ) : null}
                {secili && !degisti ? (
                  <a href={secili.onizleme} target="_blank" rel="noreferrer" className={stil.bag1}>
                    Web ve mobilde önizle
                  </a>
                ) : null}
                {secili?.durum === 'yayinda' && yayinlar ? (
                  <button
                    type="button"
                    onClick={() => islem('unpublish', 'Sayfa yayından kaldırıldı.')}
                    className={stil.dugme7}
                  >
                    Yayından kaldır
                  </button>
                ) : null}
                {yayinlar ? (
                  <button type="button" onClick={yayinla} className={stil.dugme8}>
                    Yayınla
                  </button>
                ) : null}
              </span>
            </div>
            <div className={stil.kutu9}>
              <div className={stil.kutu10}>
                <h3 className={stil.baslik2}>Bloklar</h3>
                {t.bloklar.map((b, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: blokların sırası düzenleniyor
                    key={i}
                    className={stil.kutu11}
                  >
                    <div className={stil.kutu12}>
                      <span className={stil.metin11} style={{ background: LANDING_BLOCKS[b.tur].renk }} />
                      <button
                        type="button"
                        onClick={() => setAcik(acik === i ? null : i)}
                        className={stil.dugme9}
                      >
                        <span className={stil.metin12}>{LANDING_BLOCKS[b.tur].ad}</span>
                        <span className={stil.metin13}>{ozet(b)}</span>
                      </button>
                      <span className={stil.metin14}>
                        <button
                          type="button"
                          aria-label="Yukarı taşı"
                          onClick={() => tasi(i, -1)}
                          className={stil.dugme10}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label="Aşağı taşı"
                          onClick={() => tasi(i, 1)}
                          className={stil.dugme10}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          aria-label="Bloğu kaldır"
                          onClick={() => {
                            yaz({ bloklar: t.bloklar.filter((_, j) => j !== i) });
                            setAcik(null);
                          }}
                          className={stil.dugme1}
                        >
                          ×
                        </button>
                      </span>
                    </div>
                    {acik === i ? <div className={stil.kutu13}>{editor(b, i)}</div> : null}
                  </div>
                ))}
                <div className={stil.kutu14}>
                  {(Object.keys(LANDING_BLOCKS) as LandingBlockType[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        yaz({ bloklar: [...t.bloklar, LANDING_BLOCK_DEFAULTS[k]] });
                        setAcik(t.bloklar.length);
                      }}
                      className={stil.dugme11}
                    >
                      + {LANDING_BLOCKS[k].ad}
                    </button>
                  ))}
                </div>
              </div>
              <div className={stil.kutu15}>
                <h3 className={stil.baslik2}>Ayarlar ve ölçüm</h3>
                {ayarlar.map((a) => (
                  <div key={a.ad} className={stil.kutu16}>
                    <label className={stil.etiket4}>
                      {a.ad}
                      <input
                        value={a.deger}
                        onChange={(e) => yaz({ [a.alan]: e.target.value } as Partial<Taslak>)}
                        className={stil.girdi3}
                      />
                    </label>
                  </div>
                ))}
                <div className={stil.kutu16}>
                  <div className={stil.etiket4}>UTM</div>
                  <div className={stil.metin1}>
                    {(['source', 'medium', 'campaign'] as const).map((k) => (
                      <input
                        key={k}
                        aria-label={`utm_${k}`}
                        placeholder={k}
                        value={t.utm[k]}
                        onChange={(e) => yaz({ utm: { ...t.utm, [k]: e.target.value } })}
                        className={stil.girdi3}
                      />
                    ))}
                  </div>
                </div>
                {secili ? (
                  <>
                    <div className={stil.kutu16}>
                      <div className={stil.etiket4}>Reklam bağlantısı (otomatik)</div>
                      <div className={stil.kutu17}>{secili.reklamBaglantisi}</div>
                    </div>
                    <div className={stil.kutu16}>
                      <div className={stil.etiket4}>Ölçüm olayları (otomatik)</div>
                      <div className={stil.kutu18}>{secili.olaylar.join(' · ')}</div>
                    </div>
                  </>
                ) : null}
                <p className={stil.metin15}>
                  Ölçüm olayları yalnızca reklam ölçümüne izin veren ziyaretçiler için gönderilir (Karar 35).
                </p>
                {secili?.surumler.length ? (
                  <>
                    <h3 className={stil.baslik3}>Sürümler</h3>
                    {secili.surumler.map((v) => (
                      <div key={v.surum} className={stil.kutu19}>
                        <span>
                          s.{v.surum} · {new Date(v.zaman).toLocaleDateString('tr-TR')} · {v.kim}
                        </span>
                        {v.surum !== secili.surum && yayinlar ? (
                          <button
                            type="button"
                            onClick={() => islem(`rollback/${v.surum}`, `s.${v.surum} yeniden yayınlandı.`)}
                            className={stil.dugme2}
                          >
                            Bu sürüme dön
                          </button>
                        ) : v.surum === secili.surum ? (
                          <span className={stil.metin16}>yayındaki</span>
                        ) : null}
                      </div>
                    ))}
                  </>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
