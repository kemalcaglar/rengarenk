import { colors } from '@rengarenk/shared';
import { StyleSheet, Text, TextInput, type TextInputProps, type TextProps } from 'react-native';

/**
 * Plus Jakarta Sans (tasarımın yazı tipi). React Native'de her kalınlık ayrı bir ailedir; `fontWeight` doğru
 * aileye çevrilir, böylece iOS ve Android'de tasarımdaki kalınlık görünür.
 */
const FAMILY: Record<string, string> = {
  '400': 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
};

export function fontFor(weight?: string | number) {
  const w = String(weight ?? '400');
  return FAMILY[w === 'normal' ? '400' : w === 'bold' ? '700' : w] ?? FAMILY['400'];
}

function withFont<S>(style: S) {
  const flat = StyleSheet.flatten(style as never) as { fontWeight?: string | number } | undefined;
  return [{ color: colors.ink }, style, { fontFamily: fontFor(flat?.fontWeight), fontWeight: undefined }];
}

/** Tasarımın metni: varsayılan renk mürekkep (#1E2333), kalınlığa göre yazı tipi ailesi */
export function T({ style, ...rest }: TextProps) {
  return <Text {...rest} style={withFont(style)} />;
}

/** Tasarımın giriş kutusu yazısı */
export function TInput({ style, ...rest }: TextInputProps) {
  return <TextInput placeholderTextColor="#8A91A3" {...rest} style={withFont(style)} />;
}
