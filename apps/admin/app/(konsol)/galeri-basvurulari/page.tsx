'use client';

import { APPLICATION_CHECKS, BUSINESS_KIND_DEFS, type BusinessKindKey } from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { goreli, yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';

type Sonuc = 'gecti' | 'kaldi' | 'uyari' | 'yapilamadi';
interface Satir {
  id: string;
  durum: 'SUBMITTED' | 'IN_REVIEW' | 'DOCS_REQUESTED' | 'APPROVED' | 'REVOKED';
  ad: string;
  tur: string | null;
  il: string | null;
  ilce: string | null;
  gonderildi: string | null;
  karar: string | null;
  kontroller: { key: string; sonuc: Sonuc; not?: string }[];
  ajan: string | null;
  not: string | null;
}
interface Ayrinti {
  veri: Record<string, unknown> & { tur?: BusinessKindKey; sahip?: Record<string, string> };
  belgeler: { id: string; kind: string; ad: string; mime: string; boyut: number; yuklendi: string }[];
}

/** Kontrol çipleri (YonetimPazar.dc.html): ✓ geçti, ✕ kaldı, ◆ uyarı ya da yapılamadı */
const CIP: Record<Sonuc, [string, string, string]> = {
  gecti: ['✓', '#E7FAF0', '#11683F'],
  kaldi: ['✕', '#FDECEC', '#A3271F'],
  uyari: ['◆', '#FFF6DF', '#7A5300'],
  yapilamadi: ['◆', '#FFF6DF', '#7A5300'],
};

const HAZIR = [
  'Belgeler okunamıyor; daha net bir kopya gerekiyor',
  'Adres doğrulanamadı; dükkân fotoğrafı gerekiyor',
  'Ticari unvan belgelerle uyuşmuyor',
  'Yetki belgesi Bakanlık kaydında bulunamadı',
];

const ALANLAR: [string, string][] = [
  ['unvan', 'Ticari unvan'],
  ['gorunenAd', 'Platformda görünecek ad'],
  ['vergiNo', 'Vergi numarası'],
  ['vergiDairesi', 'Vergi dairesi'],
  ['mersis', 'MERSİS numarası'],
  ['yetkiNo', 'Yetki belgesi no'],
  ['adres', 'İşletme adresi'],
];

const ikincil = {
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 700,
  color: '#1E2333',
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const;

const alt = (s: Satir, zaman: string | null, ek: string) =>
  [s.tur, [s.il, s.ilce].filter(Boolean).join(', '), zaman ? `${ek} ${goreli(zaman)}` : null]
    .filter(Boolean)
    .join(' · ');

/**
 * Galeri başvuruları (tasarım: YonetimPazar › Galeri başvuruları; Karar 03, 13.1, 41): kontrollerden biri geçmeyen
 * başvurular "Sana bırakılanlar"da, kurallarla onaylananlar altta (son 7 gün) ve geri alınabilir. Tasarıma ek
 * olarak "Ayrıntılar" form bilgilerini ve belgeleri açar; ret ve belge isteğinde gerekçe yazılır.
 */
export default function GaleriBasvurulari() {
  const { refresh } = useKonsol();
  const [veri, setVeri] = useState<{ bekleyen: Satir[]; ajan: Satir[] } | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [acik, setAcik] = useState<Record<string, Ayrinti | 'yukleniyor'>>({});
  const [form, setForm] = useState<{
    id: string;
    tur: 'reject' | 'request-docs' | 'revoke';
    metin: string;
  } | null>(null);

  const yukle = useCallback(() => {
    yonetim<{ bekleyen: Satir[]; ajan: Satir[] }>('gallery-applications')
      .then(setVeri)
      .catch((e: Error) => setHata(e.message));
  }, []);
  useEffect(yukle, [yukle]);

  async function islem(id: string, yol: string, body: unknown, mesaj: string) {
    setBusy(id);
    setHata(null);
    try {
      await yonetim(`gallery-applications/${id}/${yol}`, { method: 'POST', body });
      setBilgi(mesaj);
      setForm(null);
      yukle();
      refresh();
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function ayrinti(id: string) {
    if (acik[id]) {
      setAcik(({ [id]: _, ...rest }) => rest);
      return;
    }
    setAcik((a) => ({ ...a, [id]: 'yukleniyor' }));
    try {
      const d = await yonetim<Ayrinti>(`gallery-applications/${id}`);
      setAcik((a) => ({ ...a, [id]: d }));
    } catch (e) {
      setHata((e as Error).message);
      setAcik(({ [id]: _, ...rest }) => rest);
    }
  }

  const gerekceFormu = (s: Satir) =>
    form?.id === s.id ? (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const etiket = {
            reject: 'reddedildi; gerekçe gönderildi',
            'request-docs': 'için ek belge istendi',
            revoke: 'onayı geri alındı; galeri bilgilendirildi',
          };
          islem(
            s.id,
            form.tur,
            form.tur === 'request-docs' ? { not: form.metin } : { gerekce: form.metin },
            `${s.ad} ${etiket[form.tur]}.`,
          );
        }}
        style={{ marginTop: 10, background: '#F6F8FD', borderRadius: 12, padding: 12 }}
      >
        <label
          htmlFor={`gerekce-${s.id}`}
          style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#5A6073', marginBottom: 6 }}
        >
          {form.tur === 'request-docs'
            ? 'İstenen belge (başvurana gösterilir)'
            : 'Gerekçe (başvurana gösterilir)'}
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {HAZIR.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setForm({ ...form, metin: h })}
              style={{ ...ikincil, padding: '5px 10px', fontSize: 12 }}
            >
              {h}
            </button>
          ))}
        </div>
        <textarea
          id={`gerekce-${s.id}`}
          value={form.metin}
          onChange={(e) => setForm({ ...form, metin: e.target.value })}
          rows={2}
          maxLength={500}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: '1px solid #D5DAE5',
            borderRadius: 10,
            padding: 10,
            fontSize: 14,
            fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="submit"
            disabled={busy === s.id || form.metin.trim().length < 10}
            style={{
              ...ikincil,
              border: 0,
              background: form.tur === 'request-docs' ? '#FFC84A' : '#E5484D',
              color: form.tur === 'request-docs' ? '#1E2333' : '#FFFFFF',
            }}
          >
            {form.tur === 'request-docs' ? 'Belge iste' : form.tur === 'revoke' ? 'Onayı geri al' : 'Reddet'}
          </button>
          <button type="button" onClick={() => setForm(null)} style={ikincil}>
            Vazgeç
          </button>
        </div>
      </form>
    ) : null;

  const ayrintiBolumu = (id: string) => {
    const a = acik[id];
    if (!a) return null;
    if (a === 'yukleniyor')
      return <p style={{ margin: '10px 0 0', fontSize: 13, color: '#5A6073' }}>Yükleniyor…</p>;
    const belgeAd = (k: string) =>
      (a.veri.tur ? BUSINESS_KIND_DEFS[a.veri.tur].belgeler.find((b) => b.key === k)?.ad : null) ?? k;
    return (
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          background: '#F6F8FD',
          borderRadius: 12,
          padding: 12,
        }}
      >
        <dl
          style={{
            flex: '2 1 320px',
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'max-content 1fr',
            gap: '4px 12px',
            fontSize: 13,
          }}
        >
          {ALANLAR.filter(([k]) => a.veri[k]).map(([k, ad]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt style={{ color: '#5A6073' }}>{ad}</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{String(a.veri[k])}</dd>
            </div>
          ))}
          <dt style={{ color: '#5A6073' }}>Hesap sahibi</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>
            {[a.veri.sahip?.ad, a.veri.sahip?.soyad].filter(Boolean).join(' ')} · {a.veri.sahip?.gorev} ·{' '}
            {a.veri.sahip?.eposta}
          </dd>
        </dl>
        <div style={{ flex: '1 1 220px' }}>
          <span
            style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#5A6073', marginBottom: 6 }}
          >
            Belgeler
          </span>
          {a.belgeler.map((b) => (
            <a
              key={b.id}
              href={`/api/yonetim/gallery-applications/${id}/documents/${b.id}`}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'block', fontSize: 13, fontWeight: 700, padding: '3px 0' }}
            >
              {belgeAd(b.kind)} · {b.ad} ({Math.max(1, Math.round(b.boyut / 1024))} KB)
            </a>
          ))}
        </div>
      </div>
    );
  };

  const bekleyen = veri?.bekleyen ?? [];
  const insanda = bekleyen.filter((b) => b.durum !== 'SUBMITTED');

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Galeri başvuruları</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
          Tüm kontroller geçerse ajan onaylar ve sana bildirir; diğerleri burada seni bekler.
        </p>
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
            margin: '0 0 12px',
            background: '#E7FAF0',
            color: '#11683F',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {bilgi}
        </p>
      ) : null}

      <section
        style={{ background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 18, overflow: 'hidden' }}
        aria-labelledby="bekleyen"
      >
        <h2
          id="bekleyen"
          style={{
            margin: 0,
            padding: '16px 18px',
            fontSize: 17,
            fontWeight: 800,
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          Sana bırakılanlar · {insanda.length}
        </h2>
        {veri && bekleyen.length === 0 ? (
          <p style={{ margin: 0, padding: '18px', fontSize: 14, color: '#5A6073' }}>Bekleyen başvuru yok.</p>
        ) : null}
        {bekleyen.map((b) => (
          <article key={b.id} style={{ padding: '14px 18px', borderBottom: '1px solid #EEF0F5' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{b.ad}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#3A4052', marginTop: 2 }}>
                  {alt(b, b.gonderildi, 'başvuru')}
                </span>
              </span>
              {b.durum === 'SUBMITTED' ? (
                <span style={{ fontSize: 13.5, fontWeight: 800, color: '#5A6073' }}>
                  Kontroller çalışıyor…
                </span>
              ) : (
                <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  {b.durum === 'DOCS_REQUESTED' ? (
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#7A5300' }}>
                      Belge istendi · başvuran bekleniyor
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setForm({ id: b.id, tur: 'request-docs', metin: '' })}
                      style={ikincil}
                    >
                      Belge iste
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setForm({ id: b.id, tur: 'reject', metin: '' })}
                    style={{ ...ikincil, color: '#A3271F' }}
                  >
                    Reddet
                  </button>
                  <button
                    type="button"
                    disabled={busy === b.id}
                    onClick={() =>
                      islem(
                        b.id,
                        'approve',
                        undefined,
                        `${b.ad} onaylandı; hoş geldin iletisi ve deneme süresi başladı.`,
                      )
                    }
                    style={{
                      border: 0,
                      background: '#3DD68C',
                      borderRadius: 10,
                      padding: '9px 14px',
                      fontSize: 13,
                      fontWeight: 800,
                      color: '#1E2333',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Onayla
                  </button>
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {APPLICATION_CHECKS.map((c) => {
                const k = b.kontroller.find((x) => x.key === c.key);
                if (!k) return null;
                const [isaret, bg, fg] = CIP[k.sonuc];
                return (
                  <span
                    key={c.key}
                    title={k.not ?? ''}
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: 999,
                      background: bg,
                      color: fg,
                    }}
                  >
                    {isaret} {c.ad}
                  </span>
                );
              })}
              <button
                type="button"
                onClick={() => ayrinti(b.id)}
                aria-expanded={Boolean(acik[b.id])}
                style={{
                  border: 0,
                  background: 'transparent',
                  padding: '3px 4px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#2450C8',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {acik[b.id] ? 'Ayrıntıları gizle' : 'Ayrıntılar ve belgeler'}
              </button>
            </div>
            {b.ajan ? (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: '#2E3344' }}>
                <strong>Ajan:</strong> {b.ajan}
              </p>
            ) : null}
            {b.not && b.durum === 'DOCS_REQUESTED' ? (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7A5300' }}>İstenen: {b.not}</p>
            ) : null}
            {ayrintiBolumu(b.id)}
            {gerekceFormu(b)}
          </article>
        ))}
      </section>

      <section
        style={{
          marginTop: 16,
          background: '#FFFFFF',
          border: '1px solid #E3E6EF',
          borderRadius: 18,
          overflow: 'hidden',
        }}
        aria-labelledby="ajanonay"
      >
        <h2
          id="ajanonay"
          style={{
            margin: 0,
            padding: '16px 18px',
            fontSize: 17,
            fontWeight: 800,
            borderBottom: '1px solid #EEF0F5',
          }}
        >
          Ajanın onayladıkları · son 7 gün
        </h2>
        {veri && veri.ajan.length === 0 ? (
          <p style={{ margin: 0, padding: '18px', fontSize: 14, color: '#5A6073' }}>
            Son 7 günde ajanın onayladığı başvuru yok.
          </p>
        ) : null}
        {(veri?.ajan ?? []).map((a) => (
          <div
            key={a.id}
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid #EEF0F5',
              opacity: a.durum === 'REVOKED' ? 0.6 : 1,
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px' }}>
              <span style={{ flex: '999 1 280px', minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{a.ad}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
                  {alt(a, a.karar, '')}
                </span>
              </span>
              <span style={{ flex: 'none', fontSize: 12.5, fontWeight: 700, color: '#11683F' }}>
                {a.kontroller.filter((k) => k.sonuc === 'gecti').length}/{APPLICATION_CHECKS.length} kontrol
                geçti
              </span>
              {a.durum === 'APPROVED' ? (
                <button
                  type="button"
                  onClick={() => setForm({ id: a.id, tur: 'revoke', metin: '' })}
                  style={{ ...ikincil, flex: 'none', padding: '7px 12px' }}
                >
                  Onayı geri al
                </button>
              ) : (
                <span style={{ flex: 'none', fontSize: 13, fontWeight: 700, color: '#7A5300' }}>
                  Geri alındı · galeri bilgilendirildi
                </span>
              )}
            </div>
            {gerekceFormu(a)}
          </div>
        ))}
      </section>
    </>
  );
}
