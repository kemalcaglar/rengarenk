import {
  butonOran,
  colors,
  compactBudget,
  DOTS,
  GALLERY_TRIAL,
  kartOran,
  MEMBER_ROLE_NAMES,
  type MemberRoleKey,
  radii,
} from '@rengarenk/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Banner } from '../components/banner';
import { BirYildiz } from '../components/bir-yildiz';
import { IlkMesaj } from '../components/ilk-mesaj';
import { T } from '../components/t';
import { API } from '../lib/api';
import { basHarf, useOturum } from '../lib/oturum';

const WEB = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';

interface Panel {
  accountId: string;
  durum: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  rol: MemberRoleKey;
  galeri: { slug: string; ad: string };
  paket: {
    key: string;
    ad: string;
    denemeKalanGun: number | null;
    saltOkunur: boolean;
    portfoy: number | null;
    gunlukMesaj: number;
    aylikTalep?: number;
    oneCikarma?: number;
    calisan: number;
  };
  ekip: { userId: string }[];
}
interface Portfoy {
  aktif: number;
  sinir: number | null;
  araclar: {
    id: string;
    ad: string;
    detay: string;
    fiyat: number;
    durum: string;
    durumAd: string;
    foto: string | null;
    duzenlenebilir: boolean;
  }[];
}
const DURUM_RENK: Record<string, [string, string]> = {
  PUBLISHED: ['#E7FAF0', '#11683F'],
  PENDING_EIDS: ['#FFF6DF', '#7A5300'],
  REJECTED: ['#FDECEC', '#A3271F'],
};

interface Eslesmeler {
  eslesme: boolean;
  gunlukMesaj: number;
  kalanMesaj: number;
  yeni: number;
  toplam: number;
  araclar: { id: string; ad: string; sayi: number }[];
  eslesmeler: {
    id: string;
    skor: number;
    uyum: string;
    zaman: string;
    sohbet: string | null;
    arac: { id: string; no: number; ad: string; foto: string | null };
    talep: {
      no: number;
      baslik: string;
      sahip: string;
      il: string | null;
      ilce: string | null;
      butceMin: number | null;
      butceMax: number | null;
    };
  }[];
}

/** "12 dk", "1 sa", "Dün", "3 gün" (GaleriMobil.dc.html) */
function kisaZaman(iso: string) {
  const dk = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (dk < 60) return `${dk} dk`;
  if (dk < 24 * 60) return `${Math.round(dk / 60)} sa`;
  const gun = Math.floor(dk / (24 * 60));
  return gun <= 1 ? 'Dün' : `${gun} gün`;
}

interface Davet {
  id: string;
  galeri: string;
  rolAd: string;
}

