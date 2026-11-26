'use client';

import { APPLICATION_CHECKS, BUSINESS_KIND_DEFS, type BusinessKindKey } from '@rengarenk/shared';
import { useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { goreli, yonetim } from '../../../lib/istemci';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

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
        className={stil.kutu1}
      >
        <label htmlFor={`gerekce-${s.id}`} className={stil.etiket1}>
          {form.tur === 'request-docs'
            ? 'İstenen belge (başvurana gösterilir)'
            : 'Gerekçe (başvurana gösterilir)'}
        </label>
        <div className={stil.kutu2}>
          {HAZIR.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setForm({ ...form, metin: h })}
              className={stil.dugme1}
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
          className={stil.girdi1}
        />
        <div className={stil.kutu3}>
          <button
            type="submit"
            disabled={busy === s.id || form.metin.trim().length < 10}
            className={cx(stil.dugme2, form.tur === 'request-docs' ? stil.dugme3 : stil.dugme4)}
          >
            {form.tur === 'request-docs' ? 'Belge iste' : form.tur === 'revoke' ? 'Onayı geri al' : 'Reddet'}
          </button>
          <button type="button" onClick={() => setForm(null)} className={stil.dugme5}>
            Vazgeç
          </button>
        </div>
      </form>
    ) : null;

  const ayrintiBolumu = (id: string) => {
    const a = acik[id];
    if (!a) return null;
    if (a === 'yukleniyor') return <p className={stil.metin1}>Yükleniyor…</p>;
    const belgeAd = (k: string) =>
      (a.veri.tur ? BUSINESS_KIND_DEFS[a.veri.tur].belgeler.find((b) => b.key === k)?.ad : null) ?? k;
    return (
      <div className={stil.kutu4}>
        <dl className={stil.liste1}>
          {ALANLAR.filter(([k]) => a.veri[k]).map(([k, ad]) => (
            <div key={k} className={stil.kutu5}>
              <dt className={stil.metin2}>{ad}</dt>
              <dd className={stil.metin3}>{String(a.veri[k])}</dd>
            </div>
          ))}
          <dt className={stil.metin2}>Hesap sahibi</dt>
          <dd className={stil.metin3}>
            {[a.veri.sahip?.ad, a.veri.sahip?.soyad].filter(Boolean).join(' ')} · {a.veri.sahip?.gorev} ·{' '}
            {a.veri.sahip?.eposta}
          </dd>
        </dl>
        <div className={stil.kutu6}>
          <span className={stil.etiket1}>Belgeler</span>
          {a.belgeler.map((b) => (
            <a
              key={b.id}
              href={`/api/yonetim/gallery-applications/${id}/documents/${b.id}`}
              target="_blank"
              rel="noreferrer"
              className={stil.bag1}
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
      <div className={stil.kutu7}>
        <h1 className={stil.baslik1}>Galeri başvuruları</h1>
        <p className={stil.metin4}>
          Tüm kontroller geçerse ajan onaylar ve sana bildirir; diğerleri burada seni bekler.
        </p>
      </div>
      {hata ? (
        <p className="k-error" role="alert">
          {hata}
        </p>
      ) : null}
      {bilgi ? (
        <p role="status" className={stil.metin5}>
          {bilgi}
        </p>
      ) : null}

      <section className={stil.kutu8} aria-labelledby="bekleyen">
        <h2 id="bekleyen" className={stil.baslik2}>
          Sana bırakılanlar · {insanda.length}
        </h2>
        {veri && bekleyen.length === 0 ? <p className={stil.metin6}>Bekleyen başvuru yok.</p> : null}
        {bekleyen.map((b) => (
          <article key={b.id} className={stil.kutu9}>
            <div className={stil.kutu10}>
              <span>
                <span className={stil.metin7}>{b.ad}</span>
                <span className={stil.metin8}>{alt(b, b.gonderildi, 'başvuru')}</span>
              </span>
              {b.durum === 'SUBMITTED' ? (
                <span className={stil.metin9}>Kontroller çalışıyor…</span>
              ) : (
                <span className={stil.metin10}>
                  {b.durum === 'DOCS_REQUESTED' ? (
                    <span className={stil.metin11}>Belge istendi · başvuran bekleniyor</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setForm({ id: b.id, tur: 'request-docs', metin: '' })}
                      className={stil.dugme5}
                    >
                      Belge iste
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setForm({ id: b.id, tur: 'reject', metin: '' })}
                    className={stil.dugme6}
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
                    className={stil.dugme7}
                  >
                    Onayla
                  </button>
                </span>
              )}
            </div>
            <div className={stil.kutu11}>
              {APPLICATION_CHECKS.map((c) => {
                const k = b.kontroller.find((x) => x.key === c.key);
                if (!k) return null;
                const [isaret, bg, fg] = CIP[k.sonuc];
                return (
                  <span
                    key={c.key}
                    title={k.not ?? ''}
                    className={stil.metin12}
                    style={{ background: bg, color: fg }}
                  >
                    {isaret} {c.ad}
                  </span>
                );
              })}
              <button
                type="button"
                onClick={() => ayrinti(b.id)}
                aria-expanded={Boolean(acik[b.id])}
                className={stil.dugme8}
              >
                {acik[b.id] ? 'Ayrıntıları gizle' : 'Ayrıntılar ve belgeler'}
              </button>
            </div>
            {b.ajan ? (
              <p className={stil.metin13}>
                <strong>Ajan:</strong> {b.ajan}
              </p>
            ) : null}
            {b.not && b.durum === 'DOCS_REQUESTED' ? <p className={stil.metin14}>İstenen: {b.not}</p> : null}
            {ayrintiBolumu(b.id)}
            {gerekceFormu(b)}
          </article>
        ))}
      </section>

      <section className={stil.kutu12} aria-labelledby="ajanonay">
        <h2 id="ajanonay" className={stil.baslik2}>
          Ajanın onayladıkları · son 7 gün
        </h2>
        {veri && veri.ajan.length === 0 ? (
          <p className={stil.metin6}>Son 7 günde ajanın onayladığı başvuru yok.</p>
        ) : null}
        {(veri?.ajan ?? []).map((a) => (
          <div key={a.id} className={cx(stil.kutu13, a.durum === 'REVOKED' ? stil.kutu14 : stil.kutu15)}>
            <div className={stil.kutu16}>
              <span className={stil.metin15}>
                <span className={stil.metin16}>{a.ad}</span>
                <span className={stil.metin17}>{alt(a, a.karar, '')}</span>
              </span>
              <span className={stil.metin18}>
                {a.kontroller.filter((k) => k.sonuc === 'gecti').length}/{APPLICATION_CHECKS.length} kontrol
                geçti
              </span>
              {a.durum === 'APPROVED' ? (
                <button
                  type="button"
                  onClick={() => setForm({ id: a.id, tur: 'revoke', metin: '' })}
                  className={stil.dugme9}
                >
                  Onayı geri al
                </button>
              ) : (
                <span className={stil.metin19}>Geri alındı · galeri bilgilendirildi</span>
              )}
            </div>
            {gerekceFormu(a)}
          </div>
        ))}
      </section>
    </>
  );
}
