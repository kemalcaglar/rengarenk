import { butonOran, colors, radii } from '@rengarenk/shared';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { T, TInput } from './t';

/** Giriş ve üyelik ekranlarının ortak parçaları (Karar 18; görünüm GirisMobil ile aynı) */

export const etiket = { fontSize: 13.5, fontWeight: '700', marginBottom: 6 } as const;

export const birincil = (aktif = true) =>
  ({
    backgroundColor: aktif ? colors.blue : '#C9CFDB',
    borderRadius: radii.buton,
    paddingVertical: 16,
    alignItems: 'center',
  }) as const;

export const kutu = {
  borderWidth: 1,
  borderColor: '#D5DAE5',
  borderRadius: butonOran(12),
  padding: 13,
  fontSize: 15,
} as const;

export function Hata({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <T
      accessibilityRole="alert"
      style={{ marginTop: 10, fontSize: 13.5, fontWeight: '700', color: '#A11B1B' }}
    >
      {children}
    </T>
  );
}

export function Alan({
  ad,
  deger,
  degis,
  ...p
}: {
  ad: string;
  deger: string;
  degis: (v: string) => void;
} & Omit<React.ComponentProps<typeof TInput>, 'value' | 'onChangeText'>) {
  return (
    <View style={{ marginTop: 14 }}>
      <T style={etiket}>{ad}</T>
      <TInput accessibilityLabel={ad} value={deger} onChangeText={degis} {...p} style={[kutu, p.style]} />
    </View>
  );
}

export function Ayrac() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
      <T style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>ya da</T>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
    </View>
  );
}

/** Google ile devam et: beyaz düğme ve çok renkli "G" (Google marka kuralı) */
export function GoogleDugmesi({
  onPress,
  yazi = 'Google ile devam et',
  disabled,
}: {
  onPress: () => void;
  yazi?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: '#D5DAE5',
        borderRadius: radii.buton,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
      }}
    >
      <Svg width={20} height={20} viewBox="0 0 48 48">
        <Path
          fill="#EA4335"
          d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z"
        />
        <Path
          fill="#4285F4"
          d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-16.6z"
        />
        <Path
          fill="#FBBC05"
          d="M10.6 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.9l7.9-6.2z"
        />
        <Path
          fill="#34A853"
          d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.2C6.6 42.6 14.6 48 24 48z"
        />
      </Svg>
      <T style={{ fontSize: 15.5, fontWeight: '700', color: '#1F1F1F' }}>{yazi}</T>
    </Pressable>
  );
}

/** Apple ile giriş: Apple'ın kendi düğmesi (App Store kuralı) */
export function AppleDugmesi({ onPress, kayit }: { onPress: () => void; kayit?: boolean }) {
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={
        kayit
          ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
          : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
      }
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={radii.buton}
      style={{ height: 50, marginTop: 10 }}
      onPress={onPress}
    />
  );
}
