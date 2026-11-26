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
import { cx } from '../../../lib/cx';
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
import stil from './page.module.css';

type Sekme = 'alan' | 'kural' | 'surum';

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
        <div role="status" className={stil.kutu1}>
          {bildirim}
        </div>
      ) : null}
      <div className={stil.kutu2}>
        <div>
          <h1 className={stil.baslik1}>Kategoriler ve alanlar</h1>
          <p className={stil.metin1}>
            Kod değiştirmeden kategori ve alan ekle. Her değişiklik taslakta hazırlanır, önizlenir ve dört göz
            onayıyla yayınlanır.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEkle(ekle ? null : { name: '', vertical: 'vasita', parentId: '' })}
          className={stil.dugme1}
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
          className={stil.kutu3}
        >
          <label className={stil.etiket1}>
            Kategori adı
            <input
              required
              minLength={2}
              maxLength={60}
              value={ekle.name}
              onChange={(e) => setEkle({ ...ekle, name: e.target.value })}
              className={stil.girdi1}
            />
          </label>
          <label className={stil.etiket2}>
            Dikey
            <select
              value={ekle.vertical}
              onChange={(e) => setEkle({ ...ekle, vertical: e.target.value, parentId: '' })}
              className={stil.girdi1}
            >
              {VERTICALS.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.ad}
                </option>
              ))}
            </select>
          </label>
          <label className={stil.etiket3}>
            Üst kategori
            <select
              value={ekle.parentId}
              onChange={(e) => setEkle({ ...ekle, parentId: e.target.value })}
              className={stil.girdi1}
            >
              <option value="">Yok (ana kategori)</option>
              {ustler.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy} className={stil.dugme2}>
            Taslak olarak ekle
          </button>
        </form>
      ) : null}

      <div className={stil.kutu4}>
        <section aria-label="Kategori ağacı" className={stil.kutu5}>
          {tree === null ? <p className="muted">Yükleniyor…</p> : null}
          {dikeyler.map((dk) => (
            <div key={dk}>
              {dikeyler.length > 1 && dk !== 'vasita' ? (
                <span className={stil.metin2}>{VERTICALS.find((v) => v.key === dk)?.ad}</span>
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
                      className={cx(stil.dugme3, on ? stil.dugme4 : stil.dugme5)}
                      style={{ padding: `8px 10px 8px ${k.parentId ? 26 : 10}px` }}
                    >
                      <span
                        className={cx(stil.metin3, k.enabled ? stil.metin4 : stil.metin5)}
                        style={{ fontWeight: on ? 800 : k.parentId ? 600 : 700 }}
                      >
                        {k.name}
                      </span>
                      <span className={cx(stil.metin6, k.enabled ? stil.metin7 : stil.metin8)}>
                        {k.enabled ? `${sayi(k.activeDemands)} talep` : k.published ? 'Kapalı' : 'Taslak'}
                      </span>
                    </button>
                  );
                })}
            </div>
          ))}
          <div className={stil.kutu6}>
            <strong>Yeni dikey:</strong> Emlak ve İkinci el aynı yapıyla eklenir (Karar 23). Taslak olarak
            hazırlanabilir, yayına kapalı tutulur.
          </div>
        </section>

        <section aria-labelledby="sema" className={stil.kutu7}>
          {!detay || !def || !sel ? (
            <p className={`muted ${stil.metin9}`}>{secili ? 'Yükleniyor…' : 'Kategori seç.'}</p>
          ) : (
            <>
              <div className={stil.kutu8}>
                <div className={stil.kutu9}>
                  <h2 id="sema" className={stil.baslik2}>
                    <button
                      type="button"
                      aria-label="Nokta rengi"
                      aria-expanded={renkAcik}
                      title="Menüdeki nokta rengi"
                      onClick={() => setRenkAcik(!renkAcik)}
                      className={stil.dugme6}
                      style={{ background: sel.dot }}
                    />
                    {detay.category.name}
                  </h2>
                  <div className={stil.kutu10}>
                    {detay.published ? (
                      <span className={stil.metin10}>
                        Yayında · s.{detay.published.version}
                        {detay.published.publishedAt ? ` · ${kisaTarih(detay.published.publishedAt)}` : ''}
                      </span>
                    ) : (
                      <span className={stil.metin11}>Yayında değil</span>
                    )}
                    <span className={stil.metin12}>
                      {detay.draft
                        ? `${onayda ? 'Onayda' : 'Taslak'} s.${detay.draft.version} · ${detay.draft.diff.changes.length} değişiklik`
                        : 'Taslak yok'}
                    </span>
                    <span className={stil.metin13}>
                      {detay.category.activeDemands
                        ? `${sayi(detay.category.activeDemands)} aktif talep`
                        : 'Aktif talep yok'}
                    </span>
                  </div>
                  {renkAcik ? (
                    <div className={stil.kutu11}>
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
                          className={cx(stil.dugme7, detay.category.color === c ? stil.dugme8 : stil.dugme9)}
                          style={{ background: c }}
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
                <span className={stil.metin14}>
                  {(['up', 'down'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-label={m === 'up' ? 'Yukarı taşı' : 'Aşağı taşı'}
                      disabled={busy}
                      onClick={() =>
                        islem(() => yonetim(`categories/${secili}`, { method: 'PATCH', body: { move: m } }))
                      }
                      className={stil.dugme10}
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
                    className={stil.dugme11}
                  >
                    <span className={cx(stil.metin15, detay.category.enabled ? stil.metin16 : stil.metin17)}>
                      <span
                        className={cx(stil.metin18, detay.category.enabled ? stil.metin19 : stil.metin20)}
                      />
                    </span>
                    {detay.category.enabled ? 'Kategori açık' : 'Kategori kapalı'}
                  </button>
                </span>
              </div>

              <div role="tablist" aria-label="Kategori ayarları" className={stil.kutu12}>
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
                    className={cx(stil.dugme12, sekme === k ? stil.dugme13 : stil.dugme14)}
                    style={{
                      border: 0,
                      borderBottom: `3px solid ${sekme === k ? '#5B8CFF' : 'transparent'}`,
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
                      <div key={v.version} className={stil.kutu13}>
                        <span className={stil.metin21}>s.{v.version}</span>
                        <span className={stil.metin22}>
                          <span className={stil.metin23}>
                            {v.changes.length ? v.changes.join(' · ') : 'Değişiklik yok'}
                          </span>
                          <span className={stil.metin24}>{kim}</span>
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
                            className={stil.dugme15}
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
        className={stil.kutu14}
        style={{ background: kilit ? '#FAFBFD' : rozet ? '#FFFCF3' : '#FFFFFF' }}
      >
        <span className={stil.metin25}>
          {kilit ? (
            <span className={stil.metin26}>{f.label}</span>
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
              className={cx(stil.dugme16, kilitli ? stil.dugme17 : stil.dugme18)}
            >
              {f.label}
            </button>
          )}
          {rozet ? (
            <span
              title={d?.notes.join(' · ') || undefined}
              className={stil.metin27}
              style={{
                background: kilit ? '#F3F5FA' : rozet === 'Yeni' ? '#F3EFFF' : '#FFF6DF',
                color: kilit ? '#5A6073' : rozet === 'Yeni' ? '#4B2FA6' : '#7A5300',
              }}
            >
              {rozet}
            </span>
          ) : null}
        </span>
        <span className={stil.metin28}>{FIELD_TYPE_NAMES[f.type]}</span>
        {kilit ? (
          <>
            <span className={stil.metin29}>{f.required ? '✓' : '–'}</span>
            <span className={stil.metin29}>{f.filter ? '✓' : '–'}</span>
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
        <span className={stil.metin30} title={matchHint(f)}>
          {matchLabel(f)}
        </span>
        <span className={stil.metin31}>{sourceLabel(f)}</span>
      </div>
    );
  };

  const agirlikSec = [2, 4, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40].filter((w) => w <= MAX_WEIGHT);

  return (
    <>
      <div className={stil.kutu15}>
        <span>Alan</span>
        <span>Tip</span>
        <span className={stil.metin32}>Zorunlu</span>
        <span className={stil.metin32}>Filtrede</span>
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
        <p className={stil.metin33}>
          Bu kategoride talep alt kategoriden açılır; alanlar alt kategorilerin sayfasında.
        </p>
      ) : null}

      {form ? (
        <form onSubmit={p.alanKaydet} className={stil.kutu16}>
          <label className={stil.etiket4}>
            Alan adı
            <input
              required
              minLength={2}
              maxLength={80}
              value={form.label}
              placeholder="Örn. Sunroof"
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className={stil.girdi1}
            />
          </label>
          <label className={stil.etiket2}>
            Tip
            <select
              value={form.type}
              disabled={sistemTipi}
              onChange={(e) => {
                const type = e.target.value as CategoryField['type'];
                setForm({ ...form, type, eslesme: type === 'text' ? 'none' : form.eslesme });
              }}
              className={stil.girdi1}
            >
              {sistemTipi ? <option value={form.type}>{FIELD_TYPE_NAMES[form.type]}</option> : null}
              {EDITABLE_FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_NAMES[t]}
                </option>
              ))}
            </select>
          </label>
          <label className={stil.etiket2}>
            Eşleşmede
            <select
              value={form.eslesme}
              disabled={form.type === 'text'}
              onChange={(e) => setForm({ ...form, eslesme: e.target.value })}
              className={stil.girdi1}
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
            <label className={stil.etiket5}>
              Seçenekler (virgülle ayır)
              <input
                required
                value={form.secenekler}
                placeholder="Örn. Cam tavan, Açılır tavan"
                onChange={(e) => setForm({ ...form, secenekler: e.target.value })}
                className={stil.girdi1}
              />
            </label>
          ) : null}
          {form.type === 'number' || form.type === 'range' ? (
            <label className={stil.etiket6}>
              Birim
              <input
                maxLength={12}
                value={form.unit}
                placeholder="km"
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className={stil.girdi1}
              />
            </label>
          ) : null}
          <button type="submit" disabled={kilitli} className={stil.dugme2}>
            {form.key ? 'Taslağa kaydet' : 'Taslağa ekle'}
          </button>
          {form.key ? (
            <button
              type="button"
              className={`k-link ${stil.dugme19}`}
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

      <div className={stil.kutu17}>
        <span className={stil.metin34}>
          <button
            type="button"
            disabled={kilitli}
            onClick={() => setForm(form && !form.key ? null : YENI_ALAN)}
            className={stil.dugme20}
          >
            Alan ekle
          </button>
          <button type="button" onClick={() => p.setOnizleme(!p.onizleme)} className={stil.dugme20}>
            {p.onizleme ? 'Önizlemeyi kapat' : 'Önizle'}
          </button>
        </span>
        {detay.draft?.status === 'PENDING' ? (
          <Link href="/onaylar" className={stil.bag1}>
            {onay?.status === 'APPROVED'
              ? 'Onaylandı · yayına alınıyor'
              : 'Sahip veya yönetici onayında · dört göz'}
          </Link>
        ) : detay.draft ? (
          <span className={stil.metin35}>
            {detay.published ? (
              <button type="button" className="k-link" disabled={kilitli} onClick={p.sil}>
                Taslağı sil
              </button>
            ) : null}
            <button
              type="button"
              disabled={kilitli || (degisim === 0 && !detay.draft.restoredFrom)}
              onClick={p.gonder}
              className={stil.dugme21}
            >
              Yayına gönder · {degisim} değişiklik
            </button>
          </span>
        ) : null}
      </div>
      <p className={stil.metin36}>
        Kilitli satırlar taban şemadan gelir ve tüm kategorilerde ortaktır. Yayındaki talepler eski sürümle
        kalır; yeni alan onlar için “belirtilmemiş” sayılır.
      </p>

      {p.onizleme ? (
        <div className={stil.kutu18}>
          <div className={stil.kutu19}>
            <span className={stil.metin37}>Önizleme · talep sihirbazı, 3. adım</span>
            <span className={stil.metin38}>
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
                  className={cx(p.cihaz === k ? stil.dugme22 : stil.dugme23)}
                >
                  {ad}
                </button>
              ))}
            </span>
          </div>
          <div className={cx(stil.kutu20, p.cihaz === 'mobil' ? stil.kutu21 : stil.kutu22)}>
            <div className={stil.kutu23}>Aradığın aracın özellikleri</div>
            <div
              className={stil.kutu24}
              style={{ gridTemplateColumns: `repeat(${p.cihaz === 'mobil' ? 1 : 3}, minmax(0, 1fr))` }}
            >
              {onizAlan.map((f) => {
                const yeni = diff[f.key]?.status === 'yeni';
                return (
                  <div key={f.key} className={stil.kutu9}>
                    <div className={stil.kutu25}>
                      {f.label}
                      {f.required ? ' *' : ''}
                    </div>
                    <div
                      className={cx(stil.kutu26, yeni ? stil.kutu27 : stil.kutu28)}
                      style={{ border: `1px solid ${yeni ? '#9B7BFF' : '#D5DAE5'}` }}
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
  const satir = (ad: string, not: string, el: ReactNode) => (
    <div key={ad} className={stil.kutu13}>
      <span className={stil.metin22}>
        <span className={stil.metin39}>{ad}</span>
        <span className={stil.metin24}>{not}</span>
      </span>
      {el}
    </div>
  );
  const sayiKutusu = (k: 'listingDays' | 'freeFirstMessages', min: number, max: number, ek?: string) => (
    <span className={stil.metin40}>
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
        className={stil.girdi2}
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
          className={stil.girdi3}
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
          className={stil.girdi4}
        />,
      )}
      {satir(
        'Galeri için zorunlu doğrulama',
        'Bu kategoride ilk mesaj gönderebilmek için',
        <span className={stil.metin41}>
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
                className={cx(stil.dugme24, on ? stil.dugme25 : stil.dugme26)}
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
          className={stil.girdi3}
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
