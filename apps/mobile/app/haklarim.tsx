import { colors, fiyatYaz, STORE_NOTES } from '@rengarenk/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../components/ikon';
import { T } from '../components/t';
import { type Niyet, satinAl } from '../lib/magaza';
import { useOturum } from '../lib/oturum';

interface Urun {
  key: string;
  mobilKurus: number;
  oneCikarma: boolean;
}
interface Ozet {
  talepHakki: number;
  ekMesaj: number;
  gunlukMesaj: { toplam: number; kalan: number };
  ucretsizUzatma: number;
  magaza: { acik: boolean; not: string | null };
  urunler: Urun[];
  talepler: { no: number; baslik: string }[];
  gecmis: { id: string; no: string; tarih: string; kalem: string; tutarKurus: number }[];
}

/** Uygulamadaki ürün adları ve notları (HaklarimMobil.dc.html); öne çıkarmada not talebin adıyla */
const AD: Record<string, [string, (talep?: string) => string]> = {
  ek_talep: ['Ek talep hakkı', () => '1 talep, süresi dolmaz'],
  talep_paketi: ['Talep paketi', () => '3 talep, süresi dolmaz'],
  uzatma: ['Talep uzatma', () => '30 gün, ücretsiz uzatmadan sonra'],
  mesaj_10: ['Ek ilk mesaj', () => '10 mesaj, süresi dolmaz'],
  mesaj_30: ['Ek ilk mesaj', () => '30 mesaj, süresi dolmaz'],
  ust_sira_7: ['Üst sıra', (t) => `7 gün · ${t ?? 'talebin'}`],
  ust_sira_30: ['Üst sıra', (t) => `30 gün · ${t ?? 'talebin'}`],
  acil_7: ['Acil arıyorum', () => '7 gün · pembe etiket'],
  vitrin_7: ['Ana sayfa vitrini', (t) => `7 gün · ${t ?? 'talebin'}`],
};

const kart = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line } as const;
const tl = (kurus: number) => `₺${fiyatYaz(kurus / 100)}`;
const tarih = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

/**
 * Haklarım (HaklarimMobil.dc.html; Karar 12.8, 38). Haklar web ile aynı hesaptadır. Satış App Store ya da Google Play ile
 * yapılır; uygulamada web fiyatından ve web ödemesinden söz edilmez. Tasarımdan fark: "Ödeme geçmişi ve faturalar"
 * web sayfasına gitmez (mağaza kuralı), aynı ekranda açılır.
 */
