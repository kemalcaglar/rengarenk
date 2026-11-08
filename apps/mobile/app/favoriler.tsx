import { colors, MAX_SAVED_SEARCHES, SAVED_SEARCH_NOTIFY } from '@rengarenk/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../components/ikon';
import { T } from '../components/t';
import { useOturum } from '../lib/oturum';
import { butceAraligi, yilAraligi } from '../lib/talep-bicim';

type Durum = 'yayinda' | 'son_gunler' | 'pasif' | 'bulundu' | 'kapandi';
interface Favori {
  no: number;
  baslik: string;
  category: { slug: string; name: string };
  arac: string;
  durum: Durum;
  yazilabilir: boolean;
  il: string | null;
  yilMin: number | null;
  yilMax: number | null;
  butceMin: number | null;
  butceMax: number | null;
  bitis: string | null;
}
interface Arama {
  id: string;
  ad: string;
  sorgu: Record<string, unknown>;
  kriterler: string[];
  bildirim: string;
  toplam: number | null;
  yeni: number | null;
}

const kart = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line } as const;

function durumMetni(f: Favori): [string, string] {
  if (f.durum === 'yayinda' || f.durum === 'son_gunler') {
    const gun = f.bitis
      ? Math.max(0, Math.ceil((new Date(f.bitis).getTime() - Date.now()) / 86_400_000))
      : null;
    return [
      gun === null ? 'Yayında' : `Yayında · ${gun} gün`,
      f.durum === 'son_gunler' ? '#7A5300' : '#11683F',
    ];
  }
  if (f.durum === 'pasif') return ['Pasif', '#7A5300'];
  if (f.durum === 'bulundu') return ['Talep sahibi aracını buldu', colors.muted];
  return ['Kapandı', colors.muted];
}

/** Kayıtlı sorgu → liste ekranı parametreleri (çoklu değerler virgülle) */
const parametreler = (q: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(q)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v)]),
  );

