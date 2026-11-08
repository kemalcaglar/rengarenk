'use client';

import {
  BASE_FIELDS,
  CATALOG_SOURCES,
  type CategoryDefinition,
  type CategoryField,
  type CategoryRules,
  DOTS,
  EDITABLE_FIELD_TYPES,
  effectiveFields,
  FIELD_TYPE_NAMES,
  fieldKeyFor,
  MAX_WEIGHT,
  matchHint,
  matchLabel,
  sourceLabel,
  TARIFFS,
  VERIFICATIONS,
  VERTICALS,
} from '@rengarenk/shared';
import Link from 'next/link';
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { goreli, yonetim } from '../../../lib/istemci';
import {
  currentDefinition,
  type Detail,
  kisaTarih,
  optionKey,
  SURUM_DURUM,
  sayi,
  type TreeRow,
  withField,
} from '../../../lib/kategori';
import { useKonsol } from '../kabuk';

type Sekme = 'alan' | 'kural' | 'surum';

const GRID = 'minmax(0, 2.2fr) minmax(0, 1.2fr) 70px 70px minmax(0, 1.6fr) minmax(0, 1.5fr)';

const ikincil: CSSProperties = {
  border: '1px solid #D5DAE5',
  background: '#FFFFFF',
  borderRadius: 10,
  padding: '9px 14px',
  fontSize: 13.5,
  fontWeight: 700,
  color: '#1E2333',
  cursor: 'pointer',
};
const kutu: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 4,
  border: '1px solid #D5DAE5',
  borderRadius: 10,
  padding: 9,
  fontSize: 14,
  background: '#FFFFFF',
};
const pill = (bg: string, fg: string): CSSProperties => ({
  fontSize: 12,
  fontWeight: 800,
  padding: '3px 9px',
  borderRadius: 999,
  background: bg,
  color: fg,
});

/** Hücredeki ✓ / – düğmesi: değişen hücre sarı (tasarım: YonetimIcerik `cell`). */
function hucre(v: boolean, degisti: boolean) {
  return {
    t: v ? '✓' : '–',
    bg: v ? (degisti ? '#FFF6DF' : '#E7FAF0') : '#FFFFFF',
    fg: v ? '#11683F' : '#8A91A3',
    kenar: degisti ? '#F4DC9A' : v ? '#B9EBD1' : '#D5DAE5',
  };
}

/** Eşleşmede seçenekleri: kod "none" | "w:N" | "hard" | "hw:N" | "strict" */
function eslesmeKodu(f: Pick<CategoryField, 'hard' | 'weight'>) {
  if (f.hard === 'strict') return 'strict';
  if (f.hard === 'yes') return f.weight > 0 ? `hw:${f.weight}` : 'hard';
  return f.weight > 0 ? `w:${f.weight}` : 'none';
}
function eslesmeCoz(kod: string): Pick<CategoryField, 'hard' | 'weight'> {
  if (kod === 'strict') return { hard: 'strict', weight: 0 };
  if (kod === 'hard') return { hard: 'yes', weight: 0 };
  if (kod.startsWith('hw:')) return { hard: 'yes', weight: Number(kod.slice(3)) };
  if (kod.startsWith('w:')) return { hard: 'no', weight: Number(kod.slice(2)) };
  return { hard: 'no', weight: 0 };
}

interface AlanFormu {
  /** Düzenlenen alanın kodu; boşsa yeni alan */
  key: string | null;
  label: string;
  type: CategoryField['type'];
  eslesme: string;
  secenekler: string;
  unit: string;
}

const YENI_ALAN: AlanFormu = {
  key: null,
  label: '',
  type: 'boolean',
  eslesme: 'w:2',
  secenekler: '',
  unit: '',
};

/** Yer tutucu (önizleme): tasarımdaki "En az · En çok", "Evet · Hayır · Fark etmez", "Örn. 60.000", "Seç" */
function yerTutucu(f: CategoryField) {
  if (f.type === 'range') return 'En az · En çok';
  if (f.type === 'boolean') return 'Evet  ·  Hayır  ·  Fark etmez';
  if (f.type === 'number') return f.unit === 'km' ? 'Örn. 60.000' : `Sayı${f.unit ? ` · ${f.unit}` : ''}`;
  if (f.type === 'text') return 'Yaz';
  if (f.type === 'daterange') return 'Tarih seç';
  return 'Seç';
}

/**
 * Kategoriler ve alanlar (tasarım: YonetimIcerik › Kategoriler ve alanlar; Karar 45). Değişiklik taslağa
 * kaydedilir, önizlenir ve dört göz onayıyla yayınlanır. Ağaçtaki açma, kapatma, sıra ve renk doğrudan uygulanır.
 */
