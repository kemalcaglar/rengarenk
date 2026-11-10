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
import { yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

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
const kart = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18 } as const;
// `font` kısaltması önce: sonra gelen boyut ve kalınlık onu ezer
const girdi = {
  font: 'inherit',
  border: '1px solid #D5DAE5',
  borderRadius: 10,
  padding: '7px 9px',
  fontSize: 13.5,
  fontWeight: 400,
} as const;

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
            style={{
              border: 0,
              background: '#3DD68C',
              borderRadius: 12,
              padding: '12px 18px',
              fontSize: 14.5,
              fontWeight: 800,
              color: '#1E2333',
              cursor: onayda ? 'default' : 'pointer',
              opacity: sorunlar.length ? 0.6 : 1,
            }}
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
        <div
          className="k-ok"
          role="status"
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}
        >
          <span style={{ flex: '1 1 300px' }}>
            s.{v.taslak?.surum} onay bekliyor; değerler onaylanana ya da geri çekilene kadar kilitli. Onay
            kuyruğundan onaylayabilir ya da buradan geri çekip düzenlemeye devam edebilirsin.
          </span>
          {yazabilir ? (
            <button
              type="button"
              className="k-btn-line"
              disabled={busy}
              onClick={() => void geriCek()}
              style={{ fontSize: 13, padding: '6px 12px' }}
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
        <div
          role="note"
          style={{
            background: '#FFF6DF',
            color: '#5A3D00',
            border: '1px solid #F4DC9A',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13.5,
            marginBottom: 12,
          }}
        >
          Uyarı (gönderilebilir): {uyarilar.join(' · ')}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <section style={{ ...kart, padding: '16px 18px' }} aria-labelledby="renk">
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 4,
              }}
            >
              <h2 id="renk" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                Renkler
              </h2>
              {yazabilir && !onayda ? (
                <button
                  type="button"
                  className="k-btn-line"
                  style={{ fontSize: 12.5, padding: '5px 10px' }}
                  onClick={() => set({ renkler: { ...DEFAULT_DESIGN.renkler } })}
                >
                  Renkleri varsayılana döndür
                </button>
              ) : null}
            </div>
            {renkGruplari.map(([grup, liste]) => (
              <div key={grup}>
                <h3
                  style={{
                    margin: '14px 0 8px',
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#5A6073',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {grup}
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: 12,
                  }}
                >
                  {liste.map((r) => (
                    <div key={r.key} style={{ minWidth: 0 }}>
                      <label
                        style={{
                          display: 'block',
                          height: 56,
                          borderRadius: 12,
                          background: R[r.key],
                          border: '1px solid #E3E6EF',
                          cursor: yazabilir ? 'pointer' : 'default',
                          position: 'relative',
                        }}
                      >
                        <span className="sr-only">{r.ad} rengini seç</span>
                        <input
                          type="color"
                          value={R[r.key]}
                          disabled={!yazabilir || onayda}
                          onChange={(e) => set({ renkler: { ...R, [r.key]: e.target.value.toUpperCase() } })}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            opacity: 0,
                            width: '100%',
                            height: '100%',
                          }}
                        />
                      </label>
                      <div style={{ fontSize: 13, fontWeight: 800, marginTop: 6 }}>{r.ad}</div>
                      <input
                        aria-label={`${r.ad} kodu`}
                        value={R[r.key]}
                        disabled={!yazabilir || onayda}
                        maxLength={7}
                        onChange={(e) =>
                          /^#[0-9A-Fa-f]{0,6}$/.test(e.target.value) &&
                          set({ renkler: { ...R, [r.key]: e.target.value.toUpperCase() } })
                        }
                        style={{ ...girdi, padding: '2px 6px', fontSize: 12, width: 90, marginTop: 2 }}
                      />
                      <div style={{ fontSize: 11.5, color: '#5A6073', marginTop: 2 }}>
                        {colorNote(r.key, d)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section style={{ ...kart, padding: '16px 18px' }} aria-labelledby="yazi">
            <h2 id="yazi" style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 800 }}>
              Yazı, köşe ve logo
            </h2>
            {(
              [
                [
                  'Yazı tipi',
                  <span
                    key="f"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}
                  >
                    <select
                      aria-label="Yazı tipi"
                      value={d.yaziTipi}
                      disabled={!yazabilir || onayda}
                      onChange={(e) => set({ yaziTipi: e.target.value })}
                      style={{ ...girdi, maxWidth: 260 }}
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
                    <span style={{ fontFamily: font, fontSize: 14, color: '#3A4052' }}>
                      Çağrı, ılık şöför İğdır’da güzel Ü ğ ş ı İ ö ç ·{' '}
                      <b style={{ fontWeight: 800 }}>320i M Sport</b>
                    </span>
                  </span>,
                ],
                [
                  'Köşeler',
                  <span key="h" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {KOSE_HAZIR.map((h) => {
                      const secili =
                        d.kartKose === h.kartKose &&
                        d.butonKose === h.butonKose &&
                        d.etiketKose === h.etiketKose;
                      return (
                        <button
                          key={h.ad}
                          type="button"
                          className="k-btn-line"
                          aria-pressed={secili}
                          disabled={!yazabilir || onayda}
                          onClick={() =>
                            set({ kartKose: h.kartKose, butonKose: h.butonKose, etiketKose: h.etiketKose })
                          }
                          style={{
                            fontSize: 12.5,
                            padding: '5px 10px',
                            background: secili ? '#EEF3FF' : undefined,
                            borderColor: secili ? '#5B8CFF' : undefined,
                          }}
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
              <div
                key={ad}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '6px 14px',
                  padding: '9px 0',
                  borderTop: '1px solid #EEF0F5',
                  fontSize: 13.5,
                }}
              >
                <span style={{ fontWeight: 700 }}>{ad}</span>
                {typeof x === 'string' ? (
                  <span style={{ color: '#3A4052', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="range"
                      aria-label={`${ad} kaydırıcı`}
                      min={0}
                      max={ust}
                      value={d[x as 'kartKose' | 'butonKose']}
                      disabled={!yazabilir || onayda}
                      onChange={(e) => set({ [x]: Number(e.target.value) })}
                      style={{ width: 140 }}
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
                      style={{ ...girdi, width: 64 }}
                    />{' '}
                    px
                  </span>
                ) : (
                  x
                )}
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 14,
                padding: '9px 0',
                borderTop: '1px solid #EEF0F5',
                fontSize: 13.5,
              }}
            >
              <span style={{ fontWeight: 700 }}>Etiket köşesi</span>
              <label style={{ color: '#3A4052', display: 'flex', gap: 6, alignItems: 'center' }}>
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
                      style={{ width: 110 }}
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
                      style={{ ...girdi, width: 56 }}
                    />{' '}
                    px
                  </>
                ) : null}
              </label>
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: '6px 14px',
                padding: '9px 0',
                borderTop: '1px solid #EEF0F5',
                fontSize: 13.5,
              }}
            >
              <span style={{ flex: '1 1 100%', fontSize: 12.5, color: '#5A6073', margin: '-4px 0 6px' }}>
                Sitedeki ve uygulamadaki bütün köşeler bu üç değere oranla değişir; 0 seçilirse köşeler
                tamamen kalkar. Avatar ve nokta gibi tam daireler değişmez.
              </span>
              <span style={{ fontWeight: 700 }}>Logo</span>
              <span style={{ color: '#3A4052' }}>
                Dört renkli çubuk + “rengarenk” · SVG, koyu ve açık sürüm
              </span>
            </div>
          </section>

          <section style={{ ...kart, overflow: 'hidden' }} aria-labelledby="mevsim">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                padding: '16px 18px',
                borderBottom: '1px solid #EEF0F5',
              }}
            >
              <h2 id="mevsim" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                Mevsimsel temalar
              </h2>
              {yazabilir && !onayda ? (
                <button
                  type="button"
                  className="k-btn-line"
                  style={{ fontSize: 13, padding: '6px 12px' }}
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
                <div key={t.id} style={{ borderBottom: '1px solid #EEF0F5' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '8px 16px',
                      padding: '12px 18px',
                    }}
                  >
                    <span style={{ flex: '999 1 260px', minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{t.ad}</span>
                      <span style={{ display: 'block', fontSize: 12.5, color: '#3A4052', marginTop: 2 }}>
                        {satir?.tarihler ?? `${t.baslangic} – ${t.bitis}`}
                        {t.rozet ? ` · rozet “${t.rozet}”` : ''}
                        {t.not ? ` · ${t.not}` : ''}
                      </span>
                    </span>
                    <span
                      style={{
                        flex: 'none',
                        fontSize: 12,
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: renk?.bg,
                        color: renk?.fg,
                      }}
                    >
                      {durum}
                    </span>
                    {yazabilir && !onayda ? (
                      <button
                        type="button"
                        className="k-btn-line"
                        style={{ fontSize: 12.5, padding: '5px 10px' }}
                        aria-expanded={acikTema === t.id}
                        onClick={() => setAcikTema(acikTema === t.id ? null : t.id)}
                      >
                        Düzenle
                      </button>
                    ) : null}
                  </div>
                  {acikTema === t.id ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                        gap: 10,
                        padding: '0 18px 14px',
                        fontSize: 12.5,
                        fontWeight: 700,
                      }}
                    >
                      <label>
                        Ad
                        <input
                          value={t.ad}
                          maxLength={60}
                          onChange={(e) => temaSet(t.id, { ad: e.target.value })}
                          style={{ ...girdi, display: 'block', width: '100%' }}
                        />
                      </label>
                      <label>
                        Başlangıç
                        <input
                          type="date"
                          value={t.baslangic}
                          onChange={(e) => temaSet(t.id, { baslangic: e.target.value })}
                          style={{ ...girdi, display: 'block', width: '100%' }}
                        />
                      </label>
                      <label>
                        Bitiş (dahil)
                        <input
                          type="date"
                          value={t.bitis}
                          onChange={(e) => temaSet(t.id, { bitis: e.target.value })}
                          style={{ ...girdi, display: 'block', width: '100%' }}
                        />
                      </label>
                      <label>
                        Üst bant rengi
                        <input
                          type="color"
                          value={t.ustBant}
                          onChange={(e) => temaSet(t.id, { ustBant: e.target.value.toUpperCase() })}
                          style={{ display: 'block', width: '100%', height: 34 }}
                        />
                      </label>
                      <label>
                        Üst bant yazısı
                        <input
                          type="color"
                          value={t.ustYazi}
                          onChange={(e) => temaSet(t.id, { ustYazi: e.target.value.toUpperCase() })}
                          style={{ display: 'block', width: '100%', height: 34 }}
                        />
                      </label>
                      <label>
                        Rozet (logonun yanında)
                        <input
                          value={t.rozet}
                          maxLength={30}
                          onChange={(e) => temaSet(t.id, { rozet: e.target.value })}
                          style={{ ...girdi, display: 'block', width: '100%' }}
                        />
                      </label>
                      <label style={{ gridColumn: '1 / -1' }}>
                        Not (ör. ana sayfa bannerı Banner ve vitrin’den zamanlanır)
                        <input
                          value={t.not}
                          maxLength={160}
                          onChange={(e) => temaSet(t.id, { not: e.target.value })}
                          style={{ ...girdi, display: 'block', width: '100%' }}
                        />
                      </label>
                      <button
                        type="button"
                        className="k-btn-line"
                        style={{
                          justifySelf: 'start',
                          fontSize: 12.5,
                          padding: '5px 10px',
                          color: '#A3271F',
                        }}
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
            <label className="k-field" style={{ display: 'block' }}>
              Değişiklik notu (onay isteğinde görünür)
              <input value={not} maxLength={500} onChange={(e) => setNot(e.target.value)} />
            </label>
          ) : null}
        </div>

        <section
          style={{ ...kart, flex: '1 1 300px', maxWidth: 380, minWidth: 0, padding: '16px 18px' }}
          aria-labelledby="canli"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <h2 id="canli" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
              Önizleme
            </h2>
            {tema ? (
              <button
                type="button"
                role="switch"
                aria-checked={onizTema}
                onClick={() => setOnizTema(!onizTema)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: 0,
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#1E2333',
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 22,
                    borderRadius: 999,
                    background: onizTema ? '#3DD68C' : '#D5DAE5',
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: onizTema ? 17 : 3,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      boxShadow: '0 1px 2px rgba(30,35,51,0.3)',
                    }}
                  />
                </span>
                {tema.ad} teması
              </button>
            ) : null}
          </div>
          <div
            style={{ border: `1px solid ${R.cizgi}`, borderRadius: 16, overflow: 'hidden', fontFamily: font }}
          >
            <div
              style={{
                background: ozel ? tema.ustBant : R.kart,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {[R.mavi, R.pembe, R.sari, R.yesil].map((c, i) => (
                <span
                  key={`${c}-${['a', 'b', 'c', 'd'][i]}`}
                  style={{ width: 7, height: 16, borderRadius: 4, background: c }}
                />
              ))}
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: ozel ? tema.ustYazi : R.murekkep,
                  marginLeft: 4,
                }}
              >
                rengarenk
              </span>
              {ozel && tema.rozet ? (
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: tema.ustYazi }}>
                  {tema.rozet}
                </span>
              ) : null}
            </div>
            <div
              style={{ background: R.zemin, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <div
                style={{
                  background: ozel ? tema.ustBant : '#EEF3FF',
                  borderRadius: d.kartKose,
                  padding: 14,
                  color: ozel ? tema.ustYazi : R.murekkep,
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 800 }}>
                  {ozel ? 'Yeni yılda yeni araba' : 'Aradığın aracı yaz'}
                </div>
                <div style={{ fontSize: 12.5, marginTop: 3, opacity: 0.85 }}>
                  Aradığın aracı yaz, satıcılar sana gelsin.
                </div>
              </div>
              <div
                style={{
                  background: R.kart,
                  border: `1px solid ${R.cizgi}`,
                  borderRadius: d.kartKose,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: R.murekkep }}>
                  BMW 3 Serisi 320i · M Sport
                </div>
                <div style={{ fontSize: 12, color: R.soluk, marginTop: 2 }}>
                  2020–2023 · İstanbul · ₺1,75 – 2,05 milyon
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: d.etiketKose,
                      background: R.pembe,
                      color: R.pembeYazi,
                    }}
                  >
                    Acil arıyorum
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: d.etiketKose,
                      background: R.yesil,
                      color: R.yesilYazi,
                    }}
                  >
                    12 mesaj
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, whiteSpace: 'nowrap' }}>
                <span
                  style={{
                    background: R.mavi,
                    color: R.maviYazi,
                    fontWeight: 800,
                    fontSize: 13,
                    padding: '9px 14px',
                    borderRadius: d.butonKose,
                  }}
                >
                  Talep oluştur
                </span>
                <span
                  style={{
                    border: `1px solid ${R.cizgi}`,
                    background: R.kart,
                    color: R.murekkep,
                    fontWeight: 700,
                    fontSize: 13,
                    padding: '9px 14px',
                    borderRadius: d.butonKose,
                  }}
                >
                  Galeri ol
                </span>
                <span
                  style={{
                    background: R.sari,
                    color: R.sariYazi,
                    fontWeight: 800,
                    fontSize: 13,
                    padding: '9px 14px',
                    borderRadius: d.butonKose,
                  }}
                >
                  Hak al
                </span>
              </div>
              <span style={{ fontSize: 12.5, color: R.baglanti, fontWeight: 700 }}>Tüm talepleri gör ›</span>
            </div>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#5A6073' }}>
            Önizleme taslaktaki değerlerle çizilir. Yayına girince web siteye, mobil uygulamaya (bir sonraki
            açılışta) ve e-postalara uygulanır.
          </p>
        </section>
      </div>
    </>
  );
}
