import { colors, radii } from '@rengarenk/shared';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOturum } from '../lib/oturum';
import { IKON, Ikon } from './ikon';
import { T } from './t';

const SEKME: Record<string, { ad: string; ikon: keyof typeof IKON }> = {
  index: { ad: 'Ana sayfa', ikon: 'ana' },
  taleplerim: { ad: 'Taleplerim', ikon: 'talepler' },
  mesajlar: { ad: 'Mesajlar', ikon: 'mesaj' },
  hesabim: { ad: 'Hesabım', ikon: 'hesap' },
};

/**
 * Alt sekme çubuğu (tasarım: AnasayfaMobil, HesapMobil, MesajlarMobil): beş eşit sütun, ortada yükseltilmiş
 * "Talep oluştur" düğmesi tam ekran sihirbazı açar (sekme sayfası değildir). Okunmamış mesaj rozeti pembe.
 */
export function SekmeCubugu({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { durum } = useOturum();
  const sekme = (index: number) => {
    const route = state.routes[index];
    if (!route) return null;
    const s = SEKME[route.name];
    if (!s) return null;
    const on = state.index === index;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={s.ad}
        onPress={() => {
          const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!on && !e.defaultPrevented) navigateToTab(route.key);
        }}
        style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 }}
      >
        <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
          <Ikon d={s.ikon} size={23} width={on ? 2.4 : 1.9} color={on ? colors.ink : colors.muted} />
        </View>
        <T style={{ fontSize: 11, fontWeight: on ? '800' : '600', color: on ? colors.ink : colors.muted }}>
          {s.ad}
        </T>
      </Pressable>
    );
  };
  const routes = state.routes.map((_, i) => i);
  return (
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
        paddingBottom: Math.max(insets.bottom, 20),
      }}
    >
      {routes.slice(0, 2).map(sekme)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Talep oluştur"
        onPress={() => router.push(durum === 'uye' ? '/talep-olustur' : '/giris')}
        style={{ flex: 1, alignItems: 'center', gap: 3 }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            marginTop: -18,
            borderRadius: radii.kart,
            backgroundColor: colors.blue,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.blue,
            shadowOpacity: 0.35,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <Ikon d="arti" size={24} width={2.6} />
        </View>
        <T style={{ fontSize: 11, fontWeight: '700' }}>Talep oluştur</T>
      </Pressable>
      {routes.slice(2).map(sekme)}
    </View>
  );
}
