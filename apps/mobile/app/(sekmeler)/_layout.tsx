import { colors } from '@rengarenk/shared';
import { Tabs } from 'expo-router';
import { SekmeCubugu } from '../../components/sekme-cubugu';

/**
 * Alt sekmeler: Ana sayfa · Taleplerim · (Talep oluştur) · Mesajlar · Hesabım (tasarım: AnasayfaMobil). Ortadaki
 * düğme sekme değildir, tam ekran sihirbazı açar (sekme-cubugu.tsx).
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <SekmeCubugu {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="taleplerim" />
      <Tabs.Screen name="mesajlar" />
      <Tabs.Screen name="hesabim" />
    </Tabs>
  );
}
