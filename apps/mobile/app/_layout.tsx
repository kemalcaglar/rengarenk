import { colors } from '@rengarenk/shared';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useClientFlags } from '../lib/bakim';

export default function RootLayout() {
  const durum = useClientFlags();
  return (
    <>
      <StatusBar style="dark" />
      {durum?.duyuru ? (
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFF6DF' }}>
          <Text
            accessibilityRole="alert"
            style={{ color: '#7A5300', fontWeight: '700', textAlign: 'center', padding: 10 }}
          >
            {durum.duyuru}
          </Text>
        </SafeAreaView>
      ) : null}
      {durum?.bakim.tum ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            backgroundColor: '#F6F8FD',
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink }}>Kısa bir bakımdayız</Text>
          <Text style={{ color: colors.muted, marginTop: 8, textAlign: 'center' }}>{durum.duyuru}</Text>
        </View>
      ) : (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F6F8FD' } }} />
      )}
    </>
  );
}
