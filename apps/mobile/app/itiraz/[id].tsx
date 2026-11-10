import { butonOran, colors, radii } from '@rengarenk/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../../components/ikon';
import { T, TInput } from '../../components/t';
import { useOturum } from '../../lib/oturum';

interface Karar {
  id: string;
  no: number;
  kararAd: string;
  aciklama: string;
  gerekce: string;
  hedef: string;
  tarih: string;
  aski: { until: string | null } | null;
  geriAlindi: string | null;
  itirazSonu: string;
  itirazEdebilir: boolean;
  itiraz: { durum: 'acik' | 'kabul' | 'red'; metin: string; sonuc: string | null } | null;
}

const tarih = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

/** Moderasyon kararı ve itiraz (Karar 53): bildirimden açılır; 7 gün içinde bir kez itiraz */
export default function Itiraz() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { durum, istek } = useOturum();
  const [k, setK] = useState<Karar | null>(null);
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  useEffect(() => {
    if (durum !== 'uye') return;
    istek<Karar>(`/moderation/decisions/${id}`)
      .then(setK)
      .catch((e: Error) => setHata(e.message));
  }, [durum, id, istek]);

  async function gonder() {
    if (metin.trim().length < 10) {
      setHata('İtirazını en az 10 karakterle yaz.');
      return;
    }
    setMesgul(true);
    setHata(null);
    try {
      setK(
        await istek<Karar>(`/moderation/decisions/${id}/appeal`, {
          method: 'POST',
          body: { metin: metin.trim() },
        }),
      );
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  const kart = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.kart,
    padding: 16,
    marginTop: 12,
  } as const;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F6F8FD' }} edges={['top']}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          paddingVertical: 10,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={() => router.back()}
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
        <T accessibilityRole="header" style={{ flex: 1, fontSize: 18, fontWeight: '800' }}>
          Moderasyon kararı
        </T>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {!k ? (
          hata ? (
            <T accessibilityRole="alert" style={{ color: '#A3271F', fontWeight: '700' }}>
              {hata}
            </T>
          ) : (
            <ActivityIndicator color={colors.blue} />
          )
        ) : (
          <>
            <View style={kart}>
              <T style={{ fontSize: 18, fontWeight: '800' }}>{k.kararAd}</T>
              <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 4 }}>
                {k.hedef} · {tarih(k.tarih)} · S-{k.no}
                {k.geriAlindi ? ' · geri alındı' : ''}
              </T>
              <T style={{ fontSize: 13.5, fontWeight: '800', marginTop: 12 }}>Gerekçe</T>
              <T style={{ fontSize: 14, color: '#3A4052', lineHeight: 21 }}>{k.gerekce}</T>
              <T style={{ fontSize: 13.5, fontWeight: '800', marginTop: 10 }}>Ne anlama geliyor</T>
              <T style={{ fontSize: 14, color: '#3A4052', lineHeight: 21 }}>{k.aciklama}</T>
              {k.aski && !k.geriAlindi ? (
                <T style={{ fontSize: 14, color: '#A3271F', fontWeight: '700', marginTop: 10 }}>
                  {k.aski.until
                    ? `${tarih(k.aski.until)} saatine kadar mesaj gönderemezsin.`
                    : 'Karar sonuçlanana kadar mesaj gönderemezsin.'}
                </T>
              ) : null}
            </View>
            <View style={kart}>
              <T accessibilityRole="header" style={{ fontSize: 16, fontWeight: '800' }}>
                İtiraz
              </T>
              {k.itiraz ? (
                <>
                  <T style={{ fontSize: 14, color: '#3A4052', marginTop: 8 }}>“{k.itiraz.metin}”</T>
                  <T
                    style={{
                      fontSize: 14,
                      fontWeight: '800',
                      marginTop: 10,
                      color:
                        k.itiraz.durum === 'kabul'
                          ? '#11683F'
                          : k.itiraz.durum === 'red'
                            ? '#3A4052'
                            : '#7A5300',
                    }}
                  >
                    {k.itiraz.durum === 'acik'
                      ? 'İtirazın inceleniyor. Sonuçlanınca bildirim göndereceğiz.'
                      : k.itiraz.durum === 'kabul'
                        ? 'İtirazını haklı bulduk; karar geri alındı.'
                        : `İtirazını inceledik; karar geçerli.${k.itiraz.sonuc ? ` ${k.itiraz.sonuc}` : ''}`}
                  </T>
                </>
              ) : k.itirazEdebilir ? (
                <>
                  <T style={{ fontSize: 13, color: colors.muted, marginTop: 6, lineHeight: 19 }}>
                    {tarih(k.itirazSonu)} saatine kadar bir kez itiraz edebilirsin. Kararı veren dışında bir
                    moderatör inceler.
                  </T>
                  <TInput
                    value={metin}
                    onChangeText={setMetin}
                    multiline
                    maxLength={1000}
                    placeholder="Neden katılmıyorsun?"
                    accessibilityLabel="İtiraz metni"
                    style={{
                      marginTop: 10,
                      borderWidth: 1,
                      borderColor: '#D5DAE5',
                      borderRadius: butonOran(12),
                      padding: 12,
                      minHeight: 110,
                      fontSize: 14.5,
                      textAlignVertical: 'top',
                    }}
                  />
                  {hata ? (
                    <T
                      accessibilityRole="alert"
                      style={{ marginTop: 8, color: '#A3271F', fontWeight: '700' }}
                    >
                      {hata}
                    </T>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: mesgul }}
                    onPress={gonder}
                    style={{
                      marginTop: 12,
                      backgroundColor: colors.blue,
                      borderRadius: radii.buton,
                      paddingVertical: 15,
                      alignItems: 'center',
                    }}
                  >
                    <T style={{ color: colors.onBlue, fontSize: 15.5, fontWeight: '800' }}>İtiraz et</T>
                  </Pressable>
                </>
              ) : (
                <T style={{ fontSize: 14, color: colors.muted, marginTop: 8 }}>
                  {k.geriAlindi ? 'Karar geri alındı.' : 'İtiraz süresi doldu.'}
                </T>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
