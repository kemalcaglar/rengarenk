import {
  colors,
  DOTS,
  GALLERY_PLANS,
  GALLERY_TRIAL,
  MEMBER_ROLE_NAMES,
  type MemberRoleKey,
} from '@rengarenk/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { T } from '../components/t';
import { API } from '../lib/api';
import { basHarf, useOturum } from '../lib/oturum';

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

interface Davet {
  id: string;
  galeri: string;
  rolAd: string;
}

/** Alt sekmeler (GaleriMobil.dc.html); eşleşme ve mesaj Aşama 5, portföy Sprint 10 */
const SEKME: { ad: string; key: string; d: string; orta?: true; acik?: true }[] = [
  { ad: 'Panel', key: 'panel', d: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 4v3h6V4z', acik: true },
  { ad: 'Eşleşmeler', key: 'eslesme', d: 'M7 7h10l-3-3M17 17H7l3 3' },
  { ad: 'Araç ekle', key: 'ekle', d: 'M12 5v14M5 12h14', orta: true, acik: true },
  { ad: 'Portföy', key: 'portfoy', d: 'M3 13l2-6h14l2 6v5H3zM7 18v2M17 18v2M6 13h12', acik: true },
  { ad: 'Mesajlar', key: 'mesaj', d: 'M4 5h16v11H9l-5 4z' },
];

const kart = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line } as const;

/**
 * Galeri paneli (tasarım: GaleriMobil.dc.html; Karar 12.5, 20, 38). Uygulamada paket fiyatı ve satın alma
 * yönlendirmesi gösterilmez (Karar 38). Ekip ve paket web panelden yönetilir.
 */
export default function GaleriPaneli() {
  const { durum, istek } = useOturum();
  const [p, setP] = useState<Panel | null>(null);
  const [davetler, setDavetler] = useState<Davet[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [gorunum, setGorunum] = useState<'panel' | 'portfoy'>('panel');
  const [portfoy, setPortfoy] = useState<Portfoy | null>(null);

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
    const [x, l] = await Promise.all([
      istek<Panel>(`/gallery/${ilk.accountId}`),
      istek<Portfoy>(`/gallery/${ilk.accountId}/portfolio`).catch(() => null),
    ]);
    setP(x);
    setPortfoy(l);
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
  const plan = p && !deneme ? GALLERY_PLANS[p.paket.key as keyof typeof GALLERY_PLANS] : null;
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
        { ad: 'Bugünkü ilk mesaj', max: String(p.paket.gunlukMesaj), not: "Her gece 00:00'da yenilenir" },
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
            borderRadius: 12,
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
            {davetler ? 'Galeri davetlerin' : gorunum === 'portfoy' ? 'Portföy' : 'Panel'}
          </T>
          {p ? (
            <T numberOfLines={1} style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>
              {p.galeri.ad} · {deneme ? `Deneme, ${p.paket.denemeKalanGun} gün kaldı` : `${p.paket.ad} paket`}
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
            borderRadius: 10,
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
        {hata ? (
          <T
            style={{
              marginBottom: 10,
              backgroundColor: '#FFF0EE',
              color: '#A3271F',
              borderRadius: 12,
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
              <View key={d.id} style={{ ...kart, borderRadius: 16, padding: 14, marginBottom: 8 }}>
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
                      borderRadius: 12,
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
                      borderRadius: 12,
                      paddingVertical: 11,
                      alignItems: 'center',
                    }}
                  >
                    <T style={{ fontWeight: '800' }}>Kabul et</T>
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
              borderRadius: 12,
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
              borderRadius: 12,
              padding: 12,
              fontWeight: '700',
            }}
          >
            Deneme süren bitti. Paket seçene kadar yalnızca portföyünü görüntüleyebilirsin.
          </T>
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
                    borderRadius: 16,
                    padding: 10,
                    marginBottom: 8,
                    opacity: a.durum === 'SOLD' ? 0.6 : 1,
                  }}
                >
                  <View
                    style={{
                      width: 88,
                      height: 66,
                      borderRadius: 10,
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
                          borderRadius: 999,
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
            <View
              style={{
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: '#A9B6D6',
                borderRadius: 14,
                padding: 13,
                alignItems: 'center',
              }}
            >
              <T style={{ fontSize: 14, fontWeight: '700', color: colors.link }}>
                Excel/CSV ile toplu yükleme web panelde
              </T>
            </View>
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
              borderRadius: 14,
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
                <View key={h.ad} style={{ ...kart, borderRadius: 16, padding: 12, width: '48.5%' }}>
                  <T style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>{h.ad}</T>
                  <T style={{ marginTop: 4 }}>
                    <T style={{ fontSize: 22, fontWeight: '800' }}>{'deger' in h ? h.deger : 0}</T>
                    <T style={{ fontSize: 13, color: colors.muted, fontWeight: '700' }}> / {h.max}</T>
                  </T>
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
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
            </View>
            <View style={{ ...kart, borderRadius: 16, padding: 14 }}>
              <T style={{ fontSize: 13, color: colors.muted, lineHeight: 19 }}>
                Portföyüne araç ekleyince uyan talepler burada görünür.
              </T>
            </View>

            <T
              accessibilityRole="header"
              style={{ marginTop: 20, marginHorizontal: 4, marginBottom: 8, fontSize: 16, fontWeight: '800' }}
            >
              Rozetlerin
            </T>
            <View style={{ ...kart, borderRadius: 16, padding: 14 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <T
                  style={{
                    fontSize: 12.5,
                    fontWeight: '800',
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    overflow: 'hidden',
                    backgroundColor: '#E7FAF0',
                    color: '#11683F',
                  }}
                >
                  Kurumsal doğrulandı
                </T>
              </View>
              <T style={{ marginTop: 10, fontSize: 12.5, color: colors.muted, lineHeight: 18 }}>
                Rozetler alıcı yıldızları, yanıt süren ve şikayet oranınla her gece güncellenir. Alıcılar tek
                tek puan görmez.
              </T>
            </View>

            <View style={{ ...kart, borderRadius: 16, padding: 14, marginTop: 12 }}>
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
                  borderRadius: 18,
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
              <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
                <Path
                  d={s.d}
                  stroke={s.key === gorunum ? colors.ink : colors.muted}
                  strokeWidth={s.key === gorunum ? 2.4 : 1.9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
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
    </SafeAreaView>
  );
}
