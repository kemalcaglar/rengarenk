'use client';

import {
  colorNote,
  DEFAULT_DESIGN,
  type DesignTokens,
  designProblems,
  designWarnings,
  type FontType,
  fontCssUrl,
  type SeasonalTheme,
} from '@rengarenk/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

interface Gorunum {
  yayinda: { surum: number; degerler: DesignTokens; tarih: string | null };
  taslak: { surum: number; degerler: DesignTokens; not: string | null; onayda: boolean } | null;
  renkler: { key: keyof DesignTokens['renkler']; ad: string; not: string; grup: string }[];
  fontlar: { ad: string; tur: FontType; turAd: string; agirliklar: number[] }[];
  temalar: (SeasonalTheme & { tarihler: string; durum: string })[];
  sorunlar: string[];
}

const DURUM_RENK: Record<string, { bg: string; fg: string }> = {
  Zamanlandı: { bg: '#EEF3FF', fg: '#2450C8' },
  Yayında: { bg: '#E7FAF0', fg: '#11683F' },
  Taslak: { bg: '#FFF6DF', fg: '#7A5300' },
  Bitti: { bg: '#F3F5FA', fg: '#5A6073' },
};
// `font` kısaltması önce: sonra gelen boyut ve kalınlık onu ezer

/** Köşe hazır seçimleri: sitedeki bütün köşeler bu üç değere oranla değişir */
const KOSE_HAZIR = [
  { ad: 'Köşesiz', kartKose: 0, butonKose: 0, etiketKose: 0 },
  { ad: 'Az yuvarlak', kartKose: 8, butonKose: 6, etiketKose: 6 },
  { ad: 'Varsayılan', kartKose: 18, butonKose: 14, etiketKose: 999 },
  { ad: 'Çok yuvarlak', kartKose: 28, butonKose: 24, etiketKose: 999 },
] as const;

/** Konsol önizlemesi için yazı tipini yükler (Google Fonts) */
function useYaziTipi(ad: string) {
  useEffect(() => {
    const id = `rr-font-${ad.replace(/\W/g, '')}`;
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id;
    l.rel = 'stylesheet';
    l.href = fontCssUrl(ad);
    document.head.appendChild(l);
  }, [ad]);
}

/**
 * Görünüm › Tasarım değerleri (YonetimIcerik.dc.html › tasarim; Karar 46): Gökkuşağı paleti, yazı tipi (Türkçe
 * destekli 70 seçenek), köşeler, mevsimsel temalar ve canlı önizleme. Web, mobil ve e-posta aynı değerleri kullanır;
 * değişiklik sahip veya yönetici onayıyla yayına girer.
 */
