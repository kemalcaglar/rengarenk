'use client';

import {
  BIREYSEL_FIYATLAR,
  type CategoryField,
  type CategoryRules,
  DOTS,
  MAX_ALTERNATIVES,
  ONE_CIKARMA,
  type PublicCategory,
} from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ApiHatasi, binlik, istek, useGiris } from '../../lib/istemci';
import { Logo } from '../logo';
import { Alan, Anahtar, Cip, etiket, Konum, kutu, secimKutusu } from './alan';
import { type BoyaDegeri, BoyaSemasi, boyaOzeti } from './boya';
import { type KatalogDegeri, katalogKategorisi, useKatalog } from './katalog';

const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0', '#F3EFFF', '#FFF0EA'];
const POPULER = ['BMW', 'Renault', 'Fiat', 'Volkswagen', 'Toyota', 'Hyundai'];

const ADIMLAR = [
  {
    key: 'kategori',
    ad: 'Kategori',
    baslik: 'Ne arıyorsun?',
    alt: 'Önce kategoriyi seç; sonraki adımlar kategoriye göre değişir.',
  },
  {
    key: 'ana_arac',
    ad: 'Ana araç',
    baslik: 'Aradığın araç hangisi?',
    alt: 'Ana araç talep boyunca sabit kalır; diğer kriterler için alternatif ekleyebilirsin.',
  },
  {
    key: 'kriterler',
    ad: 'Kriterler',
    baslik: 'Kriterlerini belirle',
    alt: 'Her alternatif için yıl, kilometre ve diğer tercihlerini ayrı ayrı gir.',
  },
  {
    key: 'boya_hasar',
    ad: 'Boya ve hasar',
    baslik: 'Boya, değişen ve hasar tercihlerin',
    alt: 'Her parça için neyi kabul ettiğini seç; şema seçimlerine göre renklenir.',
  },
  {
    key: 'konum_iletisim',
    ad: 'Konum ve iletişim',
    baslik: 'Nerede ve nasıl ulaşılsın?',
    alt: 'Konumunu ve satıcıların seninle nasıl iletişime geçeceğini belirle.',
  },
  { key: 'onizleme', ad: 'Önizleme', baslik: 'Talebini kontrol et ve yayınla', alt: '' },
] as const;
type AdimKey = (typeof ADIMLAR)[number]['key'];

type Values = Record<string, unknown>;
interface Veri {
  alanlar: Values;
  alternatifler: Values[];
}
interface Iletisim {
  phoneVisible: boolean;
  whatsappVisible: boolean;
  nameMode: 'tam' | 'kisa';
}
interface Taslak {
  id: string;
  no: number;
  status: string;
  step: number;
  category: { slug: string; name: string };
  data: Veri;
  contact: Iletisim;
  headline: string | null;
  schema: { version: number; fields: CategoryField[]; rules: CategoryRules } | null;
}
interface Haklar {
  ucretsizTalep: boolean;
  talep: number;
  telefonMaske: string;
}

const kart: CSSProperties = { background: '#FFFFFF', border: '1px solid #E3E6EF', borderRadius: 20 };

/**
 * Talep oluşturma sihirbazı (tasarım: Sihirbaz.dc.html; Karar 04, 05, 21, 32). Alanlar kategorinin yayındaki
 * şemasından gelir; her değişiklik taslağa kaydedilir ve kalınan adımdan devam edilir. Yayında API şemayla
 * doğrular ve bir talep hakkı düşer (ilk talep ücretsiz).
 */
