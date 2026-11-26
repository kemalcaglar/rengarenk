'use client';

import {
  BASE_WEIGHTED,
  type CategoryDefinition,
  effectiveFields,
  LOCATION_SCOPE_NAMES,
  LOCATION_SCOPES,
  type LocationScope,
  MAX_WEIGHT,
} from '@rengarenk/shared';
import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { cx } from '../../../lib/cx';
import { yonetim } from '../../../lib/istemci';
import { currentDefinition, type Detail, type TreeRow } from '../../../lib/kategori';
import { useKonsol } from '../kabuk';
import stil from './page.module.css';

const ADIM = 2;

interface Deneme {
  talep: {
    no: number;
    baslik: string;
    il: string | null;
    butceMin: number | null;
    butceMax: number | null;
    yilMin: number | null;
    yilMax: number | null;
  } | null;
  esik: number;
  bildirim: { yeni: number; eski: number };
  adaylar: {
    id: string;
    ad: string;
    detay: string;
    skor: number;
    eski: number;
    sira: number;
    eskiSira: number;
  }[];
}

const tl = (n: number) => `₺${new Intl.NumberFormat('tr-TR').format(n)}`;

/** Pasif düğme soluk görünür */
const pasif = (off: boolean): CSSProperties => (off ? { opacity: 0.5, cursor: 'default' } : {});

const ikincil: CSSProperties = {
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 12,
  padding: '10px 14px',
  fontSize: 14,
  fontWeight: 700,
  color: '#1E2333',
  cursor: 'pointer',
};
const kare: CSSProperties = {
  flex: 'none',
  width: 30,
  height: 30,
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 8,
  fontSize: 16,
  fontWeight: 800,
  color: '#1E2333',
  cursor: 'pointer',
};

/** Tanımdaki bir alanın (ya da taban alanın) ağırlığını değiştirir. */
function agirlikla(def: CategoryDefinition, key: string, weight: number): CategoryDefinition {
  if ((BASE_WEIGHTED as readonly string[]).includes(key)) {
    return { ...def, baseWeights: { ...def.baseWeights, [key]: weight } };
  }
  return { ...def, fields: def.fields.map((f) => (f.key === key ? { ...f, weight } : f)) };
}

/**
 * Eşleştirme ayarı (tasarım: YonetimIcerik › Eşleştirme ayarı; Karar 45, Teknik tasarım §6). Ağırlıklar kategori
 * şemasının parçasıdır: değişiklik taslağa yazılır ve kategoriyle aynı dört göz onayıyla yayına girer.
 */
