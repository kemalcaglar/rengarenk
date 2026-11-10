import { colors, kartOran, RATING_LABELS, radii } from '@rengarenk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useOturum } from '../lib/oturum';
import { T } from './t';

/**
 * Yıldız ver (tasarım: MesajlarMobil.dc.html › puan penceresi; Karar 55): alttan açılır. Yalnızca yıldız, yorum yok;
 * puan satıcıya isimsiz gider. Gönderince "Teşekkürler" ve "Aracı buldum".
 */
export function PuanVer({
  acik,
  sohbet,
  ad,
  bas,
  alt,
  kapat,
  verildi,
}: {
  acik: boolean;
  sohbet: string;
  ad: string;
  bas: string;
  alt: string;
  kapat: () => void;
  verildi: (yildiz: number) => void;
}) {
  const { istek } = useOturum();
  const [yildiz, setYildiz] = useState(0);
  const [tamam, setTamam] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function gonder() {
    if (!yildiz) return;
    setHata(null);
    try {
      await istek(`/conversations/${sohbet}/rating`, { method: 'POST', body: { yildiz } });
      setTamam(true);
      verildi(yildiz);
    } catch (e) {
      setHata((e as Error).message);
    }
  }
  const kapa = () => {
    setTamam(false);
    setYildiz(0);
    kapat();
  };

  return (
    <Modal visible={acik} transparent animationType="slide" onRequestClose={kapa}>
      <Pressable
        accessibilityLabel="Kapat"
        onPress={kapa}
        style={{ flex: 1, backgroundColor: 'rgba(30,35,51,0.45)' }}
      />
      <View
        accessibilityViewIsModal
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: kartOran(24),
          borderTopRightRadius: kartOran(24),
          paddingTop: 10,
          paddingHorizontal: 20,
          paddingBottom: 28,
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 40,
            height: 5,
            borderRadius: Math.min(radii.etiket, 3),
            backgroundColor: '#D5DAE5',
            marginBottom: 14,
          }}
        />
        {!tamam ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#FFF6DF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <T style={{ fontSize: 15, fontWeight: '800' }}>{bas}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800' }}>
                  {ad} nasıldı?
                </T>
                <T style={{ fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{alt}</T>
              </View>
            </View>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Puan, 5 üzerinden"
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                marginTop: 22,
                marginBottom: 6,
              }}
            >
              {[1, 2, 3, 4, 5].map((n) => {
                const on = n <= yildiz;
                return (
                  <Pressable
                    key={n}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: n === yildiz }}
                    accessibilityLabel={`${n} yıldız, ${RATING_LABELS[n]}`}
                    onPress={() => setYildiz(n)}
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: radii.buton,
                      backgroundColor: on ? '#FFF6DF' : '#F6F8FD',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Svg width={32} height={32} viewBox="0 0 24 24">
                      <Path
                        d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
                        fill={on ? '#FFC84A' : '#FFFFFF'}
                        stroke={on ? '#B07A00' : '#AEB5C4'}
                        strokeWidth={1.6}
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </Pressable>
                );
              })}
            </View>
            <T style={{ textAlign: 'center', fontSize: 14.5, fontWeight: '800', minHeight: 20 }}>
              {RATING_LABELS[yildiz]}
            </T>
            <View
              style={{ marginTop: 16, backgroundColor: '#F6F8FD', borderRadius: radii.buton, padding: 12 }}
            >
              <T style={{ fontSize: 12.5, color: '#3A4052', lineHeight: 18 }}>
                Yalnızca yıldız verilir, yorum yazılmaz. Puanın satıcıya isimsiz gider; profilinde tek tek
                puan değil,{' '}
                <T style={{ fontSize: 12.5, fontWeight: '800', color: '#3A4052' }}>Güvenilir satıcı</T> ve{' '}
                <T style={{ fontSize: 12.5, fontWeight: '800', color: '#3A4052' }}>Hızlı yanıt</T> gibi
                rozetler görünür.
              </T>
            </View>
            {hata ? (
              <T accessibilityRole="alert" style={{ marginTop: 8, fontSize: 13, color: '#A3271F' }}>
                {hata}
              </T>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Pressable
                accessibilityRole="button"
                onPress={kapa}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#D5DAE5',
                  borderRadius: radii.buton,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
              >
                <T style={{ fontSize: 15, fontWeight: '700' }}>Sonra</T>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !yildiz }}
                onPress={gonder}
                style={{
                  flex: 2,
                  backgroundColor: yildiz ? colors.blue : '#E3E6EF',
                  borderRadius: radii.buton,
                  paddingVertical: 15,
                  alignItems: 'center',
                }}
              >
                <T style={{ fontSize: 15.5, fontWeight: '800', color: yildiz ? colors.ink : colors.muted }}>
                  Puanı gönder
                </T>
              </Pressable>
            </View>
            <T
              style={{
                textAlign: 'center',
                marginTop: 12,
                fontSize: 13,
                fontWeight: '700',
                color: '#8A91A3',
              }}
            >
              Bir sorun mu yaşadın? Şikayet et
            </T>
          </>
        ) : (
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: '#E7FAF0',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M5 12l5 5 9-10"
                  stroke="#11683F"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <T
              accessibilityRole="header"
              style={{ marginTop: 12, marginBottom: 4, fontSize: 18, fontWeight: '800' }}
            >
              Teşekkürler
            </T>
            <T style={{ fontSize: 13.5, color: colors.muted, textAlign: 'center' }}>
              Puanın kaydedildi. Aracı bulduysan talebini kapatabilirsin; satıcılar sana yazmayı bırakır.
            </T>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, alignSelf: 'stretch' }}>
              <Pressable
                accessibilityRole="button"
                onPress={kapa}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#D5DAE5',
                  borderRadius: radii.buton,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
              >
                <T style={{ fontSize: 14.5, fontWeight: '700' }}>Kapat</T>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                onPress={() => {
                  kapa();
                  router.push('/taleplerim');
                }}
                style={{
                  flex: 1,
                  backgroundColor: colors.green,
                  borderRadius: radii.buton,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
              >
                <T style={{ color: colors.onGreen, fontSize: 14.5, fontWeight: '800' }}>Aracı buldum</T>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
