import { butonOran, colors, radii } from '@rengarenk/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../../components/ikon';
import { T, TInput } from '../../components/t';
import { useOturum } from '../../lib/oturum';

interface Yazisma {
  numara: string;
  konuTur: string;
  durum: 'acik' | 'yanitlandi' | 'cozuldu';
  durumAd: string;
  puan: number | null;
  puanVerebilir: boolean;
  mesajlar: { id: string; taraf: 'kullanici' | 'destek'; kim: string; metin: string; zaman: string }[];
}

const saat = (iso: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(iso));

/** Rengarenk Destek yazışması (Karar 54): yanıt, yeniden açma ve çözümden sonra 1–5 puan */
export default function DestekYazisma() {
  const { no } = useLocalSearchParams<{ no: string }>();
  const { durum, istek } = useOturum();
  const [y, setY] = useState<Yazisma | null>(null);
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const kaydir = useRef<ComponentRef<typeof ScrollView>>(null);

  const yukle = useCallback(() => {
    istek<Yazisma>(`/support/tickets/${no}`)
      .then(setY)
      .catch((e: Error) => setHata(e.message));
  }, [istek, no]);
  useEffect(() => {
    if (durum === 'uye') yukle();
  }, [durum, yukle]);

  async function gonder() {
    if (!metin.trim()) return;
    try {
      setY(
        await istek<Yazisma>(`/support/tickets/${no}/messages`, {
          method: 'POST',
          body: { metin: metin.trim() },
        }),
      );
      setMetin('');
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  async function puanla(puan: number) {
    try {
      setY(await istek<Yazisma>(`/support/tickets/${no}/rating`, { method: 'POST', body: { puan } }));
    } catch (e) {
      setHata((e as Error).message);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
            paddingVertical: 10,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri"
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              borderRadius: butonOran(12),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ikon d="geri" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T accessibilityRole="header" style={{ fontSize: 17, fontWeight: '800' }}>
              Rengarenk Destek
            </T>
            {y ? (
              <T style={{ fontSize: 12, color: colors.muted }}>
                {y.numara} · {y.konuTur} · {y.durumAd}
              </T>
            ) : null}
          </View>
        </View>
        <ScrollView
          ref={kaydir}
          onContentSizeChange={() => kaydir.current?.scrollToEnd({ animated: false })}
          style={{ flex: 1, backgroundColor: '#F6F8FD' }}
          contentContainerStyle={{ padding: 12, gap: 8 }}
        >
          {hata ? (
            <T accessibilityRole="alert" style={{ color: '#A3271F', fontWeight: '700' }}>
              {hata}
            </T>
          ) : null}
          {(y?.mesajlar ?? []).map((m) => {
            const ben = m.taraf === 'kullanici';
            return (
              <View
                key={m.id}
                style={{
                  alignSelf: ben ? 'flex-end' : 'flex-start',
                  maxWidth: '84%',
                  backgroundColor: ben ? colors.blue : colors.surface,
                  borderWidth: ben ? 0 : 1,
                  borderColor: colors.line,
                  borderRadius: radii.buton,
                  paddingVertical: 9,
                  paddingHorizontal: 12,
                }}
              >
                <T style={{ fontSize: 11, fontWeight: '800', color: '#3A4052' }}>
                  {m.kim} · {saat(m.zaman)}
                </T>
                <T style={{ color: ben ? colors.onBlue : colors.ink, fontSize: 14, lineHeight: 21 }}>
                  {m.metin}
                </T>
              </View>
            );
          })}
          {y?.puanVerebilir ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.buton,
                padding: 12,
                marginTop: 6,
              }}
            >
              <T style={{ fontSize: 14, fontWeight: '800' }}>Sorunun nasıl çözüldü?</T>
              <View
                accessibilityLabel="Puan, 5 üzerinden"
                style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    accessibilityRole="button"
                    accessibilityLabel={`${n} puan`}
                    onPress={() => puanla(n)}
                    style={{
                      width: 44,
                      height: 44,
                      borderWidth: 1,
                      borderColor: '#D5DAE5',
                      borderRadius: butonOran(12),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <T style={{ fontSize: 16, fontWeight: '800' }}>{n}</T>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : y?.puan ? (
            <T style={{ fontSize: 13, color: '#11683F', fontWeight: '700', marginTop: 6 }}>
              Puanın için teşekkürler: {y.puan} / 5
            </T>
          ) : null}
        </ScrollView>
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            padding: 10,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            alignItems: 'flex-end',
          }}
        >
          <TInput
            value={metin}
            onChangeText={setMetin}
            multiline
            maxLength={2000}
            accessibilityLabel="Mesajın"
            placeholder={y?.durum === 'cozuldu' ? 'Yazarsan talebin yeniden açılır' : 'Mesaj yaz'}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: '#D5DAE5',
              borderRadius: butonOran(12),
              paddingVertical: 10,
              paddingHorizontal: 12,
              fontSize: 14.5,
              maxHeight: 120,
            }}
          />
          <Pressable
            accessibilityRole="button"
            onPress={gonder}
            style={{
              backgroundColor: colors.blue,
              borderRadius: butonOran(12),
              paddingVertical: 12,
              paddingHorizontal: 16,
            }}
          >
            <T style={{ color: colors.onBlue, fontSize: 14.5, fontWeight: '800' }}>Gönder</T>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