export default function Kategoriler() {
  const { me, refresh } = useKonsol();
  const [tree, setTree] = useState<TreeRow[] | null>(null);
  const [secili, setSecili] = useState<string | null>(null);
  const [detay, setDetay] = useState<Detail | null>(null);
  const [sekme, setSekme] = useState<Sekme>('alan');
  const [form, setForm] = useState<AlanFormu | null>(null);
  const [onizleme, setOnizleme] = useState(false);
  const [cihaz, setCihaz] = useState<'web' | 'mobil'>('web');
  const [bildirim, setBildirim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ekle, setEkle] = useState<{ name: string; vertical: string; parentId: string } | null>(null);
  const [renkAcik, setRenkAcik] = useState(false);

  const loadTree = useCallback(async () => {
    const t = await yonetim<TreeRow[]>('categories');
    setTree(t);
    return t;
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetay(await yonetim<Detail>(`categories/${id}`));
  }, []);

  useEffect(() => {
    loadTree()
      .then((t) => {
        const q = new URLSearchParams(window.location.search).get('k');
        setSecili(t.find((c) => c.slug === q)?.id ?? t[0]?.id ?? null);
      })
      .catch((e: Error) => setError(e.message));
  }, [loadTree]);

  useEffect(() => {
    if (!secili) return;
    setDetay(null);
    loadDetail(secili).catch((e: Error) => setError(e.message));
  }, [secili, loadDetail]);

  async function islem(fn: () => Promise<unknown>, mesaj?: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (mesaj) setBildirim(mesaj);
      await Promise.all([loadTree(), secili ? loadDetail(secili) : null]);
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
  const kilitli = onayda || busy;

  const kaydet = (next: CategoryDefinition) =>
    islem(() => yonetim(`categories/${secili}/draft`, { method: 'PUT', body: next }));

  const pub = useMemo(() => new Map((yayindaki?.fields ?? []).map((f) => [f.key, f])), [yayindaki]);

  function sec(id: string) {
    setSecili(id);
    setForm(null);
    setRenkAcik(false);
    setBildirim('');
    window.history.replaceState(null, '', `?k=${tree?.find((c) => c.id === id)?.slug ?? ''}`);
  }

  async function alanKaydet(e: FormEvent) {
    e.preventDefault();
    if (!def || !form) return;
    const label = form.label.trim();
    const eski = form.key ? def.fields.find((f) => f.key === form.key) : undefined;
    const secim = form.type === 'select' || form.type === 'multiselect';
    const taken = new Set<string>();
    const options = secim
      ? form.secenekler
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((l) => {
            const was = eski?.options?.find((o) => o.label === l);
            if (was) taken.add(was.value);
            return { label: l, value: was?.value ?? '' };
          })
          .map((o) => ({ ...o, value: o.value || optionKey(o.label, taken) }))
      : undefined;
    const match = form.type === 'text' ? { hard: 'no' as const, weight: 0 } : eslesmeCoz(form.eslesme);
    const yeni: CategoryField = {
      ...(eski ?? {
        key: fieldKeyFor(
          label,
          def.fields.map((f) => f.key),
        ),
        required: false,
        filter: form.type !== 'text',
        source: secim ? 'liste' : 'alici',
        step: 'kriterler',
        scope: 'alternatif',
      }),
      label,
      type: form.type,
      ...match,
      ...(eski?.source === 'katalog' ? {} : { options }),
      unit:
        (form.type === 'number' || form.type === 'range') && form.unit.trim() ? form.unit.trim() : undefined,
    } as CategoryField;
    if (yeni.type === 'text') yeni.filter = false;
    const fields = eski ? def.fields.map((f) => (f.key === eski.key ? yeni : f)) : [...def.fields, yeni];
    await kaydet({ ...def, fields });
    setForm(null);
  }

  const kurallar = (patch: Partial<CategoryRules>) =>
    def && kaydet({ ...def, rules: { ...def.rules, ...patch } });

  const sel = tree?.find((c) => c.id === secili) ?? null;
  const ustler = (tree ?? []).filter((c) => !c.parentId && c.vertical === (ekle?.vertical ?? 'vasita'));
  const dikeyler = [...new Set((tree ?? []).map((c) => c.vertical))];

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
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Kategoriler ve alanlar</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5A6073' }}>
            Kod değiştirmeden kategori ve alan ekle. Her değişiklik taslakta hazırlanır, önizlenir ve dört göz
            onayıyla yayınlanır.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEkle(ekle ? null : { name: '', vertical: 'vasita', parentId: '' })}
          style={{
            border: '1px solid #5B8CFF',
            background: '#FFFFFF',
            borderRadius: 12,
            padding: '11px 16px',
            fontSize: 14.5,
            fontWeight: 800,
            color: '#2450C8',
            cursor: 'pointer',
          }}
        >
          Kategori ekle
        </button>
      </div>
      {error ? (
        <p className="k-error" role="alert">
          {error}
        </p>
      ) : null}
      {ekle ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            islem(async () => {
              const c = await yonetim<{ id: string; name: string }>('categories', {
                method: 'POST',
                body: {
                  name: ekle.name,
                  vertical: ekle.vertical,
                  ...(ekle.parentId ? { parentId: ekle.parentId } : {}),
                },
              });
              setEkle(null);
              setSecili(c.id);
            }, `${ekle.name.trim()} taslak olarak eklendi. Alanlarını hazırla, yayına gönder; yayına girene kadar kapalı kalır.`);
          }}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 10,
            padding: '14px 18px',
            marginBottom: 16,
            background: '#F6F8FD',
            border: '1px solid #E3E6EF',
            borderRadius: 18,
          }}
        >
          <label style={{ flex: '2 1 200px', fontSize: 12.5, fontWeight: 700 }}>
            Kategori adı
            <input
              required
              minLength={2}
              maxLength={60}
              value={ekle.name}
              onChange={(e) => setEkle({ ...ekle, name: e.target.value })}
              style={kutu}
            />
          </label>
          <label style={{ flex: '1 1 140px', fontSize: 12.5, fontWeight: 700 }}>
            Dikey
            <select
              value={ekle.vertical}
              onChange={(e) => setEkle({ ...ekle, vertical: e.target.value, parentId: '' })}
              style={kutu}
            >
              {VERTICALS.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.ad}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: '1 1 180px', fontSize: 12.5, fontWeight: 700 }}>
            Üst kategori
            <select
              value={ekle.parentId}
              onChange={(e) => setEkle({ ...ekle, parentId: e.target.value })}
              style={kutu}
            >
              <option value="">Yok (ana kategori)</option>
              {ustler.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy}
            style={{
              border: 0,
              background: '#5B8CFF',
              borderRadius: 10,
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 800,
              color: '#1E2333',
              cursor: 'pointer',
            }}
          >
            Taslak olarak ekle
          </button>
        </form>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <section
          aria-label="Kategori ağacı"
          style={{
            flex: '1 1 250px',
            maxWidth: 290,
            minWidth: 0,
            background: '#FFFFFF',
            border: '1px solid #E3E6EF',
            borderRadius: 18,
            padding: 10,
          }}
        >
          {tree === null ? <p className="muted">Yükleniyor…</p> : null}
          {dikeyler.map((dk) => (
            <div key={dk}>
              {dikeyler.length > 1 && dk !== 'vasita' ? (
                <span
                  style={{
                    display: 'block',
                    padding: '12px 10px 6px',
                    fontSize: 11.5,
                    fontWeight: 800,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: '#5A6073',
                  }}
                >
                  {VERTICALS.find((v) => v.key === dk)?.ad}
                </span>
              ) : null}
              {(tree ?? [])
                .filter((c) => c.vertical === dk)
                .map((k) => {
                  const on = k.id === secili;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => sec(k.id)}
                      aria-current={on ? 'true' : undefined}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        border: 0,
                        background: on ? '#F3EFFF' : 'transparent',
                        borderRadius: 10,
                        padding: `8px 10px 8px ${k.parentId ? 26 : 10}px`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: '#1E2333',
                      }}
                    >
                      <span
                        style={{
                          minWidth: 0,
                          fontSize: 13.5,
                          fontWeight: on ? 800 : k.parentId ? 600 : 700,
                          color: k.enabled ? '#1E2333' : '#8A91A3',
                        }}
                      >
                        {k.name}
                      </span>
                      <span
                        style={{
                          flex: 'none',
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: k.enabled ? '#5A6073' : '#A3271F',
                        }}
                      >
                        {k.enabled ? `${sayi(k.activeDemands)} talep` : k.published ? 'Kapalı' : 'Taslak'}
                      </span>
                    </button>
                  );
                })}
            </div>
          ))}
          <div
            style={{
              margin: '8px 4px 2px',
              padding: 10,
              border: '1.5px dashed #D5DAE5',
              borderRadius: 12,
              fontSize: 12.5,
              color: '#3A4052',
            }}
          >
            <strong>Yeni dikey:</strong> Emlak ve İkinci el aynı yapıyla eklenir (Karar 23). Taslak olarak
            hazırlanabilir, yayına kapalı tutulur.
          </div>
        </section>

        <section
          aria-labelledby="sema"
          style={{
            flex: '999 1 560px',
            minWidth: 0,
            background: '#FFFFFF',
            border: '1px solid #E3E6EF',
            borderRadius: 18,
            overflow: 'hidden',
          }}
        >
          {!detay || !def || !sel ? (
            <p className="muted" style={{ padding: 18 }}>
              {secili ? 'Yükleniyor…' : 'Kategori seç.'}
            </p>
          ) : (
            <>
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
                <div style={{ minWidth: 0 }}>
                  <h2
                    id="sema"
                    style={{
                      margin: 0,
                      fontSize: 19,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      aria-label="Nokta rengi"
                      aria-expanded={renkAcik}
                      title="Menüdeki nokta rengi"
                      onClick={() => setRenkAcik(!renkAcik)}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 999,
                        border: 0,
                        padding: 0,
                        background: sel.dot,
                        cursor: 'pointer',
                        flex: 'none',
                      }}
                    />
                    {detay.category.name}
                  </h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {detay.published ? (
                      <span style={pill('#E7FAF0', '#11683F')}>
                        Yayında · s.{detay.published.version}
                        {detay.published.publishedAt ? ` · ${kisaTarih(detay.published.publishedAt)}` : ''}
                      </span>
                    ) : (
                      <span style={pill('#F3F5FA', '#5A6073')}>Yayında değil</span>
                    )}
                    <span style={pill('#FFF6DF', '#7A5300')}>
                      {detay.draft
                        ? `${onayda ? 'Onayda' : 'Taslak'} s.${detay.draft.version} · ${detay.draft.diff.changes.length} değişiklik`
                        : 'Taslak yok'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#5A6073', padding: '3px 0' }}>
                      {detay.category.activeDemands
                        ? `${sayi(detay.category.activeDemands)} aktif talep`
                        : 'Aktif talep yok'}
                    </span>
                  </div>
                  {renkAcik ? (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 10,
                      }}
                    >
                      {DOTS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Renk ${c}`}
                          aria-pressed={detay.category.color === c}
                          onClick={() =>
                            islem(() =>
                              yonetim(`categories/${secili}`, { method: 'PATCH', body: { color: c } }),
                            )
                          }
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            background: c,
                            cursor: 'pointer',
                            border: detay.category.color === c ? '2px solid #1E2333' : '2px solid #FFFFFF',
                            boxShadow: '0 0 0 1px #D5DAE5',
                          }}
                        />
                      ))}
                      <button
                        type="button"
                        className="k-link"
                        onClick={() =>
                          islem(() =>
                            yonetim(`categories/${secili}`, { method: 'PATCH', body: { color: null } }),
                          )
                        }
                      >
                        Sıradaki renk
                      </button>
                    </div>
                  ) : null}
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(['up', 'down'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-label={m === 'up' ? 'Yukarı taşı' : 'Aşağı taşı'}
                      disabled={busy}
                      onClick={() =>
                        islem(() => yonetim(`categories/${secili}`, { method: 'PATCH', body: { move: m } }))
                      }
                      style={{
                        flex: 'none',
                        width: 30,
                        height: 30,
                        border: '1px solid #D5DAE5',
                        background: '#FFFFFF',
                        borderRadius: 8,
                        fontSize: 13,
                        color: '#1E2333',
                        cursor: 'pointer',
                      }}
                    >
                      {m === 'up' ? '↑' : '↓'}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={detay.category.enabled}
                    disabled={busy}
                    title={detay.published ? undefined : 'Açmak için önce bir sürümü yayınla'}
                    onClick={() =>
                      islem(() =>
                        yonetim(`categories/${secili}`, {
                          method: 'PATCH',
                          body: { enabled: !detay.category.enabled },
                        }),
                      )
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      border: 0,
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: '#1E2333',
                      marginLeft: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 40,
                        height: 24,
                        borderRadius: 999,
                        background: detay.category.enabled ? '#3DD68C' : '#D5DAE5',
                        position: 'relative',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 3,
                          left: detay.category.enabled ? 19 : 3,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: '#FFFFFF',
                          boxShadow: '0 1px 2px rgba(30,35,51,0.3)',
                        }}
                      />
                    </span>
                    {detay.category.enabled ? 'Kategori açık' : 'Kategori kapalı'}
                  </button>
                </span>
              </div>

              <div
                role="tablist"
                aria-label="Kategori ayarları"
                style={{ display: 'flex', gap: 4, padding: '0 12px', borderBottom: '1px solid #EEF0F5' }}
              >
                {(
                  [
                    ['alan', 'Alanlar'],
                    ['kural', 'Kategori kuralları'],
                    ['surum', 'Sürümler'],
                  ] as const
                ).map(([k, ad]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={sekme === k}
                    onClick={() => setSekme(k)}
                    style={{
                      border: 0,
                      borderBottom: `3px solid ${sekme === k ? '#5B8CFF' : 'transparent'}`,
                      background: 'transparent',
                      padding: '11px 10px',
                      fontSize: 14,
                      fontWeight: sekme === k ? 800 : 600,
                      color: sekme === k ? '#1E2333' : '#3A4052',
                      cursor: 'pointer',
                    }}
                  >
                    {ad}
                  </button>
                ))}
              </div>

              {sekme === 'alan' ? (
                <Alanlar
                  def={def}
                  pub={pub}
                  detay={detay}
                  kilitli={kilitli}
                  form={form}
                  setForm={setForm}
                  onizleme={onizleme}
                  setOnizleme={setOnizleme}
                  cihaz={cihaz}
                  setCihaz={setCihaz}
                  kaydet={kaydet}
                  alanKaydet={alanKaydet}
                  gonder={() =>
                    islem(
                      () => yonetim(`categories/${secili}/draft/submit`, { method: 'POST' }),
                      `${detay.category.name} şeması s.${detay.draft?.version} onaya gönderildi. Onaylanınca yayına girer; ${
                        detay.published
                          ? `yayındaki ${detay.category.activeDemands ? `${sayi(detay.category.activeDemands)} talep` : 'talepler'} s.${detay.published.version} ile kalır.`
                          : 'kategori yayına girince açabilirsin.'
                      }`,
                    )
                  }
                  sil={() =>
                    islem(
                      () => yonetim(`categories/${secili}/draft`, { method: 'DELETE' }),
                      'Taslak silindi.',
                    )
                  }
                />
              ) : null}

              {sekme === 'kural' ? <Kurallar rules={def.rules} kilitli={kilitli} kaydet={kurallar} /> : null}

              {sekme === 'surum' ? (
                <div>
                  {detay.versions.map((v) => {
                    const d = SURUM_DURUM[v.status];
                    const kim =
                      v.status === 'DRAFT' || v.status === 'PENDING'
                        ? `${v.createdBy?.id === me.id ? 'Sen' : (v.createdBy?.name ?? 'Çalışan')} · ${goreli(v.updatedAt)}`
                        : v.createdBy
                          ? `Hazırlayan ${v.createdBy.id === me.id ? 'Sen' : v.createdBy.name}${
                              v.publishedBy
                                ? ` · onaylayan ${v.publishedBy.id === me.id ? 'Sen' : v.publishedBy.name}`
                                : ''
                            } · ${kisaTarih(v.publishedAt ?? v.createdAt)}`
                          : `İlk kurulum · ${kisaTarih(v.publishedAt ?? v.createdAt)}`;
                    return (
                      <div
                        key={v.version}
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '8px 16px',
                          padding: '13px 18px',
                          borderTop: '1px solid #EEF0F5',
                        }}
                      >
                        <span style={{ flex: '0 0 60px', fontSize: 15, fontWeight: 800 }}>s.{v.version}</span>
                        <span style={{ flex: '999 1 280px', minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>
                            {v.changes.length ? v.changes.join(' · ') : 'Değişiklik yok'}
                          </span>
                          <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>
                            {kim}
                          </span>
                        </span>
                        <span style={{ flex: 'none', ...pill(d.bg, d.fg) }}>{d.ad}</span>
                        {v.status === 'RETIRED' ? (
                          <button
                            type="button"
                            disabled={kilitli}
                            onClick={() =>
                              islem(async () => {
                                const r = await yonetim<{ version: number }>(
                                  `categories/${secili}/versions/${v.version}/restore`,
                                  { method: 'POST' },
                                );
                                setBildirim(
                                  `s.${v.version} taslağa alındı (s.${r.version}). Yayına girmesi için Alanlar'dan onaya gönder.`,
                                );
                              })
                            }
                            style={{ ...ikincil, flex: 'none', padding: '7px 12px', fontSize: 13 }}
                          >
                            Bu sürüme dön
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </>
  );
}

