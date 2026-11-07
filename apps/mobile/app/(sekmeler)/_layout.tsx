import { colors } from '@rengarenk/shared';
import { Tabs } from 'expo-router';

/** Alt sekme çubuğu: Ana sayfa · Taleplerim · Talep oluştur · Mesajlar · Hesabım (tasarım dosyası). */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Ana sayfa' }} />
      <Tabs.Screen name="taleplerim" options={{ title: 'Taleplerim' }} />
      <Tabs.Screen name="olustur" options={{ title: 'Talep oluştur' }} />
      <Tabs.Screen name="mesajlar" options={{ title: 'Mesajlar' }} />
      <Tabs.Screen name="hesabim" options={{ title: 'Hesabım' }} />
    </Tabs>
  );
}
