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
import { yonetim } from '../../../lib/istemci';
import { currentDefinition, type Detail, type TreeRow } from '../../../lib/kategori';
import { useKonsol } from '../kabuk';

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
        <div
          role="status"
          style={{
            marginBottom: 14,
            background: '#E7FAF0',
            border: '1px solid #B9EBD1',
            borderRadius: 12,
            padding: '11px 14px',
            fontSize: 13.5,
            fontWeight: 700,
            color: '#11683F',
          }}
        >
          {bildirim}
        </div>
      ) : null}
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
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Eşleştirme ayarı · {kat?.name ?? ''}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
            Ağırlıkları değiştir, yayından önce gerçek bir talep üzerinde sonucunu gör.{' '}
            <label style={{ fontWeight: 700, color: '#1E2333', whiteSpace: 'nowrap' }}>
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
                style={{
                  border: '1px solid #D5DAE5',
                  borderRadius: 8,
                  padding: '3px 6px',
                  font: 'inherit',
                  fontWeight: 600,
                  background: '#FFFFFF',
                }}
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
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {onayda ? (
            <Link href="/onaylar" style={{ fontSize: 13.5, fontWeight: 800, color: '#7A5300' }}>
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
        <p className="k-note" style={{ marginTop: 0 }}>
          Taslakta {detay.draft.diff.changes.length} değişiklik var; yayına gönderince alan değişiklikleri de
          birlikte gider. <Link href={`/kategoriler?k=${kat?.slug ?? ''}`}>Kategoriler ve alanlar</Link>
        </p>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section
          aria-labelledby="agirlik"
          style={{
            flex: '1 1 320px',
            maxWidth: 380,
            minWidth: 0,
            background: '#FFFFFF',
            border: '1px solid #E3E6EF',
            borderRadius: 18,
            overflow: 'hidden',
          }}
        >
          <h2 id="agirlik" style={{ margin: 0, padding: '16px 18px 4px', fontSize: 17, fontWeight: 800 }}>
            Ağırlıklar
          </h2>
          <p style={{ margin: 0, padding: '0 18px 10px', fontSize: 12.5, color: '#5A6073' }}>
            Toplam {toplam} · skor, ağırlıklı uyumun yüzdesidir.
          </p>
          {!def ? (
            <p className="muted" style={{ padding: '0 18px 14px' }}>
              Yükleniyor…
            </p>
          ) : null}
          {satirlar.map((f) => {
            const y = yayinW.get(f.key) ?? 0;
            const df = f.weight - y;
            const set = (d: number) =>
              def && kaydet(agirlikla(def, f.key, Math.max(0, Math.min(MAX_WEIGHT, f.weight + d))));
            return (
              <div
                key={f.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 18px',
                  borderTop: '1px solid #EEF0F5',
                }}
              >
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700 }}>
                  {f.matchName ?? f.label}
                  <span
                    style={{
                      display: 'block',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: df ? '#7A5300' : '#5A6073',
                    }}
                  >
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
                <span style={{ flex: '0 0 30px', textAlign: 'center', fontSize: 15, fontWeight: 800 }}>
                  {f.weight}
                </span>
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
          <div
            style={{
              padding: '12px 18px',
              borderTop: '1px solid #EEF0F5',
              background: '#F6F8FD',
              fontSize: 12.5,
              lineHeight: 1.55,
              color: '#3A4052',
            }}
          >
            <strong>Sert koşullar</strong> skordan önce uygulanır: konum (alıcının seçtiği il veya mesafe),
            bütçe üst sınırı (%5 tolerans), alıcı “kesin” dediyse vites ve yakıt.
            {/* Konum kapsamı (tasarıma ek; Teknik tasarım §6 komşu il 0,5) */}
            <label style={{ display: 'block', marginTop: 8, fontWeight: 700, color: '#1E2333' }}>
              Konum{' '}
              <select
                value={def?.konumKapsami ?? 'il'}
                disabled={busy || onayda || !def}
                onChange={(e) => def && kaydet({ ...def, konumKapsami: e.target.value as LocationScope })}
                style={{
                  border: '1px solid #D5DAE5',
                  borderRadius: 8,
                  padding: '3px 6px',
                  font: 'inherit',
                  fontWeight: 600,
                  background: '#FFFFFF',
                  maxWidth: '100%',
                }}
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

        <section
          aria-labelledby="deneme"
          style={{
            flex: '999 1 480px',
            minWidth: 0,
            background: '#FFFFFF',
            border: '1px solid #E3E6EF',
            borderRadius: 18,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #EEF0F5' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <h2 id="deneme" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                Deneme alanı
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Number.parseInt(talepNo, 10);
                  setAranan(Number.isFinite(n) && n > 0 ? n : undefined);
                }}
                style={{ display: 'flex', gap: 6 }}
              >
                <input
                  aria-label="Talep no"
                  inputMode="numeric"
                  placeholder="Talep no"
                  value={talepNo}
                  onChange={(e) => setTalepNo(e.target.value.replace(/\D/g, ''))}
                  style={{
                    width: 120,
                    border: '1px solid #D5DAE5',
                    borderRadius: 10,
                    padding: '7px 10px',
                    fontSize: 13.5,
                  }}
                />
                <button type="submit" style={{ ...ikincil, padding: '7px 12px', fontSize: 13 }}>
                  Göster
                </button>
              </form>
            </div>
            <div
              style={{
                marginTop: 10,
                background: '#F6F8FD',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: 13.5,
                lineHeight: 1.5,
              }}
            >
              {deneme?.talep ? (
                <>
                  <strong>
                    Talep No {deneme.talep.no} · {deneme.talep.baslik}
                  </strong>
                  <span style={{ display: 'block', color: '#3A4052' }}>
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
                  <span style={{ display: 'block', color: '#3A4052' }}>
                    Deneme alanı gerçek bir talebi seçip sert koşullara uyan portföy araçlarının skorunu bu
                    ayarla ve yayındaki ayarla yan yana gösterir.
                  </span>
                </>
              )}
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 13, color: '#3A4052' }}>
              Galeriye “sana uygun talep” bildirimi eşiği:{' '}
              <strong>skor %{deneme?.esik ?? def?.rules.matchThreshold ?? 80}</strong>
              {deneme?.talep
                ? ` · bu ayarla bu talep için ${deneme.bildirim.yeni} galeri bildirim alır (yayındaki ayarla ${deneme.bildirim.eski}).`
                : ''}
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '34px minmax(0, 2.6fr) minmax(0, 2fr) 70px 70px',
              gap: 8,
              padding: '10px 18px',
              background: '#F3F5FA',
              fontSize: 11.5,
              fontWeight: 800,
              color: '#5A6073',
              textTransform: 'uppercase',
              letterSpacing: 0.3,
            }}
          >
            <span>Sıra</span>
            <span>Portföy aracı</span>
            <span>Skor</span>
            <span style={{ textAlign: 'right' }}>Yayında</span>
            <span style={{ textAlign: 'right' }}>Değişim</span>
          </div>
          {deneme?.talep && !deneme.adaylar.length ? (
            <p style={{ margin: 0, padding: '14px 18px', fontSize: 13, color: '#5A6073' }}>
              Bu talebin sert koşullarına uyan yayında portföy aracı yok.
            </p>
          ) : null}
          {(deneme?.adaylar ?? []).map((c) => {
            const esik = deneme?.esik ?? 80;
            const fark = c.eskiSira - c.sira;
            return (
              <div
                key={c.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '34px minmax(0, 2.6fr) minmax(0, 2fr) 70px 70px',
                  gap: 8,
                  alignItems: 'center',
                  padding: '11px 18px',
                  borderTop: '1px solid #EEF0F5',
                  fontSize: 13,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 800 }}>{c.sira}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 800 }}>{c.ad}</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#5A6073' }}>{c.detay}</span>
                </span>
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  title={`${c.ad}: yeni skor %${c.skor}, yayında %${c.eski}`}
                >
                  <span
                    style={{
                      flex: 1,
                      height: 10,
                      background: '#F3F5FA',
                      borderRadius: '0 4px 4px 0',
                      position: 'relative',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${c.skor}%`,
                        background: c.skor >= esik ? '#2450C8' : '#A9C2FF',
                        borderRadius: '0 4px 4px 0',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        top: -3,
                        bottom: -3,
                        left: `${esik}%`,
                        width: 2,
                        background: '#1E2333',
                      }}
                    />
                  </span>
                  <span style={{ flex: '0 0 42px', fontWeight: 800 }}>%{c.skor}</span>
                </span>
                <span style={{ textAlign: 'right', color: '#5A6073' }}>
                  %{c.eski} · {c.eskiSira}.
                </span>
                <span
                  style={{
                    textAlign: 'right',
                    fontWeight: 800,
                    color: fark > 0 ? '#11683F' : fark < 0 ? '#A3271F' : '#5A6073',
                  }}
                >
                  {fark > 0 ? `▲ ${fark}` : fark < 0 ? `▼ ${-fark}` : '—'}
                </span>
              </div>
            );
          })}
          <p
            style={{
              margin: 0,
              padding: '12px 18px',
              fontSize: 12.5,
              color: '#5A6073',
              borderTop: '1px solid #EEF0F5',
            }}
          >
            Siyah çizgi bildirim eşiğidir; koyu mavi çubuklar eşiği geçen araçlardır. Yayın, sahip veya
            yönetici onayıyla yapılır ve işlem kaydına girer.
          </p>
        </section>
      </div>
    </>
  );
}
