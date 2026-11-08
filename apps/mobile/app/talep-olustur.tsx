import { colors, dotColor } from '@rengarenk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../components/ikon';
import { T } from '../components/t';

const TINTS = ['#EEF3FF', '#FFEEF6', '#FFF6DF', '#E7FAF0', '#F3EFFF', '#FFF0EA'];
/** Tasarımdaki kategori kartları (SihirbazMobilAkis, KAT ve KATK) */
const AL = [
  ['Otomobil', 'Sedan, hatchback, station'],
  ['Arazi, SUV & Pickup', '4x4, crossover, pikap'],
  ['Elektrikli', 'Tam elektrikli araçlar'],
  ['Motosiklet', 'Scooter, naked, touring'],
  ['Ticari', 'Panelvan, kamyonet, minibüs'],
  ['Deniz', 'Tekne, yat, jet ski'],
  ['Karavan', 'Çekme ve motokaravan'],
  ['ATV & UTV', 'Arazi motosikletleri'],
] as const;
const KIRALA = [
  ['Otomobil', 'Sedan, hatchback, station'],
  ['Arazi, SUV & Pickup', '4x4, crossover, pikap'],
  ['Elektrikli', 'Tam elektrikli araçlar'],
  ['Motosiklet', 'Scooter ve motosiklet'],
  ['Ticari', 'Panelvan, minibüs'],
  ['Karavan', 'Çekme ve motokaravan'],
] as const;

/**
 * Talep oluşturma sihirbazı, 1. adım (tasarım: SihirbazMobilAkis): tam ekran, sekme çubuğu yok. Adım 2–6 talep
 * modülüyle (Sprint 8) gelir; o zamana kadar "Devam et" sonraki adımın henüz açılmadığını söyler.
 */
export default function TalepOlustur() {
  const [islem, setIslem] = useState<'al' | 'kirala'>('al');
  const [kat, setKat] = useState<string>('Otomobil');
  const [bilgi, setBilgi] = useState(false);
  const liste = islem === 'al' ? AL : KIRALA;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'bottom']}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          paddingTop: 10,
          paddingHorizontal: 12,
          paddingBottom: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Geri"
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ikon d="geri" />
          </Pressable>
          <T style={{ fontSize: 15, fontWeight: '800' }}>Talep oluştur</T>
          <View style={{ width: 52 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <View
              key={n}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 3,
                backgroundColor: n === 1 ? colors.blue : colors.line,
              }}
            />
          ))}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingTop: 18 }}
      >
        <T style={{ fontSize: 12.5, fontWeight: '700', color: colors.link }}>Adım 1 / 6 · Kategori</T>
        <T
          accessibilityRole="header"
          style={{ marginTop: 4, marginBottom: 6, fontSize: 22, fontWeight: '800', lineHeight: 27 }}
        >
          Ne arıyorsun?
        </T>
        <T style={{ marginBottom: 16, fontSize: 13.5, color: colors.muted }}>
          Önce ne tür bir araç aradığını seç.
        </T>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="İşlem"
          style={{ flexDirection: 'row', gap: 6, backgroundColor: '#E9ECF4', borderRadius: 14, padding: 4 }}
        >
          {(
            [
              ['al', 'Satın almak'],
              ['kirala', 'Kiralamak'],
            ] as const
          ).map(([k, ad]) => (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityState={{ checked: islem === k }}
              onPress={() => {
                setIslem(k);
                setKat('Otomobil');
              }}
              style={{
                flex: 1,
                borderRadius: 11,
                paddingVertical: 11,
                paddingHorizontal: 6,
                alignItems: 'center',
                backgroundColor: islem === k ? colors.surface : 'transparent',
              }}
            >
              <T style={{ fontSize: 14, fontWeight: '800' }}>{ad}</T>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {liste.map(([ad, alt], i) => {
            const on = kat === ad;
            return (
              <Pressable
                key={ad}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setKat(ad)}
                style={{
                  width: '48.8%',
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? colors.blue : colors.line,
                  backgroundColor: on ? '#F5F8FF' : colors.surface,
                  borderRadius: 16,
                  paddingVertical: on ? 13 : 14,
                  paddingHorizontal: on ? 11 : 12,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    backgroundColor: TINTS[i % TINTS.length],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: dotColor(i) }} />
                </View>
                <T style={{ fontSize: 14.5, fontWeight: '800', marginTop: 10 }}>{ad}</T>
                <T style={{ fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16 }}>{alt}</T>
              </Pressable>
            );
          })}
        </View>
        {bilgi ? (
          <View style={{ marginTop: 14, backgroundColor: '#FFF6DF', borderRadius: 14, padding: 14 }}>
            <T style={{ fontSize: 13.5, color: '#7A5300', fontWeight: '600' }}>
              Talep oluşturmanın sonraki adımları çok yakında açılıyor.
            </T>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          paddingTop: 12,
          paddingHorizontal: 16,
          paddingBottom: 12,
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#D5DAE5',
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <T style={{ fontSize: 15, fontWeight: '700' }}>Geri</T>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setBilgi(true)}
          style={{
            flex: 2,
            backgroundColor: colors.blue,
            borderRadius: 14,
            paddingVertical: 15,
            alignItems: 'center',
          }}
        >
          <T style={{ fontSize: 15.5, fontWeight: '800' }}>Devam et</T>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
