import { colors } from '@rengarenk/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BosDurum } from '../components/bos-durum';
import { Ikon } from '../components/ikon';
import { T } from '../components/t';

const FILTRELER = ['Tümü', 'Mesajlar', 'Taleplerim'] as const;

/**
 * Bildirimler (tasarım: AnasayfaMobil, v.bildirim): geri, başlık, "Tümünü okundu say" ve filtreler. Bildirimler
 * bildirim merkezi (Karar 48) gelince listelenir; o zamana kadar boş liste kartı.
 */
export default function Bildirimler() {
  const [filtre, setFiltre] = useState<(typeof FILTRELER)[number]>('Tümü');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View
        style={{
          backgroundColor: colors.surface,
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
          style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ikon d="geri" />
        </Pressable>
        <T accessibilityRole="header" style={{ flex: 1, fontSize: 18, fontWeight: '800' }}>
          Bildirimler
        </T>
        <Pressable accessibilityRole="button" style={{ paddingVertical: 10, paddingHorizontal: 6 }}>
          <T style={{ fontSize: 13.5, fontWeight: '700', color: colors.link }}>Tümünü okundu say</T>
        </Pressable>
      </View>
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          paddingTop: 12,
          paddingHorizontal: 12,
          paddingBottom: 4,
          backgroundColor: colors.background,
        }}
      >
        {FILTRELER.map((f) => {
          const on = f === filtre;
          return (
            <Pressable
              key={f}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setFiltre(f)}
              style={{
                borderWidth: on ? 0 : 1,
                borderColor: '#D5DAE5',
                backgroundColor: on ? colors.ink : colors.surface,
                borderRadius: 999,
                paddingVertical: on ? 9 : 8,
                paddingHorizontal: on ? 14 : 13,
              }}
            >
              <T
                style={{ fontSize: 13.5, fontWeight: on ? '800' : '700', color: on ? '#FFFFFF' : colors.ink }}
              >
                {f}
              </T>
            </Pressable>
          );
        })}
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 12 }}
      >
        <BosDurum
          baslik="Henüz bildirimin yok"
          metin="Talebine mesaj geldiğinde ve talebinin süresi dolarken burada görürsün."
        />
      </ScrollView>
    </SafeAreaView>
  );
}
