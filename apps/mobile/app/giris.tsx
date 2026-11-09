import { colors, tints } from '@rengarenk/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../components/ikon';
import { Logo } from '../components/logo';
import { T, TInput } from '../components/t';
import { API, kurulumKimligi, post } from '../lib/api';
import { useOturum } from '../lib/oturum';

const WEB = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';

const label = { fontSize: 13.5, fontWeight: '700', marginBottom: 6 } as const;
const birincil = (aktif = true) =>
  ({
    backgroundColor: aktif ? colors.blue : '#C9CFDB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  }) as const;

/**
 * Giriş yap veya üye ol (tasarım: GirisMobil; kod ve ad adımları Giris.dc.html). Mobil tasarımda onay kutusu
 * yoktur; "Devam ederek … kabul etmiş olursun" cümlesiyle kullanım koşulları ve aydınlatma metni onaylanır
 * (Karar 59 kaydı). İsteğe bağlı onaylar Ayarlar'dan verilir.
 */
export default function Giris() {
  const { basla } = useOturum();
  const [adim, setAdim] = useState<1 | 2 | 3>(1);
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [bitis, setBitis] = useState(0);
  const [simdi, setSimdi] = useState(Date.now());
  const [access, setAccess] = useState<string | null>(null);
  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (adim !== 2) return;
    const t = setInterval(() => setSimdi(Date.now()), 1000);
    return () => clearInterval(t);
  }, [adim]);
  const kalan = Math.max(0, Math.round((bitis - simdi) / 1000));
  const sure = `${String(Math.floor(kalan / 60)).padStart(2, '0')}:${String(kalan % 60).padStart(2, '0')}`;
  const rakam = phone.replace(/\D/g, '').replace(/^(90|0)/, '');

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

  const kodIste = () =>
    run(async () => {
      const r = await post<{ challengeId: string; expiresIn: number; devCode?: string }>(
        '/auth/otp/request',
        {
          phone: `+90${rakam}`,
          kurulum: await kurulumKimligi(),
        },
      );
      setChallengeId(r.challengeId);
      setBitis(Date.now() + r.expiresIn * 1000);
      setSimdi(Date.now());
      setDevCode(r.devCode ?? null);
      setCode(r.devCode ?? '');
      setAdim(2);
    });

  const dogrula = () =>
    run(async () => {
      const r = await post<{ accessToken: string; refreshToken: string; isNewUser: boolean }>(
        '/auth/otp/verify',
        {
          challengeId,
          code,
          platform: Platform.OS === 'android' ? 'ANDROID' : 'IOS',
          kurulum: await kurulumKimligi(),
          consents: { kullanimKosullari: true, kvkkAydinlatma: true, ticariIleti: false, reklamOlcum: false },
        },
      );
      await basla(r);
      if (!r.isNewUser) return router.replace('/');
      setAccess(r.accessToken);
      setAdim(3);
    });

  const adKaydet = () =>
    run(async () => {
      const r = await fetch(`${API}/me`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${access}` },
        body: JSON.stringify({ firstName: ad, lastName: soyad }),
      });
      if (!r.ok) {
        const m = (await r.json().catch(() => ({}))) as { issues?: { message: string }[]; message?: string };
        throw new Error(m.issues?.[0]?.message ?? m.message ?? 'Adın kaydedilemedi');
      }
      router.replace('/');
    });

  const hata = error ? (
    <T
      accessibilityRole="alert"
      style={{ marginTop: 10, fontSize: 13.5, fontWeight: '700', color: '#A11B1B' }}
    >
      {error}
    </T>
  ) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingVertical: 24, paddingHorizontal: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {adim === 1 ? (
            <>
              <Logo size="buyuk" gap={7} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 28 }}>
                {[tints.blue, tints.pink, tints.yellow, tints.green].map((c) => (
                  <View
                    key={c}
                    style={{ width: '48.5%', height: 74, borderRadius: 18, backgroundColor: c }}
                  />
                ))}
              </View>
              <T
                accessibilityRole="header"
                style={{
                  marginTop: 26,
                  marginBottom: 6,
                  fontSize: 25,
                  lineHeight: 30,
                  fontWeight: '800',
                  letterSpacing: -0.4,
                }}
              >
                Aradığın aracı söyle, satıcılar seni bulsun.
              </T>
              <T style={{ marginBottom: 22, fontSize: 14.5, color: colors.muted }}>
                Telefon numaranla giriş yap veya üye ol.
              </T>
              <T style={label}>Cep telefonu</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View
                  style={{
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#D5DAE5',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    backgroundColor: '#F3F5FA',
                  }}
                >
                  <T style={{ fontSize: 15, fontWeight: '700' }}>+90</T>
                </View>
                <TInput
                  accessibilityLabel="Cep telefonu"
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  placeholder="5XX 123 45 67"
                  value={phone}
                  onChangeText={setPhone}
                  style={{
                    flex: 1,
                    borderWidth: 1.5,
                    borderColor: colors.blue,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                  }}
                />
              </View>
              <T style={{ marginTop: 14, fontSize: 12.5, lineHeight: 19, color: colors.muted }}>
                Devam ederek{' '}
                <T
                  style={{ fontSize: 12.5, color: colors.link }}
                  onPress={() => Linking.openURL(`${WEB}/kullanim-kosullari`)}
                >
                  Kullanım koşullarını
                </T>{' '}
                kabul etmiş ve{' '}
                <T
                  style={{ fontSize: 12.5, color: colors.link }}
                  onPress={() => Linking.openURL(`${WEB}/kvkk`)}
                >
                  KVKK aydınlatma metnini
                </T>{' '}
                okumuş olursun.
              </T>
              {hata}
              <View style={{ flex: 1, minHeight: 24 }} />
              <Pressable
                accessibilityRole="button"
                disabled={busy || rakam.length !== 10}
                onPress={kodIste}
                style={birincil(rakam.length === 10)}
              >
                <T style={{ fontSize: 16, fontWeight: '800' }}>{busy ? 'Gönderiliyor…' : 'Kod gönder'}</T>
              </Pressable>
              <T
                style={{
                  marginTop: 14,
                  padding: 8,
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: '700',
                  color: colors.link,
                }}
              >
                Kurumsal hesap başvurusu
              </T>
            </>
          ) : null}

          {adim === 2 ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Geri"
                onPress={() => setAdim(1)}
                style={{
                  width: 44,
                  height: 44,
                  marginLeft: -10,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ikon d="geri" />
              </Pressable>
              <T
                accessibilityRole="header"
                style={{ marginTop: 12, marginBottom: 6, fontSize: 26, fontWeight: '800' }}
              >
                Kodu gir
              </T>
              <T style={{ marginBottom: 22, fontSize: 14.5, color: colors.muted }}>
                +90 {rakam.replace(/^(\d{3})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4')} numarasına 6 haneli kod
                gönderdik.{' '}
                <T
                  style={{ fontSize: 14.5, fontWeight: '700', color: colors.link }}
                  onPress={() => setAdim(1)}
                >
                  Numarayı değiştir
                </T>
              </T>
              <T style={label}>Doğrulama kodu</T>
              <TInput
                accessibilityLabel="Doğrulama kodu"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={6}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
                style={{
                  borderWidth: 1.5,
                  borderColor: colors.blue,
                  borderRadius: 14,
                  padding: 16,
                  fontSize: 26,
                  fontWeight: '800',
                  letterSpacing: 10,
                  textAlign: 'center',
                }}
              />
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 12,
                  marginBottom: 22,
                }}
              >
                <T style={{ fontSize: 13.5, color: colors.muted }}>
                  {kalan > 0 ? `Kod ${sure} içinde geçerli` : 'Kodun süresi doldu'}
                </T>
                <Pressable
                  accessibilityRole="button"
                  onPress={kodIste}
                  disabled={busy}
                  style={{ paddingVertical: 6 }}
                >
                  <T style={{ fontSize: 13.5, fontWeight: '700', color: colors.muted }}>Kodu tekrar gönder</T>
                </Pressable>
              </View>
              {devCode ? (
                <T style={{ marginBottom: 12, fontSize: 12.5, color: colors.muted }}>
                  Geliştirme ortamı: SMS gönderilmedi, kod {devCode} kutuya yazıldı.
                </T>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={busy || code.length !== 6}
                onPress={dogrula}
                style={birincil(code.length === 6)}
              >
                <T style={{ fontSize: 16, fontWeight: '800' }}>{busy ? 'Doğrulanıyor…' : 'Doğrula'}</T>
              </Pressable>
              {hata}
              <T style={{ marginTop: 12, fontSize: 12.5, color: colors.muted }}>
                rengarenk sana kodu yalnızca "RENGARENK" gönderici adıyla SMS olarak iletir; kodu kimseyle
                paylaşma.
              </T>
            </>
          ) : null}

          {adim === 3 ? (
            <>
              <T
                accessibilityRole="header"
                style={{ marginTop: 12, marginBottom: 6, fontSize: 26, fontWeight: '800' }}
              >
                Son adım: adın
              </T>
              <T style={{ marginBottom: 22, fontSize: 14.5, color: colors.muted }}>
                Adın ve soyadın taleplerinde ve mesajlarında görünür.
              </T>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {(
                  [
                    ['Ad', ad, setAd, 'givenName'],
                    ['Soyad', soyad, setSoyad, 'familyName'],
                  ] as const
                ).map(([l, v, set, tip]) => (
                  <View key={l} style={{ flex: 1 }}>
                    <T style={label}>{l}</T>
                    <TInput
                      accessibilityLabel={l}
                      textContentType={tip}
                      value={v}
                      onChangeText={set}
                      style={{
                        borderWidth: 1,
                        borderColor: '#D5DAE5',
                        borderRadius: 12,
                        padding: 13,
                        fontSize: 15,
                      }}
                    />
                  </View>
                ))}
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  alignItems: 'center',
                  backgroundColor: tints.green,
                  borderRadius: 14,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  marginTop: 20,
                  marginBottom: 22,
                }}
              >
                <Ikon d="onay" color="#11683F" />
                <T style={{ flex: 1, fontSize: 14, color: '#11683F', fontWeight: '600' }}>
                  Telefon numaran doğrulandı. 1 ücretsiz talep hakkın hazır.
                </T>
              </View>
              <Pressable accessibilityRole="button" disabled={busy} onPress={adKaydet} style={birincil(true)}>
                <T style={{ fontSize: 16, fontWeight: '800' }}>
                  {busy ? 'Kaydediliyor…' : 'İlk talebimi oluştur'}
                </T>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={adKaydet}
                style={{ marginTop: 12, padding: 8 }}
              >
                <T style={{ textAlign: 'center', fontSize: 14.5, fontWeight: '700', color: colors.link }}>
                  Önce taleplere göz at
                </T>
              </Pressable>
              {hata}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
