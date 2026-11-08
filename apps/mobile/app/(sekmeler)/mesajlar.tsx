import { colors } from '@rengarenk/shared';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BosDurum } from '../../components/bos-durum';
import { T } from '../../components/t';

const FILTRELER = ['Tümü', 'Okunmamış', 'Arşiv'] as const;

/**
 * Mesajlar (tasarım: MesajlarMobil): başlık, okunmamış sayısı, filtre düğmeleri ve güvenlik notu. Sohbetler
 * mesajlaşma modülüyle gelir; o zamana kadar boş liste kartı.
 */
export default function Mesajlar() {
  const [filtre, setFiltre] = useState<(typeof FILTRELER)[number]>('Tümü');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          paddingTop: 12,
          paddingHorizontal: 16,
          paddingBottom: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800' }}>
            Mesajlar
          </T>
          <T style={{ fontSize: 12.5, fontWeight: '700', color: colors.muted }}>0 okunmamış</T>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, marginTop: 10 }}
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
                  borderWidth: 1,
                  borderColor: on ? colors.ink : '#D5DAE5',
                  backgroundColor: on ? colors.ink : colors.surface,
                  borderRadius: 999,
                  paddingVertical: 8,
                  paddingHorizontal: 13,
                }}
              >
                <T style={{ fontSize: 13.5, fontWeight: '700', color: on ? '#FFFFFF' : colors.ink }}>{f}</T>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 12, gap: 12 }}
      >
        <BosDurum
          baslik="Henüz mesajın yok"
          metin="Talebine satıcılar yazdığında sohbetler burada görünür."
        />
        <View style={{ paddingHorizontal: 4 }}>
          <T style={{ fontSize: 12, color: colors.muted, lineHeight: 17 }}>
            Satıcı numaranı yalnızca sen “numaramı paylaş” dersen görür. Kapora isteyen, ödeme bağlantısı
            gönderen satıcıyı şikayet et; mesaj hemen gizlenir.
          </T>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
