import {
  ASSISTANT_TEXT_MAX,
  acikSoruSayisi,
  BIREYSEL_FIYATLAR,
  butonOran,
  type CategoryField,
  type CategoryRules,
  colors,
  DOTS,
  fiyatYaz,
  kartOran,
  kesinSecenekler,
  kriterSirasi,
  MAX_ALTERNATIVES,
  ONE_CIKARMA,
  PAINT_PARTS,
  radii,
  secimiDaralt,
  TEKNIK_KAYNAK,
  teknikSatirlari,
  uygunSecenekler,
} from '@rengarenk/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentRef, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../components/ikon';
import { T, TInput } from '../components/t';
import { AciklamaEditoru } from '../components/talep/aciklama-editoru';
import {
  Alan,
  Anahtar,
  binlik,
  Cip,
  girdiStil,
  Konum,
  kartStil,
  ParcaSecimi,
  Secici,
} from '../components/talep/ortak';
import { SihirbazTanitimi } from '../components/talep/tanitim';
import { type KatalogDegeri, katalogKategorisi, useKatalog } from '../lib/katalog';
import { useKategoriler } from '../lib/kategoriler';
import { IstekHatasi, useOturum } from '../lib/oturum';

const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0', '#F3EFFF', '#FFF0EA'];
const POPULER = ['BMW', 'Audi', 'Mercedes-Benz', 'Volkswagen', 'Toyota', 'Renault', 'Fiat'];
/** Kategori kartları (SihirbazMobilAkis: KAT); son üçü tasarımda yok, Karar 19'daki 14 kategori için eklendi */
const ALIM: { ad: string; alt: string; slug: string[] }[] = [
  { ad: 'Otomobil', alt: 'Sedan, hatchback, station', slug: ['otomobil'] },
  { ad: 'Arazi, SUV & Pickup', alt: '4x4, crossover, pikap', slug: ['arazi-suv-pickup'] },
  { ad: 'Elektrikli', alt: 'Tam elektrikli araçlar', slug: ['elektrikli'] },
  { ad: 'Motosiklet', alt: 'Scooter, naked, touring', slug: ['motosiklet'] },
  { ad: 'Ticari', alt: 'Panelvan, kamyonet, minibüs', slug: ['minivan-panelvan', 'ticari'] },
  { ad: 'Deniz', alt: 'Tekne, yat, jet ski', slug: ['deniz'] },
  { ad: 'Karavan', alt: 'Çekme ve motokaravan', slug: ['karavan'] },
  { ad: 'ATV & UTV', alt: 'Arazi motosikletleri', slug: ['atv', 'utv'] },
  { ad: 'Hasarlı', alt: 'Pert, ağır ve orta hasarlı', slug: ['hasarli'] },
  { ad: 'Klasik', alt: 'Yerli ve ithal klasikler', slug: ['klasik'] },
  { ad: 'Hava', alt: 'Uçak, helikopter, drone', slug: ['hava'] },
];
/** Kiralama (KATK): hepsi Kiralık Araçlar kategorisine, uygun olanlarda segment önceden seçilir */
const KIRALAMA: { ad: string; alt: string; segment?: string }[] = [
  { ad: 'Otomobil', alt: 'Sedan, hatchback, station' },
  { ad: 'Arazi, SUV & Pickup', alt: '4x4, crossover, pikap', segment: 'suv' },
  { ad: 'Elektrikli', alt: 'Tam elektrikli araçlar' },
  { ad: 'Ticari', alt: 'Panelvan, minibüs', segment: 'minivan' },
];
const ADIMLAR = [
  ['kategori', 'Kategori', 'Ne arıyorsun?', 'Önce ne tür bir araç aradığını seç.'],
  ['ana_arac', 'Ana araç', 'Aradığın araç hangisi?', 'Marka, seri ve modeli seç.'],
  ['kriterler', 'Kriterler', 'Kriterlerini belirle', 'Seçmediğin kriter “farketmez” sayılır.'],
  [
    'boya_hasar',
    'Boya ve hasar',
    'Boya, değişen ve hasar',
    'Hazır bir seçimle başla ya da parça parça belirle.',
  ],
  [
    'konum_iletisim',
    'Konum ve iletişim',
    'Nerede ve nasıl ulaşılsın?',
    'Konumunu ve satıcıların sana nasıl ulaşacağını seç.',
  ],
  ['onizleme', 'Önizleme', 'Kontrol et ve yayınla', 'Her şey doğruysa yayınla; satıcılar sana yazsın.'],
] as const;
type AdimKey = (typeof ADIMLAR)[number][0];

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
  status: string;
  step: number;
  category: { slug: string; name: string };
  data: Veri;
  contact: Iletisim;
  headline: string | null;
  schema: { fields: CategoryField[]; rules: CategoryRules } | null;
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

/** Hazır boya ve hasar seçimleri (SihirbazMobilAkis, 4. adım) */
const HAZIR = [
  {
    key: 'orijinal',
    ad: 'Boyasız ve değişensiz olsun',
    alt: 'Tüm parçalar orijinal; tramer kaydı en fazla 25.000 TL.',
  },
  { key: 'lokal', ad: 'Lokal boya olabilir, değişen olmasın', alt: 'En yaygın seçim.' },
  {
    key: 'farketmez',
    ad: 'Farketmez, ekspertizde bakarım',
    alt: 'Ağır hasar kaydı ve şasi işlemi yine kabul edilmez.',
  },
] as const;

function hazirUygula(k: string, alanlar: Values, f: CategoryField[]): Values {
  const a = { ...alanlar };
  const tum = (s: string) => Object.fromEntries(PAINT_PARTS.map((p) => [p.key, s]));
  if (k === 'orijinal') {
    a.boya = { limit: 0, parts: tum('orijinal') };
    delete a.islemKabul;
    if (f.some((x) => x.key === 'tramer')) a.tramer = 25_000;
  } else if (k === 'lokal') {
    a.boya = { limit: PAINT_PARTS.length, parts: tum('lokal') };
    delete a.islemKabul;
  } else {
    a.boya = { limit: PAINT_PARTS.length, parts: tum('degisen') };
    a.islemKabul = ['podye', 'airbag'];
  }
  return a;
}
function hazirOf(alanlar: Values) {
  const b = alanlar.boya as { parts: Record<string, string> } | undefined;
  if (!b) return null;
  const v = new Set(Object.values(b.parts));
  if (v.size !== 1) return null;
  const tek = [...v][0];
  if (tek === 'orijinal') return 'orijinal';
  if (tek === 'lokal' && !alanlar.islemKabul) return 'lokal';
  if (tek === 'degisen') return 'farketmez';
  return null;
}

/**
 * Talep oluşturma sihirbazı (tasarım: SihirbazMobilAkis, SihirbazMobil; Karar 04, 05, 21). Alanlar kategorinin
 * şemasından gelir; her değişiklik taslağa kaydedilir. Alternatifler web'deki gibi aynı aracın farklı kriterleridir
 * (Karar 05). Yayındaki talep "Düzenle" ile aynı ekranda açılır.
 */
