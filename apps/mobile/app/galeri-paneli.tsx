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
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { T } from '../components/t';
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
interface Davet {
  id: string;
  galeri: string;
  rolAd: string;
}

/** Alt sekmeler (GaleriMobil.dc.html); eşleşme ve mesaj Aşama 5, portföy Sprint 10 */
const SEKME: { ad: string; d: string; orta?: true; acik?: true }[] = [
  { ad: 'Panel', d: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 4v3h6V4z', acik: true },
  { ad: 'Eşleşmeler', d: 'M7 7h10l-3-3M17 17H7l3 3' },
  { ad: 'Araç ekle', d: 'M12 5v14M5 12h14', orta: true },
  { ad: 'Portföy', d: 'M3 13l2-6h14l2 6v5H3zM7 18v2M17 18v2M6 13h12' },
  { ad: 'Mesajlar', d: 'M4 5h16v11H9l-5 4z' },
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
    setP(await istek<Panel>(`/gallery/${ilk.accountId}`));
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
          max: p.paket.portfoy === null ? '∞' : String(p.paket.portfoy),
          not: 'Araç ekleme yakında',
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
            {davetler ? 'Galeri davetlerin' : 'Panel'}
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

        {p ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {haklar.map((h, i) => (
                <View key={h.ad} style={{ ...kart, borderRadius: 16, padding: 12, width: '48.5%' }}>
                  <T style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>{h.ad}</T>
                  <T style={{ marginTop: 4 }}>
                    <T style={{ fontSize: 22, fontWeight: '800' }}>0</T>
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
            accessibilityState={{ selected: Boolean(s.acik), disabled: !s.acik }}
            disabled={!s.acik}
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
                  opacity: 0.55,
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
                  stroke={s.acik ? colors.ink : colors.muted}
                  strokeWidth={s.acik ? 2.4 : 1.9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
            <T
              style={{
                fontSize: 11,
                fontWeight: s.acik ? '800' : '600',
                color: s.acik ? colors.ink : colors.muted,
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
