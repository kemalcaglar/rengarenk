import { colors } from '@rengarenk/shared';
import { View } from 'react-native';
import { T } from './t';

const BARS = [colors.blue, colors.pink, colors.yellow, colors.green];

/**
 * Mobil logo (tasarım: AnasayfaMobil 7×16 çubuk, 18 px yazı; GirisMobil 9×20 çubuk, 21 px yazı).
 */
export function Logo({
  size = 'kucuk',
  gap = 4,
  renk,
}: {
  size?: 'kucuk' | 'buyuk';
  gap?: number;
  /** Mevsimsel temada yazı rengi */
  renk?: string;
}) {
  const b = size === 'buyuk' ? { w: 9, h: 20, r: 5, g: 3, f: 21 } : { w: 7, h: 16, r: 4, g: 2, f: 18 };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap }} accessibilityLabel="rengarenk">
      <View style={{ flexDirection: 'row', gap: b.g }}>
        {BARS.map((c) => (
          <View key={c} style={{ width: b.w, height: b.h, borderRadius: b.r, backgroundColor: c }} />
        ))}
      </View>
      <T style={{ fontSize: b.f, fontWeight: '800', letterSpacing: -0.4, ...(renk ? { color: renk } : {}) }}>
        rengarenk
      </T>
    </View>
  );
}
