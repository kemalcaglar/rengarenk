import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { colors } from '@rengarenk/shared';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner } from '../components/banner';
import { T } from '../components/t';
import { YasalOnay } from '../components/yasal-onay';
import { useClientFlags } from '../lib/bakim';
import { OturumProvider } from '../lib/oturum';
import { PushKaydi } from '../lib/push';

/** Kök düzen: tasarımın yazı tipi (Plus Jakarta Sans), oturum, bakım duyurusu ve tam bakım ekranı. */
export default function RootLayout() {
  const durum = useClientFlags();
  const [fontlar] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // Yazı tipi yüklenmeden çizilirse sistem yazısıyla görünür; açılış ekranı yazı tipini bekler.
  if (!fontlar) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return (
    <OturumProvider>
      <PushKaydi />
      <YasalOnay />
      <StatusBar style="dark" />
      {durum?.duyuru ? (
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFF6DF' }}>
          <T
            accessibilityRole="alert"
            style={{ color: '#7A5300', fontWeight: '700', textAlign: 'center', padding: 10 }}
          >
            {durum.duyuru}
          </T>
        </SafeAreaView>
      ) : null}
      {durum?.bakim.tum ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            backgroundColor: colors.background,
          }}
        >
          <T style={{ fontSize: 22, fontWeight: '800' }}>Kısa bir bakımdayız</T>
          <T style={{ color: colors.muted, marginTop: 8, textAlign: 'center' }}>{durum.duyuru}</T>
        </View>
      ) : (
        <>
          <Banner yer="ust_serit" />
          <Stack
            screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
          />
        </>
      )}
    </OturumProvider>
  );
}
