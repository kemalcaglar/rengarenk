import { colors } from '@rengarenk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { post, tokens } from '../lib/api';

/** Telefon ve SMS koduyla giriş. Yenileme jetonu güvenli depoda saklanır. */
export default function Giris() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!challengeId) {
        const r = await post<{ challengeId: string }>('/auth/otp/request', { phone });
        setChallengeId(r.challengeId);
      } else {
        const r = await post<{ refreshToken: string }>('/auth/otp/verify', {
          challengeId,
          code,
          platform: process.env.EXPO_OS === 'android' ? 'ANDROID' : 'IOS',
        });
        await tokens.save(r.refreshToken);
        router.replace('/');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={s.h1}>Giriş yap</Text>
      <Text style={s.muted}>Cep telefonuna bir kod göndereceğiz. Şifre yok.</Text>
      <View style={{ gap: 8, marginTop: 18 }}>
        <Text style={s.label}>Cep telefonu</Text>
        <TextInput
          style={s.input}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="0532 123 45 67"
          value={phone}
          onChangeText={setPhone}
          editable={!challengeId}
        />
        {challengeId && (
          <>
            <Text style={s.label}>SMS kodu</Text>
            <TextInput
              style={s.input}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={6}
              value={code}
              onChangeText={setCode}
            />
          </>
        )}
        {error && <Text style={{ color: '#A11B1B' }}>{error}</Text>}
        <Pressable
          style={[s.btn, busy && { opacity: 0.6 }]}
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={s.btnText}>{challengeId ? 'Giriş yap' : 'Kod gönder'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '800', color: colors.ink },
  muted: { color: colors.muted, marginTop: 4 },
  label: { fontWeight: '700', color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: '#D5DAE5',
    borderRadius: 12,
    padding: 13,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  btn: { backgroundColor: colors.blue, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 8 },
  btnText: { fontWeight: '800', color: colors.ink, fontSize: 15 },
});