export function Sihirbaz() {
  const giris = useGiris();
  const router = useRouter();
  const [kategoriler, setKategoriler] = useState<PublicCategory[] | null>(null);
  const [taslak, setTaslak] = useState<Taslak | null>(null);
  const [veri, setVeri] = useState<Veri>({ alanlar: {}, alternatifler: [{}] });
  const [iletisim, setIletisim] = useState<Iletisim>({
    phoneVisible: false,
    whatsappVisible: false,
    nameMode: 'tam',
  });
  const [baslik, setBaslik] = useState('');
  const [adim, setAdim] = useState<AdimKey>('kategori');
  const [alt, setAlt] = useState(0);
  const [ust, setUst] = useState<string | null>(null);
  const [kayit, setKayit] = useState<'' | 'kaydediliyor' | 'kaydedildi' | 'hata'>('');
  const [hatalar, setHatalar] = useState<{ path: string; message: string }[]>([]);
  const [uyari, setUyari] = useState<string | null>(null);
  const [haklar, setHaklar] = useState<Haklar | null>(null);
  const [busy, setBusy] = useState(false);
  const kirli = useRef(false);

  useEffect(() => {
    if (giris === false)
      router.replace(`/giris?sonra=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [giris, router]);

  const yukle = useCallback(async (id: string) => {
    const t = await istek<Taslak>(`/demands/${id}`);
    // Yayındaki ya da pasif talep "Düzenle" ile açılır (Karar 09); kapanmış talep düzenlenmez.
    if (t.status !== 'DRAFT' && t.status !== 'PUBLISHED' && t.status !== 'PASSIVE') {
      window.location.href = '/taleplerim';
      return;
    }
    setTaslak(t);
    setVeri({
      alanlar: t.data?.alanlar ?? {},
      alternatifler: t.data?.alternatifler?.length ? t.data.alternatifler : [{}],
    });
    setIletisim(t.contact);
    setBaslik(t.headline ?? '');
    setAdim(
      t.status === 'DRAFT' ? (ADIMLAR[Math.max(0, Math.min(5, t.step - 1))]?.key ?? 'ana_arac') : 'ana_arac',
    );
  }, []);

  useEffect(() => {
    if (!giris) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/categories`)
      .then((r) => r.json())
      .then((c: PublicCategory[]) => setKategoriler(c.filter((x) => x.vertical === 'vasita')))
      .catch(() => setKategoriler([]));
    istek<Haklar>('/demands/rights')
      .then(setHaklar)
      .catch(() => undefined);
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) yukle(id).catch((e: Error) => setUyari(e.message));
  }, [giris, yukle]);

  /** Yayındaki talebin düzenlenmesi: otomatik kayıt yok, kategori değişmez, son adımda "Değişiklikleri kaydet" */
  const duzenle = Boolean(taslak && taslak.status !== 'DRAFT');
  const alanlar = taslak?.schema?.fields ?? [];
  const adimAlanlari = (k: AdimKey) => alanlar.filter((f) => f.step === k);
  const gorunen = ADIMLAR.filter(
    (a) =>
      !taslak?.schema ||
      a.key === 'kategori' ||
      a.key === 'onizleme' ||
      a.key === 'kriterler' ||
      a.key === 'konum_iletisim' ||
      adimAlanlari(a.key).length > 0,
  );
  const sira = gorunen.findIndex((a) => a.key === adim);

  // Kategoride bu adımın alanı yoksa (ör. boya ve hasar) sıradaki adıma geçilir.
  useEffect(() => {
    if (taslak?.schema && sira === -1) {
      const i = ADIMLAR.findIndex((a) => a.key === adim);
      const next = ADIMLAR.slice(i).find((a) => gorunen.some((g) => g.key === a.key));
      if (next) setAdim(next.key);
    }
  });
  const tanim = ADIMLAR.find((a) => a.key === adim) ?? ADIMLAR[0];

  // Taslağı kaydet: her değişiklikten 700 ms sonra (Karar 21: yarım kalan talep taslak olarak saklanır)
  useEffect(() => {
    if (!taslak || !kirli.current || duzenle) return;
    setKayit('kaydediliyor');
    const t = setTimeout(() => {
      kirli.current = false;
      istek(`/demands/${taslak.id}`, {
        method: 'PATCH',
        body: {
          data: veri,
          contact: iletisim,
          headline: baslik.trim().length >= 5 ? baslik.trim() : null,
          step: ADIMLAR.findIndex((a) => a.key === adim) + 1,
        },
      })
        .then(() => setKayit('kaydedildi'))
        .catch(() => setKayit('hata'));
    }, 700);
    return () => clearTimeout(t);
  }, [taslak, veri, iletisim, baslik, adim, duzenle]);

  const degistir = (fn: (v: Veri) => Veri) => {
    kirli.current = true;
    setVeri((v) => fn(v));
  };
  const talepAlani = (k: string, v: unknown) =>
    degistir((d) => {
      const a = { ...d.alanlar };
      if (v === undefined) delete a[k];
      else a[k] = v;
      return { ...d, alanlar: a };
    });
  const altAlani = (k: string, v: unknown, i = alt) =>
    degistir((d) => ({
      ...d,
      alternatifler: d.alternatifler.map((x, n) => {
        if (n !== i) return x;
        const y = { ...x };
        if (v === undefined) delete y[k];
        else y[k] = v;
        return y;
      }),
    }));
  const deger = (f: CategoryField) =>
    f.scope === 'talep' ? veri.alanlar[f.key] : veri.alternatifler[alt]?.[f.key];
  const yaz = (f: CategoryField) => (v: unknown) =>
    f.scope === 'talep' ? talepAlani(f.key, v) : altAlani(f.key, v);
  const gorunur = (f: CategoryField) => {
    if (!f.when) return true;
    const v = { ...veri.alanlar, ...(veri.alternatifler[alt] ?? {}) }[f.when.field];
    if (Array.isArray(v)) return v.some((x) => f.when?.in.includes(String(x)));
    if (typeof v === 'boolean') return f.when.in.includes(v ? 'evet' : 'hayir');
    return v !== undefined && f.when.in.includes(String(v));
  };
  const hataOf = (f: CategoryField) =>
    hatalar.find(
      (h) =>
        h.path === `alanlar.${f.key}` ||
        h.path.startsWith(`alanlar.${f.key}.`) ||
        h.path === `alternatifler.${alt}.${f.key}` ||
        h.path.startsWith(`alternatifler.${alt}.${f.key}.`),
    )?.message;

  async function kategoriSec(slug: string) {
    setUyari(null);
    if (duzenle) {
      setUyari('Yayındaki talebin kategorisi değiştirilemez; başka kategoride yeni talep oluştur.');
      return;
    }
    if (taslak?.category.slug === slug) {
      git('ana_arac');
      return;
    }
    if (
      taslak &&
      Object.keys(veri.alanlar).length > 0 &&
      !window.confirm('Kategori değişirse girdiğin bilgiler silinir. Devam edilsin mi?')
    )
      return;
    setBusy(true);
    try {
      const t = taslak
        ? await istek<{ id: string }>(`/demands/${taslak.id}`, {
            method: 'PATCH',
            body: { kategori: slug, step: 2 },
          })
        : await istek<{ id: string }>('/demands', { method: 'POST', body: { kategori: slug } });
      window.history.replaceState(null, '', `/talep-olustur?id=${t.id}`);
      await yukle(t.id);
      setAdim('ana_arac');
    } catch (e) {
      setUyari((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function git(k: AdimKey) {
    if (k !== 'kategori' && !taslak) return;
    kirli.current = true;
    setAdim(k);
    window.scrollTo({ top: 0 });
  }

  async function yayinla() {
    if (!taslak) return;
    setBusy(true);
    setUyari(null);
    setHatalar([]);
    try {
      await istek(`/demands/${taslak.id}`, {
        method: 'PATCH',
        body: {
          data: veri,
          contact: iletisim,
          headline: baslik.trim().length >= 5 ? baslik.trim() : null,
          step: 6,
        },
      });
      kirli.current = false;
      if (duzenle) {
        router.push('/taleplerim');
        return;
      }
      const r = await istek<{ no: number }>(`/demands/${taslak.id}/publish`, { method: 'POST' });
      router.push(`/taleplerim?yayinlandi=${r.no}`);
    } catch (e) {
      const h = e as ApiHatasi;
      if (h.body?.issues?.length) {
        setHatalar(h.body.issues);
        // İlk hatalı alanın adımına git
        const ilk = h.body.issues[0]?.path.split('.') ?? [];
        const key = ilk[0] === 'alanlar' ? ilk[1] : ilk[2];
        if (ilk[0] === 'alternatifler') setAlt(Number(ilk[1]) || 0);
        const f = alanlar.find((x) => x.key === key);
        if (f) setAdim(f.step);
      }
      setUyari(h.message);
    } finally {
      setBusy(false);
    }
  }

  if (giris !== true) {
    return <p style={{ padding: 40, textAlign: 'center', color: '#5A6073' }}>Yükleniyor…</p>;
  }

  const kat = kategoriler?.find(
    (c) => c.slug === taslak?.category.slug || c.children.some((x) => x.slug === taslak?.category.slug),
  );
  const katUst = kat && kat.slug !== taslak?.category.slug ? kat.slug : null;

  return (
    <div style={{ background: '#F6F8FD', minHeight: '100vh' }}>
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid #E3E6EF' }}>
        <div
          style={{
            maxWidth: 1360,
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Logo />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {kayit ? (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13.5,
                  color: kayit === 'hata' ? '#A3271F' : kayit === 'kaydediliyor' ? '#5A6073' : '#11683F',
                  fontWeight: 600,
                }}
              >
                {kayit === 'kaydedildi' ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                ) : null}
                {kayit === 'kaydedildi'
                  ? 'Taslak kaydedildi'
                  : kayit === 'kaydediliyor'
                    ? 'Kaydediliyor…'
                    : 'Kaydedilemedi'}
              </span>
            ) : null}
            <Link
              href="/taleplerim"
              style={{
                fontSize: 14.5,
                fontWeight: 700,
                color: '#1E2333',
                border: '1px solid #E3E6EF',
                borderRadius: 12,
                padding: '10px 16px',
                textDecoration: 'none',
              }}
            >
              {duzenle ? 'Vazgeç' : 'Kaydet ve çık'}
            </Link>
          </div>
        </div>
      </header>

      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E3E6EF' }}>
        <ol
          aria-label="Adımlar"
          style={{
            maxWidth: 1360,
            margin: '0 auto',
            padding: '14px 24px',
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: `repeat(${gorunen.length}, minmax(0, 1fr))`,
            gap: 8,
          }}
        >
          {gorunen.map((a, i) => {
            const done = i < sira;
            const cur = i === sira;
            return (
              <li key={a.key}>
                <button
                  type="button"
                  onClick={() => git(a.key)}
                  aria-current={cur ? 'step' : undefined}
                  style={{
                    width: '100%',
                    border: 0,
                    background: 'transparent',
                    padding: '6px 0',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    fontFamily: 'inherit',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: 6,
                      borderRadius: 3,
                      background: done || cur ? '#5B8CFF' : '#E3E6EF',
                    }}
                  />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 800,
                        background: done ? '#5B8CFF' : cur ? '#FFFFFF' : '#F3F5FA',
                        color: done ? '#1E2333' : cur ? '#2450C8' : '#5A6073',
                        border: `2px solid ${done || cur ? '#5B8CFF' : '#E3E6EF'}`,
                        boxSizing: 'border-box',
                        flex: 'none',
                      }}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: cur ? 800 : 600,
                        color: cur || done ? '#1E2333' : '#5A6073',
                      }}
                    >
                      {a.ad}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <main
        style={{
          maxWidth: 1360,
          margin: '0 auto',
          padding: '28px 24px 64px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 24,
        }}
      >
        <div style={{ ...kart, flex: '999 1 640px', minWidth: 0, padding: 28 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#2450C8' }}>
            Adım {sira + 1} / {gorunen.length}
          </p>
          <h1 style={{ margin: '4px 0 6px', fontSize: 26, fontWeight: 800, letterSpacing: -0.3 }}>
            {tanim.baslik}
          </h1>
          <p style={{ margin: '0 0 24px', fontSize: 14.5, color: '#5A6073' }}>
            {adim === 'onizleme'
              ? `Her şey doğruysa talebini yayınla; ${taslak?.schema?.rules.listingDays ?? 30} gün boyunca satıcılar seni bulsun.`
              : tanim.alt}
          </p>

          {uyari ? (
            <div
              role="alert"
              style={{
                marginBottom: 18,
                background: '#FDECEC',
                border: '1px solid #F5C2BE',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: 14,
                color: '#A3271F',
                fontWeight: 600,
              }}
            >
              {uyari}
              {hatalar.length > 1 ? (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontWeight: 500 }}>
                  {hatalar.slice(0, 6).map((h) => (
                    <li key={h.path}>{h.message}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {adim === 'kategori' ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: 12,
                }}
              >
                {(kategoriler ?? []).map((c) => {
                  const sel = taslak?.category.slug === c.slug || katUst === c.slug || ust === c.slug;
                  const ti = Math.max(0, (DOTS as readonly string[]).indexOf(c.color));
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      aria-pressed={sel}
                      disabled={busy}
                      onClick={() => (c.children.length ? setUst(c.slug) : kategoriSec(c.slug))}
                      style={{
                        textAlign: 'left',
                        border: sel ? '2px solid #5B8CFF' : '1px solid #E3E6EF',
                        background: sel ? '#EEF3FF' : '#FFFFFF',
                        borderRadius: 16,
                        padding: sel ? 16 : 17,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        fontFamily: 'inherit',
                      }}
                    >
                      {sel ? (
                        <span
                          aria-hidden="true"
                          style={{ width: 34, height: 34, borderRadius: 10, background: c.color }}
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            background: TINTS[ti],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span style={{ width: 12, height: 12, borderRadius: '50%', background: c.color }} />
                        </span>
                      )}
                      <span style={{ fontSize: 15, fontWeight: sel ? 800 : 700, color: '#1E2333' }}>
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              {(() => {
                const u = kategoriler?.find((c) => c.slug === (ust ?? katUst));
                if (!u?.children.length) return null;
                return (
                  <div style={{ marginTop: 22 }}>
                    <span style={etiket}>{u.name} · alt kategori</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {u.children.map((x) => (
                        <Cip
                          key={x.slug}
                          on={taslak?.category.slug === x.slug}
                          onClick={() => kategoriSec(x.slug)}
                        >
                          {x.name}
                        </Cip>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          ) : null}

          {adim === 'ana_arac' && taslak ? (
            <AnaArac
              alanlar={adimAlanlari('ana_arac')}
              veri={veri}
              kategori={katalogKategorisi(taslak.category.slug, katUst, veri.alanlar.aracTuru)}
              deger={deger}
              yaz={yaz}
              gorunur={gorunur}
              hataOf={hataOf}
            />
          ) : null}

          {adim === 'kriterler' && taslak ? (
            <>
              <div
                role="tablist"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  borderBottom: '1px solid #E3E6EF',
                  marginBottom: 22,
                }}
              >
                {veri.alternatifler.map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: alternatiflerin kimliği sırasıdır (Alternatif 1, 2 …)
                  <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={alt === i}
                      onClick={() => setAlt(i)}
                      style={{
                        border: 0,
                        borderRadius: '12px 12px 0 0',
                        padding: '11px 18px',
                        fontSize: 14.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        marginBottom: -1,
                        background: alt === i ? '#EEF3FF' : 'transparent',
                        color: alt === i ? '#1E2333' : '#5A6073',
                        borderBottom: `3px solid ${alt === i ? '#5B8CFF' : 'transparent'}`,
                        fontFamily: 'inherit',
                      }}
                    >
                      Alternatif {i + 1}
                    </button>
                    {i > 0 && alt === i ? (
                      <button
                        type="button"
                        aria-label={`Alternatif ${i + 1} kaldır`}
                        onClick={() => {
                          degistir((d) => ({
                            ...d,
                            alternatifler: d.alternatifler.filter((_, n) => n !== i),
                          }));
                          setAlt(i - 1);
                        }}
                        style={{
                          border: 0,
                          background: 'transparent',
                          color: '#5A6073',
                          fontSize: 16,
                          cursor: 'pointer',
                          padding: '0 6px',
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                ))}
                {veri.alternatifler.length < MAX_ALTERNATIVES ? (
                  <button
                    type="button"
                    onClick={() => {
                      // Yeni alternatif bir öncekinin kopyasıyla başlar; değişeni düzeltmek yeterli
                      degistir((d) => ({
                        ...d,
                        alternatifler: [...d.alternatifler, { ...(d.alternatifler[alt] ?? {}) }],
                      }));
                      setAlt(veri.alternatifler.length);
                    }}
                    style={{
                      border: 0,
                      background: 'transparent',
                      color: '#2450C8',
                      fontWeight: 700,
                      fontSize: 14.5,
                      padding: '11px 12px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    + Alternatif ekle
                  </button>
                ) : null}
              </div>
              <Kriterler
                alanlar={adimAlanlari('kriterler')}
                veri={veri}
                alt={alt}
                kategori={katalogKategorisi(taslak.category.slug, katUst, veri.alanlar.aracTuru)}
                deger={deger}
                yaz={yaz}
                gorunur={gorunur}
                hataOf={hataOf}
              />
            </>
          ) : null}

          {adim === 'boya_hasar' && taslak ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {adimAlanlari('boya_hasar')
                .filter(gorunur)
                .map((f) =>
                  f.type === 'paint' ? (
                    <BoyaSemasi key={f.key} value={deger(f) as BoyaDegeri | undefined} onChange={yaz(f)} />
                  ) : f.key === 'islemKabul' ? (
                    <HasarGecmisi
                      key={f.key}
                      f={f}
                      value={deger(f) as string[] | undefined}
                      onChange={yaz(f)}
                    />
                  ) : (
                    <Alan key={f.key} f={f} value={deger(f)} onChange={yaz(f)} hata={hataOf(f)} />
                  ),
                )}
            </div>
          ) : null}

          {adim === 'konum_iletisim' && taslak ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                {alanlar
                  .filter((f) => f.key === 'konum')
                  .map((f) => (
                    <Konum key={f.key} f={f} value={deger(f)} onChange={yaz(f)} hata={hataOf(f)} />
                  ))}
                <div style={{ gridColumn: 'span 2' }}>
                  <label htmlFor="baslik" style={{ ...etiket, marginBottom: 6 }}>
                    Talep başlığı
                  </label>
                  <input
                    id="baslik"
                    maxLength={120}
                    value={baslik}
                    placeholder={taslak.category.name}
                    onChange={(e) => {
                      kirli.current = true;
                      setBaslik(e.target.value);
                    }}
                    style={kutu}
                  />
                </div>
                {alanlar
                  .filter((f) => f.step === 'konum_iletisim' && f.key !== 'konum' && gorunur(f))
                  .map((f) => (
                    <div key={f.key} style={{ gridColumn: f.type === 'text' ? 'span 2' : undefined }}>
                      <Alan f={f} value={deger(f)} onChange={yaz(f)} hata={hataOf(f)} />
                    </div>
                  ))}
              </div>
              <h2 style={{ margin: '26px 0 12px', fontSize: 18, fontWeight: 700 }}>
                Satıcılar sana nasıl ulaşsın?
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Satir
                  baslik="Uygulama içi mesaj"
                  alt="Her talepte açık; satıcılar tek ilk mesaj atabilir."
                  sag={
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#11683F',
                        background: '#E7FAF0',
                        padding: '5px 10px',
                        borderRadius: 999,
                      }}
                    >
                      Her zaman açık
                    </span>
                  }
                />
                <Satir
                  baslik="Telefon numaramı göster"
                  alt={`${haklar?.telefonMaske ?? 'Numaran'} · Numaran talep sayfasında giriş yapmış kullanıcılara görünür ve satıcılar mesaj limiti olmadan arayabilir.`}
                  sag={
                    <Anahtar
                      on={iletisim.phoneVisible}
                      label="Telefon numaramı göster"
                      onClick={() => {
                        kirli.current = true;
                        setIletisim((c) => ({
                          ...c,
                          phoneVisible: !c.phoneVisible,
                          whatsappVisible: c.phoneVisible ? false : c.whatsappVisible,
                        }));
                      }}
                    />
                  }
                />
                <Satir
                  baslik="WhatsApp'tan yazılabilsin"
                  alt="Yalnızca telefon numarası açıkken kullanılabilir."
                  sag={
                    <Anahtar
                      on={iletisim.whatsappVisible}
                      renk="#3DD68C"
                      label="WhatsApp'tan yazılabilsin"
                      disabled={!iletisim.phoneVisible}
                      onClick={() => {
                        kirli.current = true;
                        setIletisim((c) => ({ ...c, whatsappVisible: c.phoneVisible && !c.whatsappVisible }));
                      }}
                    />
                  }
                />
                <Satir
                  baslik="Adım talep sayfasında kısaltılsın"
                  alt="Açıksa soyadının yalnızca baş harfi görünür (ör. Ayşe Y.)."
                  sag={
                    <Anahtar
                      on={iletisim.nameMode === 'kisa'}
                      label="Adım kısaltılsın"
                      onClick={() => {
                        kirli.current = true;
                        setIletisim((c) => ({ ...c, nameMode: c.nameMode === 'kisa' ? 'tam' : 'kisa' }));
                      }}
                    />
                  }
                />
              </div>
            </>
          ) : null}

          {adim === 'onizleme' && taslak ? (
            <Onizleme
              taslak={taslak}
              veri={veri}
              baslik={baslik}
              iletisim={iletisim}
              haklar={duzenle ? null : haklar}
              duzenle={duzenle}
            />
          ) : null}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 30,
              paddingTop: 20,
              borderTop: '1px solid #EEF0F5',
            }}
          >
            {sira > 0 ? (
              <button
                type="button"
                onClick={() => git(gorunen[sira - 1]?.key ?? 'kategori')}
                style={{
                  border: '1px solid #D5DAE5',
                  background: '#FFFFFF',
                  borderRadius: 14,
                  padding: '13px 22px',
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#1E2333',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Geri
              </button>
            ) : (
              <span />
            )}
            {adim === 'onizleme' ? (
              <button
                type="button"
                disabled={busy || (!duzenle && (!haklar || haklar.talep < 1))}
                onClick={yayinla}
                style={{
                  border: 0,
                  background: '#5B8CFF',
                  borderRadius: 14,
                  padding: '14px 28px',
                  fontSize: 15.5,
                  fontWeight: 800,
                  color: '#1E2333',
                  cursor: 'pointer',
                  opacity: busy || (!duzenle && (!haklar || haklar.talep < 1)) ? 0.55 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {busy
                  ? duzenle
                    ? 'Kaydediliyor…'
                    : 'Yayınlanıyor…'
                  : duzenle
                    ? 'Değişiklikleri kaydet'
                    : haklar?.ucretsizTalep
                      ? 'Ücretsiz yayınla'
                      : 'Yayınla'}
              </button>
            ) : (
              <button
                type="button"
                disabled={!taslak || busy}
                onClick={() => git(gorunen[sira + 1]?.key ?? 'onizleme')}
                style={{
                  border: 0,
                  background: '#5B8CFF',
                  borderRadius: 14,
                  padding: '14px 28px',
                  fontSize: 15.5,
                  fontWeight: 800,
                  color: '#1E2333',
                  cursor: taslak ? 'pointer' : 'default',
                  opacity: taslak ? 1 : 0.55,
                  fontFamily: 'inherit',
                }}
              >
                Devam et
              </button>
            )}
          </div>
        </div>

        <Ozet taslak={taslak} veri={veri} iletisim={iletisim} katUst={katUst} kategoriler={kategoriler} />
      </main>
    </div>
  );
}

function Satir({ baslik, alt, sag }: { baslik: string; alt: string; sag: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        border: '1px solid #EEF0F5',
        borderRadius: 14,
        padding: '14px 16px',
      }}
    >
      <span>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{baslik}</span>
        <span style={{ display: 'block', fontSize: 13, color: '#5A6073', marginTop: 2 }}>{alt}</span>
      </span>
      {sag}
    </div>
  );
}

interface AdimProps {
  alanlar: CategoryField[];
  veri: Veri;
  kategori: string | undefined;
  deger: (f: CategoryField) => unknown;
  yaz: (f: CategoryField) => (v: unknown) => void;
  gorunur: (f: CategoryField) => boolean;
  hataOf: (f: CategoryField) => string | undefined;
}

/** 2. adım: marka > seri > model (katalog) ve kategorinin diğer ana araç alanları */
function AnaArac({ alanlar, veri, kategori, deger, yaz, gorunur, hataOf }: AdimProps) {
  const katalog = alanlar.find((f) => f.type === 'catalog');
  const v = katalog ? (veri.alanlar[katalog.key] as KatalogDegeri | undefined) : undefined;
  const k = useKatalog(katalog ? kategori : undefined, v);
  const set = (nv: KatalogDegeri | undefined) => katalog && yaz(katalog)(nv);
  const populer = (k.makes ?? []).filter((m) => POPULER.includes(m.name));
  const seriYok = k.series !== null && k.series.length === 0;
  return (
    <>
      {alanlar
        .filter((f) => f.type !== 'catalog' && gorunur(f))
        .map((f) => (
          <div key={f.key} style={{ marginBottom: 18 }}>
            <Alan f={f} value={deger(f)} onChange={yaz(f)} hata={hataOf(f)} />
          </div>
        ))}
      {katalog ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${seriYok ? 2 : 3}, minmax(0, 1fr))`,
              gap: 16,
            }}
          >
            <div>
              <label htmlFor="marka" style={{ ...etiket, marginBottom: 6 }}>
                Marka
              </label>
              <select
                id="marka"
                value={v?.make ?? ''}
                onChange={(e) => set(e.target.value ? { make: e.target.value } : undefined)}
                style={secimKutusu}
              >
                <option value="">{k.hazir ? 'Seç' : 'Yükleniyor…'}</option>
                {(k.makes ?? []).map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            {seriYok ? null : (
              <div>
                <label htmlFor="seri" style={{ ...etiket, marginBottom: 6 }}>
                  Seri
                </label>
                <select
                  id="seri"
                  value={v?.series ?? ''}
                  disabled={!v?.make}
                  onChange={(e) =>
                    v && set({ make: v.make, ...(e.target.value ? { series: e.target.value } : {}) })
                  }
                  style={secimKutusu}
                >
                  <option value="">{v?.make ? 'Tüm seriler' : 'Önce marka seç'}</option>
                  {(k.series ?? []).map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="model" style={{ ...etiket, marginBottom: 6 }}>
                Model
              </label>
              <select
                id="model"
                value={v?.model ?? ''}
                disabled={seriYok ? !v?.make : !v?.series}
                onChange={(e) => v && set({ ...v, model: e.target.value || undefined })}
                style={secimKutusu}
              >
                <option value="">
                  {(seriYok ? v?.make : v?.series)
                    ? 'Tüm modeller'
                    : seriYok
                      ? 'Önce marka seç'
                      : 'Önce seri seç'}
                </option>
                {(k.models ?? []).map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {hataOf(katalog) ? (
            <span
              role="alert"
              style={{ display: 'block', fontSize: 12.5, color: '#A3271F', fontWeight: 700, marginTop: 6 }}
            >
              {hataOf(katalog)}
            </span>
          ) : null}
          {populer.length ? (
            <>
              <p style={{ margin: '18px 0 10px', fontSize: 13.5, fontWeight: 700 }}>Popüler markalar</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {populer.map((m) => (
                  <Cip key={m.key} on={v?.make === m.key} onClick={() => set({ make: m.key })}>
                    {m.name}
                  </Cip>
                ))}
              </div>
            </>
          ) : null}
          {k.detail && k.kusaklar.length ? (
            <div
              style={{
                marginTop: 22,
                background: '#EEF3FF',
                borderRadius: 16,
                padding: '16px 18px',
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2450C8"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
                style={{ flex: 'none' }}
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
              </svg>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                  {[k.adlar.make, k.adlar.series, k.adlar.model].filter(Boolean).join(' ')} için katalogda{' '}
                  {k.kusaklar.length} kasa
                  {k.paketler.length ? ` ve ${k.paketler.length} donanım paketi` : ''} var
                </div>
                <div style={{ fontSize: 14, color: '#3A4052', marginTop: 4, lineHeight: 1.55 }}>
                  {k.kusaklar
                    .slice(-6)
                    .map((x) => `${x.label} (${x.alt})`)
                    .join(' · ')}
                  . Kasayı ve paketi bir sonraki adımda her alternatif için ayrı seçeceksin.
                </div>
              </div>
            </div>
          ) : null}
          <p style={{ margin: '16px 0 0', fontSize: 13, color: '#5A6073' }}>
            Katalog kendiliğinden güncellenir; Türkiye'de satılmış ve satılan marka, model ve paketler
            listededir.
          </p>
        </>
      ) : null}
    </>
  );
}

/** 3. adım: alternatif başına kriterler; kasa ve paket katalogdan */
function Kriterler({
  alanlar,
  veri,
  alt,
  kategori,
  deger,
  yaz,
  gorunur,
  hataOf,
}: AdimProps & { alt: number }) {
  const katalogAlani = Object.entries(veri.alanlar).find(
    ([, x]) => x && typeof x === 'object' && 'make' in (x as object),
  );
  const k = useKatalog(kategori, katalogAlani?.[1] as KatalogDegeri | undefined);
  const a = veri.alternatifler[alt] ?? {};
  const sirali = [
    ...alanlar.filter((f) => f.key !== 'butce'),
    ...alanlar.filter((f) => f.key === 'butce'),
  ].filter(gorunur);
  const kusakSec = (f: CategoryField, value: string) => {
    const now = (a[f.key] as string[] | undefined) ?? [];
    const next = now.includes(value) ? now.filter((x) => x !== value) : [...now, value];
    yaz(f)(next.length ? next : undefined);
    // Seçilen kasalara göre model yılı aralığı kendiliğinden dolar
    const yil = alanlar.find((x) => x.key === 'yil');
    const secili = k.kusaklar.filter((x) => next.includes(x.value));
    if (yil && secili.length) {
      yaz(yil)({ min: Math.min(...secili.map((x) => x.min)), max: Math.max(...secili.map((x) => x.max)) });
    }
  };
  const seciliKusak = k.kusaklar.filter((x) => ((a.kasa as string[] | undefined) ?? []).includes(x.value));
  const [eskiler, setEskiler] = useState(false);
  const gosterilen = k.kusaklar.filter((x) => eskiler || x.yeni || seciliKusak.includes(x));
  const gizli = k.kusaklar.length - gosterilen.length;
  // Paketler seçilen kasaların (yoksa son 15 yılın) yıllarında satılanlar
  const [pMin, pMax] = seciliKusak.length
    ? [Math.min(...seciliKusak.map((x) => x.min)), Math.max(...seciliKusak.map((x) => x.max))]
    : [new Date().getFullYear() - 15, new Date().getFullYear() + 1];
  const paketler = k.paketler.filter((t) => t.years.some((y) => y >= pMin && y <= pMax));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px 20px' }}>
      {sirali.map((f) => {
        if (f.source === 'katalog' && f.key === 'kasa') {
          if (!k.kusaklar.length) return null;
          return (
            <div key={f.key} style={{ gridColumn: '1 / -1' }}>
              <span style={etiket}>{f.label}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {gosterilen.map((x) => (
                  <Cip
                    key={x.value}
                    on={seciliKusak.includes(x)}
                    alt={x.alt}
                    onClick={() => kusakSec(f, x.value)}
                  >
                    {x.label}
                  </Cip>
                ))}
                {gizli > 0 ? (
                  <button
                    type="button"
                    onClick={() => setEskiler(true)}
                    style={{
                      border: 0,
                      background: 'transparent',
                      color: '#2450C8',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Daha eski kasalar ({gizli})
                  </button>
                ) : null}
              </div>
              <span style={{ display: 'block', fontSize: 12.5, color: '#5A6073', marginTop: 6 }}>
                Seçtiğin kasalara göre model yılı aralığı otomatik dolar; istersen daraltabilirsin.
              </span>
            </div>
          );
        }
        if (f.source === 'katalog' && f.key === 'paket') {
          if (!paketler.length) return null;
          const secili = (a[f.key] as string[] | undefined) ?? [];
          return (
            <div key={f.key} style={{ gridColumn: '1 / -1' }}>
              <span style={etiket}>{f.label}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {paketler.map((p) => (
                  <Cip
                    key={p.key}
                    on={secili.includes(p.key)}
                    onClick={() => {
                      const next = secili.includes(p.key)
                        ? secili.filter((x) => x !== p.key)
                        : [...secili, p.key];
                      yaz(f)(next.length ? next : undefined);
                    }}
                  >
                    {p.name}
                  </Cip>
                ))}
                <Cip on={secili.length === 0} alt="Tüm paketler" onClick={() => yaz(f)(undefined)}>
                  Fark etmez
                </Cip>
              </div>
            </div>
          );
        }
        if (f.source === 'katalog') return null;
        const genis =
          f.key === 'butce' ||
          f.type === 'text' ||
          (f.type === 'multiselect' && (f.options?.length ?? 0) > 8);
        return (
          <div key={f.key} style={{ gridColumn: genis ? 'span 2' : undefined }}>
            <Alan f={f} value={deger(f)} onChange={yaz(f)} hata={hataOf(f)} />
            {f.key === 'yil' && seciliKusak.length ? (
              <span
                style={{ display: 'block', fontSize: 12.5, color: '#2450C8', fontWeight: 600, marginTop: 6 }}
              >
                {seciliKusak.map((x) => x.label).join(', ')} kasalarının yılları
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** 4. adım: Hasar geçmişi (Kabul / Kabul etmiyorum) */
function HasarGecmisi({
  f,
  value,
  onChange,
}: {
  f: CategoryField;
  value?: string[];
  onChange: (v: unknown) => void;
}) {
  const kabul = value ?? [];
  const btn = (on: boolean, iyi: boolean): CSSProperties => ({
    border: on ? `1.5px solid ${iyi ? '#25A35A' : '#A3271F'}` : '1px solid #D5DAE5',
    background: on ? (iyi ? '#E7FAF0' : '#FDECEC') : '#FFFFFF',
    borderRadius: 8,
    padding: on ? '6px 10px' : '6.5px 10.5px',
    fontSize: 12.5,
    fontWeight: on ? 800 : 600,
    color: on ? (iyi ? '#11683F' : '#A3271F') : '#5A6073',
    cursor: 'pointer',
    fontFamily: 'inherit',
  });
  const set = (k: string, on: boolean) => {
    const next = on ? [...new Set([...kabul, k])] : kabul.filter((x) => x !== k);
    onChange(next.length ? next : undefined);
  };
  return (
    <div>
      <h2 style={{ margin: '10px 0 12px', fontSize: 18, fontWeight: 700 }}>Hasar geçmişi</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        {(f.options ?? []).map((o) => {
          const on = kabul.includes(o.value);
          return (
            <div
              key={o.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                border: '1px solid #EEF0F5',
                borderRadius: 14,
                padding: '12px 14px',
              }}
            >
              <span style={{ fontSize: 14.5, fontWeight: 700 }}>{o.label}</span>
              <fieldset
                style={{ display: 'flex', gap: 4, border: 0, margin: 0, padding: 0 }}
                aria-label={o.label}
              >
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => set(o.value, true)}
                  style={btn(on, true)}
                >
                  Kabul
                </button>
                <button
                  type="button"
                  aria-pressed={!on}
                  onClick={() => set(o.value, false)}
                  style={btn(!on, false)}
                >
                  Kabul etmiyorum
                </button>
              </fieldset>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** "Şasi işlemi, podye işlemi ve airbag" (ilk harf büyük) */
function liste(xs: string[]) {
  const k = xs.map((x, i) => (i === 0 ? x : x.toLocaleLowerCase('tr-TR')));
  return k.length > 1 ? `${k.slice(0, -1).join(', ')} ve ${k.at(-1)}` : (k[0] ?? '');
}

function iletisimOzeti(c: Iletisim, kisa = false) {
  if (!c.phoneVisible) return kisa ? 'Yalnızca mesaj' : 'Yalnızca uygulama içi mesaj';
  return c.whatsappVisible
    ? kisa
      ? 'Mesaj, telefon, WhatsApp'
      : 'Mesaj, telefon ve WhatsApp'
    : 'Mesaj ve telefon';
}

function butceOzeti(alts: Values[]) {
  const r = alts.map((a) => a.butce as { min?: number; max?: number } | undefined).filter(Boolean) as {
    min?: number;
    max?: number;
  }[];
  const mins = r.map((x) => x.min ?? x.max).filter((x): x is number => x !== undefined);
  const maxs = r.map((x) => x.max ?? x.min).filter((x): x is number => x !== undefined);
  if (!mins.length && !maxs.length) return '';
  return `${binlik(Math.min(...mins))} – ${binlik(Math.max(...maxs))} TL`;
}

/** 6. adım: talep kartı, öne çıkarma ve hak bilgisi */
function Onizleme({
  taslak,
  veri,
  baslik,
  iletisim,
  haklar,
  duzenle,
}: {
  duzenle?: boolean;
  taslak: Taslak;
  veri: Veri;
  baslik: string;
  iletisim: Iletisim;
  haklar: Haklar | null;
}) {
  const konum = veri.alanlar.konum as { il?: string; ilce?: string } | undefined;
  const boya = veri.alanlar.boya as BoyaDegeri | undefined;
  const kabul = (veri.alanlar.islemKabul as string[] | undefined) ?? [];
  const islem = taslak.schema?.fields.find((f) => f.key === 'islemKabul');
  const rules = taslak.schema?.rules;
  const satir = (dt: string, dd: string) => (
    <div style={{ padding: '12px 18px', borderTop: '1px solid #EEF0F5' }}>
      <dt style={{ fontSize: 13, color: '#5A6073' }}>{dt}</dt>
      <dd style={{ margin: '2px 0 0', fontSize: 14.5, fontWeight: 700 }}>{dd}</dd>
    </div>
  );
  return (
    <>
      <div style={{ border: '1px solid #E3E6EF', borderRadius: 18, overflow: 'hidden' }}>
        <div
          style={{
            background: '#EEF3FF',
            padding: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            flexWrap: 'wrap',
          }}
        >
          <span
            role="img"
            aria-label="Temsilî görsel"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
              width: 180,
              maxWidth: '100%',
              aspectRatio: '180 / 66',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #C9D3E6, #EEF1F7)',
            }}
          >
            <svg
              width="25"
              height="25"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8C95AA"
              strokeWidth="1.6"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7h3l2-2h6l2 2h3v12H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.35 }}>
              {baslik.trim() || taslak.category.name}
            </div>
            <div style={{ fontSize: 13.5, color: '#3A4052', marginTop: 4 }}>
              {[
                `${veri.alternatifler.length} alternatif`,
                [konum?.il, konum?.ilce].filter(Boolean).join(', '),
                butceOzeti(veri.alternatifler),
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
        </div>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {satir(
            'Yayın süresi',
            rules?.listingNote
              ? `${rules.listingNote} · 7, 3 ve 1 gün önce hatırlatma`
              : `${rules?.listingDays ?? 30} gün · 7, 3 ve 1 gün önce hatırlatma`,
          )}
          {satir('İletişim', iletisimOzeti(iletisim))}
          {boya !== undefined || taslak.schema?.fields.some((f) => f.type === 'paint')
            ? satir('Boya / değişen', boyaOzeti(boya))
            : null}
          {islem
            ? satir(
                'Hasar geçmişi',
                kabul.length === 0
                  ? `${liste((islem.options ?? []).map((o) => o.label))} kabul edilmiyor`
                  : `${kabul.length} hasar türü kabul ediliyor`,
              )
            : null}
        </dl>
      </div>
      {rules?.legalNotice ? (
        <p
          style={{
            margin: '14px 0 0',
            fontSize: 13.5,
            lineHeight: 1.55,
            color: '#7A5300',
            background: '#FFF6DF',
            borderRadius: 12,
            padding: '12px 14px',
          }}
        >
          {rules.legalNotice}
        </p>
      ) : null}
      {duzenle ? null : (
        <>
          <h2 style={{ margin: '24px 0 12px', fontSize: 18, fontWeight: 700 }}>
            Talebini öne çıkar (isteğe bağlı)
          </h2>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}
          >
            {ONE_CIKARMA.map((b) => (
              <div
                key={b.key}
                aria-disabled="true"
                style={{
                  textAlign: 'left',
                  border: '1px solid #E3E6EF',
                  background: '#FFFFFF',
                  borderRadius: 14,
                  padding: 15,
                  opacity: 0.7,
                }}
              >
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#1E2333' }}>
                  {b.ad}
                </span>
                <span style={{ display: 'block', fontSize: 13, color: '#5A6073', marginTop: 3 }}>
                  {b.aciklama}
                </span>
                <span
                  style={{ display: 'block', fontSize: 15, fontWeight: 800, color: '#1E2333', marginTop: 8 }}
                >
                  {b.tl} TL
                </span>
              </div>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#5A6073' }}>
            Öne çıkarma, ödeme altyapısı açılınca talebin yayındayken Taleplerim'den de alınabilecek.
          </p>
        </>
      )}
      {haklar ? (
        haklar.talep > 0 ? (
          <div
            style={{
              marginTop: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: '#E7FAF0',
              borderRadius: 14,
              padding: '14px 16px',
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#11683F"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ flex: 'none' }}
            >
              <path d="M5 12l5 5 9-10" />
            </svg>
            <span style={{ fontSize: 14.5, color: '#11683F', fontWeight: 600 }}>
              {haklar.ucretsizTalep
                ? 'Bu telefon numarasıyla 1 ücretsiz talep hakkın var; bu talep ücretsiz yayınlanır.'
                : `${haklar.talep} talep hakkın var; bu talep bir hakkını kullanır.`}
            </span>
          </div>
        ) : (
          <div
            style={{
              marginTop: 18,
              background: '#FFF6DF',
              borderRadius: 14,
              padding: '14px 16px',
              fontSize: 14.5,
              color: '#7A5300',
              fontWeight: 600,
            }}
          >
            Ücretsiz talep hakkını kullandın. Ek talep {BIREYSEL_FIYATLAR.ekTalep.tl} TL, 3'lü paket{' '}
            {BIREYSEL_FIYATLAR.talepPaketi.tl} TL; ödeme altyapısı açılınca buradan satın alabileceksin.
            Talebin taslak olarak saklanıyor.
          </div>
        )
      ) : null}
    </>
  );
}

/** Sağdaki "Talebin özeti" */
function Ozet({
  taslak,
  veri,
  iletisim,
  katUst,
  kategoriler,
}: {
  taslak: Taslak | null;
  veri: Veri;
  iletisim: Iletisim;
  katUst: string | null;
  kategoriler: PublicCategory[] | null;
}) {
  const katalog = taslak?.schema?.fields.find((f) => f.type === 'catalog');
  const k = useKatalog(
    taslak ? katalogKategorisi(taslak.category.slug, katUst, veri.alanlar.aracTuru) : undefined,
    katalog ? (veri.alanlar[katalog.key] as KatalogDegeri | undefined) : undefined,
  );
  const konum = veri.alanlar.konum as { il?: string; ilce?: string } | undefined;
  const ust = kategoriler?.find((c) => c.slug === katUst);
  const altlar = veri.alternatifler
    .map((a) => {
      const y = a.yil as { min?: number; max?: number } | undefined;
      const kasa = (a.kasa as string[] | undefined) ?? [];
      const ad = k.kusaklar.filter((x) => kasa.includes(x.value)).map((x) => x.label);
      const yil = y
        ? y.min && y.max
          ? `${y.min}–${y.max}`
          : y.min
            ? `${y.min} ve sonrası`
            : `${y.max} ve öncesi`
        : '';
      return [ad.join(', '), yil].filter(Boolean).join(' · ');
    })
    .filter(Boolean);
  const boya = veri.alanlar.boya as BoyaDegeri | undefined;
  const satirlar = [
    {
      label: 'Kategori',
      value: taslak ? (ust ? `${ust.name} › ${taslak.category.name}` : taslak.category.name) : '—',
    },
    {
      label: 'Ana araç',
      value: [k.adlar.make, k.adlar.series, k.adlar.model].filter(Boolean).join(' › ') || '—',
    },
    {
      label: 'Alternatifler',
      value: altlar.length ? altlar.join('; ') : `${veri.alternatifler.length} alternatif`,
    },
    { label: 'Boya ve hasar', value: boya ? `En fazla ${boya.limit} parça` : '—' },
    { label: 'Konum', value: [konum?.il, konum?.ilce].filter(Boolean).join(', ') || '—' },
    { label: 'İletişim', value: iletisimOzeti(iletisim, true) },
  ];
  return (
    <aside
      aria-label="Talep özeti"
      style={{ ...kart, flex: '1 1 300px', minWidth: 0, maxWidth: 380, padding: 22 }}
    >
      <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>Talebin özeti</h2>
      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {satirlar.map((s, i) => (
          <div key={s.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: DOTS[i % DOTS.length],
                marginTop: 5,
                flex: 'none',
              }}
            />
            <div>
              <dt style={{ fontSize: 12.5, color: '#5A6073' }}>{s.label}</dt>
              <dd style={{ margin: '1px 0 0', fontSize: 14, fontWeight: 700 }}>{s.value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <p style={{ margin: '18px 0 0', fontSize: 12.5, lineHeight: 1.5, color: '#5A6073' }}>
        Yarım kalan talebin taslak olarak saklanır; istediğin zaman kaldığın adımdan devam edebilirsin.
      </p>
    </aside>
  );
}
