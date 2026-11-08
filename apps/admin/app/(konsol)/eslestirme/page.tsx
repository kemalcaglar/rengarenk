'use client';

import { BASE_WEIGHTED, type CategoryDefinition, effectiveFields, MAX_WEIGHT } from '@rengarenk/shared';
import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { yonetim } from '../../../lib/istemci';
import { currentDefinition, type Detail, type TreeRow } from '../../../lib/kategori';
import { useKonsol } from '../kabuk';

const ADIM = 2;

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
            <h2 id="deneme" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
              Deneme alanı
            </h2>
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
              <strong>Henüz talep ve portföy aracı yok</strong>
              <span style={{ display: 'block', color: '#3A4052' }}>
                Deneme alanı gerçek bir talebi seçip portföydeki araçların skorunu bu ayarla ve yayındaki
                ayarla yan yana gösterir. Talepler (Aşama 3) ve galeri portföyü (Aşama 4) açılınca burada
                çalışır; skor, eşleşme motoruyla aynı işlevle hesaplanır.
              </span>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 13, color: '#3A4052' }}>
              Galeriye “sana uygun talep” bildirimi eşiği:{' '}
              <strong>skor %{def?.rules.matchThreshold ?? 80}</strong>
            </p>
          </div>
          <p style={{ margin: 0, padding: '12px 18px', fontSize: 12.5, color: '#5A6073' }}>
            Yayın, sahip veya yönetici onayıyla yapılır ve işlem kaydına girer.
          </p>
        </section>
      </div>
    </>
  );
}
