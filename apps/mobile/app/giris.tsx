import { colors, radii, tints } from '@rengarenk/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alan, AppleDugmesi, Ayrac, birincil, GoogleDugmesi, Hata } from '../components/giris-ortak';
import { Logo } from '../components/logo';
import { T } from '../components/t';
import { kurulumKimligi, post } from '../lib/api';
import { useOturum } from '../lib/oturum';
import { appleIle, appleVar, googleIle } from '../lib/sosyal';

const WEB = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';

/**
 * Giriş yap (Karar 18, 12 Kasım 2026; görünüm GirisMobil): e-posta ve şifreyle, Google ile ya da iPhone'da Apple ile.
 * Girişte telefon kodu istenmez; hesap yoksa Google ve Apple bilgileriyle üyelik ekranı açılır.
 */
export default function Giris() {
  const { basla } = useOturum();
  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [apple, setApple] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    appleVar().then(setApple);
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const gir = () =>
    run(async () => {
      const r = await post<{ accessToken: string; refreshToken: string }>('/auth/login', {
        eposta,
        sifre,
        platform: Platform.OS === 'android' ? 'ANDROID' : 'IOS',
        kurulum: await kurulumKimligi(),
      });
      await basla(r);
      router.replace('/');
    });

  const sosyal = (fn: typeof googleIle) =>
    run(async () => {
      const r = await fn();
      if (!r) return;
      if (r.tip === 'giris') {
        await basla(r);
        router.replace('/');
        return;
      }
      router.push({
        pathname: '/uye-ol',
        params: {
          kayitJetonu: r.kayitJetonu,
          saglayici: r.saglayici,
          ad: r.ad ?? '',
          soyad: r.soyad ?? '',
          eposta: r.eposta,
        },
      });
    });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingVertical: 24, paddingHorizontal: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <Logo size="buyuk" gap={7} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 24 }}>
            {[tints.blue, tints.pink, tints.yellow, tints.green].map((c) => (
              <View
                key={c}
                style={{ width: '48.5%', height: 74, borderRadius: radii.kart, backgroundColor: c }}
              />
            ))}
          </View>
          <T
            accessibilityRole="header"
            style={{
              marginTop: 24,
              marginBottom: 6,
              fontSize: 25,
              lineHeight: 30,
              fontWeight: '800',
              letterSpacing: -0.4,
            }}
          >
            Giriş yap
          </T>
          <T style={{ marginBottom: 20, fontSize: 14.5, color: colors.muted }}>
            Hesabın yok mu?{' '}
            <T
              style={{ fontSize: 14.5, fontWeight: '700', color: colors.link }}
              onPress={() => router.push('/uye-ol')}
            >
              Üye ol
            </T>
          </T>
          <GoogleDugmesi onPress={() => sosyal(googleIle)} disabled={busy} />
          {apple ? <AppleDugmesi onPress={() => sosyal(appleIle)} /> : null}
          <Ayrac />
          <Alan
            ad="E-posta"
            deger={eposta}
            degis={setEposta}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            style={{ marginTop: 0 }}
          />
          <Alan
            ad="Şifre"
            deger={sifre}
            degis={setSifre}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
          />
          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL(`${WEB}/sifremi-unuttum`)}
            style={{ alignSelf: 'flex-end', paddingVertical: 8 }}
          >
            <T style={{ fontSize: 13.5, fontWeight: '700', color: colors.link }}>Şifremi unuttum</T>
          </Pressable>
          <Hata>{error}</Hata>
          <View style={{ flex: 1, minHeight: 20 }} />
          <Pressable
            accessibilityRole="button"
            disabled={busy || !eposta || !sifre}
            onPress={gir}
            style={birincil(!!eposta && !!sifre)}
          >
            <T style={{ fontSize: 16, fontWeight: '800' }}>{busy ? 'Giriş yapılıyor…' : 'Giriş yap'}</T>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/kurumsal-basvuru')}
            style={{ marginTop: 14, padding: 8 }}
          >
            <T style={{ textAlign: 'center', fontSize: 14, fontWeight: '700', color: colors.link }}>
              Kurumsal hesap başvurusu
            </T>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