function Alanlar(p: {
  def: CategoryDefinition;
  pub: Map<string, CategoryField>;
  detay: Detail;
  kilitli: boolean;
  form: AlanFormu | null;
  setForm: (f: AlanFormu | null) => void;
  onizleme: boolean;
  setOnizleme: (v: boolean) => void;
  cihaz: 'web' | 'mobil';
  setCihaz: (c: 'web' | 'mobil') => void;
  kaydet: (d: CategoryDefinition) => void;
  alanKaydet: (e: FormEvent) => void;
  gonder: () => void;
  sil: () => void;
}) {
  const { def, pub, detay, kilitli, form, setForm } = p;
  const diff = detay.draft?.diff.fields ?? {};
  const degisim = detay.draft?.diff.changes.length ?? 0;
  const tumu = effectiveFields(def);
  const secim = form && (form.type === 'select' || form.type === 'multiselect');
  const duzenlenen = form?.key ? def.fields.find((f) => f.key === form.key) : undefined;
  const sistemTipi = duzenlenen && !(EDITABLE_FIELD_TYPES as readonly string[]).includes(duzenlenen.type);
  const onay = detay.draft?.approval;
  const onizAlan = tumu.filter((f) => f.step === 'kriterler');

  const satir = (f: CategoryField, kilit: boolean) => {
    const d = diff[f.key];
    const rozet = kilit ? 'Kilitli' : d?.status === 'yeni' ? 'Yeni' : d ? 'Değişti' : '';
    const o = pub.get(f.key);
    const cz = hucre(f.required, Boolean(o && o.required !== f.required));
    const cf = hucre(f.filter, Boolean(o && o.filter !== f.filter));
    const toggle = (k: 'required' | 'filter') => p.kaydet(withField(def, f.key, { [k]: !f[k] }));
    const hucreStil = (c: ReturnType<typeof hucre>): CSSProperties => ({
      justifySelf: 'center',
      width: 34,
      height: 28,
      border: `1px solid ${c.kenar}`,
      background: c.bg,
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 800,
      color: c.fg,
      cursor: kilitli ? 'default' : 'pointer',
    });
    return (
      <div
        key={f.key}
        style={{
          display: 'grid',
          gridTemplateColumns: GRID,
          gap: 8,
          alignItems: 'center',
          padding: '9px 18px',
          borderTop: '1px solid #EEF0F5',
          fontSize: 13,
          background: kilit ? '#FAFBFD' : rozet ? '#FFFCF3' : '#FFFFFF',
        }}
      >
        <span style={{ minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          {kilit ? (
            <span style={{ fontWeight: 700, color: '#5A6073' }}>{f.label}</span>
          ) : (
            <button
              type="button"
              disabled={kilitli}
              title="Alanı düzenle"
              onClick={() =>
                setForm({
                  key: f.key,
                  label: f.label,
                  type: f.type,
                  eslesme: eslesmeKodu(f),
                  secenekler: (f.options ?? []).map((x) => x.label).join(', '),
                  unit: f.unit ?? '',
                })
              }
              style={{
                border: 0,
                background: 'transparent',
                padding: 0,
                font: 'inherit',
                fontWeight: 700,
                color: '#1E2333',
                cursor: kilitli ? 'default' : 'pointer',
                textAlign: 'left',
              }}
            >
              {f.label}
            </button>
          )}
          {rozet ? (
            <span
              title={d?.notes.join(' · ') || undefined}
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: 999,
                background: kilit ? '#F3F5FA' : rozet === 'Yeni' ? '#F3EFFF' : '#FFF6DF',
                color: kilit ? '#5A6073' : rozet === 'Yeni' ? '#4B2FA6' : '#7A5300',
              }}
            >
              {rozet}
            </span>
          ) : null}
        </span>
        <span style={{ color: '#3A4052' }}>{FIELD_TYPE_NAMES[f.type]}</span>
        {kilit ? (
          <>
            <span style={{ textAlign: 'center', fontWeight: 800, color: '#8A91A3' }}>
              {f.required ? '✓' : '–'}
            </span>
            <span style={{ textAlign: 'center', fontWeight: 800, color: '#8A91A3' }}>
              {f.filter ? '✓' : '–'}
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-pressed={f.required}
              aria-label="Zorunlu"
              disabled={kilitli}
              onClick={() => toggle('required')}
              style={hucreStil(cz)}
            >
              {cz.t}
            </button>
            <button
              type="button"
              aria-pressed={f.filter}
              aria-label="Filtrede"
              disabled={kilitli || f.type === 'text'}
              onClick={() => toggle('filter')}
              style={hucreStil(cf)}
            >
              {cf.t}
            </button>
          </>
        )}
        <span style={{ color: '#1E2333', fontWeight: 600 }} title={matchHint(f)}>
          {matchLabel(f)}
        </span>
        <span style={{ fontSize: 12, color: '#5A6073' }}>{sourceLabel(f)}</span>
      </div>
    );
  };

  const agirlikSec = [2, 4, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40].filter((w) => w <= MAX_WEIGHT);

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID,
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
        <span>Alan</span>
        <span>Tip</span>
        <span style={{ textAlign: 'center' }}>Zorunlu</span>
        <span style={{ textAlign: 'center' }}>Filtrede</span>
        <span>Eşleşmede</span>
        <span>Kaynak</span>
      </div>
      {tumu.map((f) =>
        satir(
          f,
          BASE_FIELDS.some((b) => b.key === f.key),
        ),
      )}
      {detay.category.hasChildren && def.fields.length === 0 ? (
        <p
          style={{
            margin: 0,
            padding: '12px 18px',
            borderTop: '1px solid #EEF0F5',
            fontSize: 13,
            color: '#3A4052',
          }}
        >
          Bu kategoride talep alt kategoriden açılır; alanlar alt kategorilerin sayfasında.
        </p>
      ) : null}

      {form ? (
        <form
          onSubmit={p.alanKaydet}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 10,
            padding: '14px 18px',
            borderTop: '1px solid #EEF0F5',
            background: '#F6F8FD',
          }}
        >
          <label style={{ flex: '2 1 180px', fontSize: 12.5, fontWeight: 700 }}>
            Alan adı
            <input
              required
              minLength={2}
              maxLength={80}
              value={form.label}
              placeholder="Örn. Sunroof"
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              style={kutu}
            />
          </label>
          <label style={{ flex: '1 1 140px', fontSize: 12.5, fontWeight: 700 }}>
            Tip
            <select
              value={form.type}
              disabled={sistemTipi}
              onChange={(e) => {
                const type = e.target.value as CategoryField['type'];
                setForm({ ...form, type, eslesme: type === 'text' ? 'none' : form.eslesme });
              }}
              style={kutu}
            >
              {sistemTipi ? <option value={form.type}>{FIELD_TYPE_NAMES[form.type]}</option> : null}
              {EDITABLE_FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_NAMES[t]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ flex: '1 1 140px', fontSize: 12.5, fontWeight: 700 }}>
            Eşleşmede
            <select
              value={form.eslesme}
              disabled={form.type === 'text'}
              onChange={(e) => setForm({ ...form, eslesme: e.target.value })}
              style={kutu}
            >
              {agirlikSec.map((w) => (
                <option key={w} value={`w:${w}`}>
                  Ağırlık {w}
                </option>
              ))}
              {form.eslesme.startsWith('w:') && !agirlikSec.includes(Number(form.eslesme.slice(2))) ? (
                <option value={form.eslesme}>Ağırlık {form.eslesme.slice(2)}</option>
              ) : null}
              <option value="none">Kullanılmaz</option>
              <option value="hard">Sert koşul</option>
              {form.eslesme.startsWith('hw:') ? (
                <option value={form.eslesme}>Sert koşul + ağırlık {form.eslesme.slice(3)}</option>
              ) : null}
              {secim ? <option value="strict">Sert koşul (“kesin” ise)</option> : null}
            </select>
          </label>
          {secim && duzenlenen?.source !== 'katalog' ? (
            <label style={{ flex: '3 1 260px', fontSize: 12.5, fontWeight: 700 }}>
              Seçenekler (virgülle ayır)
              <input
                required
                value={form.secenekler}
                placeholder="Örn. Cam tavan, Açılır tavan"
                onChange={(e) => setForm({ ...form, secenekler: e.target.value })}
                style={kutu}
              />
            </label>
          ) : null}
          {form.type === 'number' || form.type === 'range' ? (
            <label style={{ flex: '0 1 100px', fontSize: 12.5, fontWeight: 700 }}>
              Birim
              <input
                maxLength={12}
                value={form.unit}
                placeholder="km"
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                style={kutu}
              />
            </label>
          ) : null}
          <button
            type="submit"
            disabled={kilitli}
            style={{
              border: 0,
              background: '#5B8CFF',
              borderRadius: 10,
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 800,
              color: '#1E2333',
              cursor: 'pointer',
            }}
          >
            {form.key ? 'Taslağa kaydet' : 'Taslağa ekle'}
          </button>
          {form.key ? (
            <button
              type="button"
              className="k-link"
              style={{ color: '#A3271F', paddingBottom: 10 }}
              disabled={kilitli}
              onClick={() => {
                if (form.key) p.kaydet(withField(def, form.key, null));
                setForm(null);
              }}
            >
              Alanı kaldır
            </button>
          ) : null}
        </form>
      ) : null}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '14px 18px',
          borderTop: '1px solid #EEF0F5',
        }}
      >
        <span style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            disabled={kilitli}
            onClick={() => setForm(form && !form.key ? null : YENI_ALAN)}
            style={ikincil}
          >
            Alan ekle
          </button>
          <button type="button" onClick={() => p.setOnizleme(!p.onizleme)} style={ikincil}>
            {p.onizleme ? 'Önizlemeyi kapat' : 'Önizle'}
          </button>
        </span>
        {detay.draft?.status === 'PENDING' ? (
          <Link href="/onaylar" style={{ fontSize: 13.5, fontWeight: 800, color: '#7A5300' }}>
            {onay?.status === 'APPROVED'
              ? 'Onaylandı · yayına alınıyor'
              : 'Sahip veya yönetici onayında · dört göz'}
          </Link>
        ) : detay.draft ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {detay.published ? (
              <button type="button" className="k-link" disabled={kilitli} onClick={p.sil}>
                Taslağı sil
              </button>
            ) : null}
            <button
              type="button"
              disabled={kilitli || (degisim === 0 && !detay.draft.restoredFrom)}
              onClick={p.gonder}
              style={{
                border: 0,
                background: '#3DD68C',
                borderRadius: 10,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 800,
                color: '#1E2333',
                cursor: 'pointer',
              }}
            >
              Yayına gönder · {degisim} değişiklik
            </button>
          </span>
        ) : null}
      </div>
      <p style={{ margin: 0, padding: '0 18px 14px', fontSize: 12.5, color: '#5A6073' }}>
        Kilitli satırlar taban şemadan gelir ve tüm kategorilerde ortaktır. Yayındaki talepler eski sürümle
        kalır; yeni alan onlar için “belirtilmemiş” sayılır.
      </p>

      {p.onizleme ? (
        <div style={{ borderTop: '1px solid #EEF0F5', background: '#F6F8FD', padding: '16px 18px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 800 }}>Önizleme · talep sihirbazı, 3. adım</span>
            <span style={{ display: 'flex', gap: 6 }}>
              {(
                [
                  ['web', 'Web'],
                  ['mobil', 'Mobil'],
                ] as const
              ).map(([k, ad]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={p.cihaz === k}
                  onClick={() => p.setCihaz(k)}
                  style={
                    p.cihaz === k
                      ? {
                          border: 0,
                          background: '#1E2333',
                          borderRadius: 999,
                          padding: '6px 12px',
                          fontSize: 12.5,
                          fontWeight: 800,
                          color: '#FFFFFF',
                          cursor: 'pointer',
                        }
                      : {
                          border: '1px solid #D5DAE5',
                          background: '#FFFFFF',
                          borderRadius: 999,
                          padding: '5px 11px',
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: '#1E2333',
                          cursor: 'pointer',
                        }
                  }
                >
                  {ad}
                </button>
              ))}
            </span>
          </div>
          <div
            style={{
              maxWidth: p.cihaz === 'mobil' ? 360 : '100%',
              margin: '0 auto',
              background: '#FFFFFF',
              border: '1px solid #E3E6EF',
              borderRadius: 16,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Aradığın aracın özellikleri</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${p.cihaz === 'mobil' ? 1 : 3}, minmax(0, 1fr))`,
                gap: 10,
              }}
            >
              {onizAlan.map((f) => {
                const yeni = diff[f.key]?.status === 'yeni';
                return (
                  <div key={f.key} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
                      {f.label}
                      {f.required ? ' *' : ''}
                    </div>
                    <div
                      style={{
                        border: `1px solid ${yeni ? '#9B7BFF' : '#D5DAE5'}`,
                        borderRadius: 10,
                        padding: '9px 10px',
                        fontSize: 13,
                        color: '#5A6073',
                        background: yeni ? '#FAF7FF' : '#FFFFFF',
                      }}
                    >
                      {yerTutucu(f)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Kategori kuralları (tasarım: YonetimIcerik › Kategori kuralları). Değer taslağa yazılır. */
function Kurallar({
  rules,
  kilitli,
  kaydet,
}: {
  rules: CategoryRules;
  kilitli: boolean;
  kaydet: (patch: Partial<CategoryRules>) => void;
}) {
  const [metin, setMetin] = useState(rules.legalNotice ?? '');
  useEffect(() => setMetin(rules.legalNotice ?? ''), [rules.legalNotice]);
  const deger: CSSProperties = {
    flex: '1 1 300px',
    boxSizing: 'border-box',
    border: '1px solid #D5DAE5',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 13.5,
    fontWeight: 600,
    background: '#FFFFFF',
    color: '#1E2333',
    fontFamily: 'inherit',
    minWidth: 0,
  };
  const satir = (ad: string, not: string, el: ReactNode) => (
    <div
      key={ad}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px 16px',
        padding: '13px 18px',
        borderTop: '1px solid #EEF0F5',
      }}
    >
      <span style={{ flex: '999 1 280px', minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 800 }}>{ad}</span>
        <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 2 }}>{not}</span>
      </span>
      {el}
    </div>
  );
  const sayiKutusu = (k: 'listingDays' | 'freeFirstMessages', min: number, max: number, ek?: string) => (
    <span style={{ ...deger, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px' }}>
      <input
        key={`${k}-${rules[k]}`}
        type="number"
        min={min}
        max={max}
        disabled={kilitli}
        defaultValue={rules[k]}
        aria-label={k}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (Number.isInteger(n) && n >= min && n <= max && n !== rules[k]) kaydet({ [k]: n });
        }}
        style={{
          width: 70,
          border: 0,
          fontSize: 13.5,
          fontWeight: 600,
          padding: '5px 0',
          fontFamily: 'inherit',
        }}
      />
      {ek}
    </span>
  );
  return (
    <div>
      {satir(
        'Yayın süresi',
        'Talep bu süre sonunda kendiliğinden kapanır; 1 ücretsiz uzatma hakkı var',
        sayiKutusu('listingDays', 1, 365, rules.listingNote ? `gün · ${rules.listingNote}` : 'gün'),
      )}
      {satir(
        'Fiyat tarifesi',
        'Üst sıra, acil arıyorum ve vitrin fiyatları',
        <select
          disabled={kilitli}
          value={rules.tariff}
          onChange={(e) => kaydet({ tariff: e.target.value as CategoryRules['tariff'] })}
          style={deger}
        >
          {TARIFFS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.ad}
            </option>
          ))}
        </select>,
      )}
      {satir(
        'Yasal uyarı metni',
        'Talep oluştururken ve galeri ilk mesajında gösterilir',
        <textarea
          disabled={kilitli}
          value={metin}
          placeholder="Yok"
          rows={metin ? 3 : 1}
          maxLength={1000}
          onChange={(e) => setMetin(e.target.value)}
          onBlur={() => {
            const v = metin.trim() || null;
            if (v !== rules.legalNotice) kaydet({ legalNotice: v });
          }}
          style={{ ...deger, resize: 'vertical' }}
        />,
      )}
      {satir(
        'Galeri için zorunlu doğrulama',
        'Bu kategoride ilk mesaj gönderebilmek için',
        <span style={{ ...deger, display: 'flex', flexWrap: 'wrap', gap: 6, padding: '7px 9px' }}>
          {VERIFICATIONS.map((v) => {
            const on = rules.verifications.includes(v.key);
            return (
              <button
                key={v.key}
                type="button"
                aria-pressed={on}
                disabled={kilitli}
                onClick={() =>
                  kaydet({
                    verifications: on
                      ? rules.verifications.filter((x) => x !== v.key)
                      : VERIFICATIONS.map((x) => x.key).filter(
                          (x) => x === v.key || rules.verifications.includes(x),
                        ),
                  })
                }
                style={{
                  border: on ? '1px solid #B9EBD1' : '1px solid #D5DAE5',
                  background: on ? '#E7FAF0' : '#FFFFFF',
                  color: on ? '#11683F' : '#3A4052',
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {v.ad}
              </button>
            );
          })}
        </span>,
      )}
      {satir(
        'Katalog kaynağı',
        'Marka, model, paket listeleri',
        <select
          disabled={kilitli}
          value={rules.catalog}
          onChange={(e) => kaydet({ catalog: e.target.value as CategoryRules['catalog'] })}
          style={deger}
        >
          {CATALOG_SOURCES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.ad}
            </option>
          ))}
        </select>,
      )}
      {satir(
        'Bireysel günlük ücretsiz ilk mesaj',
        'Galeri olmayan satıcılar için',
        sayiKutusu('freeFirstMessages', 0, 50),
      )}
    </div>
  );
}
