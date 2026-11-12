'use client';

import {
  LANDING_BLOCK_DEFAULTS,
  LANDING_BLOCKS,
  type LandingBlock,
  type LandingBlockType,
} from '@rengarenk/shared';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

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
const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 };
const girdi: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 3,
  border: '1px solid #D5DAE5',
  borderRadius: 8,
  padding: '7px 9px',
  fontSize: 13.5,
  fontFamily: 'inherit',
  background: '#FFFFFF',
};
const ikincil: CSSProperties = {
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13.5,
  fontWeight: 700,
  color: '#1E2333',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const minik: CSSProperties = {
  border: 0,
  background: 'transparent',
  padding: '2px 4px',
  fontSize: 13,
  color: '#5A6073',
  cursor: 'pointer',
  fontFamily: 'inherit',
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
          <div key={k} style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginBottom: 6 }}>
            {alanlar.map(([a, ad]) => (
              <label key={a} style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#3A4052' }}>
                {ad}
                <input
                  value={m[a]}
                  onChange={(e) => set(liste.map((x, j) => (j === k ? { ...x, [a]: e.target.value } : x)))}
                  style={girdi}
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() => set(liste.filter((_, j) => j !== k))}
              style={{ ...minik, color: '#A3271F' }}
            >
              Sil
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => set([...liste, yeni])}
          style={{ ...minik, color: '#2450C8', fontWeight: 700 }}
        >
          + Satır ekle
        </button>
      </>
    );
    switch (b.tur) {
      case 'baslik':
      case 'form':
        return (
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Başlık
              <input
                value={b.baslik}
                onChange={(e) => blokYaz(i, { ...b, baslik: e.target.value })}
                style={girdi}
              />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              {b.tur === 'baslik' ? 'Alt başlık' : 'Metin'}
              <input
                value={b.tur === 'baslik' ? b.alt : b.metin}
                onChange={(e) =>
                  blokYaz(
                    i,
                    b.tur === 'baslik' ? { ...b, alt: e.target.value } : { ...b, metin: e.target.value },
                  )
                }
                style={girdi}
              />
            </label>
            <span style={{ display: 'flex', gap: 6 }}>
              <label style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>
                Düğme
                <input
                  value={b.dugme}
                  onChange={(e) => blokYaz(i, { ...b, dugme: e.target.value })}
                  style={girdi}
                />
              </label>
              <label style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>
                Düğmenin hedefi
                <select
                  value={b.hedef}
                  onChange={(e) => blokYaz(i, { ...b, hedef: e.target.value as 'talep' | 'galeri' })}
                  style={girdi}
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
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Açılış sayfaları</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
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
          Yeni sayfa
        </button>
      </div>
      {bilgi ? (
        <div
          role="status"
          style={{
            background: '#F3EFFF',
            color: '#4B2FA6',
            borderRadius: 12,
            padding: '10px 14px',
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          {bilgi}
        </div>
      ) : null}
      {hata ? <p style={{ color: '#A3271F', fontWeight: 700 }}>{hata}</p> : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section
          aria-label="Sayfalar"
          style={{ ...kart, flex: '1 1 280px', maxWidth: 340, minWidth: 0, padding: 8 }}
        >
          {liste.length ? null : (
            <p style={{ margin: 0, padding: 12, fontSize: 13.5, color: '#5A6073' }}>Henüz sayfa yok.</p>
          )}
          {liste.map((s) => {
            const on = secili?.id === s.id;
            const [ad, bg, fg] = DURUM[s.durum];
            return (
              <button
                key={s.id}
                type="button"
                aria-current={on}
                onClick={() => ac(s.id)}
                style={{
                  width: '100%',
                  display: 'block',
                  textAlign: 'left',
                  border: 0,
                  background: on ? '#F3EFFF' : 'transparent',
                  borderRadius: 12,
                  padding: 12,
                  cursor: 'pointer',
                  color: '#1E2333',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{s.ad}</span>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: bg,
                      color: fg,
                    }}
                  >
                    {ad}
                  </span>
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#2450C8', marginTop: 3 }}>
                  rengarenksite.com{s.adres}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: '#5A6073', marginTop: 3 }}>
                  {s.sonuc}
                  {s.taslakDegisti ? ' · yayınlanmamış değişiklik var' : ''}
                </span>
              </button>
            );
          })}
        </section>

        {t ? (
          <section
            aria-labelledby="sayfa"
            style={{ ...kart, flex: '999 1 520px', minWidth: 0, overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '16px 18px',
                borderBottom: '1px solid #EEF0F5',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <input
                aria-label="Sayfa adı"
                value={t.ad}
                onChange={(e) => yaz({ ad: e.target.value })}
                style={{
                  border: 0,
                  fontSize: 17,
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  minWidth: 0,
                  flex: '1 1 200px',
                }}
              />
              <h2 id="sayfa" className="sr-only">
                {t.ad}
              </h2>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {degisti ? (
                  <button type="button" onClick={kaydet} style={ikincil}>
                    Taslağı kaydet
                  </button>
                ) : null}
                {secili && !degisti ? (
                  <a
                    href={secili.onizleme}
                    target="_blank"
                    rel="noreferrer"
                    style={{ ...ikincil, textDecoration: 'none' }}
                  >
                    Web ve mobilde önizle
                  </a>
                ) : null}
                {secili?.durum === 'yayinda' && yayinlar ? (
                  <button
                    type="button"
                    onClick={() => islem('unpublish', 'Sayfa yayından kaldırıldı.')}
                    style={ikincil}
                  >
                    Yayından kaldır
                  </button>
                ) : null}
                {yayinlar ? (
                  <button
                    type="button"
                    onClick={yayinla}
                    style={{
                      border: 0,
                      background: '#3DD68C',
                      borderRadius: 10,
                      padding: '9px 14px',
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: '#1E2333',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Yayınla
                  </button>
                ) : null}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '16px 18px' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: '#5A6073' }}>
                  Bloklar
                </h3>
                {t.bloklar.map((b, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: blokların sırası düzenleniyor
                    key={i}
                    style={{
                      border: '1px solid #E3E6EF',
                      borderRadius: 10,
                      padding: '8px 10px',
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          flex: 'none',
                          width: 8,
                          height: 22,
                          borderRadius: 3,
                          background: LANDING_BLOCKS[b.tur].renk,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setAcik(acik === i ? null : i)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: 0,
                          background: 'transparent',
                          padding: 0,
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          color: '#1E2333',
                        }}
                      >
                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800 }}>
                          {LANDING_BLOCKS[b.tur].ad}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 12,
                            color: '#5A6073',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {ozet(b)}
                        </span>
                      </button>
                      <span style={{ flex: 'none' }}>
                        <button
                          type="button"
                          aria-label="Yukarı taşı"
                          onClick={() => tasi(i, -1)}
                          style={minik}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label="Aşağı taşı"
                          onClick={() => tasi(i, 1)}
                          style={minik}
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
                          style={{ ...minik, color: '#A3271F' }}
                        >
                          ×
                        </button>
                      </span>
                    </div>
                    {acik === i ? <div style={{ marginTop: 8 }}>{editor(b, i)}</div> : null}
                  </div>
                ))}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {(Object.keys(LANDING_BLOCKS) as LandingBlockType[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        yaz({ bloklar: [...t.bloklar, LANDING_BLOCK_DEFAULTS[k]] });
                        setAcik(t.bloklar.length);
                      }}
                      style={{
                        border: '1px dashed #AEB5C4',
                        background: '#FFFFFF',
                        borderRadius: 999,
                        padding: '6px 11px',
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: '#1E2333',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      + {LANDING_BLOCKS[k].ad}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: '#5A6073' }}>
                  Ayarlar ve ölçüm
                </h3>
                {ayarlar.map((a) => (
                  <div key={a.ad} style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#3A4052' }}>
                      {a.ad}
                      <input
                        value={a.deger}
                        onChange={(e) => yaz({ [a.alan]: e.target.value } as Partial<Taslak>)}
                        style={{
                          ...girdi,
                          borderRadius: 10,
                          padding: '8px 10px',
                          fontSize: 12.5,
                          fontWeight: 600,
                        }}
                      />
                    </label>
                  </div>
                ))}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#3A4052' }}>UTM</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['source', 'medium', 'campaign'] as const).map((k) => (
                      <input
                        key={k}
                        aria-label={`utm_${k}`}
                        placeholder={k}
                        value={t.utm[k]}
                        onChange={(e) => yaz({ utm: { ...t.utm, [k]: e.target.value } })}
                        style={{
                          ...girdi,
                          borderRadius: 10,
                          padding: '8px 10px',
                          fontSize: 12.5,
                          fontWeight: 600,
                        }}
                      />
                    ))}
                  </div>
                </div>
                {secili ? (
                  <>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#3A4052' }}>
                        Reklam bağlantısı (otomatik)
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          border: '1px solid #D5DAE5',
                          borderRadius: 10,
                          padding: '8px 10px',
                          fontSize: 12.5,
                          fontWeight: 600,
                          background: '#F6F8FD',
                          wordBreak: 'break-all',
                        }}
                      >
                        {secili.reklamBaglantisi}
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#3A4052' }}>
                        Ölçüm olayları (otomatik)
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          border: '1px solid #D5DAE5',
                          borderRadius: 10,
                          padding: '8px 10px',
                          fontSize: 12.5,
                          fontWeight: 600,
                          background: '#F6F8FD',
                        }}
                      >
                        {secili.olaylar.join(' · ')}
                      </div>
                    </div>
                  </>
                ) : null}
                <p style={{ margin: 0, fontSize: 12, color: '#5A6073' }}>
                  Ölçüm olayları yalnızca reklam ölçümüne izin veren ziyaretçiler için gönderilir (Karar 35).
                </p>
                {secili?.surumler.length ? (
                  <>
                    <h3 style={{ margin: '14px 0 6px', fontSize: 13, fontWeight: 800, color: '#5A6073' }}>
                      Sürümler
                    </h3>
                    {secili.surumler.map((v) => (
                      <div
                        key={v.surum}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 8,
                          fontSize: 12.5,
                          padding: '4px 0',
                        }}
                      >
                        <span>
                          s.{v.surum} · {new Date(v.zaman).toLocaleDateString('tr-TR')} · {v.kim}
                        </span>
                        {v.surum !== secili.surum && yayinlar ? (
                          <button
                            type="button"
                            onClick={() => islem(`rollback/${v.surum}`, `s.${v.surum} yeniden yayınlandı.`)}
                            style={{ ...minik, color: '#2450C8', fontWeight: 700 }}
                          >
                            Bu sürüme dön
                          </button>
                        ) : v.surum === secili.surum ? (
                          <span style={{ color: '#11683F', fontWeight: 700 }}>yayındaki</span>
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