export default function TasarimDegerleri() {
  const { me } = useKonsol();
  const yazabilir = Boolean(me.permissions['tasarim_yasal.duzenle']);
  const [v, setV] = useState<Gorunum | null>(null);
  const [d, setD] = useState<DesignTokens | null>(null);
  const [not, setNot] = useState('');
  const [onizTema, setOnizTema] = useState(false);
  const [acikTema, setAcikTema] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  const yukle = useCallback(() => {
    yonetim<Gorunum>('design')
      .then((x) => {
        setV(x);
        setD(x.taslak?.degerler ?? x.yayinda.degerler);
        setNot(x.taslak?.not ?? '');
      })
      .catch((e: Error) => setHata(e.message));
  }, []);
  useEffect(yukle, [yukle]);
  useYaziTipi(d?.yaziTipi ?? 'Plus Jakarta Sans');

  const sorunlar = useMemo(() => (d ? designProblems(d) : []), [d]);
  const uyarilar = useMemo(() => (d ? designWarnings(d) : []), [d]);
  const renkGruplari = useMemo(() => {
    const m = new Map<string, Gorunum['renkler']>();
    for (const r of v?.renkler ?? []) m.set(r.grup, [...(m.get(r.grup) ?? []), r]);
    return [...m.entries()];
  }, [v]);
  const gruplar = useMemo(() => {
    const m = new Map<string, Gorunum['fontlar']>();
    for (const f of v?.fontlar ?? []) m.set(f.turAd, [...(m.get(f.turAd) ?? []), f]);
    return [...m.entries()];
  }, [v]);
  if (!v || !d) return <div className="k-panel k-empty">{hata ?? 'Yükleniyor…'}</div>;

  const onayda = Boolean(v.taslak?.onayda);
  const tema = d.temalar[0] ?? null;
  const ozel = onizTema && tema;
  const set = (p: Partial<DesignTokens>) => setD({ ...d, ...p });
  const temaSet = (id: string, p: Partial<SeasonalTheme>) =>
    set({ temalar: d.temalar.map((t) => (t.id === id ? { ...t, ...p } : t)) });

  async function gonder() {
    if (!d) return;
    setBusy(true);
    setHata(null);
    setBilgi(null);
    try {
      await yonetim('design/draft', {
        method: 'PUT',
        body: { degerler: d, ...(not.trim() ? { not: not.trim() } : {}) },
      });
      const r = await yonetim<{ surum: number; degisiklikler: string[] }>('design/submit', {
        method: 'POST',
        body: {},
      });
      setBilgi(
        `Tasarım değerleri s.${r.surum} onaya gönderildi (${r.degisiklikler.length} değişiklik). Onaylanınca web, mobil ve e-posta şablonlarına aynı anda uygulanır.`,
      );
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function geriCek() {
    setBusy(true);
    setHata(null);
    setBilgi(null);
    try {
      const r = await yonetim<{ surum: number }>('design/geri-cek', { method: 'POST', body: {} });
      setBilgi(`s.${r.surum} onaydan geri çekildi; değerleri yeniden düzenleyebilirsin.`);
      yukle();
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const font = `'${d.yaziTipi}', system-ui, sans-serif`;
  const R = d.renkler;
  return (
    <>
      <div className={stil.kutu1}>
        <div>
          <h1 className="k-h1">Tasarım değerleri</h1>
          <p className="k-sub">
            Web, mobil uygulama ve e-posta şablonları aynı değerleri kullanır. Değişiklik sahip veya yönetici
            onayı ister.
            {v.yayinda.surum
              ? ` Yayında s.${v.yayinda.surum} · ${v.yayinda.tarih}.`
              : ' Henüz varsayılan değerler yayında.'}
          </p>
        </div>
        {yazabilir ? (
          <button
            type="button"
            disabled={busy || onayda || sorunlar.length > 0}
            onClick={() => void gonder()}
            className={cx(
              stil.dugme1,
              onayda ? stil.dugme2 : stil.dugme3,
              sorunlar.length ? stil.dugme4 : stil.dugme5,
            )}
          >
            {onayda ? `s.${v.taslak?.surum} onayda` : busy ? 'Gönderiliyor…' : 'Onaya gönder'}
          </button>
        ) : null}
      </div>
      {hata ? (
        <p className="k-error" role="alert">
          {hata}
        </p>
      ) : null}
      {bilgi ? (
        <p className="k-ok" role="status">
          {bilgi}
        </p>
      ) : null}
      {onayda ? (
        <div className={`k-ok ${stil.kutu2}`} role="status">
          <span className={stil.metin1}>
            s.{v.taslak?.surum} onay bekliyor; değerler onaylanana ya da geri çekilene kadar kilitli. Onay
            kuyruğundan onaylayabilir ya da buradan geri çekip düzenlemeye devam edebilirsin.
          </span>
          {yazabilir ? (
            <button
              type="button"
              className={`k-btn-line ${stil.dugme6}`}
              disabled={busy}
              onClick={() => void geriCek()}
            >
              Geri çek ve düzenle
            </button>
          ) : null}
        </div>
      ) : null}
      {sorunlar.length ? (
        <div className="k-error" role="alert">
          Onaya göndermeden önce düzelt: {sorunlar.join(' · ')}
        </div>
      ) : null}
      {uyarilar.length ? (
        <div role="note" className={stil.kutu3}>
          Uyarı (gönderilebilir): {uyarilar.join(' · ')}
        </div>
      ) : null}

      <div className={stil.kutu4}>
        <div className={stil.kutu5}>
          <section className={stil.kutu6} aria-labelledby="renk">
            <div className={stil.kutu7}>
              <h2 id="renk" className={stil.baslik1}>
                Renkler
              </h2>
              {yazabilir && !onayda ? (
                <button
                  type="button"
                  className={`k-btn-line ${stil.dugme7}`}
                  onClick={() => set({ renkler: { ...DEFAULT_DESIGN.renkler } })}
                >
                  Renkleri varsayılana döndür
                </button>
              ) : null}
            </div>
            {renkGruplari.map(([grup, liste]) => (
              <div key={grup}>
                <h3 className={stil.baslik2}>{grup}</h3>
                <div className={stil.kutu8}>
                  {liste.map((r) => (
                    <div key={r.key} className={stil.kutu9}>
                      <label
                        className={cx(stil.etiket1, yazabilir ? stil.dugme3 : stil.dugme2)}
                        style={{ background: R[r.key] }}
                      >
                        <span className="sr-only">{r.ad} rengini seç</span>
                        <input
                          type="color"
                          value={R[r.key]}
                          disabled={!yazabilir || onayda}
                          onChange={(e) => set({ renkler: { ...R, [r.key]: e.target.value.toUpperCase() } })}
                          className={stil.girdi1}
                        />
                      </label>
                      <div className={stil.kutu10}>{r.ad}</div>
                      <input
                        aria-label={`${r.ad} kodu`}
                        value={R[r.key]}
                        disabled={!yazabilir || onayda}
                        maxLength={7}
                        onChange={(e) =>
                          /^#[0-9A-Fa-f]{0,6}$/.test(e.target.value) &&
                          set({ renkler: { ...R, [r.key]: e.target.value.toUpperCase() } })
                        }
                        className={stil.girdi2}
                      />
                      <div className={stil.kutu11}>{colorNote(r.key, d)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className={stil.kutu6} aria-labelledby="yazi">
            <h2 id="yazi" className={stil.baslik3}>
              Yazı, köşe ve logo
            </h2>
            {(
              [
                [
                  'Yazı tipi',
                  <span key="f" className={stil.metin2}>
                    <select
                      aria-label="Yazı tipi"
                      value={d.yaziTipi}
                      disabled={!yazabilir || onayda}
                      onChange={(e) => set({ yaziTipi: e.target.value })}
                      className={stil.girdi3}
                    >
                      {gruplar.map(([tur, l]) => (
                        <optgroup key={tur} label={`${tur} · ${l.length}`}>
                          {l.map((f) => (
                            <option key={f.ad} value={f.ad}>
                              {f.ad} · {f.agirliklar[0]}–{f.agirliklar.at(-1)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <span className={stil.metin3} style={{ fontFamily: font }}>
                      Çağrı, ılık şöför İğdır’da güzel Ü ğ ş ı İ ö ç ·{' '}
                      <b className={stil.metin4}>320i M Sport</b>
                    </span>
                  </span>,
                ],
                [
                  'Köşeler',
                  <span key="h" className={stil.metin5}>
                    {KOSE_HAZIR.map((h) => {
                      const secili =
                        d.kartKose === h.kartKose &&
                        d.butonKose === h.butonKose &&
                        d.etiketKose === h.etiketKose;
                      return (
                        <button
                          key={h.ad}
                          type="button"
                          className={cx('k-btn-line', stil.dugme7, secili ? stil.dugme8 : undefined)}
                          aria-pressed={secili}
                          disabled={!yazabilir || onayda}
                          onClick={() =>
                            set({ kartKose: h.kartKose, butonKose: h.butonKose, etiketKose: h.etiketKose })
                          }
                        >
                          {h.ad}
                        </button>
                      );
                    })}
                  </span>,
                ],
                ['Kart köşesi', 'kartKose', 32],
                ['Buton köşesi', 'butonKose', 28],
              ] as const
            ).map(([ad, x, ust]) => (
              <div key={ad} className={stil.kutu12}>
                <span className={stil.metin6}>{ad}</span>
                {typeof x === 'string' ? (
                  <span className={stil.metin7}>
                    <input
                      type="range"
                      aria-label={`${ad} kaydırıcı`}
                      min={0}
                      max={ust}
                      value={d[x as 'kartKose' | 'butonKose']}
                      disabled={!yazabilir || onayda}
                      onChange={(e) => set({ [x]: Number(e.target.value) })}
                      className={stil.girdi4}
                    />
                    <input
                      type="number"
                      aria-label={ad}
                      min={0}
                      max={ust}
                      value={d[x as 'kartKose' | 'butonKose']}
                      disabled={!yazabilir || onayda}
                      onChange={(e) =>
                        set({ [x]: Math.max(0, Math.min(Number(ust), Number(e.target.value) || 0)) })
                      }
                      className={stil.girdi5}
                    />{' '}
                    px
                  </span>
                ) : (
                  x
                )}
              </div>
            ))}
            <div className={stil.kutu13}>
              <span className={stil.metin6}>Etiket köşesi</span>
              <label className={stil.etiket2}>
                <input
                  type="checkbox"
                  checked={d.etiketKose >= 999}
                  disabled={!yazabilir || onayda}
                  onChange={(e) => set({ etiketKose: e.target.checked ? 999 : 8 })}
                />
                Tam yuvarlak
                {d.etiketKose < 999 ? (
                  <>
                    <input
                      type="range"
                      aria-label="Etiket köşesi kaydırıcı"
                      min={0}
                      max={20}
                      value={d.etiketKose}
                      disabled={!yazabilir || onayda}
                      onChange={(e) => set({ etiketKose: Number(e.target.value) })}
                      className={stil.girdi6}
                    />
                    <input
                      type="number"
                      aria-label="Etiket köşesi"
                      min={0}
                      max={20}
                      value={d.etiketKose}
                      disabled={!yazabilir || onayda}
                      onChange={(e) =>
                        set({ etiketKose: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })
                      }
                      className={stil.girdi7}
                    />{' '}
                    px
                  </>
                ) : null}
              </label>
            </div>
            <div className={stil.kutu14}>
              <span className={stil.metin8}>
                Sitedeki ve uygulamadaki bütün köşeler bu üç değere oranla değişir; 0 seçilirse köşeler
                tamamen kalkar. Avatar ve nokta gibi tam daireler değişmez.
              </span>
              <span className={stil.metin6}>Logo</span>
              <span className={stil.metin9}>Dört renkli çubuk + “rengarenk” · SVG, koyu ve açık sürüm</span>
            </div>
          </section>

          <section className={stil.kutu15} aria-labelledby="mevsim">
            <div className={stil.kutu16}>
              <h2 id="mevsim" className={stil.baslik1}>
                Mevsimsel temalar
              </h2>
              {yazabilir && !onayda ? (
                <button
                  type="button"
                  className={`k-btn-line ${stil.dugme6}`}
                  onClick={() => {
                    const id = `tema-${Date.now().toString(36)}`;
                    const bugun = new Date().toISOString().slice(0, 10);
                    set({
                      temalar: [
                        ...d.temalar,
                        {
                          id,
                          ad: 'Yeni tema',
                          baslangic: bugun,
                          bitis: bugun,
                          ustBant: '#22306B',
                          ustYazi: '#FFFFFF',
                          rozet: '',
                          not: '',
                        },
                      ],
                    });
                    setAcikTema(id);
                  }}
                >
                  Tema ekle
                </button>
              ) : null}
            </div>
            {d.temalar.length === 0 ? <div className="k-empty">Tema yok.</div> : null}
            {d.temalar.map((t) => {
              const satir = v.temalar.find((x) => x.id === t.id);
              const durum = satir?.durum ?? 'Taslak';
              const renk = DURUM_RENK[durum] ?? DURUM_RENK.Taslak;
              return (
                <div key={t.id} className={stil.kutu17}>
                  <div className={stil.kutu18}>
                    <span className={stil.metin10}>
                      <span className={stil.metin11}>{t.ad}</span>
                      <span className={stil.metin12}>
                        {satir?.tarihler ?? `${t.baslangic} – ${t.bitis}`}
                        {t.rozet ? ` · rozet “${t.rozet}”` : ''}
                        {t.not ? ` · ${t.not}` : ''}
                      </span>
                    </span>
                    <span className={stil.metin13} style={{ background: renk?.bg, color: renk?.fg }}>
                      {durum}
                    </span>
                    {yazabilir && !onayda ? (
                      <button
                        type="button"
                        className={`k-btn-line ${stil.dugme7}`}
                        aria-expanded={acikTema === t.id}
                        onClick={() => setAcikTema(acikTema === t.id ? null : t.id)}
                      >
                        Düzenle
                      </button>
                    ) : null}
                  </div>
                  {acikTema === t.id ? (
                    <div className={stil.kutu19}>
                      <label>
                        Ad
                        <input
                          value={t.ad}
                          maxLength={60}
                          onChange={(e) => temaSet(t.id, { ad: e.target.value })}
                          className={stil.girdi8}
                        />
                      </label>
                      <label>
                        Başlangıç
                        <input
                          type="date"
                          value={t.baslangic}
                          onChange={(e) => temaSet(t.id, { baslangic: e.target.value })}
                          className={stil.girdi8}
                        />
                      </label>
                      <label>
                        Bitiş (dahil)
                        <input
                          type="date"
                          value={t.bitis}
                          onChange={(e) => temaSet(t.id, { bitis: e.target.value })}
                          className={stil.girdi8}
                        />
                      </label>
                      <label>
                        Üst bant rengi
                        <input
                          type="color"
                          value={t.ustBant}
                          onChange={(e) => temaSet(t.id, { ustBant: e.target.value.toUpperCase() })}
                          className={stil.girdi9}
                        />
                      </label>
                      <label>
                        Üst bant yazısı
                        <input
                          type="color"
                          value={t.ustYazi}
                          onChange={(e) => temaSet(t.id, { ustYazi: e.target.value.toUpperCase() })}
                          className={stil.girdi9}
                        />
                      </label>
                      <label>
                        Rozet (logonun yanında)
                        <input
                          value={t.rozet}
                          maxLength={30}
                          onChange={(e) => temaSet(t.id, { rozet: e.target.value })}
                          className={stil.girdi8}
                        />
                      </label>
                      <label className={stil.etiket3}>
                        Not (ör. ana sayfa bannerı Banner ve vitrin’den zamanlanır)
                        <input
                          value={t.not}
                          maxLength={160}
                          onChange={(e) => temaSet(t.id, { not: e.target.value })}
                          className={stil.girdi8}
                        />
                      </label>
                      <button
                        type="button"
                        className={`k-btn-line ${stil.dugme9}`}
                        onClick={() => set({ temalar: d.temalar.filter((x) => x.id !== t.id) })}
                      >
                        Temayı kaldır
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
          {yazabilir && !onayda ? (
            <label className={`k-field ${stil.etiket4}`}>
              Değişiklik notu (onay isteğinde görünür)
              <input value={not} maxLength={500} onChange={(e) => setNot(e.target.value)} />
            </label>
          ) : null}
        </div>

        <section className={stil.kutu20} aria-labelledby="canli">
          <div className={stil.kutu21}>
            <h2 id="canli" className={stil.baslik1}>
              Önizleme
            </h2>
            {tema ? (
              <button
                type="button"
                role="switch"
                aria-checked={onizTema}
                onClick={() => setOnizTema(!onizTema)}
                className={stil.dugme10}
              >
                <span className={cx(stil.metin14, onizTema ? stil.metin15 : stil.metin16)}>
                  <span className={cx(stil.metin17, onizTema ? stil.metin18 : stil.metin19)} />
                </span>
                {tema.ad} teması
              </button>
            ) : null}
          </div>
          <div className={stil.kutu22} style={{ border: `1px solid ${R.cizgi}`, fontFamily: font }}>
            <div className={stil.kutu23} style={{ background: ozel ? tema.ustBant : R.kart }}>
              {[R.mavi, R.pembe, R.sari, R.yesil].map((c, i) => (
                <span
                  key={`${c}-${['a', 'b', 'c', 'd'][i]}`}
                  className={stil.metin20}
                  style={{ background: c }}
                />
              ))}
              <span className={stil.metin21} style={{ color: ozel ? tema.ustYazi : R.murekkep }}>
                rengarenk
              </span>
              {ozel && tema.rozet ? (
                <span className={stil.metin22} style={{ color: tema.ustYazi }}>
                  {tema.rozet}
                </span>
              ) : null}
            </div>
            <div className={stil.kutu24} style={{ background: R.zemin }}>
              <div
                className={stil.kutu25}
                style={{
                  background: ozel ? tema.ustBant : '#EEF3FF',
                  borderRadius: d.kartKose,
                  color: ozel ? tema.ustYazi : R.murekkep,
                }}
              >
                <div className={stil.kutu26}>{ozel ? 'Yeni yılda yeni araba' : 'Aradığın aracı yaz'}</div>
                <div className={stil.kutu27}>Aradığın aracı yaz, satıcılar sana gelsin.</div>
              </div>
              <div
                className={stil.kutu28}
                style={{ background: R.kart, border: `1px solid ${R.cizgi}`, borderRadius: d.kartKose }}
              >
                <div className={stil.kutu29} style={{ color: R.murekkep }}>
                  BMW 3 Serisi 320i · M Sport
                </div>
                <div className={stil.kutu30} style={{ color: R.soluk }}>
                  2020–2023 · İstanbul · ₺1,75 – 2,05 milyon
                </div>
                <div className={stil.kutu31}>
                  <span
                    className={stil.metin23}
                    style={{ borderRadius: d.etiketKose, background: R.pembe, color: R.pembeYazi }}
                  >
                    Acil arıyorum
                  </span>
                  <span
                    className={stil.metin23}
                    style={{ borderRadius: d.etiketKose, background: R.yesil, color: R.yesilYazi }}
                  >
                    12 mesaj
                  </span>
                </div>
              </div>
              <div className={stil.kutu32}>
                <span
                  className={stil.metin24}
                  style={{ background: R.mavi, color: R.maviYazi, borderRadius: d.butonKose }}
                >
                  Talep oluştur
                </span>
                <span
                  className={stil.metin25}
                  style={{
                    border: `1px solid ${R.cizgi}`,
                    background: R.kart,
                    color: R.murekkep,
                    borderRadius: d.butonKose,
                  }}
                >
                  Galeri ol
                </span>
                <span
                  className={stil.metin24}
                  style={{ background: R.sari, color: R.sariYazi, borderRadius: d.butonKose }}
                >
                  Hak al
                </span>
              </div>
              <span className={stil.metin26} style={{ color: R.baglanti }}>
                Tüm talepleri gör ›
              </span>
            </div>
          </div>
          <p className={stil.metin27}>
            Önizleme taslaktaki değerlerle çizilir. Yayına girince web siteye, mobil uygulamaya (bir sonraki
            açılışta) ve e-postalara uygulanır.
          </p>
        </section>
      </div>
    </>
  );
}