export default function TalepOlustur() {
  const { durum, istek } = useOturum();
  const params = useLocalSearchParams<{ id?: string; hesap?: string }>();
  const kategoriler = useKategoriler();
  const [taslak, setTaslak] = useState<Taslak | null>(null);
  const [veri, setVeri] = useState<Veri>({ alanlar: {}, alternatifler: [{}] });
  const [iletisim, setIletisim] = useState<Iletisim>({
    phoneVisible: false,
    whatsappVisible: false,
    nameMode: 'tam',
  });
  const [baslik, setBaslik] = useState('');
  const [adim, setAdim] = useState<AdimKey>('kategori');
  const [islem, setIslem] = useState<'al' | 'kirala'>('al');
  const [grup, setGrup] = useState<string | null>(null);
  const [alt, setAlt] = useState(0);
  const [parca, setParca] = useState(false);
  const [uyari, setUyari] = useState<string | null>(null);
  const [hatalar, setHatalar] = useState<{ path: string; message: string }[]>([]);
  const [haklar, setHaklar] = useState<Haklar | null>(null);
  // Galeri adına talep (Karar 12.2, 20): sahip ya da yönetici olduğu galeriler
  const [galeriler, setGaleriler] = useState<{ accountId: string; ad: string }[]>([]);
  const [hesap, setHesap] = useState<string | null>(params.hesap ?? null);
  const [busy, setBusy] = useState(false);
  const kirli = useRef(false);
  const kaydirma = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (durum === 'misafir') router.replace('/giris');
  }, [durum]);

  const yukle = useCallback(
    async (id: string) => {
      const t = await istek<Taslak>(`/demands/${id}`);
      if (!['DRAFT', 'PUBLISHED', 'PASSIVE'].includes(t.status))
        return router.replace('/(sekmeler)/taleplerim');
      setTaslak(t);
      setVeri({
        alanlar: t.data?.alanlar ?? {},
        alternatifler: t.data?.alternatifler?.length ? t.data.alternatifler : [{}],
      });
      setIletisim(t.contact);
      setBaslik(t.headline ?? '');
      setIslem(t.category.slug === 'kiralik' ? 'kirala' : 'al');
      setAdim(
        t.status === 'DRAFT'
          ? (ADIMLAR[Math.max(1, Math.min(5, t.step - 1))]?.[0] ?? 'ana_arac')
          : 'ana_arac',
      );
    },
    [istek],
  );

  useEffect(() => {
    if (durum !== 'uye') return;
    istek<{ accountId: string; ad: string; rol: string; durum: string }[]>('/gallery/mine')
      .then((g) => setGaleriler(g.filter((x) => x.rol !== 'SALES' && x.durum === 'ACTIVE')))
      .catch(() => undefined);
    if (params.id) yukle(params.id).catch((e: Error) => setUyari(e.message));
  }, [durum, istek, params.id, yukle]);

  // Haklar seçili hesaba göre: taslak açıldıysa taslağın hesabı, değilse "Kimin adına" seçimi
  const etkinHesap = taslak ? (taslak.hesap?.id ?? null) : hesap;
  useEffect(() => {
    if (durum !== 'uye') return;
    istek<Haklar>(`/demands/rights${etkinHesap ? `?hesap=${etkinHesap}` : ''}`)
      .then(setHaklar)
      .catch(() => setHaklar(null));
  }, [durum, istek, etkinHesap]);

  const duzenle = Boolean(taslak && taslak.status !== 'DRAFT');
  const alanlar = taslak?.schema?.fields ?? [];
  const adimAlanlari = (k: AdimKey) => alanlar.filter((f) => f.step === k);
  const gorunen = ADIMLAR.filter(
    ([k]) =>
      !taslak?.schema ||
      ['kategori', 'kriterler', 'konum_iletisim', 'onizleme'].includes(k) ||
      adimAlanlari(k).length > 0,
  );
  const sira = Math.max(
    0,
    gorunen.findIndex(([k]) => k === adim),
  );
  const tanim = ADIMLAR.find(([k]) => k === adim) ?? ADIMLAR[0];

  // Taslak her değişiklikten 700 ms sonra kaydedilir (Karar 21); yayındaki talep yalnızca "Kaydet"le
  useEffect(() => {
    if (!taslak || !kirli.current || duzenle) return;
    const t = setTimeout(() => {
      kirli.current = false;
      istek(`/demands/${taslak.id}`, {
        method: 'PATCH',
        body: {
          data: veri,
          contact: iletisim,
          headline: baslik.trim().length >= 5 ? baslik.trim() : null,
          step: ADIMLAR.findIndex(([k]) => k === adim) + 1,
        },
      }).catch(() => undefined);
    }, 700);
    return () => clearTimeout(t);
  }, [taslak, veri, iletisim, baslik, adim, duzenle, istek]);

  const degistir = (fn: (v: Veri) => Veri) => {
    kirli.current = true;
    setVeri((v) => fn(v));
  };
  const yaz = (f: CategoryField) => (v: unknown) =>
    degistir((d) => {
      if (f.scope === 'talep') {
        const a = { ...d.alanlar };
        if (v === undefined) delete a[f.key];
        else a[f.key] = v;
        return { ...d, alanlar: a };
      }
      return {
        ...d,
        alternatifler: d.alternatifler.map((x, n) => {
          if (n !== alt) return x;
          const y = { ...x };
          if (v === undefined) delete y[f.key];
          else y[f.key] = v;
          return y;
        }),
      };
    });
  /**
   * Yeni alternatif bir öncekinin kopyasıyla başlar; değişeni düzeltmek yeterli. "Başka kasa" için açılanda kasa ve
   * kasaya bağlı seçimler (yıl, paket, yakıt, vites, kasa tipi) boş gelir (web ile aynı).
   */
  const alternatifEkle = (kasaIcin: boolean) => {
    degistir((d) => {
      const kopya = { ...(d.alternatifler[alt] ?? {}) };
      if (kasaIcin) for (const x of ['kasa', 'yil', 'paket', 'yakit', 'vites', 'kasaTipi']) delete kopya[x];
      return { ...d, alternatifler: [...d.alternatifler, kopya] };
    });
    setAlt(veri.alternatifler.length);
  };
  const deger = (f: CategoryField) =>
    f.scope === 'talep' ? veri.alanlar[f.key] : veri.alternatifler[alt]?.[f.key];
  const gorunur = (f: CategoryField) => {
    if (!f.when) return true;
    const v = { ...veri.alanlar, ...(veri.alternatifler[alt] ?? {}) }[f.when.field];
    if (Array.isArray(v)) return v.some((x) => f.when?.in.includes(String(x)));
    if (typeof v === 'boolean') return f.when.in.includes(v ? 'evet' : 'hayir');
    return v !== undefined && f.when.in.includes(String(v));
  };
  const hataOf = (f: CategoryField) =>
    hatalar.find(
      (h) => h.path.startsWith(`alanlar.${f.key}`) || h.path.startsWith(`alternatifler.${alt}.${f.key}`),
    )?.message;

  function git(k: AdimKey) {
    if (k !== 'kategori' && !taslak) return;
    kirli.current = true;
    setAdim(k);
    kaydirma.current?.scrollTo({ y: 0, animated: false });
  }

  async function kategoriSec(slug: string, segment?: string) {
    setUyari(null);
    if (duzenle) return setUyari('Yayındaki talebin kategorisi değiştirilemez.');
    if (taslak?.category.slug === slug) return git('ana_arac');
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
      router.setParams({ id: t.id });
      await yukle(t.id);
      if (segment) {
        kirli.current = true;
        setVeri((d) => ({
          ...d,
          alternatifler: d.alternatifler.map((x, i) => (i === 0 ? { ...x, segment: [segment] } : x)),
        }));
      }
      setAdim('ana_arac');
    } catch (e) {
      setUyari((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function bitir(cik = false) {
    if (!taslak) return router.back();
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
          step: ADIMLAR.findIndex(([k]) => k === adim) + 1,
        },
      });
      kirli.current = false;
      if (cik || duzenle) return router.replace('/(sekmeler)/taleplerim');
      await istek(`/demands/${taslak.id}/publish`, { method: 'POST' });
      router.replace('/(sekmeler)/taleplerim');
    } catch (e) {
      const h = e as IstekHatasi;
      if (h.body?.issues?.length) {
        setHatalar(h.body.issues);
        const p = h.body.issues[0]?.path.split('.') ?? [];
        const key = p[0] === 'alanlar' ? p[1] : p[2];
        if (p[0] === 'alternatifler') setAlt(Number(p[1]) || 0);
        const f = alanlar.find((x) => x.key === key);
        if (f) setAdim(f.step);
      }
      setUyari(h.message);
    } finally {
      setBusy(false);
    }
  }

  const katUst =
    kategoriler.find((c) => c.children.some((x) => x.slug === taslak?.category.slug))?.slug ?? null;
  const katalogKat = taslak
    ? katalogKategorisi(taslak.category.slug, katUst, veri.alanlar.aracTuru)
    : undefined;
  const katalogAlani = alanlar.find((f) => f.type === 'catalog');
  const aciklamaAlani = alanlar.find((f) => f.key === 'aciklama');
  const k = useKatalog(
    katalogAlani ? katalogKat : undefined,
    katalogAlani ? (veri.alanlar[katalogAlani.key] as KatalogDegeri | undefined) : undefined,
  );
  const acik = new Set(kategoriler.flatMap((c) => [c.slug, ...c.children.map((x) => x.slug)]));

  const kart = (children: ReactNode, key?: string) => (
    <View key={key} style={{ ...kartStil, marginBottom: 10 }}>
      {children}
    </View>
  );
  const ileri = adim === 'onizleme';
  const yayinlanamaz = ileri && !duzenle && (!haklar || haklar.talep < 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'bottom']}>
      <SihirbazTanitimi
        adim={adim}
        sira={sira + 1}
        toplam={gorunen.length}
        acik={adim === 'kategori' || Boolean(taslak)}
      />
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          paddingTop: 10,
          paddingHorizontal: 12,
          paddingBottom: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri"
            onPress={() => (sira > 0 ? git(gorunen[sira - 1]?.[0] ?? 'kategori') : router.back())}
            style={{
              width: 44,
              height: 44,
              borderRadius: butonOran(12),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ikon d="geri" />
          </Pressable>
          <T style={{ fontSize: 15, fontWeight: '800' }}>{duzenle ? 'Talebi düzenle' : 'Talep oluştur'}</T>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => bitir(true)}
            style={{ paddingVertical: 12, paddingHorizontal: 6 }}
          >
            <T style={{ color: colors.link, fontWeight: '700', fontSize: 14 }}>Kaydet</T>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
          {gorunen.map(([key], i) => (
            <View
              key={key}
              style={{
                flex: 1,
                height: 5,
                borderRadius: Math.min(radii.etiket, 3),
                backgroundColor: i <= sira ? colors.blue : colors.line,
              }}
            />
          ))}
        </View>
      </View>

      <ScrollView
        ref={kaydirma}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingTop: 18, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <T style={{ fontSize: 12.5, fontWeight: '700', color: colors.link }}>
          Adım {sira + 1} / {gorunen.length} ·{' '}
          {adim === 'kriterler' || adim === 'boya_hasar'
            ? `${tanim[1]}${veri.alternatifler.length > 1 && adim === 'kriterler' ? ` · Alternatif ${alt + 1}` : ''}`
            : tanim[1]}
        </T>
        <T
          accessibilityRole="header"
          style={{ marginTop: 4, marginBottom: 6, fontSize: 22, fontWeight: '800', lineHeight: 27 }}
        >
          {tanim[2]}
        </T>
        <T style={{ marginBottom: 16, fontSize: 13.5, color: colors.muted }}>{tanim[3]}</T>

        {uyari ? (
          <View
            accessibilityRole="alert"
            style={{
              marginBottom: 14,
              backgroundColor: '#FDECEC',
              borderRadius: butonOran(12),
              padding: 12,
            }}
          >
            <T style={{ color: '#A3271F', fontWeight: '700', fontSize: 13.5 }}>{uyari}</T>
            {hatalar.slice(1, 5).map((h) => (
              <T key={h.path} style={{ color: '#A3271F', fontSize: 12.5, marginTop: 2 }}>
                • {h.message}
              </T>
            ))}
          </View>
        ) : null}

        {adim === 'kategori' ? (
          <>
            {galeriler.length && (!taslak || taslak.hesap) ? (
              <View style={{ marginBottom: 14 }}>
                <T style={{ fontSize: 14, fontWeight: '700', marginBottom: 8 }}>Kimin adına?</T>
                <View
                  accessibilityRole="radiogroup"
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                >
                  {[{ accountId: null as string | null, ad: 'Kendi adıma' }, ...galeriler].map((g) => {
                    const on = etkinHesap === g.accountId;
                    return (
                      <Pressable
                        key={g.accountId ?? 'ben'}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on, disabled: !!taslak }}
                        disabled={!!taslak}
                        onPress={() => setHesap(g.accountId)}
                        style={{
                          borderWidth: on ? 2 : 1,
                          borderColor: on ? colors.blue : colors.line,
                          backgroundColor: on ? '#EEF3FF' : colors.surface,
                          borderRadius: radii.etiket,
                          paddingVertical: on ? 8 : 9,
                          paddingHorizontal: on ? 13 : 14,
                        }}
                      >
                        <T style={{ fontSize: 14, fontWeight: '700' }}>
                          {g.accountId ? `${g.ad} adına` : g.ad}
                        </T>
                      </Pressable>
                    );
                  })}
                </View>
                <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 6 }}>
                  {taslak
                    ? 'Taslak açıldıktan sonra hesap değişmez.'
                    : 'Galeri adına talepte paketin talep hakkı kullanılır, alıcı olarak galerinin adı görünür.'}
                </T>
              </View>
            ) : null}
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="İşlem"
              style={{
                flexDirection: 'row',
                gap: 6,
                backgroundColor: '#E9ECF4',
                borderRadius: radii.buton,
                padding: 4,
              }}
            >
              {(
                [
                  ['al', 'Satın almak'],
                  ['kirala', 'Kiralamak'],
                ] as const
              ).map(([key, ad]) => (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: islem === key }}
                  onPress={() => {
                    setIslem(key);
                    setGrup(null);
                  }}
                  style={{
                    flex: 1,
                    borderRadius: butonOran(11),
                    paddingVertical: 11,
                    alignItems: 'center',
                    backgroundColor: islem === key ? colors.surface : 'transparent',
                  }}
                >
                  <T style={{ fontSize: 14, fontWeight: '800' }}>{ad}</T>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {(islem === 'al'
                ? ALIM.filter((x) => x.slug.some((s) => acik.has(s)))
                : acik.has('kiralik')
                  ? KIRALAMA
                  : []
              ).map((x, i) => {
                const slugs = 'slug' in x ? (x.slug as string[]) : ['kiralik'];
                const on =
                  grup === x.ad ||
                  (!grup &&
                    taslak !== null &&
                    slugs.includes(taslak.category.slug) &&
                    (islem === 'al' || i === 0));
                return (
                  <Pressable
                    key={x.ad}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    disabled={busy}
                    onPress={() => {
                      if (islem === 'kirala')
                        return kategoriSec('kiralik', (x as { segment?: string }).segment);
                      const liste = slugs.flatMap((s) => {
                        const c = kategoriler.find((y) => y.slug === s);
                        return c?.children.length ? c.children.map((y) => y.slug) : [s];
                      });
                      if (liste.length > 1) setGrup(x.ad);
                      else if (liste[0]) kategoriSec(liste[0]);
                    }}
                    style={{
                      width: '48.8%',
                      borderWidth: on ? 2 : 1,
                      borderColor: on ? colors.blue : colors.line,
                      backgroundColor: on ? '#F5F8FF' : colors.surface,
                      borderRadius: kartOran(16),
                      paddingVertical: on ? 13 : 14,
                      paddingHorizontal: on ? 11 : 12,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: butonOran(11),
                        backgroundColor: TINTS[i % TINTS.length],
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 13,
                          height: 13,
                          borderRadius: 7,
                          backgroundColor: DOTS[i % DOTS.length],
                        }}
                      />
                    </View>
                    <T style={{ fontSize: 14.5, fontWeight: '800', marginTop: 10 }}>{x.ad}</T>
                    <T style={{ fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16 }}>{x.alt}</T>
                  </Pressable>
                );
              })}
            </View>
            {grup ? (
              <View style={{ ...kartStil, marginTop: 14 }}>
                <T style={{ fontSize: 14, fontWeight: '800', marginBottom: 8 }}>{grup} · alt kategori</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {(ALIM.find((x) => x.ad === grup)?.slug ?? [])
                    .flatMap((s) => {
                      const c = kategoriler.find((y) => y.slug === s);
                      return c ? (c.children.length ? c.children : [c]) : [];
                    })
                    .map((c) => (
                      <Cip
                        key={c.slug}
                        on={taslak?.category.slug === c.slug}
                        onPress={() => kategoriSec(c.slug)}
                      >
                        {c.name}
                      </Cip>
                    ))}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {adim === 'ana_arac' && taslak ? (
          <>
            {taslak.asistan && !duzenle ? (
              <Asistan
                doldur={async (metin) => {
                  const r = await istek<AsistanSonucu>(`/demands/${taslak.id}/asistan`, {
                    method: 'POST',
                    body: { metin },
                  });
                  kirli.current = false;
                  await yukle(taslak.id);
                  return r;
                }}
              />
            ) : null}
            {adimAlanlari('ana_arac')
              .filter((f) => f.type !== 'catalog' && gorunur(f))
              .map((f) => kart(<Alan f={f} value={deger(f)} onChange={yaz(f)} hata={hataOf(f)} />, f.key))}
            {katalogAlani ? (
              <>
                {kart(
                  <>
                    <Secici
                      etiket="Marka"
                      deger={(veri.alanlar[katalogAlani.key] as KatalogDegeri | undefined)?.make}
                      bos={k.hazir ? 'Seç' : 'Yükleniyor…'}
                      secenekler={(k.makes ?? []).map((m) => ({ key: m.key, ad: m.name }))}
                      onSec={(key) => yaz(katalogAlani)(key ? { make: key } : undefined)}
                    />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {(k.makes ?? [])
                        .filter((m) => POPULER.includes(m.name))
                        .slice(0, 5)
                        .map((m) => (
                          <Cip
                            key={m.key}
                            on={(veri.alanlar[katalogAlani.key] as KatalogDegeri | undefined)?.make === m.key}
                            onPress={() => yaz(katalogAlani)({ make: m.key })}
                          >
                            {m.name}
                          </Cip>
                        ))}
                    </View>
                    {k.series && k.series.length > 0 ? (
                      <View style={{ marginTop: 16 }}>
                        <Secici
                          etiket="Seri"
                          deger={(veri.alanlar[katalogAlani.key] as KatalogDegeri | undefined)?.series}
                          bos="Tüm seriler"
                          secenekler={k.series.map((s) => ({ key: s.key, ad: s.name }))}
                          onSec={(key) => {
                            const v = veri.alanlar[katalogAlani.key] as KatalogDegeri;
                            yaz(katalogAlani)({ make: v.make, ...(key ? { series: key } : {}) });
                          }}
                        />
                      </View>
                    ) : null}
                    {(k.models?.length ?? 0) > 0 ? (
                      <View style={{ marginTop: 16 }}>
                        <Secici
                          etiket="Model"
                          deger={(veri.alanlar[katalogAlani.key] as KatalogDegeri | undefined)?.model}
                          bos="Tüm modeller"
                          secenekler={(k.models ?? []).map((m) => ({ key: m.key, ad: m.name }))}
                          onSec={(key) => {
                            const v = veri.alanlar[katalogAlani.key] as KatalogDegeri;
                            yaz(katalogAlani)({ ...v, model: key });
                          }}
                        />
                      </View>
                    ) : null}
                    {k.teknik && teknikSatirlari(k.teknik).length ? (
                      <View
                        style={{
                          marginTop: 12,
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.line,
                          borderRadius: kartOran(14),
                          padding: 12,
                          gap: 4,
                        }}
                      >
                        <T style={{ fontWeight: '700', fontSize: 13, marginBottom: 4 }}>Teknik özellikler</T>
                        {teknikSatirlari(k.teknik).map(([etiket, deger]) => (
                          <View key={etiket} style={{ flexDirection: 'row', gap: 10 }}>
                            <T style={{ color: colors.muted, fontSize: 13, width: 110 }}>{etiket}</T>
                            <T style={{ fontSize: 13, fontWeight: '600', flex: 1 }}>{deger}</T>
                          </View>
                        ))}
                        <T style={{ color: colors.muted, fontSize: 11.5, marginTop: 4 }}>{TEKNIK_KAYNAK}</T>
                      </View>
                    ) : null}
                    {hataOf(katalogAlani) ? (
                      <T style={{ color: '#A3271F', fontWeight: '700', fontSize: 12.5, marginTop: 6 }}>
                        {hataOf(katalogAlani)}
                      </T>
                    ) : null}
                  </>,
                  'katalog',
                )}
                {k.detail ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 12,
                      alignItems: 'center',
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.line,
                      borderRadius: kartOran(16),
                      overflow: 'hidden',
                    }}
                  >
                    <View style={{ width: 118, height: 84, backgroundColor: '#DCE3F0' }} />
                    <View style={{ flex: 1, paddingVertical: 10, paddingRight: 12 }}>
                      <T style={{ fontSize: 14, fontWeight: '800' }}>
                        {[k.adlar.make, k.adlar.series, k.adlar.model].filter(Boolean).join(' ')}
                      </T>
                      <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 3, lineHeight: 17 }}>
                        Katalogda {k.kusaklar.length} kasa
                        {k.paketler.length ? ` ve ${k.paketler.length} donanım paketi` : ''} var; sonraki
                        adımda seçeceksin.
                      </T>
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {adim === 'kriterler' && taslak ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
              contentContainerStyle={{ gap: 6 }}
            >
              {veri.alternatifler.map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: alternatiflerin kimliği sırasıdır
                <Cip key={i} on={alt === i} onPress={() => setAlt(i)}>
                  {`Alternatif ${i + 1}`}
                </Cip>
              ))}
              {veri.alternatifler.length < MAX_ALTERNATIVES ? (
                <Cip on={false} onPress={() => alternatifEkle(false)}>
                  + Alternatif ekle
                </Cip>
              ) : null}
              {alt > 0 ? (
                <Cip
                  on={false}
                  onPress={() => {
                    degistir((d) => ({ ...d, alternatifler: d.alternatifler.filter((_, n) => n !== alt) }));
                    setAlt(alt - 1);
                  }}
                >
                  Bu alternatifi kaldır
                </Cip>
              ) : null}
            </ScrollView>
            <Kriterler
              alanlar={adimAlanlari('kriterler')}
              a={veri.alternatifler[alt] ?? {}}
              alt={alt}
              k={k}
              deger={deger}
              yaz={yaz}
              gorunur={gorunur}
              hataOf={hataOf}
              alternatifEkle={
                veri.alternatifler.length < MAX_ALTERNATIVES ? () => alternatifEkle(true) : undefined
              }
            />
          </>
        ) : null}

        {adim === 'boya_hasar' && taslak ? (
          <>
            {alanlar.some((f) => f.type === 'paint') ? (
              <>
                <View style={{ gap: 8 }}>
                  {HAZIR.map((h) => {
                    const on = hazirOf(veri.alanlar) === h.key;
                    return (
                      <Pressable
                        key={h.key}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() =>
                          degistir((d) => ({ ...d, alanlar: hazirUygula(h.key, d.alanlar, alanlar) }))
                        }
                        style={{
                          borderWidth: on ? 2 : 1,
                          borderColor: on ? colors.blue : colors.line,
                          backgroundColor: on ? '#F5F8FF' : colors.surface,
                          borderRadius: kartOran(16),
                          padding: on ? 13 : 14,
                        }}
                      >
                        <T style={{ fontSize: 15, fontWeight: '800' }}>{h.ad}</T>
                        <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 3 }}>{h.alt}</T>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setParca(!parca)}
                  style={{
                    ...kartStil,
                    marginTop: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <T style={{ fontSize: 15, fontWeight: '800' }}>Parça parça belirle</T>
                    <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
                      13 parçalı boya ve değişen şeması
                    </T>
                  </View>
                  <T style={{ fontSize: 18, color: colors.muted }}>{parca ? '▴' : '▸'}</T>
                </Pressable>
                {parca ? (
                  <View style={{ marginTop: 12 }}>
                    <ParcaSecimi
                      value={
                        veri.alanlar.boya as { limit: number; parts: Record<string, string> } | undefined
                      }
                      onChange={(v) => yaz(alanlar.find((f) => f.type === 'paint') as CategoryField)(v)}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
            {adimAlanlari('boya_hasar')
              .filter((f) => f.type !== 'paint' && gorunur(f))
              .map((f) => (
                <View key={f.key} style={{ marginTop: 12 }}>
                  {f.key === 'islemKabul'
                    ? kart(
                        <>
                          <T style={{ fontSize: 14, fontWeight: '800', marginBottom: 8 }}>
                            Hasar geçmişi · kabul ettiklerin
                          </T>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {(f.options ?? []).map((o) => {
                              const kabul = (veri.alanlar.islemKabul as string[] | undefined) ?? [];
                              return (
                                <Cip
                                  key={o.value}
                                  on={kabul.includes(o.value)}
                                  onPress={() => {
                                    const next = kabul.includes(o.value)
                                      ? kabul.filter((x) => x !== o.value)
                                      : [...kabul, o.value];
                                    yaz(f)(next.length ? next : undefined);
                                  }}
                                >
                                  {o.label}
                                </Cip>
                              );
                            })}
                          </View>
                          <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 6 }}>
                            Seçmediklerin kabul edilmez.
                          </T>
                        </>,
                      )
                    : kart(<Alan f={f} value={deger(f)} onChange={yaz(f)} hata={hataOf(f)} />)}
                </View>
              ))}
          </>
        ) : null}

        {adim === 'konum_iletisim' && taslak ? (
          <>
            {kart(
              <>
                <Konum
                  value={veri.alanlar.konum}
                  onChange={yaz(alanlar.find((f) => f.key === 'konum') as CategoryField)}
                />
                {hataOf(alanlar.find((f) => f.key === 'konum') as CategoryField) ? (
                  <T style={{ color: '#A3271F', fontWeight: '700', fontSize: 12.5, marginTop: 6 }}>
                    {hataOf(alanlar.find((f) => f.key === 'konum') as CategoryField)}
                  </T>
                ) : null}
                <T style={{ fontSize: 13, fontWeight: '800', marginTop: 14, marginBottom: 6 }}>
                  Talep başlığı
                </T>
                <TInput
                  accessibilityLabel="Talep başlığı"
                  maxLength={120}
                  value={baslik}
                  placeholder={taslak.category.name}
                  onChangeText={(s) => {
                    kirli.current = true;
                    setBaslik(s);
                  }}
                  style={girdiStil}
                />
                {/* Biçimli açıklama (sahip isteği, 17 Kasım 2026): araç çubuğu ve talep sayfası önizlemesi */}
                {aciklamaAlani ? (
                  <View style={{ marginTop: 14 }}>
                    <AciklamaEditoru
                      etiket={aciklamaAlani.label}
                      value={veri.alanlar.aciklama as string | undefined}
                      onChange={yaz(aciklamaAlani)}
                      hata={hataOf(aciklamaAlani)}
                    />
                  </View>
                ) : null}
              </>,
              'konum',
            )}
            {alanlar
              .filter(
                (f) => f.step === 'konum_iletisim' && !['konum', 'aciklama'].includes(f.key) && gorunur(f),
              )
              .map((f) => kart(<Alan f={f} value={deger(f)} onChange={yaz(f)} hata={hataOf(f)} />, f.key))}
            <T style={{ fontSize: 16, fontWeight: '800', marginTop: 10, marginBottom: 8 }}>
              Satıcılar sana nasıl ulaşsın?
            </T>
            <View style={{ ...kartStil, padding: 0 }}>
              {[
                {
                  ad: 'Uygulama içi mesaj',
                  alt: 'Her talepte açık; satıcılar tek ilk mesaj atabilir.',
                  sag: (
                    <T
                      style={{
                        fontSize: 12.5,
                        fontWeight: '700',
                        color: '#11683F',
                        backgroundColor: '#E7FAF0',
                        paddingVertical: 4,
                        paddingHorizontal: 9,
                        borderRadius: radii.etiket,
                      }}
                    >
                      Her zaman açık
                    </T>
                  ),
                },
                {
                  ad: 'Telefon numaramı göster',
                  alt: `${haklar?.telefonMaske ?? 'Numaran'} · talep sayfasında giriş yapmış kullanıcılara görünür.`,
                  sag: (
                    <Anahtar
                      label="Telefon numaramı göster"
                      on={iletisim.phoneVisible}
                      onPress={() => {
                        kirli.current = true;
                        setIletisim((c) => ({
                          ...c,
                          phoneVisible: !c.phoneVisible,
                          whatsappVisible: c.phoneVisible ? false : c.whatsappVisible,
                        }));
                      }}
                    />
                  ),
                },
                {
                  ad: 'WhatsApp’tan yazılabilsin',
                  alt: iletisim.phoneVisible
                    ? 'Numaran açık olduğu için kullanılabilir.'
                    : 'Önce telefon numaranı göstermelisin.',
                  sag: (
                    <Anahtar
                      label="WhatsApp’tan yazılabilsin"
                      on={iletisim.whatsappVisible}
                      disabled={!iletisim.phoneVisible}
                      onPress={() => {
                        kirli.current = true;
                        setIletisim((c) => ({ ...c, whatsappVisible: c.phoneVisible && !c.whatsappVisible }));
                      }}
                    />
                  ),
                },
                {
                  ad: 'Adım kısaltılsın',
                  alt: 'Soyadının yalnızca baş harfi görünür (ör. Ayşe Y.).',
                  sag: (
                    <Anahtar
                      label="Adım kısaltılsın"
                      on={iletisim.nameMode === 'kisa'}
                      onPress={() => {
                        kirli.current = true;
                        setIletisim((c) => ({ ...c, nameMode: c.nameMode === 'kisa' ? 'tam' : 'kisa' }));
                      }}
                    />
                  ),
                },
              ].map((s, i) => (
                <View
                  key={s.ad}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: 14,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: '#EEF0F5',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <T style={{ fontSize: 14.5, fontWeight: '800' }}>{s.ad}</T>
                    <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{s.alt}</T>
                  </View>
                  {s.sag}
                </View>
              ))}
            </View>
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
            k={k}
          />
        ) : null}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          paddingTop: 12,
          paddingHorizontal: 16,
          paddingBottom: 12,
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => (sira > 0 ? git(gorunen[sira - 1]?.[0] ?? 'kategori') : router.back())}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#D5DAE5',
            borderRadius: radii.buton,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <T style={{ fontSize: 15, fontWeight: '700' }}>Geri</T>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy || !taslak || yayinlanamaz}
          onPress={() => (ileri ? bitir() : git(gorunen[sira + 1]?.[0] ?? 'onizleme'))}
          style={{
            flex: 2,
            backgroundColor: colors.blue,
            borderRadius: radii.buton,
            paddingVertical: 15,
            alignItems: 'center',
            opacity: busy || !taslak || yayinlanamaz ? 0.55 : 1,
          }}
        >
          <T style={{ color: colors.onBlue, fontSize: 15.5, fontWeight: '800' }}>
            {busy
              ? 'Kaydediliyor…'
              : !ileri
                ? 'Devam et'
                : duzenle
                  ? 'Değişiklikleri kaydet'
                  : haklar?.ucretsizTalep && !haklar.galeri
                    ? 'Ücretsiz yayınla'
                    : 'Yayınla'}
          </T>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/**
 * 3. adım: alternatif başına kriterler, yukarıdan aşağı adım adım (sahip isteği, 17 Kasım 2026; web `Kriterler` ile
 * aynı kurallar). Önce kasa ve makyaj (tek seçilir; başka kasa için alternatif) ya da elle model yılı; sonra donanım
 * paketi ve diğer sorular sırayla açılır. Kasa seçildiyse model yılı kasadan gelir; yakıt ve vites o kasanın (ve
 * seçilen paketin) tiplerine göre daralır. Kasa tipi ve çekiş yalnızca seçilen kasa (ya da elle girilen yıllar) ve
 * paketteki bütün tiplerde kesin biliniyorsa ve en az iki farklı değer varsa sorulur (`kesinSecenekler`).
 */
function Kriterler({
  alanlar,
  a,
  alt,
  k,
  deger,
  yaz,
  gorunur,
  hataOf,
  alternatifEkle,
}: {
  alanlar: CategoryField[];
  /** Seçili alternatifin değerleri */
  a: Values;
  alt: number;
  k: ReturnType<typeof useKatalog>;
  deger: (f: CategoryField) => unknown;
  yaz: (f: CategoryField) => (v: unknown) => void;
  gorunur: (f: CategoryField) => boolean;
  hataOf: (f: CategoryField) => string | undefined;
  alternatifEkle?: () => void;
}) {
  const alanOf = (key: string) => alanlar.find((f) => f.key === key);
  const kasaAlani = alanlar.find((f) => f.source === 'katalog' && f.key === 'kasa');
  const yilAlani = alanOf('yil');
  // "Fark etmez" denen ve "yılı kendim gireceğim" seçilen sorular (alternatif başına; değer yazılmaz)
  const [gecilen, setGecilen] = useState<Record<number, string[]>>({});
  const [elleSecildi, setElleSecildi] = useState<Record<number, boolean>>({});
  const [eskiler, setEskiler] = useState(false);
  const gec = (key: string) => setGecilen((g) => ({ ...g, [alt]: [...new Set([...(g[alt] ?? []), key])] }));

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

  /** Kasa seçimi: model yılı kasadan gelir; kasaya uymayan yakıt, vites, kasa tipi, çekiş ve paket seçimden düşer */
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
  const kart = (children: ReactNode, key: string) => (
    <View key={key} style={{ ...kartStil, marginBottom: 10 }}>
      {children}
    </View>
  );
  const not = { fontSize: 12.5, color: colors.muted, marginTop: 8, lineHeight: 17 } as const;
  const katalogBaslik = (f: CategoryField) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <T style={{ fontSize: 14, fontWeight: '800', marginBottom: 8 }}>{f.label}</T>
      <T style={{ fontSize: 12, color: colors.muted }}>Katalogdan</T>
    </View>
  );

  return (
    <>
      {sorular.slice(0, acik).map((f) => {
        if (f.key === 'kasa' && f.source === 'katalog') {
          return kart(
            <>
              {katalogBaslik(f)}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {gosterilen.map((x) => (
                  <Cip key={x.value} on={x === seciliKusak} onPress={() => kusakSec(x.value)}>
                    {`${x.label} (${x.alt})`}
                  </Cip>
                ))}
                {gizli > 0 ? (
                  <Cip on={false} onPress={() => setEskiler(true)}>
                    {`Daha eski kasalar (${gizli})`}
                  </Cip>
                ) : null}
                {yilAlani ? (
                  <Cip on={elle} onPress={elleGir}>
                    Yılı kendim gireceğim
                  </Cip>
                ) : null}
              </View>
              {seciliKusak ? (
                <T style={{ fontSize: 13.5, fontWeight: '700', color: colors.link, marginTop: 10 }}>
                  Model yılı:{' '}
                  {seciliKusak.min === seciliKusak.max
                    ? seciliKusak.min
                    : `${seciliKusak.min}–${seciliKusak.max}`}{' '}
                  (seçtiğin kasadan)
                </T>
              ) : null}
              <T style={not}>
                Tek kasa seçilir. Başka bir kasa da istiyorsan{' '}
                {alternatifEkle ? (
                  <T
                    accessibilityRole="link"
                    onPress={alternatifEkle}
                    style={{ fontSize: 12.5, fontWeight: '700', color: colors.link }}
                  >
                    alternatif ekle
                  </T>
                ) : (
                  'alternatif ekle'
                )}
                . Yılı elle girersen kasa seçilmez.
              </T>
            </>,
            f.key,
          );
        }
        if (f.key === 'paket' && f.source === 'katalog') {
          const secili = (a[f.key] as string[] | undefined) ?? [];
          return kart(
            <>
              {katalogBaslik(f)}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {paketler.map((p) => (
                  <Cip
                    key={p.key}
                    on={secili.includes(p.key)}
                    onPress={() => {
                      const next = secili.includes(p.key)
                        ? secili.filter((y) => y !== p.key)
                        : [...secili, p.key];
                      yaz(f)(next.length ? next : undefined);
                    }}
                  >
                    {p.name}
                  </Cip>
                ))}
                <Cip
                  on={secili.length === 0 && gecilenler.has(f.key)}
                  onPress={() => {
                    yaz(f)(undefined);
                    gec(f.key);
                  }}
                >
                  Fark etmez
                </Cip>
              </View>
            </>,
            f.key,
          );
        }
        const daraltilmis = { ...f, options: secenekler(f) };
        const daraldi = yillar !== null && (f.options?.length ?? 0) > daraltilmis.options.length;
        const gecildi = gecilenler.has(f.key);
        return kart(
          <>
            <Alan
              f={daraltilmis}
              value={deger(f)}
              onChange={yaz(f)}
              hata={hataOf(f)}
              farkEtmez={f.required ? undefined : () => gec(f.key)}
              gecildi={gecildi}
            />
            {daraldi ? <T style={not}>Seçtiğin kasada satılanlar gösteriliyor.</T> : null}
            {!f.required &&
            (f.type === 'number' || f.type === 'range' || f.type === 'select') &&
            deger(f) === undefined ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: gecildi }}
                onPress={() => gec(f.key)}
                style={{ alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 }}
              >
                <T style={{ fontSize: 13, fontWeight: '700', color: gecildi ? colors.ink : colors.link }}>
                  {gecildi ? '✓ Fark etmez' : 'Fark etmez'}
                </T>
              </Pressable>
            ) : null}
          </>,
          f.key,
        );
      })}
      {acik < sorular.length ? (
        <T style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
          Bu soruyu yanıtlayınca sıradaki açılır ({acik} / {sorular.length}).
        </T>
      ) : null}
    </>
  );
}

