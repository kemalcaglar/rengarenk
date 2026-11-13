import type { RegisterStarted } from '@rengarenk/shared';
import { butonOran, colors, radii, tints } from '@rengarenk/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alan, AppleDugmesi, Ayrac, birincil, etiket, GoogleDugmesi, Hata } from '../components/giris-ortak';
import { Ikon } from '../components/ikon';
import { T, TInput } from '../components/t';
import { kurulumKimligi, post } from '../lib/api';
import { useOturum } from '../lib/oturum';
import { appleIle, appleVar, googleIle } from '../lib/sosyal';

const WEB = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';

interface Sosyal {
  kayitJetonu: string;
  saglayici: 'google' | 'apple';
}

/**
 * Üye ol (Karar 18, 12 Kasım 2026; görünüm GirisMobil ve Giris.dc.html'deki kod adımı): Google ile, iPhone'da Apple ile
 * ya da formla. Her yolda ad, soyad, e-posta ve telefon alınır; telefon bir kez kodla doğrulanır (önce WhatsApp) ve
 * hesap o zaman açılır. Mobil tasarımda onay kutusu yoktur; "Devam ederek … kabul etmiş olursun" cümlesiyle kullanım
 * koşulları ve aydınlatma metni onaylanır (Karar 59 kaydı). İsteğe bağlı onaylar Ayarlar'dan verilir.
 */
