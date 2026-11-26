'use client';

import {
  acikSoruSayisi,
  BIREYSEL_FIYATLAR,
  type CategoryField,
  type CategoryRules,
  DOTS,
  kesinSecenekler,
  kriterSirasi,
  MAX_ALTERNATIVES,
  ONE_CIKARMA,
  type PublicCategory,
  secimiDaralt,
  TEKNIK_KAYNAK,
  teknikSatirlari,
  uygunSecenekler,
} from '@rengarenk/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cx } from '../../lib/cx';
import { useWebFiyat } from '../../lib/fiyat';
import { ApiHatasi, binlik, istek, useGiris } from '../../lib/istemci';
import { olcumOlayi } from '../../lib/olcum';
import { Logo } from '../logo';
import { AciklamaEditoru } from './aciklama-editoru';
import { Alan, Anahtar, Cip, Konum } from './alan';
import { Asistan } from './asistan';
import { type BoyaDegeri, BoyaSemasi, boyaOzeti } from './boya';
import { ButceKoluSaglayici, butceOlayi, useDeneyKolu } from './deney';
import { type KatalogDegeri, katalogKategorisi, useKatalog } from './katalog';
import stil from './sihirbaz.module.css';
import { SihirbazTanitimi } from './tanitim';

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
  hesap: { id: string; ad: string } | null;
  /** Talep asistanı bu kişi için açık mı (Karar 42) */
  asistan?: boolean;
}
interface Haklar {
  ucretsizTalep: boolean;
  talep: number;
  telefonMaske: string | null;
  /** Galeri adına talepte galerinin adı (paketin talep hakkı) */
  galeri: string | null;
}

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
  // 6. adımda seçilen öne çıkarmalar: yayından sonra Haklarım'da sepete eklenir (Karar 12.6)
  const [oneCikar, setOneCikar] = useState<string[]>([]);
  // Galeri adına talep (Karar 12.2, 20): sahip ya da yönetici olduğu galeriler; seçim yalnızca taslak açılmadan
  const [galeriler, setGaleriler] = useState<{ accountId: string; ad: string }[]>([]);
  const [hesap, setHesap] = useState<string | null>(null);
  const kirli = useRef(false);
  // Bütçe adımı deneyi (Karar 44): üyenin kolu ve adımı görme / geçme olayları
  const butceKolu = useDeneyKolu(giris);
  const oncekiAdim = useRef<AdimKey>(adim);
  // Asistan formu doldurunca katalog seçicisi yeniden kurulur
  const [asistanSurum, setAsistanSurum] = useState(0);

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
    istek<{ accountId: string; ad: string; rol: string; durum: string }[]>('/gallery/mine')
      .then((g) => setGaleriler(g.filter((x) => x.rol !== 'SALES' && x.durum === 'ACTIVE')))
      .catch(() => undefined);
    const q = new URLSearchParams(window.location.search);
    if (q.get('hesap')) setHesap(q.get('hesap'));
    const id = q.get('id');
    if (id) yukle(id).catch((e: Error) => setUyari(e.message));
  }, [giris, yukle]);

  // Haklar seçili hesaba göre: taslak açıldıysa taslağın hesabı, değilse "Kimin adına" seçimi
  const etkinHesap = taslak ? (taslak.hesap?.id ?? null) : hesap;
  useEffect(() => {
    if (!giris) return;
    istek<Haklar>(`/demands/rights${etkinHesap ? `?hesap=${etkinHesap}` : ''}`)
      .then(setHaklar)
      .catch(() => setHaklar(null));
  }, [giris, etkinHesap]);

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

  useEffect(() => {
    const once = oncekiAdim.current;
    oncekiAdim.current = adim;
    if (!taslak || duzenle || !alanlar.some((f) => f.key === 'butce' && f.step === 'kriterler')) return;
    const sira = (k: AdimKey) => ADIMLAR.findIndex((a) => a.key === k);
    if (adim === 'kriterler') butceOlayi('gorus');
    else if (once === 'kriterler' && sira(adim) > sira('kriterler')) butceOlayi('gecis');
  }, [adim, taslak, duzenle, alanlar]);

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
  /**
   * Yeni alternatif bir öncekinin kopyasıyla başlar; değişeni düzeltmek yeterli. "Başka kasa" için açılanda kasa ve
   * kasaya bağlı seçimler (yıl, paket, yakıt, vites, kasa tipi) boş gelir.
   */
  const alternatifEkle = (kasaIcin: boolean) => {
    degistir((d) => {
      const kopya = { ...(d.alternatifler[alt] ?? {}) };
      if (kasaIcin) for (const k of ['kasa', 'yil', 'paket', 'yakit', 'vites', 'kasaTipi']) delete kopya[k];
      return { ...d, alternatifler: [...d.alternatifler, kopya] };
    });
    setAlt(veri.alternatifler.length);
  };
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
        : await istek<{ id: string }>('/demands', {
            method: 'POST',
            body: { kategori: slug, ...(hesap ? { hesap } : {}) },
          });
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
      olcumOlayi('Lead', taslak.id);
      router.push(
        oneCikar.length && !taslak.hesap
          ? `/haklarim?talep=${r.no}&sepet=${oneCikar.map((k) => `${k}_7`).join(',')}`
          : `/taleplerim?yayinlandi=${r.no}`,
      );
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
    return <p className={stil.metin1}>Yükleniyor…</p>;
  }

  const kat = kategoriler?.find(
    (c) => c.slug === taslak?.category.slug || c.children.some((x) => x.slug === taslak?.category.slug),
  );
  const katUst = kat && kat.slug !== taslak?.category.slug ? kat.slug : null;

  return (
    <ButceKoluSaglayici kol={butceKolu}>
      <SihirbazTanitimi
        adim={adim}
        sira={Math.max(sira, 0) + 1}
        toplam={gorunen.length}
        acik={adim === 'kategori' || Boolean(taslak)}
      />
      <div className={stil.kutu1}>
        <header className={stil.kutu2}>
          <div className={`rr-sihirbaz-ust ${stil.kutu3}`}>
            <Logo />
            <div className={stil.kutu4}>
              {kayit ? (
                <span
                  className={`rr-sihirbaz-kayit ${stil.metin2}`}
                  style={{
                    color:
                      kayit === 'hata'
                        ? '#A3271F'
                        : kayit === 'kaydediliyor'
                          ? 'var(--rr-soluk, #5A6073)'
                          : '#11683F',
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
              <Link href="/taleplerim" className={stil.bag1}>
                {duzenle ? 'Vazgeç' : 'Kaydet ve çık'}
              </Link>
            </div>
          </div>
        </header>

        <div className={stil.kutu2}>
          <ol
            aria-label="Adımlar"
            className={`rr-adimlar ${stil.liste1}`}
            style={{ gridTemplateColumns: `repeat(${gorunen.length}, minmax(0, 1fr))` }}
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
                    className={stil.dugme1}
                  >
                    <span className={cx(stil.metin3, done || cur ? stil.metin4 : stil.metin5)} />
                    <span className={stil.metin6}>
                      <span
                        className={stil.metin7}
                        style={{
                          background: done
                            ? 'var(--rr-mavi, #5B8CFF)'
                            : cur
                              ? 'var(--rr-kart, #FFFFFF)'
                              : '#F3F5FA',
                          color: done
                            ? 'var(--rr-maviYazi, #1E2333)'
                            : cur
                              ? 'var(--rr-baglanti, #2450C8)'
                              : 'var(--rr-soluk, #5A6073)',
                          border: `2px solid ${done || cur ? 'var(--rr-mavi, #5B8CFF)' : 'var(--rr-cizgi, #E3E6EF)'}`,
                        }}
                      >
                        {done ? '✓' : i + 1}
                      </span>
                      <span
                        className={cx(
                          'rr-adim-ad',
                          stil.metin8,
                          cur ? stil.metin9 : stil.metin10,
                          cur || done ? stil.metin11 : stil.metin12,
                        )}
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

        <main className={`rr-sayfa ${stil.kutu5}`}>
          <div className={`rr-sihirbaz-kart ${stil.kutu6}`}>
            <p className={stil.metin13}>
              Adım {sira + 1} / {gorunen.length}
            </p>
            <h1 className={stil.baslik1}>{tanim.baslik}</h1>
            <p className={stil.metin14}>
              {adim === 'onizleme'
                ? `Her şey doğruysa talebini yayınla; ${taslak?.schema?.rules.listingDays ?? 30} gün boyunca satıcılar seni bulsun.`
                : tanim.alt}
            </p>

            {uyari ? (
              <div role="alert" className={stil.kutu7}>
                {uyari}
                {hatalar.length > 1 ? (
                  <ul className={stil.liste2}>
                    {hatalar.slice(0, 6).map((h) => (
                      <li key={h.path}>{h.message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {adim === 'kategori' ? (
              <>
                {galeriler.length && (!taslak || taslak.hesap) ? (
                  <fieldset className={stil.kutu8}>
                    <legend className={stil.baslik2}>Kimin adına?</legend>
                    <div className={stil.kutu9}>
                      {[{ accountId: null as string | null, ad: 'Kendi adıma' }, ...galeriler].map((g) => {
                        const on = (taslak ? (taslak.hesap?.id ?? null) : hesap) === g.accountId;
                        return (
                          <button
                            key={g.accountId ?? 'ben'}
                            type="button"
                            aria-pressed={on}
                            disabled={!!taslak}
                            onClick={() => setHesap(g.accountId)}
                            className={cx(
                              stil.dugme2,
                              on ? stil.dugme3 : stil.dugme4,
                              taslak ? stil.dugme5 : stil.dugme6,
                            )}
                          >
                            {g.accountId ? `${g.ad} adına` : g.ad}
                          </button>
                        );
                      })}
                    </div>
                    <p className={stil.metin15}>
                      {taslak
                        ? 'Taslak açıldıktan sonra hesap değişmez.'
                        : 'Galeri adına talepte paketin talep hakkı kullanılır ve alıcı olarak galerinin adı görünür.'}
                    </p>
                  </fieldset>
                ) : null}
                <div className={`rr-kategori-izgara ${stil.kutu10}`}>
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
                        className={cx(stil.dugme7, sel ? stil.dugme8 : stil.dugme9)}
                      >
                        {sel ? (
                          <span aria-hidden="true" className={stil.metin16} style={{ background: c.color }} />
                        ) : (
                          <span aria-hidden="true" className={stil.metin17} style={{ background: TINTS[ti] }}>
                            <span className={stil.metin18} style={{ background: c.color }} />
                          </span>
                        )}
                        <span className={cx(stil.metin19, sel ? stil.metin9 : stil.metin20)}>{c.name}</span>
                      </button>
                    );
                  })}
                </div>
                {(() => {
                  const u = kategoriler?.find((c) => c.slug === (ust ?? katUst));
                  if (!u?.children.length) return null;
                  return (
                    <div className={stil.kutu11}>
                      <span className={stil.metin21}>{u.name} · alt kategori</span>
                      <div className={stil.kutu9}>
                        {u.children.map((x) => (
                          <Cip
                            key={x.slug}
                            tur="tek"
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

            {adim === 'ana_arac' && taslak?.asistan && !duzenle ? (
              <Asistan
                taslakId={taslak.id}
                doldu={async () => {
                  kirli.current = false;
                  await yukle(taslak.id);
                  setAdim('ana_arac');
                  setAsistanSurum((n) => n + 1);
                }}
              />
            ) : null}
            {adim === 'ana_arac' && taslak ? (
              <AnaArac
                key={asistanSurum}
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
                <div role="tablist" className={stil.kutu12}>
                  {veri.alternatifler.map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: alternatiflerin kimliği sırasıdır (Alternatif 1, 2 …)
                    <span key={i} className={stil.metin22}>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={alt === i}
                        onClick={() => setAlt(i)}
                        className={cx(stil.dugme10, alt === i ? stil.dugme11 : stil.dugme12)}
                        style={{
                          border: 0,
                          borderBottom: `3px solid ${alt === i ? 'var(--rr-mavi, #5B8CFF)' : 'transparent'}`,
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
                          className={stil.dugme13}
                        >
                          ×
                        </button>
                      ) : null}
                    </span>
                  ))}
                  {veri.alternatifler.length < MAX_ALTERNATIVES ? (
                    <button type="button" onClick={() => alternatifEkle(false)} className={stil.dugme14}>
                      + Alternatif ekle
                    </button>
                  ) : null}
                </div>
                <Kriterler
                  alternatifEkle={
                    veri.alternatifler.length < MAX_ALTERNATIVES ? () => alternatifEkle(true) : undefined
                  }
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
              <div className={stil.kutu13}>
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
                <div className={stil.kutu14}>
                  {alanlar
                    .filter((f) => f.key === 'konum')
                    .map((f) => (
                      <Konum key={f.key} f={f} value={deger(f)} onChange={yaz(f)} hata={hataOf(f)} />
                    ))}
                  <div className={stil.kutu15}>
                    <label htmlFor="baslik" className={stil.etiket1}>
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
                      className={stil.girdi1}
                    />
                  </div>
                  {alanlar
                    .filter((f) => f.step === 'konum_iletisim' && f.key !== 'konum' && gorunur(f))
                    .map((f) => (
                      <div key={f.key} className={cx(f.type === 'text' ? stil.kutu15 : undefined)}>
                        {f.key === 'aciklama' ? (
                          <AciklamaEditoru
                            f={f}
                            value={deger(f) as string | undefined}
                            onChange={yaz(f)}
                            hata={hataOf(f)}
                          />
                        ) : (
                          <Alan f={f} value={deger(f)} onChange={yaz(f)} hata={hataOf(f)} />
                        )}
                      </div>
                    ))}
                </div>
                <h2 className={stil.baslik3}>Satıcılar sana nasıl ulaşsın?</h2>
                <div className={stil.kutu16}>
                  <Satir
                    baslik="Uygulama içi mesaj"
                    alt="Her talepte açık; satıcılar tek ilk mesaj atabilir."
                    sag={<span className={stil.metin23}>Her zaman açık</span>}
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
                          setIletisim((c) => ({
                            ...c,
                            whatsappVisible: c.phoneVisible && !c.whatsappVisible,
                          }));
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
                oneCikar={oneCikar}
                setOneCikar={setOneCikar}
              />
            ) : null}

            <div className={stil.kutu17}>
              {sira > 0 ? (
                <button
                  type="button"
                  onClick={() => git(gorunen[sira - 1]?.key ?? 'kategori')}
                  className={stil.dugme15}
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
                  className={cx(
                    stil.dugme16,
                    busy || (!duzenle && (!haklar || haklar.talep < 1)) ? stil.dugme17 : stil.dugme18,
                  )}
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
                  className={cx(stil.dugme19, taslak ? stil.dugme20 : stil.dugme21)}
                >
                  Devam et
                </button>
              )}
            </div>
          </div>

          <Ozet taslak={taslak} veri={veri} iletisim={iletisim} katUst={katUst} kategoriler={kategoriler} />
        </main>
      </div>
    </ButceKoluSaglayici>
  );
}

function Satir({ baslik, alt, sag }: { baslik: string; alt: string; sag: ReactNode }) {
  return (
    <div className={stil.kutu18}>
      <span>
        <span className={stil.metin24}>{baslik}</span>
        <span className={stil.metin25}>{alt}</span>
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
          <div key={f.key} className={stil.kutu19}>
            <Alan f={f} value={deger(f)} onChange={yaz(f)} hata={hataOf(f)} />
          </div>
        ))}
      {katalog ? (
        <>
          <div
            className={stil.kutu20}
            style={{ gridTemplateColumns: `repeat(${seriYok ? 2 : 3}, minmax(0, 1fr))` }}
          >
            <div>
              <label htmlFor="marka" className={stil.etiket1}>
                Marka
              </label>
              <select
                id="marka"
                value={v?.make ?? ''}
                onChange={(e) => set(e.target.value ? { make: e.target.value } : undefined)}
                className={stil.girdi2}
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
                <label htmlFor="seri" className={stil.etiket1}>
                  Seri
                </label>
                <select
                  id="seri"
                  value={v?.series ?? ''}
                  disabled={!v?.make}
                  onChange={(e) =>
                    v && set({ make: v.make, ...(e.target.value ? { series: e.target.value } : {}) })
                  }
                  className={stil.girdi2}
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
              <label htmlFor="model" className={stil.etiket1}>
                Model
              </label>
              <select
                id="model"
                value={v?.model ?? ''}
                disabled={seriYok ? !v?.make : !v?.series}
                onChange={(e) => v && set({ ...v, model: e.target.value || undefined })}
                className={stil.girdi2}
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
          {k.teknik && teknikSatirlari(k.teknik).length ? (
            <div className={stil.kutu21}>
              <p className={stil.metin26}>Teknik özellikler</p>
              <dl className={stil.liste3}>
                {teknikSatirlari(k.teknik).map(([etiket, deger]) => (
                  <Fragment key={etiket}>
                    <dt className={stil.metin12}>{etiket}</dt>
                    <dd className={stil.metin27}>{deger}</dd>
                  </Fragment>
                ))}
              </dl>
              <p className={stil.metin28}>{TEKNIK_KAYNAK}</p>
            </div>
          ) : null}
          {hataOf(katalog) ? (
            <span role="alert" className={stil.metin29}>
              {hataOf(katalog)}
            </span>
          ) : null}
          {populer.length ? (
            <>
              <p className={stil.metin30}>Popüler markalar</p>
              <div className={stil.kutu9}>
                {populer.map((m) => (
                  <Cip key={m.key} on={v?.make === m.key} onClick={() => set({ make: m.key })}>
                    {m.name}
                  </Cip>
                ))}
              </div>
            </>
          ) : null}
          {k.detail && k.kusaklar.length ? (
            <div className={stil.kutu22}>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2450C8"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
                className={stil.gorsel1}
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
              </svg>
              <div>
                <div className={stil.kutu23}>
                  {[k.adlar.make, k.adlar.series, k.adlar.model].filter(Boolean).join(' ')} için katalogda{' '}
                  {k.kusaklar.length} kasa
                  {k.paketler.length ? ` ve ${k.paketler.length} donanım paketi` : ''} var
                </div>
                <div className={stil.kutu24}>
                  {k.kusaklar
                    .slice(-6)
                    .map((x) => `${x.label} (${x.alt})`)
                    .join(' · ')}
                  . Kasayı ve paketi bir sonraki adımda her alternatif için ayrı seçeceksin.
                </div>
              </div>
            </div>
          ) : null}
          <p className={stil.metin31}>
            Katalog kendiliğinden güncellenir; Türkiye'de satılmış ve satılan marka, model ve paketler
            listededir.
          </p>
        </>
      ) : null}
    </>
  );
}

/**
 * 3. adım: alternatif başına kriterler, yukarıdan aşağı adım adım (sahip isteği, 17 Kasım 2026). Önce kasa ve makyaj
 * (tek seçilir; başka kasa için alternatif) ya da elle model yılı; sonra donanım paketi ve diğer sorular sırayla
 * açılır. Kasa seçildiyse model yılı kasadan gelir; yakıt, vites ve kasa tipi o kasanın tiplerine göre daralır.
 */
function Kriterler({
  alanlar,
  veri,
  alt,
  kategori,
  deger,
  yaz,
  gorunur,
  hataOf,
  alternatifEkle,
}: AdimProps & { alt: number; alternatifEkle?: () => void }) {
  const katalogAlani = Object.entries(veri.alanlar).find(
    ([, x]) => x && typeof x === 'object' && 'make' in (x as object),
  );
  const k = useKatalog(kategori, katalogAlani?.[1] as KatalogDegeri | undefined);
  const a = veri.alternatifler[alt] ?? {};
  const alanOf = (key: string) => alanlar.find((f) => f.key === key);
  const kasaAlani = alanlar.find((f) => f.source === 'katalog' && f.key === 'kasa');
  const yilAlani = alanOf('yil');
  // "Fark etmez" denen ve "yılı kendim gireceğim" seçilen sorular (alternatif başına; değer yazılmaz)
  const [gecilen, setGecilen] = useState<Record<number, string[]>>({});
  const [elleSecildi, setElleSecildi] = useState<Record<number, boolean>>({});
  const gec = (key: string) => setGecilen((g) => ({ ...g, [alt]: [...new Set([...(g[alt] ?? []), key])] }));
  const [eskiler, setEskiler] = useState(false);

  const kasaDegeri = (a.kasa as string[] | undefined)?.[0];
  const seciliKusak = k.kusaklar.find((x) => x.value === kasaDegeri);
  const kasaVar = Boolean(kasaAlani && k.kusaklar.length);
  const elle = !seciliKusak && (Boolean(elleSecildi[alt]) || a.yil !== undefined);
  const yillar = seciliKusak ? { min: seciliKusak.min, max: seciliKusak.max } : null;

  // Paketler kasanın (ya da elle girilen yılların, yoksa son 15 yılın) yıllarında satılanlar
  const yil = a.yil as { min?: number; max?: number } | undefined;
  const buYil = new Date().getFullYear();
  const [pMin, pMax] = yillar
    ? [yillar.min, yillar.max]
    : [yil?.min ?? yil?.max ?? buYil - 15, yil?.max ?? yil?.min ?? buYil + 1];
  const paketler = k.paketler.filter((t) => t.years.some((y) => y >= pMin && y <= pMax));
  // Seçim: kasanın yılları (yoksa elle girilen yıllar) ve seçilen paketler (kimlik)
  const secimYillari =
    yillar ??
    (yil && (yil.min !== undefined || yil.max !== undefined)
      ? { min: (yil.min ?? yil.max) as number, max: (yil.max ?? yil.min) as number }
      : null);
  const paketKimlikleri = ((a.paket as string[] | undefined) ?? [])
    .map((key) => k.paketler.find((p) => p.key === key)?.id)
    .filter((x): x is string => Boolean(x));
  const secim = { yillar: secimYillari, paketler: paketKimlikleri };
  /** Kasa tipi ve çekiş: yalnızca kesin biliniyor ve en az iki seçenek varsa (yoksa soru yok) */
  const kesin = (f: CategoryField) => kesinSecenekler(f, k.tipler, secim);
  const secenekler = (f: CategoryField) =>
    f.key === 'kasaTipi' || f.key === 'cekis'
      ? (kesin(f) ?? [])
      : yillar
        ? uygunSecenekler(f, k.tipler, yillar, seciliKusak?.govdeler, paketKimlikleri)
        : (f.options ?? []);

  // Soru sırası: kasa; kasa seçilmediyse model yılı; paket; diğerleri; bütçe en sonda
  const sorular = kriterSirasi(alanlar)
    .filter(gorunur)
    .filter((f) => {
      if (f.key === 'kasaTipi' || f.key === 'cekis') return kesin(f) !== null;
      if (f.source !== 'katalog') return !(f.key === 'yil' && seciliKusak);
      if (f.key === 'kasa') return kasaVar;
      if (f.key === 'paket') return paketler.length > 0;
      return false;
    });
  if (kasaVar && !seciliKusak && yilAlani) {
    // Yıl elle giriliyorsa paketten önce sorulur (paketler yıla göre süzülür)
    const yi = sorular.indexOf(yilAlani);
    const ki = sorular.findIndex((f) => f.key === 'kasa');
    if (yi > ki + 1) sorular.splice(ki + 1, 0, ...sorular.splice(yi, 1));
  }
  const gecilenler = new Set(gecilen[alt] ?? []);
  const yanitli = (f: CategoryField) =>
    f.key === 'kasa' ? Boolean(seciliKusak) || elle : deger(f) !== undefined;
  const acik = acikSoruSayisi(sorular, yanitli, gecilenler);

  /** Kasa seçimi: model yılı kasadan gelir; kasaya uymayan yakıt, vites, kasa tipi ve paket seçimden düşer */
  const kusakSec = (value: string) => {
    if (!kasaAlani) return;
    if (kasaDegeri === value) {
      yaz(kasaAlani)(undefined);
      if (yilAlani) yaz(yilAlani)(undefined);
      return;
    }
    const x = k.kusaklar.find((y) => y.value === value);
    if (!x) return;
    setElleSecildi((e) => ({ ...e, [alt]: false }));
    yaz(kasaAlani)([value]);
    if (yilAlani) yaz(yilAlani)({ min: x.min, max: x.max });
    for (const key of ['yakit', 'vites']) {
      const f = alanOf(key);
      if (f && a[key] !== undefined)
        yaz(f)(secimiDaralt(a[key], uygunSecenekler(f, k.tipler, { min: x.min, max: x.max }, x.govdeler)));
    }
    for (const key of ['kasaTipi', 'cekis']) {
      const f = alanOf(key);
      if (f && a[key] !== undefined)
        yaz(f)(
          secimiDaralt(
            a[key],
            kesinSecenekler(f, k.tipler, { yillar: { min: x.min, max: x.max }, paketler: paketKimlikleri }) ??
              [],
          ),
        );
    }
    const paket = alanOf('paket');
    const seciliPaket = a.paket as string[] | undefined;
    if (paket && seciliPaket?.length) {
      const uyan = new Set(
        k.paketler.filter((t) => t.years.some((y) => y >= x.min && y <= x.max)).map((t) => t.key),
      );
      const kalan = seciliPaket.filter((p) => uyan.has(p));
      yaz(paket)(kalan.length ? kalan : undefined);
    }
  };
  const elleGir = () => {
    if (kasaAlani && kasaDegeri) {
      yaz(kasaAlani)(undefined);
      // Kasadan gelen yıl silinir; yıl elle yazılır
      if (yilAlani) yaz(yilAlani)(undefined);
    }
    setElleSecildi((e) => ({ ...e, [alt]: true }));
  };

  // Kasa tipi ya da çekiş artık sorulmuyorsa (seçim değişti) eski değeri kalmaz
  const temizlenecek = ['kasaTipi', 'cekis']
    .map(alanOf)
    .filter(
      (f): f is CategoryField =>
        f !== undefined && a[f.key] !== undefined && k.detail !== null && kesin(f) === null,
    );
  useEffect(() => {
    for (const f of temizlenecek) yaz(f)(undefined);
  });

  const gosterilen = k.kusaklar.filter((x) => eskiler || x.yeni || x === seciliKusak);
  const gizli = k.kusaklar.length - gosterilen.length;

  return (
    <div className={stil.kutu25}>
      {sorular.slice(0, acik).map((f) => {
        if (f.key === 'kasa' && f.source === 'katalog') {
          return (
            <div key={f.key} className={stil.kutu26}>
              <span className={stil.metin21}>{f.label}</span>
              <div className={stil.kutu9}>
                {gosterilen.map((x) => (
                  <Cip
                    key={x.value}
                    tur="tek"
                    on={x === seciliKusak}
                    alt={x.alt}
                    onClick={() => kusakSec(x.value)}
                  >
                    {x.label}
                  </Cip>
                ))}
                {gizli > 0 ? (
                  <button type="button" onClick={() => setEskiler(true)} className={stil.dugme22}>
                    Daha eski kasalar ({gizli})
                  </button>
                ) : null}
                {yilAlani ? (
                  <Cip tur="tek" on={elle} alt="Kasa seçmeden" onClick={elleGir}>
                    Yılı kendim gireceğim
                  </Cip>
                ) : null}
              </div>
              {seciliKusak ? (
                <span className={stil.metin32}>
                  Model yılı:{' '}
                  {seciliKusak.min === seciliKusak.max
                    ? seciliKusak.min
                    : `${seciliKusak.min}–${seciliKusak.max}`}{' '}
                  (seçtiğin kasadan)
                </span>
              ) : null}
              <span className={stil.metin33}>
                Tek kasa seçilir. Başka bir kasa da istiyorsan{' '}
                {alternatifEkle ? (
                  <button type="button" onClick={alternatifEkle} className={stil.dugme23}>
                    alternatif ekle
                  </button>
                ) : (
                  'alternatif ekle'
                )}
                . Yılı elle girersen kasa seçilmez.
              </span>
            </div>
          );
        }
        if (f.key === 'paket' && f.source === 'katalog') {
          const secili = (a[f.key] as string[] | undefined) ?? [];
          return (
            <div key={f.key} className={stil.kutu26}>
              <span className={stil.metin21}>{f.label}</span>
              <div className={stil.kutu9}>
                {paketler.map((p) => (
                  <Cip
                    key={p.key}
                    tur="coklu"
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
                <Cip
                  tur="coklu"
                  on={secili.length === 0 && gecilenler.has(f.key)}
                  alt="Tüm paketler"
                  onClick={() => {
                    yaz(f)(undefined);
                    gec(f.key);
                  }}
                >
                  Fark etmez
                </Cip>
              </div>
            </div>
          );
        }
        const daraltilmis = { ...f, options: secenekler(f) };
        const genis =
          f.key === 'butce' ||
          f.key === 'yil' ||
          f.type === 'text' ||
          f.type === 'multiselect' ||
          f.type === 'boolean';
        const daraldi = yillar && (f.options?.length ?? 0) > daraltilmis.options.length;
        return (
          <div key={f.key} className={cx(genis ? stil.kutu26 : undefined)}>
            <Alan
              f={daraltilmis}
              value={deger(f)}
              onChange={yaz(f)}
              hata={hataOf(f)}
              farkEtmez={f.required ? undefined : () => gec(f.key)}
              gecildi={gecilenler.has(f.key)}
            />
            {daraldi ? <span className={stil.metin33}>Seçtiğin kasada satılanlar gösteriliyor.</span> : null}
            {!f.required &&
            (f.type === 'number' || f.type === 'range' || f.type === 'select') &&
            deger(f) === undefined ? (
              <button
                type="button"
                onClick={() => gec(f.key)}
                className={stil.dugme24}
                style={{
                  color: gecilenler.has(f.key)
                    ? 'var(--rr-murekkep, #1E2333)'
                    : 'var(--rr-baglanti, #2450C8)',
                }}
              >
                {gecilenler.has(f.key) ? '✓ Fark etmez' : 'Fark etmez'}
              </button>
            ) : null}
          </div>
        );
      })}
      {acik < sorular.length ? (
        <p className={stil.metin34}>
          Bu soruyu yanıtlayınca sıradaki açılır ({acik} / {sorular.length}).
        </p>
      ) : null}
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
    background: on ? (iyi ? '#E7FAF0' : '#FDECEC') : 'var(--rr-kart, #FFFFFF)',
    borderRadius: 'calc(var(--rr-buton-kose) * 8 / 14)',
    padding: on ? '6px 10px' : '6.5px 10.5px',
    fontSize: 12.5,
    fontWeight: on ? 800 : 600,
    color: on ? (iyi ? '#11683F' : '#A3271F') : 'var(--rr-soluk, #5A6073)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  });
  const set = (k: string, on: boolean) => {
    const next = on ? [...new Set([...kabul, k])] : kabul.filter((x) => x !== k);
    onChange(next.length ? next : undefined);
  };
  return (
    <div>
      <h2 className={stil.baslik4}>Hasar geçmişi</h2>
      <div className={stil.kutu27}>
        {(f.options ?? []).map((o) => {
          const on = kabul.includes(o.value);
          return (
            <div key={o.value} className={stil.kutu28}>
              <span className={stil.kutu23}>{o.label}</span>
              <fieldset className={stil.kutu29} aria-label={o.label}>
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
  // Bütçe tek rakam (sahip isteği, 17 Kasım 2026); alternatiflerin bütçeleri farklıysa aralık
  const lo = Math.min(...mins);
  const hi = Math.max(...maxs);
  return lo === hi ? `${binlik(hi)} TL` : `${binlik(lo)} – ${binlik(hi)} TL`;
}

/** 6. adım: talep kartı, öne çıkarma ve hak bilgisi */
function Onizleme({
  taslak,
  veri,
  baslik,
  iletisim,
  haklar,
  duzenle,
  oneCikar,
  setOneCikar,
}: {
  duzenle?: boolean;
  taslak: Taslak;
  veri: Veri;
  baslik: string;
  iletisim: Iletisim;
  haklar: Haklar | null;
  oneCikar: string[];
  setOneCikar: (v: string[]) => void;
}) {
  const fiyat = useWebFiyat();
  const konum = veri.alanlar.konum as { il?: string; ilce?: string } | undefined;
  const boya = veri.alanlar.boya as BoyaDegeri | undefined;
  const kabul = (veri.alanlar.islemKabul as string[] | undefined) ?? [];
  const islem = taslak.schema?.fields.find((f) => f.key === 'islemKabul');
  const rules = taslak.schema?.rules;
  const satir = (dt: string, dd: string) => (
    <div className={stil.kutu30}>
      <dt className={stil.metin35}>{dt}</dt>
      <dd className={stil.metin36}>{dd}</dd>
    </div>
  );
  return (
    <>
      <div className={stil.kutu31}>
        <div className={stil.kutu32}>
          <span role="img" aria-label="Temsilî görsel" className={stil.metin37}>
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
            <div className={stil.kutu33}>{baslik.trim() || taslak.category.name}</div>
            <div className={stil.kutu34}>
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
        <dl className={stil.liste4}>
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
      {rules?.legalNotice ? <p className={stil.metin38}>{rules.legalNotice}</p> : null}
      {duzenle ? null : haklar?.galeri ? (
        <p className={stil.metin39}>
          Talep {haklar.galeri} adına yayınlanır; alıcı olarak galerinin adı görünür. Paketindeki öne çıkarma
          hakkını yayından sonra Taleplerim'den kullanabilirsin.
        </p>
      ) : (
        <>
          <h2 className={stil.baslik5}>Talebini öne çıkar (isteğe bağlı)</h2>
          <div className={stil.kutu35}>
            {ONE_CIKARMA.map((b) => {
              const on = oneCikar.includes(b.key);
              return (
                <button
                  key={b.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setOneCikar(on ? oneCikar.filter((k) => k !== b.key) : [...oneCikar, b.key])}
                  className={cx(stil.dugme25, on ? stil.dugme26 : stil.dugme27)}
                >
                  <span className={stil.metin40}>{b.ad}</span>
                  <span className={stil.metin41}>{b.aciklama}</span>
                  <span className={stil.metin42}>{fiyat(`${b.key}_7`, b.tl)} TL</span>
                </button>
              );
            })}
          </div>
          <p className={stil.metin43}>
            {oneCikar.length
              ? 'Talebin yayınlanınca seçtiklerin ödeme sayfasında sepetine eklenir; ödeyince hemen başlar.'
              : 'İstersen talebin yayındayken Haklarım ve ödemeler sayfasından da öne çıkarabilirsin.'}
          </p>
        </>
      )}
      {haklar ? (
        haklar.talep > 0 ? (
          <div className={stil.kutu36}>
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
              className={stil.gorsel1}
            >
              <path d="M5 12l5 5 9-10" />
            </svg>
            <span className={stil.metin44}>
              {haklar.galeri
                ? `${haklar.galeri} galerisinin ${haklar.talep} talep hakkı var; bu talep paketin bir hakkını kullanır.`
                : haklar.ucretsizTalep
                  ? 'Bu telefon numarasıyla 1 ücretsiz talep hakkın var; bu talep ücretsiz yayınlanır.'
                  : `${haklar.talep} talep hakkın var; bu talep bir hakkını kullanır.`}
            </span>
          </div>
        ) : haklar.galeri ? (
          <div className={stil.kutu37}>
            {haklar.galeri} galerisinin bu ayki talep hakkı bitti.{' '}
            <a href="/galeri-paneli?bolum=paket" className={stil.metin9}>
              Galeri paneli › Paket ve faturalar
            </a>
            'dan ek talep alabilirsin; talebin taslak olarak saklanıyor.
          </div>
        ) : (
          <div className={stil.kutu37}>
            Ücretsiz talep hakkını kullandın. Ek talep {fiyat('ek_talep', BIREYSEL_FIYATLAR.ekTalep.tl)} TL,
            3'lü paket {fiyat('talep_paketi', BIREYSEL_FIYATLAR.talepPaketi.tl)} TL.{' '}
            <a href="/haklarim?sepet=ek_talep" className={stil.metin9}>
              Ek talep hakkı al
            </a>
            ; talebin taslak olarak saklanıyor, hakkı alınca buradan yayınlayabilirsin.
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
    <aside aria-label="Talep özeti" className={stil.kutu38}>
      <h2 className={stil.baslik6}>Talebin özeti</h2>
      <dl className={stil.liste5}>
        {satirlar.map((s, i) => (
          <div key={s.label} className={stil.kutu39}>
            <span aria-hidden="true" className={stil.metin45} style={{ background: DOTS[i % DOTS.length] }} />
            <div>
              <dt className={stil.metin46}>{s.label}</dt>
              <dd className={stil.metin47}>{s.value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <p className={stil.metin48}>
        Yarım kalan talebin taslak olarak saklanır; istediğin zaman kaldığın adımdan devam edebilirsin.
      </p>
    </aside>
  );
}
