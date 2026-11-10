import {
  butonOran,
  colors,
  compactBudget,
  defaultHomeLayout,
  fiyatYaz,
  type HomeResponse,
  kartOran,
  ONE_CIKARMA,
  radii,
  tints,
  visibleSections,
} from '@rengarenk/shared';
import { router, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArananModeller,
  GaleriCagri,
  GaleriKarsilama,
  GelenMesajlar,
  GuvenRozetleri,
  HakKarti,
  KategoriKutulari,
  KayitliAramalar,
  PortfoyEslesmeleri,
  SikSorulanlar,
  TaleplerimOzeti,
} from '../../components/ana-bolumler';
import { Banner } from '../../components/banner';
import { Ikon } from '../../components/ikon';
import { Logo } from '../../components/logo';
import { MenuCekmecesi } from '../../components/menu-cekmecesi';
import { T, TInput } from '../../components/t';
import { API } from '../../lib/api';
import { useCanli } from '../../lib/canli';
import { useKategoriler } from '../../lib/kategoriler';
import { useOturum } from '../../lib/oturum';
import { yilAraligi, zaman } from '../../lib/talep-bicim';
import { aktifTema } from '../../lib/tasarim';

interface Kart {
  no: number;
  baslik: string;
  yilMin: number | null;
  yilMax: number | null;
  kmMax: number | null;
  butceMin: number | null;
  butceMax: number | null;
  il: string | null;
  yayin: string;
  foto: string | null;
}
type Yanit = { toplam: number; sonuclar: Kart[] };

const FOTO_YOK = ['#DCE3F0', '#E4DFEE', '#DCEAE3', '#EEE8DC'];
/** Vitrinin son satırını tamamlayan boş hücrelerin anahtarları */
const BOS = ['bos1', 'bos2'];
const VITRIN_FIYAT = ONE_CIKARMA.find((o) => o.key === 'vitrin')?.mobil ?? 359.99;

/**
 * Talepler; API'ye ulaşılamazsa (API ya da veritabanı yeniden başlıyor) ekran açık kaldıkça 1, 2, 4, 8, 15 sn ve sonra
 * yarım dakikada bir yeniden dener (vitrin ve son talepler kaybolmasın); `iptal` doğru dönünce durur.
 */
async function al(yol: string, iptal: () => boolean): Promise<Yanit | null> {
  for (let i = 0; ; i++) {
    const bekle = [0, 1000, 2000, 4000, 8000, 15000][i] ?? 30000;
    if (bekle) await new Promise((r) => setTimeout(r, bekle));
    if (iptal()) return null;
    try {
      const r = await fetch(`${API}${yol}`);
      if (r.ok) return (await r.json()) as Yanit;
    } catch {
      // yeniden dener
    }
  }
}

/** Talepler gelene kadar bölümün yeri (bölüm sessizce kaybolmaz) */
function Yukleniyor({ baslik }: { baslik: string }) {
  return (
    <View accessibilityState={{ busy: true }}>
      <T style={{ fontSize: 17, fontWeight: '800', marginBottom: 8 }}>{baslik}</T>
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: radii.kart,
          padding: 16,
        }}
      >
        <T style={{ fontSize: 13.5, color: colors.muted }}>Talepler yükleniyor…</T>
      </View>
    </View>
  );
}

const ADIMLAR = [
  {
    no: '1',
    renk: tints.blue,
    baslik: 'Talebini yaz',
    metin: 'Marka, model, paket, bütçe ve konumunu seç. 3 dakika sürer.',
  },
  {
    no: '2',
    renk: tints.pink,
    baslik: 'Satıcılar sana yazsın',
    metin: 'Uygun aracı olan galeriler ve satıcılar ilk mesajı gönderir.',
  },
  {
    no: '3',
    renk: tints.green,
    baslik: 'Sen seç',
    metin: 'Numaran sen izin verene kadar gizli kalır. Aracı görmeden ödeme yapma.',
  },
];

/**
 * Ana sayfa (tasarım: AnasayfaMobil, v.ana): beyaz üst bölüm (menü, logo, bildirimler, arama), tanıtım kartı, vitrin
 * (üç sütun, sıra her açılışta karışır; Karar 46), son talepler ve "Nasıl çalışır?".
 */
