import { colors } from '@rengarenk/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfilVeIletisim } from '../components/ayar-profil';
import { Ikon } from '../components/ikon';
import { T, TInput } from '../components/t';
import { useOturum } from '../lib/oturum';

interface Kanal {
  kanal: 'uygulama' | 'eposta' | 'sms';
  acik: boolean;
  kilitli: boolean;
}
interface Tercihler {
  konular: { konu: string; ad: string; not: string; kanallar: Kanal[] }[];
  ticariOnay: boolean;
  eposta: { adres: string; dogrulandi: boolean } | null;
}

const KANAL_AD = { uygulama: 'Uygulama', eposta: 'E-posta', sms: 'SMS' } as const;
const kart = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.line,
  borderRadius: 16,
} as const;

/**
 * Ayarlar (Ayarlar.dc.html'nin mobil karşılığı; Karar 29, 30, 48, 49): profil ve iletişim tercihleri, numarayı
 * değiştir, e-posta adresi ve doğrulama, bildirim konuları ve
 * kanalları. Ödeme bildirimleri kapatılamaz; kampanya ticari ileti onayıyla açılır.
 */
export default function Ayarlar() {
  const { durum, istek } = useOturum();
  const [t, setT] = useState<Tercihler | null>(null);
  const [eposta, setEposta] = useState('');
  const [mesgul, setMesgul] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (durum !== 'uye') return;
      istek<Tercihler>('/me/notification-preferences')
        .then(setT)
        .catch(() => undefined);
    }, [durum, istek]),
  );

  async function degistir(konu: string, k: Kanal) {
    if (k.kilitli) return;
    try {
      setT(
        await istek<Tercihler>('/me/notification-preferences', {
          method: 'PUT',
          body: { tercihler: [{ konu, kanal: k.kanal, acik: !k.acik }] },
        }),
      );
    } catch (e) {
      Alert.alert('Kaydedilemedi', (e as Error).message);
    }
  }

  async function epostaGonder() {
    setMesgul(true);
    try {
      await istek('/me/email', { method: 'POST', body: { eposta: eposta.trim() } });
      setEposta('');
      setT(await istek<Tercihler>('/me/notification-preferences'));
      Alert.alert('Bağlantı gönderildi', 'E-postandaki "E-postamı doğrula" düğmesine bas.');
    } catch (e) {
      Alert.alert('Gönderilemedi', (e as Error).message);
    } finally {
      setMesgul(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View
        style={{
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
          Ayarlar
        </T>
      </View>
      {!t ? (
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
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={{ padding: 12, paddingBottom: 40, gap: 12 }}
        >
          <ProfilVeIletisim />
          <View style={{ ...kart, padding: 14 }}>
            <T accessibilityRole="header" style={{ fontSize: 16, fontWeight: '800' }}>
              E-posta
            </T>
            <T style={{ marginTop: 4, fontSize: 14.5, fontWeight: '700' }}>
              {t.eposta?.adres ?? 'Eklenmedi'}
            </T>
            <T
              style={{
                marginTop: 2,
                fontSize: 12.5,
                fontWeight: '700',
                color: t.eposta?.dogrulandi ? '#11683F' : '#7A5300',
              }}
            >
              {t.eposta?.dogrulandi
                ? 'Doğrulandı'
                : 'Doğrulanmadı · faturalar ve günlük özetler için gerekli'}
            </T>
            <TInput
              accessibilityLabel="E-posta adresi"
              placeholder={t.eposta ? 'Yeni adres' : 'ornek@eposta.com'}
              keyboardType="email-address"
              autoCapitalize="none"
              value={eposta}
              onChangeText={setEposta}
              style={{
                marginTop: 10,
                borderWidth: 1,
                borderColor: '#D5DAE5',
                borderRadius: 12,
                padding: 12,
                fontSize: 15,
              }}
            />
            <Pressable
              accessibilityRole="button"
              disabled={mesgul || !eposta.includes('@')}
              onPress={epostaGonder}
              style={{
                marginTop: 8,
                backgroundColor: colors.blue,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                opacity: mesgul || !eposta.includes('@') ? 0.5 : 1,
              }}
            >
              <T style={{ fontSize: 14.5, fontWeight: '800' }}>Doğrulama bağlantısı gönder</T>
            </Pressable>
          </View>

          <View style={{ ...kart, overflow: 'hidden' }}>
            <View style={{ padding: 14, paddingBottom: 8 }}>
              <T accessibilityRole="header" style={{ fontSize: 16, fontWeight: '800' }}>
                Bildirimler
              </T>
              <T style={{ marginTop: 2, fontSize: 13, color: colors.muted }}>
                Güvenlik ve ödeme bildirimleri kapatılamaz.
              </T>
            </View>
            {t.konular.map((r) => (
              <View key={r.konu} style={{ borderTopWidth: 1, borderTopColor: '#EEF0F5', padding: 14 }}>
                <T style={{ fontSize: 14.5, fontWeight: '700' }}>{r.ad}</T>
                <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{r.not}</T>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  {r.kanallar.map((k) => (
                    <Pressable
                      key={k.kanal}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: k.acik, disabled: k.kilitli }}
                      accessibilityLabel={`${r.ad} · ${KANAL_AD[k.kanal]}`}
                      onPress={() => degistir(r.konu, k)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        borderWidth: 1,
                        borderColor: k.acik ? colors.blue : '#D5DAE5',
                        backgroundColor: k.acik ? '#EEF3FF' : colors.surface,
                        borderRadius: 10,
                        paddingVertical: 9,
                        opacity: k.kilitli ? 0.5 : 1,
                      }}
                    >
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 5,
                          borderWidth: 2,
                          borderColor: k.acik ? colors.blue : '#AEB5C4',
                          backgroundColor: k.acik ? colors.blue : colors.surface,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {k.acik ? (
                          <T style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>✓</T>
                        ) : null}
                      </View>
                      <T style={{ fontSize: 13, fontWeight: '700' }}>{KANAL_AD[k.kanal]}</T>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            <T
              style={{
                padding: 14,
                borderTopWidth: 1,
                borderTopColor: '#EEF0F5',
                fontSize: 12.5,
                color: colors.muted,
              }}
            >
              Kampanya e-posta ve SMS’leri ticari elektronik ileti onayınla gönderilir ve İYS’ye kaydedilir.
              Onayını istediğin zaman geri alabilirsin.
            </T>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