function Onizleme({
  taslak,
  veri,
  baslik,
  iletisim,
  haklar,
  duzenle,
  k,
}: {
  taslak: Taslak;
  veri: Veri;
  baslik: string;
  iletisim: Iletisim;
  haklar: Haklar | null;
  duzenle: boolean;
  k: ReturnType<typeof useKatalog>;
}) {
  const konum = veri.alanlar.konum as { il?: string; ilce?: string } | undefined;
  const a0 = veri.alternatifler[0] ?? {};
  const y = a0.yil as { min?: number; max?: number } | undefined;
  const butce = veri.alternatifler
    .map((a) => a.butce as { min?: number; max?: number } | undefined)
    .filter(Boolean) as { min?: number; max?: number }[];
  const bmin = Math.min(...butce.map((b) => b.min ?? b.max ?? 0));
  const bmax = Math.max(...butce.map((b) => b.max ?? b.min ?? 0));
  const yakit = taslak.schema?.fields.find((f) => f.key === 'yakit');
  const vites = taslak.schema?.fields.find((f) => f.key === 'vites');
  const ad = (f: CategoryField | undefined, v: unknown) =>
    ((v as string[] | undefined) ?? [])
      .map((x) => f?.options?.find((o) => o.value === x)?.label ?? x)
      .join(', ');
  const boya = veri.alanlar.boya as { limit: number; parts: Record<string, string> } | undefined;
  const satirlar = [
    {
      k: 'Kasa / paket',
      v: `${((a0.kasa as string[] | undefined) ?? []).length} kasa · ${
        k.paketler
          .filter((p) => ((a0.paket as string[] | undefined) ?? []).includes(p.key))
          .map((p) => p.name)
          .join(', ') || 'farketmez'
      }`,
    },
    {
      k: 'Yıl ve km',
      v:
        [
          y?.min || y?.max ? `${y?.min ?? ''} – ${y?.max ?? ''}` : null,
          a0.km ? `≤${binlik(a0.km as number)} km` : null,
        ]
          .filter(Boolean)
          .join(' · ') || '—',
    },
    yakit || vites
      ? {
          k: 'Yakıt / vites',
          v: `${ad(yakit, a0.yakit) || 'Farketmez'} · ${ad(vites, a0.vites) || 'farketmez'}`,
        }
      : null,
    boya ? { k: 'Boya / hasar', v: `En fazla ${boya.limit} parçada işlem` } : null,
    {
      k: 'İletişim',
      v: iletisim.phoneVisible
        ? iletisim.whatsappVisible
          ? 'Mesaj, telefon, WhatsApp'
          : 'Mesaj ve telefon'
        : 'Yalnızca mesaj',
    },
  ].filter((x): x is { k: string; v: string } => x !== null);
  const rules = taslak.schema?.rules;
  return (
    <>
      <View style={{ ...kartStil, padding: 0, overflow: 'hidden', borderRadius: radii.kart }}>
        <View style={{ height: 168, backgroundColor: '#DCE3F0' }} />
        <View style={{ padding: 14 }}>
          <T style={{ fontSize: 16.5, fontWeight: '800', lineHeight: 22 }}>
            {baslik.trim() || taslak.category.name}
          </T>
          <T style={{ fontSize: 13, color: '#3A4052', marginTop: 4 }}>
            {[
              `${veri.alternatifler.length} alternatif`,
              [konum?.il, konum?.ilce].filter(Boolean).join(', '),
              // Bütçe tek rakam (sahip isteği, 17 Kasım 2026); alternatiflerin bütçeleri farklıysa aralık
              butce.length
                ? bmin === bmax
                  ? `${binlik(bmax)} TL`
                  : `${binlik(bmin)} – ${binlik(bmax)} TL`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </T>
        </View>
        {satirlar.map((s) => (
          <View
            key={s.k}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 12,
              paddingVertical: 11,
              paddingHorizontal: 14,
              borderTopWidth: 1,
              borderTopColor: '#EEF0F5',
            }}
          >
            <T style={{ fontSize: 13, color: colors.muted }}>{s.k}</T>
            <T style={{ fontSize: 13.5, fontWeight: '700', textAlign: 'right', flex: 1 }}>{s.v}</T>
          </View>
        ))}
      </View>
      {rules?.legalNotice ? (
        <View style={{ marginTop: 12, backgroundColor: '#FFF6DF', borderRadius: butonOran(12), padding: 12 }}>
          <T style={{ fontSize: 13, color: '#7A5300', lineHeight: 18 }}>{rules.legalNotice}</T>
        </View>
      ) : null}
      {duzenle ? null : (
        <>
          <T style={{ fontSize: 16, fontWeight: '800', marginTop: 20, marginBottom: 8 }}>
            Öne çıkar (isteğe bağlı)
          </T>
          <View style={{ gap: 8 }}>
            {ONE_CIKARMA.map((b) => (
              <View
                key={b.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.surface,
                  borderRadius: radii.buton,
                  padding: 14,
                  opacity: 0.7,
                }}
              >
                <View style={{ flex: 1 }}>
                  <T style={{ fontSize: 14.5, fontWeight: '800' }}>{b.ad} · 7 gün</T>
                  <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{b.aciklama}</T>
                </View>
                {haklar?.galeri ? null : (
                  <T style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>₺{fiyatYaz(b.mobil)}</T>
                )}
              </View>
            ))}
          </View>
          <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 8 }}>
            {haklar?.galeri
              ? `Talep ${haklar.galeri} adına yayınlanır. Paketindeki öne çıkarma hakkını yayından sonra Taleplerim'den kullanabilirsin.`
              : 'Öne çıkarmayı talebin yayındayken Hesabım › Haklarım ve ödemeler’den alabilirsin.'}
          </T>
        </>
      )}
      {haklar ? (
        haklar.talep > 0 ? (
          <View
            style={{
              marginTop: 14,
              flexDirection: 'row',
              gap: 10,
              backgroundColor: '#E7FAF0',
              borderRadius: radii.buton,
              padding: 13,
            }}
          >
            <Ikon d="onay" size={20} color="#11683F" />
            <T style={{ flex: 1, fontSize: 13.5, color: '#11683F', fontWeight: '600', lineHeight: 19 }}>
              {haklar.galeri
                ? `${haklar.galeri} galerisinin ${haklar.talep} talep hakkı var.`
                : haklar.ucretsizTalep
                  ? 'İlk talebin ücretsiz.'
                  : `${haklar.talep} talep hakkın var.`}{' '}
              {rules?.listingNote ?? `${rules?.listingDays ?? 30} gün yayında kalır`}; 7, 3 ve 1 gün önce
              hatırlatırız.
            </T>
          </View>
        ) : (
          <View style={{ marginTop: 14, backgroundColor: '#FFF6DF', borderRadius: radii.buton, padding: 13 }}>
            <T style={{ fontSize: 13.5, color: '#7A5300', fontWeight: '600', lineHeight: 19 }}>
              {/* Karar 38: galeri hesabında uygulamada satın alma yönlendirmesi yok */}
              {haklar.galeri
                ? `${haklar.galeri} galerisinin bu ayki talep hakkı bitti. Talebin taslak olarak saklanıyor.`
                : `Ücretsiz talep hakkını kullandın. Ek talep ₺${fiyatYaz(BIREYSEL_FIYATLAR.ekTalep.mobil)}; Hesabım › Haklarım ve ödemeler'den alabilirsin. Talebin taslak olarak saklanıyor.`}
            </T>
          </View>
        )
      ) : null}
    </>
  );
}