export default function Home() {
  const [menu, setMenu] = useState(false);
  const { durum, istek } = useOturum();
  const { width } = useWindowDimensions();
  // Zil (AnasayfaMobil: okunmamış rozeti); ekrana dönünce ve anlık iletimle güncellenir
  const [okunmamis, setOkunmamis] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (durum !== 'uye') return;
      istek<{ okunmamis: number }>('/notifications/unread')
        .then((r) => setOkunmamis(r.okunmamis))
        .catch(() => undefined);
    }, [durum, istek]),
  );
  useCanli((o) => {
    if (o.tip === 'bildirim' && typeof o.okunmamis === 'number') setOkunmamis(o.okunmamis);
  });
  const [vitrin, setVitrin] = useState<Yanit | null>(null);
  const [son, setSon] = useState<Yanit | null>(null);
  const kategoriler = useKategoriler().filter((c) => c.vertical === 'vasita');
  // Ana sayfa düzeni (Karar 46): görüntüleyenin kitlesine göre bölümler; yüklenene kadar tasarımdaki ziyaretçi düzeni
  const [v, setV] = useState<HomeResponse>({
    kitle: 'ziyaretci',
    sira: visibleSections(defaultHomeLayout().ziyaretci.mobil),
  });
  useEffect(() => {
    if (durum === 'yukleniyor') return;
    const yol = '/icerik/anasayfa?platform=mobil';
    (durum === 'uye'
      ? istek<HomeResponse>(yol)
      : fetch(`${API}${yol}`).then((r) => (r.ok ? (r.json() as Promise<HomeResponse>) : Promise.reject()))
    )
      .then(setV)
      .catch(() => undefined);
  }, [durum, istek]);
  const galeriIl = v.kitle === 'galeri' ? v.galeri?.il : undefined;
  useEffect(() => {
    let canli = true;
    al('/talepler/vitrin?boyut=17', () => !canli).then((x) => {
      if (canli && x) setVitrin(x);
    });
    return () => {
      canli = false;
    };
  }, []);
  // Galeri: kendi ilindeki son talepler; ilinde talep yoksa bütün Türkiye
  const [sonIl, setSonIl] = useState(false);
  useEffect(() => {
    let canli = true;
    (async () => {
      if (galeriIl) {
        const bolge = await al(
          `/talepler?sira=yeni&boyut=5&il=${encodeURIComponent(galeriIl)}`,
          () => !canli,
        );
        if (bolge?.sonuclar.length) return { y: bolge, il: true };
      }
      return { y: await al('/talepler?sira=yeni&boyut=5', () => !canli), il: false };
    })().then((x) => {
      if (!canli || !x.y) return;
      setSon(x.y);
      setSonIl(x.il);
    });
    return () => {
      canli = false;
    };
  }, [galeriIl]);
  const hucre = (width - 2) / 3;
  const vitrinSayi = (vitrin?.sonuclar.length ?? 0) + 1;
  const bosHucre = (3 - (vitrinSayi % 3)) % 3;

  const parca = (k: string): ReactNode => {
    switch (k) {
      case 'karsi':
        return v.kitle === 'galeri' && v.galeri ? (
          <GaleriKarsilama g={v.galeri} />
        ) : (
          <View
            style={{
              marginHorizontal: 12,
              backgroundColor: colors.ink,
              borderRadius: kartOran(16),
              paddingVertical: 10,
              paddingRight: 10,
              paddingLeft: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <T
              accessibilityRole="header"
              style={{ flex: 1, fontSize: 14.5, fontWeight: '800', lineHeight: 19, color: '#FFFFFF' }}
            >
              Aradığın aracı yaz, satıcılar sana gelsin.
            </T>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(durum === 'uye' ? '/talep-olustur' : '/giris')}
              style={{
                backgroundColor: colors.blue,
                borderRadius: butonOran(12),
                paddingVertical: 11,
                paddingHorizontal: 12,
                alignItems: 'center',
              }}
            >
              <T style={{ color: colors.onBlue, fontSize: 13.5, fontWeight: '800', lineHeight: 16 }}>
                Talep oluştur
              </T>
              <T style={{ color: colors.onBlue, fontSize: 10.5, fontWeight: '700', lineHeight: 13 }}>
                ilk talep ücretsiz
              </T>
            </Pressable>
          </View>
        );
      case 'kat':
        return <KategoriKutulari kategoriler={kategoriler} />;
      case 'vitrin':
        if (!vitrin) return <Yukleniyor baslik="Ana sayfa vitrini" />;
        return vitrin.sonuclar.length ? (
          <View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginHorizontal: 12,
                marginBottom: 8,
              }}
            >
              <T accessibilityRole="header" style={{ fontSize: 17, fontWeight: '800' }}>
                Ana sayfa vitrini
              </T>
              <T
                accessibilityRole="link"
                onPress={() => router.push('/talepler')}
                style={{ fontSize: 13.5, fontWeight: '700', color: colors.link }}
              >
                Tümünü gör ({vitrin.toplam})
              </T>
            </View>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 1,
                backgroundColor: colors.line,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: colors.line,
              }}
            >
              {vitrin.sonuclar.map((v, i) => (
                <Pressable
                  key={v.no}
                  accessibilityRole="link"
                  accessibilityLabel={v.baslik}
                  onPress={() => router.push(`/talep/${v.no}`)}
                  style={{
                    width: hucre,
                    backgroundColor: colors.surface,
                    paddingTop: 6,
                    paddingHorizontal: 6,
                    paddingBottom: 8,
                  }}
                >
                  <View
                    style={{
                      aspectRatio: 4 / 3,
                      borderRadius: butonOran(6),
                      overflow: 'hidden',
                      backgroundColor: FOTO_YOK[i % FOTO_YOK.length],
                    }}
                  >
                    {v.foto ? (
                      <Image
                        source={{ uri: `${API}${v.foto}` }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : null}
                  </View>
                  <T
                    numberOfLines={2}
                    style={{ fontSize: 11.5, fontWeight: '700', lineHeight: 15, marginTop: 5, height: 30 }}
                  >
                    {v.baslik}
                  </T>
                  <T
                    numberOfLines={1}
                    style={{ fontSize: 11.5, fontWeight: '800', color: colors.link, marginTop: 3 }}
                  >
                    {compactBudget(v.butceMin, v.butceMax) || ' '}
                  </T>
                  <T numberOfLines={1} style={{ fontSize: 10.5, color: colors.muted, marginTop: 1 }}>
                    {v.il ?? 'Tüm Türkiye'}
                  </T>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push(durum === 'uye' ? '/(sekmeler)/taleplerim' : '/giris')}
                style={{
                  width: hucre,
                  backgroundColor: tints.yellow,
                  padding: 8,
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <T style={{ fontSize: 12, fontWeight: '800', lineHeight: 16 }}>Talebin burada görünsün</T>
                <T style={{ fontSize: 10.5, color: '#5A3D00', lineHeight: 14 }}>7 gün ana sayfa vitrini</T>
                <T style={{ fontSize: 12, fontWeight: '800', color: '#7A5300', marginTop: 2 }}>
                  {fiyatYaz(VITRIN_FIYAT)} TL ›
                </T>
              </Pressable>
              {BOS.slice(0, bosHucre).map((k) => (
                <View key={k} style={{ width: hucre, backgroundColor: colors.surface }} />
              ))}
            </View>
            <T style={{ marginTop: 6, marginHorizontal: 12, fontSize: 11, color: colors.muted }}>
              Fotoğraflar temsilîdir · Wikimedia Commons ve galeri portföyleri · sıra her açılışta karışır
            </T>
          </View>
        ) : null;
      case 'son':
        if (!son) return <Yukleniyor baslik="Son talepler" />;
        return son.sonuclar.length ? (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginHorizontal: 12,
                marginBottom: 10,
              }}
            >
              <T accessibilityRole="header" style={{ fontSize: 17, fontWeight: '800' }}>
                {sonIl && v.galeri ? `Son talepler · ${v.galeri.il}` : 'Son talepler'}
              </T>
              <T
                accessibilityRole="link"
                onPress={() =>
                  router.push({
                    pathname: '/talepler',
                    params: sonIl && v.galeri ? { sira: 'yeni', il: v.galeri.il } : { sira: 'yeni' },
                  })
                }
                style={{ fontSize: 13.5, fontWeight: '700', color: colors.link }}
              >
                Tümü
              </T>
            </View>
            <View style={{ gap: 8, paddingHorizontal: 12 }}>
              {son.sonuclar.map((t) => (
                <Pressable
                  key={t.no}
                  accessibilityRole="link"
                  onPress={() => router.push(`/talep/${t.no}`)}
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.line,
                    borderRadius: kartOran(16),
                    padding: 12,
                  }}
                >
                  <View
                    style={{
                      width: 74,
                      height: 74,
                      borderRadius: butonOran(12),
                      overflow: 'hidden',
                      backgroundColor: '#E6EAF3',
                    }}
                  >
                    {t.foto ? (
                      <Image
                        source={{ uri: `${API}${t.foto}` }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T style={{ fontSize: 14, fontWeight: '800', lineHeight: 18 }}>{t.baslik}</T>
                    <T style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                      {[
                        yilAraligi(t.yilMin, t.yilMax),
                        t.kmMax ? `≤${new Intl.NumberFormat('tr-TR').format(t.kmMax)} km` : '',
                        t.il,
                        zaman(t.yayin),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </T>
                    <T style={{ fontSize: 14, fontWeight: '800', color: colors.link, marginTop: 5 }}>
                      {compactBudget(t.butceMin, t.butceMax, 'milyon')}
                    </T>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        ) : null;
      case 'nasil':
        return (
          <View
            style={{
              marginHorizontal: 12,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: radii.kart,
              padding: 16,
            }}
          >
            <T accessibilityRole="header" style={{ marginBottom: 10, fontSize: 16, fontWeight: '800' }}>
              Nasıl çalışır?
            </T>
            {ADIMLAR.map((a) => (
              <View key={a.no} style={{ flexDirection: 'row', gap: 12, paddingVertical: 8 }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radii.buton,
                    backgroundColor: a.renk,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <T style={{ fontSize: 13, fontWeight: '800' }}>{a.no}</T>
                </View>
                <View style={{ flex: 1 }}>
                  <T style={{ fontSize: 14, fontWeight: '800' }}>{a.baslik}</T>
                  <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{a.metin}</T>
                </View>
              </View>
            ))}
          </View>
        );
      case 'duyuru':
        return <Banner yer="duyuru" style={{ marginHorizontal: 12 }} />;
      case 'arama':
        return <KayitliAramalar />;
      case 'eslesme':
        return <PortfoyEslesmeleri />;
      case 'taleplerim':
        return v.taleplerim ? <TaleplerimOzeti liste={v.taleplerim} /> : null;
      case 'mesaj':
        return v.mesajlar ? <GelenMesajlar liste={v.mesajlar} /> : null;
      case 'hak':
        return v.galeri ? <HakKarti g={v.galeri} /> : null;
      case 'aranan':
        return v.aranan?.modeller.length ? <ArananModeller a={v.aranan} /> : null;
      case 'guven':
        return <GuvenRozetleri />;
      case 'sss':
        return <SikSorulanlar />;
      case 'galeri_cagri':
        return <GaleriCagri />;
      default:
        return null;
    }
  };
  const tema = aktifTema();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema?.ustBant ?? colors.surface }} edges={['top']}>
      <View
        style={{
          // Mevsimsel tema (Karar 46): tarih aralığında üst bölüm bant renginde, logonun yanında rozet
          backgroundColor: tema?.ustBant ?? colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          paddingTop: 10,
          paddingHorizontal: 12,
          paddingBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Menü ve kategoriler"
              accessibilityState={{ expanded: menu }}
              onPress={() => setMenu(true)}
              style={{
                width: 44,
                height: 44,
                borderRadius: butonOran(12),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ikon d="menu" color={tema?.ustYazi} />
            </Pressable>
            <Logo renk={tema?.ustYazi} />
            {tema?.rozet ? (
              <T style={{ fontSize: 12, fontWeight: '700', color: tema.ustYazi, marginLeft: 4 }}>
                {tema.rozet}
              </T>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Bildirimler, ${okunmamis} okunmamış`}
            onPress={() => router.push('/bildirimler')}
            style={{
              width: 44,
              height: 44,
              borderRadius: butonOran(12),
              backgroundColor: '#F3F5FA',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ikon d="zil" size={21} width={2} />
            {okunmamis > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  minWidth: 18,
                  height: 18,
                  borderRadius: radii.etiket,
                  backgroundColor: colors.pink,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}
              >
                <T style={{ color: colors.onPink, fontSize: 11, fontWeight: '800' }}>
                  {okunmamis > 99 ? '99+' : okunmamis}
                </T>
              </View>
            ) : null}
          </Pressable>
        </View>
        <View
          accessibilityRole="search"
          style={{
            marginTop: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#F3F5FA',
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: butonOran(12),
            paddingHorizontal: 12,
          }}
        >
          <Ikon d="ara" size={18} width={2} color={colors.muted} />
          <TInput
            accessibilityLabel="Talep ara"
            placeholder="Marka, model veya talep no ile ara"
            returnKeyType="search"
            onSubmitEditing={(e) =>
              router.push({ pathname: '/talepler', params: { q: e.nativeEvent.text.trim() } })
            }
            style={{ flex: 1, fontSize: 15, paddingVertical: 12 }}
          />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 24 }}
      >
        {parca('karsi')}
        <Banner yer="anasayfa_ust" style={{ marginHorizontal: 12, marginTop: 12 }} />
        {v.sira
          .filter((k) => k !== 'karsi')
          .map((k) => {
            const n = parca(k);
            return n ? (
              <View key={k} style={{ marginTop: 18 }}>
                {n}
              </View>
            ) : null;
          })}
      </ScrollView>
      <MenuCekmecesi acik={menu} kapat={() => setMenu(false)} />
    </SafeAreaView>
  );
}