export default function UyeOl() {
  const { basla } = useOturum();
  const p = useLocalSearchParams<{
    kayitJetonu?: string;
    saglayici?: string;
    ad?: string;
    soyad?: string;
    eposta?: string;
  }>();
  const [adim, setAdim] = useState<1 | 2 | 3>(1);
  const [sosyal, setSosyal] = useState<Sosyal | null>(
    p.kayitJetonu
      ? { kayitJetonu: p.kayitJetonu, saglayici: p.saglayici === 'apple' ? 'apple' : 'google' }
      : null,
  );
  const [ad, setAd] = useState(p.ad ?? '');
  const [soyad, setSoyad] = useState(p.soyad ?? '');
  const [eposta, setEposta] = useState(p.eposta ?? '');
  // Google ya da Apple'ın verdiği bilgi değiştirilemez (API de jetondaki değeri yazar)
  const [kilit, setKilit] = useState({
    ad: !!(p.kayitJetonu && p.ad),
    soyad: !!(p.kayitJetonu && p.soyad),
    eposta: !!(p.kayitJetonu && p.eposta),
  });
  const kilitli = { backgroundColor: colors.background, color: colors.muted };
  const [sifre, setSifre] = useState('');
  const [phone, setPhone] = useState('');
  const [kod, setKod] = useState<RegisterStarted | null>(null);
  const [code, setCode] = useState('');
  const [bitis, setBitis] = useState(0);
  const [simdi, setSimdi] = useState(Date.now());
  const [apple, setApple] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    appleVar().then(setApple);
  }, []);
  useEffect(() => {
    if (adim !== 2) return;
    const t = setInterval(() => setSimdi(Date.now()), 1000);
    return () => clearInterval(t);
  }, [adim]);
  const kalan = Math.max(0, Math.round((bitis - simdi) / 1000));
  const sure = `${String(Math.floor(kalan / 60)).padStart(2, '0')}:${String(kalan % 60).padStart(2, '0')}`;
  const rakam = phone.replace(/\D/g, '').replace(/^(90|0)/, '');
  const hazir =
    ad.trim().length >= 2 &&
    soyad.trim().length >= 2 &&
    !!eposta &&
    rakam.length === 10 &&
    (!!sosyal || sifre.length >= 8);

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

  const kodGeldi = (r: RegisterStarted) => {
    setKod(r);
    setBitis(Date.now() + r.expiresIn * 1000);
    setSimdi(Date.now());
    setCode(r.devCode ?? '');
    setAdim(2);
  };

  const sosyalIle = (fn: typeof googleIle) =>
    run(async () => {
      const r = await fn();
      if (!r) return;
      if (r.tip === 'giris') {
        await basla(r);
        router.replace('/');
        return;
      }
      setSosyal({ kayitJetonu: r.kayitJetonu, saglayici: r.saglayici });
      setAd(r.ad ?? ad);
      setSoyad(r.soyad ?? soyad);
      if (r.eposta) setEposta(r.eposta);
      setKilit({ ad: !!r.ad, soyad: !!r.soyad, eposta: !!r.eposta });
    });

  const devam = () =>
    run(async () => {
      kodGeldi(
        await post<RegisterStarted>('/auth/register', {
          ad,
          soyad,
          eposta,
          telefon: `+90${rakam}`,
          ...(sosyal ? { kayitJetonu: sosyal.kayitJetonu } : { sifre }),
          consents: { kullanimKosullari: true, kvkkAydinlatma: true, ticariIleti: false, reklamOlcum: false },
          platform: Platform.OS === 'android' ? 'ANDROID' : 'IOS',
          kurulum: await kurulumKimligi(),
        }),
      );
    });

  const tekrar = () =>
    run(async () => {
      if (kod)
        kodGeldi(await post<RegisterStarted>('/auth/register/resend', { challengeId: kod.challengeId }));
    });

  const dogrula = () =>
    run(async () => {
      if (!kod) return;
      const r = await post<{ accessToken: string; refreshToken: string }>('/auth/register/verify', {
        challengeId: kod.challengeId,
        code,
        kurulum: await kurulumKimligi(),
      });
      await basla(r);
      setAdim(3);
    });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingVertical: 16, paddingHorizontal: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {adim !== 3 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Geri"
              onPress={() => (adim === 2 ? setAdim(1) : router.back())}
              style={{
                width: 44,
                height: 44,
                marginLeft: -10,
                borderRadius: butonOran(12),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ikon d="geri" />
            </Pressable>
          ) : null}

          {adim === 1 ? (
            <>
              <T
                accessibilityRole="header"
                style={{ marginTop: 8, marginBottom: 6, fontSize: 26, fontWeight: '800' }}
              >
                Üye ol
              </T>
              <T style={{ marginBottom: 18, fontSize: 14.5, color: colors.muted }}>
                Zaten üye misin?{' '}
                <T
                  style={{ fontSize: 14.5, fontWeight: '700', color: colors.link }}
                  onPress={() => router.replace('/giris')}
                >
                  Giriş yap
                </T>
              </T>
              {sosyal ? (
                <View
                  style={{
                    backgroundColor: tints.blue,
                    borderRadius: radii.buton,
                    padding: 14,
                    marginBottom: 4,
                  }}
                >
                  <T style={{ fontSize: 14, fontWeight: '600' }}>
                    {sosyal.saglayici === 'apple' ? 'Apple' : 'Google'} hesabınla devam ediyorsun. Gelen
                    bilgiler değiştirilemez. Son adım: telefon numaranı doğrula.
                  </T>
                </View>
              ) : (
                <>
                  <GoogleDugmesi
                    onPress={() => sosyalIle(googleIle)}
                    yazi="Google ile üye ol"
                    disabled={busy}
                  />
                  {apple ? <AppleDugmesi kayit onPress={() => sosyalIle(appleIle)} /> : null}
                  <Ayrac />
                </>
              )}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Alan
                    ad="Ad"
                    deger={ad}
                    degis={setAd}
                    editable={!kilit.ad}
                    style={kilit.ad ? kilitli : undefined}
                    textContentType="givenName"
                    autoComplete="given-name"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Alan
                    ad="Soyad"
                    deger={soyad}
                    degis={setSoyad}
                    editable={!kilit.soyad}
                    style={kilit.soyad ? kilitli : undefined}
                    textContentType="familyName"
                    autoComplete="family-name"
                  />
                </View>
              </View>
              <Alan
                ad="E-posta"
                deger={eposta}
                degis={setEposta}
                editable={!kilit.eposta}
                style={kilit.eposta ? kilitli : undefined}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
              {sosyal ? null : (
                <>
                  <Alan
                    ad="Şifre"
                    deger={sifre}
                    degis={setSifre}
                    secureTextEntry
                    autoComplete="new-password"
                    textContentType="newPassword"
                  />
                  <T style={{ marginTop: 6, fontSize: 12.5, color: colors.muted }}>
                    En az 8 karakter; içinde harf ve rakam olsun.
                  </T>
                </>
              )}
              <T style={[etiket, { marginTop: 14 }]}>Cep telefonu</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View
                  style={{
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#D5DAE5',
                    borderRadius: butonOran(12),
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
                    borderWidth: 1,
                    borderColor: '#D5DAE5',
                    borderRadius: butonOran(12),
                    padding: 13,
                    fontSize: 16,
                  }}
                />
              </View>
              <T style={{ marginTop: 6, fontSize: 12.5, color: colors.muted }}>
                Numarana bir kez doğrulama kodu göndereceğiz (WhatsApp). Bir numarayla yalnızca bir hesap
                açılabilir.
              </T>
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
              <Hata>{error}</Hata>
              <View style={{ flex: 1, minHeight: 20 }} />
              <Pressable
                accessibilityRole="button"
                disabled={busy || !hazir}
                onPress={devam}
                style={birincil(hazir)}
              >
                <T style={{ fontSize: 16, fontWeight: '800' }}>{busy ? 'Gönderiliyor…' : 'Devam et'}</T>
              </Pressable>
            </>
          ) : null}

          {adim === 2 && kod ? (
            <>
              <T
                accessibilityRole="header"
                style={{ marginTop: 12, marginBottom: 6, fontSize: 26, fontWeight: '800' }}
              >
                Telefonunu doğrula
              </T>
              <T style={{ marginBottom: 22, fontSize: 14.5, color: colors.muted }}>
                +90 {rakam.replace(/^(\d{3})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3 $4')} numarasına{' '}
                {kod.kanal === 'ekran'
                  ? 'doğrulama kodu bu ekrana yazıldı (kapalı test; WhatsApp gelene kadar kod gönderilmiyor).'
                  : `${kod.kanal === 'whatsapp' ? "WhatsApp'tan" : 'SMS ile'} 6 haneli kod gönderdik.`}
              </T>
              <T style={etiket}>Doğrulama kodu</T>
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
                  borderRadius: radii.buton,
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
                  onPress={tekrar}
                  disabled={busy}
                  style={{ paddingVertical: 6 }}
                >
                  <T style={{ fontSize: 13.5, fontWeight: '700', color: colors.muted }}>Kodu tekrar gönder</T>
                </Pressable>
              </View>
              {kod.devCode ? (
                <T style={{ marginBottom: 12, fontSize: 12.5, color: colors.muted }}>
                  Geliştirme ortamı: kod gönderilmedi, {kod.devCode} kutuya yazıldı.
                </T>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={busy || code.length !== 6}
                onPress={dogrula}
                style={birincil(code.length === 6)}
              >
                <T style={{ fontSize: 16, fontWeight: '800' }}>
                  {busy ? 'Doğrulanıyor…' : 'Doğrula ve üye ol'}
                </T>
              </Pressable>
              <Hata>{error}</Hata>
              <T style={{ marginTop: 12, fontSize: 12.5, color: colors.muted }}>
                Kodu kimseyle paylaşma; Rengarenk çalışanları kodunu asla sormaz.
              </T>
            </>
          ) : null}

          {adim === 3 ? (
            <>
              <T
                accessibilityRole="header"
                style={{ marginTop: 24, marginBottom: 6, fontSize: 26, fontWeight: '800' }}
              >
                Hoş geldin, {ad}!
              </T>
              <View
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  alignItems: 'center',
                  backgroundColor: tints.green,
                  borderRadius: radii.buton,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  marginTop: 14,
                  marginBottom: 12,
                }}
              >
                <Ikon d="onay" color="#11683F" />
                <T style={{ flex: 1, fontSize: 14, color: '#11683F', fontWeight: '600' }}>
                  Telefon numaran doğrulandı. 1 ücretsiz talep hakkın hazır.
                </T>
              </View>
              {sosyal ? null : (
                <T style={{ marginBottom: 22, fontSize: 14.5, color: colors.muted }}>
                  {eposta} adresine bir doğrulama bağlantısı gönderdik; bildirimleri e-postayla almak için
                  bağlantıya bas.
                </T>
              )}
              <View style={{ flex: 1, minHeight: 20 }} />
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace('/talep-olustur')}
                style={birincil(true)}
              >
                <T style={{ fontSize: 16, fontWeight: '800' }}>İlk talebimi oluştur</T>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace('/')}
                style={{ marginTop: 12, padding: 8 }}
              >
                <T style={{ textAlign: 'center', fontSize: 14.5, fontWeight: '700', color: colors.link }}>
                  Önce taleplere göz at
                </T>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