export default function Haklarim() {
  const { durum, istek } = useOturum();
  const [o, setO] = useState<Ozet | null>(null);
  const [sec, setSec] = useState('ek_talep');
  const [talepNo, setTalepNo] = useState<number | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [gecmisAcik, setGecmisAcik] = useState(false);

  const yukle = useCallback(async () => {
    const x = await istek<Ozet>('/orders/overview');
    setO(x);
    setTalepNo((t) => t ?? x.talepler[0]?.no ?? null);
  }, [istek]);

  useFocusEffect(
    useCallback(() => {
      if (durum === 'uye') yukle().catch((e: Error) => Alert.alert('Yüklenemedi', e.message));
    }, [durum, yukle]),
  );

  const ios = Platform.OS === 'ios';
  const urunler = (o?.urunler ?? []).filter((u) => AD[u.key]);
  const secili = urunler.find((u) => u.key === sec);
  const talep = o?.talepler.find((t) => t.no === talepNo);
  const talepYok = !!secili?.oneCikarma && !talep;
  const [ad, not] = AD[sec] ?? ['', () => ''];

  async function al() {
    if (!secili || talepYok) return;
    setMesgul(true);
    try {
      const niyet = await istek<Niyet>('/store/intents', {
        method: 'POST',
        body: {
          urun: secili.key,
          ...(secili.oneCikarma ? { talepNo } : {}),
          platform: ios ? 'ios' : 'android',
        },
      });
      const r = await satinAl(niyet, istek, `${ad} · ${not(talep?.baslik)} · ${tl(secili.mobilKurus)}`);
      if (r === 'tamam') {
        await yukle();
        Alert.alert('Satın alma tamamlandı', 'Hakların hesabına eklendi; web sitesinde de geçerli.');
      }
    } catch (e) {
      Alert.alert('Satın alınamadı', (e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  const kutular = [
    ['Talep hakkı', String(o?.talepHakki ?? 0), colors.blue],
    ['Bugünkü ilk mesaj', `${o?.gunlukMesaj.kalan ?? 0} / ${o?.gunlukMesaj.toplam ?? 5}`, colors.pink],
    ['Ek ilk mesaj', String(o?.ekMesaj ?? 0), colors.yellow],
    ['Ücretsiz uzatma', String(o?.ucretsizUzatma ?? 0), colors.green],
  ] as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'bottom']}>
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
        <T accessibilityRole="header" style={{ fontSize: 19, fontWeight: '800' }}>
          Haklarım
        </T>
      </View>
      {durum !== 'uye' ? (
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
          <T style={{ fontSize: 14, color: colors.muted }}>Haklarını görmek için giriş yap.</T>
        </View>
      ) : !o ? (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={colors.blue} />
        </View>
      ) : (
        <>
          <ScrollView
            style={{ flex: 1, backgroundColor: colors.background }}
            contentContainerStyle={{ padding: 16, paddingTop: 14, paddingBottom: 24 }}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {kutular.map(([baslik, deger, renk]) => (
                <View
                  key={baslik}
                  style={{
                    ...kart,
                    borderTopWidth: 4,
                    borderTopColor: renk,
                    borderRadius: 14,
                    padding: 12,
                    flexBasis: '47%',
                    flexGrow: 1,
                  }}
                >
                  <T style={{ fontSize: 12.5, fontWeight: '700', color: colors.muted }}>{baslik}</T>
                  <T style={{ fontSize: 22, fontWeight: '800' }}>{deger}</T>
                </View>
              ))}
            </View>

            <T
              accessibilityRole="header"
              style={{ marginTop: 20, marginBottom: 8, fontSize: 16, fontWeight: '800' }}
            >
              Satın al
            </T>
            <View style={{ ...kart, borderRadius: 16, overflow: 'hidden' }}>
              {urunler.map((u) => {
                const on = u.key === sec;
                const [uAd, uNot] = AD[u.key] as [string, (t?: string) => string];
                return (
                  <Pressable
                    key={u.key}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => setSec(u.key)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: '#EEF0F5',
                      backgroundColor: on ? '#EEF3FF' : colors.surface,
                      paddingVertical: 13,
                      paddingHorizontal: 14,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: on ? colors.blue : '#AEB5C4',
                        backgroundColor: on ? colors.blue : colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {on ? (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EEF3FF' }} />
                      ) : null}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T style={{ fontSize: 14.5, fontWeight: '700' }}>{uAd}</T>
                      <T numberOfLines={1} style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                        {uNot(u.oneCikarma ? talep?.baslik : undefined)}
                      </T>
                    </View>
                    <T style={{ fontSize: 14.5, fontWeight: '800' }}>{tl(u.mobilKurus)}</T>
                  </Pressable>
                );
              })}
            </View>

            {secili?.oneCikarma ? (
              <View style={{ marginTop: 12 }}>
                <T style={{ fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 6 }}>
                  Öne çıkarılacak talep
                </T>
                {o.talepler.length ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {o.talepler.map((t) => {
                      const on = t.no === talepNo;
                      return (
                        <Pressable
                          key={t.no}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on }}
                          onPress={() => setTalepNo(t.no)}
                          style={{
                            borderWidth: 1,
                            borderColor: on ? colors.blue : colors.line,
                            backgroundColor: on ? '#EEF3FF' : colors.surface,
                            borderRadius: 999,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                          }}
                        >
                          <T style={{ fontSize: 13, fontWeight: '700' }}>{t.baslik}</T>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <T style={{ fontSize: 13, color: '#7A5300' }}>
                    Yayında talebin yok; öne çıkarma yayındaki bir talebe uygulanır.
                  </T>
                )}
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: gecmisAcik }}
              onPress={() => setGecmisAcik((x) => !x)}
              style={{ marginTop: 14, paddingVertical: 6 }}
            >
              <T style={{ fontSize: 14, fontWeight: '700', color: colors.link }}>
                Ödeme geçmişi ve faturalar
              </T>
            </Pressable>
            {gecmisAcik ? (
              <View style={{ ...kart, borderRadius: 16, overflow: 'hidden', marginTop: 4 }}>
                {o.gecmis.length ? (
                  o.gecmis.map((g) => (
                    <View
                      key={g.id}
                      style={{
                        padding: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: '#EEF0F5',
                        flexDirection: 'row',
                        gap: 10,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T numberOfLines={2} style={{ fontSize: 13.5, fontWeight: '700' }}>
                          {g.kalem}
                        </T>
                        <T style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                          {tarih(g.tarih)} · {g.no}
                        </T>
                      </View>
                      <T style={{ fontSize: 13.5, fontWeight: '800' }}>{tl(g.tutarKurus)}</T>
                    </View>
                  ))
                ) : (
                  <T style={{ padding: 12, fontSize: 13.5, color: colors.muted }}>Henüz ödemen yok.</T>
                )}
                <T style={{ padding: 12, fontSize: 12, color: colors.muted }}>
                  Uygulamadan aldıklarının faturası {ios ? 'Apple' : 'Google Play'} tarafından e-postana
                  gönderilir.
                </T>
              </View>
            ) : null}
          </ScrollView>

          <View
            style={{
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.line,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 12,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <T numberOfLines={1} style={{ flex: 1, fontSize: 13, color: colors.muted }}>
                {ad} · {not(secili?.oneCikarma ? talep?.baslik : undefined)}
              </T>
              <T style={{ fontSize: 13, color: colors.muted }}>KDV dahil</T>
            </View>
            <T style={{ marginBottom: 10, fontSize: 11.5, lineHeight: 16, color: colors.muted }}>
              {STORE_NOTES[ios ? 'ios' : 'android']}
            </T>
            {o.magaza.acik ? null : (
              <T style={{ marginBottom: 8, fontSize: 13, fontWeight: '700', color: '#7A5300' }}>
                {o.magaza.not}
              </T>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={mesgul || !o.magaza.acik || !secili || talepYok}
              onPress={al}
              style={{
                backgroundColor: colors.blue,
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: 'center',
                opacity: mesgul || !o.magaza.acik || talepYok ? 0.5 : 1,
              }}
            >
              <T style={{ fontSize: 16, fontWeight: '800' }}>
                {mesgul
                  ? 'Bekleniyor…'
                  : `${ios ? 'App Store' : 'Google Play'} ile satın al · ${secili ? tl(secili.mobilKurus) : ''}`}
              </T>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