/** Alt sekmeler (GaleriMobil.dc.html); Mesajlar ortak mesaj ekranına gider (galeri sohbetleri dahil) */
const SEKME: { ad: string; key: string; d: string; orta?: true; acik?: true }[] = [
  { ad: 'Panel', key: 'panel', d: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 4v3h6V4z', acik: true },
  { ad: 'Eşleşmeler', key: 'eslesme', d: 'M7 7h10l-3-3M17 17H7l3 3', acik: true },
  { ad: 'Araç ekle', key: 'ekle', d: 'M12 5v14M5 12h14', orta: true, acik: true },
  { ad: 'Portföy', key: 'portfoy', d: 'M3 13l2-6h14l2 6v5H3zM7 18v2M17 18v2M6 13h12', acik: true },
  { ad: 'Mesajlar', key: 'mesaj', d: 'M4 5h16v11H9l-5 4z', acik: true },
];

const kart = {
  get backgroundColor() {
    return colors.surface;
  },
  borderWidth: 1,
  get borderColor() {
    return colors.line;
  },
} as const;

/**
 * Galeri paneli (tasarım: GaleriMobil.dc.html; Karar 12.5, 20, 38). Uygulamada paket fiyatı ve satın alma
 * yönlendirmesi gösterilmez (Karar 38). Ekip ve paket web panelden yönetilir.
 */
export default function GaleriPaneli() {
  const { durum, istek } = useOturum();
  const [p, setP] = useState<Panel | null>(null);
  const [davetler, setDavetler] = useState<Davet[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [gorunum, setGorunum] = useState<'panel' | 'portfoy' | 'eslesme'>('panel');
  const [portfoy, setPortfoy] = useState<Portfoy | null>(null);
  const [eslesme, setEslesme] = useState<Eslesmeler | null>(null);
  const [aracFiltre, setAracFiltre] = useState<string | null>(null);
  const [yaz, setYaz] = useState<Eslesmeler['eslesmeler'][number] | null>(null);
  // Yıldızlar ve rozetler (Karar 55): galeri kendi ortalamasını ve rozete ne kadar kaldığını görür
  const [guven, setGuven] = useState<{
    yildizSayisi: number;
    yildizOrtalama: number | null;
    rozetler: { rozet: string; var: boolean; eksik: string[] }[];
    takipci: number;
  } | null>(null);
  const [gonderilen, setGonderilen] = useState<Record<string, string>>({});

  const yukle = useCallback(async () => {
    const g = await istek<{ accountId: string }[]>('/gallery/mine');
    const ilk = g[0];
    if (!ilk) {
      const d = await istek<Davet[]>('/me/invites');
      if (!d.length) {
        router.replace('/kurumsal-basvuru');
        return;
      }
      setDavetler(d);
      return;
    }
    setDavetler(null);
    const [x, l, e] = await Promise.all([
      istek<Panel>(`/gallery/${ilk.accountId}`),
      istek<Portfoy>(`/gallery/${ilk.accountId}/portfolio`).catch(() => null),
      istek<Eslesmeler>(`/gallery/${ilk.accountId}/matches`).catch(() => null),
    ]);
    setP(x);
    setPortfoy(l);
    setEslesme(e);
    istek<NonNullable<typeof guven>>(`/gallery/${ilk.accountId}/trust`)
      .then(setGuven)
      .catch(() => undefined);
  }, [istek]);

  useFocusEffect(
    useCallback(() => {
      if (durum === 'misafir') router.replace('/giris');
      if (durum === 'uye') yukle().catch((e: Error) => setHata(e.message));
    }, [durum, yukle]),
  );

  async function yanitla(d: Davet, kabul: boolean) {
    try {
      await istek(`/me/invites/${d.id}/${kabul ? 'accept' : 'decline'}`, { method: 'POST' });
      await yukle();
    } catch (e) {
      Alert.alert('Davet', (e as Error).message);
    }
  }

  const deneme = p?.paket.key === 'deneme';

  function eslesmeAc() {
    setGorunum('eslesme');
    if (p && eslesme?.yeni) {
      istek(`/gallery/${p.accountId}/matches/seen`, { method: 'POST' })
        .then(() => setEslesme((e) => (e ? { ...e, yeni: 0 } : e)))
        .catch(() => undefined);
    }
  }
  const eslesmeListe = (eslesme?.eslesmeler ?? []).filter((e) => !aracFiltre || e.arac.id === aracFiltre);
  // Paket hakları yürürlükteki fiyat listesinden (API)
  const plan =
    p && !deneme ? { aylikTalep: p.paket.aylikTalep ?? 0, oneCikarma: p.paket.oneCikarma ?? 0 } : null;
  const haklar = p
    ? [
        {
          ad: 'Portföy',
          deger: portfoy?.aktif ?? 0,
          max: p.paket.portfoy === null ? '∞' : String(p.paket.portfoy),
          not:
            p.paket.portfoy === null
              ? 'Sınırsız'
              : `${Math.max(0, p.paket.portfoy - (portfoy?.aktif ?? 0))} araç daha`,
        },
        {
          ad: 'Bugünkü ilk mesaj',
          deger: eslesme ? eslesme.gunlukMesaj - eslesme.kalanMesaj : 0,
          max: String(p.paket.gunlukMesaj),
          not: "Her gece 00:00'da yenilenir",
        },
        {
          ad: deneme ? 'Deneme talep hakkı' : 'Bu ay açılan talep',
          max: String(deneme ? GALLERY_TRIAL.talep : (plan?.aylikTalep ?? 0)),
          not: 'Kendi araç arayışların için',
        },
        {
          ad: 'Öne çıkarma',
          max: String(deneme ? 0 : (plan?.oneCikarma ?? 0)),
          not: deneme ? 'Denemede yok' : 'Bu ay kullanılabilir',
        },
      ]
    : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'bottom']}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          paddingTop: 10,
          paddingHorizontal: 12,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: butonOran(12),
            backgroundColor: '#FFF6DF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T style={{ color: '#7A5300', fontWeight: '800', fontSize: 13 }}>
            {basHarf(p?.galeri.ad ?? 'Galeri')}
          </T>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T accessibilityRole="header" style={{ fontSize: 16, fontWeight: '800' }}>
            {davetler
              ? 'Galeri davetlerin'
              : gorunum === 'portfoy'
                ? 'Portföy'
                : gorunum === 'eslesme'
                  ? 'Eşleşmeler'
                  : 'Panel'}
          </T>
          {p ? (
            <T numberOfLines={1} style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>
              {p.galeri.ad} ·{' '}
              {deneme
                ? `Deneme, ${p.paket.denemeKalanGun} gün kaldı`
                : plan
                  ? `${p.paket.ad} paket`
                  : 'Paket yok'}
            </T>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Alıcı görünümüne geç"
          onPress={() => router.replace('/')}
          style={{
            borderWidth: 1,
            borderColor: '#D5DAE5',
            borderRadius: butonOran(10),
            paddingVertical: 9,
            paddingHorizontal: 10,
          }}
        >
          <T style={{ fontSize: 12.5, fontWeight: '700' }}>Alıcı modu</T>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 12, paddingBottom: 24 }}
      >
        <Banner yer="galeri_paneli" style={{ marginBottom: 12 }} />
        {hata ? (
          <T
            style={{
              marginBottom: 10,
              backgroundColor: '#FFF0EE',
              color: '#A3271F',
              borderRadius: butonOran(12),
              padding: 12,
            }}
          >
            {hata}
          </T>
        ) : null}

        {davetler ? (
          <>
            <T
              style={{
                marginHorizontal: 4,
                marginBottom: 10,
                fontSize: 13,
                color: colors.muted,
                lineHeight: 19,
              }}
            >
              Kabul edince galerinin paneline erişirsin; mesajlarda galeri adıyla birlikte kendi adın görünür.
            </T>
            {davetler.map((d) => (
              <View key={d.id} style={{ ...kart, borderRadius: kartOran(16), padding: 14, marginBottom: 8 }}>
                <T style={{ fontSize: 15, fontWeight: '800' }}>{d.galeri}</T>
                <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
                  {d.rolAd} olarak davet edildin
                </T>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => yanitla(d, false)}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: '#D5DAE5',
                      borderRadius: butonOran(12),
                      paddingVertical: 11,
                      alignItems: 'center',
                    }}
                  >
                    <T style={{ fontWeight: '700' }}>Reddet</T>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => yanitla(d, true)}
                    style={{
                      flex: 2,
                      backgroundColor: colors.blue,
                      borderRadius: butonOran(12),
                      paddingVertical: 11,
                      alignItems: 'center',
                    }}
                  >
                    <T style={{ color: colors.onBlue, fontWeight: '800' }}>Kabul et</T>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {p?.durum === 'SUSPENDED' ? (
          <T
            style={{
              marginBottom: 10,
              backgroundColor: '#FDECEC',
              color: '#A3271F',
              borderRadius: butonOran(12),
              padding: 12,
              fontWeight: '700',
            }}
          >
            Galeri hesabın askıya alındı. Ayrıntı için destek ekibimize yaz.
          </T>
        ) : null}
        {p?.paket.saltOkunur ? (
          <T
            style={{
              marginBottom: 10,
              backgroundColor: '#FFF6DF',
              color: '#7A5300',
              borderRadius: butonOran(12),
              padding: 12,
              fontWeight: '700',
            }}
          >
            {deneme ? 'Deneme süren bitti.' : 'Paketin sona erdi.'} Paket seçilene kadar yalnızca portföyünü
            görüntüleyebilirsin.
          </T>
        ) : null}

        {p && gorunum === 'eslesme' ? (
          <>
            <View
              style={{
                ...kart,
                borderRadius: radii.buton,
                paddingVertical: 12,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <T style={{ fontSize: 13, color: '#3A4052' }}>Bugün kalan ilk mesaj</T>
              <T style={{ fontSize: 15, fontWeight: '800' }}>
                {eslesme?.kalanMesaj ?? p.paket.gunlukMesaj} / {eslesme?.gunlukMesaj ?? p.paket.gunlukMesaj}
              </T>
            </View>
            {eslesme?.eslesme && eslesme.araclar.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, marginTop: 10, marginBottom: 4 }}
              >
                {[{ id: null as string | null, ad: 'Tümü' }, ...eslesme.araclar].map((a) => {
                  const secili = aracFiltre === a.id;
                  return (
                    <Pressable
                      key={a.id ?? 'tumu'}
                      accessibilityRole="button"
                      accessibilityState={{ selected: secili }}
                      onPress={() => setAracFiltre(a.id)}
                      style={{
                        borderWidth: 1,
                        borderColor: secili ? colors.ink : '#D5DAE5',
                        backgroundColor: secili ? colors.ink : colors.surface,
                        borderRadius: radii.etiket,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                      }}
                    >
                      <T style={{ fontSize: 13, fontWeight: '700', color: secili ? '#FFFFFF' : colors.ink }}>
                        {a.ad}
                      </T>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            {eslesme && !eslesme.eslesme ? (
              <View style={{ ...kart, borderRadius: kartOran(16), padding: 14, marginTop: 8 }}>
                <T style={{ fontSize: 13.5, color: colors.muted, lineHeight: 19 }}>
                  Otomatik eşleşme Profesyonel ve Kurumsal paketlerdedir. Talepleri arayarak bulup
                  yazabilirsin.
                </T>
              </View>
            ) : null}
            {eslesme?.eslesme && !eslesmeListe.length ? (
              <View style={{ ...kart, borderRadius: kartOran(16), padding: 14, marginTop: 8 }}>
                <T style={{ fontSize: 13.5, color: colors.muted, lineHeight: 19 }}>
                  Henüz eşleşme yok. Yayındaki araçlarına uyan yeni talepler burada görünür.
                </T>
              </View>
            ) : null}
            {eslesmeListe.map((e) => (
              <View key={e.id} style={{ ...kart, borderRadius: kartOran(16), padding: 14, marginTop: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <T
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: '#11683F',
                      backgroundColor: '#E7FAF0',
                      paddingVertical: 3,
                      paddingHorizontal: 8,
                      borderRadius: radii.etiket,
                      overflow: 'hidden',
                    }}
                  >
                    %{e.skor} uyum
                  </T>
                  <T style={{ fontSize: 11.5, color: colors.muted }}>{kisaZaman(e.zaman)}</T>
                </View>
                <T
                  accessibilityRole="link"
                  onPress={() => router.push(`/talep/${e.talep.no}`)}
                  style={{ fontSize: 15, fontWeight: '800', marginTop: 8, lineHeight: 20 }}
                >
                  {e.talep.baslik}
                </T>
                <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 3 }}>
                  {[
                    e.talep.sahip,
                    [e.talep.il, e.talep.ilce].filter(Boolean).join(', '),
                    compactBudget(e.talep.butceMin, e.talep.butceMax, 'milyon'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </T>
                <T style={{ fontSize: 12.5, color: '#3A4052', marginTop: 6 }}>{e.uyum}</T>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 10,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: '#EEF0F5',
                  }}
                >
                  <View
                    style={{
                      width: 46,
                      height: 34,
                      borderRadius: butonOran(8),
                      overflow: 'hidden',
                      backgroundColor: '#DCE3F0',
                    }}
                  >
                    {e.arac.foto ? (
                      <Image
                        source={{ uri: `${API}${e.arac.foto}` }}
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : null}
                  </View>
                  <T numberOfLines={2} style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: '700' }}>
                    {e.arac.ad}
                  </T>
                  {e.sohbet || gonderilen[e.id] ? (
                    <T
                      accessibilityRole="link"
                      onPress={() => router.push(`/sohbet/${e.sohbet ?? gonderilen[e.id]}`)}
                      style={{ fontSize: 12.5, fontWeight: '800', color: '#11683F', paddingVertical: 10 }}
                    >
                      ✓ Gönderildi
                    </T>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setYaz(e)}
                      style={{
                        backgroundColor: '#5B8CFF',
                        borderRadius: butonOran(12),
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                      }}
                    >
                      <T style={{ fontSize: 13.5, fontWeight: '800' }}>İlk mesaj at</T>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </>
        ) : null}

        {p && gorunum === 'portfoy' ? (
          <>
            <T style={{ marginHorizontal: 4, marginBottom: 10, fontSize: 13, color: '#3A4052' }}>
              <T style={{ fontSize: 13, fontWeight: '800' }}>
                {portfoy?.aktif ?? 0} / {portfoy?.sinir ?? '∞'}
              </T>{' '}
              araç · yalnızca doğrulanmış araçlar görünür
            </T>
            {(portfoy?.araclar ?? []).map((a) => {
              const [bg, fg] = DURUM_RENK[a.durum] ?? ['#F3F5FA', '#3A4052'];
              return (
                <Pressable
                  key={a.id}
                  accessibilityRole="button"
                  disabled={!a.duzenlenebilir || a.durum === 'SOLD'}
                  onPress={() =>
                    router.push({ pathname: '/galeri-arac', params: { accountId: p.accountId, id: a.id } })
                  }
                  style={{
                    ...kart,
                    flexDirection: 'row',
                    gap: 12,
                    borderRadius: kartOran(16),
                    padding: 10,
                    marginBottom: 8,
                    opacity: a.durum === 'SOLD' ? 0.6 : 1,
                  }}
                >
                  <View
                    style={{
                      width: 88,
                      height: 66,
                      borderRadius: butonOran(10),
                      overflow: 'hidden',
                      backgroundColor: '#DCE3F0',
                    }}
                  >
                    {a.foto ? (
                      <Image source={{ uri: `${API}${a.foto}` }} style={{ width: '100%', height: '100%' }} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T numberOfLines={1} style={{ fontSize: 14, fontWeight: '800' }}>
                      {a.ad}
                    </T>
                    <T style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{a.detay}</T>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        marginTop: 6,
                      }}
                    >
                      <T style={{ fontSize: 14, fontWeight: '800', color: colors.link }}>
                        {new Intl.NumberFormat('tr-TR').format(a.fiyat)} TL
                      </T>
                      <T
                        style={{
                          fontSize: 11,
                          fontWeight: '800',
                          paddingVertical: 3,
                          paddingHorizontal: 8,
                          borderRadius: radii.etiket,
                          overflow: 'hidden',
                          backgroundColor: bg,
                          color: fg,
                        }}
                      >
                        {a.durumAd}
                      </T>
                    </View>
                  </View>
                </Pressable>
              );
            })}
            {/* GaleriMobil.dc.html: toplu yükleme web panelde; düğme web paneldeki Toplu yükleme bölümünü açar */}
            <Pressable
              accessibilityRole="link"
              accessibilityHint="Tarayıcıda galeri panelini açar"
              onPress={() => Linking.openURL(`${WEB}/galeri-paneli?bolum=toplu`)}
              style={{
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: '#A9B6D6',
                borderRadius: radii.buton,
                padding: 13,
                alignItems: 'center',
              }}
            >
              <T style={{ fontSize: 14, fontWeight: '700', color: colors.link }}>
                Excel/CSV ile toplu yükleme web panelde
              </T>
            </Pressable>
          </>
        ) : null}

        {p &&
        gorunum === 'panel' &&
        (portfoy?.araclar.filter((a) => a.durum === 'PENDING_EIDS').length ?? 0) > 0 ? (
          <View
            style={{
              marginBottom: 10,
              flexDirection: 'row',
              gap: 10,
              alignItems: 'center',
              backgroundColor: '#FFF6DF',
              borderRadius: radii.buton,
              paddingVertical: 12,
              paddingHorizontal: 14,
            }}
          >
            <T style={{ fontSize: 18 }}>⏳</T>
            <T style={{ flex: 1, fontSize: 13, color: '#5A3D00', lineHeight: 19 }}>
              <T style={{ fontSize: 13, fontWeight: '800', color: '#5A3D00' }}>
                {portfoy?.araclar.filter((a) => a.durum === 'PENDING_EIDS').length} araç EİDS doğrulaması
                bekliyor.
              </T>{' '}
              Doğrulanana kadar alıcılara görünmez.
            </T>
            <T
              onPress={() => setGorunum('portfoy')}
              style={{ fontSize: 13, fontWeight: '800', color: '#7A5300' }}
            >
              Gör
            </T>
          </View>
        ) : null}

        {p && gorunum === 'panel' ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {haklar.map((h, i) => (
                <View key={h.ad} style={{ ...kart, borderRadius: kartOran(16), padding: 12, width: '48.5%' }}>
                  <T style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>{h.ad}</T>
                  <T style={{ marginTop: 4 }}>
                    <T style={{ fontSize: 22, fontWeight: '800' }}>{'deger' in h ? h.deger : 0}</T>
                    <T style={{ fontSize: 13, color: colors.muted, fontWeight: '700' }}> / {h.max}</T>
                  </T>
                  <View
                    style={{
                      height: 6,
                      borderRadius: Math.min(radii.etiket, 3),
                      backgroundColor: '#EEF0F5',
                      marginTop: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <View style={{ height: 6, width: '0%', backgroundColor: DOTS[i] }} />
                  </View>
                  <T style={{ fontSize: 11.5, color: colors.muted, marginTop: 6 }}>{h.not}</T>
                </View>
              ))}
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginTop: 20,
                marginHorizontal: 4,
                marginBottom: 8,
              }}
            >
              <T accessibilityRole="header" style={{ fontSize: 16, fontWeight: '800' }}>
                Yeni eşleşmeler
              </T>
              {eslesme?.eslesme && eslesme.toplam ? (
                <T
                  accessibilityRole="button"
                  onPress={eslesmeAc}
                  style={{ fontSize: 13.5, fontWeight: '700', color: colors.link, paddingVertical: 6 }}
                >
                  Tümü ({eslesme.toplam})
                </T>
              ) : null}
            </View>
            {eslesme?.eslesme && eslesme.eslesmeler.length ? (
              eslesme.eslesmeler.slice(0, 2).map((e) => (
                <Pressable
                  key={e.id}
                  accessibilityRole="link"
                  onPress={() => router.push(`/talep/${e.talep.no}`)}
                  style={{
                    ...kart,
                    borderRadius: kartOran(16),
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    marginBottom: 8,
                  }}
                >
                  <T style={{ fontSize: 14, fontWeight: '800', lineHeight: 19 }}>{e.talep.baslik}</T>
                  <T style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>
                    {[
                      e.talep.sahip,
                      [e.talep.il, e.talep.ilce].filter(Boolean).join(', '),
                      compactBudget(e.talep.butceMin, e.talep.butceMax, 'milyon'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </T>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <T
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: '#11683F',
                        backgroundColor: '#E7FAF0',
                        paddingVertical: 3,
                        paddingHorizontal: 8,
                        borderRadius: radii.etiket,
                        overflow: 'hidden',
                      }}
                    >
                      %{e.skor} uyum
                    </T>
                    <T numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, color: '#3A4052' }}>
                      ↔ {e.arac.ad}
                    </T>
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={{ ...kart, borderRadius: kartOran(16), padding: 14 }}>
                <T style={{ fontSize: 13, color: colors.muted, lineHeight: 19 }}>
                  {eslesme && !eslesme.eslesme
                    ? 'Otomatik eşleşme Profesyonel ve Kurumsal paketlerdedir.'
                    : 'Yayındaki araçlarına uyan talepler burada görünür.'}
                </T>
              </View>
            )}

            <T
              accessibilityRole="header"
              style={{ marginTop: 20, marginHorizontal: 4, marginBottom: 8, fontSize: 16, fontWeight: '800' }}
            >
              Rozetlerin
            </T>
            <View style={{ ...kart, borderRadius: kartOran(16), padding: 14 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(guven?.rozetler ?? [{ rozet: 'onay', var: true, eksik: [] }])
                  .filter((r) => r.var)
                  .map((r) => (
                    <T
                      key={r.rozet}
                      style={{
                        fontSize: 12.5,
                        fontWeight: '800',
                        paddingVertical: 5,
                        paddingHorizontal: 10,
                        borderRadius: radii.etiket,
                        overflow: 'hidden',
                        backgroundColor: r.rozet === 'onay' ? '#E7FAF0' : '#FFF6DF',
                        color: r.rozet === 'onay' ? '#11683F' : '#7A5200',
                      }}
                    >
                      {r.rozet === 'onay'
                        ? 'Kurumsal doğrulandı'
                        : r.rozet === 'hizli'
                          ? '⚡ Hızlı yanıt'
                          : '★ Güvenilir satıcı'}
                    </T>
                  ))}
              </View>
              {guven ? (
                <T style={{ marginTop: 10, fontSize: 12.5, color: '#3A4052', lineHeight: 18 }}>
                  {guven.yildizOrtalama === null
                    ? 'Henüz yıldız yok'
                    : `★ ${String(guven.yildizOrtalama).replace('.', ',')} · ${guven.yildizSayisi} yıldız`}
                  {' · '}
                  {guven.takipci} takipçi
                  {guven.rozetler
                    .filter((r) => !r.var && r.rozet !== 'onay')
                    .map(
                      (r) =>
                        `\n${r.rozet === 'hizli' ? 'Hızlı yanıt' : 'Güvenilir satıcı'} için: ${r.eksik.join(', ')}`,
                    )
                    .join('')}
                </T>
              ) : null}
              <T style={{ marginTop: 10, fontSize: 12.5, color: colors.muted, lineHeight: 18 }}>
                Rozetler alıcı yıldızları, yanıt süren ve şikayet oranınla her gece güncellenir. Alıcılar tek
                tek puan görmez.
              </T>
              <BirYildiz hesap={p.accountId} />
            </View>

            <View style={{ ...kart, borderRadius: kartOran(16), padding: 14, marginTop: 12 }}>
              <T style={{ fontSize: 14, fontWeight: '800' }}>
                Ekip · {p.ekip.length} / {p.paket.calisan} kullanıcı
              </T>
              <T style={{ marginTop: 4, fontSize: 12.5, color: colors.muted, lineHeight: 18 }}>
                Rolün: {MEMBER_ROLE_NAMES[p.rol]}. Çalışan davetleri ve paket web paneldedir.
              </T>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          paddingTop: 6,
          paddingHorizontal: 6,
          paddingBottom: 8,
        }}
      >
        {SEKME.map((s) => (
          <Pressable
            key={s.ad}
            accessibilityRole="tab"
            accessibilityLabel={s.acik ? s.ad : `${s.ad}, yakında`}
            accessibilityState={{ selected: s.key === gorunum, disabled: !s.acik || !p }}
            disabled={!s.acik || !p}
            onPress={() => {
              if (!p) return;
              if (s.key === 'ekle')
                router.push({ pathname: '/galeri-arac', params: { accountId: p.accountId } });
              else if (s.key === 'eslesme') eslesmeAc();
              else if (s.key === 'mesaj') router.push('/mesajlar');
              else setGorunum(s.key as 'panel' | 'portfoy');
            }}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 3,
              paddingVertical: s.orta ? 0 : 6,
              opacity: s.acik || s.orta ? 1 : 0.55,
            }}
          >
            {s.orta ? (
              <View
                style={{
                  width: 52,
                  height: 52,
                  marginTop: -18,
                  borderRadius: radii.kart,
                  backgroundColor: colors.green,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d={s.d} stroke={colors.ink} strokeWidth={2.6} strokeLinecap="round" />
                </Svg>
              </View>
            ) : (
              <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
                  <Path
                    d={s.d}
                    stroke={s.key === gorunum ? colors.ink : colors.muted}
                    strokeWidth={s.key === gorunum ? 2.4 : 1.9}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                {s.key === 'eslesme' && eslesme?.yeni ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -5,
                      right: -11,
                      minWidth: 16,
                      height: 16,
                      paddingHorizontal: 3,
                      borderRadius: radii.etiket,
                      backgroundColor: '#FF6FB5',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <T style={{ fontSize: 10, fontWeight: '800', color: colors.ink }}>{eslesme.yeni}</T>
                  </View>
                ) : null}
              </View>
            )}
            <T
              style={{
                fontSize: 11,
                fontWeight: s.key === gorunum ? '800' : '600',
                color: s.key === gorunum ? colors.ink : colors.muted,
              }}
            >
              {s.ad}
            </T>
          </Pressable>
        ))}
      </View>
      {yaz && p ? (
        <IlkMesaj
          acik
          talepNo={yaz.talep.no}
          talepBaslik={yaz.talep.baslik}
          sahip={yaz.talep.sahip}
          hesap={p.accountId}
          arac={{ id: yaz.arac.id, ad: yaz.arac.ad }}
          kapat={() => setYaz(null)}
          gonderildi={(id) => {
            setGonderilen((g) => ({ ...g, [yaz.id]: id }));
            setYaz(null);
            yukle().catch(() => undefined);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