export default function Eslestirme() {
  const { refresh } = useKonsol();
  const [tree, setTree] = useState<TreeRow[] | null>(null);
  const [secili, setSecili] = useState<string | null>(null);
  const [detay, setDetay] = useState<Detail | null>(null);
  const [bildirim, setBildirim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id: string) => setDetay(await yonetim<Detail>(`categories/${id}`)), []);

  useEffect(() => {
    yonetim<TreeRow[]>('categories')
      .then((t) => {
        // Alanı olan (alt kategorisi olmayan) kategoriler; ilk sırada Otomobil
        const list = t.filter((c) => !c.hasChildren);
        setTree(list);
        const q = new URLSearchParams(window.location.search).get('k');
        setSecili(list.find((c) => c.slug === q)?.id ?? list[0]?.id ?? null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (secili) load(secili).catch((e: Error) => setError(e.message));
  }, [secili, load]);

  async function islem(fn: () => Promise<unknown>, mesaj?: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (mesaj) setBildirim(mesaj);
      if (secili) await load(secili);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const def = detay ? currentDefinition(detay) : null;
  const yayindaki = detay?.published?.definition ?? null;
  const onayda = detay?.draft?.status === 'PENDING';
  const kat = tree?.find((c) => c.id === secili);

  const yayinW = new Map(yayindaki ? effectiveFields(yayindaki).map((f) => [f.key, f.weight]) : []);
  const satirlar = def
    ? effectiveFields(def)
        .filter((f) => f.weight > 0 || (yayinW.get(f.key) ?? 0) > 0)
        .sort((a, b) => (yayinW.get(b.key) ?? b.weight) - (yayinW.get(a.key) ?? a.weight))
    : [];
  const toplam = satirlar.reduce((s, f) => s + f.weight, 0);
  const degisti = satirlar.some((f) => f.weight !== (yayinW.get(f.key) ?? 0));

  // Deneme alanı: taslak ağırlıklarla ve yayındaki ayarla aynı talep, motorla aynı işlev (Teknik tasarım §6)
  const [deneme, setDeneme] = useState<Deneme | null>(null);
  const [talepNo, setTalepNo] = useState('');
  const [aranan, setAranan] = useState<number | undefined>(undefined);
  const defJson = def ? JSON.stringify(def) : '';
  useEffect(() => {
    if (!secili || !defJson) return;
    const t = setTimeout(() => {
      yonetim<Deneme>(`categories/${secili}/matching/simulate`, {
        method: 'POST',
        body: { definition: JSON.parse(defJson), ...(aranan ? { talepNo: aranan } : {}) },
      })
        .then(setDeneme)
        .catch((e: Error) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [secili, defJson, aranan]);

  const kaydet = (next: CategoryDefinition) =>
    islem(() => yonetim(`categories/${secili}/draft`, { method: 'PUT', body: next }));

  return (
    <>
      {bildirim ? (
        <div role="status" className={stil.kutu1}>
          {bildirim}
        </div>
      ) : null}
      <div className={stil.kutu2}>
        <div>
          <h1 className={stil.baslik1}>Eşleştirme ayarı · {kat?.name ?? ''}</h1>
          <p className={stil.metin1}>
            Ağırlıkları değiştir, yayından önce gerçek bir talep üzerinde sonucunu gör.{' '}
            <label className={stil.etiket1}>
              Kategori{' '}
              <select
                value={secili ?? ''}
                onChange={(e) => {
                  setSecili(e.target.value);
                  setBildirim('');
                  window.history.replaceState(
                    null,
                    '',
                    `?k=${tree?.find((c) => c.id === e.target.value)?.slug ?? ''}`,
                  );
                }}
                className={stil.girdi1}
              >
                {(tree ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </p>
        </div>
        <span className={stil.metin2}>
          {onayda ? (
            <Link href="/onaylar" className={stil.bag1}>
              {detay?.draft?.approval?.status === 'APPROVED'
                ? 'Onaylandı · yayına alınıyor'
                : 'Sahip veya yönetici onayında · dört göz'}
            </Link>
          ) : (
            <>
              <button
                type="button"
                disabled={busy || !def || !yayindaki || !degisti}
                onClick={() => {
                  if (!def || !yayindaki) return;
                  let next = def;
                  for (const f of satirlar) next = agirlikla(next, f.key, yayinW.get(f.key) ?? 0);
                  kaydet(next);
                }}
                style={{ ...ikincil, ...pasif(busy || !def || !yayindaki || !degisti) }}
              >
                Yayındaki ayara dön
              </button>
              <button
                type="button"
                disabled={busy || !detay?.draft}
                onClick={() =>
                  islem(
                    () => yonetim(`categories/${secili}/draft/submit`, { method: 'POST' }),
                    'Eşleştirme ayarı onaya gönderildi. Yayına girince yalnızca yeni ve güncellenen taleplere uygulanır.',
                  )
                }
                style={{
                  border: 0,
                  background: '#3DD68C',
                  borderRadius: 12,
                  padding: '10px 16px',
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#1E2333',
                  cursor: 'pointer',
                  ...pasif(busy || !detay?.draft),
                }}
              >
                Yayına gönder
              </button>
            </>
          )}
        </span>
      </div>
      {error ? (
        <p className="k-error" role="alert">
          {error}
        </p>
      ) : null}
      {detay?.draft && !onayda && (detay.draft.diff.changes.length ?? 0) > 0 ? (
        <p className={`k-note ${stil.metin3}`}>
          Taslakta {detay.draft.diff.changes.length} değişiklik var; yayına gönderince alan değişiklikleri de
          birlikte gider. <Link href={`/kategoriler?k=${kat?.slug ?? ''}`}>Kategoriler ve alanlar</Link>
        </p>
      ) : null}

      <div className={stil.kutu3}>
        <section aria-labelledby="agirlik" className={stil.kutu4}>
          <h2 id="agirlik" className={stil.baslik2}>
            Ağırlıklar
          </h2>
          <p className={stil.metin4}>Toplam {toplam} · skor, ağırlıklı uyumun yüzdesidir.</p>
          {!def ? <p className={`muted ${stil.metin5}`}>Yükleniyor…</p> : null}
          {satirlar.map((f) => {
            const y = yayinW.get(f.key) ?? 0;
            const df = f.weight - y;
            const set = (d: number) =>
              def && kaydet(agirlikla(def, f.key, Math.max(0, Math.min(MAX_WEIGHT, f.weight + d))));
            return (
              <div key={f.key} className={stil.kutu5}>
                <span className={stil.metin6}>
                  {f.matchName ?? f.label}
                  <span className={cx(stil.metin7, df ? stil.metin8 : stil.metin9)}>
                    {df ? `yayında ${y} · ${df > 0 ? '+' : ''}${df}` : 'yayındaki değer'}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label="Azalt"
                  disabled={busy || onayda || f.weight === 0}
                  onClick={() => set(-ADIM)}
                  style={{ ...kare, ...pasif(onayda || f.weight === 0) }}
                >
                  −
                </button>
                <span className={stil.metin10}>{f.weight}</span>
                <button
                  type="button"
                  aria-label="Artır"
                  disabled={busy || onayda || f.weight >= MAX_WEIGHT}
                  onClick={() => set(ADIM)}
                  style={{ ...kare, ...pasif(onayda || f.weight >= MAX_WEIGHT) }}
                >
                  +
                </button>
              </div>
            );
          })}
          <div className={stil.kutu6}>
            <strong>Sert koşullar</strong> skordan önce uygulanır: konum (alıcının seçtiği il veya mesafe),
            bütçe üst sınırı (%5 tolerans), alıcı “kesin” dediyse vites ve yakıt.
            {/* Konum kapsamı (tasarıma ek; Teknik tasarım §6 komşu il 0,5) */}
            <label className={stil.etiket2}>
              Konum{' '}
              <select
                value={def?.konumKapsami ?? 'il'}
                disabled={busy || onayda || !def}
                onChange={(e) => def && kaydet({ ...def, konumKapsami: e.target.value as LocationScope })}
                className={stil.girdi2}
              >
                {LOCATION_SCOPES.map((k) => (
                  <option key={k} value={k}>
                    {LOCATION_SCOPE_NAMES[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section aria-labelledby="deneme" className={stil.kutu7}>
          <div className={stil.kutu8}>
            <div className={stil.kutu9}>
              <h2 id="deneme" className={stil.baslik3}>
                Deneme alanı
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Number.parseInt(talepNo, 10);
                  setAranan(Number.isFinite(n) && n > 0 ? n : undefined);
                }}
                className={stil.kutu10}
              >
                <input
                  aria-label="Talep no"
                  inputMode="numeric"
                  placeholder="Talep no"
                  value={talepNo}
                  onChange={(e) => setTalepNo(e.target.value.replace(/\D/g, ''))}
                  className={stil.girdi3}
                />
                <button type="submit" className={stil.dugme1}>
                  Göster
                </button>
              </form>
            </div>
            <div className={stil.kutu11}>
              {deneme?.talep ? (
                <>
                  <strong>
                    Talep No {deneme.talep.no} · {deneme.talep.baslik}
                  </strong>
                  <span className={stil.metin11}>
                    {[
                      deneme.talep.yilMin || deneme.talep.yilMax
                        ? `${deneme.talep.yilMin ?? ''}–${deneme.talep.yilMax ?? ''}`
                        : null,
                      deneme.talep.butceMax
                        ? `${deneme.talep.butceMin ? `${tl(deneme.talep.butceMin)} – ` : ''}${tl(deneme.talep.butceMax)}`
                        : null,
                      deneme.talep.il,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </>
              ) : (
                <>
                  <strong>{deneme ? 'Bu kategoride yayında talep yok' : 'Yükleniyor…'}</strong>
                  <span className={stil.metin11}>
                    Deneme alanı gerçek bir talebi seçip sert koşullara uyan portföy araçlarının skorunu bu
                    ayarla ve yayındaki ayarla yan yana gösterir.
                  </span>
                </>
              )}
            </div>
            <p className={stil.metin12}>
              Galeriye “sana uygun talep” bildirimi eşiği:{' '}
              <strong>skor %{deneme?.esik ?? def?.rules.matchThreshold ?? 80}</strong>
              {deneme?.talep
                ? ` · bu ayarla bu talep için ${deneme.bildirim.yeni} galeri bildirim alır (yayındaki ayarla ${deneme.bildirim.eski}).`
                : ''}
            </p>
          </div>
          <div className={stil.kutu12}>
            <span>Sıra</span>
            <span>Portföy aracı</span>
            <span>Skor</span>
            <span className={stil.metin13}>Yayında</span>
            <span className={stil.metin13}>Değişim</span>
          </div>
          {deneme?.talep && !deneme.adaylar.length ? (
            <p className={stil.metin14}>Bu talebin sert koşullarına uyan yayında portföy aracı yok.</p>
          ) : null}
          {(deneme?.adaylar ?? []).map((c) => {
            const esik = deneme?.esik ?? 80;
            const fark = c.eskiSira - c.sira;
            return (
              <div key={c.id} className={stil.kutu13}>
                <span className={stil.metin15}>{c.sira}</span>
                <span className={stil.metin16}>
                  <span className={stil.metin17}>{c.ad}</span>
                  <span className={stil.metin18}>{c.detay}</span>
                </span>
                <span className={stil.metin19} title={`${c.ad}: yeni skor %${c.skor}, yayında %${c.eski}`}>
                  <span className={stil.metin20}>
                    <span
                      className={cx(stil.metin21, c.skor >= esik ? stil.metin22 : stil.metin23)}
                      style={{ width: `${c.skor}%` }}
                    />
                    <span className={stil.metin24} style={{ left: `${esik}%` }} />
                  </span>
                  <span className={stil.metin25}>%{c.skor}</span>
                </span>
                <span className={stil.metin26}>
                  %{c.eski} · {c.eskiSira}.
                </span>
                <span
                  className={stil.metin27}
                  style={{ color: fark > 0 ? '#11683F' : fark < 0 ? '#A3271F' : '#5A6073' }}
                >
                  {fark > 0 ? `▲ ${fark}` : fark < 0 ? `▼ ${-fark}` : '—'}
                </span>
              </div>
            );
          })}
          <p className={stil.metin28}>
            Siyah çizgi bildirim eşiğidir; koyu mavi çubuklar eşiği geçen araçlardır. Yayın, sahip veya
            yönetici onayıyla yapılır ve işlem kaydına girer.
          </p>
        </section>
      </div>
    </>
  );
}