/** Favoriler ve kayıtlı aramalar (tasarım: HesapMobil, favori görünümü; Karar 06.4, 30) */
export default function Favoriler() {
  const { durum, istek } = useOturum();
  const [sekme, setSekme] = useState<'talep' | 'arama'>('talep');
  const [favoriler, setFavoriler] = useState<Favori[] | null>(null);
  const [aramalar, setAramalar] = useState<Arama[] | null>(null);
  const [acik, setAcik] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    const [f, a] = await Promise.all([istek<Favori[]>('/favorites'), istek<Arama[]>('/saved-searches')]);
    setFavoriler(f);
    setAramalar(a);
  }, [istek]);

  // Talep sayfasından favori değiştirip dönünce liste yenilenir
  useFocusEffect(
    useCallback(() => {
      if (durum === 'uye') yukle().catch(() => undefined);
    }, [durum, yukle]),
  );

  const dene = async (is: () => Promise<unknown>) => {
    try {
      await is();
    } catch (e) {
      Alert.alert('İşlem yapılamadı', (e as Error).message);
      await yukle().catch(() => undefined);
    }
  };

  const kaldir = (f: Favori) =>
    dene(async () => {
      setFavoriler((l) => (l ?? []).filter((x) => x.no !== f.no));
      await istek(`/favorites/${f.no}`, { method: 'DELETE' });
    });

  const bildirim = (a: Arama, key: string) =>
    dene(async () => {
      setAramalar((l) => (l ?? []).map((x) => (x.id === a.id ? { ...x, bildirim: key } : x)));
      await istek(`/saved-searches/${a.id}`, { method: 'PATCH', body: { bildirim: key } });
    });

  const sil = (a: Arama) =>
    Alert.alert('Kayıtlı aramayı sil', `“${a.ad}” silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () =>
          dene(async () => {
            setAramalar((l) => (l ?? []).filter((x) => x.id !== a.id));
            await istek(`/saved-searches/${a.id}`, { method: 'DELETE' });
          }),
      },
    ]);

  const gor = (a: Arama) =>
    dene(async () => {
      await istek(`/saved-searches/${a.id}`, { method: 'PATCH', body: { gordum: true } });
      router.push({ pathname: '/talepler', params: parametreler(a.sorgu) });
    });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          padding: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={() => router.back()}
          style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ikon d="geri" />
        </Pressable>
        <T accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800' }}>
          Favoriler ve aramalar
        </T>
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
      >
        {durum !== 'uye' ? (
          <View style={{ ...kart, borderRadius: 16, padding: 16 }}>
            <T style={{ fontSize: 14, color: colors.muted }}>Favorilerini görmek için giriş yap.</T>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/giris')}
              style={{
                marginTop: 12,
                backgroundColor: colors.blue,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <T style={{ fontWeight: '800' }}>Giriş yap</T>
            </Pressable>
          </View>
        ) : (
          <>
            <View
              accessibilityRole="tablist"
              style={{
                flexDirection: 'row',
                gap: 6,
                backgroundColor: '#E9ECF4',
                borderRadius: 14,
                padding: 4,
              }}
            >
              {(
                [
                  ['talep', 'Favori talepler'],
                  ['arama', 'Kayıtlı aramalar'],
                ] as const
              ).map(([k, ad]) => {
                const on = sekme === k;
                return (
                  <Pressable
                    key={k}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    onPress={() => setSekme(k)}
                    style={{
                      flex: 1,
                      borderRadius: 11,
                      paddingVertical: 10,
                      paddingHorizontal: 6,
                      backgroundColor: on ? colors.surface : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <T style={{ fontSize: 13.5, fontWeight: '800' }}>{ad}</T>
                  </Pressable>
                );
              })}
            </View>

            {sekme === 'talep' ? (
              <>
                {(favoriler ?? []).map((f) => {
                  const [dm, renk] = durumMetni(f);
                  return (
                    <Pressable
                      key={f.no}
                      accessibilityRole="link"
                      onPress={() => router.push(`/talep/${f.no}`)}
                      style={{
                        ...kart,
                        borderRadius: 16,
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        marginTop: 8,
                        opacity: f.yazilabilir ? 1 : 0.6,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                        <T style={{ flex: 1, fontSize: 14.5, fontWeight: '800', lineHeight: 20 }}>
                          {f.baslik}
                        </T>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Favorilerden çıkar"
                          hitSlop={10}
                          onPress={() => kaldir(f)}
                        >
                          <T style={{ color: colors.pink, fontSize: 18 }}>♥</T>
                        </Pressable>
                      </View>
                      <T style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>
                        {[f.arac, yilAraligi(f.yilMin, f.yilMax), f.il].filter(Boolean).join(' · ') ||
                          f.category.name}
                      </T>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 8,
                          gap: 8,
                        }}
                      >
                        <T style={{ fontSize: 14, fontWeight: '800', color: colors.link }}>
                          {butceAraligi(f.butceMin, f.butceMax)}
                        </T>
                        <T style={{ fontSize: 12.5, fontWeight: '700', color: renk }}>{dm}</T>
                      </View>
                    </Pressable>
                  );
                })}
                {favoriler && favoriler.length === 0 ? (
                  <T style={{ marginTop: 16, marginHorizontal: 6, fontSize: 13.5, color: colors.muted }}>
                    Favori talebin yok. Talep sayfalarındaki kalp simgesiyle ekleyebilirsin.
                  </T>
                ) : null}
              </>
            ) : (
              <>
                {(aramalar ?? []).map((a) => (
                  <View key={a.id} style={{ ...kart, borderRadius: 16, marginTop: 8, overflow: 'hidden' }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: acik === a.id }}
                      onPress={() => setAcik(acik === a.id ? null : a.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T style={{ fontSize: 14.5, fontWeight: '800' }}>{a.ad}</T>
                        <T style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                          {a.kriterler.join(' · ')}
                        </T>
                      </View>
                      {a.yeni ? (
                        <View
                          style={{
                            borderRadius: 999,
                            backgroundColor: '#EEF3FF',
                            paddingVertical: 4,
                            paddingHorizontal: 9,
                          }}
                        >
                          <T style={{ fontSize: 11.5, fontWeight: '800', color: colors.link }}>
                            {a.yeni} yeni
                          </T>
                        </View>
                      ) : null}
                    </Pressable>
                    {acik === a.id ? (
                      <View
                        style={{
                          borderTopWidth: 1,
                          borderTopColor: '#EEF0F5',
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                        }}
                      >
                        <T style={{ fontSize: 12.5, color: colors.muted }}>
                          {a.toplam === null
                            ? 'Arama şu an yanıt vermiyor'
                            : `Şu an ${a.toplam} aktif talep uyuyor`}
                        </T>
                        <T style={{ fontSize: 12.5, fontWeight: '700', color: colors.muted, marginTop: 10 }}>
                          Bildirim
                        </T>
                        <View
                          accessibilityRole="radiogroup"
                          style={{
                            flexDirection: 'row',
                            gap: 4,
                            backgroundColor: '#F3F5FA',
                            borderRadius: 12,
                            padding: 4,
                            marginTop: 6,
                          }}
                        >
                          {SAVED_SEARCH_NOTIFY.map((b) => {
                            const on = a.bildirim === b.key;
                            return (
                              <Pressable
                                key={b.key}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: on }}
                                onPress={() => (on ? undefined : bildirim(a, b.key))}
                                style={{
                                  flex: 1,
                                  borderRadius: 9,
                                  paddingVertical: 8,
                                  alignItems: 'center',
                                  backgroundColor: on ? colors.surface : 'transparent',
                                }}
                              >
                                <T style={{ fontSize: 13, fontWeight: on ? '800' : '600' }}>{b.ad}</T>
                              </Pressable>
                            );
                          })}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 18, marginTop: 12 }}>
                          <Pressable accessibilityRole="link" onPress={() => gor(a)} hitSlop={6}>
                            <T style={{ fontSize: 13.5, fontWeight: '700', color: colors.link }}>
                              Talepleri gör
                            </T>
                          </Pressable>
                          <Pressable accessibilityRole="button" onPress={() => sil(a)} hitSlop={6}>
                            <T style={{ fontSize: 13.5, fontWeight: '700', color: '#A3271F' }}>Sil</T>
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                  </View>
                ))}
                {aramalar && aramalar.length === 0 ? (
                  <T style={{ marginTop: 16, marginHorizontal: 6, fontSize: 13.5, color: colors.muted }}>
                    Kayıtlı araman yok. Talep listesinde “Aramayı kaydet”e bas.
                  </T>
                ) : null}
                <T
                  style={{
                    marginTop: 10,
                    marginHorizontal: 6,
                    fontSize: 12,
                    color: colors.muted,
                    lineHeight: 18,
                  }}
                >
                  Satmak istediğin araca uyan talepleri takip et. En fazla {MAX_SAVED_SEARCHES} kayıtlı arama;
                  anlık bildirim telefonuna gelir.
                </T>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