interface AsistanSonucu {
  doldurulan: { alan: string; deger: string }[];
  eksik: string[];
}

/**
 * Talep asistanı (Karar 42; özellik anahtarı `talep_asistani`): alıcı aradığı aracı kendi cümleleriyle yazar, asistan
 * formu doldurur; alıcı adımları kontrol edip kendisi yayınlar. Web ile aynı metinler.
 */
function Asistan({ doldur }: { doldur: (metin: string) => Promise<AsistanSonucu> }) {
  const [metin, setMetin] = useState('');
  const [busy, setBusy] = useState(false);
  const [sonuc, setSonuc] = useState<AsistanSonucu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const hazir = metin.trim().length >= 5;
  return (
    <View
      style={{
        borderWidth: 1.5,
        borderColor: '#C9B8FF',
        backgroundColor: '#FAF7FF',
        borderRadius: kartOran(16),
        padding: 14,
        marginBottom: 12,
      }}
    >
      <T style={{ fontSize: 15, fontWeight: '800', color: '#4B2FA6' }}>
        ✦ Aradığın aracı kendi cümlelerinle yaz
      </T>
      <T style={{ fontSize: 12.5, color: '#5A6073', marginTop: 3, marginBottom: 8, lineHeight: 17 }}>
        Asistan formu doldurur; adımları kontrol edip talebini sen yayınlarsın.
      </T>
      <TInput
        accessibilityLabel="Aradığın araç"
        multiline
        numberOfLines={3}
        maxLength={ASSISTANT_TEXT_MAX}
        value={metin}
        placeholder="Ör. 2019 sonrası otomatik, dizel, 1,5 milyon bütçe, İstanbul"
        onChangeText={setMetin}
        style={{
          borderWidth: 1,
          borderColor: '#D5DAE5',
          borderRadius: radii.buton,
          padding: 12,
          fontSize: 14.5,
          minHeight: 72,
          textAlignVertical: 'top',
          backgroundColor: '#FFFFFF',
        }}
      />
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}
      >
        <Pressable
          accessibilityRole="button"
          disabled={busy || !hazir}
          onPress={async () => {
            setBusy(true);
            setHata(null);
            try {
              setSonuc(await doldur(metin.trim()));
            } catch (e) {
              setHata((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          style={{ paddingVertical: 6, opacity: hazir ? 1 : 0.55 }}
        >
          <T style={{ fontSize: 13.5, fontWeight: '800', color: '#2450C8' }}>
            {busy ? 'Dolduruluyor…' : '✦ Formu doldur'}
          </T>
        </Pressable>
        <T style={{ fontSize: 12, color: '#5A6073' }}>
          {metin.length} / {ASSISTANT_TEXT_MAX}
        </T>
      </View>
      {hata ? (
        <T style={{ marginTop: 6, fontSize: 13, fontWeight: '600', color: '#A3271F' }}>{hata}</T>
      ) : null}
      {sonuc ? (
        <T style={{ marginTop: 8, fontSize: 13, lineHeight: 18 }}>
          {sonuc.doldurulan.length
            ? `Asistan doldurdu: ${sonuc.doldurulan.map((d) => `${d.alan}: ${d.deger}`).join(' · ')}`
            : 'Metinden bir alan çıkaramadım; marka, model, yıl ya da bütçe yazmayı dene.'}
          {sonuc.eksik.length
            ? `
Senin doldurman gerekenler: ${sonuc.eksik.join(', ')}`
            : ''}
        </T>
      ) : null}
    </View>
  );
}
